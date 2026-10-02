import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { form, FormField, max, maxLength, minLength, required } from '@angular/forms/signals';
import {
  collection,
  doc,
  Firestore,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  where,
} from '@angular/fire/firestore';
import {
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonIcon,
  IonButton,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonModal,
  IonButtons,
  IonList,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonLabel,
  IonInput,
  IonTextarea,
  IonText,
} from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../shared/stores/session-store';
import { BONUS_GAME_ROOM_STORAGE_KEY } from './bonus-game.constants';
import { nineUpperInitialState } from './nine-upper/nine-upper.store';
import { artistInitialState } from './artist-game/artist-game.store';
import { spyfallInitialState } from './spyfall-game/spyfall-game.store';
import { relayInitialState } from './relay-game/relay-game.models';
import { ensureBonusGameUser } from './bonus-game-auth';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss'],
  imports: [
    RouterLink,
    FormField,
    IonIcon,
    IonContent,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonModal,
    IonButtons,
    IonList,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonTextarea,
    IonText,
  ],
})
export class LobbyComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly fs = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly sessionStore = inject(SessionStore);
  private readonly listeners: Unsubscribe[] = [];
  protected readonly isModalOpen = signal(false);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  private readonly readyRooms = signal<Room[]>([]);
  private readonly savedRoom = signal<Room | null>(null);
  readonly roomList = computed(() => {
    const currentUserId = this.sessionStore.user()?.uid;
    const savedRoom = this.savedRoom();
    const rooms = [...this.readyRooms()];

    if (
      savedRoom &&
      (savedRoom.playerUids.includes(currentUserId ?? '') ||
        savedRoom.createrUID === currentUserId) &&
      !rooms.some((room) => room.seq === savedRoom.seq)
    ) {
      rooms.unshift(savedRoom);
    }

    return rooms;
  });
  protected readonly gamedb = gamedb;
  protected readonly selectedGame = computed(() =>
    this.gamedb.find((game) => game.gameCode === this.createCriteria().gameCode),
  );

  ngOnInit() {
    void this.initializeLobby();
  }

  ngOnDestroy() {
    for (const unsubscribe of this.listeners) unsubscribe();
  }

  private async initializeLobby() {
    try {
      await ensureBonusGameUser(this.auth);
      this.startRoomListeners();
    } catch (error) {
      console.error('無法建立遊戲大廳身分:', error);
      this.loadError.set('無法建立免登入身分，請重新整理後再試');
      this.isLoading.set(false);
    }
  }

  private startRoomListeners() {
    const roomsRef = collection(this.fs, 'rooms');
    const readyRoomsQuery = query(roomsRef, where('status', '==', '遊戲準備中'));

    this.listeners.push(
      onSnapshot(
        readyRoomsQuery,
        (snapshot) => {
          this.readyRooms.set(
            snapshot.docs.map((roomSnapshot) => this.toRoom(roomSnapshot.data(), roomSnapshot.id)),
          );
          this.isLoading.set(false);
        },
        (error) => {
          console.error('無法讀取遊戲房間:', error);
          this.loadError.set('無法讀取遊戲房間，請確認網路後重試');
          this.isLoading.set(false);
        },
      ),
    );

    const savedRoomSeq = localStorage.getItem(BONUS_GAME_ROOM_STORAGE_KEY);
    if (savedRoomSeq) {
      this.listeners.push(
        onSnapshot(
          doc(this.fs, `rooms/${savedRoomSeq}`),
          (roomSnapshot) => {
            if (!roomSnapshot.exists()) {
              this.savedRoom.set(null);
              localStorage.removeItem(BONUS_GAME_ROOM_STORAGE_KEY);
              return;
            }

            this.savedRoom.set(this.toRoom(roomSnapshot.data(), roomSnapshot.id));
          },
          (error) => console.error('無法讀取上次的遊戲房間:', error),
        ),
      );
    }
  }

  private toRoom(data: Record<string, any>, fallbackSeq: string): Room {
    const players = Array.isArray(data['players']) ? data['players'] : [];

    return {
      seq: data['seq'] || fallbackSeq,
      createrUID: data['roomMasterId'],
      name: data['name'] || '未命名房間',
      players: players.length,
      playerUids: players.flatMap((player) =>
        typeof player?.uid === 'string' ? [player.uid] : [],
      ),
      status: data['status'] || '遊戲準備中',
      game: this.gamedb.find((x) => x.gameCode === (data['gameCode'] || '001')) ?? this.gamedb[0],
    };
  }

  private readonly createCriteria = signal<CreateRoom>({
    roomName: '',
    gameCode: '',
    customPrompt: '',
  });

  createForm = form(this.createCriteria, (s) => {
    required(s.gameCode, { message: '請選擇要建立的遊戲' });
    required(s.roomName, { message: '請輸入房間名稱' });
    maxLength(s.roomName, 20, { message: '房間名稱不得超過20字' });
    minLength(s.roomName, 3, { message: '房間名稱至少提供3字' });
    maxLength(s.customPrompt, 20, { message: '客製的提示詞不得超過20字' });
  });

  async create() {
    let name = this.createCriteria().roomName;
    const gameCode = this.createCriteria().gameCode;
    const seq = crypto.randomUUID().slice(0, 8);
    const createrUID = (await ensureBonusGameUser(this.auth)).uid;
    const roomRef = doc(this.fs, `rooms/${seq}`);

    const state =
      gameCode === '002'
        ? artistInitialState
        : gameCode === '003'
          ? spyfallInitialState
          : gameCode === '004'
            ? relayInitialState
            : nineUpperInitialState;

    await setDoc(roomRef, {
      ...state,
      gameCode,
      seq,
      name,
      roomMasterId: createrUID,
      promptConfig: {
        customPrompt: this.createCriteria().customPrompt,
      },
      createdAt: Date.now(),
    });

    // A dedicated host is intentionally absent from the player roster, so save the
    // room at creation time as well as when a player joins.
    localStorage.setItem(BONUS_GAME_ROOM_STORAGE_KEY, seq);

    this.isModalOpen.set(false);
    setTimeout(() => {
      const roomPath =
        gameCode === '002'
          ? '/lobby/artist-rooms'
          : gameCode === '003'
            ? '/lobby/spyfall-rooms'
            : gameCode === '004'
              ? '/lobby/relay'
              : '/lobby/rooms';
      this.router.navigate([roomPath, seq]);
    }, 300);
  }

  toggleModal(isOpen: boolean) {
    this.isModalOpen.set(isOpen);
  }
}

type CreateRoom = {
  gameCode: string;
  roomName: string;
  config1?: number;
  config2?: number;
  config3?: number;
  customPrompt: string;
};

type Room = {
  createrUID: string;
  seq: string;
  name: string;
  players: number;
  playerUids: string[];
  status: string;
  game: Game;
};

type Game = {
  gameCode: string;
  name: string;
  boxImageURL: string;
  maximumPlayer: number;
  description: string;
};

const gamedb: Game[] = [
  {
    gameCode: '001',
    name: '瞎掰王 9UPPER',
    boxImageURL: 'images/bonus-games/9UPPER.svg',
    maximumPlayer: 9,
    description:
      '這是一款非常適合聚會聊天型的知識型桌上遊戲。玩家需要絞盡腦汁，想辦法用最能說服的言語來欺騙其他玩家！',
  },
  {
    gameCode: '002',
    name: '偽藝術家 A fake artist goes to New York ',
    boxImageURL: 'images/bonus-games/fake-artist.svg',
    maximumPlayer: 9,
    description: '你們這群藝術家中混入了一名偽藝術家！？藉由觀察每個人的畫跡，找出偽藝術家。',
  },
  {
    gameCode: '003',
    name: '間諜危機 Spyfall',
    boxImageURL: 'images/bonus-games/spyfall.svg',
    maximumPlayer: 9,
    description: '間諜就在我們之中！只有他不知道目前的場所。用線索試探彼此，在時間內找出間諜吧！',
  },
  {
    gameCode: '004',
    name: '傳情畫意 Telestrations',
    boxImageURL: 'images/bonus-games/relay-drawing.svg',
    maximumPlayer: 100,
    description: '發揮你們的想像力與繪畫功力吧！原來同個物品在每個人的眼中如此不同。',
  },
];
