import { Component, computed, inject, signal } from '@angular/core';
import {
  IonAvatar,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonLabel,
  IonHeader,
} from '@ionic/angular';
import { take } from 'rxjs';
import { DialogService } from '../../../shared/services/dialog.service';
import { NineUpperPlayer, NineUpperSpectatorVoteType, NineUpperStore } from './nine-upper.store';

@Component({
  selector: 'app-nine-upper',
  templateUrl: './nine-upper.component.html',
  styleUrls: ['./nine-upper.component.scss'],
  imports: [
    IonAvatar,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonLabel,
    IonHeader,
  ],
})
export class NineUpperComponent {
  protected readonly store = inject(NineUpperStore);
  private readonly dialogService = inject(DialogService);

  protected readonly topic = computed(() => this.store.topic());
  protected readonly players = computed(() => this.store.players());
  protected readonly contestants = computed(() => this.store.contestants());
  protected readonly voteTallies = computed(() => this.store.voteTallies());
  protected readonly playerRole = computed(
    () => this.store.players().find((player) => player.uid === this.store.uid())?.role,
  );
  protected readonly flipped = signal(false);

  protected selectPlayer(player: NineUpperPlayer) {
    if (this.store.uid() !== this.store.guessingPlayer()?.uid) return;

    this.dialogService
      .openDialog(`你確定 ${player.displayName} 是老實人？`, {
        mainBtnTxt: '是的',
        subBtnTxt: '我再想一下!',
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.store.chooseTheHonest(player);
      });
  }

  protected nextPlayer() {
    this.dialogService
      .openDialog('確認是否換下一位玩家發言?')
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.store.nextAnswerPlayer();
      });
  }

  protected castSpectatorVote(type: NineUpperSpectatorVoteType, player: NineUpperPlayer) {
    if (this.store.mySpectatorVotes()[type]) return;

    const voteLabel = type === 'honest' ? '你是老實人' : '你在公蝦毀';
    this.dialogService
      .openDialog(`確定把「${voteLabel}」投給 ${player.displayName}？投出後不能更改。`, {
        mainBtnTxt: '確定投票',
        subBtnTxt: '再想想',
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.store.castSpectatorVote(type, player.uid);
      });
  }

  protected finishHostedGame() {
    this.dialogService
      .openDialog('確認公開所有參賽者的身分？', {
        mainBtnTxt: '公開身分',
        subBtnTxt: '繼續投票',
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.store.finishHostedGame();
      });
  }
}
