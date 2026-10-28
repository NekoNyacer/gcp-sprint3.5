import {
  afterRenderEffect,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { taskRewardLabel } from './task.models';
import { TaskStore } from './task-store';
import { TaskMapService } from './task-map.service';

@Component({
  selector: 'app-task-detail',
  templateUrl: './task-detail.component.html',
  styleUrls: ['./task-detail.component.scss'],
  imports: [DecimalPipe, IonContent, IonSpinner],
})
export class TaskDetailComponent implements OnDestroy {
  readonly store = inject(TaskStore);
  readonly map = inject(TaskMapService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly active = signal(false);
  private attached?: HTMLElement;
  readonly rewardLabel = taskRewardLabel;
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('taskId');
      if (id) this.store.selectTask(id);
    });
    afterRenderEffect(() => {
      const task = this.store.selectedTask();
      const position = this.store.location();
      const element = this.container()?.nativeElement;
      if (!this.active() || !element) return;
      if (this.attached !== element) {
        this.map.attach(element);
        this.attached = element;
      }
      this.map.update(task, position);
    });
  }
  ionViewDidEnter(): void {
    this.active.set(true);
  }
  ionViewWillLeave(): void {
    this.active.set(false);
    if (this.attached) this.map.detach(this.attached);
    this.attached = undefined;
  }
  ngOnDestroy(): void {
    if (this.attached) this.map.detach(this.attached);
  }
  retryMap(): void {
    const el = this.container()?.nativeElement;
    if (el) this.map.retry(el);
  }
  goHome(): void {
    void this.router.navigateByUrl('/home');
  }
  remaining(end: Date): string {
    const hours = Math.max(0, Math.ceil((end.getTime() - this.store.now()) / 3600_000));
    return hours < 24 ? `剩 ${hours} 小時` : `剩 ${Math.ceil(hours / 24)} 天`;
  }
}
