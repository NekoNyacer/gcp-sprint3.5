import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProgressSyncService } from './progress-sync.service';
import { ProgressRepository } from './progress-repository';
import { SessionStore } from '../stores/session-store';
import { WalkSessionStore } from '../stores/walk-session-store';
import { createProgressState, ProgressStore } from '../stores/progress-store';

describe('ProgressSyncService identity isolation', () => {
  const scope = signal<{ mode: 'demo' | 'normal'; uid: string }>({ mode: 'demo', uid: '' });
  const repository = { load: vi.fn(), save: vi.fn() };
  const reset = vi.fn();
  beforeEach(() => {
    scope.set({ mode: 'demo', uid: '' });
    repository.load.mockReset();
    repository.save.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [
      { provide: SessionStore, useValue: { dataScope: scope, isDemoMode: () => scope().mode === 'demo' } },
      { provide: WalkSessionStore, useValue: { reset } },
      { provide: ProgressRepository, useValue: repository },
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('keeps demo mock steps and rewards local', () => {
    TestBed.inject(ProgressSyncService);
    TestBed.tick();
    const progress = TestBed.inject(ProgressStore);
    expect(progress.todaySteps()).toBe(15888);
    progress.addSteps(20);
    expect(repository.load).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('loads a clean account and saves its steps under its UID', async () => {
    repository.load.mockResolvedValue({ state: createProgressState(false), revision: 0 });
    TestBed.inject(ProgressSyncService);
    TestBed.tick();
    scope.set({ mode: 'normal', uid: 'alice' });
    TestBed.tick();
    await Promise.resolve();
    const progress = TestBed.inject(ProgressStore);
    expect(progress.todaySteps()).toBe(0);
    expect(progress.inventory().waterDrops).toBe(0);
    progress.addSteps(10);
    expect(repository.save).toHaveBeenCalledWith('alice', expect.objectContaining({ todaySteps: 10 }), expect.anything(), 0);
  });

  it('ignores a late account load after switching to demo', async () => {
    let resolve!: (result: { state: ReturnType<typeof createProgressState>; revision: number }) => void;
    repository.load.mockReturnValue(new Promise((done) => { resolve = done; }));
    TestBed.inject(ProgressSyncService);
    TestBed.tick();
    scope.set({ mode: 'normal', uid: 'alice' });
    TestBed.tick();
    scope.set({ mode: 'demo', uid: '' });
    TestBed.tick();
    resolve({ state: createProgressState(false), revision: 0 });
    await Promise.resolve();
    expect(TestBed.inject(ProgressStore).todaySteps()).toBe(15888);
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('refreshes a claimed reward without resetting the walk or losing concurrent local spending',async()=>{
    const baseline=createProgressState(false);baseline.inventory.waterDrops=20;
    repository.load.mockResolvedValue({state:baseline,revision:0});
    const sync=TestBed.inject(ProgressSyncService);TestBed.tick();scope.set({mode:'normal',uid:'alice'});TestBed.tick();await Promise.resolve();
    reset.mockClear();
    let done!:(value:any)=>void;
    const claim=sync.claimTask(()=>new Promise(resolve=>{done=resolve;}));
    await Promise.resolve();await Promise.resolve();
    const progress=TestBed.inject(ProgressStore);
    progress.mergeTaskProgress({...progress.inventory(),waterDrops:17},[]);
    progress.addSteps(100,true);
    const canonical={...baseline,inventory:{...baseline.inventory,waterDrops:22}};
    repository.load.mockResolvedValue({state:canonical,revision:0});
    done({taskId:'task',completedAt:new Date(),reward:{type:'waterDrops',amount:2},inventory:{waterDrops:22,fertilizer:0}});
    await claim;await Promise.resolve();
    expect(reset).not.toHaveBeenCalled();expect(progress.inventory().waterDrops).toBe(19);
    expect(progress.totalTaskWalkingSteps()).toBe(100);
    expect(repository.save).toHaveBeenLastCalledWith('alice',expect.objectContaining({inventory:expect.objectContaining({waterDrops:19})}),expect.objectContaining({inventory:expect.objectContaining({waterDrops:22})}),0);
  });
  it('reads current balances rather than restoring the old balance from an idempotent receipt',async()=>{
    const baseline=createProgressState(false);baseline.inventory.waterDrops=10;
    repository.load.mockResolvedValue({state:baseline,revision:2});
    const sync=TestBed.inject(ProgressSyncService);TestBed.tick();scope.set({mode:'normal',uid:'alice'});TestBed.tick();await Promise.resolve();
    repository.load.mockResolvedValue({state:{...baseline,inventory:{...baseline.inventory,waterDrops:7}},revision:2});
    await sync.claimTask(async()=>({taskId:'old-task',completedAt:new Date(),reward:{type:'waterDrops',amount:2},inventory:{waterDrops:12,fertilizer:0}}));
    expect(TestBed.inject(ProgressStore).inventory().waterDrops).toBe(7);
  });
  it('retains movement during a failed reward refresh and retries without a second command',async()=>{
    const baseline=createProgressState(false);baseline.inventory.waterDrops=10;
    repository.load.mockResolvedValue({state:baseline,revision:0});
    const sync=TestBed.inject(ProgressSyncService);TestBed.tick();scope.set({mode:'normal',uid:'alice'});TestBed.tick();await Promise.resolve();
    const command=vi.fn(async()=>({taskId:'task',completedAt:new Date(),reward:{type:'waterDrops' as const,amount:2},inventory:{waterDrops:12,fertilizer:0}}));
    repository.load.mockRejectedValueOnce(new Error('offline'));
    await expect(sync.claimTask(command,'task')).rejects.toThrow('offline');
    const progress=TestBed.inject(ProgressStore);progress.addSteps(100,true);
    expect(repository.save).not.toHaveBeenCalled();
    repository.load.mockResolvedValue({state:{...baseline,inventory:{...baseline.inventory,waterDrops:12}},revision:0});
    await sync.claimTask(command,'task');
    expect(command).toHaveBeenCalledOnce();expect(progress.totalTaskWalkingSteps()).toBe(100);expect(progress.inventory().waterDrops).toBe(12);
  });
});
