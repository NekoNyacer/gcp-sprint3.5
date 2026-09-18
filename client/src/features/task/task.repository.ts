import { inject, Service } from '@angular/core';
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

  watchTasks(areaId: string): Observable<TaskItem[]> {
    return this.sessionStore.isDemoMode() ? this.demo.watchTasks(areaId) : this.firebase.watchTasks(areaId);
  }

  watchHistory(areaId: string): Observable<TaskItem[]> {
    return this.sessionStore.isDemoMode() ? this.demo.watchHistory(areaId) : this.firebase.watchHistory(areaId);
  }

  joinEvent(taskId: string): Promise<void> {
    return this.sessionStore.isDemoMode() ? this.demo.joinEvent(taskId) : this.firebase.joinEvent(taskId);
  }

  completeTask(task: TaskItem, location: LocationEvidence, idempotencyKey: string): Promise<TaskCompletionResult> {
    return this.sessionStore.isDemoMode()
      ? this.demo.completeTask(task.taskId, location)
      : this.firebase.completeTask(task.taskId, location, idempotencyKey, false);
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
