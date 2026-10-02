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
import { computed, inject, signal, effect, untracked } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { SessionStore } from '../../../shared/stores/session-store';
import {
  Firestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  Unsubscribe,
  getDoc,
  runTransaction,
} from '@angular/fire/firestore';
import { Subscription, take, timer } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { BONUS_GAME_ROOM_STORAGE_KEY } from '../bonus-game.constants';
import { ensureBonusGameUser } from '../bonus-game-auth';
import { BonusGameAiService, NineUpperTopic } from '../services/bonus-game-ai.service';

export type NineUpperPlayer = Pick<UserProfile, 'displayName' | 'photoUrl'> & {
  role: Role;
  /** Dedicated-host contestants receive an answer identity; spectators are all guessers. */
  participationRole?: NineUpperParticipationRole;
  uid: string;
};

type Role = '尚未分配身分' | '猜題人' | '唬爛人' | '老實人';

export type NineUpperParticipationRole = 'contestant' | 'spectator';
export type NineUpperSpectatorVoteType = 'honest' | 'nonsense';
export type NineUpperSpectatorVotes = Partial<
  Record<NineUpperSpectatorVoteType, string>
>;

export type NineUpperVoteTally = {
  player: NineUpperPlayer;
  honest: number;
  nonsense: number;
};

/** A locally remembered identity used only while joining this 9UPPER room. */
export type NineUpperQuickProfile = Pick<NineUpperPlayer, 'displayName' | 'photoUrl'> & {
  avatarSeed: string;
};

type PromptConfig = {
  customPrompt: string;
};

export type NineUpperState = {
  gameCode: '001';
  seq: string;
  name: string;
  status: '遊戲準備中' | '題目產生中' | '遊戲開始倒數' | '遊戲進行中' | '最終猜測階段' | '遊戲結束';
  isLoading: boolean;
  topic: NineUpperTopic;
  promptConfig: PromptConfig;
  roomMasterId: string;
  /** New rooms persist `true`; an absent field preserves legacy player-host rooms. */
  hostMode: boolean;
  currentPlayerIndex: number | null;
  chosenPlayerUId: string | null;
  players: NineUpperPlayer[];
  playersBackup: NineUpperPlayer[];
  spectatorVotes: Record<string, NineUpperSpectatorVotes>;
};

export const nineUpperInitialState: NineUpperState = {
  gameCode: '001',
  seq: '',
  name: '',
  status: '遊戲準備中',
  isLoading: false,
  topic: { question: '', tips: [], answer: '' },
  promptConfig: { customPrompt: '' },
  hostMode: true,
  currentPlayerIndex: null,
  chosenPlayerUId: '',
  roomMasterId: '',
  players: [],
  playersBackup: [],
  spectatorVotes: {},
};

const PROFILE_KEY_PREFIX = 'nineUpperQuickProfile:';

export const NineUpperStore = signalStore(
  withState(nineUpperInitialState),
  withProps(() => {
    return {
      toast: inject(ToastController),
      sessionStore: inject(SessionStore),
      auth: inject(Auth),
      route: inject(ActivatedRoute),
      firestore: inject(Firestore), // 修正變數大小寫習慣
      ai: inject(BonusGameAiService),
      authenticatedUid: signal(''),
      countdown: signal(0),
    };
  }),
  withComputed((store) => {
    // Room ownership is written with Firebase Auth's UID when the room is created.
    // Prefer that verified principal over the app-wide SessionStore fallback, whose
    // Demo identity can otherwise make every device look like the room master.
    const currentUid = () => store.authenticatedUid() || store.sessionStore.user()?.uid || '';

    return {
    /** Falls back to the Firebase principal while SessionStore catches up after anonymous sign-in. */
    uid: computed(() => currentUid()),
    hasDedicatedHost: computed(() => store.hostMode() === true),
    contestants: computed(() =>
      store.players().filter((player) =>
        store.hostMode() === false ? true : player.participationRole === 'contestant',
      ),
    ),
    spectators: computed(() =>
      store.hostMode() === false
        ? []
        : store.players().filter((player) => player.participationRole !== 'contestant'),
    ),
    currentPlayer: computed(() => {
      const idx = store.currentPlayerIndex();
      const player = idx !== null ? store.players()[idx] : undefined;
      return player && (store.hostMode() === false || player.participationRole === 'contestant')
        ? player
        : undefined;
    }),
    guessingPlayer: computed(() => {
      // Dedicated-host rooms have no single contestant guesser: every spectator guesses.
      if (store.hostMode() === true) return undefined;
      return store.players().find((player) => player.role === '猜題人');
    }),
    chosenPlayer: computed(() =>
      store
        .players()
        .find(
          (player) =>
            (store.hostMode() === false || player.participationRole === 'contestant') &&
            player.uid === store.chosenPlayerUId(),
        ),
    ),
    isCurrentUserContestant: computed(() => {
      const userId = currentUid();
      return store
        .players()
        .some(
          (player) =>
            (store.hostMode() === false || player.participationRole === 'contestant') &&
            player.uid === userId,
        );
    }),
    isCurrentUserSpectator: computed(() => {
      const userId = currentUid();
      return store
        .players()
        .some(
          (player) =>
            store.hostMode() === true &&
            player.participationRole !== 'contestant' &&
            player.uid === userId,
        );
    }),
    mySpectatorVotes: computed<NineUpperSpectatorVotes>(() => {
      const userId = currentUid();
      return userId ? store.spectatorVotes()[userId] ?? {} : {};
    }),
    voteTallies: computed<NineUpperVoteTally[]>(() => {
      const tallies = new Map<string, NineUpperVoteTally>();

      for (const player of store.players()) {
        if (store.hostMode() === true && player.participationRole !== 'contestant') continue;
        tallies.set(player.uid, { player, honest: 0, nonsense: 0 });
      }

      for (const vote of Object.values(store.spectatorVotes())) {
        if (vote.honest) {
          const tally = tallies.get(vote.honest);
          if (tally) tally.honest++;
        }
        if (vote.nonsense) {
          const tally = tallies.get(vote.nonsense);
          if (tally) tally.nonsense++;
        }
      }

      return [...tallies.values()];
    }),
    isRoomFull: computed(() => store.players().length >= 9),
    isRoomMaster: computed(() => {
      const uid = currentUid();
      return Boolean(uid) && uid === store.roomMasterId();
    }),
    isCurrentUserJoined: computed(() => {
      const uid = currentUid();
      return Boolean(uid && store.players().some((player) => player.uid === uid));
    }),
    isCurrentUserNonparticipant: computed(() => {
      const uid = currentUid();
      return Boolean(
        uid &&
          uid !== store.roomMasterId() &&
          !store.players().some((player) => player.uid === uid),
      );
    }),
    /** A dedicated host never needs a player profile, while every participant does. */
    requiresProfile: computed(() => {
      const uid = currentUid();
      const isJoined = Boolean(uid && store.players().some((player) => player.uid === uid));
      const isDedicatedHost = store.hostMode() === true;
      const isRoomMaster = Boolean(uid) && uid === store.roomMasterId();
      return Boolean(uid) && store.status() === '遊戲準備中' && !isJoined && !(isRoomMaster && isDedicatedHost);
    }),
    };
  }),
  withMethods((store) => {
    let roomListenerUnsubscribe: Unsubscribe | null = null;
    let countdownSubscription: Subscription | null = null;
    let topicGenerationInProgress = false;

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
    async function syncToFirestore(partialState: Partial<NineUpperState>) {
      const roomKey = store.seq();
      if (!roomKey) return;
      const roomRef = doc(store.firestore, `rooms/${roomKey}`);
      // 僅更新有變動的部分，或直接合併目前狀態
      await updateDoc(roomRef, partialState).catch(async () => {
        // 如果文件不存在則建立
        await setDoc(roomRef, { ...getState(store), ...partialState }, { merge: true });
      });
    }
    function getFallbackTopic(): NineUpperTopic {
      const randomIndex = Math.floor(Math.random() * staticTopic.length);

      return {
        question: staticTopic[randomIndex],
        tips: staticTips[randomIndex],
        answer: staticAnswer[randomIndex],
      };
    }

    function roomUsesDedicatedHost(room: Pick<NineUpperState, 'hostMode'>): boolean {
      return room.hostMode === true;
    }

    function isContestant(
      player: NineUpperPlayer,
      dedicatedHost: boolean,
    ): boolean {
      return !dedicatedHost || player.participationRole === 'contestant';
    }

    function normalizePlayer(
      player: NineUpperPlayer,
      dedicatedHost: boolean,
    ): NineUpperPlayer {
      return {
        ...player,
        participationRole:
          player.participationRole ?? (dedicatedHost ? 'spectator' : 'contestant'),
      };
    }

    function normalizePlayers(
      players: NineUpperPlayer[],
      dedicatedHost: boolean,
    ): NineUpperPlayer[] {
      return players.map((player) => normalizePlayer(player, dedicatedHost));
    }

    function profilePlayer(
      uid: string,
      profile: NineUpperQuickProfile,
      participationRole: NineUpperParticipationRole,
    ): NineUpperPlayer {
      return {
        displayName: profile.displayName.trim(),
        photoUrl: profile.photoUrl,
        role: '尚未分配身分',
        participationRole,
        uid,
      };
    }

    async function ensureAuthenticatedUser(): Promise<string> {
      const user = await ensureBonusGameUser(store.auth);
      store.authenticatedUid.set(user.uid);
      return user.uid;
    }

    function checkForValidNextPlayerIndex(
      players: NineUpperPlayer[],
      currentIndex: number | null,
      dedicatedHost: boolean,
    ): number {
      // In dedicated-host mode, the spectators collectively act as the guessers.
      // Every contestant must therefore get a speaking turn.
      const guessingPlayer = dedicatedHost
        ? undefined
        : players.find((player) => player.role === '猜題人');

      let nextIndex = currentIndex === null ? 0 : currentIndex + 1;

      while (
        nextIndex < players.length &&
        (!isContestant(players[nextIndex], dedicatedHost) ||
          players[nextIndex].uid === guessingPlayer?.uid)
      ) {
        nextIndex++;
      }

      return nextIndex;
    }

    function contestantRoleForRound(index: number, dedicatedHost: boolean): Role {
      if (dedicatedHost) {
        return index === 0 ? '老實人' : '唬爛人';
      }

      if (index === 0) return '猜題人';
      return index === 1 ? '老實人' : '唬爛人';
    }

    function startRoomListener(seq: string) {
      roomListenerUnsubscribe?.();

      const roomRef = doc(store.firestore, `rooms/${seq}`);
      roomListenerUnsubscribe = onSnapshot(roomRef, (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data() as NineUpperState;
        const previousStatus = store.status();
        const dedicatedHost = roomUsesDedicatedHost(data);

        patchState(store, {
          name: data.name,
          status: data.status,
          topic: data.topic ?? nineUpperInitialState.topic,
          promptConfig: data.promptConfig ?? nineUpperInitialState.promptConfig,
          roomMasterId: data.roomMasterId,
          hostMode: dedicatedHost,
          currentPlayerIndex: data.currentPlayerIndex,
          chosenPlayerUId: data.chosenPlayerUId,
          players: normalizePlayers(data.players ?? [], dedicatedHost).filter(
            (player) => !dedicatedHost || player.uid !== data.roomMasterId,
          ),
          playersBackup: normalizePlayers(data.playersBackup ?? [], dedicatedHost).filter(
            (player) => !dedicatedHost || player.uid !== data.roomMasterId,
          ),
          spectatorVotes: data.spectatorVotes ?? {},
          isLoading: data.isLoading,
        });

        if (data.status === '遊戲開始倒數' && previousStatus !== '遊戲開始倒數') {
          startCountdown();
        }

        if (data.status !== '遊戲開始倒數') {
          stopCountdown();
        }
      });
    }

    return {
      stopCountdown,
      async ensureAnonymousUser(): Promise<string> {
        return ensureAuthenticatedUser();
      },
      async initializeRoom(seq: string) {
        patchState(store, { seq });
        try {
          await ensureAuthenticatedUser();
          startRoomListener(seq);
        } catch (error) {
          console.error('無法建立 9UPPER 快速加入身分：', error);
          await toast('無法建立快速加入身分，請確認 Firebase 匿名登入已啟用');
        }
      },
      // 初始化 Firestore 即時監聽
      initRoomListener: startRoomListener,

      stopRoomListener() {
        if (roomListenerUnsubscribe) {
          roomListenerUnsubscribe();
          roomListenerUnsubscribe = null;
        }
      },
      savedProfile(): NineUpperQuickProfile | null {
        const raw = localStorage.getItem(`${PROFILE_KEY_PREFIX}${store.seq()}`);
        if (!raw) return null;
        try {
          const profile = JSON.parse(raw) as Partial<NineUpperQuickProfile>;
          if (
            typeof profile.displayName === 'string' &&
            typeof profile.avatarSeed === 'string' &&
            typeof profile.photoUrl === 'string'
          ) {
            return profile as NineUpperQuickProfile;
          }
        } catch {
          // A malformed remembered profile should not block a fresh join.
        }
        return null;
      },
      async joinRoom(profile: NineUpperQuickProfile) {
        const displayName = profile.displayName.trim();
        if (displayName.length < 2 || displayName.length > 12) {
          await toast('暱稱請輸入 2–12 個字');
          return false;
        }

        const roomKey = store.seq();
        if (!roomKey) return false;

        try {
          const uid = await ensureAuthenticatedUser();
          const roomRef = doc(store.firestore, `rooms/${roomKey}`);
          await runTransaction(store.firestore, async (transaction) => {
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) throw new Error('房間不存在');

            const room = roomSnap.data() as NineUpperState;
            const dedicatedHost = roomUsesDedicatedHost(room);
            const players = normalizePlayers(room.players ?? [], dedicatedHost);
            if (room.status !== '遊戲準備中') throw new Error('遊戲已開始，無法新加入');
            if (dedicatedHost && room.roomMasterId === uid) {
              throw new Error('主持模式下房主不參與遊戲');
            }
            if (
              players.some(
                (player) =>
                  player.uid !== uid &&
                  player.displayName.toLocaleLowerCase() === displayName.toLocaleLowerCase(),
              )
            ) {
              throw new Error('這個暱稱已被使用');
            }

            const existingIndex = players.findIndex((player) => player.uid === uid);
            if (existingIndex < 0 && players.length >= 9) throw new Error('房間已滿');

            const normalizedProfile = { ...profile, displayName };
            const updatedPlayers = [...players];
            if (existingIndex >= 0) {
              updatedPlayers[existingIndex] = {
                ...updatedPlayers[existingIndex],
                displayName,
                photoUrl: normalizedProfile.photoUrl,
              };
            } else {
              updatedPlayers.push(
                profilePlayer(
                  uid,
                  normalizedProfile,
                  dedicatedHost ? 'spectator' : 'contestant',
                ),
              );
            }
            transaction.update(roomRef, { players: updatedPlayers });
          });

          localStorage.setItem(
            `${PROFILE_KEY_PREFIX}${roomKey}`,
            JSON.stringify({ ...profile, displayName }),
          );
          localStorage.setItem(BONUS_GAME_ROOM_STORAGE_KEY, roomKey);
          return true;
        } catch (error) {
          await toast(error instanceof Error ? error.message : '加入失敗');
          return false;
        }
      },

      async leaveRoom() {
        const uid = store.uid();
        const roomKey = store.seq();
        if (!uid || !roomKey) return false;

        const roomRef = doc(store.firestore, `rooms/${roomKey}`);

        const hasLeft = await runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return true;

          const currentData = roomSnap.data() as NineUpperState;
          if (currentData.status !== '遊戲準備中') return false;

          const dedicatedHost = roomUsesDedicatedHost(currentData);
          const players = normalizePlayers(currentData.players ?? [], dedicatedHost);
          let remainingPlayers = players.filter((player) => player.uid !== uid);

          if (currentData.roomMasterId === uid) {
            const nextRoomMaster = remainingPlayers[0];
            if (!nextRoomMaster) {
              transaction.delete(roomRef);
              return true;
            }

            // The successor takes over the projector; they must no longer be a contestant or voter.
            if (dedicatedHost) {
              remainingPlayers = remainingPlayers.filter(
                (player) => player.uid !== nextRoomMaster.uid,
              );
            }

            transaction.update(roomRef, {
              players: remainingPlayers,
              roomMasterId: nextRoomMaster.uid,
            });
            return true;
          }

          // An empty dedicated-host room is valid: its owner remains on the projector screen.
          if (remainingPlayers.length === 0 && !dedicatedHost) {
            transaction.delete(roomRef);
            return true;
          }

          transaction.update(roomRef, { players: remainingPlayers });
          return true;
        });

        if (hasLeft) {
          localStorage.removeItem(BONUS_GAME_ROOM_STORAGE_KEY);
          localStorage.removeItem(`${PROFILE_KEY_PREFIX}${roomKey}`);
        }

        return hasLeft;
      },
      async generateTopic() {
        if (!store.isRoomMaster() || store.status() !== '遊戲準備中' || topicGenerationInProgress) {
          return;
        }

        topicGenerationInProgress = true;
        patchState(store, { isLoading: true });

        try {
          const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
          await updateDoc(roomRef, { isLoading: true });
          let topic: NineUpperTopic;

          try {
            topic = await store.ai.generateNineUpperTopic(store.promptConfig().customPrompt);
          } catch (error) {
            console.error('AI 產生題目失敗，使用 fallback：', error);
            topic = getFallbackTopic();
            await toast('AI 題目產生失敗，已使用預設題目');
          }

          const latestRoomSnapshot = await getDoc(roomRef);
          const latestRoom = latestRoomSnapshot.data() as NineUpperState | undefined;
          const currentUserId = store.uid();

          if (
            !latestRoomSnapshot.exists() ||
            latestRoom?.status !== '遊戲準備中' ||
            latestRoom.roomMasterId !== currentUserId
          ) {
            return;
          }

          await updateDoc(roomRef, { topic, isLoading: false });
          patchState(store, { topic });
        } finally {
          patchState(store, { isLoading: false });
          topicGenerationInProgress = false;
        }
      },

      async updateRoomSettings(name: string, customPrompt: string, hostMode: boolean) {
        if (!store.isRoomMaster() || store.status() !== '遊戲準備中') return false;

        const trimmedName = name.trim();
        const trimmedPrompt = customPrompt.trim();
        if (trimmedName.length < 3 || trimmedName.length > 20 || trimmedPrompt.length > 20) {
          return false;
        }

        const uid = store.uid();
        if (!uid) return false;

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        let cannotJoinAsPlayer = false;
        const saved = await runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return false;

          const room = roomSnap.data() as NineUpperState;
          if (room.status !== '遊戲準備中' || room.roomMasterId !== uid) return false;

          const wasDedicatedHost = roomUsesDedicatedHost(room);
          let players = normalizePlayers(room.players ?? [], wasDedicatedHost);

          if (hostMode) {
            players = players
              .filter((player) => player.uid !== uid)
              .map((player) => ({
                ...player,
                role: '尚未分配身分' as Role,
                // When turning a player-host room into a hosted room, wait for an explicit assignment.
                participationRole: wasDedicatedHost ? player.participationRole : 'spectator',
              }));
          } else {
            if (!players.some((player) => player.uid === uid) && players.length >= 9) {
              cannotJoinAsPlayer = true;
              return false;
            }
            players = players.map((player) => ({
              ...player,
              role: '尚未分配身分' as Role,
              participationRole: 'contestant' as NineUpperParticipationRole,
            }));
          }

          transaction.update(roomRef, {
            name: trimmedName,
            promptConfig: { customPrompt: trimmedPrompt },
            hostMode,
            players,
            playersBackup: [],
            spectatorVotes: {},
          });
          return true;
        });

        if (!saved) {
          if (cannotJoinAsPlayer) await toast('玩家模式最多 9 位玩家，請先讓一位玩家離開');
          return false;
        }

        patchState(store, {
          name: trimmedName,
          promptConfig: { customPrompt: trimmedPrompt },
          hostMode,
        });
        return true;
      },

      async setParticipantRole(
        playerUid: string,
        participationRole: NineUpperParticipationRole,
      ) {
        const uid = store.uid();
        if (!uid || !store.isRoomMaster() || store.status() !== '遊戲準備中') {
          return false;
        }

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        return runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return false;

          const room = roomSnap.data() as NineUpperState;
          if (
            room.status !== '遊戲準備中' ||
            room.roomMasterId !== uid ||
            !roomUsesDedicatedHost(room) ||
            playerUid === uid
          ) {
            return false;
          }

          const players = normalizePlayers(room.players ?? [], true);
          if (!players.some((player) => player.uid === playerUid)) return false;

          transaction.update(roomRef, {
            players: players.map((player) =>
              player.uid === playerUid
                ? { ...player, participationRole, role: '尚未分配身分' as Role }
                : player,
            ),
          });
          return true;
        });
      },

      async startProcess() {
        const uid = store.uid();
        if (!uid || !store.isRoomMaster()) return;

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        const result = await runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return 'unavailable' as const;

          const room = roomSnap.data() as NineUpperState;
          if (room.status !== '遊戲準備中' || room.roomMasterId !== uid) {
            return 'unavailable' as const;
          }

          const dedicatedHost = roomUsesDedicatedHost(room);
          const roomPlayers = normalizePlayers(room.players ?? [], dedicatedHost).filter(
            (player) => !dedicatedHost || player.uid !== uid,
          );
          const contestants = roomPlayers.filter((player) => isContestant(player, dedicatedHost));
          const spectators = roomPlayers.filter((player) => !isContestant(player, dedicatedHost));

          if (!dedicatedHost && !contestants.some((player) => player.uid === uid)) {
            return 'host-not-registered' as const;
          }
          if (contestants.length < 3) return 'not-enough-contestants' as const;
          if (dedicatedHost && spectators.length === 0) return 'not-enough-spectators' as const;
          if (room.isLoading || !room.topic?.question) return 'topic-not-ready' as const;

          const shuffledContestants = [...contestants];
          for (let index = shuffledContestants.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [shuffledContestants[index], shuffledContestants[randomIndex]] = [
              shuffledContestants[randomIndex],
              shuffledContestants[index],
            ];
          }

          const assignedContestants = shuffledContestants.map((player, index) => ({
            ...player,
            // A dedicated-host room delegates the guessing role to every spectator,
            // so its contestants receive only one honest identity and the remaining
            // nonsense identities. Player-host rooms retain the original guesser role.
            role: contestantRoleForRound(index, dedicatedHost),
          }));
          const assignedSpectators = spectators.map((player) => ({
            ...player,
            role: dedicatedHost ? ('猜題人' as Role) : ('尚未分配身分' as Role),
          }));
          const updatedPlayers = [...assignedContestants, ...assignedSpectators];
          const updatedByUid = new Map(updatedPlayers.map((player) => [player.uid, player]));
          const playersBackup = roomPlayers.map(
            (player) => updatedByUid.get(player.uid) ?? player,
          );

          transaction.update(roomRef, {
            hostMode: dedicatedHost,
            players: updatedPlayers,
            playersBackup,
            spectatorVotes: {},
            status: '遊戲開始倒數',
            currentPlayerIndex: checkForValidNextPlayerIndex(updatedPlayers, null, dedicatedHost),
          });
          return 'started' as const;
        });

        if (result === 'not-enough-contestants') {
          await toast('參賽者未達 3 人，無法開始遊戲');
        } else if (result === 'not-enough-spectators') {
          await toast('主持模式至少需要 1 位觀眾擔任猜題人');
        } else if (result === 'host-not-registered') {
          await toast('玩家主持模式下，房主請先選擇頭像與暱稱加入遊戲');
        } else if (result === 'topic-not-ready') {
          await toast('題目尚未準備完成');
        }
      },

      async nextAnswerPlayer() {
        const uid = store.uid();
        if (!uid || !store.isRoomMaster()) return;

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        await runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return;

          const room = roomSnap.data() as NineUpperState;
          if (room.status !== '遊戲進行中' || room.roomMasterId !== uid) return;

          const dedicatedHost = roomUsesDedicatedHost(room);
          const players = normalizePlayers(room.players ?? [], dedicatedHost);
          const nextIndex = checkForValidNextPlayerIndex(
            players,
            room.currentPlayerIndex,
            dedicatedHost,
          );

          transaction.update(
            roomRef,
            nextIndex >= players.length
              ? { status: '最終猜測階段' }
              : { currentPlayerIndex: nextIndex },
          );
        });
      },

      async chooseTheHonest(player: NineUpperPlayer) {
        const uid = store.uid();
        if (!uid || store.hasDedicatedHost()) return;

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        await runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return;

          const room = roomSnap.data() as NineUpperState;
          if (roomUsesDedicatedHost(room) || room.status !== '最終猜測階段') return;

          const players = normalizePlayers(room.players ?? [], false);
          const guessingPlayer = players.find((candidate) => candidate.role === '猜題人');
          const chosenPlayer = players.find(
            (candidate) => candidate.uid === player.uid && candidate.uid !== guessingPlayer?.uid,
          );
          if (guessingPlayer?.uid !== uid || !chosenPlayer) return;

          const playersBackup = normalizePlayers(room.playersBackup ?? [], false);
          transaction.update(roomRef, {
            status: '遊戲結束',
            chosenPlayerUId: chosenPlayer.uid,
            players: playersBackup.length > 0 ? playersBackup : players,
          });
        });
      },

      async castSpectatorVote(type: NineUpperSpectatorVoteType, playerUid: string) {
        const uid = store.uid();
        if (!uid || !store.isCurrentUserSpectator()) return false;

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        const cast = await runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return false;

          const room = roomSnap.data() as NineUpperState;
          if (
            !roomUsesDedicatedHost(room) ||
            (room.status !== '遊戲進行中' && room.status !== '最終猜測階段')
          ) {
            return false;
          }

          const players = normalizePlayers(room.players ?? [], true);
          const voter = players.find((candidate) => candidate.uid === uid);
          const target = players.find((candidate) => candidate.uid === playerUid);
          if (
            voter?.participationRole !== 'spectator' ||
            target?.participationRole !== 'contestant'
          ) {
            return false;
          }

          const votes = room.spectatorVotes ?? {};
          const voterVotes = votes[uid] ?? {};
          if (voterVotes[type]) return false;

          transaction.update(roomRef, {
            spectatorVotes: {
              ...votes,
              [uid]: { ...voterVotes, [type]: playerUid },
            },
          });
          return true;
        });

        if (!cast) await toast('這張票目前無法投出');
        return cast;
      },

      async finishHostedGame() {
        const uid = store.uid();
        if (!uid || !store.isRoomMaster() || !store.hasDedicatedHost()) return;

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        await runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return;

          const room = roomSnap.data() as NineUpperState;
          if (
            !roomUsesDedicatedHost(room) ||
            room.roomMasterId !== uid ||
            room.status !== '最終猜測階段'
          ) {
            return;
          }

          const players = normalizePlayers(room.players ?? [], true);
          const playersBackup = normalizePlayers(room.playersBackup ?? [], true);
          transaction.update(roomRef, {
            status: '遊戲結束',
            chosenPlayerUId: null,
            players: playersBackup.length > 0 ? playersBackup : players,
          });
        });
      },

      async reset() {
        const uid = store.uid();
        if (!uid || !store.isRoomMaster()) return;

        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        await runTransaction(store.firestore, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          if (!roomSnap.exists()) return;

          const room = roomSnap.data() as NineUpperState;
          if (room.roomMasterId !== uid || room.status !== '遊戲結束') return;

          const dedicatedHost = roomUsesDedicatedHost(room);
          const resetPlayers = normalizePlayers(room.players ?? [], dedicatedHost)
            .filter((player) => !dedicatedHost || player.uid !== uid)
            .map((player) => ({ ...player, role: '尚未分配身分' as Role }));

          transaction.update(roomRef, {
            hostMode: dedicatedHost,
            status: '遊戲準備中',
            currentPlayerIndex: null,
            chosenPlayerUId: null,
            topic: {
              question: '',
              tips: [],
              answer: '',
            },
            players: resetPlayers,
            playersBackup: [],
            spectatorVotes: {},
          });
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const seq = store.route.snapshot.paramMap.get('seq') || '';

      if (seq) {
        void store.initializeRoom(seq);
      }

      effect(() => {
        const shouldGenerateTopic =
          store.isRoomMaster() && store.status() === '遊戲準備中' && !store.topic().question;

        if (shouldGenerateTopic) {
          untracked(() => void store.generateTopic());
        }
      });
    },
    onDestroy(store) {
      store.stopCountdown();
      store.stopRoomListener();
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
