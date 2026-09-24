import {
  getState,
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { UserProfile } from '../../../shared/models/user-profile';
import { computed, inject, signal, effect, untracked, input, DestroyRef } from '@angular/core';
import { SessionStore } from '../../../shared/stores/session-store';
import {
  Firestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  Unsubscribe,
  getDoc,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Subscription, take, timer } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';

export type On9Player = Pick<UserProfile, 'displayName' | 'photoUrl'> & {
  role: Role;
  uid: string;
};

type Role = '尚未分配身分' | '猜題人' | '唬爛人' | '老實人';

type Topic = {
  question: string;
  tips: string[];
  answer: string;
};

type GameState = {
  seq: string;
  name: string;
  status: '遊戲準備中' | '題目產生中' | '遊戲開始倒數' | '遊戲進行中' | '最終猜測階段' | '遊戲結束';
  isLoading: boolean;
  topic: Topic;
  roomMasterId: string;
  currentPlayerIndex: number | null;
  chosenPlayerUId: string | null;
  players: On9Player[];
  playersBackup: On9Player[];
};

export const initialState: GameState = {
  seq: '',
  name: '',
  status: '遊戲準備中',
  isLoading: false,
  topic: { question: '', tips: [], answer: '' },
  currentPlayerIndex: null,
  chosenPlayerUId: '',
  roomMasterId: '',
  players: [],
  playersBackup: [],
};

export const GameStore = signalStore(
  withState(initialState),
  withProps(() => {
    return {
      toast: inject(ToastController),
      sessionStore: inject(SessionStore),
      route: inject(ActivatedRoute),
      firestore: inject(Firestore), // 修正變數大小寫習慣
      functions: inject(Functions),
      countdown: signal(0),
    };
  }),
  withComputed((store) => ({
    currentPlayer: computed(() => {
      const idx = store.currentPlayerIndex();
      return idx !== null ? store.players()[idx] : undefined;
    }),
    gussingPlayer: computed(() => store.players().find((x) => x.role === '猜題人')),
    chosenPlayer: computed(() => store.players().find((x) => x.uid === store.chosenPlayerUId())),
    isAnyRoomExist: computed(() => store.seq() !== ''),
    isRoomFull: computed(() => store.players().length === 9),
    isRoomMaster: computed(() => store.sessionStore.user()?.uid === store.roomMasterId()),
  })),
  withMethods((store) => {
    let roomListenerUnsubscribe: Unsubscribe | null = null;
    let countdownSubscription: Subscription | null = null;

    function stopCountdown() {
      countdownSubscription?.unsubscribe();
      countdownSubscription = null;
      store.countdown.set(0);
    }

    function startCountdown() {
      countdownSubscription?.unsubscribe();

      store.countdown.set(5);

      countdownSubscription = timer(0, 1000)
        .pipe(take(6))
        .subscribe((tick) => {
          store.countdown.set(5 - tick);

          if (tick === 5 && store.isRoomMaster() && store.status() === '遊戲開始倒數') {
            void syncToFirestore({
              status: '遊戲進行中',
            });
          }
        });
    }

    //啟動toast
    async function toast(msg: string) {
      const toast = await store.toast.create({
        message: msg,
        duration: 1500,
        position: 'bottom',
      });
      await toast.present();
    }

    // 抽離共用：將本地 Store 狀態寫入 Firestore
    async function syncToFirestore(partialState: Partial<GameState>) {
      const roomKey = store.seq();
      if (!roomKey) return;
      const roomRef = doc(store.firestore, `rooms/${roomKey}`);
      // 僅更新有變動的部分，或直接合併目前狀態
      await updateDoc(roomRef, partialState).catch(async () => {
        // 如果文件不存在則建立
        await setDoc(roomRef, { ...getState(store), ...partialState }, { merge: true });
      });
    }
    function isValidTopic(data: unknown): data is Topic {
      if (!data || typeof data !== 'object') return false;

      const topic = data as Partial<Topic>;

      return (
        typeof topic.question === 'string' &&
        typeof topic.answer === 'string' &&
        Array.isArray(topic.tips) &&
        topic.tips.length === 3 &&
        topic.tips.every((tip) => typeof tip === 'string')
      );
    }

    async function getTopicWithGemini(customPrompt = ''): Promise<Topic> {
      const generateTopicRequest = httpsCallable<{ customPrompt: string }, Topic>(
        store.functions,
        'generateGameTopic',
      );

      const result = await generateTopicRequest({
        customPrompt,
      });

      if (!isValidTopic(result.data)) {
        throw new Error('AI 回傳的題目格式錯誤');
      }

      return result.data;
    }

    function getFallbackTopic(): Topic {
      const randomIndex = Math.floor(Math.random() * staticTopic.length);

      return {
        question: staticTopic[randomIndex],
        tips: staticTips[randomIndex],
        answer: staticAnswer[randomIndex],
      };
    }

    function setFallbackTopic() {
      if (!staticTopic || staticTopic.length === 0) return;
      const randomIndex = Math.floor(Math.random() * staticTopic.length);
      patchState(store, {
        topic: {
          question: staticTopic[randomIndex],
          tips: staticTips[randomIndex],
          answer: staticAnswer[randomIndex],
        },
      });
    }
    function checkForValidNextPlayerIndex(
      players: On9Player[],
      currentIndex: number | null,
    ): number {
      const guessingPlayer = players.find((player) => player.role === '猜題人');

      let nextIndex = currentIndex === null ? 0 : currentIndex + 1;

      while (nextIndex < players.length && players[nextIndex].uid === guessingPlayer?.uid) {
        nextIndex++;
      }

      return nextIndex;
    }

    return {
      stopCountdown,
      // 初始化 Firestore 即時監聽
      initRoomListener(seq: string) {
        if (roomListenerUnsubscribe) {
          roomListenerUnsubscribe();
        }

        const roomRef = doc(store.firestore, `rooms/${seq}`);
        roomListenerUnsubscribe = onSnapshot(roomRef, (snapshot) => {
          if (!snapshot.exists()) return;

          const data = snapshot.data() as GameState;
          const previousStatus = store.status();

          patchState(store, {
            status: data.status,
            topic: data.topic,
            roomMasterId: data.roomMasterId,
            currentPlayerIndex: data.currentPlayerIndex,
            chosenPlayerUId: data.chosenPlayerUId,
            players: data.players ?? [],
            playersBackup: data.playersBackup ?? [],
            isLoading: data.isLoading,
          });

          if (data.status === '遊戲開始倒數' && previousStatus !== '遊戲開始倒數') {
            startCountdown();
          }

          if (data.status !== '遊戲開始倒數') {
            stopCountdown();
          }
        });
      },

      stopRoomListener() {
        if (roomListenerUnsubscribe) {
          roomListenerUnsubscribe();
          roomListenerUnsubscribe = null;
        }
      },
      async joinRoom() {
        const user = store.sessionStore.user();
        if (!user || !user.uid) return;

        // 1. 強制取得雲端最新狀態，避免本地端 snapshot 還沒回來就被覆寫
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) return;
        const currentData = roomSnap.data() as GameState;
        const currentPlayers = currentData.players || [];

        const isAlreadyInRoom = currentPlayers.some((x) => x.uid === user.uid);
        let updatedPlayers = [...currentPlayers];

        if (isAlreadyInRoom) {
          updatedPlayers = currentPlayers.map((p) =>
            p.uid === user.uid
              ? {
                  ...p,
                  displayName: user.displayName ?? '無名玩家',
                  photoUrl: user.photoUrl ?? 'images/portraits/meeple.png',
                }
              : p,
          );
        } else {
          updatedPlayers.push({
            displayName: user.displayName ?? '無名玩家',
            photoUrl: user.photoUrl ?? 'images/portraits/meeple.png',
            role: '尚未分配身分',
            uid: user.uid,
          });
        }

        // 2. 直接更新 Firestore
        await updateDoc(roomRef, { players: updatedPlayers });
      },

      async leaveRoom() {
        const user = store.sessionStore.user();
        if (!user || !user.uid) return;

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) return;

        const currentData = roomSnap.data() as GameState;
        const updatedPlayers = (currentData.players || []).filter((p) => p.uid !== user.uid);

        // 如果房間空了，可以考慮把狀態改掉或直接刪除房間
        await updateDoc(roomRef, { players: updatedPlayers });
      },
      async startProcess(customPrompt = '') {
        if (!store.isRoomMaster()) {
          return;
        }

        if (store.players().length < 3) {
          await toast('玩家未達3人無法開始遊戲');
          return;
        }

        await syncToFirestore({
          status: '題目產生中',
          isLoading: true,
        });

        const players = [...store.players()];

        const roles: Role[] = ['猜題人', '老實人'];

        for (let i = 2; i < players.length; i++) {
          roles.push('唬爛人');
        }

        for (let i = players.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [players[i], players[j]] = [players[j], players[i]];
        }

        const updatedPlayers = players.map((player, index) => ({
          ...player,
          role: roles[index],
        }));

        const playersBackup = store.players().map((originalPlayer) => {
          return updatedPlayers.find((player) => player.uid === originalPlayer.uid)!;
        });

        let topic: Topic;

        try {
          topic = await getTopicWithGemini(customPrompt);
        } catch (error) {
          console.error('AI 產生題目失敗，使用 fallback：', error);

          topic = getFallbackTopic();

          await toast('AI 題目產生失敗，已使用預設題目');
        }

        await syncToFirestore({
          topic,
          players: updatedPlayers,
          playersBackup,
          isLoading: false,

          // 題目完成後，先進入倒數
          status: '遊戲開始倒數',

          currentPlayerIndex: checkForValidNextPlayerIndex(updatedPlayers, null),
        });
      },

      // 每次異動完呼叫 syncToFirestore 即可
      async nextAnswerPlayer() {
        const players = store.players();
        const currentIndex = store.currentPlayerIndex();
        const nextIndex = checkForValidNextPlayerIndex(players, currentIndex);
        if (nextIndex >= players.length) {
          await syncToFirestore({
            status: '最終猜測階段',
          });
        } else {
          await syncToFirestore({
            currentPlayerIndex: nextIndex,
          });
        }
      },
      async chooseTheHonest(player: On9Player) {
        const restoredPlayers =
          store.playersBackup().length > 0 ? store.playersBackup() : store.players();

        await syncToFirestore({
          status: '遊戲結束',
          chosenPlayerUId: player.uid,
          players: restoredPlayers,
        });
      },
      async reset() {
        const resetPlayers = store.players().map((player) => ({
          ...player,
          role: '尚未分配身分' as Role,
        }));

        await syncToFirestore({
          status: '遊戲準備中',
          currentPlayerIndex: null,
          chosenPlayerUId: null,
          topic: {
            question: '',
            tips: [],
            answer: '',
          },
          players: resetPlayers,
          playersBackup: resetPlayers,
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const seq = store.route.snapshot.paramMap.get('seq') || '';

      if (seq) {
        patchState(store, { seq });
        store.initRoomListener(seq); // 一初始化就開始監聽 Firestore
      }

      effect(() => {
        const user = store.sessionStore.user();
        if (user && user.uid) {
          untracked(() => store.joinRoom());
        }
      });
    },
    onDestroy(store) {
      store.stopCountdown();
      store.leaveRoom();
      store.stopRoomListener();
      if ((store as any)._unloadListener) {
        window.removeEventListener('beforeunload', (store as any)._unloadListener);
      }
    },
  }),
);

//#region ai失敗時的題目後援
// const promptText = `
//         你是一個為玩家帶來歡樂的「瞎掰王」桌遊的出題主持人。
//         請提供一組冷門、有趣、網路流行語、字面意思與實際意思差異很大的詞彙。
//         並請提供它的真實解釋，以及三個分類提示。
//         提示數量必須恰為3個，且有一個提示確實符合字詞，其餘兩個提示則用於混淆，
//         請注意：正確的提示詞不要總是放在index=0的位置，請隨機在0~2之間提供。
//         提示的內容最多不超過5個字。

//         (我在下方提供認為符合條件的範例，可以參考)

//         請務必以 JSON 格式回傳，格式如下：
//         {
//           "question": "字詞",
//           "answer": "針對字詞的真實解釋",
//           "tips": ["提示1", "提示2", "提示3"]
//         }

//         以下是現有符合有趣、歡樂的字詞範例:
//         {
//           "question": "阿撒布魯",
//           "answer": "早期台灣是農業社會，大家一早就要下田工作。長輩認為早上去洗澡是不務正業、不守規矩的行為，因此演變成用來形容事情「亂七八糟」或行為「不合理」。",
//           "tips": ['形容詞', '入浴劑', '狗的品種']
//         },
//         {
//           "question": "估咩",
//           "answer": "Google Maps 的簡稱。",
//           "tips": ['產品服務', '睡前問候語', '動物狀聲詞']
//         },
//         {
//           "question": "YBSG",
//           "answer": "由日文的「やばい」（Yabai，原意為糟糕、驚人、厲害）加上表示過度、極端的「すぎ」（Sugi，太過頭）組合而成，用來加倍放大情緒。",
//           "tips": ['人權組織名', '歌手團體', '形容詞']
//         },
//         {
//           "question": "龍之氣息",
//           "answer": "龍之氣息（英語：Dragon's Breath）是一種辣椒，此辣椒由麥克‧史密斯所栽種，史密斯為登比郡聖亞薩鎭人，是目前世界最辣的辣椒品種。",
//           "tips": ['蔬菜', '動漫招式名', '酒品']
//         }
//       `;
const staticTopic = ['阿撒布魯', '牛溲馬勃', '枵腹從公'];
const staticAnswer = [
  '原指早上洗澡，後比喻整日無所事事之人，不長進。',
  '原指牛尿和長在獸糞上的真菌。比喻事物雖然微賤低劣，但卻有其實用價值。',
  '枵腹指的是空著肚子。形容為了公務而忘記吃飯，比喻辦事勤懇，不顧自身。',
];
const staticTips = [
  ['形容詞', '入浴劑', '狗的品種'],
  ['中藥材', '牧草種類', '農用機具'],
  ['辦公態度', '古代刑罰', '腸胃疾病'],
];
//#endregion
