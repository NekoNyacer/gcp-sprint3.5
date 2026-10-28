import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonModal } from '@ionic/angular';
import { TaskStore } from './task-store';
import { taskRewardLabel } from './task.models';

@Component({
  selector: 'app-task-reward-dialog',
  imports: [IonModal, DatePipe],
  template: ` <ion-modal
      class="task-reward-modal"
      [isOpen]="!!store.claimTask()"
      [backdropDismiss]="!store.submitting()"
      (didDismiss)="store.dismissClaim()"
    >
      <ng-template>
        @if (store.claimTask(); as task) {
          <div class="reward-dialog">
            <div class="symbol" aria-hidden="true">!</div>
            <h2>待領取獎勵</h2>
            <span class="deadline">{{ remaining(task.endsAt) }}</span>
            <p>點擊完成任務，獎勵才會加入你的資源庫。</p>
            <dl>
              <div>
                <dt>活動名稱</dt>
                <dd>{{ task.title }}</dd>
              </div>
              <div>
                <dt>達標時間</dt>
                <dd>{{ task.readyAt | date: 'yyyy/MM/dd HH:mm' : '+0800' }}</dd>
              </div>
              <div>
                <dt>完成獎勵</dt>
                <dd class="earned">{{ rewardLabel(task) }}</dd>
              </div>
            </dl>
            @if (store.error()) {
              <p class="error" role="alert">{{ store.error() }}</p>
            }
            @if (store.status(task) === 'expired') {
              <p class="error" role="alert">任務已截止，無法領取獎勵。</p>
            }
            <div class="actions">
              <button
                class="secondary"
                [disabled]="store.submitting()"
                (click)="store.dismissClaim()"
              >
                返回
              </button>
              <button
                class="primary"
                [disabled]="store.submitting() || !store.canComplete(task)"
                (click)="store.completeSelectedTask()"
              >
                {{ store.submitting() ? '領取中…' : '完成任務' }}
              </button>
            </div>
          </div>
        }
      </ng-template>
    </ion-modal>
    <ion-modal
      class="task-reward-modal"
      [isOpen]="!!store.completionResult()"
      (didDismiss)="store.dismissCompletionResult()"
    >
      <ng-template
        ><div class="reward-dialog">
          <div class="symbol success" aria-hidden="true">✓</div>
          <h2>獎勵已領取</h2>
          @if (store.completionResult(); as result) {
            <p>{{ rewardLabel(result) }} 已加入資源庫</p>
          }
          <button class="primary wide" (click)="store.dismissCompletionResult()">太棒了！</button>
        </div></ng-template
      >
    </ion-modal>`,
  styles: [
    `
      .reward-dialog {
        padding: 24px 18px 18px;
        background: white;
        text-align: center;
        color: #252525;
        max-height: 85dvh;
        overflow: auto;
        font-size: 12px;
      }
      .symbol {
        margin: 0 auto 8px;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: #fff4e8;
        color: #f56a10;
        display: grid;
        place-items: center;
        font-size: 22px;
      }
      .success {
        color: #637d2b;
        background: #f2f5e9;
      }
      h2 {
        font-size: 19px;
        margin: 0 0 6px;
        font-weight: 700;
      }
      .deadline {
        color: #f56a10;
        background: #fff4e8;
        border-radius: 12px;
        padding: 3px 8px;
        font-size: 11px;
      }
      p {
        color: #888;
        line-height: 1.6;
        margin: 14px 0;
      }
      dl {
        border: 1px solid #eee;
        border-radius: 6px;
        padding: 10px;
        margin: 16px 0;
      }
      dl > div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        line-height: 1.8;
      }
      dt {
        color: #888;
        white-space: nowrap;
      }
      dd {
        margin: 0;
        text-align: right;
        overflow-wrap: anywhere;
      }
      .earned {
        color: #627d26;
        font-weight: 700;
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      button {
        border: 0;
        border-radius: 6px;
        min-height: 40px;
        padding: 10px 12px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .primary {
        background: #f56a10;
        color: #fff;
      }
      .secondary {
        background: #f4f4f4;
        color: #777;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .error {
        color: #b63824;
      }
      .wide {
        width: 100%;
      }
    `,
  ],
})
export class TaskRewardDialogComponent {
  readonly store = inject(TaskStore);
  readonly rewardLabel = taskRewardLabel;
  remaining(end: Date): string {
    const hours = Math.max(0, Math.ceil((end.getTime() - this.store.now()) / 3600_000));
    return hours < 24 ? `剩 ${hours} 小時` : `剩 ${Math.ceil(hours / 24)} 天`;
  }
}
