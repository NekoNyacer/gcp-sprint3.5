import '@angular/compiler';
import type { Auth, User, UserCredential } from '@angular/fire/auth';
import { describe, expect, it, vi } from 'vitest';
import { ensureBonusGameUser } from './bonus-game-auth';

describe('ensureBonusGameUser', () => {
  it('waits for Firebase Auth restoration before reusing the current user', async () => {
    const restoredUser = { uid: 'restored-user' } as User;
    const auth = {
      currentUser: null,
      authStateReady: vi.fn(async function (this: { currentUser: User | null }) {
        this.currentUser = restoredUser;
      }),
    } as unknown as Auth;
    const signIn = vi.fn();

    await expect(ensureBonusGameUser(auth, signIn)).resolves.toBe(restoredUser);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in anonymously when Auth restoration has no user', async () => {
    const anonymousUser = { uid: 'anonymous-user' } as User;
    const auth = {
      currentUser: null,
      authStateReady: vi.fn(async () => undefined),
    } as unknown as Auth;
    const signIn = vi.fn(async () => ({ user: anonymousUser }) as UserCredential);

    await expect(ensureBonusGameUser(auth, signIn)).resolves.toBe(anonymousUser);
    expect(signIn).toHaveBeenCalledOnce();
    expect(signIn).toHaveBeenCalledWith(auth);
  });
});
