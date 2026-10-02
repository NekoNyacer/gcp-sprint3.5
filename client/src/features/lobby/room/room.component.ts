import { Component, computed, effect, inject, signal } from '@angular/core';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { interval, map, take } from 'rxjs';
import { DialogService } from '../../../shared/services/dialog.service';
import { NineUpperComponent } from '../nine-upper/nine-upper.component';
import { avatarDataUrl, createAvatarSeed } from '../relay-game/relay-avatar';
import {
  NineUpperParticipationRole,
  NineUpperPlayer,
  NineUpperStore,
} from '../nine-upper/nine-upper.store';

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
    IonSelect,
    IonSelectOption,
    IonSpinner,
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
  protected readonly hostModeDraft = signal(true);
  protected readonly nickname = signal('');
  protected readonly avatarSeed = signal(createAvatarSeed());
  protected readonly isJoiningProfile = signal(false);
  private readonly profileRestored = signal(false);
  protected readonly isRoomSettingsInvalid = computed(() => {
    const roomNameLength = this.roomNameDraft().trim().length;
    return roomNameLength < 3 || roomNameLength > 20 || this.customPromptDraft().trim().length > 20;
  });

  private readonly dotCount = toSignal(interval(500).pipe(map((count) => (count % 3) + 1)), {
    initialValue: 1,
  });
  protected readonly dotdotdot = computed(() => '.'.repeat(this.dotCount()));

  constructor() {
    effect(() => {
      if (!this.store.seq() || !this.store.uid() || this.profileRestored()) return;
      const profile = this.store.savedProfile();
      if (profile) {
        this.nickname.set(profile.displayName);
        this.avatarSeed.set(profile.avatarSeed);
      }
      this.profileRestored.set(true);
    });
  }

  protected avatarUrl() {
    return avatarDataUrl(this.avatarSeed());
  }

  protected changeAvatar() {
    this.avatarSeed.set(createAvatarSeed());
  }

  protected updateNickname(event: CustomEvent<{ value?: string | null }>) {
    this.nickname.set(event.detail.value ?? '');
  }

  protected async joinWithProfile() {
    if (this.isJoiningProfile() || !this.nickname().trim()) return;
    this.isJoiningProfile.set(true);
    try {
      await this.store.joinRoom({
        displayName: this.nickname().trim(),
        avatarSeed: this.avatarSeed(),
        photoUrl: this.avatarUrl(),
      });
    } finally {
      this.isJoiningProfile.set(false);
    }
  }

  protected returnToLobby() {
    void this.router.navigate(['/lobby'], { replaceUrl: true });
  }

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
    this.hostModeDraft.set(this.store.hasDedicatedHost());
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
        this.hostModeDraft(),
      );
      if (saved) this.isSettingsOpen.set(false);
    } finally {
      this.isSavingSettings.set(false);
    }
  }

  protected assignParticipantRole(player: NineUpperPlayer, event: CustomEvent) {
    const participationRole = event.detail.value as NineUpperParticipationRole;
    if (participationRole !== 'contestant' && participationRole !== 'spectator') return;
    void this.store.setParticipantRole(player.uid, participationRole);
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
