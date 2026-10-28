import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { getState, watchState } from '@ngrx/signals';
import type { TaskCompletionResult } from '../../features/task/task.models';
import { ProgressStore, ProgressState, createProgressState } from '../stores/progress-store';
import { SessionStore } from '../stores/session-store';
import { WalkSessionStore } from '../stores/walk-session-store';
import { ProgressRepository } from './progress-repository';

@Injectable({ providedIn: 'root' })
export class ProgressSyncService {
  private readonly session = inject(SessionStore);
  private readonly progress = inject(ProgressStore);
  private readonly walk = inject(WalkSessionStore);
  private readonly repository = inject(ProgressRepository);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly demoMode = computed(() => this.session.isDemoMode());
  private generation = 0;
  private uid = '';
  private ready = false;
  private revision = 0;
  private saved = createProgressState(false);
  private pending: ProgressState | null = null;
  private saving = false;
  private activeSave: Promise<void> = Promise.resolve();
  private demo = createProgressState();
  private wasDemo = false;
  private rewardLock = false;
  private taskRebase: { before: ProgressState; result: TaskCompletionResult } | null = null;

  constructor() {
    effect(() => {
      const scope = this.session.dataScope();
      untracked(() => void this.switchScope(scope.mode === 'demo', scope.mode === 'normal' ? scope.uid : ''));
    });
    watchState(this.progress, (state) => {
      if (!this.ready || !this.uid) return;
      const scope = this.session.dataScope();
      if (scope.mode !== 'normal' || scope.uid !== this.uid) return;
      this.pending = structuredClone(state);
      if (!this.saving && !this.rewardLock && !this.taskRebase) this.activeSave = this.flush(this.generation);
    });
  }

  retry(): void {
    const scope = this.session.dataScope();
    void this.switchScope(scope.mode === 'demo', scope.mode === 'normal' ? scope.uid : '');
  }

  async reload(): Promise<void> {
    await this.activeSave;
    const scope = this.session.dataScope();
    await this.switchScope(scope.mode === 'demo', scope.mode === 'normal' ? scope.uid : '');
  }

  async flushPending(): Promise<void> {
    if (this.taskRebase) throw new Error('獎勵已記錄，請重試領獎以同步資源');
    await this.activeSave;
    if (this.error()) throw new Error(this.error()!);
  }

  /** Rebase a server reward on concurrent local care/movement, preserving the walk. */
  async claimTask(command: () => Promise<TaskCompletionResult>, taskId?: string): Promise<TaskCompletionResult> {
    if (!this.taskRebase) await this.flushPending();
    else if (taskId && this.taskRebase.result.taskId !== taskId) throw new Error('請先重試上一筆獎勵的資源同步');
    if (!this.ready || this.rewardLock) throw new Error('散步資料尚未同步，請稍後重試');
    const generation = this.generation;
    const before = this.taskRebase?.before ?? structuredClone(getState(this.progress));
    this.rewardLock = true;
    try {
      const result = this.taskRebase?.result ?? await command();
      if (generation !== this.generation) return result;
      this.taskRebase = { before, result };
      // An idempotent retry may return an old receipt; read canonical balances
      // before rebasing so intervening spending is never resurrected.
      const canonical = await this.repository.load(this.uid);
      if (generation !== this.generation) return result;
      if (canonical.revision !== Math.max(this.revision, result.progressRevision ?? 0)) {
        throw new Error('資料已在其他裝置更新，請重新載入。');
      }
      const current = getState(this.progress);
      const serverInventory = canonical.state.inventory;
      const inventory = { ...serverInventory };
      for (const key of Object.keys(inventory) as (keyof typeof inventory)[]) {
        inventory[key] += current.inventory[key] - before.inventory[key];
      }
      const removed = new Set(before.mysterySeeds.filter(s => !current.mysterySeeds.some(c => c.id === s.id)).map(s => s.id));
      const serverSeeds = canonical.state.mysterySeeds;
      const mysterySeeds = [...serverSeeds.filter(s => !removed.has(s.id)),
        ...current.mysterySeeds.filter(s => !before.mysterySeeds.some(b => b.id === s.id) && !serverSeeds.some(b => b.id === s.id))];
      this.saved = { ...this.saved, inventory: serverInventory, mysterySeeds: serverSeeds };
      this.revision = canonical.revision;
      this.taskRebase = null;
      this.progress.mergeTaskProgress(inventory, mysterySeeds);
      return { ...result, inventory: { ...inventory } };
    } finally {
      if (generation === this.generation) {
        this.rewardLock = false;
        if (this.pending && !this.saving && !this.taskRebase) this.activeSave = this.flush(generation);
      }
    }
  }

  private async switchScope(demo: boolean, uid: string): Promise<void> {
    const generation = ++this.generation;
    if (this.wasDemo) this.demo = structuredClone(getState(this.progress));
    this.wasDemo = demo;
    this.ready = false;
    this.uid = uid;
    this.pending = null;
    this.saving = false;
    this.rewardLock = false;
    this.taskRebase = null;
    this.error.set(null);
    this.loading.set(!!uid && !demo);
    this.walk.reset();
    this.progress.replaceProgress(demo ? this.demo : createProgressState(false));
    if (demo || !uid) return;
    try {
      const { state, revision } = await this.repository.load(uid);
      if (generation !== this.generation) return;
      this.saved = structuredClone(state);
      this.revision = revision;
      this.progress.replaceProgress(state);
      this.ready = true;
      this.progress.recoverHarvestedTrees();
      this.loading.set(false);
    } catch (error) {
      if (generation !== this.generation) return;
      this.loading.set(false);
      this.error.set(error instanceof Error ? error.message : '無法載入散步資料');
    }
  }

  private async flush(generation: number): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      while (this.pending && generation === this.generation) {
        const state = this.pending;
        this.pending = null;
        await this.repository.save(this.uid, state, this.saved, this.revision);
        if (generation !== this.generation) return;
        this.saved = state;
        this.revision++;
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.ready = false;
      this.error.set(error instanceof Error ? error.message : '無法儲存散步資料');
    } finally {
      if (generation === this.generation) this.saving = false;
    }
  }
}
