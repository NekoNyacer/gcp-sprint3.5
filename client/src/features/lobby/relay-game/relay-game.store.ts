import { computed, inject, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  doc,
  Firestore,
  onSnapshot,
  runTransaction,
  Unsubscribe,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
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
import { RelayPdfService } from './relay-pdf.service';
import { avatarDataUrl } from './relay-avatar';
import {
  RELAY_GAME_CODE,
  RELAY_TOPICS,
  RelayGroup,
  RelayGroupSummary,
  RelayPage,
  RelayPlayer,
  RelayRoom,
  RelayStroke,
} from './relay-game.models';
import {
  actionForIndex,
  assignActivityTopics,
  appendFinalGuessPlayer,
  assignedBookId,
  canStartGroup,
  deferCurrentPlayer,
  durationForAction,
  shufflePlayers,
  turnEndsAtForAction,
} from './relay-game.rules';
import { ensureBonusGameUser } from '../bonus-game-auth';
import { BONUS_GAME_ROOM_STORAGE_KEY } from '../bonus-game.constants';

const PROFILE_KEY_PREFIX = 'relayQuickProfile:';
const TABLETOP_GROUP_ID = 'tabletop';

type RelayGameStoreState = {
  room: RelayRoom | null;
  groups: RelayGroup[];
  pagesByGroup: Record<string, RelayPage[]>;
};

type RelayGameMethodName =
  | 'destroy'
  | 'syncPageListeners'
  | 'skipExpired'
  | 'currentAction'
  | 'isUnlimitedTurn'
  | 'toast'
  | 'ensureAnonymousUser'
  | 'updateGroupSummary'
  | 'summary'
  | 'setHostMode'
  | 'unassignPlayer'
  | 'joinGroup'
  | 'removePlayerFromRoom'
  | 'startTabletopGame'
  | 'shuffledTopics'
  | 'assignedBook'
  | 'isMyTurn'
  | 'advanceAfterSubmission'
  | 'markGroupCompleteInRoom'
  | 'refreshRoomCompletion';

type RelayGameMethodContext = {
  [methodName in Exclude<RelayGameMethodName, 'updateGroupSummary'>]: (...args: any[]) => any;
} & {
  updateGroupSummary: (
    groups: RelayGroupSummary[],
    groupId: string,
    changes: Partial<RelayGroupSummary>,
  ) => RelayGroupSummary[];
};

const relayGameInitialState: RelayGameStoreState = {
  room: null,
  groups: [],
  pagesByGroup: {},
};

const PREVIEW_HOST_UID = 'relay-preview-host';

function createLiveGridPreview(): { room: RelayRoom; groups: RelayGroup[] } {
  const groupNames = [
    '第一組・晨光',
    '第二組・綠洲',
    '第三組・星火',
    '第四組・遠行',
    '第二組・綠洲',
    '第二組・綠洲',
    '第二組・綠洲',
    '第二組・綠洲',
    '第二組・綠洲',
    '第二組・綠洲',
    '第二組・綠洲',
  ];
  const playerNames = ['安妮', '柏翰', '思妤'];
  const groups = groupNames.map((name, groupIndex) => {
    const players = playerNames.map((displayName, playerIndex) => ({
      uid: `relay-preview-${groupIndex}-${playerIndex}`,
      displayName,
      avatarSeed: `relay-preview-${groupIndex}-${playerIndex}`,
      avatarUrl: avatarDataUrl(`relay-preview-${groupIndex}-${playerIndex}`),
      joinedAt: 0,
    }));
    const status = groupIndex === groupNames.length - 1 ? 'completed' : 'playing';

    return {
      id: `relay-preview-group-${groupIndex}`,
      name,
      status,
      players,
      turnOrder: players.map((player) => player.uid),
      topic: '城市地標',
      topicsByBook: { [`relay-preview-book-${groupIndex}`]: '城市地標' },
      currentTurnIndex: groupIndex % players.length,
      currentRoundIndex: 0,
      roundSubmissions: [],
      turnEndsAt: null,
      remainingMs: null,
      forcedEnd: false,
      updatedAt: 0,
    } satisfies RelayGroup;
  });

  return {
    groups,
    room: {
      gameCode: RELAY_GAME_CODE,
      seq: 'preview',
      name: '傳情畫意・Live Grid 預覽',
      roomMasterId: PREVIEW_HOST_UID,
      status: '公開揭露',
      mode: 'activity',
      hostMode: true,
      drawingSeconds: 0,
      guessingSeconds: 0,
      isPaused: false,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        playerCount: group.players.length,
        status: group.status,
      })),
      players: groups.flatMap((group) => group.players),
      createdAt: 0,
    },
  };
}

export const RelayGameStore = signalStore(
  withState(relayGameInitialState),
  withProps(() => {
    const auth = inject(Auth);
    return {
      firestore: inject(Firestore),
      auth,
      toastController: inject(ToastController),
      pdfService: inject(RelayPdfService),
      seq: '',
      uid: signal(auth.currentUser?.uid ?? ''),
      isBusy: signal(false),
      error: signal<string | null>(null),
      now: signal(Date.now()),
    };
  }),
  withComputed((store) => {
    const isHost = computed(() => store.room()?.roomMasterId === store.uid());
    /** Undefined is treated as dedicated-host mode so rooms created before this setting stay safe. */
    const hasDedicatedHost = computed(() => store.room()?.hostMode !== false);
    const myPlayer = computed(() =>
      store.room()?.players.find((player) => player.uid === store.uid()),
    );
    const myGroup = computed(() =>
      store.groups().find((group) => group.players.some((player) => player.uid === store.uid())),
    );
    const me = computed(
      () => myGroup()?.players.find((player) => player.uid === store.uid()) ?? myPlayer(),
    );
    const requiresHostRegistration = computed(() => isHost() && !hasDedicatedHost() && !myPlayer());
    const unassignedPlayers = computed(() => {
      const groupedUids = new Set(
        store.groups().flatMap((group) => group.players.map((player) => player.uid)),
      );
      return (store.room()?.players ?? []).filter((player) => !groupedUids.has(player.uid));
    });

    return {
      isHost,
      hasDedicatedHost,
      myPlayer,
      myGroup,
      me,
      requiresHostRegistration,
      unassignedPlayers,
    };
  }),
  withMethods((store) => {
    let roomListener: Unsubscribe | null = null;
    let groupsListener: Unsubscribe | null = null;
    const pageListeners = new Map<string, Unsubscribe>();

    const methods = {
      init(seq: string) {
        this.destroy();
        this.seq = seq;
        this.uid.set(this.auth.currentUser?.uid ?? '');
        localStorage.setItem('bonusGameRoomSeq', seq);
        roomListener = onSnapshot(
          doc(this.firestore, `rooms/${seq}`),
          (snapshot) => {
            if (!snapshot.exists()) {
              this.error.set('找不到這場遊戲');
              return;
            }
            patchState(store, { room: snapshot.data() as RelayRoom });
          },
          () => this.error.set('無法讀取遊戲，請確認 Firebase 匿名登入已啟用'),
        );
        groupsListener = onSnapshot(
          collection(this.firestore, `rooms/${seq}/relayGroups`),
          (snapshot) => {
            const groups = snapshot.docs
              .map((groupSnapshot) => groupSnapshot.data() as RelayGroup)
              .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));
            patchState(store, { groups });
            this.syncPageListeners(groups);
          },
          () => this.error.set('無法讀取小組資料'),
        );
      },

      previewLiveGrid() {
        const preview = createLiveGridPreview();
        this.destroy();
        this.seq = preview.room.seq;
        this.uid.set(preview.room.roomMasterId);
        this.error.set(null);
        this.isBusy.set(false);
        patchState(store, {
          room: preview.room,
          groups: preview.groups,
          pagesByGroup: {},
        });
      },

      destroy() {
        roomListener?.();
        groupsListener?.();
        roomListener = null;
        groupsListener = null;
        for (const unsubscribe of pageListeners.values()) unsubscribe();
        pageListeners.clear();
      },

      tick() {
        this.now.set(Date.now());
        for (const group of this.groups()) {
          if (
            group.status === 'playing' &&
            !this.room()?.isPaused &&
            group.turnEndsAt !== null &&
            group.turnEndsAt <= this.now()
          ) {
            void this.skipExpired(group.id);
          }
        }
      },

      remainingSeconds(group: RelayGroup): number {
        if (group.status !== 'playing') return 0;
        const remaining = this.room()?.isPaused
          ? (group.remainingMs ?? 0)
          : Math.max(0, (group.turnEndsAt ?? this.now()) - this.now());
        return Math.ceil(remaining / 1000);
      },

      isUnlimitedTurn(group: RelayGroup): boolean {
        const room = this.room();
        return (
          group.status === 'playing' &&
          Boolean(room) &&
          durationForAction(
            this.currentAction(group),
            room!.drawingSeconds,
            room!.guessingSeconds,
          ) === 0
        );
      },

      hasActiveTimers(): boolean {
        return this.groups().some(
          (group) => group.status === 'playing' && !this.isUnlimitedTurn(group),
        );
      },

      unsubmittedPlayers(group: RelayGroup): RelayPlayer[] {
        const room = this.room();
        if (!room || group.status !== 'playing') return [];
        if (room.mode === 'activity') {
          const currentUid = group.turnOrder[group.currentTurnIndex];
          return group.players.filter((player) => player.uid === currentUid);
        }
        return group.players.filter((player) => !group.roundSubmissions.includes(player.uid));
      },

      async ensureAnonymousUser(): Promise<string> {
        const user = await ensureBonusGameUser(this.auth);
        this.uid.set(user.uid);
        return user.uid;
      },

      savedProfile(): Pick<RelayPlayer, 'displayName' | 'avatarSeed' | 'avatarUrl'> | null {
        const raw = localStorage.getItem(`${PROFILE_KEY_PREFIX}${this.seq}`);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as Pick<RelayPlayer, 'displayName' | 'avatarSeed' | 'avatarUrl'>;
        } catch {
          return null;
        }
      },

      async joinRoom(profile: Pick<RelayPlayer, 'displayName' | 'avatarSeed' | 'avatarUrl'>) {
        const displayName = profile.displayName.trim();
        if (displayName.length < 2 || displayName.length > 12) {
          await this.toast('暱稱請輸入 2–12 個字');
          return false;
        }
        this.isBusy.set(true);
        try {
          const uid = await this.ensureAnonymousUser();
          const roomRef = doc(this.firestore, `rooms/${this.seq}`);
          await runTransaction(this.firestore, async (transaction) => {
            const roomSnapshot = await transaction.get(roomRef);
            if (!roomSnapshot.exists()) throw new Error('房間不存在');
            const room = roomSnapshot.data() as RelayRoom;
            if (room.status !== '遊戲準備中') throw new Error('遊戲已開始，無法新加入');
            if (room.hostMode !== false && room.roomMasterId === uid) {
              throw new Error('主持模式下房主不參與遊戲');
            }
            if (
              room.players.some(
                (player) =>
                  player.uid !== uid &&
                  player.displayName.toLowerCase() === displayName.toLowerCase(),
              )
            ) {
              throw new Error('這個暱稱已被使用');
            }
            const existing = room.players.find((player) => player.uid === uid);
            if (room.mode === 'tabletop' && !existing && room.players.length >= 15) {
              throw new Error('桌遊版最多 15 位玩家');
            }
            const player: RelayPlayer = {
              uid,
              displayName,
              avatarSeed: profile.avatarSeed,
              avatarUrl: profile.avatarUrl,
              joinedAt: existing?.joinedAt ?? Date.now(),
            };
            const players = room.players.filter((item) => item.uid !== uid);
            if (existing) players.splice(room.players.indexOf(existing), 0, player);
            else if (room.mode === 'tabletop') {
              players.splice(Math.floor(Math.random() * (players.length + 1)), 0, player);
            } else players.push(player);
            transaction.update(roomRef, { players });
          });
          localStorage.setItem(`${PROFILE_KEY_PREFIX}${this.seq}`, JSON.stringify(profile));
          return true;
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '加入失敗');
          return false;
        } finally {
          this.isBusy.set(false);
        }
      },

      async joinGroup(
        groupId: string,
        profile: Pick<RelayPlayer, 'displayName' | 'avatarSeed' | 'avatarUrl'>,
      ) {
        const displayName = profile.displayName.trim();
        if (displayName.length < 2 || displayName.length > 12) {
          await this.toast('暱稱請輸入 2–12 個字');
          return false;
        }
        this.isBusy.set(true);
        try {
          const uid = await this.ensureAnonymousUser();
          const roomRef = doc(this.firestore, `rooms/${this.seq}`);
          const groupRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${groupId}`);
          await runTransaction(this.firestore, async (transaction) => {
            const [roomSnapshot, groupSnapshot] = await Promise.all([
              transaction.get(roomRef),
              transaction.get(groupRef),
            ]);
            if (!roomSnapshot.exists() || !groupSnapshot.exists()) throw new Error('組別不存在');
            const room = roomSnapshot.data() as RelayRoom;
            const group = groupSnapshot.data() as RelayGroup;
            if (room.status !== '遊戲準備中') throw new Error('遊戲已開始，無法新加入');
            if (room.hostMode !== false && room.roomMasterId === uid) {
              throw new Error('主持模式下房主不參與遊戲');
            }
            if (room.mode === 'tabletop') throw new Error('桌遊版不使用小組，請直接加入房間');
            const existing = group.players.findIndex((player) => player.uid === uid);
            if (existing < 0 && group.players.length >= 15) throw new Error('這一組已滿');
            if (
              room.players.some(
                (player) =>
                  player.uid !== uid &&
                  player.displayName.toLowerCase() === displayName.toLowerCase(),
              )
            ) {
              throw new Error('這個暱稱已被使用');
            }
            const player: RelayPlayer = {
              uid,
              displayName,
              avatarSeed: profile.avatarSeed,
              avatarUrl: profile.avatarUrl,
              joinedAt: existing >= 0 ? group.players[existing].joinedAt : Date.now(),
            };
            const players = [...group.players];
            const turnOrder = group.turnOrder.filter((playerUid) => playerUid !== uid);
            if (existing >= 0) players[existing] = player;
            else {
              players.push(player);
              const insertAt = Math.floor(Math.random() * (turnOrder.length + 1));
              turnOrder.splice(insertAt, 0, uid);
            }
            const allPlayers = room.players.filter((roomPlayer) => roomPlayer.uid !== uid);
            allPlayers.push(player);
            transaction.update(groupRef, { players, turnOrder, updatedAt: Date.now() });
            transaction.update(roomRef, {
              players: allPlayers,
              groups: this.updateGroupSummary(room.groups, groupId, {
                playerCount: players.length,
              }),
            });
          });
          localStorage.setItem(`${PROFILE_KEY_PREFIX}${this.seq}`, JSON.stringify(profile));
          return true;
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '加入失敗');
          return false;
        } finally {
          this.isBusy.set(false);
        }
      },

      async addGroup() {
        if (
          !this.isHost() ||
          this.room()?.status !== '遊戲準備中' ||
          this.room()?.mode !== 'activity'
        )
          return;
        const id = crypto.randomUUID().slice(0, 8);
        const nextNumber = this.groups().length + 1;
        const group: RelayGroup = {
          id,
          name: `第 ${nextNumber} 組`,
          status: 'waiting',
          players: [],
          turnOrder: [],
          topic: '',
          topicsByBook: {},
          currentTurnIndex: 0,
          currentRoundIndex: 0,
          roundSubmissions: [],
          turnEndsAt: null,
          remainingMs: null,
          forcedEnd: false,
          updatedAt: Date.now(),
        };
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const groupRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${id}`);
        await runTransaction(this.firestore, async (transaction) => {
          const roomSnapshot = await transaction.get(roomRef);
          if (!roomSnapshot.exists()) return;
          const room = roomSnapshot.data() as RelayRoom;
          transaction.set(groupRef, group);
          transaction.update(roomRef, {
            groups: [...room.groups, this.summary(group)],
          });
        });
      },

      async removeGroup(group: RelayGroup) {
        if (!this.isHost() || this.room()?.status !== '遊戲準備中') return;
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const groupRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`);
        try {
          await runTransaction(this.firestore, async (transaction) => {
            const [roomSnapshot, groupSnapshot] = await Promise.all([
              transaction.get(roomRef),
              transaction.get(groupRef),
            ]);
            if (!roomSnapshot.exists() || !groupSnapshot.exists()) return;
            const room = roomSnapshot.data() as RelayRoom;
            if (room.status !== '遊戲準備中') return;

            // Players stay in room.players; after this group disappears they are unassigned automatically.
            transaction.delete(groupRef);
            transaction.update(roomRef, {
              groups: room.groups.filter((item) => item.id !== group.id),
            });
          });
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '無法刪除小組');
        }
      },

      async updateGroupName(groupId: string, name: string) {
        const value = name.trim().slice(0, 20);
        if (!value || !this.isHost()) return;
        await updateDoc(doc(this.firestore, `rooms/${this.seq}/relayGroups/${groupId}`), {
          name: value,
          updatedAt: Date.now(),
        });
        await updateDoc(doc(this.firestore, `rooms/${this.seq}`), {
          groups: this.updateGroupSummary(this.room()!.groups, groupId, { name: value }),
        });
      },

      async updateSettings(
        changes: Partial<
          Pick<RelayRoom, 'mode' | 'hostMode' | 'drawingSeconds' | 'guessingSeconds'>
        >,
      ) {
        if (!this.isHost() || this.room()?.status !== '遊戲準備中') return;
        if (
          (changes.drawingSeconds !== undefined &&
            ![0, 60, 75, 90].includes(changes.drawingSeconds)) ||
          (changes.guessingSeconds !== undefined &&
            ![0, 20, 30, 45].includes(changes.guessingSeconds))
        )
          return;
        if (changes.hostMode === undefined || changes.hostMode === this.hasDedicatedHost()) {
          await updateDoc(doc(this.firestore, `rooms/${this.seq}`), changes);
          return;
        }

        await this.setHostMode(changes.hostMode, changes);
      },

      async setHostMode(
        hostMode: boolean,
        changes: Partial<
          Pick<RelayRoom, 'mode' | 'hostMode' | 'drawingSeconds' | 'guessingSeconds'>
        >,
      ) {
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const groupRefs = this.groups().map((group) =>
          doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`),
        );
        await runTransaction(this.firestore, async (transaction) => {
          const [roomSnapshot, ...groupSnapshots] = await Promise.all([
            transaction.get(roomRef),
            ...groupRefs.map((groupRef) => transaction.get(groupRef)),
          ]);
          if (!roomSnapshot.exists()) return;
          const room = roomSnapshot.data() as RelayRoom;
          if (room.status !== '遊戲準備中' || room.roomMasterId !== this.uid()) return;

          if (!hostMode) {
            transaction.update(roomRef, { ...changes, hostMode: false });
            return;
          }

          const hostUid = room.roomMasterId;
          let summaries = room.groups;
          for (const groupSnapshot of groupSnapshots) {
            if (!groupSnapshot.exists()) continue;
            const group = groupSnapshot.data() as RelayGroup;
            if (!group.players.some((player) => player.uid === hostUid)) continue;
            const players = group.players.filter((player) => player.uid !== hostUid);
            transaction.update(groupSnapshot.ref, {
              players,
              turnOrder: group.turnOrder.filter((uid) => uid !== hostUid),
              updatedAt: Date.now(),
            });
            summaries = this.updateGroupSummary(summaries, group.id, {
              playerCount: players.length,
            });
          }
          transaction.update(roomRef, {
            ...changes,
            hostMode: true,
            players: room.players.filter((player) => player.uid !== hostUid),
            groups: summaries,
          });
        });
      },

      async reorderPlayer(group: RelayGroup, playerUid: string, direction: -1 | 1) {
        if (!this.isHost()) return;
        const order = [...group.turnOrder];
        const index = order.indexOf(playerUid);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= order.length) return;
        [order[index], order[target]] = [order[target], order[index]];
        await updateDoc(doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`), {
          turnOrder: order,
          updatedAt: Date.now(),
        });
      },

      async shuffleGroup(group: RelayGroup) {
        if (!this.isHost()) return;
        const order = shufflePlayers(group.players).map((player) => player.uid);
        await updateDoc(doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`), {
          turnOrder: order,
          updatedAt: Date.now(),
        });
      },

      async reorderTabletopPlayer(playerUid: string, direction: -1 | 1) {
        const room = this.room();
        if (!room || !this.isHost() || room.mode !== 'tabletop' || room.status !== '遊戲準備中') {
          return;
        }
        const players = [...room.players];
        const index = players.findIndex((player) => player.uid === playerUid);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= players.length) return;
        [players[index], players[target]] = [players[target], players[index]];
        await updateDoc(doc(this.firestore, `rooms/${this.seq}`), { players });
      },

      async shuffleTabletopPlayers() {
        const room = this.room();
        if (!room || !this.isHost() || room.mode !== 'tabletop' || room.status !== '遊戲準備中') {
          return;
        }
        await updateDoc(doc(this.firestore, `rooms/${this.seq}`), {
          players: shufflePlayers(room.players),
        });
      },

      async movePlayer(playerUid: string, sourceId: string, targetId: string) {
        if (!this.isHost() || sourceId === targetId) return;
        if (targetId === 'unassigned') {
          await this.unassignPlayer(playerUid, sourceId);
          return;
        }
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const sourceRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${sourceId}`);
        const targetRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${targetId}`);
        try {
          await runTransaction(this.firestore, async (transaction) => {
            const [roomSnapshot, sourceSnapshot, targetSnapshot] = await Promise.all([
              transaction.get(roomRef),
              transaction.get(sourceRef),
              transaction.get(targetRef),
            ]);
            if (!roomSnapshot.exists() || !sourceSnapshot.exists() || !targetSnapshot.exists())
              return;
            const room = roomSnapshot.data() as RelayRoom;
            const source = sourceSnapshot.data() as RelayGroup;
            const target = targetSnapshot.data() as RelayGroup;
            const player = source.players.find((item) => item.uid === playerUid);
            if (!player || target.players.length >= 15) throw new Error('目標組別已滿');
            const sourcePlayers = source.players.filter((item) => item.uid !== playerUid);
            const targetPlayers = [...target.players, player];
            const targetOrder = [...target.turnOrder];
            targetOrder.splice(Math.floor(Math.random() * (targetOrder.length + 1)), 0, playerUid);
            transaction.update(sourceRef, {
              players: sourcePlayers,
              turnOrder: source.turnOrder.filter((uid) => uid !== playerUid),
              updatedAt: Date.now(),
            });
            transaction.update(targetRef, {
              players: targetPlayers,
              turnOrder: targetOrder,
              updatedAt: Date.now(),
            });
            transaction.update(roomRef, {
              groups: this.updateGroupSummary(
                this.updateGroupSummary(room.groups, sourceId, {
                  playerCount: sourcePlayers.length,
                }),
                targetId,
                { playerCount: targetPlayers.length },
              ),
            });
          });
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '移動失敗');
        }
      },

      async assignUnassignedPlayer(playerUid: string, targetId: string) {
        if (!this.isHost() || this.room()?.mode !== 'activity') return;
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const targetRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${targetId}`);
        try {
          await runTransaction(this.firestore, async (transaction) => {
            const [roomSnapshot, targetSnapshot] = await Promise.all([
              transaction.get(roomRef),
              transaction.get(targetRef),
            ]);
            if (!roomSnapshot.exists() || !targetSnapshot.exists()) return;
            const room = roomSnapshot.data() as RelayRoom;
            const target = targetSnapshot.data() as RelayGroup;
            const player = room.players.find((item) => item.uid === playerUid);
            if (!player) throw new Error('找不到這位玩家');
            if (
              this.groups().some((group) => group.players.some((item) => item.uid === playerUid))
            ) {
              throw new Error('玩家已在其他小組');
            }
            if (target.players.length >= 15) throw new Error('目標組別已滿');
            const players = [...target.players, player];
            const turnOrder = [...target.turnOrder];
            turnOrder.splice(Math.floor(Math.random() * (turnOrder.length + 1)), 0, playerUid);
            transaction.update(targetRef, { players, turnOrder, updatedAt: Date.now() });
            transaction.update(roomRef, {
              groups: this.updateGroupSummary(room.groups, targetId, {
                playerCount: players.length,
              }),
            });
          });
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '分組失敗');
        }
      },

      async chooseGroup(groupId: string) {
        const player = this.myPlayer();
        if (!player || this.myGroup() || this.room()?.mode !== 'activity') return false;
        return this.joinGroup(groupId, {
          displayName: player.displayName,
          avatarSeed: player.avatarSeed,
          avatarUrl: player.avatarUrl,
        });
      },

      async leaveMyGroup() {
        const room = this.room();
        const group = this.myGroup();
        if (
          !room ||
          room.status !== '遊戲準備中' ||
          room.mode !== 'activity' ||
          !group ||
          this.isBusy()
        )
          return;

        this.isBusy.set(true);
        try {
          await this.unassignPlayer(this.uid(), group.id);
        } finally {
          this.isBusy.set(false);
        }
      },

      async removePlayer(playerUid: string) {
        const room = this.room();
        if (!room || !this.isHost() || room.status !== '遊戲準備中') return;
        try {
          await this.removePlayerFromRoom(playerUid, false);
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '無法移除玩家');
        }
      },

      async leaveRoom(): Promise<boolean> {
        const room = this.room();
        if (!room) return false;
        if (!['遊戲準備中', '遊戲結束'].includes(room.status)) {
          await this.toast('遊戲進行中或公開揭露時無法離開房間');
          return false;
        }
        try {
          if (room.players.some((player) => player.uid === this.uid())) {
            await this.removePlayerFromRoom(this.uid(), true);
          }
          localStorage.removeItem(BONUS_GAME_ROOM_STORAGE_KEY);
          localStorage.removeItem(`${PROFILE_KEY_PREFIX}${this.seq}`);
          return true;
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '無法離開房間');
          return false;
        }
      },

      async startGame() {
        const room = this.room();
        if (!room || !this.isHost()) return;
        if (room.hostMode === false && !this.myPlayer()) {
          await this.toast('玩家主持模式下，房主請先填寫名稱並加入遊戲');
          return;
        }
        if (room.mode === 'tabletop') {
          await this.startTabletopGame(room);
          return;
        }
        if (this.groups().length === 0) {
          await this.toast('請先建立至少一個小組');
          return;
        }
        if (this.unassignedPlayers().length > 0) {
          await this.toast(`還有 ${this.unassignedPlayers().length} 位玩家尚未分組`);
          return;
        }
        const invalid = this.groups().find((group) => !canStartGroup(group, room.mode));
        if (invalid) {
          await this.toast(`${invalid.name} 人數需為 4–15 人`);
          return;
        }
        const batch = writeBatch(this.firestore);
        const activityTopics = assignActivityTopics(this.groups());
        this.groups().forEach((group) => {
          const playerOrder =
            group.turnOrder.length === group.players.length
              ? group.turnOrder
              : shufflePlayers(group.players).map((player) => player.uid);
          const order = appendFinalGuessPlayer(playerOrder);
          const topicsByBook = { activity: activityTopics[group.id] };
          batch.update(doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`), {
            status: 'playing',
            turnOrder: order,
            topicsByBook,
            currentTurnIndex: 0,
            currentRoundIndex: 0,
            roundSubmissions: [],
            turnEndsAt: turnEndsAtForAction(
              Date.now(),
              'drawing',
              room.drawingSeconds,
              room.guessingSeconds,
            ),
            remainingMs: null,
            forcedEnd: false,
            updatedAt: Date.now(),
          });
        });
        batch.update(doc(this.firestore, `rooms/${this.seq}`), {
          status: '遊戲進行中',
          isPaused: false,
          groups: room.groups.map((group) => ({ ...group, status: 'playing' })),
        });
        await batch.commit();
      },

      async startTabletopGame(room: RelayRoom) {
        if (room.players.length < 4 || room.players.length > 15) {
          await this.toast('桌遊版需 4–15 位玩家');
          return;
        }
        const order = room.players.map((player) => player.uid);
        const topicDeck = this.shuffledTopics();
        const group: RelayGroup = {
          id: TABLETOP_GROUP_ID,
          name: '本桌玩家',
          status: 'playing',
          players: room.players,
          turnOrder: order,
          topic: '',
          topicsByBook: Object.fromEntries(
            order.map((uid, index) => [uid, topicDeck[index % topicDeck.length]]),
          ),
          currentTurnIndex: 0,
          currentRoundIndex: 0,
          roundSubmissions: [],
          turnEndsAt: turnEndsAtForAction(
            Date.now(),
            'drawing',
            room.drawingSeconds,
            room.guessingSeconds,
          ),
          remainingMs: null,
          forcedEnd: false,
          updatedAt: Date.now(),
        };
        const batch = writeBatch(this.firestore);
        for (const existingGroup of this.groups()) {
          if (existingGroup.id !== TABLETOP_GROUP_ID) {
            batch.delete(doc(this.firestore, `rooms/${this.seq}/relayGroups/${existingGroup.id}`));
          }
        }
        batch.set(doc(this.firestore, `rooms/${this.seq}/relayGroups/${TABLETOP_GROUP_ID}`), group);
        batch.update(doc(this.firestore, `rooms/${this.seq}`), {
          status: '遊戲進行中',
          isPaused: false,
          groups: [this.summary(group)],
        });
        await batch.commit();
      },

      currentAction(group: RelayGroup) {
        return actionForIndex(
          this.room()?.mode === 'activity' ? group.currentTurnIndex : group.currentRoundIndex,
        );
      },

      isMyTurn(group: RelayGroup): boolean {
        if (group.status !== 'playing' || this.room()?.isPaused) return false;
        if (this.room()?.mode === 'activity')
          return group.turnOrder[group.currentTurnIndex] === this.uid();
        return !group.roundSubmissions.includes(this.uid()) && group.turnOrder.includes(this.uid());
      },

      assignedBook(group: RelayGroup): string | null {
        return assignedBookId(group, this.uid());
      },

      previousPage(group: RelayGroup): RelayPage | null {
        const bookId = this.assignedBook(group);
        if (!bookId) return null;
        const pageIndex =
          this.room()?.mode === 'activity'
            ? group.currentTurnIndex - 1
            : group.currentRoundIndex - 1;
        return (
          this.pagesByGroup()[group.id]?.find(
            (page) => page.bookId === bookId && page.pageIndex === pageIndex,
          ) ?? null
        );
      },

      currentTopic(group: RelayGroup): string | null {
        const bookId = this.assignedBook(group);
        if (!bookId) return null;
        const firstTurn =
          this.room()?.mode === 'activity'
            ? group.currentTurnIndex === 0
            : group.currentRoundIndex === 0;
        return firstTurn ? (group.topicsByBook[bookId] ?? null) : null;
      },

      async submit(strokes: RelayStroke[]) {
        const room = this.room();
        const group = this.myGroup();
        const me = this.me();
        if (!room || !group || !me || !this.isMyTurn(group) || strokes.length === 0) return false;
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const groupRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`);
        try {
          await runTransaction(this.firestore, async (transaction) => {
            const [roomSnapshot, groupSnapshot] = await Promise.all([
              transaction.get(roomRef),
              transaction.get(groupRef),
            ]);
            if (!roomSnapshot.exists() || !groupSnapshot.exists()) return;
            const freshRoom = roomSnapshot.data() as RelayRoom;
            const freshGroup = groupSnapshot.data() as RelayGroup;
            if (freshRoom.isPaused || freshGroup.status !== 'playing')
              throw new Error('回合已停止');
            const pageIndex =
              freshRoom.mode === 'activity'
                ? freshGroup.currentTurnIndex
                : freshGroup.currentRoundIndex;
            if (freshRoom.mode === 'activity' && freshGroup.turnOrder[pageIndex] !== me.uid) {
              throw new Error('現在不是你的回合');
            }
            if (freshRoom.mode === 'tabletop' && freshGroup.roundSubmissions.includes(me.uid)) {
              throw new Error('你已完成這一輪');
            }
            const bookId = assignedBookId(freshGroup, me.uid);
            if (!bookId) throw new Error('找不到接力冊');
            const pageRef = doc(
              this.firestore,
              `rooms/${this.seq}/relayGroups/${group.id}/pages/${bookId}_${pageIndex}`,
            );
            const page: RelayPage = {
              id: `${bookId}_${pageIndex}`,
              groupId: group.id,
              bookId,
              pageIndex,
              playerUid: me.uid,
              playerName: me.displayName,
              playerAvatarSeed: me.avatarSeed,
              kind: actionForIndex(pageIndex),
              strokes,
              submittedAt: Date.now(),
            };
            transaction.set(pageRef, page);
            this.advanceAfterSubmission(
              transaction,
              groupRef,
              roomRef,
              freshRoom,
              freshGroup,
              me.uid,
            );
          });
          return true;
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '送出失敗');
          return false;
        }
      },

      async pauseAll() {
        const room = this.room();
        if (!room || !this.isHost() || room.status !== '遊戲進行中') return;
        const batch = writeBatch(this.firestore);
        const now = Date.now();
        for (const group of this.groups().filter((item) => item.status === 'playing')) {
          const unlimited = this.isUnlimitedTurn(group);
          batch.update(doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`), {
            turnEndsAt: null,
            remainingMs: unlimited ? null : Math.max(0, (group.turnEndsAt ?? now) - now),
            updatedAt: now,
          });
        }
        batch.update(doc(this.firestore, `rooms/${this.seq}`), { isPaused: true });
        await batch.commit();
      },

      async resumeAll() {
        const room = this.room();
        if (!room || !this.isHost() || !room.isPaused) return;
        const batch = writeBatch(this.firestore);
        const now = Date.now();
        for (const group of this.groups().filter((item) => item.status === 'playing')) {
          const unlimited = this.isUnlimitedTurn(group);
          batch.update(doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`), {
            turnEndsAt: unlimited ? null : now + Math.max(1_000, group.remainingMs ?? 1_000),
            remainingMs: null,
            updatedAt: now,
          });
        }
        batch.update(doc(this.firestore, `rooms/${this.seq}`), { isPaused: false });
        await batch.commit();
      },

      async extendGroup(groupId: string) {
        if (!this.isHost()) return;
        const group = this.groups().find((item) => item.id === groupId);
        if (!group || group.status !== 'playing' || this.isUnlimitedTurn(group)) return;
        await updateDoc(
          doc(this.firestore, `rooms/${this.seq}/relayGroups/${groupId}`),
          this.room()?.isPaused
            ? { remainingMs: (group.remainingMs ?? 0) + 30_000, updatedAt: Date.now() }
            : { turnEndsAt: (group.turnEndsAt ?? Date.now()) + 30_000, updatedAt: Date.now() },
        );
      },

      async skipTurn(groupId: string) {
        if (!this.isHost()) return;
        await this.skipExpired(groupId, true);
      },

      async forceEnd(groupId: string) {
        if (!this.isHost()) return;
        await updateDoc(doc(this.firestore, `rooms/${this.seq}/relayGroups/${groupId}`), {
          status: 'completed',
          turnEndsAt: null,
          remainingMs: null,
          forcedEnd: true,
          updatedAt: Date.now(),
        });
        await this.refreshRoomCompletion(groupId);
      },

      async reveal() {
        if (!this.isHost() || this.groups().some((group) => group.status !== 'completed')) return;
        await updateDoc(doc(this.firestore, `rooms/${this.seq}`), {
          status: '公開揭露',
          isPaused: false,
          groups: this.room()!.groups.map((group) => ({ ...group, status: 'completed' })),
        });
      },

      async finishGame() {
        const room = this.room();
        if (!room || !this.isHost() || room.status !== '公開揭露') return;
        await updateDoc(doc(this.firestore, `rooms/${this.seq}`), { status: '遊戲結束' });
      },

      async downloadGroup(group: RelayGroup) {
        const room = this.room();
        if (!room) return;
        const pages = this.pagesByGroup()[group.id] ?? [];
        if (this.isHost()) {
          await this.pdfService.download(room, group, pages);
          return;
        }
        if (group.id !== this.myGroup()?.id) {
          await this.toast('只能下載自己的接力冊');
          return;
        }
        if (room.mode === 'tabletop') {
          const player = this.myPlayer();
          if (!player || !group.topicsByBook[player.uid]) {
            await this.toast('找不到你的接力冊');
            return;
          }
          await this.pdfService.download(
            room,
            group,
            pages,
            [player.uid],
            `${player.displayName} 的接力冊`,
          );
          return;
        }
        await this.pdfService.download(room, group, pages);
      },

      async downloadAll() {
        const room = this.room();
        if (!room || !this.isHost() || this.groups().length === 0) return;
        await this.pdfService.downloadAll(
          room,
          this.groups().map((group) => ({
            group,
            pages: this.pagesByGroup()[group.id] ?? [],
          })),
        );
      },

      advanceAfterSubmission(
        transaction: Parameters<Parameters<typeof runTransaction>[1]>[0],
        groupRef: ReturnType<typeof doc>,
        roomRef: ReturnType<typeof doc>,
        room: RelayRoom,
        group: RelayGroup,
        playerUid: string,
      ) {
        const now = Date.now();
        if (room.mode === 'activity') {
          const nextIndex = group.currentTurnIndex + 1;
          const complete = nextIndex >= group.turnOrder.length;
          transaction.update(
            groupRef,
            complete
              ? {
                  status: 'completed',
                  currentTurnIndex: nextIndex,
                  turnEndsAt: null,
                  updatedAt: now,
                }
              : {
                  currentTurnIndex: nextIndex,
                  turnEndsAt: turnEndsAtForAction(
                    now,
                    actionForIndex(nextIndex),
                    room.drawingSeconds,
                    room.guessingSeconds,
                  ),
                  updatedAt: now,
                },
          );
          if (complete) this.markGroupCompleteInRoom(transaction, roomRef, room, group.id);
          return;
        }

        const submissions = [...group.roundSubmissions, playerUid];
        if (submissions.length < group.turnOrder.length) {
          transaction.update(groupRef, { roundSubmissions: submissions, updatedAt: now });
          return;
        }
        const nextRound = group.currentRoundIndex + 1;
        const complete = nextRound >= group.turnOrder.length;
        transaction.update(
          groupRef,
          complete
            ? {
                status: 'completed',
                currentRoundIndex: nextRound,
                roundSubmissions: [],
                turnEndsAt: null,
                updatedAt: now,
              }
            : {
                currentRoundIndex: nextRound,
                roundSubmissions: [],
                turnEndsAt: turnEndsAtForAction(
                  now,
                  actionForIndex(nextRound),
                  room.drawingSeconds,
                  room.guessingSeconds,
                ),
                updatedAt: now,
              },
        );
        if (complete) this.markGroupCompleteInRoom(transaction, roomRef, room, group.id);
      },

      async skipExpired(groupId: string, force = false) {
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const groupRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${groupId}`);
        try {
          await runTransaction(this.firestore, async (transaction) => {
            const [roomSnapshot, groupSnapshot] = await Promise.all([
              transaction.get(roomRef),
              transaction.get(groupRef),
            ]);
            if (!roomSnapshot.exists() || !groupSnapshot.exists()) return;
            const room = roomSnapshot.data() as RelayRoom;
            const group = groupSnapshot.data() as RelayGroup;
            if (
              room.isPaused ||
              group.status !== 'playing' ||
              (!force && (group.turnEndsAt ?? Infinity) > Date.now())
            )
              return;
            if (room.mode === 'activity') {
              const currentIndex = group.currentTurnIndex;
              const nextTurnOrder = deferCurrentPlayer(group.turnOrder, currentIndex);
              const nextPlayerUid = nextTurnOrder[currentIndex];
              if (!nextPlayerUid) return;

              transaction.update(groupRef, {
                turnOrder: nextTurnOrder,
                turnEndsAt: turnEndsAtForAction(
                  Date.now(),
                  actionForIndex(currentIndex),
                  room.drawingSeconds,
                  room.guessingSeconds,
                ),
                remainingMs: null,
                updatedAt: Date.now(),
              });
              return;
            }

            const pageIndex = group.currentRoundIndex;
            const missingUids = group.turnOrder.filter(
              (uid) => !group.roundSubmissions.includes(uid),
            );
            for (const uid of missingUids) {
              const player = group.players.find((item) => item.uid === uid);
              const bookId = assignedBookId(group, uid);
              if (!player || !bookId) continue;
              const page: RelayPage = {
                id: `${bookId}_${pageIndex}`,
                groupId,
                bookId,
                pageIndex,
                playerUid: uid,
                playerName: player.displayName,
                playerAvatarSeed: player.avatarSeed,
                kind: 'skipped',
                strokes: [],
                submittedAt: Date.now(),
              };
              transaction.set(
                doc(this.firestore, `rooms/${this.seq}/relayGroups/${groupId}/pages/${page.id}`),
                page,
              );
            }
            const nextRound = group.currentRoundIndex + 1;
            const complete = nextRound >= group.turnOrder.length;
            transaction.update(
              groupRef,
              complete
                ? {
                    status: 'completed',
                    currentRoundIndex: nextRound,
                    roundSubmissions: [],
                    turnEndsAt: null,
                    updatedAt: Date.now(),
                  }
                : {
                    currentRoundIndex: nextRound,
                    roundSubmissions: [],
                    turnEndsAt: turnEndsAtForAction(
                      Date.now(),
                      actionForIndex(nextRound),
                      room.drawingSeconds,
                      room.guessingSeconds,
                    ),
                    updatedAt: Date.now(),
                  },
            );
            if (complete) this.markGroupCompleteInRoom(transaction, roomRef, room, group.id);
          });
        } catch {
          // Another connected client may have advanced the same expired turn first.
        }
      },

      markGroupCompleteInRoom(
        transaction: Parameters<Parameters<typeof runTransaction>[1]>[0],
        roomRef: ReturnType<typeof doc>,
        room: RelayRoom,
        groupId: string,
      ) {
        const summaries = this.updateGroupSummary(room.groups, groupId, { status: 'completed' });
        transaction.update(roomRef, {
          groups: summaries,
          status: summaries.every((group) => group.status === 'completed')
            ? '等待揭露'
            : room.status,
        });
      },

      async removePlayerFromRoom(playerUid: string, allowEndedRoom: boolean): Promise<boolean> {
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const groupRefs = this.groups().map((group) =>
          doc(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}`),
        );
        return runTransaction(this.firestore, async (transaction) => {
          const roomSnapshot = await transaction.get(roomRef);
          const groupSnapshots = await Promise.all(
            groupRefs.map((groupRef) => transaction.get(groupRef)),
          );
          if (!roomSnapshot.exists()) throw new Error('房間不存在');
          const room = roomSnapshot.data() as RelayRoom;
          if (room.status !== '遊戲準備中' && !(allowEndedRoom && room.status === '遊戲結束')) {
            throw new Error('目前無法移除玩家');
          }
          if (!room.players.some((player) => player.uid === playerUid)) return false;

          let summaries = room.groups;
          for (const groupSnapshot of groupSnapshots) {
            if (!groupSnapshot.exists()) continue;
            const group = groupSnapshot.data() as RelayGroup;
            if (!group.players.some((player) => player.uid === playerUid)) continue;
            const players = group.players.filter((player) => player.uid !== playerUid);
            transaction.update(groupSnapshot.ref, {
              players,
              turnOrder: group.turnOrder.filter((uid) => uid !== playerUid),
              updatedAt: Date.now(),
            });
            summaries = this.updateGroupSummary(summaries, group.id, {
              playerCount: players.length,
            });
          }
          transaction.update(roomRef, {
            players: room.players.filter((player) => player.uid !== playerUid),
            groups: summaries,
          });
          return true;
        });
      },

      async unassignPlayer(playerUid: string, sourceId: string) {
        const roomRef = doc(this.firestore, `rooms/${this.seq}`);
        const sourceRef = doc(this.firestore, `rooms/${this.seq}/relayGroups/${sourceId}`);
        try {
          await runTransaction(this.firestore, async (transaction) => {
            const [roomSnapshot, sourceSnapshot] = await Promise.all([
              transaction.get(roomRef),
              transaction.get(sourceRef),
            ]);
            if (!roomSnapshot.exists() || !sourceSnapshot.exists()) return;
            const room = roomSnapshot.data() as RelayRoom;
            const source = sourceSnapshot.data() as RelayGroup;
            if (room.status !== '遊戲準備中') return;
            const players = source.players.filter((player) => player.uid !== playerUid);
            transaction.update(sourceRef, {
              players,
              turnOrder: source.turnOrder.filter((uid) => uid !== playerUid),
              updatedAt: Date.now(),
            });
            transaction.update(roomRef, {
              groups: this.updateGroupSummary(room.groups, sourceId, {
                playerCount: players.length,
              }),
            });
          });
        } catch (error) {
          await this.toast(error instanceof Error ? error.message : '移至未分組失敗');
        }
      },

      async refreshRoomCompletion(groupId: string) {
        const room = this.room();
        if (!room) return;
        const summaries = this.updateGroupSummary(room.groups, groupId, { status: 'completed' });
        await updateDoc(doc(this.firestore, `rooms/${this.seq}`), {
          groups: summaries,
          status: summaries.every((group) => group.status === 'completed')
            ? '等待揭露'
            : room.status,
        });
      },

      syncPageListeners(groups: RelayGroup[]) {
        const groupIds = new Set(groups.map((group) => group.id));
        for (const [groupId, unsubscribe] of pageListeners) {
          if (!groupIds.has(groupId)) {
            unsubscribe();
            pageListeners.delete(groupId);
          }
        }
        for (const group of groups) {
          if (pageListeners.has(group.id)) continue;
          const unsubscribe = onSnapshot(
            collection(this.firestore, `rooms/${this.seq}/relayGroups/${group.id}/pages`),
            (snapshot) => {
              const pages = snapshot.docs
                .map((pageSnapshot) => pageSnapshot.data() as RelayPage)
                .sort((left, right) => left.pageIndex - right.pageIndex);
              patchState(store, {
                pagesByGroup: { ...store.pagesByGroup(), [group.id]: pages },
              });
            },
          );
          pageListeners.set(group.id, unsubscribe);
        }
      },

      summary(group: RelayGroup): RelayGroupSummary {
        return {
          id: group.id,
          name: group.name,
          playerCount: group.players.length,
          status: group.status,
        };
      },

      updateGroupSummary(
        groups: RelayGroupSummary[],
        groupId: string,
        changes: Partial<RelayGroupSummary>,
      ): RelayGroupSummary[] {
        return groups.map((group) => (group.id === groupId ? { ...group, ...changes } : group));
      },

      shuffledTopics(): string[] {
        const topics = [...RELAY_TOPICS];
        for (let index = topics.length - 1; index > 0; index--) {
          const target = Math.floor(Math.random() * (index + 1));
          [topics[index], topics[target]] = [topics[target], topics[index]];
        }
        return topics;
      },

      async toast(message: string) {
        const toast = await this.toastController.create({
          message,
          duration: 2200,
          position: 'bottom',
        });
        await toast.present();
      },
    } satisfies Record<string, (...args: any[]) => any> &
      ThisType<typeof store & RelayGameMethodContext>;
    return methods;
  }),
  withHooks({
    onDestroy(store) {
      store.destroy();
    },
  }),
);
