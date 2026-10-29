import { Component, computed, effect, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { NgSignaturePadOptions, SignaturePadComponent } from '@almothafar/angular-signature-pad';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonAvatar,
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonIcon,
} from '@ionic/angular';
import type { PointGroup } from 'signature_pad';
import * as QRCode from 'qrcode';
import { avatarDataUrl, createAvatarSeed } from './relay-avatar';
import { RelayGameStore } from './relay-game.store';
import { RelayGroup, RelayPage, RelayStroke } from './relay-game.models';
import { RelayPdfService } from './relay-pdf.service';
import { canReviewRelayBook } from './relay-game.rules';

const DEPARTMENTS = ['協理', '設計', '科研', '運維', '發展', '開發', '架構'] as const;

@Component({
  selector: 'app-relay-game',
  templateUrl: './relay-game.component.html',
  styleUrls: ['./relay-game.component.scss'],
  imports: [
    SignaturePadComponent,
    IonAvatar,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
    IonIcon,
  ],
  providers: [RelayGameStore, RelayPdfService],
})
export class RelayGameComponent implements OnDestroy {
  private readonly alertController = inject(AlertController);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(RelayGameStore);
  protected readonly signaturePad = viewChild(SignaturePadComponent);
  protected readonly nickname = signal('');
  protected readonly department = signal<(typeof DEPARTMENTS)[number] | ''>('');
  protected readonly departments = DEPARTMENTS;
  protected readonly avatarSeed = signal(createAvatarSeed());
  protected readonly hasInk = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly qrCodes = signal<Record<string, string>>({});
  protected readonly selectedRevealGroupId = signal('');
  protected readonly selectedRevealBookId = signal('');
  protected readonly revealPosition = signal(0);
  protected readonly liveReviewPosition = signal(0);
  protected readonly liveReviewMode = signal<'manual' | 'auto'>('manual');
  protected readonly isLiveGridPreview =
    this.route.snapshot.queryParamMap.get('preview') === 'live-grid';
  protected readonly joinGroupId: string;
  private readonly timerId: ReturnType<typeof setInterval>;

  private readonly canvasWidth =
    typeof window === 'undefined' ? 640 : Math.min(720, Math.max(280, window.innerWidth - 40));
  private readonly canvasHeight = Math.round((this.canvasWidth * 4) / 5);
  protected readonly padOptions: NgSignaturePadOptions = {
    canvasWidth: this.canvasWidth,
    canvasHeight: this.canvasHeight,
    backgroundColor: '#fffef8',
    canvasBackground: '#fffef8',
    minWidth: 2.5,
    maxWidth: 5,
    minDistance: 2,
    throttle: 8,
    penColor: '#14231f',
  };

  protected readonly joined = computed(() => Boolean(this.store.myGroup()));
  protected readonly registered = computed(() => Boolean(this.store.myPlayer()));
  protected readonly selectedRevealGroup = computed(() =>
    this.store.groups().find((group) => group.id === this.selectedRevealGroupId()),
  );
  protected readonly selectedBookIds = computed(() =>
    Object.keys(this.selectedRevealGroup()?.topicsByBook ?? {}),
  );
  protected readonly selectedBookPages = computed(() => {
    const group = this.selectedRevealGroup();
    if (!group) return [];
    return (this.store.pagesByGroup()[group.id] ?? [])
      .filter((page) => page.bookId === this.selectedRevealBookId())
      .sort((left, right) => left.pageIndex - right.pageIndex);
  });
  protected readonly revealTopic = computed(
    () => this.selectedRevealGroup()?.topicsByBook[this.selectedRevealBookId()] ?? '',
  );
  protected readonly revealPage = computed<RelayPage | null>(() => {
    const position = this.revealPosition();
    return position === 0 ? null : (this.selectedBookPages()[position - 1] ?? null);
  });
  protected readonly revealPageCount = computed(() => this.selectedBookPages().length + 1);
  protected readonly canReviewRelayBook = computed(() => {
    const room = this.store.room();
    return room ? canReviewRelayBook(room.status, this.store.isHost()) : false;
  });
  protected readonly isLiveHostReview = computed(
    () =>
      this.store.isHost() &&
      this.store.hasDedicatedHost() &&
      this.store.room()?.status === '遊戲進行中',
  );
  /** The projector only replays completed drawings, never handwritten guesses or skipped turns. */
  protected readonly liveReviewPages = computed(() =>
    Object.values(this.store.pagesByGroup())
      .flat()
      .filter((page) => page.kind === 'drawing')
      .sort((left, right) => left.submittedAt - right.submittedAt),
  );
  protected readonly liveReviewPage = computed<RelayPage | null>(
    () => this.liveReviewPages()[this.liveReviewPosition()] ?? null,
  );

  constructor() {
    const seq = this.route.snapshot.paramMap.get('seq') ?? '';
    this.joinGroupId = this.route.snapshot.queryParamMap.get('group') ?? '';
    if (this.isLiveGridPreview) {
      this.store.previewLiveGrid();
    } else void this.bootstrap(seq);
    this.timerId = setInterval(() => this.store.tick(), 250);

    effect(() => {
      const pad = this.signaturePad();
      const group = this.store.myGroup();
      const canDraw = Boolean(group && this.store.isMyTurn(group) && !this.isSubmitting());
      if (!pad) return;
      if (canDraw) pad.on();
      else pad.off();
    });

    effect(() => {
      const groups = this.store.groups();
      if (this.store.isHost() && this.store.room()?.mode === 'activity' && groups.length > 0) {
        void this.generateQrCodes(groups);
      }
    });

    effect(() => {
      const room = this.store.room();
      const groups = this.store.groups();
      if (!room) return;
      if (room.status === '遊戲準備中') {
        this.selectedRevealGroupId.set('');
        this.selectedRevealBookId.set('');
        this.revealPosition.set(0);
        return;
      }
      const canShowReview =
        ['公開揭露', '遊戲結束'].includes(room.status) || this.isLiveHostReview();
      if (groups.length === 0 || !canShowReview) return;
      if (!this.selectedRevealGroupId()) {
        const visibleGroup = this.store.isHost() ? groups[0] : this.store.myGroup();
        if (visibleGroup) this.selectRevealGroup(visibleGroup.id, this.isLiveHostReview());
      }
    });

    effect((onCleanup) => {
      if (
        !this.isLiveHostReview() ||
        this.liveReviewMode() !== 'auto' ||
        this.liveReviewPages().length < 2
      ) {
        return;
      }
      const intervalId = setInterval(() => this.nextLiveReviewPage(), 5000);
      onCleanup(() => clearInterval(intervalId));
    });
  }

  ngOnDestroy() {
    clearInterval(this.timerId);
    this.store.destroy();
  }

  protected avatarUrl(): string {
    return avatarDataUrl(this.avatarSeed());
  }

  protected revealAvatar(seed: string): string {
    return avatarDataUrl(seed);
  }

  protected changeAvatar() {
    this.avatarSeed.set(createAvatarSeed());
  }

  protected updateNickname(event: CustomEvent<{ value?: string | null }>) {
    this.nickname.set(event.detail.value ?? '');
  }

  protected updateDepartment(event: CustomEvent<{ value?: string | number | null }>) {
    const value = event.detail.value;
    if (typeof value === 'string' && DEPARTMENTS.includes(value as (typeof DEPARTMENTS)[number])) {
      this.department.set(value as (typeof DEPARTMENTS)[number]);
    }
  }

  protected async join() {
    const department = this.department();
    const nickname = this.nickname().trim();
    if (!department || !nickname) return;
    const profile = {
      displayName: `${department}-${nickname}`,
      avatarSeed: this.avatarSeed(),
      avatarUrl: this.avatarUrl(),
    };
    if (this.store.room()?.mode === 'activity' && this.joinGroupId) {
      await this.store.joinGroup(this.joinGroupId, profile);
    } else await this.store.joinRoom(profile);
  }

  protected async backToLobby() {
    await this.router.navigate(['/lobby']);
  }

  protected async leaveRoom() {
    if (await this.store.leaveRoom()) await this.router.navigate(['/lobby']);
  }

  protected async copyJoinLink(group: RelayGroup) {
    await navigator.clipboard.writeText(this.joinLink(group.id));
  }

  protected async shareGroup(group: RelayGroup) {
    const url = this.joinLink(group.id);
    if (navigator.share) {
      await navigator.share({ title: `傳情畫意・${group.name}`, text: `加入 ${group.name}`, url });
    } else await this.copyJoinLink(group);
  }

  protected updateRoomMode(event: CustomEvent<{ value?: string | number | null }>) {
    const value = event.detail.value;
    if (value === 'activity' || value === 'tabletop')
      void this.store.updateSettings({ mode: value });
  }

  protected updateHostMode(event: CustomEvent<{ value?: string | number | boolean | null }>) {
    const value = event.detail.value;
    if (value === true || value === 'true') void this.store.updateSettings({ hostMode: true });
    if (value === false || value === 'false') void this.store.updateSettings({ hostMode: false });
  }

  protected updateDrawingSeconds(event: CustomEvent<{ value?: string | number | null }>) {
    const value = Number(event.detail.value);
    if ([0, 60, 75, 90].includes(value)) void this.store.updateSettings({ drawingSeconds: value });
  }

  protected updateGuessingSeconds(event: CustomEvent<{ value?: string | number | null }>) {
    const value = Number(event.detail.value);
    if ([0, 20, 30, 45].includes(value)) void this.store.updateSettings({ guessingSeconds: value });
  }

  protected async skipTurn(group: RelayGroup) {
    const pendingPlayers = this.store.unsubmittedPlayers(group);
    if (pendingPlayers.length === 0) {
      await this.store.skipTurn(group.id);
      return;
    }

    const isActivity = this.store.room()?.mode === 'activity';
    const names = pendingPlayers.map((player) => player.displayName).join('、');
    const alert = await this.alertController.create({
      header: '還有人尚未交卷',
      message: isActivity
        ? `${names} 尚未完成本棒。結束後會排到最後一棒，下一位將接續目前的任務。`
        : `${names} 尚未交卷。結束後，未完成者會以跳過頁記錄，並進入下一輪。`,
      buttons: [
        { text: '繼續等待', role: 'cancel' },
        {
          text: '仍要結束回合',
          role: 'destructive',
          handler: () => void this.store.skipTurn(group.id),
        },
      ],
    });
    await alert.present();
  }

  protected saveGroupName(group: RelayGroup, event: CustomEvent<{ value?: string | null }>) {
    void this.store.updateGroupName(group.id, event.detail.value ?? '');
  }

  protected movePlayer(
    event: CustomEvent<{ value?: string | number | null }>,
    playerUid: string,
    sourceId: string,
  ) {
    const targetId = event.detail.value;
    if (typeof targetId === 'string' && targetId)
      void this.store.movePlayer(playerUid, sourceId, targetId);
  }

  protected assignUnassignedPlayer(
    event: CustomEvent<{ value?: string | number | null }>,
    playerUid: string,
  ) {
    const targetId = event.detail.value;
    if (typeof targetId === 'string' && targetId) {
      void this.store.assignUnassignedPlayer(playerUid, targetId);
    }
  }

  protected playerFor(group: RelayGroup, uid: string) {
    return group.players.find((player) => player.uid === uid);
  }

  protected currentPlayer(group: RelayGroup) {
    return this.playerFor(group, group.turnOrder[group.currentTurnIndex]);
  }

  protected onDrawEnd() {
    this.hasInk.set(true);
  }

  protected undoPad() {
    const pad = this.signaturePad();
    if (!pad || this.isSubmitting()) return;
    const strokes = pad.toData();
    if (strokes.length === 0) return;
    pad.fromData(strokes.slice(0, -1));
    this.hasInk.set(strokes.length > 1);
  }

  protected async submitPage() {
    const pad = this.signaturePad();
    if (!pad || !this.hasInk() || this.isSubmitting()) return;
    this.isSubmitting.set(true);
    pad.off();
    const canvas = pad.getCanvas();
    const width = canvas.clientWidth || this.canvasWidth;
    const height = canvas.clientHeight || this.canvasHeight;
    const strokes: RelayStroke[] = pad.toData().map((group) => ({
      ...group,
      points: this.limitPoints(group.points, 320).map((point) => ({
        x: point.x / width,
        y: point.y / height,
        pressure: point.pressure,
        time: point.time,
      })),
    }));
    const accepted = await this.store.submit(strokes);
    if (accepted) {
      pad.clear();
      this.hasInk.set(false);
      pad.on();
    } else pad.on();
    this.isSubmitting.set(false);
  }

  protected points(stroke: RelayStroke): string {
    return stroke.points.map((point) => `${point.x * 1000},${point.y * 800}`).join(' ');
  }

  protected selectRevealGroup(groupId: string, showFirstCompletedPage = false) {
    if (!this.store.isHost() && this.store.myGroup()?.id !== groupId) return;
    this.selectedRevealGroupId.set(groupId);
    const group = this.store.groups().find((item) => item.id === groupId);
    const firstBook = Object.keys(group?.topicsByBook ?? {})[0] ?? '';
    this.selectedRevealBookId.set(firstBook);
    this.revealPosition.set(showFirstCompletedPage ? 1 : 0);
  }

  protected selectRevealBook(event: CustomEvent<{ value?: string | number | null }>) {
    this.selectedRevealBookId.set(typeof event.detail.value === 'string' ? event.detail.value : '');
    this.revealPosition.set(this.minimumRevealPosition());
  }

  protected previousRevealPage() {
    this.revealPosition.update((position) => Math.max(this.minimumRevealPosition(), position - 1));
  }

  protected nextRevealPage() {
    this.revealPosition.update((position) => Math.min(this.revealPageCount() - 1, position + 1));
  }

  protected updateLiveReviewMode(event: CustomEvent<{ value?: string | number | null }>) {
    const value = event.detail.value;
    if (value === 'manual' || value === 'auto') this.liveReviewMode.set(value);
  }

  protected previousLiveReviewPage() {
    const pageCount = this.liveReviewPages().length;
    if (pageCount < 2) return;
    this.liveReviewPosition.update((position) => (position - 1 + pageCount) % pageCount);
  }

  protected nextLiveReviewPage() {
    const pageCount = this.liveReviewPages().length;
    if (pageCount < 2) return;
    this.liveReviewPosition.update((position) => (position + 1) % pageCount);
  }

  protected jumpToFinalRevealPage() {
    this.revealPosition.set(Math.max(0, this.revealPageCount() - 1));
  }

  protected jumpToFirstRevealPage() {
    this.revealPosition.set(this.minimumRevealPosition());
  }

  protected minimumRevealPosition() {
    return this.isLiveHostReview() ? 1 : 0;
  }

  private joinLink(groupId: string): string {
    return `${window.location.origin}/lobby/relay/${this.store.room()?.seq}?group=${groupId}`;
  }

  private async bootstrap(seq: string) {
    try {
      await this.store.ensureAnonymousUser();
      this.store.init(seq);
      const saved = this.store.savedProfile();
      if (saved) {
        const separator = saved.displayName.indexOf('-');
        const savedDepartment = saved.displayName.slice(0, separator);
        if (
          separator > 0 &&
          DEPARTMENTS.includes(savedDepartment as (typeof DEPARTMENTS)[number])
        ) {
          this.department.set(savedDepartment as (typeof DEPARTMENTS)[number]);
          this.nickname.set(saved.displayName.slice(separator + 1));
        } else this.nickname.set(saved.displayName);
        this.avatarSeed.set(saved.avatarSeed);
      }
    } catch {
      this.store.error.set('無法建立快速加入身分，請確認 Firebase 匿名登入已啟用');
    }
  }

  private async generateQrCodes(groups: RelayGroup[]) {
    const entries = await Promise.all(
      groups.map(
        async (group) =>
          [
            group.id,
            await QRCode.toDataURL(this.joinLink(group.id), {
              width: 360,
              margin: 1,
              color: { dark: '#123b31', light: '#ffffff' },
              errorCorrectionLevel: 'M',
            }),
          ] as const,
      ),
    );
    this.qrCodes.set(Object.fromEntries(entries));
  }

  private limitPoints<T>(points: T[], limit: number): T[] {
    if (points.length <= limit) return points;
    const result: T[] = [];
    const step = (points.length - 1) / (limit - 1);
    for (let index = 0; index < limit; index++) result.push(points[Math.round(index * step)]);
    return result;
  }
}
