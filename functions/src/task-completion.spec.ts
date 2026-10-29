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
    state.docs.set('users/alice/taskQualifications/cms-task', {cmsVersion:2,readyAt:new Date(),calculatedDistanceMeters:0});
    const result = await complete(request());
    expect(result.inventory.waterDrops).toBe(3);
    expect(state.docs.get('users/alice/taskCompletions/cms-task').taskSnapshot).toMatchObject({title: '單期每日任務', reward: {amount: 3}});
    state.docs.get('tasks/cms-task').enabled = false;
    const repeated = await complete(request());
    expect(repeated).toEqual(result);
    expect(state.docs.get('users/alice/inventory/current').waterDrops).toBe(3);
  });
  it('requires both eligible route steps and fresh proximity before saving ready without a reward', async () => {
    const req=request(); req.data={...req.data,action:'qualify'} as typeof req.data;
    state.docs.set('users/alice/progress/current',{state:{totalTaskWalkingSteps:999,taskWalkingDays:{'2026-10-28':999}}});
    await expect(complete(req)).rejects.toThrow('路線步數尚未達標');
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    state.docs.set('users/alice/progress/current',{state:{totalTaskWalkingSteps:1000,taskWalkingDays:{[day]:1000}}});
    await expect(complete(req)).resolves.toMatchObject({ready:true});
    expect(state.docs.has('users/alice/taskQualifications/cms-task')).toBe(true);
    expect(state.docs.has('users/alice/inventory/current')).toBe(false);
    expect(state.docs.has('users/alice/ledger/request-one')).toBe(false);
  });
  it.each([-31000,6000,NaN])('rejects stale, future and malformed location observations (%s)',async offset=>{
    const req=request();
    const observedAt=Number.isNaN(offset)?'invalid':new Date(Date.now()+offset).toISOString();
    await expect(complete({...req,data:{...req.data,action:'qualify',location:{...req.data.location,observedAt}}})).rejects.toThrow('位置已過期');
    expect(state.docs.has('users/alice/taskQualifications/cms-task')).toBe(false);
  });
  it('rejects a direct claim without saved qualification',async()=>{
    await expect(complete(request())).rejects.toThrow('任務尚未達標');
    expect(state.docs.has('users/alice/inventory/current')).toBe(false);
  });
  it('allows claiming away from the location but blocks claims at the deadline',async()=>{
    state.docs.set('users/alice/taskQualifications/cms-task',{cmsVersion:2,readyAt:new Date()});
    const req=request();
    await expect(complete({...req,data:{...req.data,location:undefined}})).resolves.toMatchObject({inventory:{waterDrops:3}});
    state.docs.delete('users/alice/commands/request-one');state.docs.delete('users/alice/taskCompletions/cms-task');
    state.docs.get('tasks/cms-task').endsAt={toMillis:()=>Date.now()};
    await expect(complete(req)).rejects.toThrow('已過期');
  });
  it('binds an idempotency key to the task and action',async()=>{
    state.docs.set('users/alice/commands/request-one',{command:'completeTask',taskId:'other',action:'claim',result:{}});
    await expect(complete(request())).rejects.toThrow('識別碼已用於其他操作');
  });
  it('freezes the event step baseline on the first enrollment',async()=>{
    state.docs.get('tasks/cms-task').cadence='event';
    state.docs.set('users/alice/progress/current',{state:{totalTaskWalkingSteps:2000}});
    const req=request();
    await complete({...req,data:{...req.data,action:'join'}});
    expect(state.docs.get('users/alice/taskEnrollments/cms-task').joinedBaseline).toBe(2000);
    state.docs.get('users/alice/progress/current').state.totalTaskWalkingSteps=4000;
    await complete({...req,data:{...req.data,action:'join',idempotencyKey:'another-join'}});
    expect(state.docs.get('users/alice/taskEnrollments/cms-task').joinedBaseline).toBe(2000);
  });
  it('atomically awards a seed with provenance and preserves unrelated resources',async()=>{
    state.docs.get('tasks/cms-task').reward={type:'seeds',amount:1};
    state.docs.set('users/alice/taskQualifications/cms-task',{cmsVersion:2,readyAt:new Date()});
    state.docs.set('users/alice/inventory/current',{lightEnergy:500,waterDrops:777,fertilizer:5,seeds:1});
    state.docs.set('users/alice/progress/current',{revision:4,state:{mysterySeeds:[]}});
    const result=await complete(request());
    expect(result.inventory).toEqual({lightEnergy:500,waterDrops:777,fertilizer:5,seeds:2});
    expect(result.mysterySeeds).toMatchObject([{origin:{routeId:'task:cms-task',place:'廣場'}}]);
    expect(state.docs.get('users/alice/progress/current').state.mysterySeeds).toEqual(result.mysterySeeds);
    expect(result.progressRevision).toBe(5);
    await complete(request());
    expect(state.docs.get('users/alice/inventory/current').seeds).toBe(2);
  });
});
