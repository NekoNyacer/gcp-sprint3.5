import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { Subscription, take } from 'rxjs';
import { ProgressStore } from '../../shared/stores/progress-store';
import { SessionStore } from '../../shared/stores/session-store';
import { TaskLocationService } from './task-location.service';
import { DemoLocationState, LocationEvidence, TASK_AREAS, TaskCadence, TaskCompletionResult, TaskItem } from './task.models';
import { TaskRepository } from './task.repository';
import { calculateDistanceMeters } from './seeded-demo-task.repository';

type TaskState = { tasks: TaskItem[]; history: TaskItem[]; selectedAreaId: string | null; selectedCadence: TaskCadence; selectedTaskId: string | null; demoLocationState: DemoLocationState; location: LocationEvidence | null; completionResult: TaskCompletionResult | null; now: number; loading: boolean; submitting: boolean; error: string | null; completionAttempt: { taskId: string; idempotencyKey: string } | null };
const initialState: TaskState = { tasks: [], history: [], selectedAreaId: null, selectedCadence: 'daily', selectedTaskId: null, demoLocationState: 'not-arrived', location: null, completionResult: null, now: Date.now(), loading: false, submitting: false, error: null, completionAttempt: null };

export const TaskStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({ repository: inject(TaskRepository), locationService: inject(TaskLocationService), progressStore: inject(ProgressStore), sessionStore: inject(SessionStore), subscriptions: { tasks: undefined as Subscription | undefined, history: undefined as Subscription | undefined }, clock: { intervalId: undefined as ReturnType<typeof setInterval> | undefined } })),
  withComputed((store) => ({
    areas: computed(() => TASK_AREAS),
    isDemoMode: computed(() => store.sessionStore.isDemoMode()),
    canUseLocalTestLocation: computed(() => !store.sessionStore.isDemoMode() && store.locationService.canUseLocalTestLocation()),
    incompleteTaskCount: computed(() => store.tasks().filter((task) => task.startsAt.getTime() <= store.now() && task.endsAt.getTime() > store.now() && task.status !== 'completed').length),
    visibleTasks: computed(() => store.tasks().filter((task) => task.cadence === store.selectedCadence() && task.startsAt.getTime() <= store.now() && task.endsAt.getTime() > store.now()).sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || a.endsAt.getTime() - b.endsAt.getTime())),
    selectedTask: computed(() => [...store.tasks(), ...store.history()].find((task) => task.taskId === store.selectedTaskId()) ?? null),
  })),
  withMethods((store) => ({
    initialize(): void {
      store.repository.watchSelectedArea().pipe(take(1)).subscribe({ next: (areaId) => { if (areaId) { patchState(store, { selectedAreaId: areaId }); subscribeToArea(store, areaId); } }, error: () => patchState(store, { error: '無法載入上次選擇的地區' }) });
      store.clock.intervalId ??= setInterval(() => patchState(store, { now: Date.now() }), 30_000);
    },
    async selectArea(areaId: string): Promise<void> { patchState(store, { selectedAreaId: areaId, selectedTaskId: null, loading: true, error: null }); subscribeToArea(store, areaId); try { await store.repository.saveSelectedArea(areaId); } catch { patchState(store, { error: '無法保存任務地區，本次仍顯示所選地區' }); } },
    selectCadence(cadence: TaskCadence): void { patchState(store, { selectedCadence: cadence }); },
    selectTask(taskId: string): void { patchState(store, { selectedTaskId: taskId, location: null, error: null }); },
    refresh(): void { const areaId = store.selectedAreaId(); if (areaId) subscribeToArea(store, areaId); },
    async joinSelectedEvent(): Promise<void> { const task = findSelected(store); if (!task) return; patchState(store, { submitting: true, error: null }); try { await store.repository.joinEvent(task.taskId); } catch { patchState(store, { error: '無法參加活動，請稍後重試' }); } finally { patchState(store, { submitting: false }); } },
    async checkLocation(): Promise<void> { const task = findSelected(store); if (!task) return; patchState(store, { loading: true, error: null }); try { const location = store.sessionStore.isDemoMode() ? store.repository.demoLocationFor(task, store.demoLocationState()) : await store.locationService.getCurrentLocation(); patchState(store, { location: { ...location }, loading: false }); } catch (error) { patchState(store, { loading: false, error: messageFrom(error) }); } },
    useLocalTestLocation(): void { const task = findSelected(store); if (!task || !store.canUseLocalTestLocation()) return; patchState(store, { location: store.locationService.localTestLocationFor(task.destination), error: null }); },
    setDemoLocationState(state: DemoLocationState): void { patchState(store, { demoLocationState: state, location: null }); },
    distanceTo(task: TaskItem): number | null { const location = store.location(); return location ? calculateDistanceMeters(location, task.destination) : null; },
    canComplete(task: TaskItem): boolean { const location = store.location(); return !!location && location.accuracy <= 10 && calculateDistanceMeters(location, task.destination) <= 10 && task.endsAt.getTime() > store.now() && task.status !== 'completed' && (task.cadence !== 'event' || task.status === 'active'); },
    async completeSelectedTask(): Promise<void> { const task = findSelected(store); const location = store.location(); if (!task || !location) return; const currentAttempt = store.completionAttempt(); const attempt = currentAttempt?.taskId === task.taskId ? currentAttempt : { taskId: task.taskId, idempotencyKey: crypto.randomUUID() }; patchState(store, { submitting: true, error: null, completionAttempt: attempt }); try { const result = await store.repository.completeTask(task, location, attempt.idempotencyKey); store.progressStore.applyTaskInventory(result.inventory); patchState(store, { completionResult: result, completionAttempt: null }); } catch (error) { patchState(store, { error: messageFrom(error) }); } finally { patchState(store, { submitting: false }); } },
    dismissCompletionResult(): void { patchState(store, { completionResult: null }); },
  })),
  withHooks({ onDestroy(store) { store.subscriptions.tasks?.unsubscribe(); store.subscriptions.history?.unsubscribe(); if (store.clock.intervalId) clearInterval(store.clock.intervalId); } }),
);

function subscribeToArea(store: any, areaId: string): void { store.subscriptions.tasks?.unsubscribe(); store.subscriptions.history?.unsubscribe(); patchState(store, { loading: true, error: null }); store.subscriptions.tasks = store.repository.watchTasks(areaId).subscribe({ next: (tasks: TaskItem[]) => patchState(store, { tasks, loading: false }), error: () => patchState(store, { loading: false, error: '無法載入任務' }) }); store.subscriptions.history = store.repository.watchHistory(areaId).subscribe({ next: (history: TaskItem[]) => patchState(store, { history }), error: () => patchState(store, { error: '無法載入歷史任務' }) }); }
function findSelected(store: any): TaskItem | undefined { return [...store.tasks(), ...store.history()].find((item: TaskItem) => item.taskId === store.selectedTaskId()); }
function messageFrom(error: unknown): string { return error instanceof Error ? error.message : '操作失敗，請稍後重試'; }
