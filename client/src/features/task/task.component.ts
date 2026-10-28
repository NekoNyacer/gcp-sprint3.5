import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { TaskItem, TaskRewardType, TaskStatus, taskRewardLabel } from './task.models';
import { TaskStore } from './task-store';

@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.scss'],
  imports: [IonContent, IonSpinner, DecimalPipe],
})
export class TaskComponent {
  readonly store = inject(TaskStore);
  private readonly router = inject(Router);
  readonly showHistory = signal(false);
  readonly rewardLabel = taskRewardLabel;
  openTask(task: TaskItem): void {
    if (this.store.canComplete(task)) this.store.openClaim(task);
    else {
      this.store.selectTask(task.taskId);
      void this.router.navigate(['/task', task.taskId]);
    }
  }
  selectArea(event: Event): void {
    void this.store.selectArea((event.target as HTMLSelectElement).value);
  }
  selectReward(event: Event): void {
    this.store.selectReward((event.target as HTMLSelectElement).value as TaskRewardType | '');
  }
  selectStatus(event: Event): void {
    this.store.selectStatus((event.target as HTMLSelectElement).value as TaskStatus | '');
  }
  remaining(task: TaskItem): string {
    const hours = Math.max(0, Math.ceil((task.endsAt.getTime() - this.store.now()) / 3600_000));
    return hours === 0
      ? '已截止'
      : hours < 24
        ? `剩 ${hours} 小時`
        : `剩 ${Math.ceil(hours / 24)} 天`;
  }
  statusLabel(task: TaskItem): string {
    return {
      available: '未參加',
      active: '進行中',
      ready: '待領取獎勵',
      completed: '已領取',
      expired: '已截止',
    }[this.store.status(task)];
  }
}
