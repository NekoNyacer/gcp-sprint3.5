import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { UserProfile } from '../../shared/models/user-profile';
import { computed, inject } from '@angular/core';
import { SessionStore } from '../../shared/stores/session-store';
import { Firestore } from '@angular/fire/firestore';

type GameState = {
  status:
    '等待玩家加入中' | '產生題目中' | '確認題目中' | '遊戲開始倒數' | '玩家發言中' | '遊戲結束';
  topic: string;
  roomKey: string;
  players: (Pick<UserProfile, 'displayName' | 'photoUrl'> & {
    role: '尚未分配身分' | '猜題人' | '唬爛人' | '老實人';
  })[];
};

const initialState: GameState = {
  status: '等待玩家加入中',
  topic: '',
  roomKey: '',
  players: [
    {
      displayName: 'Eddie Liu',
      photoUrl:
        'https://lh3.googleusercontent.com/a/ACg8ocIc2RrMsnCzyltfV8cmYDwp2goYYJiBmClWZDZK06nfRNNy01BH=s96-c',
      role: '尚未分配身分',
    },
    {
      displayName: '楊捷',
      photoUrl:
        'https://lh3.googleusercontent.com/a/ACg8ocL_aNH4zINZSYNo8gYpvL0fqbFM4LBOFA4JFX1q2MsIWxpck33b=s96-c',
      role: '尚未分配身分',
    },
  ],
};

export const GameStore = signalStore(
  withState(initialState),
  withProps(() => ({
    //注入AI Logic服務
    sessionStore: inject(SessionStore),
    fireStore: inject(Firestore),
  })),
  withComputed((store) => ({
    isGeneratingTopic: computed(() => store.topic() === ''),
    isAnyRoomExist: computed(() => store.roomKey() !== ''),
  })),
  withMethods((store) => ({
    createRoom: () => {
      const roomKey = new Date().toString();
      patchState(store, { roomKey });
    },
    addPlayer: () => {
      const ifAlreadyInRoom = store
        .players()
        .some((x) => x.displayName === store.sessionStore.user()?.displayName);
      if (ifAlreadyInRoom) return;
      patchState(store, {
        players: [
          ...store.players(),
          {
            displayName: store.sessionStore.user()?.displayName ?? '取得名稱失敗',
            photoUrl: store.sessionStore.user()?.photoUrl ?? '取得照片失敗', //應該要放一個無名氏投像
            role: '尚未分配身分',
          },
        ],
      });
    },
    generateTopic: () => {
      patchState(store, { status: '產生題目中' });
    },
  })),
  withHooks({
    onInit(store) {
      store.addPlayer();
    },
  }),
);

const staticTopic = ['拿撒路現象', '....'];

const gibberish =
  '滾滾長江東逝水，浪花淘盡英雄。是非成敗轉頭空，青山依舊在，幾度夕陽紅。白髮漁樵江渚上，慣看秋月春風。一壺濁酒喜相逢，古今多少事，都付笑談';
