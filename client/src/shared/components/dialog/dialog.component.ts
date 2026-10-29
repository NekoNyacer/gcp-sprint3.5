import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonButton, IonIcon, IonModal } from '@ionic/angular';
import {
  timeOutline,
  footstepsOutline,
  sunnyOutline,
  waterOutline,
  sparklesOutline,
} from 'ionicons/icons';
import type { OverlayEventDetail } from '@ionic/core';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss'],
  imports: [IonButton, IonIcon, IonModal, DecimalPipe],
})

/**共用的確認彈窗元件 */
export class DialogComponent {
  protected readonly ds = inject(DialogService);
  protected readonly icons = {
    timeOutline,
    footstepsOutline,
    sunnyOutline,
    waterOutline,
    sparklesOutline,
  };

  onDialogDismiss(event: CustomEvent<OverlayEventDetail>) {
    if (!this.ds.isDialogOpen()) return;
    this.ds.closeDialog(event.detail.role === 'confirm' ? 'confirm' : 'cancel');
  }
}
