import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonIcon,
  IonPopover,
  IonCard,
  IonChip,
  IonCardTitle,
  IonCardHeader,
  IonLoading,
  IonCardSubtitle,
} from '@ionic/angular';
import { GameStore, On9Player } from './game.store';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map, take, timer } from 'rxjs';
import { AuthService } from '../../../shared/services/auth.service';
import { UserProfileService } from '../../../shared/services/user-profile.service';
import { SessionStore } from '../../../shared/stores/session-store';
import { LobbyService } from '../lobby.service';
import { DialogService } from '../../../shared/services/dialog.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  imports: [
    IonLoading,
    IonPopover,
    IonCardTitle,
    IonCardHeader,
    IonIcon,
    IonAvatar,
    IonLabel,
    IonItem,
    IonList,
    IonButton,
    IonContent,
    IonCard,
    IonChip,
    IonCardSubtitle,
  ],
  providers: [GameStore],
})
export class GameComponent {
  private readonly lobbyService = inject(LobbyService);
  protected readonly gameStore = inject(GameStore);
  protected readonly sessionStore = inject(SessionStore);
  protected readonly dialogService = inject(DialogService);
  protected readonly countdown = computed(() => this.gameStore.countdown());

  topic = computed(() => this.gameStore.topic());
  players = computed(() => this.gameStore.players());
  playerCharacter = computed(
    () =>
      this.gameStore.players().find((x) => x.uid === this.gameStore.sessionStore.user()?.uid)?.role,
  );

  qr = signal('');
  flipped = signal(false);

  startCountDown() {
    this.gameStore.startProcess(this.lobbyService.customPrompt());
  }

  regenerateTopic() {
    this.dialogService
      .openDialog('是否確定要重新產生題目?')
      .subscribe((clicked) => (clicked === 'confirm' ? this.startCountDown() : undefined));
  }

  selectPlayer(player: On9Player) {
    //只有猜題人可以進行指認
    if (this.sessionStore.user()?.uid !== this.gameStore.gussingPlayer()?.uid) {
      return;
    }
    this.dialogService
      .openDialog(`你確定 ${player.displayName} 是老實人？`, {
        mainBtnTxt: '是的',
        subBtnTxt: '我再想一下!',
      })
      .subscribe((clicked) =>
        clicked === 'confirm' ? this.gameStore.chooseTheHonest(player) : undefined,
      );
  }

  nextPlayer() {
    this.dialogService.openDialog('確認是否換下一位玩家發言?').subscribe((result) => {
      if (result === 'confirm') {
        this.gameStore.nextAnswerPlayer();
      }
    });
  }

  generateInvitationQR() {
    this.qr.set('images/test/260818214303.svg');
  }

  private dotCount = toSignal(interval(500).pipe(map((count) => (count % 3) + 1)), {
    initialValue: 1,
  });
  readonly dotdotdot = computed(() => '.'.repeat(this.dotCount()));

  readonly gibberish =
    '滾滾長江東逝水，浪花淘盡英雄。是非成敗轉頭空，青山依舊在，幾度夕陽紅。白髮漁樵江渚上，慣看秋月春風。一壺濁酒喜相逢，古今多少事，都付笑談';
}
