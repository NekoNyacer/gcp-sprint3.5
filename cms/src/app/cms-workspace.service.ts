import {
  Injectable,
  inject,
  signal,
  computed,
  effect,
  TemplateRef,
  DestroyRef,
} from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  CubDialog,
  CubDialogRef,
  CubConfirmDialog,
} from "cub-lib-view-rootng/component/dialog";
import { CubDrawer, CubDrawerRef } from "cub-lib-view-rootng/component/drawer";
import { CmsService, Dashboard } from "./cms.service";
import {
  validateConfig,
  type CmsConfig,
} from "../../../functions/src/cms-domain";
export type Page =
  "dashboard" | "merchants" | "trees" | "tasks" | "rewards" | "scenes" | "budget" | "ai" | "seed-import";
type Editable = "merchants" | "trees" | "tasks" | "rewards" | "scenes";
interface Field {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "datetime-local" | "checkbox" | "select" | "textarea";
  options?: string[];
}
const environment: Field[] = [
  {
    key: "weather",
    label: "展示天氣",
    type: "select",
    options: ["sunny", "rainy", "cloudy"],
  },
  {
    key: "timeOfDay",
    label: "展示時段",
    type: "select",
    options: ["dawn", "day", "dusk", "night"],
  },
];
const fields: Record<Editable, Field[]> = {
  tasks: [
    {key: "name", label: "任務名稱", type: "text"},
    {key: "description", label: "任務說明", type: "textarea"},
    {key: "areaId", label: "任務區域", type: "select", options: ["banqiao", "xihu"]},
    {key: "cadence", label: "任務種類", type: "select", options: ["daily", "weekly", "event"]},
    {key: "enabled", label: "啟用此任務", type: "checkbox"},
    {key: "startsAt", label: "開始時間（台北時間）", type: "datetime-local"},
    {key: "endsAt", label: "結束時間（台北時間）", type: "datetime-local"},
    {key: "destinationName", label: "目的地名稱", type: "text"},
    {key: "address", label: "目的地地址／位置說明", type: "text"},
    {key: "latitude", label: "緯度", type: "number"},
    {key: "longitude", label: "經度", type: "number"},
    {key: "rewardAmount", label: "獎勵數量（每日／每週：水滴；活動：肥料）", type: "number"},
  ],
  merchants: [
    { key: "name", label: "店家名稱", type: "text" },
    { key: "address", label: "地址／位置說明", type: "text" },
    { key: "latitude", label: "緯度", type: "number" },
    { key: "longitude", label: "經度", type: "number" },
    {
      key: "category",
      label: "類別",
      type: "select",
      options: ["美食", "購物"],
    },
    { key: "twqr", label: "TWQR 特約店家（模擬）", type: "checkbox" },
    { key: "enabled", label: "啟用此店家", type: "checkbox" },
    { key: "offer", label: "優惠標題", type: "text" },
    { key: "terms", label: "優惠條件", type: "textarea" },
    { key: "validUntil", label: "優惠有效日期", type: "date" },
    {
      key: "resource",
      label: "補給種類",
      type: "select",
      options: ["water", "fertilizer"],
    },
    { key: "amount", label: "補給數量", type: "number" },
    ...environment,
  ],
  trees: [
    { key: "name", label: "小樹名稱", type: "text" },
    { key: "species", label: "樹種", type: "text" },
    { key: "place", label: "地點", type: "text" },
    { key: "latitude", label: "緯度", type: "number" },
    { key: "longitude", label: "經度", type: "number" },
    { key: "empty", label: "尚未種植", type: "checkbox" },
    { key: "growth", label: "新 Demo 場景初始成長值", type: "number" },
    ...environment,
  ],
  rewards: [
    { key: "name", label: "獎勵名稱", type: "text" },
    {
      key: "kind",
      label: "獎勵種類",
      type: "select",
      options: ["PRODUCT", "CHARITY"],
    },
    { key: "enabled", label: "開放兌換", type: "checkbox" },
    { key: "requiredPoints", label: "兌換所需小樹點", type: "number" },
    { key: "costNtd", label: "每次兌換成本（NT$）", type: "number" },
  ],
  scenes: [
    { key: "name", label: "預設場景名稱", type: "text" },
    ...environment,
  ],
};
function emptyConfig(): CmsConfig {
  return {
    merchants: [],
    trees: [],
    rewards: [],
    species: [],
    scenes: [],
    tasks: [],
    harvestPoints: 50,
  };
}
@Injectable({ providedIn: "root" })
export class CmsWorkspaceService {
  private readonly router = inject(Router);
  private readonly dialogs = inject(CubDialog);
  private readonly drawers = inject(CubDrawer);
  editorDrawer!: TemplateRef<unknown>;
  releaseDialog!: TemplateRef<unknown>;
  private editorRef?: CubDrawerRef<unknown>;
  private releaseRef?: CubDialogRef<unknown>;
  closeEditor() {
    this.editorRef?.close();
    this.editor.set(null);
  }
  closeRelease() {
    this.releaseRef?.close();
    this.confirmation.set(null);
  }
  private async confirm(description: string): Promise<boolean> {
    const ref = this.dialogs.open(CubConfirmDialog, {
      data: {
        title: "確認操作",
        description,
        subButton: { label: "取消" },
        mainButton: { label: "確認" },
      },
    });
    return new Promise((resolve) =>
      ref.afterClosed().subscribe((result) => resolve(result === "confirm")),
    );
  }
  readonly api = inject(CmsService);
  readonly page = signal<Page>("dashboard");
  readonly config = signal<CmsConfig>(emptyConfig());
  readonly dirty = signal(false);
  readonly revision = signal(0);
  readonly busy = signal(false);
  readonly message = signal("");
  readonly error = signal("");
  readonly dashboard = signal<Dashboard | null>(null);
  readonly window = signal<"week" | "month">("week");
  readonly search = signal("");
  readonly editor = signal<{
    kind: Editable;
    item: Record<string, any>;
    existing: boolean;
  } | null>(null);
  readonly confirmation = signal<"publish" | "unpublish" | null>(null);
  readonly ai = signal<{
    source: string;
    reason: string;
    model?: string;
    version: number;
    selections: { merchantId: string; role: string; reason: string }[];
  } | null>(null);
  readonly nav: { id: Page; label: string; icon: string; group: string }[] = [
    { id: "dashboard", label: "營運總覽", icon: "◫", group: "營運洞察" },
    { id: "merchants", label: "商家與站點", icon: "⌖", group: "內容管理" },
    { id: "tasks", label: "任務管理", icon: "⌖", group: "" },
    { id: "trees", label: "種樹點與樹種", icon: "♧", group: "" },
    { id: "rewards", label: "商品與兌換", icon: "◇", group: "" },
    { id: "scenes", label: "展示場景", icon: "▧", group: "" },
    { id: "budget", label: "成本與預算", icon: "▤", group: "管理工具" },
    { id: "ai", label: "Gemini 推薦驗證", icon: "✧", group: "" },
    { id: "seed-import", label: "Mock 種子匯入", icon: "⇧", group: "管理工具" },
  ];
  readonly title = computed(
    () => this.nav.find((p) => p.id === this.page())!.label,
  );
  readonly rows = computed(() => {
    const p = this.page();
    const c = this.config();
    const items = ["merchants", "trees", "tasks", "rewards", "scenes"].includes(p)
      ? c[p as Editable] ?? []
      : [];
    const q = this.search().toLocaleLowerCase();
    return items.filter(
      (v) => !q || JSON.stringify(v).toLocaleLowerCase().includes(q),
    );
  });
  readonly editorFields = computed(() => {
    const e = this.editor();
    return e
      ? fields[e.kind].map((f) =>
          f.key === "species"
            ? { ...f, type: "select" as const, options: this.config().species }
            : f,
        )
      : [];
  });
  readonly changedSummary = computed(() => {
    const old = this.api.published();
    const next = this.config();
    return (
      [
        "merchants",
        "tasks",
        "trees",
        "rewards",
        "scenes",
        "species",
        "harvestPoints",
      ] as const
    ).filter((k) => JSON.stringify(old?.[k]) !== JSON.stringify(next[k]));
  });
  newSpecies = "";
  rewardBudget: number | null = null;
  cloudSpent = 0;
  billingSource = "";
  aiLatitude = 25.0134;
  aiLongitude = 121.4628;
  constructor() {
    const syncRoute = () => {
      const path = this.router.url
        .split(/[?#]/)[0]
        .split("/")
        .filter(Boolean)[0];
      const next = this.nav.find((item) => item.id === path)?.id ?? "dashboard";
      if (this.page() !== next) {
        this.page.set(next);
        this.search.set("");
      }
    };
    syncRoute();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(syncRoute);
    effect(() => {
      const draft = this.api.draft();
      if (
        !this.dirty() &&
        !this.editor() &&
        (draft?.revision ?? 0) >= this.revision()
      ) {
        this.config.set(draft ? structuredClone(draft.config) : emptyConfig());
        this.revision.set(draft?.revision ?? 0);
      }
    });
    effect(() => {
      const b = this.api.budget();
      this.rewardBudget = b?.rewardMonthlyNtd ?? null;
      this.cloudSpent = b?.cloudSpentUsd ?? 0;
      this.billingSource = b?.source ?? "";
    });
    effect(() => {
      if (this.api.authorized()) {
        this.api.scope();
        void this.refresh();
      }
    });
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (this.dirty()) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    inject(DestroyRef).onDestroy(() =>
      window.removeEventListener("beforeunload", beforeUnload),
    );
  }
  switchPage(p: Page) {
    void this.router.navigate(["/", p]);
  }
  async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set("");
    this.message.set("");
    try {
      await action();
    } catch (e) {
      this.error.set(
        e instanceof Error
          ? e.message.replace(/^Firebase:\s*/, "")
          : "操作失敗，請稍後重試。",
      );
    } finally {
      this.busy.set(false);
    }
  }
  async refresh() {
    const requestedScope = this.api.scope();
    const requestedWindow = this.window();
    try {
      const d = await this.api.call<Dashboard>("cmsDashboard", {
        window: requestedWindow,
      });
      if (
        requestedScope === this.api.scope() &&
        requestedWindow === this.window()
      )
        this.dashboard.set(d);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : "無法讀取統計");
    }
  }
  async loadLatest() {
    if (
      this.dirty() &&
      !(await this.confirm("放棄尚未儲存的修改並載入最新草稿？"))
    )
      return;
    this.dirty.set(false);
    const d = this.api.draft();
    this.config.set(d ? structuredClone(d.config) : emptyConfig());
    this.revision.set(d?.revision ?? 0);
  }
  edit(kind: Editable, item?: object) {
    const defaults: Record<Editable, Record<string, any>> = {
      tasks: {
        id: `task-${crypto.randomUUID()}`, name: "", description: "", areaId: "banqiao",
        cadence: "daily", enabled: true,
        startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(),
        destinationName: "", address: "", latitude: 25.0134, longitude: 121.4628, rewardAmount: 1,
      },
      merchants: {
        id: `merchant-${crypto.randomUUID()}`,
        name: "",
        address: "",
        latitude: 25.0134,
        longitude: 121.4628,
        category: "美食",
        twqr: true,
        enabled: true,
        roles: ["planting", "supply"],
        offer: "",
        terms: "Demo 模擬優惠，非真實商家活動",
        validUntil: "2026-11-09",
        resource: "water",
        amount: 10,
        weather: "sunny",
        timeOfDay: "day",
      },
      trees: {
        id: `tree-${crypto.randomUUID()}`,
        name: "",
        species: this.config().species[0] ?? "榕樹",
        place: "",
        latitude: 25.0134,
        longitude: 121.4628,
        empty: true,
        growth: 0,
        weather: "sunny",
        timeOfDay: "day",
      },
      rewards: {
        id: `reward-${crypto.randomUUID()}`,
        name: "",
        kind: "PRODUCT",
        enabled: true,
        requiredPoints: 30,
        costNtd: 30,
      },
      scenes: {
        id: `scene-${crypto.randomUUID()}`,
        name: "",
        weather: "sunny",
        timeOfDay: "day",
      },
    };
    this.error.set("");
    this.editor.set({
      kind,
      item: structuredClone(kind === "rewards"
        ? { icon: "gift-money", backgroundColor: "#E4F2E7", ...(item ?? defaults[kind]) }
        : item ?? defaults[kind]),
      existing: !!item,
    });
    const editorRef = this.drawers.open(this.editorDrawer, {
      ariaLabel: "編輯內容",
      disableClose: true,
      position: { right: "0" },
      width: "min(720px, 100vw)",
      maxWidth: "100vw",
    });
    this.editorRef = editorRef;
    editorRef.afterClosed().subscribe(() => {
      if (this.editorRef === editorRef) this.editor.set(null);
    });
  }
  role(role: "planting" | "supply", checked: boolean) {
    const e = this.editor();
    if (!e) return;
    const roles: string[] = e.item["roles"];
    e.item["roles"] = checked
      ? [...new Set([...roles, role])]
      : roles.filter((r) => r !== role);
  }
  applyScene(id: string) {
    const scene = this.config().scenes.find((s) => s.id === id);
    const editor = this.editor();
    if (scene && editor) {
      editor.item["weather"] = scene.weather;
      editor.item["timeOfDay"] = scene.timeOfDay;
    }
  }
  applyEdit() {
    const e = this.editor();
    if (!e) return;
    const next = structuredClone(this.config());
    next.tasks ??= [];
    const list = next[e.kind] as any[];
    const i = list.findIndex((x) => x.id === e.item["id"]);
    if (i >= 0) list[i] = e.item;
    else list.push(e.item);
    try {
      validateConfig(next);
      this.config.set(next);
      this.dirty.set(true);
      this.closeEditor();
      this.error.set("");
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }
  async remove(kind: Editable, id: string) {
    if (
      !(await this.confirm(
        "從草稿移除此項目？發布後才會影響用戶端；既有玩家進度不會刪除。",
      ))
    )
      return;
    const next = structuredClone(this.config());
    (next[kind] as any[]) = (next[kind] ?? []).filter((x) => x.id !== id);
    this.config.set(next);
    this.dirty.set(true);
  }
  setEditorPosition(position: {latitude: number; longitude: number; address?: string}) {
    const editor = this.editor();
    if (!editor) return;
    Object.assign(editor.item, position);
    if (editor.kind === 'trees' && position.address) {
      editor.item['place'] = position.address;
      delete editor.item['address'];
    }
  }
  taipeiDateTime(value: string) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16) : "";
  }
  setEditorTime(key: string, value: string) {
    const editor = this.editor();
    if (!editor) return;
    const date = new Date(value + ":00+08:00");
    editor.item[key] = Number.isFinite(date.getTime()) ? date.toISOString() : "";
  }
  label(value: string) {
    return ({daily: "每日", weekly: "每週", event: "活動", banqiao: "板橋", xihu: "西湖",
      PRODUCT: "商品", CHARITY: "公益捐贈", water: "水", fertilizer: "肥料", sunny: "晴天",
      rainy: "雨天", cloudy: "陰天", dawn: "清晨", day: "白天", dusk: "黃昏", night: "夜晚"} as Record<string, string>)[value] ?? value;
  }
  addSpecies() {
    const s = this.newSpecies.trim();
    if (!s || this.config().species.includes(s)) return;
    this.config.update((c) => ({ ...c, species: [...c.species, s] }));
    this.newSpecies = "";
    this.dirty.set(true);
  }
  removeSpecies(s: string) {
    if (this.config().trees.some((t) => t.species === s)) {
      this.error.set("此樹種仍被種樹點使用。");
      return;
    }
    this.config.update((c) => ({
      ...c,
      species: c.species.filter((x) => x !== s),
    }));
    this.dirty.set(true);
  }
  setHarvestPoints(value: number) {
    this.config.update((c) => ({ ...c, harvestPoints: value }));
    this.dirty.set(true);
  }
  async importSeed(files: File[]) {
    const file = files[0];
    if (!file) return;
    await this.run(async () => {
      if (file.size > 350000) throw new Error("種子檔案過大");
      const config = validateConfig(JSON.parse(await file.text()));
      this.config.set(config);
      this.dirty.set(true);
      this.message.set("展示種子已載入草稿，請儲存並發布。");
    });
  }
  async save() {
    await this.run(async () => {
      const config = validateConfig(this.config());
      const result = await this.api.call<{ revision: number }>("cmsCommand", {
        action: "save",
        config,
        expectedRevision: this.revision(),
      });
      this.revision.set(result.revision);
      this.dirty.set(false);
      this.message.set("草稿已儲存，尚未發布到用戶端。");
    });
  }
  async importExistingTasks() {
    await this.run(async () => {
      const requestedScope = this.api.scope();
      const result = await this.api.call<{tasks: NonNullable<CmsConfig['tasks']>}>('cmsCommand', {action: 'import-tasks'});
      if (requestedScope !== this.api.scope()) return;
      const existing = this.config().tasks ?? [];
      const ids = new Set(existing.map(task => task.id));
      const added = result.tasks.filter(task => !ids.has(task.id));
      const next = {...this.config(), tasks: [...existing, ...added]};
      validateConfig(next);
      this.config.set(next); this.dirty.set(true);
      this.message.set(`已載入 ${added.length} 筆既有任務到草稿，請檢查後儲存。`);
    });
  }
  confirmRelease(action: "publish" | "unpublish") {
    if (this.dirty()) {
      this.error.set("請先儲存草稿再發布。");
      return;
    }
    this.confirmation.set(action);
    const releaseRef = this.dialogs.open(this.releaseDialog, {
      ariaLabel: "發布確認",
    });
    this.releaseRef = releaseRef;
    releaseRef.afterClosed().subscribe(() => {
      if (this.releaseRef === releaseRef) this.confirmation.set(null);
    });
  }
  async release() {
    const action = this.confirmation();
    if (!action) return;
    this.closeRelease();
    await this.run(async () => {
      const r = await this.api.call<{ revision: number }>("cmsCommand", {
        action,
        expectedRevision: this.revision(),
      });
      this.revision.set(r.revision);
      this.message.set(
        action === "publish"
          ? "已發布，在線用戶端將接收更新。"
          : "已下架；既有路線與玩家樹木保留。",
      );
    });
  }
  async saveBudget() {
    await this.run(async () => {
      if (this.rewardBudget === null) throw new Error("請先設定每月獎勵預算");
      await this.api.call("cmsCommand", {
        action: "budget",
        expectedRevision: this.api.budget()?.revision ?? 0,
        budget: {
          rewardMonthlyNtd: this.rewardBudget,
          cloudSpentUsd: this.cloudSpent,
          source: this.billingSource,
        },
      });
      this.message.set("預算與帳單紀錄已更新。");
      await this.refresh();
    });
  }
  async recommend() {
    await this.run(async () => {
      this.ai.set(
        await this.api.call("cmsRecommend", {
          origin: { latitude: this.aiLatitude, longitude: this.aiLongitude },
        }),
      );
    });
  }
  merchantName(id: string) {
    return this.api.published()?.merchants.find((m) => m.id === id)?.name ?? id;
  }
  percent(v: number | null | undefined) {
    return v == null ? "尚無資料" : `${(v * 100).toFixed(1)}%`;
  }
  money(v: number | null | undefined, currency = "NT$") {
    return v == null
      ? "尚無資料"
      : `${currency} ${v.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}`;
  }
  alertLevel(spent: number, budget: number | null | undefined) {
    if (budget == null || budget <= 0) return "尚未設定預算";
    const percent = (spent / budget) * 100;
    return percent >= 100
      ? "已達 100% 預算"
      : percent >= 80
        ? "已達 80% 預算"
        : percent >= 50
          ? "已達 50% 預算"
          : "預算範圍內";
  }
}


