import { Component, computed, inject, signal } from '@angular/core';
import { IonToast } from '@ionic/angular';
import { SessionStore } from '../../stores/session-store';

@Component({
  selector: 'app-profile-identity',
  templateUrl: './profile-identity.component.html',
  styleUrls: ['./profile-identity.component.scss'],
  imports: [IonToast],
})
export class ProfileIdentityComponent {
  private readonly sessionStore = inject(SessionStore);
  private readonly failedPortraitUrl = signal<string | null>(null);
  readonly copyMessage = signal('');
  readonly displayName = computed(() => this.sessionStore.displayName() || '健走旅人');
  readonly portraitUrl = computed(() => {
    const url = this.sessionStore.photoUrl();
    return url === this.failedPortraitUrl() ? null : url;
  });
  readonly travelerId = computed(() => {
    const uid = this.sessionStore.user()?.uid || 'guest';
    const id = uid
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-8)
      .toUpperCase()
      .padStart(8, '0');
    return `CW-${id}`;
  });

  onPortraitError(): void {
    this.failedPortraitUrl.set(this.portraitUrl());
  }

  logOut(): void {
    this.sessionStore.logOut();
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
