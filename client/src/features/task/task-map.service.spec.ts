import { TestBed } from '@angular/core/testing';
import { TaskMapService, TASK_MAP_TOKEN } from './task-map.service';
import type { TaskItem } from './task.models';
const mocks = vi.hoisted(() => ({ maps: [] as any[] }));
vi.mock('mapbox-gl', () => ({
  default: {
    Map: class {
      callbacks: Record<string, () => void> = {};
      source: any;
      resize = vi.fn();
      stop = vi.fn();
      remove = vi.fn();
      fitBounds = vi.fn();
      addLayer = vi.fn();
      constructor() {
        mocks.maps.push(this);
      }
      on(name: string, cb: () => void) {
        this.callbacks[name] = cb;
      }
      getSource() {
        return this.source;
      }
      addSource() {
        this.source = { setData: vi.fn() };
      }
    },
    Marker: class {
      setLngLat() {
        return this;
      }
      addTo() {
        return this;
      }
      remove() {}
    },
    LngLatBounds: class {
      extend() {
        return this;
      }
    },
  },
}));
describe('retained Task map', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    mocks.maps.length = 0;
  });
  it('reuses one map while switching tasks and leaving/reentering detail', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    TestBed.configureTestingModule({
      providers: [{ provide: TASK_MAP_TOKEN, useValue: 'fixture-token' }],
    });
    const map = TestBed.inject(TaskMapService),
      one = document.createElement('div'),
      two = document.createElement('div');
    const task = {
      taskId: 'one',
      destination: { latitude: 25, longitude: 121 },
      radiusMeters: 100,
    } as TaskItem;
    map.attach(one);
    mocks.maps[0].callbacks['load']();
    map.update(task, null);
    map.detach();
    map.attach(two);
    map.update({ ...task, taskId: 'two', radiusMeters: 200 }, null);
    map.detach(one); // A cached page leaving must not detach the new detail host.
    expect(mocks.maps).toHaveLength(1);
    expect(mocks.maps[0].fitBounds).toHaveBeenCalledTimes(2);
    expect(mocks.maps[0].remove).not.toHaveBeenCalled();
    expect(one.childElementCount).toBe(0);
    expect(two.childElementCount).toBe(1);
    map.ngOnDestroy();
    expect(mocks.maps[0].remove).toHaveBeenCalledOnce();
  });
});
