import { TestBed } from '@angular/core/testing';
import { bindCollectionTreeGesture, CollectionMapComponent, CollectionMapTree } from './collection-map.component';
import { settings } from '../../environments/environment-dev';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => void>(),
  source: { setData: vi.fn(), getClusterExpansionZoom: vi.fn() },
  markerButtons: [] as HTMLButtonElement[],
  map: { on: vi.fn(), addControl: vi.fn(), addSource: vi.fn(), addLayer: vi.fn(),
    getSource: vi.fn(), fitBounds: vi.fn(), easeTo: vi.fn(), resize: vi.fn(), remove: vi.fn(),
    isSourceLoaded: vi.fn(() => true), querySourceFeatures: vi.fn() },
}));
vi.mock('mapbox-gl', () => ({ default: {
  Map: class { constructor() { return mocks.map; } },
  NavigationControl: class {},
  LngLatBounds: class { extend() { return this; } },
  Marker: class {
    constructor(options: { element: HTMLButtonElement }) { mocks.markerButtons.push(options.element); }
    setLngLat() { return this; } addTo() { return this; } remove() {}
  },
  Popup: class {
    setLngLat() { return this; } setDOMContent() { return this; } addTo() { return this; } remove() {}
  },
} }));

const tree: CollectionMapTree = { id: 'tree-1', name: '櫻櫻', species: '櫻花', location: '西湖',
  plantedAt: 1792454400000, stage: '結果', harvested: false, canHarvest: true, position: { longitude: 121.55, latitude: 25.08 } };

describe('Collection map', () => {
  const originalIsDev = settings.isDev;
  beforeEach(() => {
    settings.isDev = false;
    window.__CAT_WALK_RUNTIME_CONFIG__ = { mapboxAccessToken: 'test-token' };
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.markerButtons.length = 0;
    mocks.map.on.mockImplementation((event, layerOrHandler, handler) => {
      mocks.handlers.set(handler ? `${event}:${layerOrHandler}` : event, handler ?? layerOrHandler);
      return mocks.map;
    });
    mocks.map.getSource.mockReturnValue(mocks.source);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    TestBed.configureTestingModule({ imports: [CollectionMapComponent] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals();
    settings.isDev = originalIsDev; delete window.__CAT_WALK_RUNTIME_CONFIG__; });

  async function setup() {
    const fixture = TestBed.createComponent(CollectionMapComponent);
    fixture.componentRef.setInput('trees', [tree]);
    fixture.detectChanges();
    await fixture.whenStable();
    mocks.handlers.get('load')!();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('clusters the filtered collection and updates the source when its tab data changes', async () => {
    const fixture = await setup();
    expect(mocks.map.addSource).toHaveBeenCalledWith('collection-trees', expect.objectContaining({
      cluster: true, clusterRadius: 55,
      data: expect.objectContaining({ features: [expect.objectContaining({ properties: expect.objectContaining({ id: tree.id }) })] }),
    }));
    fixture.componentRef.setInput('trees', []);
    fixture.detectChanges();
    expect(mocks.source.setData).toHaveBeenLastCalledWith({ type: 'FeatureCollection', features: [] });
  });

  it('zooms to the cluster expansion level and ignores callbacks after destruction', async () => {
    const fixture = await setup();
    const click = mocks.handlers.get('click:collection-clusters')!;
    click({ features: [{ geometry: { type: 'Point', coordinates: [121.55, 25.08] }, properties: { cluster_id: 7 } }] });
    expect(mocks.source.getClusterExpansionZoom).toHaveBeenCalledWith(7, expect.any(Function));
    const callback = mocks.source.getClusterExpansionZoom.mock.calls[0][1];
    callback(null, 15);
    expect(mocks.map.easeTo).toHaveBeenCalledWith({ center: [121.55, 25.08], zoom: 15, duration: 500 });
    mocks.map.easeTo.mockClear();
    fixture.destroy();
    callback(null, 16);
    expect(mocks.map.easeTo).not.toHaveBeenCalled();
    expect(mocks.map.remove).toHaveBeenCalled();
  });

  it('renders the shared grid card and emits the selected tree when 查看 is clicked', async () => {
    const fixture = await setup();
    const open = vi.fn();
    fixture.componentInstance.cultivationSelect.subscribe(open);
    fixture.componentInstance.selectedId.set(tree.id);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('app-tree-card');
    expect(card.textContent).toContain(tree.name);
    expect(card.textContent).toContain(tree.location);
    fixture.nativeElement.querySelector('ion-button').click();
    expect(open).toHaveBeenCalledExactlyOnceWith(tree.id);
  });

  it('places a tapped marker at the lower center without changing its zoom', async () => {
    const fixture = await setup();
    Object.defineProperty(fixture.nativeElement.querySelector('.map'), 'clientHeight', { value: 600 });
    mocks.map.querySourceFeatures.mockReturnValue([{
      geometry: { type: 'Point', coordinates: [tree.position.longitude, tree.position.latitude] },
      properties: { id: tree.id },
    }]);
    mocks.handlers.get('render')!();
    mocks.markerButtons[0].click();
    expect(mocks.map.easeTo).toHaveBeenCalledExactlyOnceWith({
      center: [tree.position.longitude, tree.position.latitude], offset: [0, 180], duration: 500,
    });
    expect(fixture.componentInstance.selectedId()).toBe(tree.id);
  });
});

describe('Collection tree marker gestures', () => {
  afterEach(() => vi.useRealTimers());
  it('previews on tap and opens cultivation once on hold without also previewing', () => {
    vi.useFakeTimers();
    const button = document.createElement('button');
    const tap = vi.fn(); const hold = vi.fn();
    const cleanup = bindCollectionTreeGesture(button, tap, hold);
    button.click(); expect(tap).toHaveBeenCalledTimes(1);
    button.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    vi.advanceTimersByTime(500);
    button.dispatchEvent(new MouseEvent('pointerup'));
    button.click();
    expect(hold).toHaveBeenCalledTimes(1);
    expect(tap).toHaveBeenCalledTimes(1);
    cleanup();
  });
  it('cancels a hold on drag and when the marker is removed', () => {
    vi.useFakeTimers();
    const button = document.createElement('button');
    const tap = vi.fn(); const hold = vi.fn();
    const cleanup = bindCollectionTreeGesture(button, tap, hold);
    button.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 0 }));
    button.dispatchEvent(new MouseEvent('pointermove', { clientX: 20 }));
    vi.advanceTimersByTime(500); button.click();
    expect(hold).not.toHaveBeenCalled(); expect(tap).not.toHaveBeenCalled();
    button.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    cleanup(); vi.advanceTimersByTime(500);
    expect(hold).not.toHaveBeenCalled();
  });
});
