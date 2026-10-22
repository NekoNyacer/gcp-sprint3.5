import { REWARD_ICONS, REWARD_BACKGROUNDS, DEFAULT_REWARD_ICON, DEFAULT_REWARD_BACKGROUND } from "./reward-avatar.js";
/** Versioned public demo configuration. Player state never lives in this document. */
export type Scope = "demo" | "normal";
export type Role = "planting" | "supply";
export interface Merchant {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: "美食" | "購物";
  twqr: boolean;
  enabled: boolean;
  roles: Role[];
  offer: string;
  terms: string;
  validUntil: string;
  resource: "water" | "fertilizer";
  amount: number;
  weather: "sunny" | "rainy" | "cloudy";
  timeOfDay: "dawn" | "day" | "dusk" | "night";
}
export interface TreePreset {
  id: string;
  name: string;
  species: string;
  place: string;
  latitude: number;
  longitude: number;
  empty: boolean;
  growth: number;
  weather: Merchant["weather"];
  timeOfDay: Merchant["timeOfDay"];
}
export interface Reward {
  icon?: string;
  backgroundColor?: string;
  id: string;
  name: string;
  kind: "PRODUCT" | "CHARITY";
  enabled: boolean;
  requiredPoints: number;
  costNtd: number;
}
/** One dated task occurrence; cadence does not schedule recurring issuance. */
export interface CmsTask {
  id: string;
  name: string;
  description: string;
  areaId: "banqiao" | "xihu";
  cadence: "daily" | "weekly" | "event";
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  destinationName: string;
  address: string;
  latitude: number;
  longitude: number;
  rewardAmount: number;
}
export interface CmsConfig {
  tasks?: CmsTask[];
  merchants: Merchant[];
  trees: TreePreset[];
  species: string[];
  scenes: {
    id: string;
    name: string;
    weather: Merchant["weather"];
    timeOfDay: Merchant["timeOfDay"];
  }[];
  rewards: Reward[];
  harvestPoints: number;
}
export interface PublishedConfig {
  version: number;
  config: CmsConfig;
  publishedAt: string;
}
export const idPattern = /^[a-zA-Z0-9_-]{1,80}$/;
export function scopeOf(value: unknown): Scope {
  if (value !== "demo" && value !== "normal")
    throw new Error("資料範圍必須為 demo 或 normal");
  return value;
}
function text(value: unknown, max: number, required = true): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (!required || value.trim().length > 0)
  );
}
export const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 1_000_000;
const money = (v: unknown): v is number =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= 0 &&
  v <= 100_000_000 &&
  Math.abs(v * 100 - Math.round(v * 100)) < 0.00001;
const environment = (v: { weather?: unknown; timeOfDay?: unknown }) =>
  ["sunny", "rainy", "cloudy"].includes(String(v.weather)) &&
  ["dawn", "day", "dusk", "night"].includes(String(v.timeOfDay));
const coordinate = (v: { latitude?: unknown; longitude?: unknown }) =>
  typeof v.latitude === "number" &&
  Number.isFinite(v.latitude) &&
  Math.abs(v.latitude) <= 90 &&
  typeof v.longitude === "number" &&
  Number.isFinite(v.longitude) &&
  Math.abs(v.longitude) <= 180;
function list(value: unknown, max: number): value is any[] {
  return Array.isArray(value) && value.length <= max;
}
function uniqueIds(items: { id: string }[]) {
  return (
    items.every((x) => idPattern.test(x.id)) &&
    new Set(items.map((x) => x.id)).size === items.length
  );
}
export function validateConfig(value: unknown): CmsConfig {
  const v = value as CmsConfig;
  const tasks = v?.tasks === undefined ? [] : v.tasks;
  if (
    !v ||
    JSON.stringify(v).length > 350_000 ||
    !count(v.harvestPoints) ||
    !list(v.merchants, 100) ||
    !list(v.trees, 100) ||
    !list(v.rewards, 40) ||
    !list(v.species, 30) ||
    !list(v.scenes, 30) ||
    !v.species.every((x) => text(x, 60)) ||
    new Set(v.species).size !== v.species.length ||
    !list(tasks, 100) ||
    ![v.merchants, v.trees, v.rewards, v.scenes, tasks].every(uniqueIds)
  )
    throw new Error("設定格式、數量或識別碼不正確");
  for (const task of tasks) {
    if (!text(task.name, 100) || !text(task.description, 1000, false) ||
        !["banqiao", "xihu"].includes(task.areaId) ||
        !["daily", "weekly", "event"].includes(task.cadence) ||
        typeof task.enabled !== "boolean" || !coordinate(task) ||
        !text(task.destinationName, 100) || !text(task.address, 200, false) ||
        !count(task.rewardAmount) || task.rewardAmount === 0 ||
        !text(task.startsAt, 40) || !text(task.endsAt, 40) ||
        !/Z$|[+-]\d{2}:\d{2}$/.test(task.startsAt) ||
        !/Z$|[+-]\d{2}:\d{2}$/.test(task.endsAt) ||
        !Number.isFinite(Date.parse(task.startsAt)) ||
        !Number.isFinite(Date.parse(task.endsAt)) ||
        Date.parse(task.startsAt) >= Date.parse(task.endsAt))
      throw new Error("任務名稱、區域、目的地、獎勵或起訖時間不正確");
  }
  for (const m of v.merchants) {
    if (
      !text(m.name, 100) ||
      !text(m.address, 200, false) ||
      !coordinate(m) ||
      !environment(m) ||
      !["美食", "購物"].includes(m.category) ||
      typeof m.twqr !== "boolean" ||
      typeof m.enabled !== "boolean" ||
      !list(m.roles, 2) ||
      m.roles.length === 0 ||
      new Set(m.roles).size !== m.roles.length ||
      m.roles.some((x) => !["planting", "supply"].includes(x)) ||
      !text(m.offer, 300, false) ||
      !text(m.terms, 1000, false) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(m.validUntil) ||
      Number.isNaN(Date.parse(m.validUntil)) ||
      !["water", "fertilizer"].includes(m.resource) ||
      !count(m.amount) ||
      m.amount === 0
    )
      throw new Error("店家座標、角色、優惠或補給設定不正確");
  }
  for (const t of v.trees)
    if (
      !text(t.name, 100) ||
      !text(t.place, 100) ||
      !text(t.species, 60) ||
      !v.species.includes(t.species) ||
      !coordinate(t) ||
      !environment(t) ||
      typeof t.empty !== "boolean" ||
      !count(t.growth)
    )
      throw new Error("種樹點設定不正確");
  for (const s of v.scenes)
    if (!text(s.name, 100) || !environment(s))
      throw new Error("場景設定不正確");
  for (const r of v.rewards)
    if (
      !text(r.name, 100) ||
      !["PRODUCT", "CHARITY"].includes(r.kind) ||
      typeof r.enabled !== "boolean" ||
      !count(r.requiredPoints) ||
      r.requiredPoints === 0 ||
      !money(r.costNtd) ||
      (r.icon !== undefined && !REWARD_ICONS.includes(r.icon)) ||
      (r.backgroundColor !== undefined && !REWARD_BACKGROUNDS.includes(r.backgroundColor))
    )
      throw new Error("獎勵設定不正確");
  // Reject unexpected fields instead of publishing arbitrary caller-controlled data.
  return {
    tasks: tasks.map(task => ({
      id: task.id, name: task.name, description: task.description,
      areaId: task.areaId, cadence: task.cadence, enabled: task.enabled,
      startsAt: new Date(task.startsAt).toISOString(), endsAt: new Date(task.endsAt).toISOString(),
      destinationName: task.destinationName, address: task.address,
      latitude: task.latitude, longitude: task.longitude, rewardAmount: task.rewardAmount,
    })),
    harvestPoints: v.harvestPoints,
    species: [...v.species],
    merchants: v.merchants.map((m) => ({
      id: m.id,
      name: m.name,
      address: m.address,
      latitude: m.latitude,
      longitude: m.longitude,
      category: m.category,
      twqr: m.twqr,
      enabled: m.enabled,
      roles: [...m.roles],
      offer: m.offer,
      terms: m.terms,
      validUntil: m.validUntil,
      resource: m.resource,
      amount: m.amount,
      weather: m.weather,
      timeOfDay: m.timeOfDay,
    })),
    trees: v.trees.map((t) => ({
      id: t.id,
      name: t.name,
      species: t.species,
      place: t.place,
      latitude: t.latitude,
      longitude: t.longitude,
      empty: t.empty,
      growth: t.growth,
      weather: t.weather,
      timeOfDay: t.timeOfDay,
    })),
    rewards: v.rewards.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      enabled: r.enabled,
      requiredPoints: r.requiredPoints,
      costNtd: r.costNtd,
      icon: r.icon ?? DEFAULT_REWARD_ICON,
      backgroundColor: r.backgroundColor ?? DEFAULT_REWARD_BACKGROUND,
    })),
    scenes: v.scenes.map((s) => ({
      id: s.id,
      name: s.name,
      weather: s.weather,
      timeOfDay: s.timeOfDay,
    })),
  };
}
export interface Selection {
  merchantId: string;
  role: Role;
  reason: string;
}
export function validateSelections(
  value: unknown,
  merchants: Merchant[],
): Selection[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6)
    throw new Error("AI 選擇數量不正確");
  const seen = new Set<string>();
  return value.map((s) => {
    const m = merchants.find((m) => m.id === s?.merchantId && m.enabled);
    if (
      !m ||
      seen.has(m.id) ||
      !m.roles.includes(s.role) ||
      !text(s.reason, 300)
    )
      throw new Error("AI 選擇未授權站點或角色");
    seen.add(m.id);
    return { merchantId: m.id, role: s.role, reason: s.reason };
  });
}
export type EventName =
  | "core_action"
  | "route_started"
  | "route_completed"
  | "offer_view"
  | "navigation_started"
  | "shop_view";
export interface MetricEvent {
  actor: string;
  name: EventName;
  entityId: string;
  at: number;
}
/** Group route IDs by actor; count only completion of a departure in this window. */
export function metrics(
  events: MetricEvent[],
  redemptions: { actor: string; costNtd: number }[],
) {
  const active = new Set(events.map((e) => e.actor));
  const started = new Set(
    events
      .filter((e) => e.name === "route_started")
      .map((e) => `${e.actor}:${e.entityId}`),
  );
  const completed = new Set(
    events
      .filter(
        (e) =>
          e.name === "route_completed" &&
          started.has(`${e.actor}:${e.entityId}`),
      )
      .map((e) => `${e.actor}:${e.entityId}`),
  );
  const viewers = new Set(
    events.filter((e) => e.name === "offer_view").map((e) => e.actor),
  );
  const navigators = new Set(
    events
      .filter(
        (e) =>
          e.name === "navigation_started" &&
          events.some(
            (v) =>
              v.name === "offer_view" &&
              v.actor === e.actor &&
              v.entityId === e.entityId &&
              v.at <= e.at,
          ),
      )
      .map((e) => e.actor),
  );
  const shop = new Set(
    events.filter((e) => e.name === "shop_view").map((e) => e.actor),
  );
  const redeemers = new Set(
    redemptions.filter((r) => shop.has(r.actor)).map((r) => r.actor),
  );
  const cost =
    Math.round(redemptions.reduce((sum, r) => sum + r.costNtd, 0) * 100) / 100;
  const ratio = (a: number, b: number) => (b ? a / b : null);
  return {
    activeUsers: active.size,
    routeStarted: started.size,
    routeCompleted: completed.size,
    routeCompletionRate: ratio(completed.size, started.size),
    offerViewers: viewers.size,
    navigators: navigators.size,
    offerNavigationRate: ratio(navigators.size, viewers.size),
    shopViewers: shop.size,
    redeemers: redeemers.size,
    redemptionRate: ratio(redeemers.size, shop.size),
    rewardCostNtd: cost,
    costPerActiveUser: ratio(cost, active.size),
  };
}
