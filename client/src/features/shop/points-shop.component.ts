import { Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, IonModal, IonSpinner } from '@ionic/angular';
import { CMS_CONNECTION } from '../../shared/models/cms-publication';
import { SessionStore } from '../../shared/stores/session-store';
import { ShopStore } from './shop-store';
import { ProgressStore } from '../../shared/stores/progress-store';
import type { ShopCommandResult, ShopSnapshot } from './shop.models';
import type { Reward } from '../../../../functions/src/cms-domain';

const offlineRewards: Reward[] = [
  {
    id: 'demo-drink',
    name: '飲品折抵券',
    kind: 'PRODUCT',
    requiredPoints: 30,
    costNtd: 30,
    enabled: true,
  },
  {
    id: 'demo-green-transport',
    name: '綠色交通折抵券',
    kind: 'PRODUCT',
    requiredPoints: 50,
    costNtd: 50,
    enabled: true,
  },
  {
    id: 'CHARITY_2026_Q4',
    name: '台灣動植物保育計畫',
    kind: 'CHARITY',
    requiredPoints: 50,
    costNtd: 100,
    enabled: true,
  },
];

const rewardImages: Record<string, string> = {
  'CHARITY:台灣動植物保育計畫': '/images/rewards/taiwan-conservation.webp',
  'PRODUCT:飲品折抵券': '/images/rewards/refreshing-drink.webp',
  'PRODUCT:綠色交通折抵券': '/images/rewards/green-transport.webp',
};

@Component({
  selector: 'app-points-shop',
  imports: [IonContent, IonButton, IonModal, IonSpinner, DecimalPipe, DatePipe, RouterLink],
  templateUrl: './points-shop.component.html',
  styleUrl: './points-shop.component.scss',
  host: { '(window:resize)': 'updateWalletSummary()' },
})

export class PointsShopComponent {
  rewardImage(reward: Reward | null | undefined): string | null {
    return reward ? rewardImages[`${reward.kind}:${reward.name}`] ?? null : null;
  }

  readonly cms = inject(CMS_CONNECTION, { optional: true });
  readonly session = inject(SessionStore);
  private readonly shop = inject(ShopStore);
  private readonly progress = inject(ProgressStore);
  private offlineEarned = 0;
  readonly snapshot = signal<ShopSnapshot | null>(null);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly resetRequested = signal(false);
  readonly result = signal<{ points: number; transaction: import('./shop.models').ShopTransaction | null; balance: number } | null>(null);
  readonly products = computed(() => this.rewards().filter(r => r.kind === 'PRODUCT'));
  readonly charities = computed(() => this.rewards().filter(r => r.kind === 'CHARITY'));
  readonly availableVouchers = computed(() => this.snapshot()?.entitlements.filter(e => e.status === 'AVAILABLE').length ?? 0);
  readonly selected = signal<{ reward: Reward; version: number; requestId: string } | null>(null);
  readonly balance = computed(() => this.snapshot()?.treePointsBalance ?? null);
  readonly walletSummaryVisible = signal(false);
  private readonly walletCard = viewChild<ElementRef<HTMLElement>>('walletCard');
  readonly rewards = computed(() =>
    this.cms?.managed()
      ? (this.cms.config()?.rewards ?? []).filter((r) => r.enabled)
      : this.session.isDemoMode()
        ? offlineRewards
        : [],
  );
  private generation = 0;
  constructor() {
    effect(() => {
      this.cms?.identityKey();
      this.cms?.walletRevision();
      this.cms?.managed();
      untracked(() => {
        this.generation++;
        this.snapshot.set(null);
        this.selected.set(null);
        this.result.set(null);
        void this.load();
      });
    });
    effect(() => {
      const earned = this.progress.demoTreePoints();
      if (this.cms?.managed() || !this.session.isDemoMode()) return;
      untracked(() => {
        const snapshot = this.snapshot();
        if (snapshot && earned !== this.offlineEarned) {
          const next = {
            ...snapshot,
            treePointsBalance: Math.max(
              0,
              snapshot.treePointsBalance + earned - this.offlineEarned,
            ),
          };
          this.snapshot.set(next);
          this.shop.receiveSnapshot(next);
          this.offlineEarned = earned;
        }
      });
    });
  }
  ionViewDidEnter() {
    this.updateWalletSummary();
    this.cms?.track('shop_view');
    void this.load();
  }
  updateWalletSummary(): void {
    const card = this.walletCard()?.nativeElement;
    const content = card?.closest('ion-content');
    this.walletSummaryVisible.set(
      !!card && !!content && card.getBoundingClientRect().bottom <= content.getBoundingClientRect().top,
    );
  }
  async load() {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const snapshot = this.cms?.managed()
        ? await this.cms.wallet<ShopSnapshot>()
        : this.session.isDemoMode()
          ? (this.snapshot() ?? {
              treePointsBalance: 2680 + this.progress.demoTreePoints(),
              lifetimeMatureTrees: 56,
              entitlements: [],
              transactions: [],
            })
          : null;
      if (generation === this.generation) this.snapshot.set(snapshot);
      if (!this.cms?.managed()) this.offlineEarned = this.progress.demoTreePoints();
    } catch {
      if (generation === this.generation) this.error.set('無法讀取雲端錢包，請重新載入。');
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  select(reward: Reward) {
    this.error.set('');
    this.notice.set('');
    this.selected.set({
      reward: structuredClone(reward),
      version: this.cms?.release()?.version ?? 0,
      requestId: crypto.randomUUID(),
    });
  }
  async resetDemo() {
    if (!this.session.isDemoMode() || this.submitting()) return;
    this.submitting.set(true);
    try {
      if (this.cms?.managed()) await this.cms.call('cmsResetDemo');
      else {
        this.snapshot.set({
          treePointsBalance: 2680,
          lifetimeMatureTrees: 56,
          entitlements: [],
          transactions: [],
        });
        this.offlineEarned = this.progress.demoTreePoints();
      }
      this.resetRequested.set(false);
      await this.load();
      if (this.snapshot()) this.shop.receiveSnapshot(this.snapshot()!);
      this.notice.set('目前 Demo 錢包已重設。');
    } catch {
      this.error.set('無法重設目前 Demo 錢包，請稍後再試。');
    } finally {
      this.submitting.set(false);
    }
  }
  async redeem() {
    const selection = this.selected();
    const old = this.snapshot();
    if (!selection || !old || this.submitting()) return;
    if (old.treePointsBalance < selection.reward.requiredPoints) return;
    if (selection.version !== (this.cms?.release()?.version ?? 0)) {
      this.error.set('商品或價格已更新，請返回重新確認。');
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    const generation = this.generation;
    try {
      if (this.cms?.managed()) {
        const result = await this.cms.call<ShopCommandResult>('cmsRedeem', {
          rewardId: selection.reward.id,
          version: selection.version,
          requestId: selection.requestId,
        });
        if (generation !== this.generation) return;
        this.snapshot.set(result.snapshot);
        this.shop.receiveSnapshot(result.snapshot);
      } else {
        this.snapshot.set({
          ...old,
          treePointsBalance: old.treePointsBalance - selection.reward.requiredPoints,
          transactions: [
            {
              id: selection.requestId,
              transactionNumber: null,
              type: selection.reward.kind,
              productName: selection.reward.name,
              status: 'SUCCESS',
              requestedTreeCount: 0,
              usedTreeCount: 0,
              treePointsAmount: -selection.reward.requiredPoints,
              charityCampaignId: null,
              charityCampaignName: null,
              userContributionAmount: null,
              cathayMatchingAmount: null,
              charityTotalAmount: null,
              occurredAt: new Date().toISOString(),
              isDemo: true,
            },
            ...old.transactions,
          ],
        });
      }
      if (!this.cms?.managed() && this.snapshot()) this.shop.receiveSnapshot(this.snapshot()!);
      this.selected.set(null);
      this.notice.set('兌換成功！這是模擬商品，不具真實兌換效力。');
    } catch (e) {
      if (generation === this.generation)
        this.error.set(e instanceof Error ? e.message : '兌換尚未確認，請重試同一筆操作。');
    } finally {
      this.submitting.set(false);
    }
  }
}
