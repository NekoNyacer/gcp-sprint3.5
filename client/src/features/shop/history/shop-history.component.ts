import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { ShopStore } from '../shop-store';
import { ShopTransaction } from '../shop.models';
import { transactionStatusLabel, transactionSummary, transactionTitle } from '../shop-view.models';
import { TransactionDetailDialogComponent } from '../transaction-detail-dialog.component';

@Component({
  selector: 'app-shop-history',
  templateUrl: './shop-history.component.html',
  styleUrls: ['./shop-history.component.scss'],
  imports: [
    DatePipe,
    RouterLink,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonImg,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonTitle,
    IonToolbar,
    TransactionDetailDialogComponent,
  ],
})
export class ShopHistoryComponent implements OnInit {
  private readonly store = inject(ShopStore);

  readonly transactions = computed(() =>
    [...this.store.transactions()].sort((left, right) =>
      right.occurredAt.localeCompare(left.occurredAt),
    ),
  );
  readonly isLoading = computed(() => this.store.loadStatus() === 'loading');
  readonly error = this.store.loadError;
  readonly selectedTransaction = signal<ShopTransaction | null>(null);

  ngOnInit(): void {
    void this.store.load();
  }

  reload(): void {
    void this.store.reload();
  }

  title(transaction: ShopTransaction): string {
    return transactionTitle(transaction);
  }

  summary(transaction: ShopTransaction): string {
    return transactionSummary(transaction);
  }

  status(transaction: ShopTransaction): string {
    return transactionStatusLabel(transaction);
  }
}
