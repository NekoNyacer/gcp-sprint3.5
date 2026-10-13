import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon, IonProgressBar, IonSpinner, IonToast } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  copyOutline,
  footstepsOutline,
  leafOutline,
  ribbonOutline,
  sparklesOutline,
  timeOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { SessionStore } from '../../shared/stores/session-store';

type WalkingStats = {
  today: number;
  week: number;
  allTime: number;
};

type LevelPreview = {
  level: number;
  title: string;
  currentXp: number;
  nextLevelXp: number;
};

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  imports: [DecimalPipe, IonContent, IonIcon, IonProgressBar, IonSpinner, IonToast],
})
export class ProfileComponent {
  readonly sessionStore = inject(SessionStore);
  private readonly failedPortraitUrl = signal<string | null>(null);

  readonly copyMessage = signal('');

  constructor() {
    addIcons({
      checkmarkCircle,
      copyOutline,
      footstepsOutline,
      leafOutline,
      ribbonOutline,
      sparklesOutline,
      timeOutline,
      trendingUpOutline,
    });
  }

  readonly displayName = computed(
    () => this.sessionStore.displayName() || '健走旅人',
  );

  readonly userInitial = computed(() => this.displayName().charAt(0).toUpperCase());

  readonly portraitUrl = computed(() => {
    const photoUrl = this.sessionStore.photoUrl();
    return photoUrl === this.failedPortraitUrl() ? null : photoUrl;
  });

  readonly travelerId = computed(() => {
    const uid = this.sessionStore.user()?.uid || 'guest';
    const readableId = uid.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase().padStart(8, '0');
    return `CW-${readableId}`;
  });

  readonly dailyGoal = computed(() => this.sessionStore.dailyGoal());

  // Profile 統計與 XP 後續應改由可信任的活動 read model 提供。
  readonly walkingStats = computed<WalkingStats>(() =>
    this.sessionStore.isDemoMode()
      ? { today: 7240, week: 38620, allTime: 284930 }
      : { today: 0, week: 0, allTime: 0 },
  );

  readonly levelPreview = computed<LevelPreview>(() =>
    this.sessionStore.isDemoMode()
      ? { level: 6, title: '城市綠旅人', currentXp: 680, nextLevelXp: 1000 }
      : { level: 1, title: '散步新芽', currentXp: 0, nextLevelXp: 100 },
  );

  readonly levelProgress = computed(
    () => this.levelPreview().currentXp / this.levelPreview().nextLevelXp,
  );

  readonly remainingXp = computed(
    () => this.levelPreview().nextLevelXp - this.levelPreview().currentXp,
  );

  readonly todayGoalProgress = computed(() =>
    Math.min(this.walkingStats().today / this.dailyGoal(), 1),
  );

  onPortraitError(): void {
    this.failedPortraitUrl.set(this.portraitUrl());
  }

  async copyTravelerId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.travelerId());
      this.copyMessage.set('旅人編號已複製');
    } catch {
      this.copyMessage.set('無法複製，請稍後再試');
    }
  }
}
