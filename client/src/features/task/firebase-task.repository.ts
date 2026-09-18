import { inject, Service } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { collection, collectionData, doc, docData, Firestore, query, serverTimestamp, setDoc, where } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { combineLatest, map, Observable, of } from 'rxjs';
import { LocationEvidence, TaskCompletionResult, TaskItem } from './task.models';

type DateLike = Date | { toDate(): Date };
type TaskDocument = Omit<TaskItem, 'taskId' | 'startsAt' | 'endsAt' | 'status'> & { startsAt: DateLike; endsAt: DateLike };
type UserTaskDocument = { taskId: string; joinedAt?: DateLike; completedAt?: DateLike; calculatedDistanceMeters?: number };

@Service()
export class FirebaseTaskRepository {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly functions = inject(Functions);

  watchTasks(areaId: string): Observable<TaskItem[]> {
    const user = this.auth.currentUser;
    const taskQuery = query(collection(this.firestore, 'tasks'), where('areaId', '==', areaId));
    if (!user) return of([]);
    return combineLatest([
      collectionData(taskQuery, { idField: 'taskId' }),
      collectionData(collection(this.firestore, 'users', user.uid, 'taskEnrollments')),
      collectionData(collection(this.firestore, 'users', user.uid, 'taskCompletions')),
    ]).pipe(map(([tasks, enrollments, completions]) => mergeUserState(
      tasks as Array<TaskDocument & { taskId: string }>,
      enrollments as UserTaskDocument[],
      completions as UserTaskDocument[],
    )));
  }

  watchHistory(areaId: string): Observable<TaskItem[]> {
    return this.watchTasks(areaId).pipe(map((tasks) => {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return tasks.filter((task) => task.endsAt.getTime() >= cutoff &&
        (task.status === 'completed' || task.status === 'expired') &&
        !(task.cadence === 'event' && !task.joinedAt));
    }));
  }

  async joinEvent(taskId: string): Promise<void> {
    const user = this.requireUser();
    await setDoc(doc(this.firestore, 'users', user.uid, 'taskEnrollments', taskId), {
      taskId,
      joinedAt: serverTimestamp(),
    });
  }

  async completeTask(taskId: string, location: LocationEvidence, idempotencyKey: string, isDemo: boolean): Promise<TaskCompletionResult> {
    const callable = httpsCallable<unknown, {
      taskId: string;
      completedAt: string;
      reward: TaskCompletionResult['reward'];
      inventory: TaskCompletionResult['inventory'];
    }>(this.functions, 'completeTask');
    const response = await callable({ taskId, location: { ...location, observedAt: location.observedAt.toISOString() }, idempotencyKey, isDemo });
    return { ...response.data, completedAt: new Date(response.data.completedAt) };
  }

  watchSelectedArea(): Observable<string | undefined> {
    const user = this.auth.currentUser;
    if (!user) return of(undefined);
    return docData(doc(this.firestore, 'users', user.uid)).pipe(map((profile) => profile?.['taskAreaId'] as string | undefined));
  }

  async saveSelectedArea(areaId: string): Promise<void> {
    const user = this.requireUser();
    await setDoc(doc(this.firestore, 'users', user.uid), { taskAreaId: areaId, updatedAt: serverTimestamp() }, { merge: true });
  }

  private requireUser() {
    if (!this.auth.currentUser) throw new Error('必須先登入才能操作任務');
    return this.auth.currentUser;
  }
}

function mergeUserState(tasks: Array<TaskDocument & { taskId: string }>, enrollments: UserTaskDocument[], completions: UserTaskDocument[]): TaskItem[] {
  const enrollmentByTask = new Map(enrollments.map((item) => [item.taskId, item]));
  const completionByTask = new Map(completions.map((item) => [item.taskId, item]));
  const now = Date.now();
  return tasks.map((task) => {
    const enrollment = enrollmentByTask.get(task.taskId);
    const completion = completionByTask.get(task.taskId);
    const startsAt = toDate(task.startsAt);
    const endsAt = toDate(task.endsAt);
    const status = completion ? 'completed' : endsAt.getTime() <= now ? 'expired' : task.cadence === 'event' && !enrollment ? 'available' : 'active';
    return {
      ...task,
      startsAt,
      endsAt,
      status,
      joinedAt: enrollment?.joinedAt ? toDate(enrollment.joinedAt) : undefined,
      completedAt: completion?.completedAt ? toDate(completion.completedAt) : undefined,
      calculatedDistanceMeters: completion?.calculatedDistanceMeters,
    };
  });
}

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : value.toDate();
}

