import { inject, Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  authState,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signOut,
  User,
  UserCredential,
} from '@angular/fire/auth';
import { defer, Observable, shareReplay } from 'rxjs';
import { UserProfileService } from './user-profile.service';

/**
 * Firebase提供的Auth服務
 * 可直接使用Google帳號取得認證
 */
@Service()
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly userProfileService = inject(UserProfileService);

  readonly user$: Observable<User | null> = authState(this.auth).pipe(
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );

  readonly user = toSignal(this.user$, {
    initialValue: undefined,
  });

  constructor() {
    this.auth.languageCode = 'zh-TW';
  }

  /**呼叫此服務，開啟google登入彈窗 */
  logInWithGoogle(): Observable<UserCredential> {
    return defer(async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      const credential = await signInWithPopup(this.auth, provider);

      await this.userProfileService.ensureProfile(credential.user);

      return credential;
    });
  }

  /**建立不綁定 Google 帳號的 Firebase 匿名身分，供多人遊戲快速加入使用。*/
  logInAnonymously(): Observable<UserCredential> {
    return defer(() => signInAnonymously(this.auth));
  }

  logOut(): Observable<void> {
    return defer(() => signOut(this.auth));
  }
}
