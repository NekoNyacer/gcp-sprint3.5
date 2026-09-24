import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, max, maxLength, minLength, required } from '@angular/forms/signals';
import {
  collection,
  doc,
  Firestore,
  onSnapshot,
  query,
  setDoc,
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
export class LobbyComponent {
  private readonly router = inject(Router);
  private readonly fs = inject(Firestore);
  private readonly sessionStore = inject(SessionStore);
  protected readonly isModalOpen = signal(false);
  private readonly readyRooms = signal<Room[]>([]);
  private readonly savedRoom = signal<Room | null>(null);
  readonly roomList = computed(() => {
    const currentUserId = this.sessionStore.user()?.uid;
    const savedRoom = this.savedRoom();
    const rooms = [...this.readyRooms()];

    if (
      savedRoom &&
      savedRoom.playerUids.includes(currentUserId ?? '') &&
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
    const roomsRef = collection(this.fs, 'rooms');
    const readyRoomsQuery = query(roomsRef, where('status', '==', '遊戲準備中'));

    onSnapshot(readyRoomsQuery, (snapshot) => {
      this.readyRooms.set(
        snapshot.docs.map((roomSnapshot) => this.toRoom(roomSnapshot.data(), roomSnapshot.id)),
      );
    });

    const savedRoomSeq = localStorage.getItem(BONUS_GAME_ROOM_STORAGE_KEY);
    if (savedRoomSeq) {
      onSnapshot(doc(this.fs, `rooms/${savedRoomSeq}`), (roomSnapshot) => {
        if (!roomSnapshot.exists()) {
          this.savedRoom.set(null);
          localStorage.removeItem(BONUS_GAME_ROOM_STORAGE_KEY);
          return;
        }

        this.savedRoom.set(this.toRoom(roomSnapshot.data(), roomSnapshot.id));
      });
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
    maxLength(s.roomName, 8, { message: '房間名稱不得超過8字' });
    minLength(s.roomName, 3, { message: '房間名稱至少提供3字' });
    maxLength(s.customPrompt, 20, { message: '客製的提示詞不得超過20字' });
  });

  async create() {
    let name = this.createCriteria().roomName;
    const gameCode = this.createCriteria().gameCode;
    const seq = crypto.randomUUID().slice(0, 8);
    const createrUID = this.sessionStore.user()?.uid!;
    const roomRef = doc(this.fs, `rooms/${seq}`);

    const state =
      gameCode === '002'
        ? artistInitialState
        : gameCode === '003'
          ? spyfallInitialState
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
    });

    this.isModalOpen.set(false);
    setTimeout(() => {
      const roomPath =
        gameCode === '002'
          ? '/lobby/artist-rooms'
          : gameCode === '003'
            ? '/lobby/spyfall-rooms'
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
    boxImageURL: 'https://pimg.1px.tw/punchboardgame/1673508385-224911250-g.jpg',
    maximumPlayer: 9,
    description:
      '《瞎掰王 9UPPER》是款聚會聊天、講幹話設計的熱門派對桌上遊戲。玩家需要絞盡腦汁，欺騙猜題人。',
  },
  {
    gameCode: '002',
    name: '誰是偽藝術家',
    boxImageURL: 'images/bonus-games/fake-artist.svg',
    maximumPlayer: 9,
    description: '大家輪流在同一張畫上留下一筆，藝術家要畫出題目，偽藝術家則要邊猜邊蒙混過關。',
  },
  {
    gameCode: '003',
    name: '間諜危機 Spyfall',
    boxImageURL: 'images/bonus-games/spyfall.svg',
    maximumPlayer: 9,
    description: '只有間諜不知道大家所在的場所。用線索試探彼此，在時間內找出混入人群的間諜。',
  },
];
