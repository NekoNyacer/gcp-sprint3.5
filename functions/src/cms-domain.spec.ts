import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { metrics, validateConfig, validateSelections } from "./cms-domain.js";
const seed = () =>
  JSON.parse(
    readFileSync(
      new URL("../../firebase/seed/cms-demo.json", import.meta.url),
      "utf8",
    ),
  );
describe("CMS public configuration and constrained AI output", () => {
  const task = () => ({id: 'task-one', name: '每日走路', description: '', areaId: 'banqiao',
    cadence: 'daily', enabled: true, startsAt: '2026-10-21T00:00:00+08:00', endsAt: '2026-10-22T00:00:00+08:00',
    destinationName: '板橋車站', address: '', latitude: 25.0142, longitude: 121.4639, rewardAmount: 1});
  it('supports older configurations without tasks and normalizes task time zones', () => {
    const old = seed(); delete old.tasks;
    expect(validateConfig(old).tasks).toEqual([]);
    expect(validateConfig({...old, tasks: [task()]}).tasks?.[0].startsAt).toBe('2026-10-20T16:00:00.000Z');
  });
  it.each([
    {latitude: 91}, {longitude: Infinity}, {rewardAmount: 0}, {rewardAmount: 1.5},
    {startsAt: '2026-10-23T00:00:00+08:00'}, {endsAt: 'invalid'},
    {startsAt: '2026-10-21T00:00'}, {cadence: 'supply'}, {areaId: 'unknown'},
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
    expect(validateConfig(data).trees.length).toBe(13);
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
