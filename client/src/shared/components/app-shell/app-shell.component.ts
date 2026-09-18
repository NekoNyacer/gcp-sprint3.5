import { Component, computed, effect, inject } from '@angular/core';
import { MenuComponent } from '../menu/menu.component';
import { Router } from '@angular/router';
import {
  IonMenuToggle,
  IonButton,
  IonLabel,
  IonIcon,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  navigateCircle,
  navigateCircleOutline,
  gift,
  giftOutline,
  leaf,
  leafOutline,
  receipt,
  receiptOutline,
  list,
} from 'ionicons/icons';
import { SessionStore } from '../../stores/session-store';
import { TaskStore } from '../../../features/task/task-store';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss'],
  imports: [
    IonMenuToggle,
    IonButton,
    IonLabel,
    IonIcon,
    IonTabBar,
    IonTabButton,
    IonTabs,
    IonBadge,
    MenuComponent,
  ],
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly sessionStore = inject(SessionStore);
  readonly taskStore = inject(TaskStore);
  constructor() {
    addIcons({
      navigateCircle,
      navigateCircleOutline,
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

      if (status === '已登出' && !this.sessionStore.isDemoMode()) {
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
   */
  readonly currentUrl = computed(() => {
    const navigation = this.router.currentNavigation();
    return (navigation?.finalUrl?.toString() ??
      navigation?.extractedUrl.toString() ??
      this.router.url) as '/home' | '/task' | '/collection' | '/shop' | '/profile';
  });
}
