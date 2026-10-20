import { Component, effect, inject } from '@angular/core';
import { IonButton, IonContent, IonHeader } from '@ionic/angular';
import { SessionStore } from '../../../shared/stores/session-store';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [IonHeader, IonButton, IonContent],
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly sessionStore = inject(SessionStore);
  constructor() {
    effect(() => {
      if (this.sessionStore.canAccessApp()) {
        void this.router.navigateByUrl('/home');
      }
    });
  }

  login() {
    this.sessionStore.logInWithGoogle();
  }

  enterDemo() {
    this.sessionStore.enterDemo('Demo五分鐘版');
  }
}
