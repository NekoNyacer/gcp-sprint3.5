import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const memory = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  writes: [] as string[],
  transaction: Promise.resolve() as Promise<unknown>,
  next: 0,
}));
const reference = (path: string): any => ({
  path,
  id: path.split("/").at(-1),
  get: async () => ({
    exists: memory.docs.has(path),
    data: () => structuredClone(memory.docs.get(path)),
  }),
  collection: (name: string) => ({
    doc: (id: string) => reference(`${path}/${name}/${id}`),
  }),
});
vi.mock("firebase-admin/app", () => ({
  getApp: () => ({
    options: {
      projectId: "demo-cat-walk",
      credential: {
        getAccessToken: async () => ({ access_token: "test-only" }),
      },
    },
  }),
}));
vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    fromDate: (date: Date) =>
      new (class {
        milliseconds = date.getTime();
        toMillis() {
          return this.milliseconds;
        }
      })(),
  },
  FieldValue: {},
  getFirestore: () => ({
    doc: reference,
    collection: (name: string) => ({
      doc: () => reference(`${name}/audit-${++memory.next}`),
      limit: (limit: number) => ({get: async () => {
        const docs = [...memory.docs.keys()].filter(path => path.startsWith(name + '/') && path.split('/').length === name.split('/').length + 1)
          .slice(0, limit).map(path => ({id: path.split('/').at(-1), data: () => memory.docs.get(path)}));
        return {docs, size: docs.length};
      }}),
    }),
    runTransaction: (callback: any) => {
      const run = memory.transaction
        .catch(() => {})
        .then(async () => {
          const pending: [string, any][] = [];
          const result = await callback({
            get: async (ref: any) => ({
              exists: memory.docs.has(ref.path),
              data: () => structuredClone(memory.docs.get(ref.path)),
            }),
            set: (ref: any, data: any, options?: {merge: boolean}) =>
              pending.push([ref.path, structuredClone(options?.merge ? {...memory.docs.get(ref.path), ...data} : data)]),
            create: (ref: any, data: any) => {
              if (memory.docs.has(ref.path)) throw new Error("already exists");
              pending.push([ref.path, structuredClone(data)]);
            },
          });
          for (const [path, value] of pending) {
            memory.docs.set(path, value);
            memory.writes.push(path);
          }
          return result;
        });
      memory.transaction = run;
      return run;
    },
  }),
}));
vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_: unknown, handler: unknown) => handler,
  HttpsError: class extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly details?: unknown,
    ) {
      super(message);
    }
  },
}));
vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_: unknown, handler: unknown) => handler,
}));
vi.mock("firebase-functions/params", () => ({
  defineString: (_: unknown, options: { default: string }) => ({
    value: () => options.default,
  }),
}));
vi.mock("firebase-functions", () => ({ logger: { warn: vi.fn() } }));
import {
  cmsCommand,
  cmsTrack,
  cmsRedeem,
  cmsWallet,
  cmsResetDemo,
  cmsHarvest,
  cmsRecommend,
} from "./cms.js";
const track = cmsTrack as unknown as (req: any) => Promise<any>;
const command = cmsCommand as unknown as (req: any) => Promise<any>;
const redeem = cmsRedeem as unknown as (req: any) => Promise<any>;
const wallet = cmsWallet as unknown as (req: any) => Promise<any>;
const reset = cmsResetDemo as unknown as (req: any) => Promise<any>;
const harvest = cmsHarvest as unknown as (req: any) => Promise<any>;
const recommend = cmsRecommend as unknown as (req: any) => Promise<any>;
const config = () =>
  JSON.parse(
    readFileSync(
      new URL("../../firebase/seed/cms-demo.json", import.meta.url),
      "utf8",
    ),
  );
const user = (uid = "alice") => ({
  uid,
  token: { email_verified: true, firebase: { sign_in_provider: "google.com" } },
});
const administrator = () => ({
  ...user("admin"),
  token: { ...user().token, cmsAdmin: true },
});
beforeEach(async () => {
  await memory.transaction.catch(() => {});
  memory.docs.clear();
  memory.writes = [];
  memory.transaction = Promise.resolve();
  vi.unstubAllGlobals();
});
describe("CMS authority, publishing, and atomic point economy", () => {
  it('saves and publishes the 1716-site import through the callable handler', async () => {
    const imported = JSON.parse(readFileSync(new URL('../../firebase/seed/seed-data-gcp-hackathon-03-2026-10-27.json', import.meta.url), 'utf8'));
    const request = (action: string, expectedRevision: number) => command({auth: administrator(), data: {
      scope: 'demo', action, expectedRevision, ...(action === 'save' ? {config: imported} : {}),
    }});
    await expect(request('save', 0)).resolves.toMatchObject({revision: 1});
    expect(memory.docs.get('cmsDrafts/demo').config.trees).toHaveLength(1716);
    expect(memory.docs.has('cmsPublished/demo')).toBe(false);
    await request('publish', 1);
    expect(memory.docs.get('cmsPublished/demo').config.trees).toHaveLength(1716);
  });
  it('spreads rules fallback over the full route instead of filling it with origin shops', async () => {
    const settings = config();
    settings.merchants = [
      ['start-a', 121.4501], ['start-b', 121.4502], ['start-c', 121.4503],
      ['middle', 121.47], ['finish', 121.489],
    ].map(([id, longitude]) => ({...settings.merchants[0], id, longitude, latitude: 25,
      roles: ['supply'], validUntil: '2099-12-31'}));
    memory.docs.set('cmsPublished/demo', {config: settings, version: 1});
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: false, status: 503})));
    const result = await recommend({auth: user(), data: {scope: 'demo', origin: {latitude: 25, longitude: 121.45},
      destination: {latitude: 25, longitude: 121.49}, distanceMeters: 4500, durationSeconds: 3600}});
    expect(result.source).toBe('rules');
    expect(result.selections.map((s: any) => s.merchantId)).toEqual(expect.arrayContaining(['middle', 'finish']));
  });
  it('rejects client-forged recommendation events and faraway arrivals, deduplicating valid arrivals per route and merchant', async () => {
    const settings = config();
    memory.docs.set('cmsPublished/demo', {config: settings, version: 7});
    const m = settings.merchants[0];
    const request = {auth: user(), data: {scope: 'demo', name: 'merchant_arrived', entityId: m.id, eventId: 'route-one', position: {latitude: m.latitude, longitude: m.longitude}}};
    await expect(track({...request, data: {...request.data, name: 'merchant_recommended'}})).rejects.toMatchObject({code: 'invalid-argument'});
    await expect(track({...request, data: {...request.data, position: {latitude: 0, longitude: 0}}})).rejects.toMatchObject({code: 'failed-precondition'});
    await track(request); await track(request);
    let events = [...memory.docs.entries()].filter(([path]) => path.startsWith('cmsEvents/'));
    expect(events).toHaveLength(1);
    expect(events[0][1]).toMatchObject({evidence: 'simulated-proximity', name: 'merchant_arrived'});
    expect(events[0][1]).not.toHaveProperty('position');
    const other = settings.merchants[1];
    await track({...request, data: {...request.data, entityId: other.id, position: {latitude: other.latitude, longitude: other.longitude}}});
    events = [...memory.docs.entries()].filter(([path]) => path.startsWith('cmsEvents/'));
    expect(events).toHaveLength(2);
  });
  it('filters AI candidates by valid domestic CUBE channels and records actual returned selection source', async () => {
    const settings = config();
    const merchant = settings.merchants.find((m: any) => m.id === 'ikea-neihu');
    const selection = [{merchantId: merchant.id, role: 'supply', reason: '國內指定通路'}];
    memory.docs.set('cmsPublished/demo', {config: settings, version: 7});
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T04:00:00Z'));
    try {
      vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify(selection)}]}}]})})));
      const result = await recommend({auth: user(), data: {scope: 'demo', plan: '集精選', origin: {latitude: merchant.latitude, longitude: merchant.longitude}, destination: {latitude: merchant.latitude + 0.001, longitude: merchant.longitude}}});
      expect(result.source).toBe('gemini');
      const events = [...memory.docs.entries()].filter(([path]) => path.startsWith('cmsEvents/'));
      expect(events).toHaveLength(1);
      expect(events[0][1]).toMatchObject({name: 'merchant_recommended', entityId: merchant.id, plan: '集精選', source: 'gemini', version: 7});
      const empty = await recommend({auth: user(), data: {scope: 'demo', plan: '秋日遊', origin: {latitude: merchant.latitude, longitude: merchant.longitude}, destination: {latitude: merchant.latitude + 0.001, longitude: merchant.longitude}}});
      expect(empty.selections).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  it('imports existing normal tasks for review without changing live documents or leaking them into Demo', async () => {
    memory.docs.set('tasks/legacy-task', {title: '既有任務', description: '', areaId: 'banqiao', cadence: 'daily',
      startsAt: {toDate: () => new Date('2026-10-21T00:00:00+08:00')},
      endsAt: {toDate: () => new Date('2026-10-22T00:00:00+08:00')},
      destination: {name: '廣場', address: '', latitude: 25, longitude: 121}, reward: {type: 'waterDrops', amount: 2}});
    const imported = await command({auth: administrator(), data: {scope: 'normal', action: 'import-tasks'}});
    expect(imported.tasks).toMatchObject([{id: 'legacy-task', name: '既有任務', rewardAmount: 2}]);
    expect(memory.writes).toEqual([]);
    expect((await command({auth: administrator(), data: {scope: 'demo', action: 'import-tasks'}})).tasks).toEqual(imported.tasks);
  });
  it('publishes normal tasks to the existing task feature and archives removed tasks without touching player history', async () => {
    const data = config();
    data.tasks = [{id: 'task-cms', name: '活動', description: '', areaId: 'banqiao', cadence: 'event',
      enabled: true, startsAt: '2026-10-21T00:00:00+08:00', endsAt: '2026-11-09T00:00:00+08:00',
      destinationName: '站前廣場', address: '', latitude: 25, longitude: 121, rewardAmount: 2}];
    memory.docs.set('tasks/unrelated', {title: 'existing'});
    memory.docs.set('users/alice/taskCompletions/task-cms', {reward: {amount: 1}});
    const call = (action: string, revision: number, config?: object) => command({auth: administrator(), data: {scope: 'normal', action, expectedRevision: revision, config}});
    await call('save', 0, data);
    expect(memory.docs.has('tasks/task-cms')).toBe(false);
    await call('publish', 1);
    expect(memory.docs.get('tasks/task-cms')).toMatchObject({enabled: true, title: '活動', reward: {type: 'fertilizer', amount: 2}, cmsVersion: 1});
    await call('save', 2, {...data, tasks: []});
    await call('publish', 3);
    expect(memory.docs.get('tasks/task-cms')).toMatchObject({enabled: false, title: '活動', cmsVersion: 2});
    expect(memory.docs.get('tasks/unrelated')).toEqual({title: 'existing'});
    expect(memory.docs.get('users/alice/taskCompletions/task-cms')).toEqual({reward: {amount: 1}});
  });
  it('publishes shared simulation tasks for both client modes', async () => {
    await command({auth: administrator(), data: {scope: 'demo', action: 'save', expectedRevision: 0, config: config()}});
    await command({auth: administrator(), data: {scope: 'demo', action: 'publish', expectedRevision: 1}});
    expect(memory.writes.some(path => path.startsWith('tasks/'))).toBe(true);
  });
  it("rejects absent, unprivileged, unverified, and non-Google administrators", async () => {
    for (const auth of [
      undefined,
      user(),
      {
        ...administrator(),
        token: { ...administrator().token, email_verified: false },
      },
      {
        ...administrator(),
        token: {
          ...administrator().token,
          firebase: { sign_in_provider: "anonymous" },
        },
      },
    ]) {
      await expect(
        command({
          auth,
          data: {
            scope: "demo",
            action: "save",
            expectedRevision: 0,
            config: config(),
          },
        }),
      ).rejects.toHaveProperty("code");
    }
    expect(memory.writes).toEqual([]);
  });
  it("requires a saved draft and rejects stale writers without publishing partial changes", async () => {
    await expect(
      command({
        auth: administrator(),
        data: { scope: "demo", action: "publish", expectedRevision: 0 },
      }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    await command({
      auth: administrator(),
      data: {
        scope: "demo",
        action: "save",
        expectedRevision: 0,
        config: config(),
      },
    });
    expect(memory.docs.has("cmsPublished/demo")).toBe(false);
    await expect(
      command({
        auth: administrator(),
        data: { scope: "demo", action: "publish", expectedRevision: 0 },
      }),
    ).rejects.toMatchObject({ code: "aborted" });
    await command({
      auth: administrator(),
      data: { scope: "demo", action: "publish", expectedRevision: 1 },
    });
    expect(memory.docs.get("cmsPublished/demo")).toMatchObject({ version: 1 });
    expect(memory.writes.some((path) => path.startsWith("cmsAudit/"))).toBe(
      true,
    );
  });
  it("keeps Demo and normal wallets isolated and only resets the caller Demo wallet", async () => {
    const demo = await wallet({ auth: user(), data: { scope: "demo" } });
    const normal = await wallet({ auth: user(), data: { scope: "normal" } });
    await wallet({ auth: user("bob"), data: { scope: "demo" } });
    expect(demo.treePointsBalance).toBe(2680);
    expect(normal.treePointsBalance).toBe(0);
    memory.docs.get("cmsPlayers/demo/players/bob").snapshot.treePointsBalance =
      99;
    await reset({ auth: user(), data: { scope: "demo" } });
    expect(
      memory.docs.get("cmsPlayers/demo/players/bob").snapshot.treePointsBalance,
    ).toBe(99);
    expect(
      memory.docs.get("cmsPlayers/normal/players/alice").snapshot
        .treePointsBalance,
    ).toBe(0);
    await expect(
      reset({ auth: user(), data: { scope: "normal" } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("deduplicates redemption retries and preserves historical price/cost/version", async () => {
    memory.docs.set("cmsPublished/demo", { config: config(), version: 3 });
    await wallet({ auth: user(), data: { scope: "demo" } });
    const input = {
      auth: user(),
      data: {
        scope: "demo",
        requestId: "request-a",
        rewardId: "demo-drink",
        version: 3,
      },
    };
    const first = await redeem(input);
    const retry = await redeem(input);
    expect(first.snapshot.treePointsBalance).toBe(2650);
    expect(retry).toEqual(first);
    memory.docs.get("cmsPublished/demo").config.rewards[0].costNtd = 999;
    expect(first.transaction).toMatchObject({
      treePointsAmount: -30,
      costNtd: 30,
      configVersion: 3,
      type: "PRODUCT",
    });
    expect(
      memory.writes.filter((p) => p.startsWith("cmsRedemptions/")),
    ).toHaveLength(1);
    await expect(
      redeem({
        ...input,
        data: { ...input.data, rewardId: "demo-green-transport" },
      }),
    ).rejects.toMatchObject({ code: "already-exists" });
  });
  it("rejects changed publication versions and insufficient points without a ledger entry", async () => {
    memory.docs.set("cmsPublished/normal", { config: config(), version: 3 });
    await wallet({ auth: user(), data: { scope: "normal" } });
    const input = {
      auth: user(),
      data: {
        scope: "normal",
        requestId: "request-a",
        rewardId: "demo-drink",
        version: 2,
      },
    };
    await expect(redeem(input)).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await expect(
      redeem({ ...input, data: { ...input.data, version: 3 } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(memory.writes.some((p) => p.startsWith("cmsRedemptions/"))).toBe(
      false,
    );
  });
  it("cannot overspend when two commands race for one balance", async () => {
    memory.docs.set("cmsPublished/demo", { config: config(), version: 1 });
    await wallet({ auth: user(), data: { scope: "demo" } });
    memory.docs.get(
      "cmsPlayers/demo/players/alice",
    ).snapshot.treePointsBalance = 30;
    const results = await Promise.allSettled(
      ["one", "two"].map((requestId) =>
        redeem({
          auth: user(),
          data: {
            scope: "demo",
            requestId,
            rewardId: "demo-drink",
            version: 1,
          },
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      memory.docs.get("cmsPlayers/demo/players/alice").snapshot
        .treePointsBalance,
    ).toBe(0);
  });
  it("credits a harvest only once and never creates a second spendable tree entitlement", async () => {
    memory.docs.set("cmsPublished/demo", { config: config(), version: 1 });
    await wallet({ auth: user(), data: { scope: "demo" } });
    const input = {
      auth: user(),
      data: {
        scope: "demo",
        treeId: "tree-1",
        cycle: "1234567890",
        version: 1,
      },
    };
    await harvest(input);
    await harvest(input);
    expect(
      memory.docs.get("cmsPlayers/demo/players/alice").snapshot
        .treePointsBalance,
    ).toBe(2730);
    expect(
      memory.docs.get("cmsPlayers/demo/players/alice").snapshot.entitlements,
    ).toEqual([]);
  });
  it("uses actual Vertex JSON output and sends no exact player coordinates to the model", async () => {
    const settings = config();
    settings.merchants.forEach((m: any) => (m.validUntil = "2099-12-31"));
    memory.docs.set("cmsPublished/demo", { config: settings, version: 1 });
    const selections = [
      {
        merchantId: settings.merchants[0].id,
        role: "supply",
        reason: "短程炎熱天氣適合飲水補給",
      },
    ];
    const fetch = vi.fn(async (url: unknown) => String(url).includes('open-meteo') ? ({ok: true,
      json: async () => ({current: {temperature_2m: 31, precipitation: 0, weather_code: 0, time: Math.floor(Date.now() / 1000)}}),
    }) : ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(selections) }] } },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetch);
    const result = await recommend({
      auth: user(),
      data: {
        scope: "demo",
        origin: { latitude: 25.013456789, longitude: 121.462876543 },
        destination: {latitude: 25.015, longitude: 121.465},
      },
    });
    expect(result).toMatchObject({ source: "gemini", selections, version: 1 });
    const request = fetch.mock.calls.find(call => String(call[0]).includes('aiplatform')) as unknown as [
      string,
      { body: string },
    ];
    expect(request[0]).toContain("aiplatform.googleapis.com");
    expect(JSON.parse(request[1].body).generationConfig).toMatchObject({
      thinkingConfig: { thinkingBudget: 0 },
    });
    expect(request[1].body).not.toContain("25.013456789");
    expect(request[1].body).not.toContain("121.462876543");
    const prompt = JSON.parse(JSON.parse(request[1].body).contents[0].parts[0].text);
    expect(prompt.context).toMatchObject({weather: {source: 'open-meteo', condition: 'sunny', temperatureC: 31}, timeZone: 'Asia/Taipei'});
    expect(prompt.context.walkingDistanceMeters).toBeGreaterThan(0);
    expect(prompt.candidates.every((m: any) => m.roles.length === 1 && m.roles[0] === 'supply')).toBe(true);
  });
  it('requires a valid destination before charging recommendation quota', async () => {
    await expect(recommend({auth: user(), data: {scope: 'demo', origin: {latitude: 25, longitude: 121}}}))
      .rejects.toMatchObject({code: 'invalid-argument'});
    expect(memory.writes).toEqual([]);
  });
  it('preserves eight Gemini-selected stops, permits zero, and rejects planting output', async () => {
    const settings = config();
    settings.merchants = Array.from({length: 8}, (_, i) => ({...settings.merchants[0], id: `selected-${i}`,
      latitude: 25.005 + i * 0.0001, longitude: 121.458, validUntil: '2099-12-31'}));
    memory.docs.set('cmsPublished/demo', {config: settings, version: 2});
    const input = {auth: user(), data: {scope: 'demo', origin: {latitude: 25.001, longitude: 121.4548}, destination: {latitude: 25.012, longitude: 121.46}}};
    for (const selections of [settings.merchants.map((m: any) => ({merchantId: m.id, role: 'supply', reason: '依路程與時段補給'})), []]) {
      vi.stubGlobal('fetch', vi.fn(async (url: unknown) => String(url).includes('open-meteo') ? {ok: false, status: 503}
        : {ok: true, json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify(selections)}]}}]})}));
      expect(await recommend(input)).toMatchObject({source: 'gemini', selections});
    }
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => String(url).includes('open-meteo') ? {ok: false, status: 503}
      : {ok: true, json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify([{merchantId: 'selected-0', role: 'planting', reason: 'wrong'}])}]}}]})}));
    const result = await recommend(input);
    expect(result.source).toBe('rules');
    expect(result.selections.every((s: any) => s.role === 'supply')).toBe(true);
    const events = [...memory.docs.entries()].filter(([path]) => path.startsWith('cmsEvents/'));
    expect(events.every(([, event]) => !('origin' in event) && !('destination' in event) && !('route' in event))).toBe(true);
  });
  it("requires renewed harvest consent when reward settings changed during the animation", async () => {
    memory.docs.set("cmsPublished/demo", { config: config(), version: 2 });
    await wallet({ auth: user(), data: { scope: "demo" } });
    const input = {
      auth: user(),
      data: {
        scope: "demo",
        treeId: "tree-1",
        cycle: "1234567890",
        version: 1,
      },
    };
    await expect(harvest(input)).rejects.toMatchObject({
      code: "failed-precondition",
      details: { kind: "harvest-price-changed", version: 2 },
    });
    expect(
      memory.docs.get("cmsPlayers/demo/players/alice").snapshot
        .treePointsBalance,
    ).toBe(2680);
    await harvest({ ...input, data: { ...input.data, version: 2 } });
    expect(
      memory.docs.get("cmsPlayers/demo/players/alice").snapshot
        .treePointsBalance,
    ).toBe(2730);
  });
  it("labels invalid AI output and model failures as rules fallback", async () => {
    const settings = config();
    settings.merchants.forEach((m: any) => (m.validUntil = "2099-12-31"));
    memory.docs.set("cmsPublished/demo", { config: settings, version: 1 });
    for (const reply of [
      { ok: false, status: 403 },
      {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '[{"merchantId":"invented","role":"planting","reason":"fake"}]',
                  },
                ],
              },
            },
          ],
        }),
      },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => reply),
      );
      const result = await recommend({
        auth: user(),
        data: {
          scope: "demo",
          origin: { latitude: 25.0134, longitude: 121.4628 },
          destination: {latitude: 25.015, longitude: 121.465},
        },
      });
      expect(result.source).toBe("rules");
      expect(
        result.selections.every((s: any) =>
          settings.merchants.some(
            (m: any) => m.id === s.merchantId && m.roles.includes(s.role),
          ),
        ),
      ).toBe(true);
    }
  });
});
