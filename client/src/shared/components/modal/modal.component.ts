import { Component, inject } from '@angular/core';
import { IonButton, IonContent, IonModal, IonToolbar } from '@ionic/angular';
import { ModalService } from '../../services/modal.service';
import { CubBadgeComponent } from '../badge/badge.component';

@Component({
  selector: 'cub-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  imports: [IonButton, IonToolbar, IonContent, IonModal, CubBadgeComponent],
})
export class CubModalComponent {
  protected readonly modal = inject(ModalService);
}
