import { computed, effect, inject, untracked } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { Subscription, take } from 'rxjs';
import { ProgressStore } from '../../shared/stores/progress-store';
import { ProgressSyncService } from '../../shared/services/progress-sync.service';
import { SessionStore } from '../../shared/stores/session-store';
import { LocationStore } from '../../shared/stores/location-store';
import {
  DEFAULT_TASK_STEPS,
  DEFAULT_TASK_RADIUS,
  taskSteps,
  taskDistance,
  freshTaskLocation,
} from '../../../../functions/src/task-domain';
import {
  TASK_AREAS,
  TaskCadence,
  TaskCompletionResult,
  TaskItem,
  TaskRewardType,
  TaskStatus,
} from './task.models';
import { TaskRepository } from './task.repository';

const initialState = {
  tasks: [] as TaskItem[],
  selectedAreaId: '' as string,
  selectedCadence: 'daily' as TaskCadence,
  selectedReward: '' as TaskRewardType | '',
  selectedStatus: '' as TaskStatus | '',
  selectedTaskId: null as string | null,
  claimTaskId: null as string | null,
  completionResult: null as TaskCompletionResult | null,
  now: Date.now(),
  loading: false,
  submitting: false,
  error: null as string | null,
  completionAttempt: null as { taskId: string; idempotencyKey: string } | null,
};

export const TaskStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    progressSync: inject(ProgressSyncService),
    repository: inject(TaskRepository),
    progressStore: inject(ProgressStore),
    sessionStore: inject(SessionStore),
    locationStore: inject(LocationStore),
    runtime: {
      scope: '',
      generation: 0,
      subscription: undefined as Subscription | undefined,
      preference: undefined as Subscription | undefined,
      timer: undefined as ReturnType<typeof setInterval> | undefined,
      qualifying: new Set<string>(),
      retryAfter: new Map<string, number>(),
    },
  })),
  withComputed((store) => ({
    areas: computed(() => TASK_AREAS),
    isDemoMode: computed(() => store.sessionStore.isDemoMode()),
    location: computed(() => store.locationStore.current()),
    selectedTask: computed(
      () => store.tasks().find((t) => t.taskId === store.selectedTaskId()) ?? null,
    ),
    claimTask: computed(() => store.tasks().find((t) => t.taskId === store.claimTaskId()) ?? null),
  })),
  withMethods((store) => {
    const status = (task: TaskItem): TaskStatus =>
      task.completedAt
        ? 'completed'
        : task.endsAt.getTime() <= store.now()
          ? 'expired'
          : task.readyAt
            ? 'ready'
            : task.status;
    const steps = (task: TaskItem): number =>
      taskSteps(
        {
          cadence: task.cadence,
          startsAt: task.startsAt.getTime(),
          joinedBaseline: task.joinedBaseline,
        },
        store.progressStore.taskWalkingDays(),
        store.progressStore.totalTaskWalkingSteps(),
        store.now(),
      );
    const requiredSteps = (task: TaskItem): number =>
      task.requiredSteps ?? DEFAULT_TASK_STEPS[task.cadence];
    const canQualify = (task: TaskItem): boolean => {
      const location = store.location();
      return (
        status(task) === 'active' &&
        task.startsAt.getTime() <= store.now() &&
        steps(task) >= requiredSteps(task) &&
        !!location &&
        store.locationStore.source() !== null &&
        freshTaskLocation({ ...location, observedAt: location.observedAt.getTime() }, Date.now()) &&
        taskDistance(location, task.destination) <= (task.radiusMeters ?? DEFAULT_TASK_RADIUS)
      );
    };
    const subscribe = (): void => {
      store.runtime.subscription?.unsubscribe();
      const generation = store.runtime.generation;
      patchState(store, { loading: true });
      store.runtime.subscription = store.repository.watchTasks('').subscribe({
        next: (tasks) => {
          if (generation === store.runtime.generation) patchState(store, { tasks, loading: false });
        },
        error: () => {
          if (generation === store.runtime.generation)
            patchState(store, { loading: false, error: '無法載入任務，請重新整理' });
        },
      });
    };
    return {
      status,
      steps,
      requiredSteps,
      radius(task: TaskItem): number {
        return task.radiusMeters ?? DEFAULT_TASK_RADIUS;
      },
      initialize(): void {
        // Scope changes are handled by the root effect, including direct detail links.
        store.runtime.timer ??= setInterval(() => patchState(store, { now: Date.now() }), 1000);
      },
      resetIdentity(scope: string): void {
        if (scope === store.runtime.scope) return;
        store.runtime.scope = scope;
        store.runtime.generation++;
        store.runtime.qualifying.clear();
        store.runtime.retryAfter.clear();
        store.runtime.subscription?.unsubscribe();
        store.runtime.preference?.unsubscribe();
        const selectedTaskId = store.selectedTaskId();
        patchState(store, { ...initialState, selectedTaskId, now: Date.now() });
        if (scope === 'normal:') return;
        subscribe();
        const generation = store.runtime.generation;
        store.runtime.preference = store.repository
          .watchSelectedArea()
          .pipe(take(1))
          .subscribe({
            next: (area) => {
              if (generation === store.runtime.generation)
                patchState(store, { selectedAreaId: area ?? '' });
            },
            error: () => {},
          });
      },
      async selectArea(areaId: string): Promise<void> {
        patchState(store, { selectedAreaId: areaId });
        try {
          await store.repository.saveSelectedArea(areaId);
        } catch {
          patchState(store, { error: '無法保存地區，本次仍套用篩選' });
        }
      },
      selectCadence(cadence: TaskCadence): void {
        patchState(store, { selectedCadence: cadence });
      },
      selectReward(selectedReward: TaskRewardType | ''): void {
        patchState(store, { selectedReward });
      },
      selectStatus(selectedStatus: TaskStatus | ''): void {
        patchState(store, { selectedStatus });
      },
      selectTask(taskId: string): void {
        patchState(store, { selectedTaskId: taskId, error: null });
      },
      refresh(): void {
        patchState(store, { error: null });
        store.runtime.retryAfter.clear();
        subscribe();
      },
      async joinSelectedEvent(): Promise<void> {
        const task = store.selectedTask();
        if (!task || store.submitting()) return;
        const generation = store.runtime.generation;
        patchState(store, { submitting: true, error: null });
        try {
          if (!store.isDemoMode()) await store.progressSync.flushPending();
          if (generation !== store.runtime.generation) return;
          await store.repository.joinEvent(task.taskId);
        } catch (e) {
          if (generation === store.runtime.generation) patchState(store, { error: message(e) });
        } finally {
          if (generation === store.runtime.generation) patchState(store, { submitting: false });
        }
      },
      distanceTo(task: TaskItem): number | null {
        const location = store.location();
        return location ? taskDistance(location, task.destination) : null;
      },
      canComplete(task: TaskItem): boolean {
        return (
          status(task) === 'ready' ||
          (status(task) === 'completed' && store.completionAttempt()?.taskId === task.taskId)
        );
      },
      async checkLocation(): Promise<void> {
        store.runtime.retryAfter.clear();
        await this.qualifyTasks();
      },
      async qualifyTasks(): Promise<void> {
        const generation = store.runtime.generation;
        const candidates = store
          .tasks()
          .filter(
            (task) =>
              canQualify(task) &&
              !store.runtime.qualifying.has(task.taskId) &&
              (store.runtime.retryAfter.get(task.taskId) ?? 0) <= Date.now(),
          );
        for (const task of candidates) store.runtime.qualifying.add(task.taskId);
        for (const task of candidates) {
          try {
            if (!store.isDemoMode()) await store.progressSync.flushPending();
            if (generation !== store.runtime.generation || !canQualify(task)) continue;
            const location = store.location();
            if (location) await store.repository.qualifyTask(task, { ...location });
          } catch (e) {
            if (generation === store.runtime.generation) {
              store.runtime.retryAfter.set(task.taskId, Date.now() + 15_000);
              patchState(store, { error: message(e) });
            }
          } finally {
            if (generation === store.runtime.generation)
              store.runtime.qualifying.delete(task.taskId);
          }
        }
      },
      openClaim(task: TaskItem): void {
        if (this.canComplete(task)) patchState(store, { claimTaskId: task.taskId, error: null });
      },
      dismissClaim(): void {
        if (!store.submitting()) patchState(store, { claimTaskId: null });
      },
      async completeSelectedTask(): Promise<void> {
        const task = store.claimTask() ?? store.selectedTask();
        if (!task || !this.canComplete(task) || store.submitting()) return;
        const generation = store.runtime.generation;
        const attempt =
          store.completionAttempt()?.taskId === task.taskId
            ? store.completionAttempt()!
            : { taskId: task.taskId, idempotencyKey: crypto.randomUUID() };
        patchState(store, { submitting: true, error: null, completionAttempt: attempt });
        try {
          const command = () => store.repository.completeTask(task, null, attempt.idempotencyKey);
          const result = store.isDemoMode()
            ? await command()
            : await store.progressSync.claimTask(command, task.taskId);
          if (generation === store.runtime.generation)
            patchState(store, {
              completionResult: result,
              completionAttempt: null,
              claimTaskId: null,
            });
        } catch (e) {
          if (generation === store.runtime.generation) patchState(store, { error: message(e) });
        } finally {
          if (generation === store.runtime.generation) patchState(store, { submitting: false });
        }
      },
      dismissCompletionResult(): void {
        patchState(store, { completionResult: null });
      },
    };
  }),
  withComputed((store) => ({
    incompleteTaskCount: computed(
      () => store.tasks().filter((t) => store.status(t) === 'ready').length,
    ),
    visibleTasks: computed(() =>
      store
        .tasks()
        .filter(
          (t) =>
            t.cadence === store.selectedCadence() &&
            (!store.selectedAreaId() || t.areaId === store.selectedAreaId()) &&
            (!store.selectedReward() || t.reward.type === store.selectedReward()) &&
            (!store.selectedStatus() || store.status(t) === store.selectedStatus()) &&
            t.startsAt.getTime() <= store.now() &&
            t.endsAt.getTime() > store.now(),
        )
        .sort(
          (a, b) =>
            Number(store.status(a) === 'completed') - Number(store.status(b) === 'completed') ||
            a.endsAt.getTime() - b.endsAt.getTime(),
        ),
    ),
    history: computed(() =>
      store
        .tasks()
        .filter(
          (t) =>
            (!store.selectedAreaId() || t.areaId === store.selectedAreaId()) &&
            (store.status(t) === 'completed' ||
              (store.status(t) === 'expired' && (t.cadence !== 'event' || t.joinedAt))) &&
            t.endsAt.getTime() >= store.now() - 30 * 86400_000,
        ),
    ),
  })),
  withHooks({
    onInit(store) {
      store.initialize();
      effect(() => {
        const scope = store.sessionStore.dataScope();
        untracked(() =>
          store.resetIdentity(scope.mode === 'demo' ? 'demo' : `normal:${scope.uid}`),
        );
      });
      effect(() => {
        store.tasks();
        store.location();
        store.now();
        store.progressStore.taskWalkingDays();
        store.progressStore.totalTaskWalkingSteps();
        untracked(() => void store.qualifyTasks());
      });
    },
    onDestroy(store) {
      store.runtime.subscription?.unsubscribe();
      store.runtime.preference?.unsubscribe();
      if (store.runtime.timer) clearInterval(store.runtime.timer);
    },
  }),
);
function message(error: unknown): string {
  return error instanceof Error ? error.message : '操作失敗，請稍後重試';
}
