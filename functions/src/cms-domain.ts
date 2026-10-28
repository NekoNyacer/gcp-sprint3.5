import { DEFAULT_SEED_TYPES, DEFAULT_WALK_SEED_DROP, type WalkSeedDrop, type SeedType, type CubeChannel } from "./planting-catalog.js";
import { REWARD_ICONS, REWARD_BACKGROUNDS, DEFAULT_REWARD_ICON, DEFAULT_REWARD_BACKGROUND } from "./reward-avatar.js";
import { legacyTreePostalCode } from './tree-region.js';
import { DEFAULT_TASK_STEPS, DEFAULT_TASK_RADIUS } from './task-domain.js';
/** Versioned public demo configuration. Player state never lives in this document. */
export type Scope = "demo" | "normal";
export type Role = "planting" | "supply";
export interface Merchant {
  cubeChannelIds?: string[];
  postalCode?: string;
  locationSourceUrl?: string;
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
  postalCode?: string;
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
  rewardType?: 'waterDrops' | 'fertilizer' | 'seeds';
  requiredSteps?: number;
  radiusMeters?: number;
}
export interface CmsConfig {
  walkSeedDrop?: WalkSeedDrop;
  seedTypes?: SeedType[];
  cubeChannels?: CubeChannel[];
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
export const CMS_MAX_CONFIG_BYTES = 850_000;
export const CMS_MAX_TREE_PRESETS = 2_500;
export function validateConfig(value: unknown): CmsConfig {
  const v = value as CmsConfig;
  const tasks = v?.tasks === undefined ? [] : v.tasks;
  const serializedBytes = v
    ? new TextEncoder().encode(JSON.stringify(v)).byteLength
    : 0;
  if (
    !v ||
    serializedBytes > CMS_MAX_CONFIG_BYTES ||
    !count(v.harvestPoints) ||
    !list(v.merchants, 100) ||
    !list(v.trees, CMS_MAX_TREE_PRESETS) ||
    !list(v.rewards, 40) ||
    !list(v.species, 30) ||
    !list(v.scenes, 30) ||
    !v.species.every((x) => text(x, 60)) ||
    new Set(v.species).size !== v.species.length ||
    !list(tasks, 100) ||
    ![v.merchants, v.trees, v.rewards, v.scenes, tasks].every(uniqueIds)
  )
    throw new Error("設定格式、數量或識別碼不正確");
  const seeds = v.seedTypes ?? (v.species.length ? [{...DEFAULT_SEED_TYPES[0], outcomes: v.species.map(species => ({species, weight: DEFAULT_SEED_TYPES[0].outcomes.find(o => o.species === species)?.weight ?? 20}))}] : []);
  const channels = v.cubeChannels ?? [];
  if (!list(seeds, 30) || !list(channels, 100) || !uniqueIds(seeds) || !uniqueIds(channels)) throw new Error("種子或樹種權重設定不正確");
  for (const seed of seeds) {
    if (!text(seed.name, 60) || typeof seed.enabled !== "boolean" || !list(seed.outcomes, 30) || !seed.outcomes.length ||
        new Set(seed.outcomes.map(o => o.species)).size !== seed.outcomes.length ||
        seed.outcomes.some(o => !v.species.includes(o.species) || !count(o.weight) || o.weight === 0))
      throw new Error("種子或樹種權重設定不正確");
  }
  const walkSeedDrop = v.walkSeedDrop ?? { ...DEFAULT_WALK_SEED_DROP, seedTypeId: seeds.find(s => s.enabled)?.id ?? '', enabled: seeds.some(s => s.enabled) };
  if (typeof walkSeedDrop.enabled !== 'boolean' || typeof walkSeedDrop.seedTypeId !== 'string' ||
      !Number.isFinite(walkSeedDrop.chancePercent) || walkSeedDrop.chancePercent < 0 || walkSeedDrop.chancePercent > 100 ||
      (walkSeedDrop.enabled && !seeds.some(s => s.id === walkSeedDrop.seedTypeId && s.enabled)))
    throw new Error('散步種子掉落設定不正確，請指定啟用的機率池與 0–100% 掉落率');
  const date = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d;
  for (const c of channels) {
    if (!text(c.name, 100) || !text(c.plan, 60) || !text(c.brand, 100) || !date(c.startsOn) || !date(c.endsOn) || c.startsOn > c.endsOn ||
        typeof c.domestic !== 'boolean' || typeof c.enabled !== 'boolean' || !text(c.terms, 1000, false) ||
        !text(c.sourceUrl, 500) || !/^https:\/\//.test(c.sourceUrl)) throw new Error("CUBE 通路、期間或來源不正確");
  }
  for (const task of tasks) {
    if (!text(task.name, 100) || !text(task.description, 1000, false) ||
        !["banqiao", "xihu"].includes(task.areaId) ||
        !["daily", "weekly", "event"].includes(task.cadence) ||
        typeof task.enabled !== "boolean" || !coordinate(task) ||
        !text(task.destinationName, 100) || !text(task.address, 200, false) ||
        !count(task.rewardAmount) || task.rewardAmount === 0 ||
        (task.rewardType !== undefined && !['waterDrops', 'fertilizer', 'seeds'].includes(task.rewardType)) ||
        (task.rewardType === 'seeds' && task.rewardAmount > 100) ||
        (task.requiredSteps !== undefined && (!count(task.requiredSteps) || task.requiredSteps === 0)) ||
        (task.radiusMeters !== undefined && (!count(task.radiusMeters) || task.radiusMeters === 0 || task.radiusMeters > 10000)) ||
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
      (m.cubeChannelIds !== undefined && (!list(m.cubeChannelIds, 100) || new Set(m.cubeChannelIds).size !== m.cubeChannelIds.length || m.cubeChannelIds.some(id => !channels.some(c => c.id === id)))) ||
      (m.postalCode !== undefined && !/^\d{3}$/.test(m.postalCode)) ||
      (m.locationSourceUrl !== undefined && (!text(m.locationSourceUrl, 500) || !/^https:\/\//.test(m.locationSourceUrl))) ||
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
      (t.postalCode !== undefined && (typeof t.postalCode !== 'string' || !/^\d{3}$/.test(t.postalCode))) ||
      (!t.empty && (!text(t.species, 60) || !v.species.includes(t.species))) ||
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
    walkSeedDrop: { enabled: walkSeedDrop.enabled, chancePercent: walkSeedDrop.chancePercent, seedTypeId: walkSeedDrop.seedTypeId },
    seedTypes: seeds.map(s => ({id: s.id, name: s.name, enabled: s.enabled, outcomes: s.outcomes.map(o => ({species: o.species, weight: o.weight}))})),
    cubeChannels: channels.map(c => ({id: c.id, name: c.name, plan: c.plan, brand: c.brand, startsOn: c.startsOn, endsOn: c.endsOn, domestic: c.domestic, enabled: c.enabled, sourceUrl: c.sourceUrl, terms: c.terms})),
    tasks: tasks.map(task => ({
      id: task.id, name: task.name, description: task.description,
      areaId: task.areaId, cadence: task.cadence, enabled: task.enabled,
      startsAt: new Date(task.startsAt).toISOString(), endsAt: new Date(task.endsAt).toISOString(),
      destinationName: task.destinationName, address: task.address,
      latitude: task.latitude, longitude: task.longitude, rewardAmount: task.rewardAmount,
      rewardType: task.rewardType ?? (task.cadence === 'event' ? 'fertilizer' : 'waterDrops'),
      requiredSteps: task.requiredSteps ?? DEFAULT_TASK_STEPS[task.cadence],
      radiusMeters: task.radiusMeters ?? DEFAULT_TASK_RADIUS,
    })),
    harvestPoints: v.harvestPoints,
    species: [...v.species],
    merchants: v.merchants.map((m) => ({
      id: m.id,
      name: m.name,
      ...(m.postalCode ? {postalCode: m.postalCode} : {}),
      ...(m.locationSourceUrl ? {locationSourceUrl: m.locationSourceUrl} : {}),
      cubeChannelIds: [...(m.cubeChannelIds ?? [])],
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
      species: t.empty ? "" : t.species,
      place: t.place,
      ...((t.postalCode ?? legacyTreePostalCode(t.place)) ? { postalCode: t.postalCode ?? legacyTreePostalCode(t.place) } : {}),
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
/** Add curated records to a draft without replacing operator edits or personal data. */
export function mergeCatalog(existing: CmsConfig, incoming: CmsConfig): CmsConfig {
  const merge = <T extends {id: string}>(a: T[] = [], b: T[] = []): T[] =>
    [...a, ...b.filter(item => !a.some(old => old.id === item.id))];
  return validateConfig({...existing,
    species: [...new Set([...existing.species, ...incoming.species])],
    seedTypes: merge(existing.seedTypes, incoming.seedTypes), cubeChannels: merge(existing.cubeChannels, incoming.cubeChannels),
    trees: merge(existing.trees, incoming.trees), merchants: merge(existing.merchants, incoming.merchants),
    tasks: merge(existing.tasks, incoming.tasks), rewards: merge(existing.rewards, incoming.rewards), scenes: merge(existing.scenes, incoming.scenes),
  });
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
  if (!Array.isArray(value) || value.length > merchants.length)
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
  | "merchant_recommended"
  | "merchant_arrived"
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
  source?: string;
  plan?: string;
  version?: number;
}
/** Group route IDs by actor; count only completion of a departure in this window. */
export function metrics(
  events: MetricEvent[],
  redemptions: { actor: string; costNtd: number }[],
) {
  const active = new Set(events.filter(e => e.name !== "merchant_recommended").map((e) => e.actor));
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
    merchants: [...new Set(events.filter(e => ['merchant_recommended', 'merchant_arrived', 'offer_view', 'navigation_started'].includes(e.name)).map(e => e.entityId))].map(id => {
      const rows = events.filter(e => e.entityId === id);
      const selected = rows.filter(e => e.name === 'merchant_recommended');
      const arrivals = rows.filter(e => e.name === 'merchant_arrived');
      return {id, recommended: selected.length, gemini: selected.filter(e => e.source === 'gemini').length,
        rules: selected.filter(e => e.source === 'rules').length,
        views: rows.filter(e => e.name === 'offer_view').length, navigations: rows.filter(e => e.name === 'navigation_started').length,
        arrivals: arrivals.length, visitors: new Set(arrivals.map(e => e.actor)).size,
        // Counts are separate funnel stages, not a purchase or attribution claim.
        plans: [...new Set(selected.map(e => e.plan || '未指定'))].map(plan => ({plan, count: selected.filter(e => (e.plan || '未指定') === plan).length}))};
    }),
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
