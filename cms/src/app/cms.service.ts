import { Injectable, signal } from "@angular/core";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { connectAuthEmulator } from "firebase/auth";
import { firebaseConfig } from "../../../client/src/app/firebase-config";
import type { CmsConfig, Scope } from "../../../functions/src/cms-domain";

export interface Draft {
  config: CmsConfig;
  revision: number;
  updatedAt: string;
  publishedVersion?: number;
}
export interface Budget {
  rewardMonthlyNtd: number;
  cloudSpentUsd: number;
  cloudBudgetUsd: number;
  source: string;
  updatedAt: string;
  revision: number;
}
export interface Dashboard {
  merchants?: {id: string; recommended: number; gemini: number; rules: number; views: number; navigations: number; arrivals: number; visitors: number; plans: {plan: string; count: number}[]}[];
  activeUsers: number;
  routeStarted: number;
  routeCompleted: number;
  routeCompletionRate: number | null;
  offerViewers: number;
  navigators: number;
  offerNavigationRate: number | null;
  shopViewers: number;
  redeemers: number;
  redemptionRate: number | null;
  rewardCostNtd: number;
  costPerActiveUser: number | null;
  rewardMonthlyCostNtd: number;
  outstandingPointEstimateNtd: number;
  measured: boolean;
  from: string;
  to: string;
}
@Injectable({ providedIn: "root" })
export class CmsService {
  private readonly app = initializeApp(firebaseConfig, "cat-walk-cms");
  readonly auth = getAuth(this.app);
  private readonly db = getFirestore(this.app);
  private readonly functions = getFunctions(this.app, "asia-east1");
  readonly identity = signal("");
  readonly authorized = signal(false);
  readonly initializing = signal(true);
  readonly scope = signal<Scope>("demo").asReadonly();
  readonly draft = signal<Draft | null>(null);
  readonly budget = signal<Budget | null>(null);
  readonly publishedVersion = signal(0);
  readonly published = signal<CmsConfig | null>(null);
  readonly error = signal("");
  private subscriptions: Unsubscribe[] = [];
  private generation = 0;
  constructor() {
    // Explicit local opt-in; never connect hosted builds to an emulator accidentally.
    if (
      location.hostname === "localhost" &&
      new URLSearchParams(location.search).get("emulators") === "1"
    ) {
      connectAuthEmulator(this.auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(this.db, "127.0.0.1", 8080);
      connectFunctionsEmulator(this.functions, "127.0.0.1", 5001);
    }
    onAuthStateChanged(this.auth, async (user) => {
      const generation = ++this.generation;
      this.clear();
      this.authorized.set(false);
      this.identity.set(user?.email ?? "");
      try {
        if (user) {
          const token = await user.getIdTokenResult(true);
          if (generation !== this.generation) return;
          const allowed =
            user.emailVerified &&
            token.signInProvider === "google.com" &&
            token.claims["cmsAdmin"] === true;
          this.authorized.set(allowed);
          if (allowed) this.listen();
          else this.error.set("此帳號尚未獲後台授權，請聯絡專案管理員。");
        }
      } catch {
        this.error.set("無法確認管理權限，請重新登入。");
      } finally {
        if (generation === this.generation) this.initializing.set(false);
      }
    });
  }
  async login() {
    this.error.set("");
    try {
      const p = new GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(this.auth, p);
    } catch {
      this.error.set("Google 登入未完成，請重試。");
    }
  }
  async logout() {
    await signOut(this.auth);
  }
  async call<T>(name: string, data: object): Promise<T> {
    return (
      await httpsCallable<object, T>(
        this.functions,
        name,
      )({ ...data, scope: this.scope() })
    ).data;
  }
  private clear() {
    this.subscriptions.forEach((stop) => stop());
    this.subscriptions = [];
    this.draft.set(null);
    this.budget.set(null);
    this.published.set(null);
    this.publishedVersion.set(0);
  }
  private listen() {
    const s = this.scope();
    this.subscriptions = [
      onSnapshot(
        doc(this.db, "cmsDrafts", s),
        (d) => this.draft.set(d.exists() ? (d.data() as Draft) : null),
        () => this.error.set("無法讀取草稿，請確認已部署後台權限規則。"),
      ),
      onSnapshot(
        doc(this.db, "cmsPublished", s),
        (d) => {
          this.published.set(d.data()?.["config"] ?? null);
          this.publishedVersion.set(d.data()?.["version"] ?? 0);
        },
        () => this.error.set("無法讀取發布內容。"),
      ),
      onSnapshot(
        doc(this.db, "cmsBudgets", s),
        (d) => this.budget.set(d.exists() ? (d.data() as Budget) : null),
        () => this.error.set("無法讀取預算。"),
      ),
    ];
  }
}
