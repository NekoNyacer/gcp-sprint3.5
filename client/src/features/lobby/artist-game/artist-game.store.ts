import { computed, effect, inject, signal, untracked } from '@angular/core';
import { Auth } from '@angular/fire/auth';
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
import { ensureBonusGameUser } from '../bonus-game-auth';
import { BONUS_GAME_ROOM_STORAGE_KEY } from '../bonus-game.constants';

export type ArtistRole = '尚未分配身分' | '藝術家' | '偽藝術家';

/** A room participant either draws or watches and votes in dedicated-host mode. */
export type ArtistParticipationRole = 'contestant' | 'spectator';

export type ArtistPlayer = Pick<UserProfile, 'displayName' | 'photoUrl'> & {
  uid: string;
  role: ArtistRole;
  participationRole: ArtistParticipationRole;
  color: string;
};

export type ArtistQuickProfile = Pick<ArtistPlayer, 'displayName' | 'photoUrl'> & {
  avatarSeed: string;
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
  /** When true, the owner is a non-playing projector host. */
  hostMode: boolean;
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
  hostMode: true,
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
const PROFILE_KEY_PREFIX = 'artistQuickProfile:';

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

/** New rooms persist this setting; older rooms without it retain player-host behavior. */
function hasDedicatedHost(room: Pick<ArtistGameState, 'hostMode'>): boolean {
  return room.hostMode === true;
}

function normalizePlayers(players: ArtistPlayer[] | undefined, hostMode: boolean): ArtistPlayer[] {
  return (players ?? []).map((player) => ({
    ...player,
    participationRole: player.participationRole ?? (hostMode ? 'spectator' : 'contestant'),
  }));
}

function contestantsFor(players: ArtistPlayer[], hostMode: boolean): ArtistPlayer[] {
  return hostMode ? players.filter((player) => player.participationRole === 'contestant') : players;
}

function spectatorsFor(players: ArtistPlayer[], hostMode: boolean): ArtistPlayer[] {
  return hostMode ? players.filter((player) => player.participationRole === 'spectator') : [];
}

function eligibleVotersFor(players: ArtistPlayer[], hostMode: boolean): ArtistPlayer[] {
  return hostMode ? spectatorsFor(players, hostMode) : players;
}

export const ArtistGameStore = signalStore(
  withState(artistInitialState),
  withProps(() => ({
    firestore: inject(Firestore),
    auth: inject(Auth),
    route: inject(ActivatedRoute),
    sessionStore: inject(SessionStore),
    toastController: inject(ToastController),
    authenticatedUid: signal(''),
    countdown: signal(0),
    reviewCountdown: signal(0),
    votingCountdown: signal(0),
  })),
  withComputed((store) => ({
    uid: computed(() => store.authenticatedUid() || store.sessionStore.user()?.uid || ''),
    isRoomMaster: computed(() => {
      const uid = store.authenticatedUid() || store.sessionStore.user()?.uid || '';
      return Boolean(uid) && uid === store.roomMasterId();
    }),
    hasDedicatedHost: computed(() => store.hostMode() === true),
    isRoomFull: computed(() => store.players().length >= 9),
    contestants: computed(() => contestantsFor(store.players(), store.hostMode() === true)),
    spectators: computed(() => spectatorsFor(store.players(), store.hostMode() === true)),
    currentPlayer: computed(() => {
      const index = store.currentPlayerIndex();
      return index === null
        ? undefined
        : contestantsFor(store.players(), store.hostMode() === true)[index];
    }),
    me: computed(() => {
      const uid = store.authenticatedUid() || store.sessionStore.user()?.uid || '';
      return store.players().find((player) => player.uid === uid);
    }),
    isContestant: computed(() => {
      const uid = store.authenticatedUid() || store.sessionStore.user()?.uid || '';
      const me = store.players().find((player) => player.uid === uid);
      return Boolean(me && (store.hostMode() === false || me.participationRole === 'contestant'));
    }),
    isSpectator: computed(() => {
      const uid = store.authenticatedUid() || store.sessionStore.user()?.uid || '';
      const me = store.players().find((player) => player.uid === uid);
      return Boolean(store.hostMode() === true && me?.participationRole === 'spectator');
    }),
    canVote: computed(() => {
      const uid = store.authenticatedUid() || store.sessionStore.user()?.uid || '';
      const me = store.players().find((player) => player.uid === uid);
      if (!me) return false;
      return store.hostMode() === true ? me.participationRole === 'spectator' : true;
    }),
    fakeArtist: computed(() =>
      contestantsFor(store.players(), store.hostMode() === true).find(
        (player) => player.uid === store.revealedFakeArtistUid(),
      ),
    ),
    hasVoted: computed(() => {
      const uid = store.authenticatedUid() || store.sessionStore.user()?.uid || '';
      return Boolean(store.votes()[uid]);
    }),
    requiresProfile: computed(
      () => {
        const uid = store.authenticatedUid() || store.sessionStore.user()?.uid || '';
        const isRoomMaster = Boolean(uid) && uid === store.roomMasterId();
        const me = store.players().find((player) => player.uid === uid);
        return (
          Boolean(uid) &&
          store.status() === '遊戲準備中' &&
          !me &&
          !(isRoomMaster && store.hostMode() === true)
        );
      },
    ),
    canAccessGame: computed(() => {
      const uid = store.authenticatedUid() || store.sessionStore.user()?.uid || '';
      const isRoomMaster = Boolean(uid) && uid === store.roomMasterId();
      return isRoomMaster || store.players().some((player) => player.uid === uid);
    }),
    votesReceived: computed(() => {
      const grouped: Record<string, ArtistPlayer[]> = {};
      const players = store.players();
      const hostMode = store.hostMode() === true;
      const contestants = contestantsFor(players, hostMode);
      const eligibleVoters = eligibleVotersFor(players, hostMode);
      for (const player of contestants) grouped[player.uid] = [];
      for (const [voterUid, targetUid] of Object.entries(store.votes())) {
        const voter = eligibleVoters.find((player) => player.uid === voterUid);
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
        const hostMode = hasDedicatedHost(room);
        const players = normalizePlayers(room.players, hostMode);
        const eligibleVoters = eligibleVotersFor(players, hostMode);
        // With no audience, retain the normal review period instead of ending immediately.
        const allVoted =
          eligibleVoters.length > 0 &&
          eligibleVoters.every((player) => Boolean(room.votes?.[player.uid]));
        if (!allVoted && Date.now() < (room.votingEndsAt ?? 0)) return;
        const fakeArtist = contestantsFor(players, hostMode).find(
          (player) => player.role === '偽藝術家',
        );
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
          const hostMode = hasDedicatedHost(room);
          const players = normalizePlayers(room.players, hostMode);
          patchState(store, {
            ...room,
            gameCode: '002',
            hostMode,
            players,
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
            const eligibleVoters = eligibleVotersFor(players, hostMode);
            if (
              eligibleVoters.length > 0 &&
              eligibleVoters.every((player) => Boolean(room.votes?.[player.uid]))
            ) {
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

      async ensureAnonymousUser(): Promise<string> {
        const user = await ensureBonusGameUser(store.auth);
        store.authenticatedUid.set(user.uid);
        return user.uid;
      },

      savedProfile(): ArtistQuickProfile | null {
        const raw = localStorage.getItem(`${PROFILE_KEY_PREFIX}${store.seq()}`);
        if (!raw) return null;
        try {
          const profile = JSON.parse(raw) as ArtistQuickProfile;
          return (
            typeof profile.displayName === 'string' &&
            typeof profile.photoUrl === 'string' &&
            typeof profile.avatarSeed === 'string'
          )
            ? profile
            : null;
        } catch {
          return null;
        }
      },

      async joinRoom(profile: ArtistQuickProfile) {
        const displayName = profile.displayName.trim();
        if (displayName.length < 2 || displayName.length > 12) {
          await toast('暱稱請輸入 2–12 個字');
          return false;
        }
        const uid = store.uid();
        if (!uid || !store.seq()) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        try {
          await runTransaction(store.firestore, async (transaction) => {
            const snapshot = await transaction.get(roomRef);
            if (!snapshot.exists()) throw new Error('房間不存在');
            const room = snapshot.data() as ArtistGameState;
            const hostMode = hasDedicatedHost(room);
            const currentPlayers = normalizePlayers(room.players, hostMode);
            const existingIndex = currentPlayers.findIndex((player) => player.uid === uid);
            if (hostMode && room.roomMasterId === uid) {
              throw new Error('主持模式下房主不參與遊戲');
            }
            if (room.status !== '遊戲準備中') throw new Error('遊戲已開始，無法新加入');
            if (
              currentPlayers.some(
                (player) =>
                  player.uid !== uid &&
                  player.displayName.toLocaleLowerCase() === displayName.toLocaleLowerCase(),
              )
            ) {
              throw new Error('這個暱稱已被使用');
            }
            if (existingIndex < 0 && currentPlayers.length >= 9) {
              throw new Error('房間已滿，最多 9 位玩家');
            }
            const players = [...currentPlayers];
            if (existingIndex >= 0) {
              players[existingIndex] = { ...players[existingIndex], displayName, photoUrl: profile.photoUrl };
            } else {
              players.push({
                uid,
                displayName,
                photoUrl: profile.photoUrl,
                role: '尚未分配身分',
                participationRole: hostMode ? 'spectator' : 'contestant',
                color: PLAYER_COLORS[currentPlayers.length],
              });
            }
            transaction.update(roomRef, { players });
          });
          localStorage.setItem(
            `${PROFILE_KEY_PREFIX}${store.seq()}`,
            JSON.stringify({ displayName, photoUrl: profile.photoUrl, avatarSeed: profile.avatarSeed }),
          );
          localStorage.setItem(BONUS_GAME_ROOM_STORAGE_KEY, store.seq());
          return true;
        } catch (error) {
          await toast(error instanceof Error ? error.message : '加入失敗');
          return false;
        }
      },

      async leaveRoom() {
        const uid = store.uid();
        if (!uid || !store.seq()) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        const didLeave = await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return true;
          const room = snapshot.data() as ArtistGameState;
          if (room.status !== '遊戲準備中') return false;
          const hostMode = hasDedicatedHost(room);
          const priorPlayers = normalizePlayers(room.players, hostMode);

          if (room.roomMasterId === uid && hostMode) {
            const nextHost = priorPlayers[0];
            if (!nextHost) {
              transaction.delete(roomRef);
            } else {
              transaction.update(roomRef, {
                hostMode: true,
                roomMasterId: nextHost.uid,
                players: priorPlayers.filter((player) => player.uid !== nextHost.uid),
              });
            }
            return true;
          }

          const masterIndex = priorPlayers.findIndex((player) => player.uid === room.roomMasterId);
          const players = priorPlayers.filter((player) => player.uid !== uid);
          if (players.length === 0 && !hostMode) {
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
        if (didLeave) {
          localStorage.removeItem(BONUS_GAME_ROOM_STORAGE_KEY);
          localStorage.removeItem(`${PROFILE_KEY_PREFIX}${store.seq()}`);
        }
        return didLeave;
      },

      async setHostMode(hostMode: boolean) {
        const hostUid = store.uid();
        if (!hostUid || !store.isRoomMaster() || store.status() !== '遊戲準備中') return;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        let cannotJoinAsPlayer = false;
        await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return;
          const room = snapshot.data() as ArtistGameState;
          if (room.roomMasterId !== hostUid || room.status !== '遊戲準備中') return;

          const currentHostMode = hasDedicatedHost(room);
          const currentPlayers = normalizePlayers(room.players, currentHostMode);

          if (hostMode) {
            transaction.update(roomRef, {
              hostMode: true,
              players: currentPlayers.filter((player) => player.uid !== hostUid),
            });
            return;
          }

          const existingHost = currentPlayers.find((player) => player.uid === hostUid);
          if (!existingHost && currentPlayers.length >= 9) {
            cannotJoinAsPlayer = true;
            return;
          }
          const players = currentPlayers
            .filter((player) => player.uid !== hostUid)
            .map((player) => ({
              ...player,
              participationRole: 'contestant' as ArtistParticipationRole,
            }));
          // A dedicated host must explicitly choose a nickname and avatar before joining as a player.
          if (existingHost) {
            players.unshift({ ...existingHost, participationRole: 'contestant' });
          }
          transaction.update(roomRef, { hostMode: false, players });
        });
        if (cannotJoinAsPlayer) await toast('一般模式最多 9 位玩家，請先讓一位玩家離開');
      },

      async setParticipantRole(uid: string, participationRole: ArtistParticipationRole) {
        if (!store.isRoomMaster() || !store.hasDedicatedHost() || store.status() !== '遊戲準備中') {
          return;
        }
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return;
          const room = snapshot.data() as ArtistGameState;
          if (
            room.roomMasterId !== store.uid() ||
            !hasDedicatedHost(room) ||
            room.status !== '遊戲準備中' ||
            uid === room.roomMasterId
          ) {
            return;
          }
          const players = normalizePlayers(room.players, true).map((player) =>
            player.uid === uid
              ? { ...player, participationRole, role: '尚未分配身分' as ArtistRole }
              : player,
          );
          if (!players.some((player) => player.uid === uid)) return;
          transaction.update(roomRef, { players });
        });
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
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        let validationError: string | null = null;
        await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return;
          const room = snapshot.data() as ArtistGameState;
          if (
            room.roomMasterId !== store.uid() ||
            room.status !== '遊戲準備中'
          ) {
            return;
          }

          const hostMode = hasDedicatedHost(room);
          const players = normalizePlayers(room.players, hostMode);
          const contestants = contestantsFor(players, hostMode);
          if (!hostMode && !players.some((player) => player.uid === room.roomMasterId)) {
            validationError = '玩家主持模式下，房主需先設定暱稱與頭像再開始遊戲';
            return;
          }
          if (contestants.length < 3) {
            validationError = hostMode ? '參賽者未達3人無法開始遊戲' : '玩家未達3人無法開始遊戲';
            return;
          }
          if (!room.topic?.category || !room.topic?.word) {
            validationError = '題目尚未準備完成';
            return;
          }

          const drawOrder = shuffled(contestants);
          const fakeArtistIndex = Math.floor(Math.random() * drawOrder.length);
          const assignedContestants = drawOrder.map((player, index) => ({
            ...player,
            role: (index === fakeArtistIndex ? '偽藝術家' : '藝術家') as ArtistRole,
          }));
          const contestantUids = new Set(assignedContestants.map((player) => player.uid));
          const spectators = players
            .filter((player) => !contestantUids.has(player.uid))
            .map((player) => ({ ...player, role: '尚未分配身分' as ArtistRole }));

          transaction.update(roomRef, {
            hostMode,
            players: [...assignedContestants, ...spectators],
            status: '遊戲開始倒數',
            currentPlayerIndex: 0,
            strokes: [],
            votes: {},
            reviewEndsAt: null,
            votingEndsAt: null,
            revealedFakeArtistUid: null,
          });
        });
        if (validationError) await toast(validationError);
      },

      async submitStroke(stroke: ArtistStroke) {
        const uid = store.uid();
        if (!uid || !store.seq()) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        return runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return false;
          const room = snapshot.data() as ArtistGameState;
          const hostMode = hasDedicatedHost(room);
          const players = normalizePlayers(room.players, hostMode);
          const contestants = contestantsFor(players, hostMode);
          const currentPlayer = contestants[room.currentPlayerIndex ?? -1];
          if (room.status !== '繪圖中' || currentPlayer?.uid !== uid || stroke.playerUid !== uid) {
            return false;
          }
          const strokes = [...(room.strokes ?? []), stroke];
          const totalTurns = contestants.length * 2;
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
              currentPlayerIndex: ((room.currentPlayerIndex ?? 0) + 1) % contestants.length,
            });
          }
          return true;
        });
      },

      async voteFor(targetUid: string) {
        const voterUid = store.uid();
        if (!voterUid || store.hasVoted()) return false;
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        const didVote = await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return false;
          const room = snapshot.data() as ArtistGameState;
          const votes = room.votes ?? {};
          const hostMode = hasDedicatedHost(room);
          const players = normalizePlayers(room.players, hostMode);
          const voter = players.find((player) => player.uid === voterUid);
          const contestants = contestantsFor(players, hostMode);
          const target = contestants.find((player) => player.uid === targetUid);
          if (
            room.status !== '最終查找階段' ||
            votes[voterUid] ||
            !voter ||
            !target ||
            (hostMode && voter.participationRole !== 'spectator') ||
            (!hostMode && voterUid === targetUid)
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
        const roomRef = doc(store.firestore, `rooms/${store.seq()}`);
        await runTransaction(store.firestore, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return;
          const room = snapshot.data() as ArtistGameState;
          if (room.roomMasterId !== store.uid()) return;
          const hostMode = hasDedicatedHost(room);
          const players = normalizePlayers(room.players, hostMode).map((player) => ({
            ...player,
            role: '尚未分配身分' as ArtistRole,
          }));
          transaction.update(roomRef, {
            hostMode,
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
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const seq = store.route.snapshot.paramMap.get('seq') ?? '';
      if (seq) {
        patchState(store, { seq });
      }
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
