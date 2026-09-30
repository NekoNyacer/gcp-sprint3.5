import { computed, effect, inject, signal, untracked } from '@angular/core';
import {
  doc,
  Firestore,
  onSnapshot,
  runTransaction,
  Unsubscribe,
  updateDoc,
} from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import type { PointGroup } from 'signature_pad';
import { Subscription, timer } from 'rxjs';
import { UserProfile } from '../../../shared/models/user-profile';
import { SessionStore } from '../../../shared/stores/session-store';
import { BONUS_GAME_ROOM_STORAGE_KEY } from '../bonus-game.constants';

export type ArtistRole = '尚未分配身分' | '藝術家' | '偽藝術家';

export type ArtistPlayer = Pick<UserProfile, 'displayName' | 'photoUrl'> & {
  uid: string;
  role: ArtistRole;
  color: string;
};

export type ArtistTopic = {
  category: string;
  word: string;
};

export type NormalizedPoint = {
  x: number;
  y: number;
  pressure: number;
  time: number;
};

export type ArtistStroke = Omit<PointGroup, 'points'> & {
  id: string;
  playerUid: string;
  points: NormalizedPoint[];
};

export type ArtistGameStatus =
  '遊戲準備中' | '遊戲開始倒數' | '繪圖中' | '最終作畫檢視' | '最終查找階段' | '遊戲結束';

export type ArtistGameState = {
  gameCode: '002';
  seq: string;
  name: string;
  status: ArtistGameStatus;
  isLoading: boolean;
  promptConfig: { customPrompt: string };
  roomMasterId: string;
  players: ArtistPlayer[];
  topic: ArtistTopic;
  currentPlayerIndex: number | null;
  strokes: ArtistStroke[];
  votes: Record<string, string>;
  reviewEndsAt: number | null;
  votingEndsAt: number | null;
  revealedFakeArtistUid: string | null;
};

export const artistInitialState: ArtistGameState = {
  gameCode: '002',
  seq: '',
  name: '',
  status: '遊戲準備中',
  isLoading: false,
  promptConfig: { customPrompt: '' },
  roomMasterId: '',
  players: [],
  topic: { category: '', word: '' },
  currentPlayerIndex: null,
  strokes: [],
  votes: {},
  reviewEndsAt: null,
  votingEndsAt: null,
  revealedFakeArtistUid: null,
};

const PLAYER_COLORS = [
  '#d32f2f',
  '#1976d2',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#00796b',
  '#c2185b',
  '#455a64',
  '#5d4037',
];

const FINAL_ARTWORK_REVIEW_DURATION_MS = 5_000;
const VOTING_DURATION_MS = 20_000;

const TOPICS: ArtistTopic[] = [
  { category: '水果', word: '蘋果' },
  { category: '水果', word: '鳳梨' },
  { category: '動物', word: '長頸鹿' },
  { category: '動物', word: '企鵝' },
  { category: '交通工具', word: '自行車' },
  { category: '交通工具', word: '飛機' },
  { category: '日常用品', word: '雨傘' },
  { category: '日常用品', word: '鬧鐘' },
  { category: '臺灣美食', word: '小籠包' },
  { category: '臺灣美食', word: '珍珠奶茶' },
  { category: '戶外活動', word: '露營' },
  { category: '戶外活動', word: '爬山' },
  { category: '水果', word: '香蕉' },
  { category: '水果', word: '西瓜' },
  { category: '動物', word: '大象' },
  { category: '動物', word: '烏龜' },
  { category: '交通工具', word: '機車' },
  { category: '交通工具', word: '熱氣球' },
  { category: '交通工具', word: '捷運' },
  { category: '日常用品', word: '牙刷' },
  { category: '日常用品', word: '吹風機' },
  { category: '臺灣美食', word: '臭豆腐' },
  { category: '臺灣美食', word: '雞排' },
  { category: '戶外活動', word: '衝浪' },
  { category: '戶外活動', word: '野餐' },
  { category: '職業', word: '警察' },
  { category: '職業', word: '太空人' },
  { category: '職業', word: '廚師' },
  { category: '運動', word: '籃球' },
  { category: '運動', word: '游泳' },
  { category: '運動', word: '舉重' },
  { category: '建築地標', word: '台北101' },
  { category: '建築地標', word: '城堡' },
  { category: '建築地標', word: '金字塔' },
  { category: '大自然', word: '彩虹' },
  { category: '大自然', word: '閃電' },
  { category: '大自然', word: '龍捲風' },
  { category: '文具', word: '橡皮擦' },
  { category: '文具', word: '釘書機' },
  { category: '樂器', word: '鋼琴' },
  { category: '樂器', word: '吉他' },
  { category: '服飾配件', word: '手錶' },
  { category: '服飾配件', word: '高跟鞋' },
];

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const ArtistGameStore = signalStore(
  withState(artistInitialState),
  withProps(() => ({
    firestore: inject(Firestore),
    route: inject(ActivatedRoute),
    sessionStore: inject(SessionStore),
    toastController: inject(ToastController),
    countdown: signal(0),
    reviewCountdown: signal(0),
    votingCountdown: signal(0),
  })),
  withComputed((store) => ({
    isRoomMaster: computed(() => store.sessionStore.user()?.uid === store.roomMasterId()),
    isRoomFull: computed(() => store.players().length >= 9),
    currentPlayer: computed(() => {
      const index = store.currentPlayerIndex();
      return index === null ? undefined : store.players()[index];
    }),
    me: computed(() =>
      store.players().find((player) => player.uid === store.sessionStore.user()?.uid),
    ),
    fakeArtist: computed(() =>
      store.players().find((player) => player.uid === store.revealedFakeArtistUid()),
    ),
    hasVoted: computed(() => Boolean(store.votes()[store.sessionStore.user()?.uid ?? ''])),
    votesReceived: computed(() => {
      const grouped: Record<string, ArtistPlayer[]> = {};
      for (const player of store.players()) grouped[player.uid] = [];
      for (const [voterUid, targetUid] of Object.entries(store.votes())) {
        const voter = store.players().find((player) => player.uid === voterUid);
        if (voter && grouped[targetUid]) grouped[targetUid].push(voter);
      }
      return grouped;
    }),
  })),
  withMethods((store) => {
    let roomListener: Unsubscribe | null = null;
    let countdownSubscription: Subscription | null = null;
    let reviewSubscription: Subscription | null = null;
    let votingSubscription: Subscription | null = null;

    async function toast(message: string) {
      const instance = await store.toastController.create({
        message,
        duration: 1600,
        position: 'bottom',
      });
      await instance.present();
    }

    function stopCountdowns() {
      countdownSubscription?.unsubscribe();
      countdownSubscription = null;
      reviewSubscription?.unsubscribe();
      reviewSubscription = null;
      votingSubscription?.unsubscribe();
      votingSubscription = null;
    }

    function startGameCountdown() {
      countdownSubscription?.unsubscribe();
      store.countdown.set(5);
      countdownSubscription = timer(0, 1000).subscribe((tick) => {
        const remaining = Math.max(0, 5 - tick);
        store.countdown.set(remaining);
        if (remaining === 0) {
          countdownSubscription?.unsubscribe();
          if (store.status() === '遊戲開始倒數') {
            void updateDoc(doc(store.firestore, `rooms/${store.seq()}`), { status: '繪圖中' });
          }
        }
      });
    }

    function startVotingCountdown() {
      votingSubscription?.unsubscribe();
      votingSubscription = timer(0, 250).subscribe(() => {
        const endsAt = store.votingEndsAt();
        if (!endsAt) return;
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        store.votingCountdown.set(remaining);
        if (remaining === 0) {
          votingSubscription?.unsubscribe();
          void finalizeVoting();
        }
      });
    }

    function startReviewCountdown() {
      reviewSubscription?.unsubscribe();
      reviewSubscription = timer(0, 250).subscribe(() => {
        const endsAt = store.reviewEndsAt();
        if (!endsAt) return;
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        store.reviewCountdown.set(remaining);
        if (remaining === 0) {
          reviewSubscription?.unsubscribe();
          void startVoting();
        }
      });
    }

    async function startVoting() {
      const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
      await runTransaction(store.firestore, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists()) return;
        const room = snapshot.data() as ArtistGameState;
        if (room.status !== '最終作畫檢視' || Date.now() < (room.reviewEndsAt ?? 0)) return;
        transaction.update(roomRef, {
          status: '最終查找階段',
          reviewEndsAt: null,
          votingEndsAt: Date.now() + VOTING_DURATION_MS,
        });
      });
    }

    async function finalizeVoting() {
      const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
      await runTransaction(store.firestore, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists()) return;
        const room = snapshot.data() as ArtistGameState;
        if (room.status !== '最終查找階段') return;
        const allVoted = Object.keys(room.votes ?? {}).length >= (room.players ?? []).length;
        if (!allVoted && Date.now() < (room.votingEndsAt ?? 0)) return;
        const fakeArtist = room.players.find((player) => player.role === '偽藝術家');
        transaction.update(roomRef, {
          status: '遊戲結束',
          revealedFakeArtistUid: fakeArtist?.uid ?? null,
        });
      });
    }

    return {
      stopCountdowns,
      initRoomListener(seq: string) {
        roomListener?.();
        const roomRef = doc(store.firestore, `rooms/${seq}`);
        roomListener = onSnapshot(roomRef, (snapshot) => {
          if (!snapshot.exists()) return;
          const room = snapshot.data() as ArtistGameState;
          const previousStatus = store.status();
          patchState(store, {
            ...room,
            gameCode: '002',
            players: room.players ?? [],
            topic: room.topic ?? artistInitialState.topic,
            strokes: room.strokes ?? [],
            votes: room.votes ?? {},
            reviewEndsAt: room.reviewEndsAt ?? null,
            votingEndsAt: room.votingEndsAt ?? null,
          });
          if (room.status === '遊戲開始倒數' && previousStatus !== room.status) {
            startGameCountdown();
          }
          if (room.status === '最終查找階段') {
            startVotingCountdown();
            if (Object.keys(room.votes ?? {}).length >= (room.players ?? []).length) {
              void finalizeVoting();
            }
          }
          if (room.status === '最終作畫檢視') startReviewCountdown();
        });
      },

      stopRoomListener() {
        roomListener?.();
        roomListener = null;
      },

      async joinRoom() {
        const user = store.sessionStore.user();
        if (!user?.uid || !store.seq()) return;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return;
          const room = snapshot.data() as ArtistGameState;
          const currentPlayers = room.players ?? [];
          const existingIndex = currentPlayers.findIndex((player) => player.uid === user.uid);
          if (existingIndex < 0 && room.status !== '遊戲準備中') return;
          if (existingIndex < 0 && currentPlayers.length >= 9) return;
          const profile = {
            displayName: user.displayName ?? '無名玩家',
            photoUrl: user.photoUrl ?? 'images/portraits/meeple.png',
          };
          const players = [...currentPlayers];
          if (existingIndex >= 0) {
            players[existingIndex] = { ...players[existingIndex], ...profile };
          } else {
            players.push({
              uid: user.uid,
              ...profile,
              role: '尚未分配身分',
              color: PLAYER_COLORS[currentPlayers.length],
            });
          }
          transaction.update(roomRef, { players });
        });
        localStorage.setItem(BONUS_GAME_ROOM_STORAGE_KEY, store.seq());
      },

      async leaveRoom() {
        const uid = store.sessionStore.user()?.uid;
        if (!uid || !store.seq()) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        const didLeave = await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return true;
          const room = snapshot.data() as ArtistGameState;
          if (room.status !== '遊戲準備中') return false;
          const priorPlayers = room.players ?? [];
          const masterIndex = priorPlayers.findIndex((player) => player.uid === room.roomMasterId);
          const players = priorPlayers.filter((player) => player.uid !== uid);
          if (players.length === 0) {
            transaction.delete(roomRef);
          } else {
            transaction.update(roomRef, {
              players,
              ...(room.roomMasterId === uid
                ? { roomMasterId: players[Math.max(0, masterIndex) % players.length].uid }
                : {}),
            });
          }
          return true;
        });
        if (didLeave) localStorage.removeItem(BONUS_GAME_ROOM_STORAGE_KEY);
        return didLeave;
      },

      async generateTopic() {
        if (!store.isRoomMaster() || store.status() !== '遊戲準備中') return;
        const requestedCategory = store.promptConfig().customPrompt.trim();
        const candidates = requestedCategory
          ? TOPICS.filter((topic) => topic.category.includes(requestedCategory))
          : TOPICS;
        const pool = candidates.length > 0 ? candidates : TOPICS;
        const topic = pool[Math.floor(Math.random() * pool.length)];
        await updateDoc(doc(store.firestore, `rooms/${store.seq()}`), { topic });
      },

      async startProcess() {
        if (!store.isRoomMaster()) return;
        if (store.players().length < 3) {
          await toast('玩家未達3人無法開始遊戲');
          return;
        }
        if (!store.topic().category || !store.topic().word) {
          await toast('題目尚未準備完成');
          return;
        }
        const drawOrder = shuffled(store.players());
        const fakeArtistIndex = Math.floor(Math.random() * drawOrder.length);
        const players = drawOrder.map((player, index) => ({
          ...player,
          role: (index === fakeArtistIndex ? '偽藝術家' : '藝術家') as ArtistRole,
        }));
        await updateDoc(doc(store.firestore, `rooms/${store.seq()}`), {
          players,
          status: '遊戲開始倒數',
          currentPlayerIndex: 0,
          strokes: [],
          votes: {},
          reviewEndsAt: null,
          votingEndsAt: null,
          revealedFakeArtistUid: null,
        });
      },

      async submitStroke(stroke: ArtistStroke) {
        const uid = store.sessionStore.user()?.uid;
        if (!uid || !store.seq()) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        return runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return false;
          const room = snapshot.data() as ArtistGameState;
          const currentPlayer = room.players?.[room.currentPlayerIndex ?? -1];
          if (room.status !== '繪圖中' || currentPlayer?.uid !== uid) return false;
          const strokes = [...(room.strokes ?? []), stroke];
          const totalTurns = room.players.length * 2;
          if (strokes.length >= totalTurns) {
            transaction.update(roomRef, {
              strokes,
              status: '最終作畫檢視',
              currentPlayerIndex: null,
              reviewEndsAt: Date.now() + FINAL_ARTWORK_REVIEW_DURATION_MS,
              votingEndsAt: null,
            });
          } else {
            transaction.update(roomRef, {
              strokes,
              currentPlayerIndex: ((room.currentPlayerIndex ?? 0) + 1) % room.players.length,
            });
          }
          return true;
        });
      },

      async voteFor(targetUid: string) {
        const voterUid = store.sessionStore.user()?.uid;
        if (!voterUid || voterUid === targetUid || store.hasVoted()) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        const didVote = await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return false;
          const room = snapshot.data() as ArtistGameState;
          const votes = room.votes ?? {};
          if (
            room.status !== '最終查找階段' ||
            votes[voterUid] ||
            !room.players.some((player) => player.uid === targetUid && player.uid !== voterUid)
          ) {
            return false;
          }
          transaction.update(roomRef, { votes: { ...votes, [voterUid]: targetUid } });
          return true;
        });
        return didVote;
      },

      async reset() {
        if (!store.isRoomMaster()) return;
        const players = store.players().map((player) => ({
          ...player,
          role: '尚未分配身分' as ArtistRole,
        }));
        await updateDoc(doc(store.firestore, `rooms/${store.seq()}`), {
          status: '遊戲準備中',
          players,
          topic: { category: '', word: '' },
          currentPlayerIndex: null,
          strokes: [],
          votes: {},
          reviewEndsAt: null,
          votingEndsAt: null,
          revealedFakeArtistUid: null,
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const seq = store.route.snapshot.paramMap.get('seq') ?? '';
      if (seq) {
        patchState(store, { seq });
        store.initRoomListener(seq);
      }
      effect(() => {
        const user = store.sessionStore.user();
        if (user?.uid && store.seq()) untracked(() => void store.joinRoom());
      });
      effect(() => {
        if (store.isRoomMaster() && store.status() === '遊戲準備中' && !store.topic().category) {
          untracked(() => void store.generateTopic());
        }
      });
    },
    onDestroy(store) {
      store.stopCountdowns();
      store.stopRoomListener();
    },
  }),
);
