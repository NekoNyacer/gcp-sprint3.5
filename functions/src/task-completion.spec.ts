import {beforeEach, describe, expect, it, vi} from 'vitest';
const state = vi.hoisted(() => ({docs: new Map<string, any>()}));
vi.mock('firebase-admin/app', () => ({initializeApp: vi.fn()}));
vi.mock('./walk-progress.js', () => ({initializeWalkProgress: vi.fn(), saveWalkProgress: vi.fn()}));
vi.mock('./cms.js', () => ({cmsCommand: vi.fn(), cmsTrack: vi.fn(), cmsDashboard: vi.fn(), cmsWallet: vi.fn(),
  cmsRedeem: vi.fn(), cmsHarvest: vi.fn(), cmsResetDemo: vi.fn(), cmsRecommend: vi.fn(), cmsCleanup: vi.fn(), cmsValidateStation: vi.fn()}));
vi.mock('firebase-functions/v2/https', () => ({onCall: (_: unknown, handler: unknown) => handler,
  HttpsError: class extends Error {constructor(readonly code: string, message: string) {super(message);}}}));
vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {now: () => ({toMillis: () => Date.now(), toDate: () => new Date()})},
  getFirestore: () => ({doc: (path: string) => ({path}), runTransaction: async (callback: any) => {
    const writes: [string, any][] = [];
    const result = await callback({
      get: async (ref: {path: string}) => ({exists: state.docs.has(ref.path), data: () => state.docs.get(ref.path)}),
      set: (ref: {path: string}, data: any) => writes.push([ref.path, data]),
      create: (ref: {path: string}, data: any) => writes.push([ref.path, data]),
    });
    for (const [path, data] of writes) state.docs.set(path, data);
    return result;
  }}),
}));
import {completeTask} from './index.js';
const complete = completeTask as unknown as (request: any) => Promise<any>;
const request = (expectedVersion = 2) => ({auth: {uid: 'alice'}, data: {
  taskId: 'cms-task', idempotencyKey: 'request-one', expectedVersion,
  location: {latitude: 25, longitude: 121, accuracy: 5, observedAt: new Date().toISOString()},
}});
beforeEach(() => {
  state.docs.clear();
  state.docs.set('tasks/cms-task', {enabled: true, cmsVersion: 2, title: '單期每日任務', description: '',
    areaId: 'banqiao', cadence: 'daily', startsAt: {toMillis: () => Date.now() - 60000}, endsAt: {toMillis: () => Date.now() + 60000},
    destination: {id: 'cms-task', name: '廣場', latitude: 25, longitude: 121}, reward: {type: 'waterDrops', amount: 3}});
});
describe('CMS task completion boundary', () => {
  it('rejects a task disabled after it was loaded', async () => {
    state.docs.get('tasks/cms-task').enabled = false;
    await expect(complete(request())).rejects.toMatchObject({code: 'failed-precondition'});
    expect(state.docs.has('users/alice/ledger/request-one')).toBe(false);
  });
  it('requires renewed confirmation after publication changes', async () => {
    await expect(complete(request(1))).rejects.toThrow('任務設定已更新');
    expect(state.docs.has('users/alice/ledger/request-one')).toBe(false);
  });
  it('snapshots the completed task and awards once across a retry', async () => {
    const result = await complete(request());
    expect(result.inventory.waterDrops).toBe(3);
    expect(state.docs.get('users/alice/taskCompletions/cms-task').taskSnapshot).toMatchObject({title: '單期每日任務', reward: {amount: 3}});
    state.docs.get('tasks/cms-task').enabled = false;
    const repeated = await complete(request());
    expect(repeated).toEqual(result);
    expect(state.docs.get('users/alice/inventory/current').waterDrops).toBe(3);
  });
});
