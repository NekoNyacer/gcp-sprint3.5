import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CMS_MAX_CONFIG_BYTES, CMS_MAX_TREE_PRESETS, metrics, validateConfig, validateSelections } from "./cms-domain.js";
const seed = () =>
  JSON.parse(
    readFileSync(
      new URL("../../firebase/seed/cms-demo.json", import.meta.url),
      "utf8",
    ),
  );
describe("CMS public configuration and constrained AI output", () => {
  it('accepts the Cathay location import through the shared CMS validator', () => {
    const raw = readFileSync(new URL('../../firebase/seed/seed-data-gcp-hackathon-03-2026-10-27.json', import.meta.url), 'utf8');
    expect(Buffer.byteLength(raw, 'utf8')).toBeLessThanOrEqual(CMS_MAX_CONFIG_BYTES);
    const data = validateConfig(JSON.parse(raw));
    expect(data.trees).toHaveLength(1716);
    expect(data.trees.every(t => t.name.trim().length > 0 && t.empty && t.growth === 0 && t.species === '')).toBe(true);
  });
  it('accepts the tree count boundary and rejects an additional unique site', () => {
    const data = seed();
    data.trees = Array.from({length: CMS_MAX_TREE_PRESETS}, (_, i) => ({...data.trees[0], id: `site-${i}`, name: '樹', place: '站'}));
    expect(validateConfig(data).trees).toHaveLength(CMS_MAX_TREE_PRESETS);
    data.trees.push({...data.trees[0], id: 'one-too-many'});
    expect(() => validateConfig(data)).toThrow('設定格式、數量或識別碼不正確');
  });
  it('measures the configuration limit in UTF-8 bytes', () => {
    const data = {...seed(), padding: ''};
    const remaining = CMS_MAX_CONFIG_BYTES - Buffer.byteLength(JSON.stringify(data), 'utf8');
    data.padding = '界'.repeat(Math.floor(remaining / 3)) + 'a'.repeat(remaining % 3);
    expect(Buffer.byteLength(JSON.stringify(data), 'utf8')).toBe(CMS_MAX_CONFIG_BYTES);
    expect(() => validateConfig(data)).not.toThrow();
    data.padding += 'a';
    expect(JSON.stringify(data).length).toBeLessThan(CMS_MAX_CONFIG_BYTES);
    expect(() => validateConfig(data)).toThrow('設定格式、數量或識別碼不正確');
  });
  it('accepts any number of unique configured selections, including zero or more than six', () => {
    const merchants = seed().merchants;
    const selections = merchants.slice(0, 8).map((m: any) => ({merchantId: m.id, role: 'supply', reason: '沿途補給'}));
    expect(validateSelections(selections, merchants)).toHaveLength(8);
    expect(validateSelections([], merchants)).toEqual([]);
  });
  it('covers Banqiao and all twelve Taipei districts with simulated supply merchants and planting sites', () => {
    const data = validateConfig(seed());
    const postcodes = ['220', '100', '103', '104', '105', '106', '108', '110', '111', '112', '114', '115', '116'];
    for (const postalCode of postcodes) {
      const shops = data.merchants.filter(m => m.postalCode === postalCode && m.id.startsWith('demo-'));
      expect(shops).toHaveLength(5);
      expect(shops.every(m => m.roles.length === 1 && m.roles[0] === 'supply' && m.terms.includes('虛構'))).toBe(true);
      expect(data.trees.some(t => t.postalCode === postalCode)).toBe(true);
    }
  });
  it('preserves explicit postal codes and backfills only known legacy tree places', () => {
    const data = seed();
    delete data.trees[0].postalCode;
    data.trees[1].postalCode = '220';
    data.trees[2].place = '未確認位置';
    delete data.trees[2].postalCode;
    const result = validateConfig(data);
    expect(result.trees[0].postalCode).toBe('114');
    expect(result.trees[1].postalCode).toBe('220');
    expect(result.trees[2]).not.toHaveProperty('postalCode');
  });
  it.each(['1140', '內湖', '', 114, null])('rejects invalid tree postal code %s', postalCode => {
    const data = seed();
    data.trees[0].postalCode = postalCode;
    expect(() => validateConfig(data)).toThrow('種樹點設定不正確');
  });
  const task = () => ({id: 'task-one', name: '每日走路', description: '', areaId: 'banqiao',
    cadence: 'daily', enabled: true, startsAt: '2026-10-21T00:00:00+08:00', endsAt: '2026-10-22T00:00:00+08:00',
    destinationName: '板橋車站', address: '', latitude: 25.0142, longitude: 121.4639, rewardAmount: 1});
  it('supports older configurations without tasks and normalizes task time zones', () => {
    const old = seed(); delete old.tasks;
    expect(validateConfig(old).tasks).toEqual([]);
    expect(validateConfig({...old, tasks: [task()]}).tasks?.[0].startsAt).toBe('2026-10-20T16:00:00.000Z');
    expect(validateConfig({...old,tasks:[task()]}).tasks?.[0]).toMatchObject({requiredSteps:1000,radiusMeters:100,rewardType:'waterDrops'});
  });
  it('round trips independent task rewards, steps and arrival radius',()=>{
    expect(validateConfig({...seed(),tasks:[{...task(),requiredSteps:2500,radiusMeters:150,rewardType:'seeds',rewardAmount:1}]}).tasks?.[0])
      .toMatchObject({requiredSteps:2500,radiusMeters:150,rewardType:'seeds',rewardAmount:1});
  });
  it.each([
    {latitude: 91}, {longitude: Infinity}, {rewardAmount: 0}, {rewardAmount: 1.5},
    {startsAt: '2026-10-23T00:00:00+08:00'}, {endsAt: 'invalid'},
    {startsAt: '2026-10-21T00:00'}, {cadence: 'supply'}, {areaId: 'unknown'},
    {requiredSteps:0}, {requiredSteps:1.5}, {radiusMeters:0}, {radiusMeters:10001}, {rewardType:'lightEnergy'},
  ])('rejects invalid task definitions %j', patch => {
    expect(() => validateConfig({...seed(), tasks: [{...task(), ...patch}]})).toThrow();
  });
  it("preserves reward avatars and supplies defaults for older rewards", () => {
    const data = seed();
    data.rewards[0].icon = "leaf";
    data.rewards[0].backgroundColor = "#ECE5F8";
    expect(validateConfig(data).rewards[0]).toMatchObject({icon: "leaf", backgroundColor: "#ECE5F8"});
    delete data.rewards[0].icon;
    delete data.rewards[0].backgroundColor;
    expect(validateConfig(data).rewards[0]).toMatchObject({icon: "gift-money", backgroundColor: "#E4F2E7"});
  });
  it.each([{icon: "unlisted-icon"}, {icon: "leaf extra-class"}, {backgroundColor: "url(https://example.com/image)"}, {backgroundColor: "#ffffff"}])("rejects unsupported reward avatar settings %j", patch => {
    const data = seed();
    Object.assign(data.rewards[0], patch);
    expect(() => validateConfig(data)).toThrow("獎勵設定不正確");
  });
  it("accepts the migrated fixture schema", () => {
    const data = seed();
    expect(validateConfig(data).trees.length).toBeGreaterThan(13);
  });
  it.each([NaN, Infinity, 91, -91])(
    "rejects invalid station latitude %s",
    (latitude) => {
      const data = seed();
      data.merchants[0].latitude = latitude;
      expect(() => validateConfig(data)).toThrow();
    },
  );
  it("rejects duplicate identifiers and missing roles", () => {
    const data = seed();
    data.merchants.push(data.merchants[0]);
    expect(() => validateConfig(data)).toThrow();
    const next = seed();
    next.merchants[0].roles = [];
    expect(() => validateConfig(next)).toThrow();
  });
  it("rejects negative or fractional points and costs", () => {
    for (const [field, value] of [
      ["requiredPoints", 0],
      ["requiredPoints", 1.5],
      ["costNtd", -1],
      ["costNtd", 0.001],
    ] as const) {
      const data = seed();
      data.rewards[0][field] = value;
      expect(() => validateConfig(data)).toThrow();
    }
  });
  it("strips unrecognized metadata instead of publishing it", () => {
    const data = seed();
    data.merchants[0].privateEmail = "must-not-be-published";
    expect(validateConfig(data).merchants[0]).not.toHaveProperty(
      "privateEmail",
    );
  });
  it("rejects invented IDs, unauthorized roles, disabled merchants, and duplicates from AI", () => {
    const merchants = seed().merchants;
    merchants[0].roles = ["supply"];
    merchants[1].enabled = false;
    for (const selections of [
      [{ merchantId: "invented", role: "supply", reason: "nearby" }],
      [{ merchantId: merchants[0].id, role: "planting", reason: "nearby" }],
      [{ merchantId: merchants[1].id, role: "supply", reason: "nearby" }],
      [0, 1].map(() => ({
        merchantId: merchants[0].id,
        role: "supply",
        reason: "nearby",
      })),
    ])
      expect(() => validateSelections(selections, merchants)).toThrow();
  });
  it("never renders missing denominators as a perfect conversion rate", () => {
    expect(metrics([], [])).toMatchObject({
      activeUsers: 0,
      routeCompletionRate: null,
      offerNavigationRate: null,
      redemptionRate: null,
      costPerActiveUser: null,
    });
  });
  it("pairs offer navigation by actor, merchant, and ordering and deduplicates route events", () => {
    const result = metrics(
      [
        { actor: "a", name: "offer_view", entityId: "m1", at: 10 },
        { actor: "a", name: "navigation_started", entityId: "m2", at: 11 },
        { actor: "b", name: "navigation_started", entityId: "m1", at: 5 },
        { actor: "b", name: "offer_view", entityId: "m1", at: 10 },
        { actor: "a", name: "navigation_started", entityId: "m1", at: 12 },
        { actor: "a", name: "route_started", entityId: "r", at: 13 },
        { actor: "a", name: "route_started", entityId: "r", at: 13 },
        { actor: "b", name: "route_completed", entityId: "r", at: 14 },
        { actor: "a", name: "route_completed", entityId: "r", at: 15 },
        { actor: "a", name: "shop_view", entityId: "app", at: 16 },
      ],
      [{ actor: "a", costNtd: 30 }],
    );
    expect(result).toMatchObject({
      activeUsers: 2,
      offerViewers: 2,
      navigators: 1,
      offerNavigationRate: 0.5,
      routeStarted: 1,
      routeCompleted: 1,
      routeCompletionRate: 1,
      redemptionRate: 1,
      rewardCostNtd: 30,
      costPerActiveUser: 15,
    });
  });
});
