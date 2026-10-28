import { effect, inject, Service } from '@angular/core';
import { CMS_CONNECTION } from '../../shared/models/cms-publication';
import { Observable, of } from 'rxjs';
import { SessionStore } from '../../shared/stores/session-store';
import { DemoLocationState, LocationEvidence, TaskCompletionResult, TaskItem } from './task.models';
import { FirebaseTaskRepository } from './firebase-task.repository';
import { SeededDemoTaskRepository } from './seeded-demo-task.repository';

@Service()
export class TaskRepository {
  private readonly sessionStore = inject(SessionStore);
  private readonly demo = inject(SeededDemoTaskRepository);
  private readonly firebase = inject(FirebaseTaskRepository);
  private demoAreaId: string | undefined;

  constructor() {
    const cms = inject(CMS_CONNECTION, {optional: true});
    if (cms) effect(() => {
      if (this.sessionStore.isDemoMode() && cms.managed())
        this.demo.setPublishedTasks(cms.config()?.tasks ?? [], cms.release()?.version ?? 0);
    });
  }

  watchTasks(areaId: string): Observable<TaskItem[]> {
    return this.sessionStore.isDemoMode() ? this.demo.watchTasks(areaId) : this.firebase.watchTasks(areaId);
  }

  watchHistory(areaId: string): Observable<TaskItem[]> {
    return this.sessionStore.isDemoMode() ? this.demo.watchHistory(areaId) : this.firebase.watchHistory(areaId);
  }

  joinEvent(taskId: string): Promise<void> {
    return this.sessionStore.isDemoMode() ? this.demo.joinEvent(taskId) : this.firebase.joinEvent(taskId);
  }

  async qualifyTask(task: TaskItem, location: LocationEvidence): Promise<void> {
    if (this.sessionStore.isDemoMode()) await this.demo.qualifyTask(task.taskId, location);
    else await this.firebase.qualifyTask(task, location);
  }

  completeTask(task: TaskItem, location: LocationEvidence | null, idempotencyKey: string): Promise<TaskCompletionResult> {
    return this.sessionStore.isDemoMode()
      ? this.demo.completeTask(task.taskId)
      : this.firebase.completeTask(task.taskId, location, idempotencyKey, false, task.cmsVersion);
  }

  watchSelectedArea(): Observable<string | undefined> {
    return this.sessionStore.isDemoMode() ? of(this.demoAreaId) : this.firebase.watchSelectedArea();
  }

  async saveSelectedArea(areaId: string): Promise<void> {
    if (this.sessionStore.isDemoMode()) {
      this.demoAreaId = areaId;
      return;
    }
    await this.firebase.saveSelectedArea(areaId);
  }

  demoLocationFor(task: TaskItem, state: DemoLocationState): LocationEvidence {
    return this.demo.locationFor(task, state);
  }
}
