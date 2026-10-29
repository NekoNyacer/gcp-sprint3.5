import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonLabel,
  IonIcon,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonBadge,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonButtons,
  NavController,
} from '@ionic/angular';
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
  eyeOffOutline,
  eyeOutline,
  medkit,
  gridOutline,
  mapOutline,
  footstepsOutline,
  ticketOutline,
  optionsOutline,
  options,
} from 'ionicons/icons';
import { SessionStore } from '../../stores/session-store';
import { TaskStore } from '../../../features/task/task-store';
import { TaskRewardDialogComponent } from '../../../features/task/task-reward-dialog.component';
import { DialogComponent } from '../dialog/dialog.component';
import { WalkSessionStore } from '../../stores/walk-session-store';
import { CubModalComponent } from '../modal/modal.component';
import { ProfileIdentityComponent } from '../profile-identity/profile-identity.component';
import { CompanionComponent } from '../companion/companion.component';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss'],
  imports: [
    CompanionComponent,
    ProfileIdentityComponent,
    TaskRewardDialogComponent,
    IonButton,
    IonButtons,
    IonTitle,
    IonToolbar,
    IonHeader,
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
  readonly petFloor = viewChild('petFloor', { read: ElementRef });
  private readonly router = inject(Router);
  private readonly navController = inject(NavController);
  private readonly sessionStore = inject(SessionStore);
  protected readonly walkSession = inject(WalkSessionStore);
  readonly taskStore = inject(TaskStore);

  /**header文字設定，用route位置判斷該顯示的內容 */
  protected readonly headerTxt = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/task/')) return '活動內容';
    switch (url) {
      case '/collection':
        return '回憶林';
      case '/task':
        return '任務';
      case '/shop':
        return '兌換';
      default:
        return '未知標題';
    }
  });

  /**健走(home)有特別的排版，需要設定一個signal來監聽 */
  protected readonly isInHomeTab = computed(() => this.currentUrl() === '/home');

  protected readonly isProfileRoot = computed(() => {
    const segments =
      this.router.parseUrl(this.currentUrl()).root.children['primary']?.segments ?? [];
    return segments.length === 1 && segments[0].path === 'profile';
  });

  /**各 tab 首頁不顯示返回按鈕；忽略 query string 與 fragment。 */
  protected readonly showBackButton = computed(() => {
    const urlTree = this.router.parseUrl(this.currentUrl());
    const segments = urlTree.root.children['primary']?.segments ?? [];
    const tabRoots = ['home', 'task', 'shop', 'collection', 'profile'];
    return !(segments.length === 1 && tabRoots.includes(segments[0].path));
  });

  protected goToParentRoute(): void {
    const urlTree = this.router.parseUrl(this.currentUrl());
    const segments = urlTree.root.children['primary']?.segments ?? [];
    const parentUrl =
      '/' +
      segments
        .slice(0, -1)
        .map((segment) => segment.toString())
        .join('/');
    void this.navController.navigateBack(parentUrl);
  }

  //註冊icon
  constructor() {
    addIcons({
      options,
      ticketOutline,
      footstepsOutline,
      mapOutline,
      gridOutline,
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
