import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HomeComponent } from './home.component';
import { TreeNavigationService } from '../../shared/services/tree-navigation.service';
import { HomePlanComponent } from './home-plan/home-plan.component';
import { LocationPoint, LocationStore } from '../../shared/stores/location-store';
import { WalkSessionStore } from '../../shared/stores/walk-session-store';
import { ProgressStore } from '../../shared/stores/progress-store';
import { ModalService } from '../../shared/services/modal.service';
import {
  MapCameraAdapter,
  MapCameraController,
  MapCameraIntent,
} from './home-map/map-camera.controller';
import {
  MapboxDirectionsService,
  WalkingDirections,
} from '../../shared/services/mapbox-directions.service';
import { GeoPoint } from '../../shared/models/geo.models';
import { findHomeTree, homeTrees } from './home-tree-recommendations';
import { CMS_CONNECTION, cmsPublication, cmsRouteRoles, cmsRetainedTrees } from '../../shared/models/cms-publication';
import type { CmsConfig, Selection } from '../../../../functions/src/cms-domain';
import {
  demoPlantingSpots,
  demoSupplyStations,
  TREE_CULTIVATION_RADIUS_METERS,
} from '../../environments/environment-dev';
import { haversineDistanceMeters } from '../../shared/models/geo-distance';
import { DialogService } from '../../shared/services/dialog.service';
import { HomeIdleComponent } from './home-idle/home-idle.component';
import { HomeMapComponent } from './home-map/home-map.component';
import { HomeCultivateComponent } from './home-cultivate/home-cultivate.component';
import { HomeSupplyStationComponent } from './home-supply-station/home-supply-station.component';
import { supplyRewardLabel } from '../../shared/models/walk-task.models';
import { ToastController } from '@ionic/angular';
import { TREE_DRY_AFTER_MS } from '../../shared/models/tree-cultivation';
import { walkingTaskWaypoints } from '../../shared/models/walk-route';

describe('Home task-selection camera', () => {
  function confirmStation(fixture: ComponentFixture<HomeComponent>, taskId: string): void {
    if (!TestBed.inject(WalkSessionStore).destinationConfirmed()) {
      fixture.componentInstance.confirmDestination();
    }
    fixture.componentInstance.toggleTaskPoint(taskId);
  }

  function confirmDeparture(fixture: ComponentFixture<HomeComponent>): void {
    if (!TestBed.inject(WalkSessionStore).destinationConfirmed()) {
      fixture.componentInstance.confirmDestination();
    }
    fixture.componentInstance.confirmRoute();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    cmsPublication.set({config: null, version: 0, managed: false});
    cmsRouteRoles.set(null);
    cmsRetainedTrees.set([]);
  });

  function setup(withPanels = false, fullHome = false, cms: object | null = null) {
    const current = signal<LocationPoint | null>({
      longitude: 121.454754,
      latitude: 25.001002,
      accuracy: 5,
      observedAt: new Date(),
    });
    const directions = {
      walking: vi.fn(
        async (points: readonly GeoPoint[], _signal: AbortSignal): Promise<WalkingDirections> =>
          responseFor(points),
      ),
    };
    const presentToast = vi.fn(async () => {});
    const dismissToast = vi.fn(async () => true);
    const toast = { create: vi.fn(async () => ({ present: presentToast, dismiss: dismissToast })) };
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        {provide: CMS_CONNECTION, useValue: cms},
        {
          provide: LocationStore,
          useValue: { current },
        },
        { provide: MapboxDirectionsService, useValue: directions },
        { provide: ToastController, useValue: toast },
      ],
    });
    if (fullHome) {
      vi.spyOn(HomeMapComponent.prototype, 'ngAfterViewInit').mockImplementation(() => {});
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          disconnect() {}
        },
      );
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
    } else {
      TestBed.overrideComponent(HomeComponent, {
        set: {
          template: withPanels ? '<home-plan />' : '',
          imports: withPanels ? [HomePlanComponent] : [],
        },
      });
    }
    if (withPanels) {
      TestBed.overrideComponent(HomePlanComponent, {
        set: {
          template: '<div #topPanel class="top"></div><div #bottomPanel class="bottom"></div>',
          imports: [],
        },
      });
    }
    const fixture = TestBed.createComponent(HomeComponent);
    const store = TestBed.inject(WalkSessionStore);
    const intents: MapCameraIntent[] = [];
    const camera = fixture.debugElement.injector.get(MapCameraController);
    const adapter: MapCameraAdapter = {
      applyCameraIntent: (intent) => intents.push(intent),
    };
    camera.attach(adapter);
    fixture.detectChanges();
    return {
      fixture,
      store,
      intents,
      directions,
      current,
      camera,
      adapter,
      toast,
      presentToast,
      dismissToast,
    };
  }

  function managedSetup() {
    const config: CmsConfig = {harvestPoints: 50, species: ['榕樹'], scenes: [], rewards: [],
      trees: homeTrees.map(t => ({id: t.id, name: t.nickName, species: t.empty ? '' : t.species, place: t.poiName,
        latitude: t.position.latitude, longitude: t.position.longitude, empty: !!t.empty, growth: t.growth,
        weather: t.weather, timeOfDay: t.timeOfDay ?? 'day'})),
      merchants: Array.from({length: 8}, (_, i) => ({id: `supply-${i}`, name: `補給${i}`, address: '展示區',
        latitude: 25.005 + i * 0.0001, longitude: 121.458, roles: ['supply'], category: '美食', twqr: false,
        enabled: true, offer: '模擬優惠', terms: 'Demo', validUntil: '2099-12-31', resource: 'water', amount: 10,
        weather: 'sunny', timeOfDay: 'day'})),
    };
    const selections: Selection[] = config.merchants.map(m => ({merchantId: m.id, role: 'supply', reason: '依距離與天氣推薦'}));
    const result = {source: 'gemini', selections, version: 1, reason: ''};
    const ai = signal(result);
    const cms = {managed: signal(true), config: signal(config), ai, track: vi.fn(),
      clearRecommendations: vi.fn(() => cmsRouteRoles.set(null)), recommend: vi.fn(async () => result)};
    const ctx = setup(false, false, cms);
    cmsPublication.set({config, version: 1, managed: true});
    TestBed.inject(ProgressStore).ensureCmsTrees(homeTrees, true);
    ctx.fixture.detectChanges();
    return {...ctx, cms};
  }

  it('requires starting planning and confirming a candidate before requesting AI, including after returning Home', async () => {
    const {fixture, store, cms} = managedSetup();
    await fixture.componentInstance.selectDestination('tree-5');
    expect(store.isIdle()).toBe(true);
    expect(store.destination()).toBeNull();
    expect(cms.recommend).not.toHaveBeenCalled();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.startPlanning();
    expect(store.isPlanning()).toBe(true);
    expect(store.destination()).toBeNull();
    expect(store.destinationConfirmed()).toBe(false);
    expect(store.taskRoutes()).toHaveLength(0);
    expect(cms.recommend).not.toHaveBeenCalled();
    await fixture.componentInstance.selectDestination('tree-1');
    fixture.componentInstance.back();
    expect(store.isIdle()).toBe(true);
    expect(store.destination()).toBeNull();
    await fixture.componentInstance.selectDestination('tree-1');
    expect(store.isIdle()).toBe(true);
    expect(cms.recommend).not.toHaveBeenCalled();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    await fixture.whenStable();
    expect(cms.recommend).toHaveBeenCalledOnce();
  });

  it('requests Gemini only after confirming the destination and preserves more than six extra supply stops', async () => {
    const {fixture, store, cms, directions} = managedSetup();
    fixture.componentInstance.startPlanning();
    expect(cms.recommend).not.toHaveBeenCalled();
    await fixture.componentInstance.selectDestination('tree-5');
    expect(cms.recommend).not.toHaveBeenCalled();
    expect(store.availableTaskPoints()).toHaveLength(0);
    expect(directions.walking).toHaveBeenCalledTimes(1);
    fixture.componentInstance.confirmDestination();
    await fixture.whenStable();
    expect(cms.recommend).toHaveBeenCalledTimes(1);
    expect(cms.recommend.mock.calls[0]).toEqual([store.baseRoute()[0], store.destination()!.position,
      store.baseRoute(), 1234, 1234 / 1.25]);
    expect(store.availableTaskPoints()).toHaveLength(8);
    expect(store.taskRoutes()).toHaveLength(8);
    expect(store.routeLoading()).toBe(false);
    for (const task of store.availableTaskPoints()) fixture.componentInstance.toggleTaskPoint(task.id);
    expect(store.taskPoints()).toHaveLength(8);
  });

  it('warns above sixty walking minutes and only calls Gemini after explicit acceptance', async () => {
    const {fixture, store, cms, directions} = managedSetup();
    directions.walking.mockImplementation(async points => ({...responseFor(points), durationSeconds: 3 * 3600 + 120}));
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-1');
    fixture.componentInstance.confirmDestination();
    const dialog = TestBed.inject(DialogService);
    expect(dialog.content()).toContain('3 小時 2 分鐘');
    expect(store.destinationConfirmed()).toBe(false);
    expect(cms.recommend).not.toHaveBeenCalled();
    dialog.closeDialog('cancel');
    expect(store.destination()?.id).toBe('tree-1');
    expect(cms.recommend).not.toHaveBeenCalled();
    fixture.componentInstance.confirmDestination();
    dialog.closeDialog('confirm');
    await fixture.whenStable();
    expect(store.destinationConfirmed()).toBe(true);
    expect(cms.recommend).toHaveBeenCalledTimes(1);
  });

  it('does not warn at exactly sixty minutes and discards cancelled recommendations', async () => {
    const {fixture, store, cms, directions} = managedSetup();
    directions.walking.mockImplementation(async points => ({...responseFor(points), durationSeconds: 3600}));
    let resolve!: (value: Awaited<ReturnType<typeof cms.recommend>>) => void;
    cms.recommend.mockImplementation(() => new Promise(done => {resolve = done;}));
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    expect(TestBed.inject(DialogService).isDialogOpen()).toBe(false);
    expect(cms.recommend).toHaveBeenCalledTimes(1);
    fixture.componentInstance.back();
    resolve({source: 'gemini', selections: [{merchantId: 'supply-0', role: 'supply', reason: 'old'}], version: 1, reason: ''});
    await fixture.whenStable();
    expect(store.isIdle()).toBe(true);
    expect(cmsRouteRoles()).toBe(null);
    expect(store.taskRoutes()).toHaveLength(0);
  });

  it('retries empty recommendations without clearing the destination and preserves chosen shops on later retry attempts', async () => {
    const {fixture, store, cms} = managedSetup();
    cms.recommend.mockResolvedValueOnce({source: 'gemini', selections: [], version: 1, reason: ''});
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    await fixture.whenStable();
    expect(store.availableTaskPoints()).toHaveLength(0);
    fixture.componentInstance.retrySupplies();
    await fixture.whenStable();
    await vi.waitFor(() => expect(store.routeLoading()).toBe(false));
    expect(cms.recommend).toHaveBeenCalledTimes(2);
    expect(store.destination()?.id).toBe('tree-5');
    expect(store.destinationConfirmed()).toBe(true);
    expect(store.availableTaskPoints()).toHaveLength(8);
    fixture.componentInstance.toggleTaskPoint(store.availableTaskPoints()[0].id);
    fixture.componentInstance.retrySupplies();
    expect(cms.recommend).toHaveBeenCalledTimes(2);
    expect(store.taskPoints()).toHaveLength(1);
  });

  it('loads a collection navigation destination once when Home enters', async () => {
    const { fixture, store, directions } = setup();
    TestBed.inject(TreeNavigationService).request('tree-5');
    await fixture.componentInstance.ionViewDidEnter();
    expect(store.isPlanning()).toBe(true);
    expect(store.destination()?.id).toBe('tree-5');
    expect(store.destinationConfirmed()).toBe(false);
    expect(directions.walking).toHaveBeenCalled();
    const requests = directions.walking.mock.calls.length;
    await fixture.componentInstance.ionViewDidEnter();
    expect(directions.walking).toHaveBeenCalledTimes(requests);
  });

  it('starts following the latest player position only after departure is confirmed', async () => {
    const { fixture, store, current, intents, camera } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.detectChanges();
    confirmDeparture(fixture);
    expect(camera.isFollowingPlayer()).toBe(false);
    current.set({ ...current()!, longitude: 121.455 });
    TestBed.inject(ModalService).close('confirm');
    fixture.detectChanges();

    expect(store.isWalking()).toBe(true);
    expect(camera.isFollowingPlayer()).toBe(true);
    expect(intents.at(-1)).toEqual({ kind: 'follow-player', position: current() });
    expect(intents.filter((intent) => intent.kind === 'follow-player')).toHaveLength(1);
  });

  it('frames the same three live recommendations shown by the map when planning starts', () => {
    const { fixture, intents, current } = setup();
    fixture.componentInstance.startPlanning();
    fixture.detectChanges();
    expect(intents.at(-1)).toEqual({
      kind: 'recommendations-overview',
      player: current(),
      trees: fixture.componentInstance.planningRecommendations().map((tree) => tree.position),
      visibleArea: undefined,
    });
    expect(fixture.componentInstance.planningRecommendations()).toHaveLength(3);
    const count = intents.length;
    current.set({ ...current()!, longitude: current()!.longitude + 0.0001 });
    fixture.detectChanges();
    expect(intents).toHaveLength(count);
    fixture.componentInstance.back();
    fixture.detectChanges();
    fixture.componentInstance.startPlanning();
    fixture.detectChanges();
    expect(intents.at(-1)?.kind).toBe('recommendations-overview');
    expect(intents.filter((intent) => intent.kind === 'recommendations-overview')).toHaveLength(2);
  });

  it('waits for a location before framing recommendations instead of inventing tree positions', () => {
    const { fixture, intents, current } = setup();
    const origin = current();
    current.set(null);
    fixture.componentInstance.startPlanning();
    fixture.detectChanges();
    expect(fixture.componentInstance.planningRecommendations()).toEqual([]);
    expect(intents.some((intent) => intent.kind === 'recommendations-overview')).toBe(false);
    current.set(origin);
    fixture.detectChanges();
    expect(intents.at(-1)?.kind).toBe('recommendations-overview');
  });

  it('refreshes recommendation reasons over time without reframing and stops the clock after selection or cancellation', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const now = Date.UTC(2026, 9, 16, 7);
    vi.setSystemTime(now);
    const { fixture, intents } = setup();
    const progress = TestBed.inject(ProgressStore);
    const trees = Object.fromEntries(
      Object.entries(progress.demoTrees()).map(([id, state]) => [
        id,
        {
          ...state,
          growth: 0,
          weedIds: [],
          plantedAt: now - TREE_DRY_AFTER_MS,
          lastWateredAt: null,
        },
      ]),
    );
    vi.spyOn(progress, 'demoTrees').mockReturnValue(trees);
    fixture.componentInstance.startPlanning();
    fixture.detectChanges();
    expect(
      fixture.componentInstance
        .planningRecommendations()
        .every((tree) => tree.recommendedReason === null),
    ).toBe(true);
    const cameraRequests = intents.length;
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(
      fixture.componentInstance
        .planningRecommendations()
        .every((tree) => tree.recommendedReason === '種子缺水了'),
    ).toBe(true);
    expect(intents).toHaveLength(cameraRequests);

    await fixture.componentInstance.selectDestination('tree-5');
    fixture.detectChanges();
    const selectedTime = fixture.componentInstance.recommendationNow();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(fixture.componentInstance.recommendationNow()).toBe(selectedTime);
    fixture.componentInstance.back();
    fixture.detectChanges();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(fixture.componentInstance.recommendationNow()).toBe(selectedTime);
  });

  it('toggles recommendation visibility only before destination selection and resets for a new plan', async () => {
    const { fixture, store, intents } = setup();
    fixture.componentInstance.startPlanning();
    fixture.detectChanges();
    expect(fixture.componentInstance.showTreeRecommendations()).toBe(true);
    const count = intents.length;
    fixture.componentInstance.toggleTreeRecommendations();
    fixture.detectChanges();
    expect(fixture.componentInstance.showTreeRecommendations()).toBe(false);
    fixture.componentInstance.toggleTreeRecommendations();
    fixture.detectChanges();
    expect(fixture.componentInstance.showTreeRecommendations()).toBe(true);
    expect(intents).toHaveLength(count);
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.toggleTreeRecommendations();
    expect(fixture.componentInstance.showTreeRecommendations()).toBe(true);
    expect(store.hasDestination()).toBe(true);
    fixture.componentInstance.back();
    fixture.componentInstance.startPlanning();
    expect(fixture.componentInstance.showTreeRecommendations()).toBe(true);
  });

  it.each([false, true])(
    'preserves the idle camera after closing cultivation (following: %s)',
    (following) => {
      const { fixture, store, current, intents, camera } = setup();
      expect(intents.at(-1)?.kind).toBe('player');
      if (following) fixture.componentInstance.reCenter();
      const requestCount = intents.length;

      for (const treeId of ['tree-5', 'tree-9']) {
        fixture.componentInstance.openCultivation(treeId);
        fixture.detectChanges();
        expect(store.isCultivating()).toBe(true);
        store.finishCultivating();
        fixture.detectChanges();
        expect(store.isIdle()).toBe(true);
        expect(intents).toHaveLength(requestCount);
        expect(camera.isFollowingPlayer()).toBe(following);
      }

      current.set({ ...current()!, longitude: 121.456 });
      fixture.componentInstance.reCenter();
      fixture.detectChanges();
      expect(intents.at(-1)).toEqual({ kind: 'follow-player', position: current() });
      expect(camera.isFollowingPlayer()).toBe(true);
    },
  );

  it('preserves manual map exploration through cultivation and arrival until recenter is pressed', async () => {
    const { fixture, store, current, intents, camera, adapter } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    fixture.detectChanges();
    const requestCount = intents.length;
    const route = store.route();

    camera.stopFollowing(adapter);
    current.set({ ...current()!, longitude: 121.456 });
    fixture.componentInstance.openCultivation('tree-9');
    fixture.detectChanges();
    store.finishCultivating();
    fixture.detectChanges();
    store.arrive();
    fixture.detectChanges();

    expect(camera.isFollowingPlayer()).toBe(false);
    expect(intents).toHaveLength(requestCount);
    expect(store.route()).toBe(route);
    fixture.componentInstance.reCenter();
    fixture.detectChanges();
    expect(camera.isFollowingPlayer()).toBe(true);
    expect(intents.at(-1)).toEqual({ kind: 'follow-player', position: current() });
  });

  it('does not enable following when departure is cancelled or blocked by an outdated route', async () => {
    const { fixture, store, intents, camera } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.detectChanges();
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('cancel');
    expect(camera.isFollowingPlayer()).toBe(false);
    confirmStation(fixture, store.taskRoutes()[0].id);
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    fixture.detectChanges();

    expect(store.isPlanning()).toBe(true);
    expect(store.planningError()).toBe('沿途站點已變更，請先更新預覽路線。');
    expect(camera.isFollowingPlayer()).toBe(false);
    expect(intents.some((intent) => intent.kind === 'follow-player')).toBe(false);
  });

  it('applies popup confirmation without opening the shared bottom sheet', async () => {
    const { fixture, store } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    const modal = TestBed.inject(ModalService);
    const open = vi.spyOn(modal, 'open');
    fixture.componentInstance.toggleTaskPoint(store.taskRoutes()[0].id);
    expect(open).not.toHaveBeenCalled();
    expect(store.taskPoints()).toEqual([store.taskRoutes()[0]]);
    expect(store.routeNeedsUpdate()).toBe(true);
  });

  it('adds and removes confirmed stations without changing the route before preview update', async () => {
    const { fixture, store } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    const originalRoute = store.route();
    const task = store.taskRoutes()[0];
    fixture.componentInstance.toggleTaskPoint(task.id);
    expect(store.taskPoints()).toEqual([task]);
    expect(store.route()).toBe(originalRoute);
    expect(store.routeNeedsUpdate()).toBe(true);
    fixture.componentInstance.toggleTaskPoint(task.id);
    expect(store.taskPoints()).toEqual([]);
  });

  it('opens station details from the long-press event and joins or removes from the modal', async () => {
    const { fixture, store, current } = setup(false, true);
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    const task = store.taskRoutes()[0];
    const map = fixture.debugElement.query(By.directive(HomeMapComponent)).componentInstance;
    const modal = TestBed.inject(ModalService);
    const distance = (haversineDistanceMeters(current()!, task.position) / 1000).toFixed(1);

    map.stationDetails.emit(task.id);
    expect(modal.autoHeight()).toBe(true);
    expect(modal.modalContent()).toMatchObject({
      title: task.name,
      appearance: 'supply-station',
      stationBadges: {
        category: task.supplyStation.category,
        isCathayTwqrMerchant: task.supplyStation.isCathayTwqrMerchant,
      },
      titleBadge: supplyRewardLabel(task.supplyStation.supply),
      subTitle: task.supplyStation.offer,
      description: `${task.description}\n${task.supplyStation.terms}`,
      otherBadges: [
        `有效期限 ${task.supplyStation.validUntil}`,
        `距離 ${distance} km`,
        `繞路約 +${task.estimatedExtraSteps} 步`,
      ],
      subBtnText: '下次再來',
      mainBtnText: '加入路線',
    });
    modal.close('confirm');
    expect(store.taskPoints()).toEqual([task]);

    map.stationDetails.emit(task.id);
    expect(modal.modalContent()).toMatchObject({ mainBtnText: '移出路線' });
    modal.close('confirm');
    expect(store.taskPoints()).toEqual([]);
  });

  it('reports invalid station confirmation explicitly', async () => {
    const { fixture, store } = setup();
    const modal = TestBed.inject(ModalService);
    fixture.componentInstance.toggleTaskPoint('missing');
    expect(modal.isOpen()).toBe(false);
    expect(store.planningError()).toContain('等待補給站載入');
    expect(store.taskPoints()).toEqual([]);
  });

  it.each([499, 499.999999, 500, 500.000001, 501])(
    'always opens the tree but only permits cultivation within the configured radius (%s metres)',
    (distance) => {
      const { fixture, store, current } = setup(false, true);
      const tree = findHomeTree('tree-9')!;
      const position = {
        ...tree.position,
        latitude: tree.position.latitude - (distance / 6_371_000) * (180 / Math.PI),
        accuracy: 5,
        observedAt: new Date(),
      };
      current.set(position);
      expect(haversineDistanceMeters(position, tree.position)).toBeCloseTo(distance, 6);
      fixture.componentInstance.openCultivation(tree.id);
      expect(store.isCultivating()).toBe(true);
      const care = fixture.debugElement.query(
        By.directive(HomeCultivateComponent),
      ).componentInstance;
      expect(care.canCultivate()).toBe(distance <= TREE_CULTIVATION_RADIUS_METERS);
      expect(TestBed.inject(ProgressStore).activeDemoTreeId()).toBe(tree.id);
      if (distance > TREE_CULTIVATION_RADIUS_METERS) {
        expect(care.accessMessage()).toContain('500 公尺');
      }
    },
  );

  it('blocks unknown trees but allows viewing without location and keeps care open when moving away', () => {
    const { fixture, store, current } = setup(false, true);
    fixture.componentInstance.openCultivation('missing');
    expect(store.isCultivating()).toBe(false);
    expect(fixture.componentInstance.cultivationMessage()).toContain('找不到');
    current.set(null);
    fixture.componentInstance.openCultivation('tree-9');
    expect(store.isCultivating()).toBe(true);
    const care = fixture.debugElement.query(By.directive(HomeCultivateComponent)).componentInstance;
    expect(care.canCultivate()).toBe(false);
    expect(care.accessMessage()).toContain('定位');
    const tree = findHomeTree('tree-9')!;
    current.set({ ...tree.position, accuracy: 5, observedAt: new Date() });
    fixture.componentInstance.openCultivation(tree.id);
    fixture.detectChanges();
    expect(store.isCultivating()).toBe(true);
    expect(care.canCultivate()).toBe(true);
    current.set({
      longitude: 121.454754,
      latitude: 25.001002,
      accuracy: 5,
      observedAt: new Date(),
    });
    fixture.detectChanges();
    expect(store.isCultivating()).toBe(true);
    expect(care.canCultivate()).toBe(false);
    expect(care.accessMessage()).toContain('僅能查看');
    current.set({ ...tree.position, accuracy: 5, observedAt: new Date() });
    fixture.detectChanges();
    expect(care.canCultivate()).toBe(true);
  });

  it('shows the idle dashboard after confirmation, preserves the route during care, and terminates only on confirmation', async () => {
    const { fixture, store, current } = setup(false, true);
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmStation(fixture, 'route-water-1');
    const stations = store.taskPoints();
    expect(store.routeNeedsUpdate()).toBe(true);
    fixture.detectChanges();
    const planningPanel = fixture.debugElement.query(By.directive(HomePlanComponent));
    expect(planningPanel.query(By.css('.plan-confirm')).componentInstance.disabled).toBe(false);
    expect(planningPanel.query(By.css('.plan-confirm')).nativeElement.textContent).toContain(
      '更新預覽路線',
    );
    planningPanel.query(By.css('.plan-confirm')).nativeElement.click();
    await vi.waitFor(() => expect(store.routeNeedsUpdate()).toBe(false));
    fixture.detectChanges();
    expect(store.isPlanning()).toBe(true);
    expect(planningPanel.componentInstance.distanceMeters()).toBe(1600);
    expect(planningPanel.query(By.css('.plan-confirm')).componentInstance.disabled).toBe(false);
    planningPanel.componentInstance.confirmRoute.emit();
    expect(store.isPlanning()).toBe(true);
    TestBed.inject(ModalService).close('confirm');
    const route = store.route();
    expect(route).toEqual(
      responseFor([store.baseRoute()[0], stations[0].position, store.destination()!.position])
        .coordinates,
    );
    expect(store.routeNeedsUpdate()).toBe(false);
    fixture.detectChanges();
    let idle = fixture.debugElement.query(By.directive(HomeIdleComponent));
    expect(idle).not.toBeNull();
    expect(idle.componentInstance.hasActiveRoute()).toBe(true);
    expect(idle.nativeElement.textContent).toContain('今日步數');
    expect(idle.nativeElement.textContent).toContain('中止本次路線');
    expect(fixture.nativeElement.querySelector('home-walking')).toBeNull();
    expect(fixture.debugElement.query(By.directive(HomePlanComponent))).toBeNull();
    expect(store.route()).toBe(route);

    current.set(null);
    fixture.componentInstance.openCultivation('tree-9');
    fixture.detectChanges();
    const care = fixture.debugElement.query(By.directive(HomeCultivateComponent)).componentInstance;
    expect(care.isOpen()).toBe(true);
    expect(care.canCultivate()).toBe(false);
    expect(care.treeName()).toBe(findHomeTree('tree-9')!.nickName);
    expect(store.route()).toBe(route);
    expect(store.taskPoints()).toBe(stations);
    care.dismissed();
    fixture.detectChanges();
    expect(store.isWalking()).toBe(true);

    idle = fixture.debugElement.query(By.directive(HomeIdleComponent));
    const dialog = TestBed.inject(DialogService);
    idle.componentInstance.terminate.emit();
    expect(dialog.isDialogOpen()).toBe(true);
    expect(store.route()).toBe(route);
    dialog.closeDialog('cancel');
    expect(store.hasActiveRoute()).toBe(true);
    expect(store.route()).toBe(route);
    idle.componentInstance.terminate.emit();
    dialog.closeDialog('confirm');
    fixture.detectChanges();
    expect(store.isIdle()).toBe(true);
    expect(store.hasActiveRoute()).toBe(false);
    expect(store.destination()).toBeNull();
    expect(store.route()).toEqual([]);
    expect(store.taskPoints()).toEqual([]);
    expect(
      fixture.debugElement.query(By.directive(HomeIdleComponent)).nativeElement.textContent,
    ).toContain('開始散步');
  });

  it('does not terminate the route after the Home component is destroyed', async () => {
    const { fixture, store } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    await confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    fixture.componentInstance.requestRouteTermination();
    fixture.destroy();
    TestBed.inject(DialogService).closeDialog('confirm');
    expect(store.hasActiveRoute()).toBe(true);
  });

  it('keeps routing errors visible when preview updating fails and supports retry before confirmation', async () => {
    const { fixture, store, directions } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmStation(fixture, 'route-water-1');
    const base = store.route();
    directions.walking.mockRejectedValueOnce(new Error('連貫路線失敗'));
    await fixture.componentInstance.updateRoute();
    expect(store.isPlanning()).toBe(true);
    expect(store.hasActiveRoute()).toBe(false);
    expect(store.route()).toBe(base);
    expect(store.planningError()).toBe('連貫路線失敗');
    fixture.componentInstance.retryRoute();
    await vi.waitFor(() => expect(store.routeNeedsUpdate()).toBe(false));
    expect(store.isPlanning()).toBe(true);
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    expect(store.isWalking()).toBe(true);
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 3);
  });

  it.each(['station-change', 'back'] as const)(
    'does not apply a stale preview after %s',
    async (change) => {
      const { fixture, store, directions } = setup();
      fixture.componentInstance.startPlanning();
      await fixture.componentInstance.selectDestination('tree-5');
      confirmStation(fixture, 'route-water-1');
      let resolveRoute!: (route: WalkingDirections) => void;
      directions.walking.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRoute = resolve;
          }),
      );
      const preview = fixture.componentInstance.updateRoute();
      const [points, signal] = directions.walking.mock.calls.at(-1)!;
      if (change === 'station-change') confirmStation(fixture, 'route-water-1');
      if (change === 'back') fixture.componentInstance.back();
      expect(signal.aborted).toBe(true);
      resolveRoute(responseFor(points));
      await preview;
      expect(store.hasActiveRoute()).toBe(false);
      expect(store.phase()).toBe(change === 'back' ? 'idle' : 'planning');
    },
  );

  it('requires preview updating before confirmation and never silently fetches a route on confirmation', async () => {
    const { fixture, store, directions } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmStation(fixture, 'route-water-1');
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    expect(store.isPlanning()).toBe(true);
    expect(store.hasActiveRoute()).toBe(false);
    expect(store.planningError()).toContain('請先更新預覽路線');
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 1);

    await fixture.componentInstance.updateRoute();
    expect(store.isPlanning()).toBe(true);
    expect(store.routeNeedsUpdate()).toBe(false);
    expect(store.plannedDistanceMeters()).toBe(1600);
    expect(store.planningError()).toBeNull();
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    expect(store.isWalking()).toBe(true);
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 2);
  });

  it('keeps destination selection separate from cultivation during planning', async () => {
    const { fixture, store } = setup();
    fixture.componentInstance.startPlanning();
    fixture.componentInstance.openCultivation('tree-5');
    expect(store.isCultivating()).toBe(true);
    store.finishCultivating();
    expect(store.isPlanning()).toBe(true);
    await fixture.componentInstance.selectDestination('tree-5');
    expect(store.destination()?.id).toBe('tree-5');
  });

  it('plans an empty planting destination and rejects unavailable trees without calling directions', async () => {
    const { fixture, store, directions } = setup();
    fixture.componentInstance.startPlanning();
    const progress = TestBed.inject(ProgressStore);
    progress.markDemoTreeVisited('tree-5');
    await fixture.componentInstance.selectDestination('tree-5');
    expect(store.destination()).toBeNull();
    expect(store.planningError()).toContain('今日');
    expect(directions.walking).not.toHaveBeenCalled();
    await fixture.componentInstance.selectDestination(demoPlantingSpots[0].id);
    expect(store.destination()?.id).toBe(demoPlantingSpots[0].id);
    expect(store.route().length).toBeGreaterThan(1);
    expect(progress.demoTrees()[demoPlantingSpots[0].id].planted).toBe(false);
  });

  it('preserves an in-flight planning route while inspecting an unavailable tree and returns without reframing', async () => {
    const { fixture, store, directions, intents } = setup();
    fixture.componentInstance.startPlanning();
    fixture.detectChanges();
    let resolveBase!: (response: WalkingDirections) => void;
    directions.walking.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBase = resolve;
        }),
    );
    const selecting = fixture.componentInstance.selectDestination('tree-8');
    fixture.detectChanges();
    const progress = TestBed.inject(ProgressStore);
    progress.markDemoTreeVisited('tree-5');
    fixture.componentInstance.openCultivation('tree-5');
    fixture.detectChanges();
    expect(store.cultivationReturnPhase()).toBe('planning');
    const [points] = directions.walking.mock.calls[0];
    resolveBase(responseFor(points));
    await selecting;
    expect(store.destination()?.id).toBe('tree-8');
    expect(store.route().length).toBeGreaterThan(1);
    expect(store.taskRoutes().length).toBeGreaterThan(0);
    expect(store.routeLoading()).toBe(false);
    const cameraCount = intents.length;
    store.finishCultivating();
    fixture.detectChanges();
    expect(store.isPlanning()).toBe(true);
    expect(intents).toHaveLength(cameraCount);
  });

  it('defers route updates and API calls until requested while keeping the camera still', async () => {
    const { fixture, store, intents, directions } = setup();
    fixture.componentInstance.startPlanning();
    fixture.detectChanges();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    fixture.detectChanges();
    const cameraRequests = intents.length;
    const originalRoute = store.route();
    const task = store.availableTaskPoints()[0];

    confirmStation(fixture, task.id);
    fixture.detectChanges();
    expect(store.taskPoints()).toEqual([task]);
    expect(store.route()).toEqual(originalRoute);
    expect(store.routeNeedsUpdate()).toBe(true);
    expect(intents).toHaveLength(cameraRequests);
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 1);

    confirmStation(fixture, task.id);
    fixture.detectChanges();
    expect(store.taskPoints()).toEqual([]);
    expect(store.route()).toEqual(originalRoute);
    expect(store.routeNeedsUpdate()).toBe(false);
    expect(intents).toHaveLength(cameraRequests);
  });

  it('frames the chosen destination then follows the player on departure without a separate task-selection transition', async () => {
    const { fixture, store, intents } = setup();
    fixture.componentInstance.startPlanning();
    fixture.detectChanges();
    const planningRequests = intents.length;
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.detectChanges();
    expect(intents.length).toBeGreaterThan(planningRequests);
    expect(intents[intents.length - 1].kind).toBe('route-overview');
    confirmStation(fixture, 'route-water-1');
    fixture.detectChanges();
    const taskRequests = intents.length;
    await fixture.componentInstance.updateRoute();
    fixture.detectChanges();
    expect(intents).toHaveLength(taskRequests);

    await confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    fixture.detectChanges();
    expect(store.isWalking()).toBe(true);
    expect(intents.length).toBeGreaterThan(taskRequests);
    const finalIntent = intents[intents.length - 1];
    expect(finalIntent.kind).toBe('follow-player');
  });

  it('opens a bottom sheet and keeps planning unchanged when the user returns', async () => {
    const { fixture, store } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    const route = store.route();
    const modal = TestBed.inject(ModalService);

    confirmDeparture(fixture);

    expect(modal.isOpen()).toBe(true);
    expect(modal.breakPoint()).toEqual([0, 0.21]);
    expect(modal.modalContent()).toEqual({
      title: '確定開始挑戰？',
      description: '沿著此路線行走的話，預計獲得的資源',
      titleBadge: '無額外補給',
      mainBtnText: '確認',
      subBtnText: '返回',
    });
    expect(TestBed.inject(DialogService).isDialogOpen()).toBe(false);
    expect(store.isPlanning()).toBe(true);
    modal.close('cancel');
    expect(store.isPlanning()).toBe(true);
    expect(store.hasActiveRoute()).toBe(false);
    expect(store.route()).toBe(route);

    confirmDeparture(fixture);
    modal.close('confirm');
    expect(store.isWalking()).toBe(true);
  });

  it('wires selected station check-in to the cultivation-style modal and credits supply only once', async () => {
    const { fixture, store, current, toast, presentToast, dismissToast } = setup(false, true);
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmStation(fixture, store.taskRoutes()[0].id);
    await fixture.componentInstance.updateRoute();
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    const task = store.taskPoints()[0];
    const progress = TestBed.inject(ProgressStore);
    const inventory = progress.inventory();
    current.set({ ...current()!, latitude: 0, longitude: 0 });
    fixture.detectChanges();
    const map = fixture.debugElement.query(By.directive(HomeMapComponent)).componentInstance;
    map.stationCheckIn.emit(task.id);
    fixture.detectChanges();
    const modal = fixture.debugElement.query(
      By.directive(HomeSupplyStationComponent),
    ).componentInstance;
    expect(modal.station()).toBe(task);
    expect(modal.canCheckIn()).toBe(false);
    expect(modal.rewardLabel()).toBe(supplyRewardLabel(task.supplyStation.supply));
    await vi.waitFor(() => expect(presentToast).toHaveBeenCalledOnce());
    expect(toast.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: '請靠近一點再進行打卡。' }),
    );
    expect(progress.inventory()).toBe(inventory);
    current.set({ ...current()!, ...task.position });
    for (let i = 0; i < 7; i++) {
      modal.keySpin(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    }
    expect(progress.inventory()).toBe(inventory);
    current.set({ ...current()!, latitude: 0, longitude: 0 });
    modal.keySpin(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await vi.waitFor(() => expect(presentToast).toHaveBeenCalledTimes(2));
    expect(toast.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '請靠近一點再進行互動',
        cssClass: 'interaction-warning-toast',
      }),
    );
    expect(progress.inventory()).toBe(inventory);
    expect(store.checkedInTaskIds()).not.toContain(task.id);
    current.set({ ...current()!, ...task.position });
    fixture.detectChanges();
    expect(modal.canCheckIn()).toBe(true);
    for (let i = 0; i < 8; i++) {
      modal.keySpin(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    }
    fixture.detectChanges();
    expect(modal.claimed()).toBe(true);
    expect(progress.inventory().waterDrops).toBe(
      inventory.waterDrops + task.supplyStation.supply.amount,
    );
    const claimedInventory = progress.inventory();
    modal.checkIn.emit();
    expect(progress.inventory()).toBe(claimedInventory);
    expect(store.checkInError()).toContain('已領取');
    modal.onWillDismiss();
    expect(dismissToast).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.checkInStation()).toBe(task);
    modal.closed.emit();
    fixture.detectChanges();
    expect(fixture.componentInstance.checkInStation()).toBeNull();
    expect(store.isWalking()).toBe(true);
    map.stationCheckIn.emit(task.id);
    fixture.detectChanges();
    expect(modal.claimed()).toBe(true);
  });

  it('presents the proximity toast for denied tree interactions without closing care', async () => {
    const { fixture, store, current, toast, presentToast } = setup(false, true);
    current.set(null);
    fixture.componentInstance.openCultivation('tree-6');
    fixture.detectChanges();
    const care: HomeCultivateComponent = fixture.debugElement.query(
      By.directive(HomeCultivateComponent),
    ).componentInstance;
    expect(care.canCultivate()).toBe(false);
    care.interactionDenied.emit();
    await vi.waitFor(() => expect(presentToast).toHaveBeenCalledOnce());
    expect(toast.create).toHaveBeenCalledWith({
      message: '請靠近一點再進行互動',
      duration: 2000,
      position: 'middle',
      cssClass: 'interaction-warning-toast',
    });
    expect(store.isCultivating()).toBe(true);
    expect(TestBed.inject(ProgressStore).demoHarvestStartedAt()).toBeNull();
  });

  it('dismisses the tree warning as soon as care starts closing', async () => {
    const { fixture, presentToast, dismissToast } = setup(false, true);
    fixture.componentInstance.openCultivation('tree-6');
    fixture.detectChanges();
    const care: HomeCultivateComponent = fixture.debugElement.query(
      By.directive(HomeCultivateComponent),
    ).componentInstance;
    care.interactionDenied.emit();
    await vi.waitFor(() => expect(presentToast).toHaveBeenCalledOnce());
    care.onWillDismiss();
    expect(dismissToast).toHaveBeenCalledOnce();
  });

  it('shows supply-station feedback using the cultivation toast style', async () => {
    const { fixture, toast, presentToast } = setup(false, true);
    const station = fixture.debugElement.query(By.directive(HomeSupplyStationComponent))
      .componentInstance as HomeSupplyStationComponent;
    const message = '尚無有效定位，取得定位並靠近後即可打卡。';
    station.feedbackRequested.emit(message);
    await vi.waitFor(() => expect(presentToast).toHaveBeenCalledOnce());
    expect(toast.create).toHaveBeenCalledWith({
      message,
      duration: 2000,
      position: 'middle',
      cssClass: 'interaction-warning-toast',
    });
  });

  it('does not present a warning whose creation finishes after modal closure', async () => {
    const { fixture, toast, presentToast, dismissToast } = setup();
    const overlay = { present: presentToast, dismiss: dismissToast };
    let created = (_overlay: typeof overlay) => {};
    toast.create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          created = resolve;
        }),
    );
    const pending = fixture.componentInstance.showInteractionWarning();
    fixture.componentInstance.dismissToast();
    created(overlay);
    await pending;
    expect(presentToast).not.toHaveBeenCalled();
    expect(dismissToast).toHaveBeenCalledOnce();
  });

  it('dismisses a warning that finishes presenting after modal closure', async () => {
    const { fixture, presentToast, dismissToast } = setup();
    let presented = () => {};
    presentToast.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          presented = resolve;
        }),
    );
    const pending = fixture.componentInstance.showInteractionWarning();
    await vi.waitFor(() => expect(presentToast).toHaveBeenCalledOnce());
    fixture.componentInstance.dismissToast();
    expect(dismissToast).toHaveBeenCalledOnce();
    presented();
    await pending;
    expect(dismissToast).toHaveBeenCalledTimes(2);
  });

  it('replaces earlier warnings and dismisses the active one on view teardown', async () => {
    const { fixture, presentToast, dismissToast } = setup();
    await fixture.componentInstance.showInteractionWarning();
    await fixture.componentInstance.showInteractionWarning();
    expect(presentToast).toHaveBeenCalledTimes(2);
    expect(dismissToast).toHaveBeenCalledOnce();
    fixture.destroy();
    expect(dismissToast).toHaveBeenCalledTimes(2);
  });

  it('uses configured mixed resource amounts in departure confirmation', async () => {
    const { fixture, store } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    const tasks = store.taskRoutes().map((task, index) => ({
      ...task,
      supplyStation: {
        ...task.supplyStation,
        supply:
          index === 0
            ? { resource: 'water' as const, amount: 7 }
            : { resource: 'fertilizer' as const, amount: 2 },
      },
    }));
    store.setTaskRoutes(tasks);
    fixture.componentInstance.confirmDestination();
    fixture.componentInstance.toggleTaskPoint(tasks[0].id);
    const modal = TestBed.inject(ModalService);
    confirmStation(fixture, tasks[1].id);
    await fixture.componentInstance.updateRoute();
    confirmDeparture(fixture);
    expect(modal.modalContent()).toMatchObject({ titleBadge: '+7水 · +2肥料' });
    modal.close('cancel');
  });

  it('revalidates station range and session at claim time rather than trusting an open modal', async () => {
    const { fixture, store, current, toast, presentToast } = setup(false, true);
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmStation(fixture, store.taskRoutes()[0].id);
    await fixture.componentInstance.updateRoute();
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    const station = store.taskPoints()[0];
    current.set({ ...current()!, ...station.position });
    fixture.componentInstance.openStationCheckIn(station.id);
    fixture.detectChanges();
    const stationModal = fixture.debugElement.query(
      By.directive(HomeSupplyStationComponent),
    ).componentInstance;
    expect(stationModal.canCheckIn()).toBe(true);
    const progress = TestBed.inject(ProgressStore);
    const inventory = progress.inventory();
    current.set(null);
    expect(stationModal.canCheckIn()).toBe(false);
    expect(stationModal.accessMessage()).toContain('定位');
    fixture.detectChanges();
    await vi.waitFor(() => expect(presentToast).toHaveBeenCalledOnce());
    expect(toast.create).toHaveBeenLastCalledWith({
      message: '尚無有效定位，取得定位並靠近後即可打卡。',
      duration: 2000,
      position: 'middle',
      cssClass: 'interaction-warning-toast',
    });
    fixture.componentInstance.claimStationSupply();
    await vi.waitFor(() => expect(presentToast).toHaveBeenCalledTimes(2));
    expect(toast.create).toHaveBeenCalledWith({
      message: '請靠近一點再進行互動',
      duration: 2000,
      position: 'middle',
      cssClass: 'interaction-warning-toast',
    });
    expect(store.checkInError()).toBeNull();
    expect(progress.inventory()).toBe(inventory);
    store.cancelWalk();
    fixture.componentInstance.claimStationSupply();
    expect(store.checkInError()).toContain('已變更');
    expect(progress.inventory()).toBe(inventory);
  });

  it('completes endpoint check-in without closing care, grants no extra reward and clears all route data', async () => {
    const { fixture, store, current, intents } = setup(false, true);
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    const destination = store.destination()!;
    current.set({ ...current()!, ...destination.position });
    fixture.componentInstance.openCultivation(destination.id);
    fixture.detectChanges();
    const cameraRequests = intents.length;
    const care = fixture.debugElement.query(By.directive(HomeCultivateComponent)).componentInstance;
    const progress = TestBed.inject(ProgressStore);
    const inventory = progress.inventory();
    expect(care.showDestinationCheckIn()).toBe(true);
    care.destinationCheckIn.emit();
    fixture.detectChanges();
    expect(store.hasActiveRoute()).toBe(false);
    expect(store.destination()).toBeNull();
    expect(store.route()).toEqual([]);
    expect(store.taskPoints()).toEqual([]);
    expect(store.checkedInTaskIds()).toEqual([]);
    expect(care.isOpen()).toBe(true);
    expect(care.showDestinationCheckIn()).toBe(false);
    expect(care.canCultivate()).toBe(true);
    expect(care.checkInMessage()).toContain('已完成');
    expect(TestBed.inject(DialogService).walkResult()).toEqual(store.completedWalkResult());
    expect(TestBed.inject(DialogService).config().mainBtnTxt).toBe('太棒了!');
    expect(progress.inventory()).toBe(inventory);
    care.destinationCheckIn.emit();
    expect(progress.inventory()).toBe(inventory);
    care.dismissed();
    fixture.detectChanges();
    expect(store.isIdle()).toBe(true);
    expect(intents).toHaveLength(cameraRequests);
  });

  it('shows endpoint confirmation only for the active destination and rechecks proximity', async () => {
    const { fixture, store, current } = setup(false, true);
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmDeparture(fixture);
    TestBed.inject(ModalService).close('confirm');
    fixture.componentInstance.openCultivation('tree-9');
    const care = fixture.debugElement.query(By.directive(HomeCultivateComponent)).componentInstance;
    expect(care.showDestinationCheckIn()).toBe(false);
    fixture.componentInstance.confirmDestinationCheckIn();
    expect(store.checkInError()).toContain('不是本次');
    store.finishCultivating();
    fixture.componentInstance.openCultivation('tree-5');
    expect(care.showDestinationCheckIn()).toBe(true);
    current.set(null);
    fixture.componentInstance.confirmDestinationCheckIn();
    expect(store.hasActiveRoute()).toBe(true);
    expect(store.checkInError()).toContain('定位');
  });
  it('does not replace an open confirmation or start a route after Home is destroyed', async () => {
    const { fixture, store } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    const modal = TestBed.inject(ModalService);
    const open = vi.spyOn(modal, 'open');
    confirmDeparture(fixture);
    confirmDeparture(fixture);
    expect(open).toHaveBeenCalledTimes(1);

    fixture.destroy();
    modal.close('confirm');
    expect(store.isPlanning()).toBe(true);
    expect(store.hasActiveRoute()).toBe(false);
  });

  it('passes the rendered panel edges to destination framing without retracking task detours', async () => {
    const { fixture, intents } = setup(true);
    const top: HTMLDivElement = fixture.debugElement.query(By.css('.top')).nativeElement;
    const bottom: HTMLDivElement = fixture.debugElement.query(By.css('.bottom')).nativeElement;
    vi.spyOn(top, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 390, 180));
    vi.spyOn(bottom, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 640, 390, 204));
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    fixture.detectChanges();
    const intent = intents[intents.length - 1];
    expect(intent.kind).toBe('route-overview');
    if (intent.kind === 'route-overview') {
      expect(intent.visibleArea).toEqual({ top: 180, bottom: 640 });
    }
    const requests = intents.length;
    confirmStation(fixture, 'route-water-1');
    fixture.detectChanges();
    expect(intents).toHaveLength(requests);
  });

  it('loads configured stations before locking and reveals them after destination confirmation', async () => {
    const { fixture, store, directions } = setup();
    const detours: { points: readonly GeoPoint[]; resolve: (route: WalkingDirections) => void }[] =
      [];
    directions.walking.mockImplementation((points) =>
      points.length === 2
        ? Promise.resolve(responseFor(points))
        : new Promise((resolve) => detours.push({ points, resolve })),
    );
    fixture.componentInstance.startPlanning();
    const request = fixture.componentInstance.selectDestination('tree-5');
    await vi.waitFor(() => expect(detours).toHaveLength(demoSupplyStations.length));
    fixture.detectChanges();
    expect(store.isPlanning()).toBe(true);
    expect(store.route().length).toBeGreaterThan(0);
    expect(store.availableTaskPoints()).toHaveLength(demoSupplyStations.length);
    expect(fixture.componentInstance.nearbyTaskPoints()).toHaveLength(0);
    expect(store.routeLoading()).toBe(true);
    expect(store.startWalk('test')).toBe(false);
    for (const detour of detours) detour.resolve(responseFor(detour.points));
    await request;
    expect(store.routeLoading()).toBe(false);
    expect(store.taskRoutes()).toHaveLength(demoSupplyStations.length);
    fixture.componentInstance.confirmDestination();
    expect(fixture.componentInstance.nearbyTaskPoints()).toHaveLength(demoSupplyStations.length);
    expect(store.availableTaskPoints()[0].estimatedExtraSteps).toBe(Math.round(1600 / 0.75));
    confirmStation(fixture, store.availableTaskPoints()[0].id);
    expect(store.taskPoints()).toHaveLength(1);
  });

  it('discards a late response when the user chooses another endpoint', async () => {
    const { fixture, store, directions } = setup();
    let resolveFirst!: (route: WalkingDirections) => void;
    directions.walking.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fixture.componentInstance.startPlanning();
    const first = fixture.componentInstance.selectDestination('tree-5');
    await fixture.componentInstance.selectDestination('tree-6');
    const latestRoute = store.baseRoute();
    const [points, signal] = directions.walking.mock.calls[0];
    expect(signal.aborted).toBe(true);
    resolveFirst(responseFor(points));
    await first;
    expect(store.destination()?.id).toBe('tree-6');
    expect(store.baseRoute()).toBe(latestRoute);
    expect(store.planningError()).toBeNull();
  });

  it('cancels outstanding work when returning from planning', async () => {
    const { fixture, store, directions } = setup();
    let resolveFirst!: (route: WalkingDirections) => void;
    directions.walking.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fixture.componentInstance.startPlanning();
    const request = fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.back();
    const [points, signal] = directions.walking.mock.calls[0];
    expect(signal.aborted).toBe(true);
    resolveFirst(responseFor(points));
    await request;
    expect(store.isIdle()).toBe(true);
    expect(store.route()).toEqual([]);
  });

  it('surfaces API failure without a straight-line fallback and supports retry', async () => {
    const { fixture, store, directions } = setup();
    directions.walking.mockRejectedValueOnce(new Error('Mapbox 路線失敗'));
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    expect(store.route()).toEqual([]);
    expect(store.planningError()).toBe('Mapbox 路線失敗');
    expect(store.routeLoading()).toBe(false);
    expect(store.startWalk('test')).toBe(false);
    await fixture.componentInstance.selectDestination('tree-5', true);
    expect(store.planningError()).toBeNull();
    expect(store.taskRoutes()).toHaveLength(demoSupplyStations.length);
  });

  it('requests one continuous multi-waypoint route only on update and reuses cached combinations', async () => {
    const { fixture, store, directions, intents } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    fixture.detectChanges();
    const cameraRequests = intents.length;
    const first = store.availableTaskPoints()[0];
    const second = store.availableTaskPoints()[1];
    confirmStation(fixture, second.id);
    confirmStation(fixture, first.id);
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 1);
    expect(store.startWalk('test')).toBe(false);
    await fixture.componentInstance.updateRoute();
    fixture.detectChanges();
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 2);
    const points = directions.walking.mock.calls[demoSupplyStations.length + 1][0];
    expect(points).toEqual([
      store.baseRoute()[0],
      first.position,
      second.position,
      store.destination()!.position,
    ]);
    expect(store.route()).toEqual(responseFor(points).coordinates);
    expect(store.plannedDistanceMeters()).toBe(1600);
    expect(store.routeNeedsUpdate()).toBe(false);
    expect(intents).toHaveLength(cameraRequests);

    confirmStation(fixture, second.id);
    await fixture.componentInstance.updateRoute();
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 3);
    confirmStation(fixture, second.id);
    await fixture.componentInstance.updateRoute();
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 3);
    expect(store.route()).toEqual(responseFor(points).coordinates);
    confirmStation(fixture, first.id);
    confirmStation(fixture, second.id);
    expect(store.route()).toEqual(store.baseRoute());
    expect(store.routeNeedsUpdate()).toBe(false);
    expect(directions.walking).toHaveBeenCalledTimes(demoSupplyStations.length + 3);
  });

  it('cancels an in-flight update if task selection changes and discards its stale result', async () => {
    const { fixture, store, directions } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmStation(fixture, 'route-water-1');
    let resolveUpdate!: (route: WalkingDirections) => void;
    directions.walking.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const update = fixture.componentInstance.updateRoute();
    const [points, signal] = directions.walking.mock.calls[demoSupplyStations.length + 1];
    confirmStation(fixture, 'route-water-2');
    expect(signal.aborted).toBe(true);
    expect(store.routeLoading()).toBe(false);
    resolveUpdate(responseFor(points));
    await update;
    expect(store.route()).toEqual(store.baseRoute());
    expect(store.routeNeedsUpdate()).toBe(true);
    expect(store.planningError()).toBeNull();
    await fixture.componentInstance.updateRoute();
    expect(directions.walking.mock.calls[demoSupplyStations.length + 2][0]).toHaveLength(4);
    expect(store.routeNeedsUpdate()).toBe(false);
  });

  it('retains the previous route visibly on an update error and blocks departure until retry succeeds', async () => {
    const { fixture, store, directions } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    confirmStation(fixture, 'route-water-1');
    directions.walking.mockRejectedValueOnce(new Error('連貫路線失敗'));
    await fixture.componentInstance.updateRoute();
    expect(store.route()).toEqual(store.baseRoute());
    expect(store.planningError()).toBe('連貫路線失敗');
    expect(store.routeNeedsUpdate()).toBe(true);
    expect(store.routeLoading()).toBe(false);
    expect(store.startWalk('test')).toBe(false);
    await fixture.componentInstance.updateRoute();
    expect(store.planningError()).toBeNull();
    expect(store.routeNeedsUpdate()).toBe(false);
    expect(store.startWalk('test')).toBe(true);
  });

  it('requires explicit destination confirmation, locks it, and resets the lock when returning', async () => {
    const { fixture, store, directions } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.toggleTaskPoint(store.taskRoutes()[0].id);
    expect(store.taskPoints()).toEqual([]);
    fixture.componentInstance.confirmRoute();
    expect(TestBed.inject(ModalService).isOpen()).toBe(false);
    expect(store.isPlanning()).toBe(true);
    const requests = directions.walking.mock.calls.length;
    fixture.componentInstance.confirmDestination();
    expect(store.destinationConfirmed()).toBe(true);
    expect(store.hasActiveRoute()).toBe(false);
    await fixture.componentInstance.selectDestination('tree-8');
    expect(store.destination()?.id).toBe('tree-5');
    expect(directions.walking).toHaveBeenCalledTimes(requests);
    fixture.componentInstance.back();
    fixture.componentInstance.startPlanning();
    expect(store.destinationConfirmed()).toBe(false);
    expect(store.treeStops()).toEqual([]);
    await fixture.componentInstance.selectDestination(demoPlantingSpots[0].id);
    expect(store.destination()?.id).toBe(demoPlantingSpots[0].id);
  });

  it('builds and caches mixed tree, empty-point and station routes without adding supply rewards for trees', async () => {
    const { fixture, store, directions } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    fixture.detectChanges();
    const requests = directions.walking.mock.calls.length;
    fixture.componentInstance.toggleTreeStop('tree-8');
    fixture.componentInstance.toggleTreeStop(demoPlantingSpots[0].id);
    fixture.componentInstance.toggleTaskPoint(store.taskRoutes()[0].id);
    expect(directions.walking).toHaveBeenCalledTimes(requests);
    expect(store.routeNeedsUpdate()).toBe(true);
    const points = walkingTaskWaypoints(store.baseRoute()[0], store.destination()!.position, [
      ...store.taskPoints(),
      ...store.treeStops(),
    ]);
    await fixture.componentInstance.updateRoute();
    expect(directions.walking.mock.calls.at(-1)![0]).toEqual(points);
    expect(store.route()).toEqual(responseFor(points).coordinates);
    expect(store.routedTreeIds()).toEqual(['tree-8', demoPlantingSpots[0].id]);
    expect(store.routeNeedsUpdate()).toBe(false);
    fixture.detectChanges();
    fixture.componentInstance.toggleTreeStop('tree-8');
    await fixture.componentInstance.updateRoute();
    const updatedRequests = directions.walking.mock.calls.length;
    fixture.componentInstance.toggleTreeStop('tree-8');
    await fixture.componentInstance.updateRoute();
    expect(directions.walking).toHaveBeenCalledTimes(updatedRequests);
    expect(store.route()).toEqual(responseFor(points).coordinates);
    expect(store.taskPoints()).toHaveLength(1);
    fixture.componentInstance.confirmRoute();
    TestBed.inject(ModalService).close('confirm');
    expect(store.isWalking()).toBe(true);
    expect(store.treeStops()).toHaveLength(2);
  });

  it('cancels a mixed route update when tree-stop selection changes and rejects its stale response', async () => {
    const { fixture, store, directions } = setup();
    fixture.componentInstance.startPlanning();
    await fixture.componentInstance.selectDestination('tree-5');
    fixture.componentInstance.confirmDestination();
    fixture.componentInstance.toggleTreeStop('tree-8');
    let finish!: (route: WalkingDirections) => void;
    directions.walking.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const updating = fixture.componentInstance.updateRoute();
    const [points, signal] = directions.walking.mock.calls.at(-1)!;
    fixture.componentInstance.toggleTreeStop(demoPlantingSpots[0].id);
    expect(signal.aborted).toBe(true);
    finish(responseFor(points));
    await updating;
    expect(store.routedTreeIds()).toEqual([]);
    expect(store.route()).toEqual(store.baseRoute());
    expect(store.routeNeedsUpdate()).toBe(true);
    await fixture.componentInstance.updateRoute();
    expect(store.routedTreeIds()).toHaveLength(2);
    expect(store.routeNeedsUpdate()).toBe(false);
  });
});

function responseFor(points: readonly GeoPoint[]): WalkingDirections {
  const bend = {
    longitude: (points[0].longitude + points[1].longitude) / 2,
    latitude: points[0].latitude + 0.001,
  };
  return {
    coordinates: [points[0], bend, ...points.slice(1)],
    distanceMeters: points.length === 2 ? 1234 : 1600,
    waypoints: points,
  };
}
