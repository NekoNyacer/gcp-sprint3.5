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
import { Subscription, timer } from 'rxjs';
import { UserProfile } from '../../../shared/models/user-profile';
import { SessionStore } from '../../../shared/stores/session-store';
import { BONUS_GAME_ROOM_STORAGE_KEY } from '../bonus-game.constants';

export const spyfallInitialState: SpyfallGameState = {
  gameCode: '003',
  seq: '',
  name: '',
  status: '遊戲準備中',
  isLoading: false,
  promptConfig: { customPrompt: '' },
  roomMasterId: '',
  players: [],
  settings: {
    locationHintCount: 10,
    durationSeconds: 300,
    spyCount: 1,
  },
  location: null,
  locationHints: [],
  currentSpeakerIndex: null,
  countdownEndsAt: null,
  gameEndsAt: null,
  activeAccusation: null,
  lastAccusationNoVote: null,
  winner: null,
  endReason: null,
  accusedUid: null,
  alreadyProposedUid: [],
};

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function nextRandomIndex(length: number, currentIndex: number | null): number {
  if (length <= 1) return 0;
  const candidates = Array.from({ length }, (_, index) => index).filter(
    (index) => index !== currentIndex,
  );
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export const SpyfallGameStore = signalStore(
  withState(spyfallInitialState),
  withProps(() => ({
    firestore: inject(Firestore),
    route: inject(ActivatedRoute),
    sessionStore: inject(SessionStore),
    toastController: inject(ToastController),
    countdown: signal(0),
    remainingSeconds: signal(0),
  })),
  withComputed((store) => {
    const me = computed(() =>
      store.players().find((player) => player.uid === store.sessionStore.user()?.uid),
    );
    return {
      hasProposed: computed(() => store.alreadyProposedUid().includes(me()!.uid)),
      isRoomMaster: computed(() => store.roomMasterId() === store.sessionStore.user()?.uid),
      isRoomFull: computed(() => store.players().length >= 9),
      me,
      currentSpeaker: computed(() => {
        const index = store.currentSpeakerIndex();
        return index === null ? undefined : store.players()[index];
      }),
      accusedPlayer: computed(() =>
        store.players().find((player) => player.uid === store.accusedUid()),
      ),
      accusationTarget: computed(() =>
        store.players().find((player) => player.uid === store.activeAccusation()?.targetUid),
      ),
      accusationProposer: computed(() =>
        store.players().find((player) => player.uid === store.activeAccusation()?.proposerUid),
      ),
      hasVotedOnAccusation: computed(() => {
        const uid = store.sessionStore.user()?.uid ?? '';
        return uid in (store.activeAccusation()?.votes ?? {});
      }),
      yesVoteCount: computed(
        () => Object.values(store.activeAccusation()?.votes ?? {}).filter(Boolean).length,
      ),
      majorityNeeded: computed(() => Math.floor(store.players().length / 2) + 1),
    };
  }),
  withMethods((store) => {
    let roomListener: Unsubscribe | null = null;
    let countdownSubscription: Subscription | null = null;
    let gameTimerSubscription: Subscription | null = null;

    async function toast(message: string) {
      const instance = await store.toastController.create({
        message,
        duration: 1600,
        position: 'bottom',
      });
      await instance.present();
    }

    function stopTimers() {
      countdownSubscription?.unsubscribe();
      countdownSubscription = null;
      gameTimerSubscription?.unsubscribe();
      gameTimerSubscription = null;
    }

    async function beginSpeaking() {
      const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
      await runTransaction(store.firestore, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists()) return;
        const room = snapshot.data() as SpyfallGameState;
        if (room.status !== '遊戲開始倒數') return;
        transaction.update(roomRef, {
          status: '發言階段',
          countdownEndsAt: null,
          gameEndsAt: Date.now() + room.settings.durationSeconds * 1000,
        });
      });
    }

    async function finishByTimeout() {
      const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
      await runTransaction(store.firestore, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists()) return;
        const room = snapshot.data() as SpyfallGameState;
        if (room.status !== '發言階段' || Date.now() < (room.gameEndsAt ?? 0)) return;
        transaction.update(roomRef, {
          status: '遊戲結束',
          winner: '間諜',
          endReason: '時間結束',
          activeAccusation: null,
        });
      });
    }

    function startCountdown() {
      countdownSubscription?.unsubscribe();
      store.countdown.set(5);
      countdownSubscription = timer(0, 250).subscribe(() => {
        const remaining = Math.max(
          0,
          Math.ceil(((store.countdownEndsAt() ?? Date.now()) - Date.now()) / 1000),
        );
        store.countdown.set(remaining);
        if (remaining === 0) {
          countdownSubscription?.unsubscribe();
          void beginSpeaking();
        }
      });
    }

    function startGameTimer() {
      gameTimerSubscription?.unsubscribe();
      gameTimerSubscription = timer(0, 250).subscribe(() => {
        const endsAt = store.gameEndsAt();
        if (!endsAt) return;
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        store.remainingSeconds.set(remaining);
        if (remaining === 0) {
          gameTimerSubscription?.unsubscribe();
          void finishByTimeout();
        }
      });
    }

    return {
      stopTimers,
      initRoomListener(seq: string) {
        roomListener?.();
        let lastNoVoteEventId: string | null | undefined;
        roomListener = onSnapshot(doc(store.firestore, `rooms/${seq}`), (snapshot) => {
          if (!snapshot.exists()) return;
          const room = snapshot.data() as SpyfallGameState;
          const noVoteEvent = room.lastAccusationNoVote;
          if (
            lastNoVoteEventId !== undefined &&
            noVoteEvent &&
            noVoteEvent.id !== lastNoVoteEventId
          ) {
            const voterName =
              room.players?.find((player) => player.uid === noVoteEvent.voterUid)?.displayName ??
              '玩家';
            void toast(`${voterName} 投下反對票，指控失敗`);
          }
          lastNoVoteEventId = noVoteEvent?.id ?? null;
          const previousStatus = store.status();
          patchState(store, {
            ...room,
            gameCode: '003',
            players: room.players ?? [],
            settings: room.settings ?? spyfallInitialState.settings,
            locationHints: room.locationHints ?? [],
            activeAccusation: room.activeAccusation ?? null,
          });
          if (room.status === '遊戲開始倒數' && previousStatus !== room.status) {
            startCountdown();
          }
          if (room.status === '發言階段') startGameTimer();
          if (room.status === '遊戲結束') stopTimers();
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
          const room = snapshot.data() as SpyfallGameState;
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
              occupation: '',
            });
          }
          const settings =
            players.length < 6 && room.settings.spyCount === 2
              ? { ...room.settings, spyCount: 1 }
              : room.settings;
          transaction.update(roomRef, { players, settings });
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
          const room = snapshot.data() as SpyfallGameState;
          if (room.status !== '遊戲準備中') return false;
          const priorPlayers = room.players ?? [];
          const masterIndex = priorPlayers.findIndex((player) => player.uid === room.roomMasterId);
          const players = priorPlayers.filter((player) => player.uid !== uid);
          if (players.length === 0) {
            transaction.delete(roomRef);
          } else {
            transaction.update(roomRef, {
              players,
              settings: {
                ...room.settings,
                spyCount: players.length < 6 ? 1 : room.settings.spyCount,
              },
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

      async updateSettings(settings: SpyfallSettings) {
        if (!store.isRoomMaster() || store.status() !== '遊戲準備中') return false;
        const validated: SpyfallSettings = {
          locationHintCount: Math.min(
            SPYFALL_LOCATIONS.length,
            Math.max(5, settings.locationHintCount),
          ),
          durationSeconds: [60, 180, 300, 480, 600].includes(settings.durationSeconds)
            ? settings.durationSeconds
            : 300,
          spyCount: settings.spyCount === 2 && store.players().length >= 6 ? 2 : 1,
        };
        await updateDoc(doc(store.firestore, `rooms/${store.seq()}`), { settings: validated });
        return true;
      },

      async startProcess() {
        if (!store.isRoomMaster()) return;
        if (store.players().length < 3) {
          await toast('玩家未達3人無法開始遊戲');
          return;
        }
        if (store.settings().spyCount === 2 && store.players().length < 6) {
          await toast('6人以上才能設定2位間諜');
          return;
        }

        const location = shuffled(SPYFALL_LOCATIONS)[0];
        const otherLocations = shuffled(
          SPYFALL_LOCATIONS.filter((candidate) => candidate.name !== location.name),
        ).slice(0, store.settings().locationHintCount - 1);
        const locationHints = shuffled([location, ...otherLocations]).map((item) => item.name);
        const spyUids = new Set(
          shuffled(store.players())
            .slice(0, store.settings().spyCount)
            .map((player) => player.uid),
        );
        const occupations = shuffled(location.occupations);
        let occupationIndex = 0;
        const players = store.players().map((player) => {
          const isSpy = spyUids.has(player.uid);
          return {
            ...player,
            role: (isSpy ? '間諜' : '普通人') as SpyfallRole,
            occupation: isSpy ? '' : occupations[occupationIndex++ % occupations.length],
          };
        });

        await updateDoc(doc(store.firestore, `rooms/${store.seq()}`), {
          players,
          location,
          locationHints,
          status: '遊戲開始倒數',
          currentSpeakerIndex: nextRandomIndex(players.length, null),
          countdownEndsAt: Date.now() + 5_000,
          gameEndsAt: null,
          activeAccusation: null,
          lastAccusationNoVote: null,
          winner: null,
          endReason: null,
          accusedUid: null,
        });
      },

      async finishSpeakingTurn() {
        const uid = store.sessionStore.user()?.uid;
        if (!uid) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        return runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return false;
          const room = snapshot.data() as SpyfallGameState;
          if (Date.now() >= (room.gameEndsAt ?? 0)) {
            transaction.update(roomRef, {
              status: '遊戲結束',
              winner: '間諜',
              endReason: '時間結束',
              activeAccusation: null,
            });
            return false;
          }
          const currentSpeaker = room.players[room.currentSpeakerIndex ?? -1];
          if (
            room.status !== '發言階段' ||
            room.activeAccusation ||
            (currentSpeaker?.uid !== uid && room.roomMasterId !== uid)
          ) {
            return false;
          }
          transaction.update(roomRef, {
            currentSpeakerIndex: nextRandomIndex(room.players.length, room.currentSpeakerIndex),
          });
          return true;
        });
      },

      //間諜:指出本局地點
      async assertLocation(assertLocation: string) {
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        return runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return false;
          const room = snapshot.data() as SpyfallGameState;
          if (room.location?.name === assertLocation) {
            transaction.update(roomRef, {
              status: '遊戲結束',
              winner: '間諜',
              endReason: '間諜猜出地點了',
              activeAccusation: null,
            });
            return false;
          } else {
            transaction.update(roomRef, {
              status: '遊戲結束',
              winner: '普通人',
              endReason: '間諜猜錯地點了',
              activeAccusation: null,
            });
            return false;
          }
        });
      },

      async accuse(targetUid: string) {
        const proposerUid = store.sessionStore.user()?.uid;
        if (!proposerUid || proposerUid === targetUid) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        return runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return false;
          const room = snapshot.data() as SpyfallGameState;
          if (Date.now() >= (room.gameEndsAt ?? 0)) {
            transaction.update(roomRef, {
              status: '遊戲結束',
              winner: '間諜',
              endReason: '時間結束',
              activeAccusation: null,
            });
            return false;
          }
          const proposer = room.players.find((player) => player.uid === proposerUid);
          const alreadyProposedUid = room.alreadyProposedUid ?? [];
          if (
            !proposer ||
            room.status !== '發言階段' ||
            room.activeAccusation ||
            alreadyProposedUid.includes(proposerUid) ||
            !room.players.some((player) => player.uid === targetUid)
          ) {
            return false;
          }
          transaction.update(roomRef, {
            activeAccusation: {
              proposerUid,
              targetUid,
              votes: { [proposerUid]: true },
            },
            alreadyProposedUid: [...alreadyProposedUid, proposerUid],
          });
          return true;
        });
      },

      async voteOnAccusation(agree: boolean) {
        const uid = store.sessionStore.user()?.uid;
        if (!uid) return false;
        const noVoteEventId = crypto.randomUUID();
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        return runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return false;
          const room = snapshot.data() as SpyfallGameState;
          if (Date.now() >= (room.gameEndsAt ?? 0)) {
            transaction.update(roomRef, {
              status: '遊戲結束',
              winner: '間諜',
              endReason: '時間結束',
              activeAccusation: null,
            });
            return false;
          }
          const accusation = room.activeAccusation;
          if (
            room.status !== '發言階段' ||
            !accusation ||
            uid in accusation.votes ||
            !room.players.some((player) => player.uid === uid)
          ) {
            return false;
          }
          const votes = { ...accusation.votes, [uid]: agree };
          const yesVotes = Object.values(votes).filter((vote) => vote === true).length;
          const hasNoVote = Object.values(votes).some((vote) => vote === false);
          const majority = room.players.length - 1;

          if (yesVotes == majority) {
            const accused = room.players.find((player) => player.uid === accusation.targetUid);
            const caughtSpy = accused?.role === '間諜';
            transaction.update(roomRef, {
              status: '遊戲結束',
              winner: caughtSpy ? '普通人' : '間諜',
              endReason: caughtSpy ? '抓到間諜' : '錯抓普通人',
              accusedUid: accusation.targetUid,
              activeAccusation: null,
            });
          } else if (hasNoVote) {
            transaction.update(roomRef, {
              activeAccusation: null,
              lastAccusationNoVote: { id: noVoteEventId, voterUid: uid },
            });
          } else {
            transaction.update(roomRef, { activeAccusation: { ...accusation, votes } });
          }
          return true;
        });
      },

      async reset() {
        if (!store.isRoomMaster()) return;
        const players = store.players().map((player) => ({
          ...player,
          role: '尚未分配身分' as SpyfallRole,
          occupation: '',
        }));
        await updateDoc(doc(store.firestore, `rooms/${store.seq()}`), {
          status: '遊戲準備中',
          players,
          location: null,
          locationHints: [],
          currentSpeakerIndex: null,
          countdownEndsAt: null,
          gameEndsAt: null,
          activeAccusation: null,
          lastAccusationNoVote: null,
          winner: null,
          endReason: null,
          accusedUid: null,
          alreadyProposedUid: [],
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
    },
    onDestroy(store) {
      store.stopTimers();
      store.stopRoomListener();
    },
  }),
);
export const SPYFALL_LOCATIONS: SpyfallLocation[] = [
  {
    name: '醫院',
    occupations: [
      '醫生',
      '護士',
      '清潔人員',
      '病患',
      '藥師',
      '放射師',
      '掛號人員',
      '家屬',
      '救護員',
    ],
  },
  {
    name: '餐廳',
    occupations: [
      '廚師',
      '服務生',
      '店長',
      '客人',
      '洗碗人員',
      '外送員',
      '採購',
      '收銀員',
      '品酒師',
    ],
  },
  {
    name: '飯店',
    occupations: [
      '櫃檯人員',
      '房務員',
      '旅客',
      '門房',
      '行李員',
      '飯店經理',
      '廚師',
      '工程人員',
      '保全',
    ],
  },
  {
    name: '機場',
    occupations: [
      '機師',
      '空服員',
      '旅客',
      '地勤人員',
      '海關',
      '安檢員',
      '行李員',
      '航管員',
      '免稅店員',
    ],
  },
  {
    name: '學校',
    occupations: ['老師', '學生', '校長', '護理師', '圖書館員', '警衛', '廚師', '家長', '工友'],
  },
  {
    name: '銀行',
    occupations: [
      '行員',
      '客戶',
      '理財專員',
      '經理',
      '保全',
      '出納',
      '房貸專員',
      '稽核員',
      '運鈔員',
    ],
  },
  {
    name: '超級市場',
    occupations: [
      '收銀員',
      '理貨員',
      '客人',
      '店長',
      '試吃推廣員',
      '生鮮師傅',
      '保全',
      '外送員',
      '清潔人員',
    ],
  },
  {
    name: '警察局',
    occupations: [
      '警察',
      '偵查隊員',
      '報案人',
      '嫌疑人',
      '律師',
      '鑑識人員',
      '值班人員',
      '分局長',
      '社工',
    ],
  },
  {
    name: '海灘',
    occupations: [
      '救生員',
      '遊客',
      '衝浪教練',
      '冰品販售員',
      '攝影師',
      '漁夫',
      '潛水員',
      '清潔人員',
      '巡邏員',
    ],
  },
  {
    name: '電影片場',
    occupations: [
      '導演',
      '演員',
      '攝影師',
      '燈光師',
      '化妝師',
      '場務',
      '製片人',
      '編劇',
      '臨時演員',
    ],
  },
  {
    name: '郵輪',
    occupations: [
      '船長',
      '旅客',
      '水手',
      '廚師',
      '娛樂主持人',
      '救生員',
      '調酒師',
      '船醫',
      '清潔人員',
    ],
  },
  {
    name: '博物館',
    occupations: [
      '館長',
      '導覽員',
      '遊客',
      '保全',
      '修復師',
      '研究員',
      '清潔人員',
      '票務員',
      '學生',
    ],
  },
  {
    name: '遊樂園',
    occupations: [
      '遊客',
      '機台操作員',
      '吉祥物演員',
      '售票員',
      '維修員',
      '保全',
      '攤販老闆',
      '清潔人員',
      '急救員',
    ],
  },
  {
    name: '婚禮現場',
    occupations: [
      '新郎',
      '新娘',
      '婚禮主持人',
      '攝影師',
      '宴會服務生',
      '家屬',
      '來賓',
      '化妝師',
      '樂手',
    ],
  },
  {
    name: '健身房',
    occupations: [
      '健身教練',
      '會員',
      '櫃檯人員',
      '瑜珈老師',
      '清潔人員',
      '營養師',
      '維修員',
      '推銷員',
      '物理治療師',
    ],
  },
  {
    name: '火車站',
    occupations: [
      '列車長',
      '旅客',
      '售票員',
      '站務員',
      '保全',
      '行李員',
      '店員',
      '維修員',
      '清潔人員',
    ],
  },
  {
    name: '咖啡廳',
    occupations: [
      '咖啡師',
      '客人',
      '店長',
      '外送員',
      '烘豆師',
      '糕點師',
      '服務生',
      '清潔人員',
      '採購',
    ],
  },
  {
    name: '建築工地',
    occupations: [
      '建築師',
      '工地主任',
      '工人',
      '安全管理員',
      '吊車操作員',
      '水電工',
      '水泥師傅',
      '檢查員',
      '供應商',
    ],
  },
  {
    name: '動物園',
    occupations: [
      '飼養員',
      '獸醫',
      '遊客',
      '導覽員',
      '售票員',
      '研究員',
      '清潔人員',
      '保全',
      '紀念品店員',
    ],
  },
  {
    name: '太空站',
    occupations: [
      '太空人',
      '指揮官',
      '工程師',
      '科學家',
      '醫官',
      '機械臂操作員',
      '通訊專家',
      '生物學家',
      '任務專家',
    ],
  },
];

export type SpyfallRole = '尚未分配身分' | '間諜' | '普通人';

export type SpyfallPlayer = Pick<UserProfile, 'displayName' | 'photoUrl'> & {
  uid: string;
  role: SpyfallRole;
  occupation: string;
};

export type SpyfallSettings = {
  locationHintCount: number;
  durationSeconds: number;
  spyCount: number;
};

export type SpyfallLocation = {
  name: string;
  occupations: string[];
};

export type SpyfallAccusation = {
  proposerUid: string;
  targetUid: string;
  votes: Record<string, boolean>;
};

export type SpyfallNoVoteEvent = {
  id: string;
  voterUid: string;
};

export type SpyfallWinner = '普通人' | '間諜' | null;
export type SpyfallEndReason =
  '抓到間諜' | '抓到普通人' | '時間截止' | '間諜猜出地點了' | '間諜猜錯地點了' | null;
export type SpyfallStatus = '遊戲準備中' | '遊戲開始倒數' | '發言階段' | '遊戲結束';

export type SpyfallGameState = {
  gameCode: '003';
  seq: string;
  name: string;
  status: SpyfallStatus;
  isLoading: boolean;
  promptConfig: { customPrompt: string };
  roomMasterId: string;
  players: SpyfallPlayer[];
  settings: SpyfallSettings;
  location: SpyfallLocation | null;
  locationHints: string[];
  currentSpeakerIndex: number | null;
  countdownEndsAt: number | null;
  gameEndsAt: number | null;
  activeAccusation: SpyfallAccusation | null;
  lastAccusationNoVote: SpyfallNoVoteEvent | null;
  winner: SpyfallWinner;
  endReason: SpyfallEndReason;
  accusedUid: string | null;
  alreadyProposedUid: string[];
};
