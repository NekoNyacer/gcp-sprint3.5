import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { LocationPoint, LocationStore } from '../../../shared/stores/location-store';
import { WalkSessionStore } from '../../../shared/stores/walk-session-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { HomeMapComponent, PLANNING_MARKER_LONG_PRESS_MS } from './home-map.component';
import { MapCameraController } from './map-camera.controller';
import { demoPlantingSpots, settings } from '../../../environments/environment-dev';
import { WalkRoutePoint, WalkTaskPoint } from '../../../shared/models/walk-task.models';
import { homeTrees, recommendHomeTrees } from '../home-tree-recommendations';
import { cmsRouteRoles, cmsPublication } from '../../../shared/models/cms-publication';

const mock = vi.hoisted(() => ({
  markers: [] as { element: HTMLButtonElement; anchor: string; remove: ReturnType<typeof vi.fn> }[],
  popups: [] as {
    options: Record<string, unknown>;
    coordinates?: number[];
    content?: HTMLElement;
    close?: () => void;
    remove: ReturnType<typeof vi.fn>;
  }[],
  frames: new Map<number, FrameRequestCallback>(),
  frameId: 0,
  popupBounds: { left: 50, right: 310, top: 200, bottom: 490 },
  handlers: new Map<string, (event: { originalEvent?: Event; sourceId?: string; error?: Error }) => unknown>(),
  map: {
    on: vi.fn(),
    resize: vi.fn(),
    addControl: vi.fn(),
    getBearing: vi.fn(() => 0),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn(),
    isSourceLoaded: vi.fn(() => true),
    querySourceFeatures: vi.fn(() => []),
    getLayer: vi.fn(),
    getContainer: vi.fn(() => ({
      clientWidth: 390,
      clientHeight: 844,
      getBoundingClientRect: () => ({ left: 0, right: 390, top: 0, bottom: 844 }),
    })),
    project: vi.fn(() => ({ x: 195, y: 422 })),
    easeTo: vi.fn(),
    cameraForBounds: vi.fn(),
    panBy: vi.fn(),
    jumpTo: vi.fn(),
    remove: vi.fn(),
  },
  source: { setData: vi.fn() },
  heading: {
    element: null as HTMLElement | null,
    setLngLat: vi.fn(),
    setRotation: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('mapbox-gl', () => ({
  default: {
    Map: class {
      constructor() {
        return mock.map;
      }
    },
    NavigationControl: class {},
    LngLatBounds: class {
      readonly coordinates: number[][] = [];
      extend(coordinates: number[]) {
        this.coordinates.push(coordinates);
        return this;
      }
    },
    Popup: class {
      private readonly record;
      constructor(options: Record<string, unknown>) {
        this.record = {
          options,
          remove: vi.fn(),
          coordinates: undefined as number[] | undefined,
          content: undefined as HTMLElement | undefined,
          close: undefined as (() => void) | undefined,
        };
        mock.popups.push(this.record);
      }
      setLngLat(coordinates: number[]) {
        this.record.coordinates = coordinates;
        return this;
      }
      setDOMContent(content: HTMLElement) {
        this.record.content = content;
        return this;
      }
      on(_name: string, handler: () => void) {
        this.record.close = handler;
        return this;
      }
      getElement() {
        return { getBoundingClientRect: () => mock.popupBounds };
      }
      addTo() {
        document.body.append(this.record.content!);
        return this;
      }
      remove() {
        this.record.remove();
        this.record.content?.remove();
        this.record.close?.();
      }
    },
    Marker: class {
      private readonly record;

      constructor(options: { element: HTMLElement; anchor: string }) {
        this.record = { ...options, remove: vi.fn() };
        if (options.element instanceof HTMLButtonElement) {
          mock.markers.push({ ...this.record, element: options.element });
        } else {
          mock.heading.element = options.element;
        }
      }

      setLngLat(coordinates: number[]) {
        if (!(this.record.element instanceof HTMLButtonElement)) {
          mock.heading.setLngLat(coordinates);
        }
        return this;
      }
      setRotation(heading: number) {
        mock.heading.setRotation(heading);
        return this;
      }
      addTo() {
        return this;
      }
      remove() {
        if (this.record.element instanceof HTMLButtonElement) this.record.remove();
        else mock.heading.remove();
      }
    },
  },
}));

describe('Home map player following', () => {
  const initialSettings = { mockMap: settings.mockMap, isDev: settings.isDev };
  let runtimeConfig: typeof window.__CAT_WALK_RUNTIME_CONFIG__;

  beforeEach(() => {
    cmsRouteRoles.set(null);
    runtimeConfig = window.__CAT_WALK_RUNTIME_CONFIG__;
    settings.mockMap = false;
    settings.isDev = false;
    window.__CAT_WALK_RUNTIME_CONFIG__ = { mapboxAccessToken: 'test-public-token' };
    vi.clearAllMocks();
    mock.handlers.clear();
    mock.markers.length = 0;
    mock.popups.length = 0;
    mock.frames.clear();
    mock.popupBounds = { left: 50, right: 310, top: 200, bottom: 490 };
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++mock.frameId;
      mock.frames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => mock.frames.delete(id));
    mock.map.on.mockImplementation((name, handler) => {
      mock.handlers.set(name, handler);
    });
    mock.map.getSource.mockImplementation((name) =>
      name === 'user-position' ? mock.source : undefined,
    );
    mock.map.project.mockReturnValue({ x: 195, y: 422 });
    mock.map.getContainer.mockReturnValue({
      clientWidth: 390,
      clientHeight: 844,
      getBoundingClientRect: () => ({ left: 0, right: 390, top: 0, bottom: 844 }),
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    mock.map.cameraForBounds.mockReturnValue({ center: [121.46, 25.01], zoom: 13 });
    vi.spyOn(HomeMapComponent.prototype, 'drawDestination').mockImplementation(() => {});
  });

  afterEach(() => {
    cmsRouteRoles.set(null);
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.assign(settings, initialSettings);
    window.__CAT_WALK_RUNTIME_CONFIG__ = runtimeConfig;
  });

  function flushFrames(): void {
    const frames = [...mock.frames.values()];
    mock.frames.clear();
    for (const callback of frames) callback(0);
  }

  function pressMarker(button: HTMLButtonElement, duration = PLANNING_MARKER_LONG_PRESS_MS): void {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      vi.advanceTimersByTime(duration);
      button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
      button.click();
      vi.advanceTimersByTime(0);
    } finally {
      vi.useRealTimers();
    }
  }

  async function setup(followBeforeLoad = false, beforeLoad?: () => void) {
    const selectedTaskPoints = signal<WalkTaskPoint[]>([]);
    const availableTaskPoints = signal<WalkTaskPoint[]>([]);
    const taskRoutes = signal<WalkTaskPoint[]>([]);
    const planning = signal(false);
    const hasDestination = signal(false);
    const walking = signal(true);
    const activeRoute = signal(true);
    const checkedInTaskIds = signal<string[]>([]);
    const destination = signal<{ id: string } | null>(null);
    const treeStops = signal<WalkRoutePoint[]>([]);
    const current = signal<LocationPoint | null>({
      longitude: 121.454754,
      latitude: 25.001002,
      accuracy: 5,
      observedAt: new Date(),
    });
    TestBed.configureTestingModule({
      imports: [HomeMapComponent],
      providers: [
        MapCameraController,
        { provide: LocationStore, useValue: { current } },
        {
          provide: WalkSessionStore,
          useValue: {
            taskPoints: selectedTaskPoints,
            availableTaskPoints,
            taskRoutes,
            isPlanning: planning,
            hasDestination,
            destinationConfirmed: hasDestination,
            treeStops,
            isWalking: walking,
            hasActiveRoute: activeRoute,
            checkedInTaskIds,
            destination,
            setPlanningError: vi.fn(),
            isArrived: signal(false),
            route: signal([]),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(HomeMapComponent);
    const camera = TestBed.inject(MapCameraController);
    fixture.detectChanges();
    if (followBeforeLoad) {
      camera.request({ kind: 'follow-player', position: current()! });
    }

    beforeLoad?.();
    fixture.detectChanges();
    await mock.handlers.get('load')!({});
    fixture.detectChanges();
    mock.map.jumpTo.mockClear();
    return {
      fixture,
      camera,
      current,
      selectedTaskPoints,
      availableTaskPoints,
      taskRoutes,
      planning,
      hasDestination,
      walking,
      activeRoute,
      checkedInTaskIds,
      destination,
      treeStops,
    };
  }

  const waterStation: WalkTaskPoint = {
    id: 'water-station',
    name: '補水繞路挑戰',
    kind: 'water',
    description: 'Water task',
    supplyStation: {
      category: '美食',
      isCathayTwqrMerchant: true,
      offer: '買一送一',
      terms: 'Demo',
      supply: { resource: 'water', amount: 10 },
      validUntil: '2026/10/31',
    },
    position: { longitude: 121.455, latitude: 25.002 },
    isDemo: true,
    estimatedExtraSteps: 300,
    routeStop: {
      position: { longitude: 121.455, latitude: 25.002 },
      segmentIndex: 0,
      fraction: 0.5,
    },
  };
  const fertilizerStation: WalkTaskPoint = {
    ...waterStation,
    id: 'fertilizer-station',
    name: '肥料極限繞路挑戰',
    kind: 'fertilizer',
  };

  it('replaces dense markers with a count, expands on click and restores singles', async () => {
    vi.mocked(HomeMapComponent.prototype.drawDestination).mockRestore();
    const { fixture, activeRoute, camera } = await setup();
    const source = { setData: vi.fn(), getClusterExpansionZoom: vi.fn() };
    mock.map.getSource.mockImplementation((name) => name === 'home-marker-clusters' ? source : mock.source);
    activeRoute.set(false);
    fixture.detectChanges();
    const trees = mock.markers.filter(({ element }) => element.classList.contains('tree-marker'));
    const clustered = [{ geometry: { type: 'Point', coordinates: [121.55, 25.08] },
      properties: { cluster_id: 7, point_count: 3 } }];
    mock.map.querySourceFeatures.mockReturnValue(clustered as never);
    mock.handlers.get('render')!({});
    const cluster = mock.markers.find(({ element }) => element.classList.contains('home-map-cluster'))!;
    expect(cluster.element.textContent).toBe('3');
    expect(trees[0].element.style.visibility).toBe('hidden');
    const stop = vi.spyOn(camera, 'stopFollowing');
    cluster.element.click();
    expect(source.getClusterExpansionZoom).toHaveBeenCalledWith(7, expect.any(Function));
    source.getClusterExpansionZoom.mock.calls[0][1](null, 16);
    expect(stop).toHaveBeenCalled();
    expect(mock.map.easeTo).toHaveBeenCalledWith({ center: [121.55, 25.08], zoom: 16, duration: 500 });
    mock.map.querySourceFeatures.mockReturnValue([{ geometry: { type: 'Point', coordinates: [121.55, 25.08] },
      properties: { id: `tree:${homeTrees[0].id}` } }] as never);
    mock.handlers.get('render')!({});
    expect(trees[0].element.style.visibility).toBe('');
    expect(cluster.remove).toHaveBeenCalled();
    fixture.destroy();
  });

  it('hides merchant supply offers while idle even when a published catalog exists', async () => {
    const {fixture, planning, activeRoute} = await setup();
    planning.set(false);
    activeRoute.set(false);
    cmsPublication.set({config: {merchants: [{id: 'published-supply', name: '展示補給', address: '模擬位置',
      latitude: 25.01, longitude: 121.46, category: '美食', roles: ['supply'], enabled: true, twqr: false,
      offer: '不應在閒置時出現的優惠', terms: 'Demo', validUntil: '2099-12-31', resource: 'water', amount: 10,
      weather: 'sunny', timeOfDay: 'day'}], trees: [], species: [], rewards: [], scenes: [], harvestPoints: 0}, version: 1, managed: true});
    try {
      fixture.detectChanges();
      expect(fixture.componentInstance.taskPoints()).toEqual([]);
    } finally {
      cmsPublication.set({config: null, version: 0, managed: false});
      fixture.destroy();
    }
  });

  it('keeps recommended supply stations outside clusters and restores clustering when recommendations clear', async () => {
    const { fixture, planning, hasDestination, availableTaskPoints, activeRoute } = await setup();
    const source = { setData: vi.fn() };
    mock.map.getSource.mockImplementation((name) => name === 'home-marker-clusters' ? source : mock.source);
    activeRoute.set(false);
    planning.set(true);
    hasDestination.set(true);
    availableTaskPoints.set([waterStation, fertilizerStation]);
    fixture.detectChanges();
    mock.map.querySourceFeatures.mockReturnValue([{
      geometry: { type: 'Point', coordinates: [121.455, 25.002] },
      properties: { cluster_id: 7, point_count: 2 },
    }] as never);
    mock.handlers.get('render')!({});
    const stations = () => mock.markers.filter(({ element }) => element.classList.contains('supply-station-marker')).slice(-2);
    expect(stations()[0].element.style.visibility).toBe('hidden');

    cmsRouteRoles.set([{ merchantId: waterStation.id, role: 'supply', reason: 'Nearby supply' }]);
    fixture.detectChanges();
    const ids = () => source.setData.mock.lastCall![0].features.map((feature: { properties: { id: string } }) => feature.properties.id);
    expect(ids()).not.toContain(`station:${waterStation.id}`);
    expect(ids()).toContain(`station:${fertilizerStation.id}`);
    mock.handlers.get('render')!({});
    expect(stations()[0].element.style.visibility).toBe('');
    expect(stations()[1].element.style.visibility).toBe('hidden');

    cmsRouteRoles.set(null);
    fixture.detectChanges();
    expect(ids()).toContain(`station:${waterStation.id}`);
    mock.handlers.get('render')!({});
    expect(stations()[0].element.style.visibility).toBe('hidden');
    fixture.destroy();
  });

  it('renders all trees as green-style circular markers and preserves selection/cultivation clicks', async () => {
    vi.mocked(HomeMapComponent.prototype.drawDestination).mockRestore();
    const { fixture, planning, destination, activeRoute } = await setup();
    activeRoute.set(false);
    fixture.detectChanges();
    const markers = mock.markers.filter(({ element }) => element.classList.contains('tree-marker'));
    expect(markers).toHaveLength(homeTrees.length);
    const select = vi.fn();
    const cultivate = vi.fn();
    fixture.componentInstance.destinationSelect.subscribe(select);
    fixture.componentInstance.cultivationSelect.subscribe(cultivate);
    markers[0].element.click();
    expect(cultivate).toHaveBeenCalledExactlyOnceWith(homeTrees[0].id);
    planning.set(true);
    fixture.detectChanges();
    markers[3].element.click();
    expect(select).toHaveBeenCalledExactlyOnceWith(homeTrees[3].id);
    expect(mock.popups).toHaveLength(0);
    for (const { element, anchor } of markers) {
      expect(anchor).toBe('center');
      expect(element.getAttribute('aria-pressed')).toBe('false');
      expect(element.querySelector('img')?.getAttribute('src')).toContain(
        element.classList.contains('tree-marker--empty')
          ? 'planting-spot-icon.svg'
          : 'cathay-tree-icon.svg',
      );
    }
    destination.set({ id: homeTrees[3].id });
    fixture.detectChanges();
    expect(markers[3].element.getAttribute('aria-pressed')).toBe('true');
    expect(markers[3].element.querySelector('.tree-marker__check')).not.toBeNull();
    destination.set({ id: homeTrees[0].id });
    fixture.detectChanges();
    expect(markers[3].element.querySelector('.tree-marker__check')).toBeNull();
    expect(markers[0].element.querySelector('.tree-marker__check')).not.toBeNull();
    fixture.destroy();
    expect(markers.every(({ remove }) => remove.mock.calls.length === 1)).toBe(true);
  });

  it('shows a gray arrow-redo icon while harvested, then restores the empty planting marker', async () => {
    vi.mocked(HomeMapComponent.prototype.drawDestination).mockRestore();
    const { fixture, activeRoute } = await setup();
    activeRoute.set(false);
    const progress = TestBed.inject(ProgressStore);
    const treeId = 'tree-6';
    const tree = progress.demoTrees()[treeId];
    patchState(progress as never, {
      demoTrees: {
        ...progress.demoTrees(),
        [treeId]: {
          ...tree,
          harvestCount: 1,
          harvestedAt: Date.now(),
          harvestedOn: progress.demoDay(),
        },
      },
    });
    fixture.detectChanges();

    const marker = mock.markers.find(({ element }) =>
      element.title.includes(homeTrees.find(({ id }) => id === treeId)!.nickName),
    )!.element;
    const harvestedIcon = marker.querySelector('ion-icon');
    expect(harvestedIcon?.getAttribute('name')).toBe('arrow-redo');
    expect(harvestedIcon?.classList.contains('tree-marker__harvested-icon')).toBe(true);
    expect(marker.classList.contains('tree-marker--harvested')).toBe(true);
    expect(marker.classList.contains('tree-marker--unavailable')).toBe(true);
    expect(marker.title).toContain('等待種植地復原中');
    expect(marker.querySelector('img')).toBeNull();

    patchState(progress as never, {
      demoTrees: {
        ...progress.demoTrees(),
        [treeId]: {
          ...progress.demoTrees()[treeId],
          planted: false,
          growth: 0,
          harvestCount: 0,
          harvestedAt: null,
          harvestedOn: null,
        },
      },
    });
    fixture.detectChanges();
    expect(marker.querySelector('ion-icon')).toBeNull();
    expect(marker.querySelector('img')?.getAttribute('src')).toContain('planting-spot-icon.svg');
    expect(marker.classList.contains('tree-marker--harvested')).toBe(false);
    expect(marker.classList.contains('tree-marker--empty')).toBe(true);
    expect(marker.classList.contains('tree-marker--unavailable')).toBe(false);
  });

  it('requires a long press to inspect unavailable markers and still updates empty markers after planting', async () => {
    vi.mocked(HomeMapComponent.prototype.drawDestination).mockRestore();
    const { fixture, planning, activeRoute } = await setup();
    activeRoute.set(false);
    planning.set(true);
    const progress = TestBed.inject(ProgressStore);
    progress.markDemoTreeVisited('tree-5');
    fixture.detectChanges();
    const select = vi.fn();
    const inspect = vi.fn();
    fixture.componentInstance.destinationSelect.subscribe(select);
    fixture.componentInstance.cultivationSelect.subscribe(inspect);
    const marker = mock.markers.find(({ element }) => element.title.includes('銀杏123'))!.element;
    expect(marker.classList.contains('tree-marker--unavailable')).toBe(true);
    expect(marker.disabled).toBe(false);
    marker.click();
    expect(inspect).not.toHaveBeenCalled();
    pressMarker(marker);
    expect(inspect).toHaveBeenCalledExactlyOnceWith('tree-5');
    expect(select).not.toHaveBeenCalled();
    const spot = demoPlantingSpots[0];
    const empty = mock.markers.find(({ element }) => element.title.includes(spot.poiName))!.element;
    expect(empty.classList.contains('tree-marker--empty')).toBe(true);
    empty.click();
    expect(select).toHaveBeenCalledExactlyOnceWith(spot.id);
    progress.selectDemoTree(spot.id);
    progress.plantDemoSeed();
    fixture.detectChanges();
    expect(empty.classList.contains('tree-marker--empty')).toBe(false);
    expect(empty.querySelector('img')?.getAttribute('src')).toContain('cathay-tree-icon.svg');
  });

  it('shows only the destination tree after route confirmation and restores all trees when the route ends', async () => {
    vi.mocked(HomeMapComponent.prototype.drawDestination).mockRestore();
    const { fixture, planning, destination, activeRoute, walking, selectedTaskPoints } =
      await setup();
    const markers = mock.markers.filter(({ element }) => element.className === 'tree-marker');
    activeRoute.set(false);
    planning.set(true);
    walking.set(false);
    destination.set({ id: homeTrees[4].id });
    fixture.detectChanges();
    expect(markers.every(({ element }) => !element.hidden)).toBe(true);

    planning.set(false);
    activeRoute.set(true);
    walking.set(true);
    selectedTaskPoints.set([waterStation]);
    fixture.detectChanges();
    expect(
      markers.filter(({ element }) => !element.hidden).map(({ element }) => element.title),
    ).toEqual([expect.stringContaining(homeTrees[4].nickName)]);
    expect(markers[4].element.getAttribute('aria-pressed')).toBe('true');
    const station = mock.markers.find(
      ({ element }) => element.className === 'supply-station-marker',
    )!;
    expect(station.element.hidden).toBe(false);
    const cultivate = vi.fn();
    fixture.componentInstance.cultivationSelect.subscribe(cultivate);
    markers[4].element.click();
    expect(cultivate).toHaveBeenCalledExactlyOnceWith(homeTrees[4].id);

    walking.set(false);
    fixture.detectChanges();
    expect(markers.filter(({ element }) => !element.hidden)).toHaveLength(1);

    activeRoute.set(false);
    destination.set(null);
    fixture.detectChanges();
    expect(markers.every(({ element }) => !element.hidden)).toBe(true);
    expect(markers.every(({ element }) => element.getAttribute('aria-pressed') === 'false')).toBe(
      true,
    );
    expect(station.remove).toHaveBeenCalledOnce();
  });

  it('opens explicit join and remove popups for trees and empty points only after locking the destination', async () => {
    const { fixture, planning, activeRoute, hasDestination, destination, treeStops } =
      await setup();
    planning.set(true);
    activeRoute.set(false);
    destination.set({ id: 'tree-5' });
    const select = vi.fn();
    const toggle = vi.fn();
    fixture.componentInstance.destinationSelect.subscribe(select);
    fixture.componentInstance.treeStopToggle.subscribe(toggle);
    fixture.componentInstance.clickIcon('tree-8');
    expect(select).toHaveBeenCalledExactlyOnceWith('tree-8');
    expect(mock.popups).toHaveLength(0);
    hasDestination.set(true);
    fixture.componentInstance.longPressIcon('tree-8');
    fixture.detectChanges();
    const popup = mock.popups.at(-1)!;
    expect(popup.content?.textContent).toContain('加入路線');
    expect(select).toHaveBeenCalledTimes(1);
    expect(toggle).not.toHaveBeenCalled();
    popup.content!.querySelector<HTMLElement>('.station-card__actions ion-button[color="primary"]')!.click();
    expect(toggle).toHaveBeenCalledExactlyOnceWith('tree-8');
    treeStops.set([
      {
        id: 'tree-8',
        position: homeTrees[7].position,
        routeStop: { position: homeTrees[7].position, segmentIndex: 1, fraction: 0.5 },
      },
    ]);
    fixture.componentInstance.longPressIcon('tree-8');
    fixture.detectChanges();
    expect(mock.popups.at(-1)!.content?.textContent).toContain('移出路線');
    fixture.componentInstance.longPressIcon(demoPlantingSpots[0].id);
    fixture.detectChanges();
    expect(mock.popups.at(-1)!.content?.textContent).toContain('空地');
    expect(mock.popups.at(-1)!.content?.textContent).toContain('加入路線');
    fixture.componentInstance.closeStationPopup();
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('uses short taps only to select an unlocked destination and long presses to inspect tree markers', async () => {
    vi.mocked(HomeMapComponent.prototype.drawDestination).mockRestore();
    const { fixture, planning, activeRoute, hasDestination, destination } = await setup();
    const treeId = 'tree-8';
    const tree = homeTrees.find(({ id }) => id === treeId)!;
    planning.set(true);
    activeRoute.set(false);
    fixture.detectChanges();
    const marker = mock.markers.find(({ element }) => element.title.includes(tree.nickName))!.element;
    const select = vi.fn();
    const inspect = vi.fn();
    fixture.componentInstance.destinationSelect.subscribe(select);
    fixture.componentInstance.cultivationSelect.subscribe(inspect);

    pressMarker(marker, PLANNING_MARKER_LONG_PRESS_MS - 1);
    expect(select).toHaveBeenCalledExactlyOnceWith(treeId);
    expect(inspect).not.toHaveBeenCalled();
    expect(mock.popups).toHaveLength(0);

    pressMarker(marker);
    expect(select).toHaveBeenCalledExactlyOnceWith(treeId);
    expect(inspect).toHaveBeenCalledExactlyOnceWith(treeId);

    destination.set({ id: 'tree-5' });
    hasDestination.set(true);
    fixture.detectChanges();
    marker.click();
    expect(mock.popups).toHaveLength(0);
    expect(inspect).toHaveBeenCalledExactlyOnceWith(treeId);

    pressMarker(marker);
    fixture.detectChanges();
    expect(mock.popups).toHaveLength(1);
    expect(mock.popups[0].content?.textContent).toContain('加入路線');
    expect(inspect).toHaveBeenCalledExactlyOnceWith(treeId);
  });

  it('hides preloaded station markers until the candidate destination is confirmed', async () => {
    const {
      fixture,
      planning,
      activeRoute,
      hasDestination,
      destination,
      taskRoutes,
      availableTaskPoints,
    } = await setup();
    activeRoute.set(false);
    planning.set(true);
    destination.set({ id: 'tree-5' });
    taskRoutes.set([waterStation]);
    availableTaskPoints.set([waterStation]);
    fixture.detectChanges();
    expect(mock.markers).toHaveLength(0);
    hasDestination.set(true);
    fixture.detectChanges();
    expect(mock.markers).toHaveLength(1);
    expect(mock.markers[0].element.classList.contains('supply-station-marker')).toBe(true);
  });

  it('keeps unavailable intermediate candidates view-only and closes a popup that becomes unavailable', async () => {
    const { fixture, planning, activeRoute, hasDestination, destination } = await setup();
    planning.set(true);
    activeRoute.set(false);
    hasDestination.set(true);
    destination.set({ id: 'tree-5' });
    fixture.componentInstance.longPressIcon('tree-8');
    fixture.detectChanges();
    const popup = mock.popups.at(-1)!;
    TestBed.inject(ProgressStore).markDemoTreeVisited('tree-8');
    fixture.detectChanges();
    expect(popup.remove).toHaveBeenCalledOnce();
    const inspect = vi.fn();
    fixture.componentInstance.cultivationSelect.subscribe(inspect);
    fixture.componentInstance.longPressIcon('tree-8');
    expect(inspect).toHaveBeenCalledExactlyOnceWith('tree-8');
    expect(mock.popups.at(-1)).toBe(popup);
  });

  it('retains selected intermediate tree and empty-point markers with the destination during an active route', async () => {
    vi.mocked(HomeMapComponent.prototype.drawDestination).mockRestore();
    const { fixture, treeStops, destination, activeRoute, planning } = await setup();
    destination.set({ id: 'tree-5' });
    treeStops.set(
      ['tree-8', demoPlantingSpots[0].id].map((id) => {
        const point = homeTrees.find((tree) => tree.id === id)!;
        return {
          id,
          position: point.position,
          routeStop: { position: point.position, segmentIndex: 1, fraction: 0.5 },
        };
      }),
    );
    activeRoute.set(true);
    planning.set(false);
    fixture.detectChanges();
    const markers = mock.markers.filter(({ element }) => element.classList.contains('tree-marker'));
    expect(markers.filter(({ element }) => !element.hidden)).toHaveLength(3);
    expect(
      markers.filter(({ element }) => element.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(3);
    expect(
      markers
        .filter(({ element }) => !element.hidden)
        .every(({ element }) => element.querySelector('.tree-marker__check')),
    ).toBe(true);
    activeRoute.set(false);
    destination.set(null);
    treeStops.set([]);
    fixture.detectChanges();
    expect(markers.every(({ element }) => !element.hidden)).toBe(true);
  });

  it('automatically shows exactly three recommendation cards only in planning', async () => {
    const { fixture, planning, current, destination } = await setup();
    const trees = recommendHomeTrees(current(), 4);
    fixture.componentRef.setInput('recommendedTrees', trees);
    fixture.detectChanges();
    expect(mock.popups).toHaveLength(0);
    planning.set(true);
    fixture.detectChanges();
    const popups = mock.popups.filter(
      ({ options }) => options['className'] === 'tree-recommendation-popup',
    );
    expect(popups).toHaveLength(3);
    trees.slice(0, 3).forEach((tree, index) => {
      const popup = popups[index];
      expect(popup.options).toMatchObject({
        closeButton: false,
        closeOnClick: false,
        focusAfterOpen: false,
      });
      expect(popup.coordinates).toEqual([tree.position.longitude, tree.position.latitude]);
      const action = popup.content?.matches('.tree-recommendation')
        ? popup.content : popup.content?.querySelector('.tree-recommendation');
      expect(action?.getAttribute('aria-label')).toContain(tree.nickName);
      expect(popup.content?.textContent).toContain(tree.species);
      expect(popup.content?.textContent).toContain(tree.poiName);
      if (tree.recommendedReason) {
        expect(popup.content?.querySelector('.tree-recommendation__status')?.textContent).toBe(
          tree.recommendedReason,
        );
      } else {
        expect(popup.content?.querySelector('.tree-recommendation__status')).toBeNull();
      }
      expect(popup.content?.textContent).toContain('步');
      expect(popup.content?.textContent).not.toContain('天氣');
    });
    const select = vi.fn();
    fixture.componentInstance.destinationSelect.subscribe(select);
    popups[0].content?.click();
    expect(select).toHaveBeenCalledExactlyOnceWith(trees[0].id);
    destination.set({ id: trees[0].id });
    fixture.detectChanges();
    expect(popups.every(({ remove }) => remove.mock.calls.length === 1)).toBe(true);
    expect(document.body.querySelector('.tree-recommendation')).toBeNull();
    const count = mock.popups.length;
    fixture.componentRef.setInput('showRecommendations', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('showRecommendations', true);
    fixture.detectChanges();
    expect(mock.popups).toHaveLength(count);
    planning.set(false);
    fixture.detectChanges();
    expect(popups.every(({ remove }) => remove.mock.calls.length === 1)).toBe(true);
    expect(document.body.querySelector('.tree-recommendation')).toBeNull();
  });

  it('toggles recommendation popups without changing tree selection or moving the camera', async () => {
    const { fixture, planning, current, destination } = await setup();
    fixture.componentRef.setInput('recommendedTrees', recommendHomeTrees(current()));
    planning.set(true);
    fixture.detectChanges();
    const first = [...mock.popups];
    expect(first).toHaveLength(3);
    fixture.componentRef.setInput('showRecommendations', false);
    fixture.detectChanges();
    expect(first.every(({ remove }) => remove.mock.calls.length === 1)).toBe(true);
    expect(document.body.querySelector('.tree-recommendation')).toBeNull();
    fixture.componentRef.setInput('showRecommendations', true);
    fixture.detectChanges();
    expect(document.body.querySelectorAll('.tree-recommendation')).toHaveLength(3);
    expect(destination()).toBeNull();
    expect(mock.map.easeTo).not.toHaveBeenCalled();
    expect(mock.map.panBy).not.toHaveBeenCalled();
  });

  it('does not show recommendation popups when a non-recommended destination is selected', async () => {
    const { fixture, planning, current, destination } = await setup();
    const trees = recommendHomeTrees(current());
    const other = homeTrees.find(
      (tree) => !trees.some((recommended) => recommended.id === tree.id),
    )!;
    fixture.componentRef.setInput('recommendedTrees', trees);
    destination.set({ id: other.id });
    planning.set(true);
    fixture.detectChanges();
    expect(mock.popups).toHaveLength(0);
  });

  it('updates recommendation content and removes old popup views on replacement and teardown', async () => {
    const { fixture, planning, current } = await setup();
    planning.set(true);
    const trees = recommendHomeTrees(current());
    fixture.componentRef.setInput('recommendedTrees', trees);
    fixture.detectChanges();
    const old = [...mock.popups];
    fixture.componentRef.setInput('recommendedTrees', [
      {
        ...trees[0],
        growth: trees[0].nextHarvestAt,
        remainingGrowth: 0,
        status: '可收成',
        recommendedReason: '大樹可收成',
      },
    ]);
    fixture.detectChanges();
    expect(old.every(({ remove }) => remove.mock.calls.length === 1)).toBe(true);
    const latest = mock.popups.at(-1)!;
    expect(latest.content?.textContent).toContain('可收成');
    expect(latest.content?.textContent).not.toContain('還差');
    fixture.destroy();
    expect(latest.remove).toHaveBeenCalledOnce();
  });

  it('displays each tree reason independently rather than sharing the placeholder text', async () => {
    const { fixture, planning, current } = await setup();
    const trees = recommendHomeTrees(current());
    fixture.componentRef.setInput('recommendedTrees', [
      { ...trees[0], recommendedReason: '大樹即將收成' },
      { ...trees[1], recommendedReason: '樹苗缺水了' },
      { ...trees[2], recommendedReason: null },
    ]);
    planning.set(true);
    fixture.detectChanges();
    expect(mock.popups[0].content?.textContent).toContain('大樹即將收成');
    expect(mock.popups[0].content?.textContent).not.toContain('樹苗缺水了');
    expect(mock.popups[1].content?.textContent).toContain('樹苗缺水了');
    expect(mock.popups[2].content?.querySelector('.tree-recommendation__status')).toBeNull();
  });

  it('fits the player and all three recommended points with popup/panel clearance on entry', async () => {
    const { fixture, camera, current } = await setup();
    const trees = recommendHomeTrees(current());
    camera.request({
      kind: 'recommendations-overview',
      player: current()!,
      trees: trees.map((tree) => tree.position),
      visibleArea: { top: 180, bottom: 700 },
    });
    const [bounds, options] = mock.map.cameraForBounds.mock.calls[0];
    expect(bounds.coordinates).toEqual([
      [current()!.longitude, current()!.latitude],
      ...trees.map((tree) => [tree.position.longitude, tree.position.latitude]),
    ]);
    expect(options).toMatchObject({ maxZoom: 16, bearing: 0, pitch: 0 });
    expect(options.padding.left).toBeGreaterThanOrEqual(70);
    expect(options.padding.top).toBeGreaterThan(180 + 100);
    expect(options.padding.bottom).toBeGreaterThan(844 - 700 + 100);
    expect(mock.map.easeTo).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        center: [121.46, 25.01],
        zoom: 13,
        retainPadding: false,
      }),
    );
    expect(camera.isFollowingPlayer()).toBe(false);
    fixture.destroy();
  });

  it('opens route options on a tap and station details on a long press', async () => {
    const { fixture, planning, walking, taskRoutes, availableTaskPoints, hasDestination } =
      await setup();
    availableTaskPoints.set([waterStation, fertilizerStation]);
    hasDestination.set(true);
    planning.set(true);
    walking.set(false);
    taskRoutes.set([waterStation, fertilizerStation]);
    fixture.detectChanges();

    expect(mock.markers).toHaveLength(2);
    for (const { element, anchor } of mock.markers) {
      expect(anchor).toBe('center');
      expect(element.className).toBe('supply-station-marker');
      expect(element.getAttribute('aria-pressed')).toBe('false');
      expect(element.getAttribute('aria-label')).toContain(
        '補給站 · 約增加 300 步（點擊開啟路線選項，長按查看優惠詳情）',
      );
      expect(element.getAttribute('aria-label')).toContain(
        element === mock.markers[0].element ? waterStation.name : fertilizerStation.name,
      );
      expect(element.querySelector('img')?.getAttribute('src')).toBe(
        '/images/assets/supply-station-icon.svg',
      );
      expect(element.disabled).toBe(false);
    }
    const toggle = vi.fn();
    const details = vi.fn();
    fixture.componentInstance.taskToggle.subscribe(toggle);
    fixture.componentInstance.stationDetails.subscribe(details);
    const marker = mock.markers[1].element;
    marker.click();
    fixture.detectChanges();
    expect(mock.popups).toHaveLength(1);
    expect(mock.popups[0].coordinates).toEqual([
      fertilizerStation.position.longitude,
      fertilizerStation.position.latitude,
    ]);
    expect(mock.popups[0].content?.textContent).toContain(fertilizerStation.name);
    expect(details).not.toHaveBeenCalled();
    mock.popups[0].content
      ?.querySelector<HTMLElement>('.station-card__actions ion-button[color="primary"]')
      ?.click();
    expect(toggle).toHaveBeenCalledExactlyOnceWith(fertilizerStation.id);
    expect(mock.popups[0].remove).toHaveBeenCalledOnce();

    pressMarker(marker);
    fixture.detectChanges();
    expect(details).toHaveBeenCalledExactlyOnceWith(fertilizerStation.id);
    expect(mock.popups).toHaveLength(1);
  });

  it('switches the selected appearance on join and back on removal, replacing old markers', async () => {
    const {
      fixture,
      planning,
      walking,
      taskRoutes,
      selectedTaskPoints,
      availableTaskPoints,
      hasDestination,
    } = await setup();
    availableTaskPoints.set([waterStation]);
    hasDestination.set(true);
    planning.set(true);
    walking.set(false);
    taskRoutes.set([waterStation]);
    fixture.detectChanges();
    const unselected = mock.markers[0];
    expect(unselected.element.querySelector('.supply-station-marker__check')).toBeNull();

    selectedTaskPoints.set([waterStation]);
    fixture.detectChanges();
    const selected = mock.markers[1];
    expect(unselected.remove).toHaveBeenCalledOnce();
    expect(selected.element.getAttribute('aria-pressed')).toBe('true');
    expect(selected.element.title).toContain('已加入');
    const check = selected.element.querySelector('.supply-station-marker__check');
    expect(check).not.toBeNull();
    expect(check?.getAttribute('aria-hidden')).toBe('true');
    expect(selected.element.querySelector('img')?.getAttribute('src')).toBe(
      '/images/assets/supply-station-icon.svg',
    );

    selectedTaskPoints.set([]);
    fixture.detectChanges();
    expect(selected.remove).toHaveBeenCalledOnce();
    expect(mock.markers[2].element.getAttribute('aria-pressed')).toBe('false');
    expect(mock.markers[2].element.querySelector('.supply-station-marker__check')).toBeNull();
  });

  it('keeps preview stations disabled and shows only joined stations during walking', async () => {
    const { fixture, planning, walking, selectedTaskPoints, availableTaskPoints, hasDestination } =
      await setup();
    availableTaskPoints.set([waterStation, fertilizerStation]);
    hasDestination.set(true);
    planning.set(true);
    walking.set(false);
    fixture.detectChanges();
    const previewMarkers = [...mock.markers];
    const toggle = vi.fn();
    fixture.componentInstance.taskToggle.subscribe(toggle);
    for (const { element } of previewMarkers) {
      expect(element.disabled).toBe(true);
      expect(element.title).toContain('補給站載入後可加入');
      element.click();
    }
    expect(toggle).not.toHaveBeenCalled();

    selectedTaskPoints.set([fertilizerStation]);
    planning.set(false);
    walking.set(true);
    fixture.detectChanges();
    expect(mock.markers).toHaveLength(3);
    expect(previewMarkers.every((marker) => marker.remove.mock.calls.length === 1)).toBe(true);
    expect(mock.markers[2].element.getAttribute('aria-pressed')).toBe('true');
    expect(mock.markers[2].element.querySelector('.supply-station-marker__check')).not.toBeNull();
    expect(mock.markers[2].element.disabled).toBe(false);
    const checkIn = vi.fn();
    fixture.componentInstance.stationCheckIn.subscribe(checkIn);
    mock.markers[2].element.click();
    expect(checkIn).toHaveBeenCalledExactlyOnceWith(fertilizerStation.id);
    expect(toggle).not.toHaveBeenCalled();

    fixture.destroy();
    expect(mock.markers[2].remove).toHaveBeenCalledOnce();
  });

  it('shows a claimed station as already collected without removing it from the route', async () => {
    const { fixture, selectedTaskPoints, checkedInTaskIds } = await setup();
    selectedTaskPoints.set([waterStation]);
    fixture.detectChanges();
    checkedInTaskIds.set([waterStation.id]);
    fixture.detectChanges();
    const marker = mock.markers.at(-1)!;
    expect(marker.element.title).toContain('本次散步已領取');
    expect(marker.element.disabled).toBe(false);
  });

  it('retains joined stations while cultivation is open and clears them on route termination', async () => {
    const { fixture, selectedTaskPoints, walking, activeRoute } = await setup();
    selectedTaskPoints.set([waterStation]);
    walking.set(false);
    fixture.detectChanges();
    expect(mock.markers).toHaveLength(1);
    expect(mock.markers[0].element.getAttribute('aria-pressed')).toBe('true');

    activeRoute.set(false);
    fixture.detectChanges();
    expect(mock.markers[0].remove).toHaveBeenCalledOnce();
  });

  it('enables previewed stations immediately when their routes load without another planning step', async () => {
    const { fixture, planning, taskRoutes, availableTaskPoints, hasDestination } = await setup();
    availableTaskPoints.set([waterStation]);
    hasDestination.set(true);
    planning.set(true);
    fixture.detectChanges();
    const preview = mock.markers[0];
    expect(preview.element.disabled).toBe(true);
    taskRoutes.set([waterStation]);
    fixture.detectChanges();
    expect(planning()).toBe(true);
    expect(preview.remove).toHaveBeenCalledOnce();
    expect(mock.markers[1].element.disabled).toBe(false);
    const toggle = vi.fn();
    fixture.componentInstance.taskToggle.subscribe(toggle);
    mock.markers[1].element.click();
    fixture.detectChanges();
    expect(toggle).not.toHaveBeenCalled();
    fixture.componentInstance.confirmStation();
    expect(toggle).toHaveBeenCalledExactlyOnceWith(waterStation.id);
  });

  it('renders station details and configured rewards without changing selection on close', async () => {
    const { fixture, planning, taskRoutes, availableTaskPoints, hasDestination, current } =
      await setup();
    const station = {
      ...waterStation,
      supplyStation: {
        ...waterStation.supplyStation,
        supply: { resource: 'water' as const, amount: 7 },
      },
    };
    availableTaskPoints.set([station]);
    taskRoutes.set([station]);
    planning.set(true);
    hasDestination.set(true);
    fixture.detectChanges();
    const toggle = vi.fn();
    fixture.componentInstance.taskToggle.subscribe(toggle);
    mock.markers.at(-1)!.element.click();
    fixture.detectChanges();
    const popup = mock.popups[0];
    expect(popup.options).toMatchObject({ className: 'supply-station-popup', closeOnClick: true });
    expect(popup.content?.textContent).toContain('買一送一');
    expect(popup.content?.textContent).toContain(station.supplyStation.terms);
    expect(popup.content?.textContent).toContain('2026/10/31');
    expect(popup.content?.textContent).toContain('+7水');
    expect(popup.content?.textContent).toContain('約 +3 分鐘');
    expect(popup.content?.querySelector('img')?.getAttribute('src')).toContain('twqr-logo.svg');
    current.set(null);
    fixture.detectChanges();
    expect(popup.content?.textContent).toContain('距離：尚無有效定位');
    popup.content?.querySelector<HTMLButtonElement>('.station-card__close')?.click();
    expect(toggle).not.toHaveBeenCalled();
    expect(popup.remove).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.popupTask()).toBeNull();
  });

  it('replaces the popup for another station and displays explicit removal for selected stations', async () => {
    const {
      fixture,
      planning,
      taskRoutes,
      availableTaskPoints,
      hasDestination,
      selectedTaskPoints,
    } = await setup();
    availableTaskPoints.set([waterStation, fertilizerStation]);
    taskRoutes.set([waterStation, fertilizerStation]);
    selectedTaskPoints.set([fertilizerStation]);
    planning.set(true);
    hasDestination.set(true);
    fixture.detectChanges();
    mock.markers.at(-2)!.element.click();
    fixture.detectChanges();
    mock.markers.at(-1)!.element.click();
    fixture.detectChanges();
    expect(mock.popups[0].remove).toHaveBeenCalledOnce();
    expect(mock.popups[1].content?.textContent).toContain('移出路線');
    const toggle = vi.fn();
    fixture.componentInstance.taskToggle.subscribe(toggle);
    fixture.componentInstance.confirmStation();
    expect(toggle).toHaveBeenCalledExactlyOnceWith(fertilizerStation.id);
  });

  it.each(['routes', 'planning', 'destroy', 'map-click'] as const)(
    'clears the popup without toggling after %s',
    async (change) => {
      const { fixture, planning, taskRoutes, availableTaskPoints, hasDestination } = await setup();
      availableTaskPoints.set([waterStation]);
      taskRoutes.set([waterStation]);
      planning.set(true);
      hasDestination.set(true);
      fixture.detectChanges();
      mock.markers.at(-1)!.element.click();
      fixture.detectChanges();
      const toggle = vi.fn();
      fixture.componentInstance.taskToggle.subscribe(toggle);
      if (change === 'routes') taskRoutes.set([{ ...waterStation }]);
      if (change === 'planning') planning.set(false);
      if (change === 'destroy') fixture.destroy();
      if (change === 'map-click') mock.popups[0].close?.();
      if (change !== 'destroy') fixture.detectChanges();
      expect(fixture.componentInstance.popupTask()).toBeNull();
      fixture.componentInstance.confirmStation();
      expect(toggle).not.toHaveBeenCalled();
      if (change !== 'map-click') expect(mock.popups[0].remove).toHaveBeenCalledOnce();
      else mock.popups[0].content?.remove();
    },
  );

  it('rejects a stale confirmation even before the popup invalidation effect runs', async () => {
    const { fixture, planning, taskRoutes, availableTaskPoints, hasDestination } = await setup();
    availableTaskPoints.set([waterStation]);
    taskRoutes.set([waterStation]);
    planning.set(true);
    hasDestination.set(true);
    fixture.detectChanges();
    mock.markers.at(-1)!.element.click();
    fixture.detectChanges();
    const toggle = vi.fn();
    fixture.componentInstance.taskToggle.subscribe(toggle);
    taskRoutes.set([{ ...waterStation }]);
    fixture.componentInstance.confirmStation();
    expect(toggle).not.toHaveBeenCalled();
    expect(TestBed.inject(WalkSessionStore).setPlanningError).toHaveBeenCalledWith(
      '路線或補給站已變更，請重新選擇補給站。',
    );
    expect(fixture.componentInstance.popupTask()).toBeNull();
  });

  it.each([
    { bounds: { left: 50, right: 310, top: 200, bottom: 490 }, offset: null },
    { bounds: { left: -50, right: 210, top: 200, bottom: 490 }, offset: [-62, 0] },
    { bounds: { left: 250, right: 510, top: 200, bottom: 490 }, offset: [132, 0] },
    { bounds: { left: 50, right: 310, top: 40, bottom: 340 }, offset: [0, -132] },
    { bounds: { left: 50, right: 310, top: 590, bottom: 890 }, offset: [0, 252] },
  ])('keeps the complete popup inside the planning gap: $offset', async ({ bounds, offset }) => {
    const { fixture, planning, taskRoutes, availableTaskPoints, hasDestination } = await setup();
    fixture.componentRef.setInput('visibleMapArea', () => ({ top: 160, bottom: 650 }));
    availableTaskPoints.set([waterStation]);
    taskRoutes.set([waterStation]);
    planning.set(true);
    hasDestination.set(true);
    fixture.detectChanges();
    mock.markers.at(-1)!.element.click();
    fixture.detectChanges();
    mock.popupBounds = bounds;
    flushFrames();
    expect(mock.popups[0].options).toMatchObject({
      anchor: 'bottom',
      maxWidth: 'min(260px, calc(100vw - 24px))',
    });
    expect(mock.popups[0].content?.style.width).toBe('260px');
    expect(mock.popups[0].content?.style.maxHeight).toBe('300px');
    if (offset) expect(mock.map.panBy).toHaveBeenCalledExactlyOnceWith(offset, { duration: 250 });
    else expect(mock.map.panBy).not.toHaveBeenCalled();
    expect(mock.map.easeTo).not.toHaveBeenCalled();
  });

  it('limits popup height to a short planning gap and retains the actions outside scrolling details', async () => {
    const { fixture, planning, taskRoutes, availableTaskPoints, hasDestination } = await setup();
    fixture.componentRef.setInput('visibleMapArea', () => ({ top: 200, bottom: 400 }));
    availableTaskPoints.set([waterStation]);
    taskRoutes.set([waterStation]);
    planning.set(true);
    hasDestination.set(true);
    fixture.detectChanges();
    mock.markers.at(-1)!.element.click();
    fixture.detectChanges();
    flushFrames();
    const content = mock.popups[0].content!;
    expect(content.style.maxHeight).toBe('140px');
    expect(content.querySelector('.station-card__body .station-card__actions')).toBeNull();
    expect(content.querySelector('.station-card__actions ion-button[color="primary"]')).not.toBeNull();
  });

  it.each(['cancel', 'escape'] as const)(
    'omits the merchant badge for non-partners and keeps selection unchanged on %s',
    async (action) => {
      const { fixture, planning, taskRoutes, availableTaskPoints, hasDestination } = await setup();
      const station = {
        ...waterStation,
        supplyStation: {
          ...waterStation.supplyStation,
          isCathayTwqrMerchant: false,
        },
      };
      availableTaskPoints.set([station]);
      taskRoutes.set([station]);
      planning.set(true);
      hasDestination.set(true);
      fixture.detectChanges();
      mock.markers.at(-1)!.element.click();
      fixture.detectChanges();
      const content = mock.popups[0].content!;
      expect(content.querySelector('img')).toBeNull();
      const toggle = vi.fn();
      fixture.componentInstance.taskToggle.subscribe(toggle);
      if (action === 'cancel')
        content.querySelector<HTMLElement>('.station-card__actions ion-button[color="medium"]')!.click();
      else content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(fixture.componentInstance.popupTask()).toBeNull();
      expect(toggle).not.toHaveBeenCalled();
    },
  );

  it('emits the clicked tree identity for cultivation without opening the modal directly', async () => {
    const { fixture } = await setup();
    const cultivate = vi.fn();
    fixture.componentInstance.cultivationSelect.subscribe(cultivate);
    fixture.componentInstance.clickIcon('tree-9');
    expect(cultivate).toHaveBeenCalledExactlyOnceWith('tree-9');
  });

  it('still uses tree clicks for destination selection while planning', async () => {
    const { fixture, planning } = await setup();
    const select = vi.fn();
    const cultivate = vi.fn();
    fixture.componentInstance.destinationSelect.subscribe(select);
    fixture.componentInstance.cultivationSelect.subscribe(cultivate);
    planning.set(true);
    fixture.componentInstance.clickIcon('tree-5');
    expect(select).toHaveBeenCalledExactlyOnceWith('tree-5');
    expect(cultivate).not.toHaveBeenCalled();
  });

  it('follows location updates without resetting zoom or interrupting initial recentering', async () => {
    const { fixture, camera, current } = await setup();
    camera.request({
      kind: 'follow-player',
      position: { longitude: 121.454754, latitude: 25.001002 },
    });
    fixture.detectChanges();
    expect(mock.map.easeTo).toHaveBeenCalledWith({
      center: [121.454754, 25.001002],
      zoom: 17,
      bearing: 0,
      pitch: 50,
      duration: 500,
    });
    expect(mock.map.jumpTo).not.toHaveBeenCalled();

    current.set({
      longitude: 121.456,
      latitude: 25.002,
      accuracy: 5,
      observedAt: new Date(),
    });
    fixture.detectChanges();

    expect(mock.source.setData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        geometry: { type: 'Point', coordinates: [121.456, 25.002] },
      }),
    );
    expect(mock.map.jumpTo).toHaveBeenCalledExactlyOnceWith({ center: [121.456, 25.002] });
    expect(mock.map.easeTo).toHaveBeenCalledTimes(1);
    expect(camera.isFollowingPlayer()).toBe(true);
  });

  it.each(['dragstart', 'rotatestart', 'pitchstart'])(
    'ignores programmatic %s but stops following after manual interaction',
    async (interaction) => {
      const { fixture, camera, current } = await setup();
      const position = { longitude: 121.454754, latitude: 25.001002 };
      camera.request({ kind: 'follow-player', position });
      mock.handlers.get(interaction)!({});
      expect(camera.isFollowingPlayer()).toBe(true);

      mock.handlers.get(interaction)!({ originalEvent: new Event('pointerdown') });
      expect(camera.isFollowingPlayer()).toBe(false);
      current.set({ ...position, longitude: 121.457, accuracy: 5, observedAt: new Date() });
      fixture.detectChanges();
      expect(mock.map.jumpTo).not.toHaveBeenCalled();
      expect(mock.source.setData).toHaveBeenCalled();

      camera.request({ kind: 'follow-player', position });
      current.set({ ...position, longitude: 121.458, accuracy: 5, observedAt: new Date() });
      fixture.detectChanges();
      expect(mock.map.jumpTo).toHaveBeenCalledWith({ center: [121.458, 25.001002] });
    },
  );

  it.each(['wheel', 'touchmove', 'dblclick', 'click'])(
    'keeps following through %s zoom input without resetting zoom on position updates',
    async (eventType) => {
      const { fixture, camera, current } = await setup();
      camera.request({ kind: 'follow-player', position: current()! });
      const event = { originalEvent: new Event(eventType) };
      mock.handlers.get('movestart')?.(event);
      mock.handlers.get('zoomstart')?.(event);
      mock.handlers.get('zoom')?.(event);
      mock.handlers.get('move')?.(event);
      mock.handlers.get('zoomend')?.(event);
      expect(camera.isFollowingPlayer()).toBe(true);
      current.set({ ...current()!, longitude: 121.457, heading: 90 });
      fixture.detectChanges();
      expect(mock.map.jumpTo).toHaveBeenCalledExactlyOnceWith({
        center: [121.457, 25.001002],
        bearing: 90,
      });
      expect(mock.map.easeTo).toHaveBeenCalledTimes(1);
      expect(camera.isFollowingPlayer()).toBe(true);
    },
  );

  it('uses heading-up navigation at pitch 50 and keeps the directional marker aligned', async () => {
    const { fixture, camera, current } = await setup();
    current.set({ ...current()!, heading: 90 });
    fixture.detectChanges();
    camera.request({ kind: 'follow-player', position: current()! });
    expect(mock.map.easeTo).toHaveBeenLastCalledWith({
      center: [121.454754, 25.001002],
      zoom: 17,
      bearing: 90,
      pitch: 50,
      duration: 500,
    });
    expect(mock.heading.element?.hidden).toBe(false);
    expect(mock.heading.setRotation).toHaveBeenLastCalledWith(90);
    mock.map.jumpTo.mockClear();

    current.set({ ...current()!, longitude: 121.456, heading: 135 });
    fixture.detectChanges();
    expect(mock.map.jumpTo).toHaveBeenCalledExactlyOnceWith({
      center: [121.456, 25.001002],
      bearing: 135,
    });
    expect(mock.heading.setLngLat).toHaveBeenLastCalledWith([121.456, 25.001002]);
    expect(mock.heading.setRotation).toHaveBeenLastCalledWith(135);

    mock.handlers.get('dragstart')!({ originalEvent: new Event('pointerdown') });
    mock.map.jumpTo.mockClear();
    current.set({ ...current()!, heading: 180 });
    fixture.detectChanges();
    expect(mock.map.jumpTo).not.toHaveBeenCalled();
    expect(mock.heading.setRotation).toHaveBeenLastCalledWith(180);
    camera.request({ kind: 'follow-player', position: current()! });
    expect(mock.map.easeTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bearing: 180,
        pitch: 50,
      }),
    );
  });

  it('finishes map initialization before replaying a pending navigation animation', async () => {
    const { fixture, camera } = await setup(true);
    expect(camera.isFollowingPlayer()).toBe(true);
    expect(mock.map.easeTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pitch: 50,
        zoom: 17,
      }),
    );
    fixture.detectChanges();
    expect(mock.map.jumpTo).not.toHaveBeenCalled();
  });

  it('hides unknown heading and preserves camera bearing when heading is unavailable', async () => {
    const { fixture, camera, current } = await setup();
    expect(mock.heading.element?.hidden).toBe(true);
    camera.request({ kind: 'follow-player', position: current()! });
    current.set({ ...current()!, heading: NaN });
    fixture.detectChanges();
    expect(mock.heading.element?.hidden).toBe(true);
    expect(mock.map.jumpTo).toHaveBeenLastCalledWith({ center: [121.454754, 25.001002] });
    expect(mock.heading.setRotation).not.toHaveBeenCalled();
  });

  it('removes the heading marker when the map is destroyed', async () => {
    const { fixture } = await setup();
    fixture.destroy();
    expect(mock.heading.remove).toHaveBeenCalledOnce();
  });

  it('keeps navigation unclipped while following and updating the player position', async () => {
    const { fixture, camera, current } = await setup();
    camera.request({ kind: 'follow-player', position: current()! });
    current.set({ ...current()!, longitude: 121.456, heading: 90 });
    fixture.detectChanges();
    mock.handlers.get('move')!({});
    expect(mock.map.addLayer.mock.calls.some(([layer]) => layer.type === 'clip')).toBe(false);
    expect(mock.map.addSource.mock.calls.some(([id]) => id === 'navigation-building-clip')).toBe(
      false,
    );
    expect(mock.map.jumpTo).toHaveBeenCalledWith({
      center: [121.456, 25.001002],
      bearing: 90,
    });
    expect(camera.isFollowingPlayer()).toBe(true);
  });

  it('finishes loading after the HD road source returns 403 during startup', async () => {
    const { fixture } = await setup(false, () => {
      mock.handlers.get('error')!({
        error: Object.assign(new Error('Forbidden'), {
          url: 'https://api.mapbox.com/v4/mapbox.hd-road-v1-bounded.json?secure',
        }),
      });
    });

    expect(fixture.componentInstance.mapError()).toBeNull();
    expect(fixture.nativeElement.querySelector('.map')).not.toBeNull();
    expect(mock.heading.setLngLat).toHaveBeenCalled();
  });

  it('keeps the map visible and following when an optional basemap source is forbidden', async () => {
    const { fixture, camera, current } = await setup();
    camera.request({ kind: 'follow-player', position: current()! });

    mock.handlers.get('error')!({
      sourceId: 'mapbox-hd-roads',
      error: new Error('403 Forbidden: mapbox.hd-road-v1-bounded.json'),
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.mapError()).toBeNull();
    expect(fixture.nativeElement.querySelector('.map')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.map-fallback')).toBeNull();
    expect(camera.isFollowingPlayer()).toBe(true);
  });
  it('does not move the camera without a location and clears following on map errors', async () => {
    const { fixture, camera, current } = await setup();
    camera.request({
      kind: 'follow-player',
      position: { longitude: 121.454754, latitude: 25.001002 },
    });
    current.set(null);
    fixture.detectChanges();
    expect(mock.map.jumpTo).not.toHaveBeenCalled();
    expect(camera.isPlayerCentered()).toBe(false);

    mock.handlers.get('error')!({});
    expect(camera.isFollowingPlayer()).toBe(false);
  });
});
