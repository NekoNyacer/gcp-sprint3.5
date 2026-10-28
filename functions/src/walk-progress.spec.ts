import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  provision: vi.fn(), transaction: vi.fn(), doc: vi.fn((path: string) => path),
}));
vi.mock('./starter-seed.js', () => ({ provisionStarterSeed: mocks.provision }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: mocks.doc, runTransaction: mocks.transaction }),
  FieldValue: { serverTimestamp: () => 'server-time' },
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler: unknown) => handler,
  HttpsError: class extends Error {
    constructor(readonly code: string, message: string) { super(message); }
  },
}));
import { initializeWalkProgress, saveWalkProgress } from './walk-progress.js';
import type { MysterySeed } from './planting-catalog.js';

const initialize = initializeWalkProgress as unknown as (request: unknown) => Promise<unknown>;
const save = saveWalkProgress as unknown as (request: unknown) => Promise<unknown>;
const inventory = { lightEnergy: 0, waterDrops: 0, fertilizer: 0, seeds: 1 };
const input = () => ({ uid: 'alice', revision: 0, previousInventory: inventory, state: {
  mysterySeeds: [] as MysterySeed[],
  todaySteps: 10, todayStepsDay: '2026-10-19', lightEarnedToday: 10,
  totalRecordedSteps: 10, totalRecordedLightEnergy: 10, demoTreePoints: 0,
  demoTrees: {}, demoSupplyStationClaimedOn: {}, inventory: { ...inventory, lightEnergy: 10 },
} });

describe('saveWalkProgress', () => {
  beforeEach(() => vi.clearAllMocks());
  it('rejects unauthenticated and cross-account writes', async () => {
    await expect(save({ data: input() })).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(save({ auth: { uid: 'bob' }, data: input() })).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid resource amounts', async () => {
    const data = input();
    data.state.inventory.seeds = -1;
    await expect(save({ auth: { uid: 'alice' }, data })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
  it('preserves rewards already in the canonical inventory', async () => {
    const set = vi.fn();
    mocks.transaction.mockImplementation(async (callback) => callback({
      get: async (ref: string) => ({ data: () => ref.includes('/progress/') ? { revision: 0 } : { ...inventory, waterDrops: 5 } }),
      set,
    }));
    await save({ auth: { uid: 'alice' }, data: input() });
    expect(set).toHaveBeenCalledWith('users/alice/inventory/current',
      { lightEnergy: 10, waterDrops: 5, fertilizer: 0, seeds: 1, updatedAt: 'server-time' }, { merge: true });
    expect(set).toHaveBeenCalledWith('users/alice/dailyProgress/2026-10-19',
      { day: '2026-10-19', steps: 10, lightEnergy: 10, updatedAt: 'server-time' });
  });
  it('saves hidden seed identities and inventory credit in the same revisioned transaction', async () => {
    const data=input();
    data.state.mysterySeeds=[{id:'seed-1',species:'銀杏',seedTypeId:'mystery',version:7,
      origin:{routeId:'route-banqiao',place:'板橋車站',acquiredAt:1}}];
    data.state.inventory.seeds=2;
    const set=vi.fn();
    mocks.transaction.mockImplementation(async callback=>callback({
      get:async(ref:string)=>({data:()=>ref.includes('/progress/')?{revision:0}:inventory}),set,
    }));
    await save({auth:{uid:'alice'},data});
    expect(set).toHaveBeenCalledWith('users/alice/progress/current',expect.objectContaining({
      revision:1,state:expect.objectContaining({mysterySeeds:data.state.mysterySeeds,inventory:expect.objectContaining({seeds:2})}),
    }));
  });
  it('rejects stale revisions without overwriting another device', async () => {
    const set = vi.fn();
    mocks.transaction.mockImplementation(async (callback) => callback({
      get: async () => ({ data: () => ({ revision: 1 }) }), set,
    }));
    await expect(save({ auth: { uid: 'alice' }, data: input() })).rejects.toMatchObject({ code: 'aborted' });
    expect(set).not.toHaveBeenCalled();
  });
});

describe('initializeWalkProgress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('provisions the starter seed when a normal user first loads progress', async () => {
    await expect(initialize({ auth: { uid: 'alice' }, data: {} })).resolves.toEqual({ ready: true });
    expect(mocks.provision).toHaveBeenCalledWith(expect.anything(), 'alice');
  });

  it('rejects unauthenticated initialization', async () => {
    await expect(initialize({ data: {} })).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mocks.provision).not.toHaveBeenCalled();
  });
});
