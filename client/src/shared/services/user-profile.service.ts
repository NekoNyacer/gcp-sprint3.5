import { inject, Service } from '@angular/core';
import { Auth, authState, User } from '@angular/fire/auth';
import {
  doc,
  docData,
  DocumentReference,
  Firestore,
  getDoc,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { defer, Observable, of, shareReplay, switchMap } from 'rxjs';
import { SaveUserProfile, UserProfile } from '../models/user-profile';
import { FS_COLLECTIONS } from '../models/COLLECTIONS';

@Service()
export class UserProfileService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  readonly currentProfile$: Observable<UserProfile | undefined> = authState(this.auth).pipe(
    switchMap((user) => {
      if (user === null) {
        return of(undefined);
      }

      return docData(this.getUserReference(user.uid));
    }),
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );

  async ensureProfile(user: User): Promise<void> {
    const userReference = this.getUserReference(user.uid);
    const userSnapshot = await getDoc(userReference);

    if (userSnapshot.exists()) {
      return;
    }

    await setDoc(userReference, {
      displayName: user.displayName ?? '',
      photoUrl: user.photoURL ?? '',
      dailyGoal: 5000,
      onboardingStatus: 'required',
      isDemo: false,
      treePoints: 0,
      totalMatureTrees: 0,
      updatedAt: serverTimestamp(),
    });
  }

  saveCurrentProfile(profile: SaveUserProfile): Observable<void> {
    return defer(() => {
      const user = this.auth.currentUser;

      if (user === null) {
        throw new Error('必須先登入才能寫入 Firestore');
      }

      return setDoc(
        this.getUserReference(user.uid),
        {
          displayName: profile.displayName,
          photoUrl: profile.photoUrl,
          dailyGoal: profile.dailyGoal,
          onboardingStatus: profile.onboardingStatus,
          isDemo: false,
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );
    });
  }

  private getUserReference(uid: string): DocumentReference<UserProfile> {
    return doc(this.firestore, FS_COLLECTIONS.users, uid) as DocumentReference<UserProfile>;
  }
}
