import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { extensionPuzzleOutline, logOutOutline, personOutline } from 'ionicons/icons';
import {
  IonLabel,
  IonMenuToggle,
  IonContent,
  IonIcon,
  IonHeader,
  IonItem,
  IonList,
  IonMenu,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { SessionStore } from '../../stores/session-store';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  imports: [
    IonLabel,
    IonMenuToggle,
    IonContent,
    IonIcon,
    IonItem,
    IonList,
    RouterLink,
    IonHeader,
    IonMenu,
    IonToolbar,
  ],
})
export class MenuComponent {
  readonly sessionStore = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly failedPortraitUrl = signal<string | null>(null);

  constructor() {
    addIcons({ personOutline, extensionPuzzleOutline, logOutOutline });
  }

  readonly userName = computed(() => this.sessionStore.user()?.displayName?.trim() || '訪客使用者');
  readonly userEmail = computed(() => this.sessionStore.user()?.email?.trim() || '尚未連結帳號');
  readonly userInitial = computed(() => this.userName().charAt(0).toUpperCase());
  readonly userPortrait = computed(() => {
    const photoUrl = this.sessionStore.user()?.photoUrl || null;
    return photoUrl === this.failedPortraitUrl() ? null : photoUrl;
  });

  onPortraitError(): void {
    this.failedPortraitUrl.set(this.sessionStore.user()?.photoUrl || null);
  }

  logOut(): void {
    if (this.sessionStore.isDemoMode()) {
      this.sessionStore.exitDemo();
      void this.router.navigateByUrl('/login');
      return;
    }
    this.sessionStore.logOut();
  }
}
