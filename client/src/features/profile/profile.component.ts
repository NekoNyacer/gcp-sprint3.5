import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonProgressBar, IonSpinner } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { ShopStore } from '../shop/shop-store';
import { SessionStore } from '../../shared/stores/session-store';
import { profileLevelPreview } from '../../shared/components/profile-identity/profile-level-preview';
import { cmsPublication } from '../../shared/models/cms-publication';
import { transactionSummary, transactionTitle, transactionStatusLabel } from '../shop/shop-view.models';

type WalkingStats = {
  today: number;
  week: number;
  allTime: number;
};

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  imports: [
    IonButton,
    DecimalPipe,
    DatePipe,
    RouterLink,
    IonContent,
    IonIcon,
    IonProgressBar,
    IonSpinner,
  ],
})
export class ProfileComponent {
  readonly transactionSummary = transactionSummary;
  readonly transactionTitle = transactionTitle;
  readonly transactionStatusLabel = transactionStatusLabel;
  readonly sessionStore = inject(SessionStore);
  readonly shopStore = inject(ShopStore);
  readonly matureTrees = computed(() =>
    this.sessionStore.isDemoMode() || cmsPublication().managed ? this.shopStore.lifetimeMatureTrees() : 0,
  );
  readonly treeProgress = computed(() => Math.min(this.matureTrees() / 100, 1));
  readonly remainingTrees = computed(() => Math.max(100 - this.matureTrees(), 0));
  readonly recentTransactions = computed(() =>
    this.sessionStore.isDemoMode() || cmsPublication().managed ? this.shopStore.recentTransactions() : [],
  );
  readonly dailyGoal = computed(() => this.sessionStore.dailyGoal());

  // Profile 統計與 XP 後續應改由可信任的活動 read model 提供。
  readonly walkingStats = computed<WalkingStats>(() =>
    this.sessionStore.isDemoMode()
      ? { today: 7240, week: 38620, allTime: 284930 }
      : { today: 0, week: 0, allTime: 0 },
  );

  readonly levelPreview = computed(() => profileLevelPreview(this.sessionStore.isDemoMode()));

  readonly levelProgress = computed(
    () => this.levelPreview().currentXp / this.levelPreview().nextLevelXp,
  );

  readonly remainingXp = computed(
    () => this.levelPreview().nextLevelXp - this.levelPreview().currentXp,
  );

  readonly todayGoalProgress = computed(() =>
    Math.min(this.walkingStats().today / this.dailyGoal(), 1),
  );

  logOut(): void {
    this.sessionStore.logOut();
  }
}
