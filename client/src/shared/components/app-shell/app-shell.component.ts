import { Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonLabel, IonIcon, IonTabBar, IonTabButton, IonTabs, IonBadge } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alert,
  walk,
  arrowRedo,
  refresh,
  people,
  navigateCircle,
  navigateCircleOutline,
  gift,
  giftOutline,
  leaf,
  leafOutline,
  receipt,
  receiptOutline,
  list,
  water,
  waterOutline,
  sunny,
  sunnyOutline,
  cube,
  add,
  close,
  star,
  alertCircleOutline,
  exitOutline,
  fingerPrint,
  closeCircle,
  closeCircleOutline,
  diceOutline,
  brushSharp,
  playBack,
  playForward,
  playSkipBack,
  playSkipForward,
  downloadOutline,
  sparklesOutline,
  arrowBack,
  personOutline,
  person,
  timeOutline,
  bagHandleOutline,
  locationOutline,
  chevronBackOutline,
  pencil,
  compassOutline,
  locateOutline,
  stopCircleOutline,
  storefrontOutline,
  reloadOutline,
  sparkles,
  eye,
  eyeOffOutline,
  eyeOutline,
  medkit,
} from 'ionicons/icons';
import { SessionStore } from '../../stores/session-store';
import { TaskStore } from '../../../features/task/task-store';
import { DialogComponent } from '../dialog/dialog.component';
import { WalkSessionStore } from '../../stores/walk-session-store';
import { CubModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss'],
  imports: [
    IonLabel,
    IonIcon,
    IonTabBar,
    IonTabButton,
    IonTabs,
    IonBadge,
    DialogComponent,
    CubModalComponent,
  ],
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly sessionStore = inject(SessionStore);
  protected readonly walkSession = inject(WalkSessionStore);
  readonly taskStore = inject(TaskStore);

  //註冊icon
  constructor() {
    addIcons({
      arrowRedo,
      medkit,
      eyeOutline,
      eyeOffOutline,
      alert,
      reloadOutline,
      storefrontOutline,
      stopCircleOutline,
      locateOutline,
      compassOutline,
      pencil,
      chevronBackOutline,
      locationOutline,
      bagHandleOutline,
      timeOutline,
      person,
      personOutline,
      arrowBack,
      sparkles,
      sparklesOutline,
      walk,
      downloadOutline,
      playForward,
      playBack,
      playSkipForward,
      playSkipBack,
      brushSharp,
      diceOutline,
      closeCircleOutline,
      closeCircle,
      fingerPrint,
      exitOutline,
      alertCircleOutline,
      refresh,
      people,
      star,
      close,
      add,
      cube,
      sunny,
      sunnyOutline,
      navigateCircle,
      navigateCircleOutline,
      water,
      waterOutline,
      gift,
      giftOutline,
      leaf,
      leafOutline,
      receipt,
      receiptOutline,
      list,
    });

    effect(() => {
      const status = this.sessionStore.authStatus();

      if (status === '已登入' || this.sessionStore.isDemoMode()) {
        this.taskStore.initialize();
      }

      if (
        status === '已登出' &&
        !this.sessionStore.isDemoMode() &&
        !this.router.url.startsWith('/lobby')
      ) {
        void this.router.navigateByUrl('/login');
      }
    });
  }

  /**監聽目前在哪一個route
   * @returns "在首頁: /home"
   * @returns "在任務: /task"
   * @returns "在收藏: /collection"
   * @returns "在商城: /shop"
   * @returns "在個人頁面: /profile"
   * @returns "在遊戲大廳: /lobby"
   */
  readonly currentUrl = computed(() => {
    const navigation = this.router.currentNavigation();
    return (navigation?.finalUrl?.toString() ??
      navigation?.extractedUrl.toString() ??
      this.router.url) as '/home' | '/task' | '/collection' | '/shop' | '/profile' | '/lobby';
  });

  readonly hasTabBar = computed(() => {
    return (
      this.currentUrl().includes('lobby') ||
      this.walkSession.isIdle() ||
      (this.walkSession.hasActiveRoute() && !this.walkSession.isCultivating())
    );
  });
}
