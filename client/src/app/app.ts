import { Component, inject } from '@angular/core';
import { CmsIntegrationService } from '../shared/services/cms-integration.service';
import { ProgressSyncService } from '../shared/services/progress-sync.service';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { SessionStore } from '../shared/stores/session-store';

@Component({
  imports: [IonRouterOutlet, IonApp],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  readonly progressSync = inject(ProgressSyncService);
  readonly cmsIntegration = inject(CmsIntegrationService);
  readonly sessionStore = inject(SessionStore);

  enterDemo(): void {
    this.sessionStore.enterDemo('Demo五分鐘版');
  }

  logOut(): void {
    this.sessionStore.logOut();
  }
}
