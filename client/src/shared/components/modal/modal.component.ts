import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonButton, IonContent, IonModal, IonToolbar } from '@ionic/angular';
import type { OverlayEventDetail } from '@ionic/core';
import { ModalContent, ModalService, TreeProfile } from '../../services/modal.service';
import { CubBadgeComponent } from '../badge/badge.component';

@Component({
  selector: 'cub-modal',
  templateUrl: './modal.component.html',
  imports: [IonButton, IonToolbar, IonContent, IonModal, CubBadgeComponent, NgTemplateOutlet],
})
export class CubModalComponent {
  protected readonly modal = inject(ModalService);
  protected isTreeProfile(content: ModalContent | TreeProfile): content is TreeProfile {
    return 'treeType' in content;
  }

  protected isSupplyStation(): boolean {
    const content = this.modal.modalContent();
    return !this.isTreeProfile(content) && content.appearance === 'supply-station';
  }

  onModalDismiss(event: CustomEvent<OverlayEventDetail>): void {
    if (!this.modal.isOpen()) return;
    this.modal.close(event.detail.role === 'confirm' ? 'confirm' : 'cancel');
  }
}
