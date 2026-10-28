import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TaskStore } from './task-store';
import { SeededDemoTaskRepository } from './seeded-demo-task.repository';
import { FirebaseTaskRepository } from './firebase-task.repository';
import { ProgressStore } from '../../shared/stores/progress-store';
import { LocationStore, LocationPoint } from '../../shared/stores/location-store';
import { SessionStore } from '../../shared/stores/session-store';
import { ProgressSyncService } from '../../shared/services/progress-sync.service';
import type { CmsTask } from '../../../../functions/src/cms-domain';
import { WalkSessionStore } from '../../shared/stores/walk-session-store';

describe('Task progress across locations and UI filters', () => {
  it('accumulates across confirmed routes and retains steps when a route is terminated', async () => {
    const { store, progress, near, flush } = setup();
    const walk = TestBed.inject(WalkSessionStore);
    const destination = { id: 'tree-1', position: { latitude: 25, longitude: 121 } };
    const start = (id: string) => {
      walk.startPlanning();
      walk.selectDestination(destination, [
        { latitude: 25.001, longitude: 121 },
        destination.position,
      ]);
      walk.confirmDestination();
      expect(walk.startWalk(id)).toBe(true);
    };
    start('first');
    progress.addSteps(40, true);
    walk.cancelWalk();
    expect(store.steps(store.tasks()[0])).toBe(40);
    start('second');
    progress.addSteps(60, true);
    walk.cancelWalk();
    near();
    await flush();
    expect(store.tasks()[0].readyAt).toBeDefined();
    expect(progress.totalTaskWalkingSteps()).toBe(100);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });
  function setup() {
    const current = signal<LocationPoint | null>(null);
    const scope = signal<{ mode: 'demo' | 'normal'; uid?: string }>({ mode: 'demo' });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionStore,
          useValue: { dataScope: scope, isDemoMode: () => scope().mode === 'demo' },
        },
        {
          provide: LocationStore,
          useValue: { current, source: () => (current() ? 'demo' : null) },
        },
        { provide: ProgressSyncService, useValue: { flushPending: vi.fn(), claimTask: vi.fn() } },
        {
          provide: FirebaseTaskRepository,
          useValue: {
            watchTasks: () => {
              throw new Error('normal not used');
            },
          },
        },
      ],
    });
    const repo = TestBed.inject(SeededDemoTaskRepository),
      progress = TestBed.inject(ProgressStore),
      store = TestBed.inject(TaskStore);
    const task: CmsTask = {
      id: 'task-one',
      name: '板橋綠行',
      description: '',
      areaId: 'banqiao',
      cadence: 'daily',
      enabled: true,
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      destinationName: '廣場',
      address: '',
      latitude: 25,
      longitude: 121,
      rewardAmount: 2,
      requiredSteps: 100,
      radiusMeters: 100,
    };
    repo.setPublishedTasks([task, { ...task, id: 'other-area', areaId: 'xihu' }], 1);
    TestBed.tick();
    const near = () =>
      current.set({ latitude: 25, longitude: 121, accuracy: 5, observedAt: new Date() });
    const flush = async () => {
      TestBed.tick();
      await Promise.resolve();
      await Promise.resolve();
      TestBed.tick();
    };
    return { repo, progress, store, scope, near, current, flush };
  }
  it('qualifies all matching tasks even when another area/cadence is displayed, without awarding automatically', async () => {
    const { store, progress, near, flush } = setup();
    await store.selectArea('banqiao');
    store.selectCadence('event');
    near();
    progress.addSteps(100, true);
    const balance = progress.inventory().waterDrops;
    await flush();
    expect(store.tasks().filter((t) => t.readyAt).length).toBe(2);
    expect(store.incompleteTaskCount()).toBe(2);
    expect(progress.inventory().waterDrops).toBe(balance);
  });
  it('retains pending rewards after leaving, filters them and awards only on explicit confirmation', async () => {
    const { store, progress, near, current, flush } = setup();
    near();
    progress.addSteps(100, true);
    await flush();
    current.set({ latitude: 26, longitude: 121, accuracy: 5, observedAt: new Date() });
    await flush();
    store.selectStatus('ready');
    expect(store.visibleTasks().length).toBe(2);
    const task = store.visibleTasks()[0],
      before = progress.inventory().waterDrops;
    store.openClaim(task);
    store.dismissClaim();
    expect(progress.inventory().waterDrops).toBe(before);
    store.openClaim(task);
    await store.completeSelectedTask();
    expect(progress.inventory().waterDrops).toBe(before + 2);
    await store.completeSelectedTask();
    expect(progress.inventory().waterDrops).toBe(before + 2);
  });
  it('does not qualify ordinary steps or stale positions', async () => {
    const { store, progress, near, current, flush } = setup();
    near();
    progress.addSteps(1000);
    await flush();
    expect(store.incompleteTaskCount()).toBe(0);
    current.set({
      latitude: 25,
      longitude: 121,
      accuracy: 5,
      observedAt: new Date(Date.now() - 31000),
    });
    progress.addSteps(100, true);
    await flush();
    expect(store.incompleteTaskCount()).toBe(0);
    near();
    await flush();
    expect(store.incompleteTaskCount()).toBe(2);
  });
  it('clears task subscriptions and pending dialogs on logout', async () => {
    const { store, progress, near, scope, flush } = setup();
    near();
    progress.addSteps(100, true);
    await flush();
    store.openClaim(store.tasks()[0]);
    scope.set({ mode: 'normal', uid: '' });
    await flush();
    expect(store.tasks()).toEqual([]);
    expect(store.claimTask()).toBeNull();
    expect(store.completionResult()).toBeNull();
  });
});
