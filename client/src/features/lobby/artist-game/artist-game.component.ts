import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
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
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { NgSignaturePadOptions, SignaturePadComponent } from '@almothafar/angular-signature-pad';
import type { PointGroup } from 'signature_pad';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { DialogService } from '../../../shared/services/dialog.service';
import { ArtistGameStore, ArtistPlayer, ArtistStroke } from './artist-game.store';

@Component({
  selector: 'app-artist-game',
  templateUrl: './artist-game.component.html',
  styleUrls: ['./artist-game.component.scss'],
  imports: [
    SignaturePadComponent,
    IonAvatar,
    IonBadge,
    IonButton,
    IonButtons,
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
    IonTitle,
    IonToolbar,
  ],
  providers: [ArtistGameStore],
})
export class ArtistGameComponent {
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  protected readonly gameStore = inject(ArtistGameStore);
  protected readonly signaturePad = viewChild(SignaturePadComponent);
  protected readonly isSubmittingStroke = signal(false);
  protected readonly isLeaving = signal(false);

  private readonly canvasWidth =
    typeof window === 'undefined' ? 640 : Math.min(640, Math.max(280, window.innerWidth - 40));
  private readonly canvasHeight =
    typeof window === 'undefined' || this.canvasWidth >= 600
      ? Math.round((this.canvasWidth * 420) / 640)
      : Math.min(560, Math.max(300, window.innerHeight - 380));
  protected readonly padOptions: NgSignaturePadOptions = {
    canvasWidth: this.canvasWidth,
    canvasHeight: this.canvasHeight,
    backgroundColor: '#fffef8',
    canvasBackground: '#fffef8',
    minWidth: 2.5,
    maxWidth: 4.5,
    minDistance: 2,
    throttle: 8,
  };

  protected readonly isMyTurn = computed(
    () =>
      this.gameStore.status() === '繪圖中' &&
      this.gameStore.currentPlayer()?.uid === this.gameStore.sessionStore.user()?.uid &&
      !this.isSubmittingStroke(),
  );

  protected readonly myStrokeCount = computed(() => {
    const uid = this.gameStore.sessionStore.user()?.uid;
    return this.gameStore.strokes().filter((stroke) => stroke.playerUid === uid).length;
  });

  protected readonly roundNumber = computed(() =>
    Math.min(
      2,
      Math.floor(this.gameStore.strokes().length / Math.max(1, this.gameStore.players().length)) +
        1,
    ),
  );

  constructor() {
    effect(() => {
      const pad = this.signaturePad();
      const strokes = this.gameStore.strokes();
      const canDraw = this.isMyTurn();
      if (!pad) return;
      this.renderStrokes(pad, strokes);
      pad.set('penColor', this.gameStore.me()?.color ?? '#1f2937');
      if (canDraw) pad.on();
      else pad.off();
    });
  }

  protected startGame() {
    void this.gameStore.startProcess();
  }

  protected regenerateTopic() {
    this.dialogService
      .openDialog('確定要換主題嗎？')
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.gameStore.generateTopic();
      });
  }

  protected async onDrawEnd() {
    const pad = this.signaturePad();
    const me = this.gameStore.me();
    if (!pad || !me || !this.isMyTurn()) {
      if (pad) this.renderStrokes(pad, this.gameStore.strokes());
      return;
    }

    const groups = pad.toData();
    const group = groups.at(-1);
    if (!group || !this.isLongEnough(group)) {
      this.renderStrokes(pad, this.gameStore.strokes());
      const toast = await this.gameStore.toastController.create({
        message: '這一筆太短了，請畫出明顯的線條',
        duration: 1500,
        position: 'bottom',
      });
      await toast.present();
      return;
    }

    this.isSubmittingStroke.set(true);
    pad.off();
    const canvas = pad.getCanvas();
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 420;
    const sampledPoints = this.limitPoints(group.points, 300);
    const stroke: ArtistStroke = {
      ...group,
      id: crypto.randomUUID(),
      playerUid: me.uid,
      penColor: me.color,
      points: sampledPoints.map((point) => ({
        x: point.x / width,
        y: point.y / height,
        pressure: point.pressure,
        time: point.time,
      })),
    };

    try {
      const accepted = await this.gameStore.submitStroke(stroke);
      if (!accepted) this.renderStrokes(pad, this.gameStore.strokes());
    } finally {
      this.isSubmittingStroke.set(false);
    }
  }

  protected voteFor(player: ArtistPlayer) {
    if (this.gameStore.hasVoted() || player.uid === this.gameStore.me()?.uid) return;
    this.dialogService
      .openDialog(`確定投給 ${player.displayName}？每人只有一票。`, {
        mainBtnTxt: '確定投票',
        subBtnTxt: '再想一下',
      })
      .pipe(take(1))
      .subscribe((result) => {
        if (result === 'confirm') void this.gameStore.voteFor(player.uid);
      });
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

  private isLongEnough(group: PointGroup): boolean {
    if (group.points.length < 2) return false;
    let distance = 0;
    for (let index = 1; index < group.points.length; index++) {
      const previous = group.points[index - 1];
      const current = group.points[index];
      distance += Math.hypot(current.x - previous.x, current.y - previous.y);
    }
    return distance >= 12;
  }

  private limitPoints<T>(points: T[], limit: number): T[] {
    if (points.length <= limit) return points;
    const result: T[] = [];
    const step = (points.length - 1) / (limit - 1);
    for (let index = 0; index < limit; index++) {
      result.push(points[Math.round(index * step)]);
    }
    return result;
  }

  private renderStrokes(pad: SignaturePadComponent, strokes: ArtistStroke[]) {
    const canvas = pad.getCanvas();
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 420;
    const groups: PointGroup[] = strokes.map(({ id: _id, playerUid: _uid, points, ...group }) => ({
      ...group,
      points: points.map((point) => ({
        ...point,
        x: point.x * width,
        y: point.y * height,
      })),
    }));
    pad.clear(false);
    if (groups.length > 0) pad.fromData(groups);
  }
}
