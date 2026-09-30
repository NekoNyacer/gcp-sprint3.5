import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
  withHooks,
  withProps,
  WritableStateSource,
} from '@ngrx/signals';
import { ProgressService } from '../services/progress.service';
import { AuthService } from '../services/auth.service';

/**此Store管理:
 * 知道目前使用者是誰、
 * 資料應該來自哪個:正式版/Demo五分鐘版/Demo兩分鐘版
 * App 是否已經準備好使用 */

const initialState: SessionState = {
  authStatus: '初始化中',
  user: null,
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
    progressService: inject(ProgressService),
    authService: inject(AuthService),
  })),
  withComputed((store) => ({
    isOnline: computed(() => store.runtimeStatus() === '線上'),
    isAuthenticated: computed(() => store.user() !== null),
    isDemoMode: computed(() => store.dataScope().mode === 'demo'),
    canAccessApp: computed(() => store.user() !== null || store.dataScope().mode === 'demo'),
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
    },
  }),
);

type SessionState = {
  authStatus: '初始化中' | '已登出' | '已登入' | '認證失敗';
  user: AuthUserSummary | null;
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

type AuthenticationStore = SessionStateSource & {
  authService: AuthService;
  dataScope: () => SessionState['dataScope'];
};

function logInWithGoogle(store: AuthenticationStore): void {
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

function logInAnonymously(store: AuthenticationStore): void {
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

function enterDemo(store: SessionStateSource, demoType: DemoType) {
  patchState(store, {
    user: {
      uid: '00001',
      displayName: '國泰阿發',
      photoUrl: '/images/portraits/cathay_AFA.png',
      email: 'afa@cathay.com.tw',
    },
    dataScope: {
      mode: 'demo',
      demoType,
    },
  });
}

function exitDemo(store: SessionStateSource) {
  patchState(store, {
    authStatus: '已登出',
    user: null,
    dataScope: {
      mode: 'normal',
      uid: '',
    },
    error: null,
  });
}

function logOut(store: AuthenticationStore): void {
  store.authService.logOut().subscribe({
    error: (error: unknown) => {
      console.error('登出失敗:', error);

      patchState(store, {
        error: '登出失敗',
      });
    },
  });
}

function observeAuthentication(store: AuthenticationStore): void {
  store.authService.user$.subscribe({
    next: (firebaseUser) => {
      console.log('Firebase 恢復的使用者：', firebaseUser);
      if (firebaseUser === null) {
        if (store.dataScope().mode === 'demo') {
          return;
        }

        patchState(store, {
          authStatus: '已登出',
          user: null,
          dataScope: {
            mode: 'normal',
            uid: '',
          },
        });

        return;
      }

      patchState(store, {
        authStatus: '已登入',
        user: {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoUrl: firebaseUser.photoURL,
        },
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
        error: '無法取得登入狀態',
      });
    },
  });
}
