import { Component, effect, inject, signal } from '@angular/core';
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
import { GameStore, initialState } from './game/game.store';
import { LobbyService } from './lobby.service';

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
  private readonly lobbyService = inject(LobbyService);
  private readonly router = inject(Router);
  private readonly fs = inject(Firestore);
  private readonly sessionStore = inject(SessionStore);
  protected readonly isModalOpen = signal(false);
  roomList = signal<Room[]>([]);
  protected readonly gamedb = gamedb;

  ngOnInit() {
    const roomsRef = collection(this.fs, 'rooms');
    const q = query(roomsRef, where('status', '==', '遊戲準備中'));

    onSnapshot(q, (snapshot) => {
      const rooms: Room[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        rooms.push({
          seq: data['seq'],
          createrUID: data['roomMasterId'],
          name: data['name'] || '未命名房間',
          players: data['players']?.length || 0,
          game: this.gamedb.find((x) => x.gameCode === '001')!,
        });
      });
      this.roomList.set(rooms);
    });
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
    const seq = crypto.randomUUID().slice(0, 8);
    const createrUID = this.sessionStore.user()?.uid!;
    const roomRef = doc(this.fs, `rooms/${seq}`);

    this.lobbyService.customPrompt.set(this.createCriteria().customPrompt);

    await setDoc(roomRef, {
      ...initialState,
      seq,
      name,
      roomMasterId: createrUID,
      promptConfig: {
        customPrompt: this.createCriteria().customPrompt,
      },
    });

    this.isModalOpen.set(false);
    setTimeout(() => {
      this.router.navigate(['/lobby/rooms', seq]);
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
];
