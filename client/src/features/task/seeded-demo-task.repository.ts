import { inject, Service } from '@angular/core';
import { ProgressStore } from '../../shared/stores/progress-store';
import { DEFAULT_TASK_STEPS, DEFAULT_TASK_RADIUS, freshTaskLocation, taskSteps } from '../../../../functions/src/task-domain';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { DemoLocationState, LocationEvidence, TaskCompletionResult, TaskItem } from './task.models';
import type { CmsTask } from '../../../../functions/src/cms-domain';

const destinations = {
  banqiaoStation: { id: 'banqiao-station-demo', name: '板橋車站站前廣場（暫定）', address: '新北市板橋區縣民大道二段', latitude: 25.0142, longitude: 121.4639 },
  banqiaoPark: { id: 'banqiao-park-demo', name: '新板萬坪都會公園（暫定）', address: '新北市板橋區文化路一段', latitude: 25.0124, longitude: 121.4615 },
  xihuStation: { id: 'xihu-station-demo', name: '西湖捷運站（暫定）', address: '台北市內湖區內湖路一段', latitude: 25.0822, longitude: 121.5672 },
  xihuPark: { id: 'xihu-park-demo', name: '西湖公園（暫定）', address: '台北市內湖區內湖路一段', latitude: 25.0807, longitude: 121.5711 },
} as const;

@Service()
export class SeededDemoTaskRepository {
  private readonly tasksSubject = new BehaviorSubject<TaskItem[]>(createDemoTasks());
  private readonly progress = inject(ProgressStore);

  setPublishedTasks(definitions: readonly CmsTask[], version = 0): void {
    const prior = new Map(this.tasksSubject.value.map(task => [task.taskId, task]));
    const active = definitions.filter(task => task.enabled).map(task => {
      const old = prior.get(task.id);
      if (old?.completedAt) return old;
      const next = demoTask(task.id, task.areaId, task.cadence, task.name, task.description,
        {id: task.id, name: task.destinationName, address: task.address, latitude: task.latitude, longitude: task.longitude},
        task.rewardAmount, Date.parse(task.startsAt), Date.parse(task.endsAt));
      next.cmsVersion = version;
      next.requiredSteps = task.requiredSteps ?? DEFAULT_TASK_STEPS[task.cadence];
      next.radiusMeters = task.radiusMeters ?? DEFAULT_TASK_RADIUS;
      next.reward.type = task.rewardType ?? (task.cadence === 'event' ? 'fertilizer' : 'waterDrops');
      if (old?.joinedAt) { next.joinedAt = old.joinedAt; next.joinedBaseline = old.joinedBaseline; next.status = 'active'; }
      if (old?.readyAt && old.cmsVersion === version) { next.readyAt = old.readyAt; next.status = 'ready'; }
      return next;
    });
    const ids = new Set(active.map(task => task.taskId));
    const history = this.tasksSubject.value.filter(task => task.completedAt && !ids.has(task.taskId));
    this.tasksSubject.next([...active, ...history]);
  }

  watchTasks(areaId: string): Observable<TaskItem[]> {
    return this.tasksSubject.pipe(map((tasks) => tasks.filter((task) => !areaId || task.areaId === areaId)));
  }

  watchHistory(areaId: string): Observable<TaskItem[]> {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.tasksSubject.pipe(map((tasks) => tasks.filter((task) =>
      (!areaId || task.areaId === areaId) && task.endsAt.getTime() >= cutoff &&
      (task.status === 'completed' || (task.endsAt.getTime() <= Date.now() && (task.cadence !== 'event' || task.joinedAt))),
    )));
  }

  joinEvent(taskId: string): Promise<void> {
    const task = this.tasksSubject.value.find(task => task.taskId === taskId);
    if (!task || task.cadence !== 'event' || task.startsAt.getTime() > Date.now() || task.endsAt.getTime() <= Date.now())
      return Promise.reject(new Error('活動尚未開始或已下架'));
    if (task.joinedAt) return Promise.resolve();
    this.updateTask(taskId, (task) => ({ ...task, status: 'active', joinedAt: new Date(), joinedBaseline: this.progress.totalTaskWalkingSteps() }));
    return Promise.resolve();
  }

  async qualifyTask(taskId: string, location: LocationEvidence): Promise<void> {
    const task = this.tasksSubject.value.find((candidate) => candidate.taskId === taskId);
    if (!task) throw new Error('找不到任務');
    if (task.readyAt || task.completedAt) return;
    if (task.startsAt.getTime() > Date.now()) throw new Error('任務尚未開始');
    if (task.endsAt.getTime() <= Date.now()) throw new Error('任務已過期');
    if (task.cadence === 'event' && task.status !== 'active') throw new Error('請先參加活動');
    if (!freshTaskLocation({ ...location, observedAt: location.observedAt.getTime() }, Date.now())) throw new Error('定位精確度不足或位置已過期');
    const steps = taskSteps({ cadence: task.cadence, startsAt: task.startsAt.getTime(), joinedBaseline: task.joinedBaseline }, this.progress.taskWalkingDays(), this.progress.totalTaskWalkingSteps(), Date.now());
    if (steps < (task.requiredSteps ?? DEFAULT_TASK_STEPS[task.cadence])) throw new Error('路線步數尚未達標');
    const distance = calculateDistanceMeters(location, task.destination);
    if (distance > (task.radiusMeters ?? DEFAULT_TASK_RADIUS)) throw new Error(`距目的地尚有 ${Math.ceil(distance)} 公尺`);
    this.updateTask(taskId, current => ({ ...current, status: 'ready', readyAt: new Date(), calculatedDistanceMeters: distance }));
  }

  async completeTask(taskId: string, _location?: LocationEvidence): Promise<TaskCompletionResult> {
    const task = this.tasksSubject.value.find(candidate => candidate.taskId === taskId);
    if (!task) throw new Error('找不到任務');
    if (task.completedAt) return this.resultFor(task);
    if (task.endsAt.getTime() <= Date.now()) throw new Error('任務已過期');
    if (!task.readyAt) throw new Error('任務尚未達標');
    this.progress.grantTaskReward(taskId, task.reward, task.destination.name);
    const completedAt = new Date();
    this.updateTask(taskId, (current) => ({ ...current, status: 'completed', completedAt }));
    return this.resultFor({ ...task, completedAt });
  }

  locationFor(task: TaskItem, state: DemoLocationState): LocationEvidence {
    if (state === 'poor-accuracy') return { ...task.destination, accuracy: 25, observedAt: new Date() };
    if (state === 'eligible') return { ...task.destination, accuracy: 5, observedAt: new Date() };
    return { latitude: task.destination.latitude + 0.001, longitude: task.destination.longitude, accuracy: 5, observedAt: new Date() };
  }

  private updateTask(taskId: string, update: (task: TaskItem) => TaskItem): void {
    this.tasksSubject.next(this.tasksSubject.value.map((task) => task.taskId === taskId ? update(task) : task));
  }

  private resultFor(task: TaskItem): TaskCompletionResult {
    return { taskId: task.taskId, completedAt: task.completedAt ?? new Date(), reward: task.reward, inventory: { ...this.progress.inventory() } };
  }
}

function createDemoTasks(): TaskItem[] {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  return [
    demoTask('banqiao-daily-1', 'banqiao', 'daily', '下班補水站', '前往板橋車站，為大樹帶回水滴。', destinations.banqiaoStation, 1, now - hour, now + 6 * hour),
    demoTask('banqiao-daily-2', 'banqiao', 'daily', '公園散步補給', '走到都會公園完成今日補給。', destinations.banqiaoPark, 1, now - hour, now + 9 * hour),
    demoTask('banqiao-weekly-1', 'banqiao', 'weekly', '本週城市綠洲', '本週造訪板橋公共綠地。', destinations.banqiaoPark, 3, now - day, now + 4 * day),
    demoTask('banqiao-event-1', 'banqiao', 'event', '板橋綠行活動', '參加活動並抵達指定地點取得肥料。', destinations.banqiaoStation, 1, now - day, now + 7 * day),
    demoTask('xihu-daily-1', 'xihu', 'daily', '西湖每日補水', '前往西湖捷運站完成今日任務。', destinations.xihuStation, 1, now - hour, now + 7 * hour),
    demoTask('xihu-weekly-1', 'xihu', 'weekly', '西湖公園週任務', '本週造訪西湖公園。', destinations.xihuPark, 3, now - day, now + 5 * day),
    demoTask('xihu-event-1', 'xihu', 'event', '內湖綠色生活節', '參加活動並前往指定公園。', destinations.xihuPark, 1, now - day, now + 8 * day),
  ];
}

function demoTask(taskId: string, areaId: string, cadence: TaskItem['cadence'], title: string, description: string, destination: TaskItem['destination'], amount: number, startsAt: number, endsAt: number): TaskItem {
  return { taskId, areaId, cadence, title, description, destination, requiredSteps: DEFAULT_TASK_STEPS[cadence], radiusMeters: DEFAULT_TASK_RADIUS, startsAt: new Date(startsAt), endsAt: new Date(endsAt), reward: { type: cadence === 'event' ? 'fertilizer' : 'waterDrops', amount }, status: cadence === 'event' ? 'available' : 'active' };
}

export function calculateDistanceMeters(a: Pick<LocationEvidence, 'latitude' | 'longitude'>, b: Pick<LocationEvidence, 'latitude' | 'longitude'>): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadius = 6_371_000;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
