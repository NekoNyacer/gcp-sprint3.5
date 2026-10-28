import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { Firestore } from '@angular/fire/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { SessionStore } from '../stores/session-store';
import { haversineDistanceMeters } from '../models/geo-distance';
import { firebaseConfig } from '../../app/firebase-config';
import { cmsPublication, cmsRouteRoles } from '../models/cms-publication';
import {
  validateConfig,
  type CmsConfig,
  type Scope,
  type Selection,
  type PublishedConfig,
} from '../../../../functions/src/cms-domain';
export type {
  CmsConfig,
  Merchant,
  Scope,
  Selection,
  PublishedConfig,
} from '../../../../functions/src/cms-domain';

export interface AiRecommendation {
  source: 'gemini' | 'rules';
  reason: string;
  model?: string;
  selections: Selection[];
  version: number;
}
@Service()
export class CmsClientService {
  private readonly db = inject(Firestore);
  private readonly session = inject(SessionStore);
  readonly release = signal<PublishedConfig | null>(null);
  readonly managed = signal(false);
  readonly error = signal('');
  readonly config = computed(() => this.release()?.config ?? null);
  readonly scope = computed<Scope>(() => (this.session.isDemoMode() ? 'demo' : 'normal'));
  readonly identityKey = computed(
    () => `${this.scope()}:${this.session.dataScope().uid ?? 'presenter'}`,
  );
  readonly walletRevision = signal(0);
  readonly ai = signal<AiRecommendation | null>(null);
  readonly cubePlan = signal('');
  readonly cubePlans = computed(() => [...new Set((this.config()?.cubeChannels ?? []).filter(c => c.enabled).map(c => c.plan))]);
  setCubePlan(plan: string): void {
    if (plan && !this.cubePlans().includes(plan)) return;
    this.cubePlan.set(plan); this.ai.set(null); cmsRouteRoles.set(null);
    try { localStorage.setItem(`cat-walk-cube:${this.identityKey()}`, plan); } catch { /* session preference remains usable */ }
    this.recommendationSequence++; this.aiLoading.set(false);
  }
  arrived(entityId: string, position: {latitude: number; longitude: number} | null, eventId: string, plan = this.cubePlan()): void {
    if (!position || !this.managed()) return;
    const merchant = this.config()?.merchants.find(m => m.id === entityId);
    if (!merchant || haversineDistanceMeters(position, merchant) > 50) return;
    void this.call('cmsTrack', {name: 'merchant_arrived', entityId, position, eventId, plan})
      .catch(() => this.error.set('商家抵達紀錄尚未成功上傳。'));
  }
  readonly aiLoading = signal(false);
  readonly harvestConfirmations = signal<
    { key: string; treeId: string; amount: number; confirm: () => void }[]
  >([]);
  private recommendationSequence = 0;
  private demoLogin: Promise<unknown> | null = null;
  private initializedWallet = new Map<string, Promise<unknown>>();
  constructor() {
    effect((onCleanup) => {
      const scope = this.scope();
      this.identityKey();
      untracked(() => {
        this.release.set(null);
        this.managed.set(false);
        this.error.set('');
        this.ai.set(null);
        try { this.cubePlan.set(localStorage.getItem(`cat-walk-cube:${this.identityKey()}`) ?? ''); } catch { this.cubePlan.set(''); }
        this.harvestConfirmations.set([]);
        this.recommendationSequence++;
        this.aiLoading.set(false);
        cmsPublication.set({ config: null, version: 0, managed: false });
        cmsRouteRoles.set(null);
      });
      const stop = onSnapshot(
        doc(this.db, 'cmsPublished', 'demo'),
        (snapshot) => {
          try {
            const data = snapshot.data();
            const config = data?.['config'] ? validateConfig(data['config']) : null;
            if ((data?.['version'] ?? 0) !== this.release()?.version) cmsRouteRoles.set(null);
            this.managed.set(snapshot.exists());
            this.release.set(
              config
                ? { config, version: data!['version'], publishedAt: data!['publishedAt'] }
                : null,
            );
            cmsPublication.set({
              config,
              version: data?.['version'] ?? 0,
              managed: snapshot.exists(),
            });
            this.error.set('');
          } catch {
            this.error.set('站點設定格式不正確，請稍後重試。');
          }
        },
        () => this.error.set('暫時無法同步最新站點與優惠。'),
      );
      onCleanup(stop);
    });
  }
  private demoApp() {
    return (
      getApps().find((a) => a.name === 'cat-walk-demo-data') ??
      initializeApp(firebaseConfig, 'cat-walk-demo-data')
    );
  }
  async call<T>(name: string, input: object = {}): Promise<T> {
    const scope = this.scope();
    const identity = this.identityKey();
    const app = scope === 'demo' ? this.demoApp() : getApp();
    const auth = getAuth(app);
    await auth.authStateReady();
    if (scope === 'demo' && !auth.currentUser) {
      this.demoLogin ??= signInAnonymously(auth).finally(() => {
        this.demoLogin = null;
      });
      await this.demoLogin;
    }
    if (!auth.currentUser) throw new Error('請先登入再使用雲端功能。');
    if (identity !== this.identityKey()) throw new Error('帳號已切換，請重新操作。');
    const result = await httpsCallable<object, T>(getFunctions(app, 'asia-east1'), name, {
      timeout: name === 'cmsRecommend' ? 30000 : 20000,
    })({ ...input, scope });
    if (identity !== this.identityKey()) throw new Error('帳號已切換，請重新載入。');
    return result.data;
  }
  async wallet<T>(): Promise<T> {
    const identity = this.identityKey();
    // Share only simultaneous requests; never retain a stale balance.
    let request = this.initializedWallet.get(identity);
    if (!request) {
      request = this.call<T>('cmsWallet').finally(() => this.initializedWallet.delete(identity));
      this.initializedWallet.set(identity, request);
    }
    return request as Promise<T>;
  }
  track(name: string, entityId = 'app', eventId = crypto.randomUUID()): void {
    if (!this.managed() || !this.session.canAccessApp()) return;
    void this.call('cmsTrack', { name, entityId, eventId, plan: this.cubePlan() }).catch(() =>
      this.error.set('部分營運事件尚未成功上傳。'),
    );
  }
  clearRecommendations(): void {
    this.recommendationSequence++;
    this.aiLoading.set(false);
    this.ai.set(null);
    cmsRouteRoles.set(null);
  }
  async recommend(origin: {
    latitude: number;
    longitude: number;
  }, destination: {latitude: number; longitude: number}, route: readonly {latitude: number; longitude: number}[],
    distanceMeters: number, durationSeconds: number): Promise<AiRecommendation | null> {
    const sequence = ++this.recommendationSequence;
    this.aiLoading.set(true);
    try {
      const stride = Math.max(1, Math.ceil((route.length - 1) / 199));
      const sampledRoute = route.filter((_, i) => i % stride === 0 || i === route.length - 1);
      const result = await this.call<AiRecommendation>('cmsRecommend', {
        origin, destination, route: sampledRoute, distanceMeters, durationSeconds, plan: this.cubePlan(),
      });
      if (sequence !== this.recommendationSequence) return null;
      this.ai.set(result);
      return result;
    } catch {
      if (sequence !== this.recommendationSequence) return null;
      const fallback: AiRecommendation = {
        source: 'rules',
        reason: '雲端推薦暫時無法使用，請從地圖自行選擇站點。',
        selections: [],
        version: this.release()?.version ?? 0,
      };
      this.ai.set(fallback);
      return fallback;
    } finally {
      if (sequence === this.recommendationSequence) this.aiLoading.set(false);
    }
  }
  merchantAvailable(id: string): boolean {
    if (!this.managed()) return true;
    const m = this.config()?.merchants.find((m) => m.id === id && m.enabled);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return !!m && m.validUntil >= today;
  }
}
