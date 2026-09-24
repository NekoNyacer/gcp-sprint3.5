import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPopover,
  IonProgressBar,
  IonRow,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { ShopStore } from './shop-store';
import {
  CharityCampaign,
  RedemptionOption,
  RedemptionTransaction,
  transactionStatusLabel,
  transactionSummary,
  transactionTitle,
} from './shop-view.models';
import { TransactionDetailDialogComponent } from './transaction-detail-dialog.component';

type ActionDialog =
  | { kind: 'points'; option: RedemptionOption }
  | { kind: 'charity'; campaign: CharityCampaign }
  | { kind: 'insufficient'; title: string; requiredTrees: number }
  | { kind: 'points-unavailable' };

interface ResultDialog {
  success: boolean;
  kind: 'points' | 'charity';
  title: string;
  amountLabel: string;
  beforeTrees: number;
  afterTrees: number;
  beforePoints: number | null;
  afterPoints: number | null;
}

@Component({
  selector: 'app-shop',
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.scss'],
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    IonBadge,
    IonButton,
    IonButtons,
    IonChip,
    IonCol,
    IonContent,
    IonGrid,
    IonImg,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonPopover,
    IonProgressBar,
    IonRow,
    IonSpinner,
    IonTitle,
    IonToolbar,
    TransactionDetailDialogComponent,
  ],
})
export class ShopComponent implements OnInit, OnDestroy {
  private readonly store = inject(ShopStore);
  private infoTimer: ReturnType<typeof setTimeout> | null = null;

  readonly dashboard = computed(() => {
    if (this.store.loadStatus() !== 'loaded') return null;
    const expiry = this.store.expirySummary();
    return {
      treePointsBalance: this.store.treePointsBalance(),
      availableMatureTrees: this.store.availableMatureTrees(),
      expiringMatureTrees: expiry?.count ?? 0,
      nearestExpiryDate: expiry?.expiresAt ?? null,
      lifetimeMatureTrees: this.store.lifetimeMatureTrees(),
    };
  });
  readonly options = this.store.redemptionOptions;
  readonly charity = this.store.charityCampaign;
  readonly recentTransactions = this.store.recentTransactions;
  readonly isLoading = computed(() => this.store.loadStatus() === 'loading');
  readonly isSubmitting = this.store.isSubmitting;
  readonly error = this.store.loadError;
  readonly commandError = this.store.commandError;
  readonly pointsError = this.store.pointsError;

  readonly actionDialog = signal<ActionDialog | null>(null);
  readonly resultDialog = signal<ResultDialog | null>(null);
  readonly selectedTransaction = signal<RedemptionTransaction | null>(null);
  readonly showPointsInfo = signal(false);
  readonly pointsInfoEvent = signal<Event | undefined>(undefined);

  readonly availableTrees = computed(() => this.dashboard()?.availableMatureTrees ?? 0);
  readonly pointsBalance = computed(() => {
    if (this.pointsError()) {
      return null;
    }
    return this.dashboard()?.treePointsBalance ?? null;
  });
  readonly pageUnavailable = computed(
    () => !this.isLoading() && !this.dashboard() && !!this.error(),
  );
  readonly nextMilestone = computed(() => {
    return this.store.milestoneProgress().nextMilestone ?? 1_000;
  });
  readonly milestoneProgress = computed(() => {
    return Math.round(this.store.milestoneProgress().progressPercent);
  });
  readonly nextMilestoneName = computed(() => this.milestoneName(this.nextMilestone()));
  readonly expiryUrgency = computed<'normal' | 'soon' | 'urgent' | 'critical'>(() => {
    const value = this.dashboard()?.nearestExpiryDate;
    if (!value) {
      return 'normal';
    }
    const milliseconds = new Date(value).getTime() - Date.now();
    const days = Math.ceil(milliseconds / 86_400_000);
    if (days <= 7) return 'critical';
    if (days <= 30) return 'urgent';
    if (days <= 90) return 'soon';
    return 'normal';
  });
  readonly expiryDays = computed(() => {
    const value = this.dashboard()?.nearestExpiryDate;
    if (!value) return null;
    return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
  });

  ngOnInit(): void {
    void this.store.load();
  }

  ngOnDestroy(): void {
    if (this.infoTimer) {
      clearTimeout(this.infoTimer);
    }
  }

  @HostListener('document:keydown.escape')
  closeTopDialog(): void {
    if (this.selectedTransaction()) {
      this.selectedTransaction.set(null);
    } else if (this.resultDialog()) {
      this.resultDialog.set(null);
    } else if (this.actionDialog()) {
      this.actionDialog.set(null);
    }
  }

  reload(): void {
    void this.store.reload();
  }

  showPointsHint(event: Event): void {
    if (this.infoTimer) {
      clearTimeout(this.infoTimer);
    }
    this.pointsInfoEvent.set(event);
    this.showPointsInfo.set(true);
    this.infoTimer = setTimeout(() => {
      this.showPointsInfo.set(false);
      this.infoTimer = null;
    }, 5_000);
  }

  closePointsHint(): void {
    this.showPointsInfo.set(false);
    this.pointsInfoEvent.set(undefined);
    if (this.infoTimer) {
      clearTimeout(this.infoTimer);
      this.infoTimer = null;
    }
  }

  selectOption(option: RedemptionOption): void {
    if (this.availableTrees() < option.requiredTrees) {
      this.actionDialog.set({
        kind: 'insufficient',
        title: `兌換小樹點${option.treePoints}點`,
        requiredTrees: option.requiredTrees,
      });
      return;
    }
    if (this.pointsError()) {
      this.actionDialog.set({ kind: 'points-unavailable' });
      return;
    }
    this.actionDialog.set({ kind: 'points', option });
  }

  selectCharity(campaign: CharityCampaign): void {
    if (this.availableTrees() < campaign.requiredTrees) {
      this.actionDialog.set({
        kind: 'insufficient',
        title: '投入生態公益',
        requiredTrees: campaign.requiredTrees,
      });
      return;
    }
    this.actionDialog.set({ kind: 'charity', campaign });
  }

  closeActionDialog(): void {
    if (!this.isSubmitting()) {
      this.actionDialog.set(null);
    }
  }

  async confirmAction(): Promise<void> {
    const action = this.actionDialog();
    const dashboard = this.dashboard();
    if (!action || !dashboard || (action.kind !== 'points' && action.kind !== 'charity')) {
      return;
    }

    const beforeTrees = dashboard.availableMatureTrees;
    const beforePoints = dashboard.treePointsBalance;

    try {
      const commandResult =
        action.kind === 'points'
          ? await this.store.redeemTreePoints(action.option.id)
          : await this.store.donateToCharity();
      const failed = !commandResult?.success || !!this.store.commandError();
      const updated = this.dashboard();
      this.resultDialog.set({
        success: !failed,
        kind: action.kind,
        title: failed
          ? action.kind === 'points'
            ? '兌換失敗'
            : '投入失敗'
          : action.kind === 'points'
            ? '兌換成功'
            : '投入成功',
        amountLabel:
          action.kind === 'points'
            ? `${action.option.treePoints}點小樹點`
            : `NT$${action.campaign.totalAmount}公益投入`,
        beforeTrees,
        afterTrees: updated?.availableMatureTrees ?? beforeTrees,
        beforePoints,
        afterPoints: updated?.treePointsBalance ?? beforePoints,
      });
    } catch {
      this.resultDialog.set({
        success: false,
        kind: action.kind,
        title: action.kind === 'points' ? '兌換未送出' : '公益投入未送出',
        amountLabel:
          action.kind === 'points'
            ? `${action.option.treePoints}點小樹點`
            : `NT$${action.campaign.totalAmount}公益投入`,
        beforeTrees,
        afterTrees: beforeTrees,
        beforePoints,
        afterPoints: beforePoints,
      });
    } finally {
      this.actionDialog.set(null);
    }
  }

  remainingTrees(requiredTrees: number): number {
    return Math.max(0, requiredTrees - this.availableTrees());
  }

  remainingMilestoneTrees(lifetimeMatureTrees: number): number {
    return Math.max(0, this.nextMilestone() - lifetimeMatureTrees);
  }

  transactionTitle(transaction: RedemptionTransaction): string {
    return transactionTitle(transaction);
  }

  transactionSummary(transaction: RedemptionTransaction): string {
    return transactionSummary(transaction);
  }

  transactionStatus(transaction: RedemptionTransaction): string {
    return transactionStatusLabel(transaction);
  }

  private milestoneName(milestone: number): string {
    const names: Record<number, string> = {
      10: '初次成林',
      50: '森林新芽',
      100: '百樹夥伴',
      200: '森林守護者',
      500: '生態行動家',
      1_000: '千樹里程碑',
    };
    return names[milestone] ?? `${milestone}棵里程碑`;
  }
}
