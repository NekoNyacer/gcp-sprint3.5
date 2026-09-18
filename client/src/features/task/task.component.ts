import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonContent, IonHeader, IonLabel, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonSpinner } from '@ionic/angular';
import { TaskCadence, TaskItem } from './task.models';
import { TaskStore } from './task-store';

@Component({
  selector: 'app-task', templateUrl: './task.component.html', styleUrls: ['./task.component.scss'],
  imports: [IonContent, IonHeader, IonButton, IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonBadge, IonChip, IonSpinner, IonRefresher, IonRefresherContent],
})
export class TaskComponent implements OnInit {
  readonly store = inject(TaskStore);
  private readonly router = inject(Router);
  readonly showHistory = signal(false);

  ngOnInit(): void { this.store.initialize(); }
  selectCadence(event: Event): void { const value = (event as CustomEvent<{ value?: string }>).detail.value; if (value === 'daily' || value === 'weekly' || value === 'event') this.store.selectCadence(value); }
  openTask(task: TaskItem): void { this.store.selectTask(task.taskId); void this.router.navigate(['/task', task.taskId]); }
  selectArea(event: Event): void { const value = (event.target as HTMLSelectElement).value; if (value) void this.store.selectArea(value); }
  refresh(event: Event): void { this.store.refresh(); setTimeout(() => (event as CustomEvent).detail.complete(), 400); }
  cadenceLabel(cadence: TaskCadence): string { return cadence === 'daily' ? '每日' : cadence === 'weekly' ? '每週' : '活動'; }
  rewardLabel(task: TaskItem): string { return `${task.reward.type === 'waterDrops' ? '水滴' : '肥料'} × ${task.reward.amount}`; }
  remaining(task: TaskItem): string { const ms = task.endsAt.getTime() - this.store.now(); if (ms <= 0) return '已到期'; const hours = Math.ceil(ms / 3_600_000); return hours < 24 ? `剩餘 ${hours} 小時` : `剩餘 ${Math.ceil(hours / 24)} 天`; }
  isExpiring(task: TaskItem): boolean { const hours = (task.endsAt.getTime() - this.store.now()) / 3_600_000; return hours > 0 && hours <= (task.cadence === 'daily' ? 2 : 24); }
}
