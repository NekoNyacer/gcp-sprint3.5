import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonCard,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPopover,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { interval, map, take } from 'rxjs';
import { DialogService } from '../../../shared/services/dialog.service';
import { NineUpperComponent } from '../nine-upper/nine-upper.component';
import { NineUpperStore } from '../nine-upper/nine-upper.store';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss'],
  imports: [
    NineUpperComponent,
    IonAvatar,
    IonButton,
    IonButtons,
    IonCard,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonPopover,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  providers: [NineUpperStore],
})
export class RoomComponent {
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly dialogService = inject(DialogService);
  protected readonly store = inject(NineUpperStore);

  protected readonly qr = signal('');
  protected readonly isLeaving = signal(false);
  protected readonly isSettingsOpen = signal(false);
  protected readonly isSavingSettings = signal(false);
  protected readonly roomNameDraft = signal('');
  protected readonly customPromptDraft = signal('');
  protected readonly isRoomSettingsInvalid = computed(() => {
    const roomNameLength = this.roomNameDraft().trim().length;
    return roomNameLength < 3 || roomNameLength > 8 || this.customPromptDraft().trim().length > 20;
  });

  private readonly dotCount = toSignal(interval(500).pipe(map((count) => (count % 3) + 1)), {
    initialValue: 1,
  });
  protected readonly dotdotdot = computed(() => '.'.repeat(this.dotCount()));

  protected startGame() {
    void this.store.startProcess();
  }

  protected regenerateTopic() {
    this.dialogService
      .openDialog('是否確定要重新產生題目?')
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.store.generateTopic();
      });
  }

  protected openRoomSettings() {
    this.roomNameDraft.set(this.store.name());
    this.customPromptDraft.set(this.store.promptConfig().customPrompt);
    this.isSettingsOpen.set(true);
  }

  protected closeRoomSettings() {
    if (!this.isSavingSettings()) this.isSettingsOpen.set(false);
  }

  protected async saveRoomSettings() {
    if (this.isRoomSettingsInvalid() || this.isSavingSettings()) return;

    this.isSavingSettings.set(true);
    try {
      const saved = await this.store.updateRoomSettings(
        this.roomNameDraft(),
        this.customPromptDraft(),
      );
      if (saved) this.isSettingsOpen.set(false);
    } finally {
      this.isSavingSettings.set(false);
    }
  }

  protected generateInvitationQR() {
    this.qr.set('images/test/260818214303.svg');
  }

  protected leaveRoom() {
    this.dialogService
      .openDialog('確定要離開目前房間嗎？', {
        mainBtnTxt: '離開房間',
        subBtnTxt: '繼續遊戲',
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.confirmLeaveRoom();
      });
  }

  private async confirmLeaveRoom() {
    if (this.isLeaving()) return;
    this.isLeaving.set(true);

    try {
      const hasLeft = await this.store.leaveRoom();
      if (!hasLeft) {
        const toast = await this.toastController.create({
          message: '遊戲已開始，現在無法離開房間',
          duration: 1800,
          position: 'bottom',
        });
        await toast.present();
        return;
      }

      await this.router.navigate(['/lobby'], { replaceUrl: true });
    } catch (error) {
      console.error('離開房間失敗：', error);
      const toast = await this.toastController.create({
        message: '離開房間失敗，請稍後再試',
        duration: 1800,
        position: 'bottom',
      });
      await toast.present();
    } finally {
      this.isLeaving.set(false);
    }
  }
}
