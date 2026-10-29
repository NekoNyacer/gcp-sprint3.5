import { inject, Service } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  doc,
  Firestore,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { AuthService } from '../../shared/services/auth.service';

@Service()
export class TestService {
  private readonly fs = inject(Firestore);
  private readonly auth = inject(AuthService);

  getMessages() {
    const uid = this.requireUid();
    return collectionData(collection(this.fs, 'users', uid, 'testMessages'), {
      idField: 'id',
    });
  }

  async addMessage(text: string) {
    const uid = this.requireUid();
    const result = await addDoc(collection(this.fs, 'users', uid, 'testMessages'), {
      text,
      createdAt: serverTimestamp(),
    });
    return result.id;
  }

  async setMessage(text: string, testMessagesUid: string) {
    const uid = this.requireUid();
    const result = await setDoc(doc(this.fs, 'users', uid, 'testMessages', testMessagesUid), {
      text,
      createdAt: serverTimestamp(),
    });
    return result;
  }

  private requireUid(): string {
    const uid = this.auth.user()?.uid;
    console.log('目前登入 UID:', uid);

    if (!uid) {
      throw new Error('使用者尚未登入');
    }

    return uid;
  }
}
