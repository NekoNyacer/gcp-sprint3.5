import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
  WritableStateSource,
} from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserProfileService } from '../services/user-profile.service';
import { UserProfile } from '../models/user-profile';

/**
 * 使用者資訊的共享入口。
 *
 * 這裡只管理登入身分、個人檔案、Demo scope 與 App session 狀態；
 * 位置、步數、庫存、任務、樹木與錢包各自維持獨立的 Store。
 */

export type SessionProfile = Pick<
  UserProfile,
  'displayName' | 'photoUrl' | 'dailyGoal' | 'onboardingStatus'
>;

type ProfileStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

const initialState: SessionState = {
  authStatus: '初始化中',
  user: null,
  profile: null,
  profileStatus: 'idle',
  profileError: null,
  dataScope: {
    mode: 'normal',
    uid: '',
  },
  onboardingStatus: 'unknown',
  runtimeStatus: '離線',
  fallbackReason: null,
  error: null,
};

export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    authService: inject(AuthService),
    userProfileService: inject(UserProfileService),
    subscriptions: {
      auth: undefined as Subscription | undefined,
      profile: undefined as Subscription | undefined,
    },
  })),
  withComputed((store) => ({
    isOnline: computed(() => store.runtimeStatus() === '線上'),
    isAuthenticated: computed(() => store.user() !== null),
    isDemoMode: computed(() => store.dataScope().mode === 'demo'),
    canAccessApp: computed(() => store.user() !== null || store.dataScope().mode === 'demo'),
    profileLoading: computed(() => store.profileStatus() === 'loading'),
    displayName: computed(
      () => store.profile()?.displayName.trim() || store.user()?.displayName?.trim() || null,
    ),
    photoUrl: computed(() => store.profile()?.photoUrl || store.user()?.photoUrl || null),
    email: computed(() => store.user()?.email?.trim() || null),
    dailyGoal: computed(() => store.profile()?.dailyGoal ?? 5000),
  })),
  withMethods((store) => ({
    initialize: () => {},
    logInWithGoogle: () => logInWithGoogle(store),
    logInAnonymously: () => logInAnonymously(store),
    logOut: () => logOut(store),
    enterDemo: (demoType: DemoType) => enterDemo(store, demoType),
    exitDemo: () => exitDemo(store),
  })),
  withHooks({
    onInit(store) {
      observeAuthentication(store);
      observeProfile(store);
    },
    onDestroy(store) {
      store.subscriptions.auth?.unsubscribe();
      store.subscriptions.profile?.unsubscribe();
    },
  }),
);

type SessionState = {
  authStatus: '初始化中' | '已登出' | '已登入' | '認證失敗';
  user: AuthUserSummary | null;
  profile: SessionProfile | null;
  profileStatus: ProfileStatus;
  profileError: string | null;
  dataScope: { mode: 'normal'; uid: string } | { mode: 'demo'; uid?: string; demoType: DemoType };
  onboardingStatus: 'unknown' | 'required' | 'completed';
  runtimeStatus: '線上' | '離線' | 'degraded';
  fallbackReason: FallbackReason | null;
  error: AppError | null;
};

type AuthUserSummary = {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
  email: string | null;
};

type FallbackReason =
  'presenter-selected' | '目前firebase服務不可使用' | 'route-timeout' | '認證失敗';

type AppError = 'Google 登入失敗' | '匿名登入失敗' | '無法取得登入狀態' | '登出失敗';

type DemoType = 'Demo五分鐘版' | 'Demo兩分鐘版';

type SessionStateSource = WritableStateSource<SessionState>;

type SessionStoreSource = SessionStateSource & {
  authService: AuthService;
  userProfileService: UserProfileService;
  dataScope: () => SessionState['dataScope'];
  user: () => SessionState['user'];
  subscriptions: {
    auth?: Subscription;
    profile?: Subscription;
  };
};

function logInWithGoogle(store: SessionStoreSource): void {
  if (store.dataScope().mode === 'demo') exitDemo(store);
  patchState(store, {
    authStatus: '初始化中',
    error: null,
  });

  store.authService.logInWithGoogle().subscribe({
    error: (error: unknown) => {
      console.error('Google 登入失敗:', error);

      patchState(store, {
        authStatus: '認證失敗',
        error: 'Google 登入失敗',
      });
    },
  });
}

function logInAnonymously(store: SessionStoreSource): void {
  if (store.dataScope().mode === 'demo') exitDemo(store);
  patchState(store, {
    authStatus: '初始化中',
    error: null,
  });

  store.authService.logInAnonymously().subscribe({
    error: (error: unknown) => {
      console.error('匿名登入失敗:', error);

      patchState(store, {
        authStatus: '認證失敗',
        error: '匿名登入失敗',
      });
    },
  });
}

function enterDemo(store: SessionStateSource, demoType: DemoType): void {
  patchState(store, {
    authStatus: '已登入',
    user: {
      uid: '00001',
      displayName: '國泰阿發',
      photoUrl: '/images/portraits/cathay_AFA.png',
      email: 'afa@cathay.com.tw',
    },
    profile: {
      displayName: '國泰阿發',
      photoUrl: '/images/portraits/cathay_AFA.png',
      dailyGoal: 5000,
      onboardingStatus: 'completed',
    },
    profileStatus: 'ready',
    profileError: null,
    onboardingStatus: 'completed',
    dataScope: {
      mode: 'demo',
      demoType,
    },
    error: null,
  });
}

function exitDemo(store: SessionStateSource): void {
  patchState(store, {
    authStatus: '已登出',
    user: null,
    profile: null,
    profileStatus: 'idle',
    profileError: null,
    onboardingStatus: 'unknown',
    dataScope: {
      mode: 'normal',
      uid: '',
    },
    error: null,
  });
}

function logOut(store: SessionStoreSource): void {
  if (store.dataScope().mode === 'demo') {
    exitDemo(store);
  }
  store.authService.logOut().subscribe({
    error: (error: unknown) => {
      console.error('登出失敗:', error);

      patchState(store, {
        error: '登出失敗',
      });
    },
  });
}

function observeAuthentication(store: SessionStoreSource): void {
  store.subscriptions.auth?.unsubscribe();
  store.subscriptions.auth = store.authService.user$.subscribe({
    next: (firebaseUser) => {
      if (store.dataScope().mode === 'demo') return;

      if (firebaseUser === null) {
        if (store.dataScope().mode === 'demo') {
          return;
        }

        patchState(store, {
          authStatus: '已登出',
          user: null,
          profile: null,
          profileStatus: 'idle',
          profileError: null,
          onboardingStatus: 'unknown',
          dataScope: {
            mode: 'normal',
            uid: '',
          },
        });

        return;
      }

      patchState(store, {
        authStatus: '已登入',
        profile: null,
        onboardingStatus: 'unknown',
        user: {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoUrl: firebaseUser.photoURL,
        },
        profileStatus: 'loading',
        profileError: null,
        dataScope: {
          mode: 'normal',
          uid: firebaseUser.uid,
        },
        error: null,
      });
    },
    error: (error: unknown) => {
      console.error('監聽登入狀態失敗:', error);

      patchState(store, {
        authStatus: '認證失敗',
        user: null,
        profile: null,
        profileStatus: 'error',
        profileError: '無法取得登入狀態',
        error: '無法取得登入狀態',
      });
    },
  });
}

function observeProfile(store: SessionStoreSource): void {
  store.subscriptions.profile?.unsubscribe();
  store.subscriptions.profile = store.userProfileService.currentProfile$.subscribe({
    next: (profile) => {
      if (store.dataScope().mode === 'demo') {
        return;
      }

      if (store.user() === null) {
        patchState(store, {
          profile: null,
          profileStatus: 'idle',
          profileError: null,
        });
        return;
      }

      if (!profile) {
        patchState(store, {
          profile: null,
          profileStatus: 'missing',
          profileError: null,
          onboardingStatus: 'unknown',
        });
        return;
      }

      patchState(store, {
        profile: {
          displayName: profile.displayName,
          photoUrl: profile.photoUrl,
          dailyGoal: profile.dailyGoal,
          onboardingStatus: profile.onboardingStatus,
        },
        profileStatus: 'ready',
        profileError: null,
        onboardingStatus: profile.onboardingStatus,
      });
    },
    error: (error: unknown) => {
      console.error('同步個人資料失敗:', error);

      patchState(store, {
        profileStatus: 'error',
        profileError: '無法同步個人資料',
      });
    },
  });
}
