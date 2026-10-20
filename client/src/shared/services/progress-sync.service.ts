import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { getState, watchState } from '@ngrx/signals';
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
      if (!this.saving) this.activeSave = this.flush(this.generation);
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

  private async switchScope(demo: boolean, uid: string): Promise<void> {
    const generation = ++this.generation;
    if (this.wasDemo) this.demo = structuredClone(getState(this.progress));
    this.wasDemo = demo;
    this.ready = false;
    this.uid = uid;
    this.pending = null;
    this.saving = false;
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
