import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { IonContent, IonIcon, IonProgressBar, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  footstepsOutline,
  logOutOutline,
  ribbonOutline,
  sparklesOutline,
  timeOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { SessionStore } from '../../shared/stores/session-store';
import { profileLevelPreview } from '../../shared/components/profile-identity/profile-level-preview';

type WalkingStats = {
  today: number;
  week: number;
  allTime: number;
};

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  imports: [DecimalPipe, IonContent, IonIcon, IonProgressBar, IonSpinner],
})
export class ProfileComponent {
  readonly sessionStore = inject(SessionStore);

  constructor() {
    addIcons({
      checkmarkCircle,
      footstepsOutline,
      logOutOutline,
      ribbonOutline,
      sparklesOutline,
      timeOutline,
      trendingUpOutline,
    });
  }

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
