import { Auth, signInAnonymously, User, UserCredential } from '@angular/fire/auth';

type AnonymousSignIn = (auth: Auth) => Promise<UserCredential>;

/**
 * Bonus-game Firestore rules require an authenticated Firebase principal.
 * Reuse a restored Google/anonymous session, or create an anonymous one first.
 */
export async function ensureBonusGameUser(
  auth: Auth,
  signIn: AnonymousSignIn = signInAnonymously,
): Promise<User> {
  await auth.authStateReady();
  return auth.currentUser ?? (await signIn(auth)).user;
}
