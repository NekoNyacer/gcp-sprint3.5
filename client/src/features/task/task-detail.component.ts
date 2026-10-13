import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonModal, IonSpinner } from '@ionic/angular';
import { DemoLocationState, TaskItem } from './task.models';
import { TaskStore } from './task-store';

@Component({ selector: 'app-task-detail', templateUrl: './task-detail.component.html', styleUrls: ['./task-detail.component.scss'], imports: [DecimalPipe, IonContent, IonButton, IonBadge, IonSpinner, IonModal] })
export class TaskDetailComponent implements OnInit {
  readonly store = inject(TaskStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void { this.store.initialize(); const id = this.route.snapshot.paramMap.get('taskId'); if (id) this.store.selectTask(id); }
  back(): void { void this.router.navigateByUrl('/task'); }
  rewardLabel(task: TaskItem): string { return `${task.reward.type === 'waterDrops' ? '水滴' : '肥料'} × ${task.reward.amount}`; }
  remaining(task: TaskItem): string { const hours = Math.max(0, Math.ceil((task.endsAt.getTime() - this.store.now()) / 3_600_000)); return hours < 24 ? `${hours} 小時` : `${Math.ceil(hours / 24)} 天`; }
  distance(task: TaskItem): string { const value = this.store.distanceTo(task); return value === null ? '尚未取得位置' : `${Math.ceil(value)} 公尺`; }
  setDemoState(event: Event): void { this.store.setDemoLocationState((event.target as HTMLSelectElement).value as DemoLocationState); }
}
