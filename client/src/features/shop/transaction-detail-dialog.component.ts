import { Component, HostListener, computed, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  RedemptionTransaction,
  transactionStatusLabel,
  transactionTitle,
} from './shop-view.models';

@Component({
  selector: 'app-transaction-detail-dialog',
  templateUrl: './transaction-detail-dialog.component.html',
  styleUrls: ['./transaction-detail-dialog.component.scss'],
  imports: [
    DatePipe,
    DecimalPipe,
    IonBadge,
    IonButton,
    IonButtons,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonTitle,
    IonToolbar,
  ],
})
export class TransactionDetailDialogComponent {
  readonly transaction = input.required<RedemptionTransaction>();
  readonly closed = output<void>();

  readonly title = computed(() => transactionTitle(this.transaction()));
  readonly status = computed(() => transactionStatusLabel(this.transaction()));
  readonly isExpired = computed(() => this.transaction().type === 'ENTITLEMENT_EXPIRED');
  readonly isFailed = computed(() => this.transaction().status === 'FAILED');

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }
}
