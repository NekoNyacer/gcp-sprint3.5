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
});
