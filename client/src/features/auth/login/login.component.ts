import { Component, effect, inject, signal } from '@angular/core';
import { IonButton, IonContent } from '@ionic/angular';
import { SessionStore } from '../../../shared/stores/session-store';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [IonButton, IonContent],
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly sessionStore = inject(SessionStore);
  private readonly isAnonymousGameEntry = signal(false);

  constructor() {
    effect(() => {
      if (this.sessionStore.canAccessApp()) {
        void this.router.navigateByUrl(this.isAnonymousGameEntry() ? '/lobby' : '/home');
      }
    });
  }

  login() {
    this.sessionStore.logInWithGoogle();
  }

  loginDemo() {
    this.isAnonymousGameEntry.set(true);
    this.sessionStore.logInAnonymously();
  }
}
