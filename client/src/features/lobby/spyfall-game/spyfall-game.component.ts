import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { DialogService } from '../../../shared/services/dialog.service';
import { SpyfallGameStore, SpyfallPlayer } from './spyfall-game.store';

@Component({
  selector: 'app-spyfall-game',
  templateUrl: './spyfall-game.component.html',
  styleUrls: ['./spyfall-game.component.scss'],
  imports: [
    IonAvatar,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
  ],
  providers: [SpyfallGameStore],
})
export class SpyfallGameComponent {
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  protected readonly gameStore = inject(SpyfallGameStore);
  protected readonly identityRevealed = signal(false);
  protected readonly isLeaving = signal(false);

  protected readonly formattedTime = computed(() => {
    const total = this.gameStore.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  protected readonly yesVoters = computed(() => {
    const votes = this.gameStore.activeAccusation()?.votes ?? {};
    return this.gameStore.players().filter((player) => votes[player.uid] === true);
  });

  protected readonly noVoters = computed(() => {
    const votes = this.gameStore.activeAccusation()?.votes ?? {};
    return this.gameStore.players().filter((player) => votes[player.uid] === false);
  });

  constructor() {
    effect(() => {
      if (this.gameStore.status() === '遊戲準備中') this.identityRevealed.set(false);
    });
  }

  protected startGame() {
    this.identityRevealed.set(false);
    void this.gameStore.startProcess();
  }

  protected updateHintCount(value: unknown) {
    void this.gameStore.updateSettings({
      ...this.gameStore.settings(),
      locationHintCount: Number(value),
    });
  }

  protected updateDuration(value: unknown) {
    void this.gameStore.updateSettings({
      ...this.gameStore.settings(),
      durationSeconds: Number(value),
    });
  }

  protected updateSpyCount(value: unknown) {
    void this.gameStore.updateSettings({
      ...this.gameStore.settings(),
      spyCount: Number(value),
    });
  }

  protected finishSpeakingTurn() {
    void this.gameStore.finishSpeakingTurn();
  }

  protected accuse(player: SpyfallPlayer) {
    if (
      this.gameStore.me()?.role !== '普通人' ||
      player.uid === this.gameStore.me()?.uid ||
      this.gameStore.activeAccusation()
    ) {
      return;
    }
    this.dialogService
      .openDialog(`要提名 ${player.displayName} 為間諜，並向全員發起投票嗎？`, {
        mainBtnTxt: '發起投票',
        subBtnTxt: '再觀察一下',
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.gameStore.accuse(player.uid);
      });
  }

  protected vote(agree: boolean) {
    void this.gameStore.voteOnAccusation(agree);
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
    const didLeave = await this.gameStore.leaveRoom();
    if (didLeave) await this.router.navigate(['/lobby'], { replaceUrl: true });
    this.isLeaving.set(false);
  }
}
