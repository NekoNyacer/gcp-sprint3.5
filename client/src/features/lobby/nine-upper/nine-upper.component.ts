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
} from '@ionic/angular';
import { take } from 'rxjs';
import { DialogService } from '../../../shared/services/dialog.service';
import { SessionStore } from '../../../shared/stores/session-store';
import { NineUpperPlayer, NineUpperStore } from './nine-upper.store';

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
  ],
})
export class NineUpperComponent {
  protected readonly store = inject(NineUpperStore);
  private readonly sessionStore = inject(SessionStore);
  private readonly dialogService = inject(DialogService);

  protected readonly topic = computed(() => this.store.topic());
  protected readonly players = computed(() => this.store.players());
  protected readonly playerRole = computed(
    () => this.store.players().find((player) => player.uid === this.sessionStore.user()?.uid)?.role,
  );
  protected readonly flipped = signal(false);

  protected selectPlayer(player: NineUpperPlayer) {
    if (this.sessionStore.user()?.uid !== this.store.guessingPlayer()?.uid) return;

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

  protected readonly gibberish =
    '滾滾長江東逝水，浪花淘盡英雄。是非成敗轉頭空，青山依舊在，幾度夕陽紅。白髮漁樵江渚上，慣看秋月春風。一壺濁酒喜相逢，古今多少事，都付笑談';
}
