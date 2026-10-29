import { TestBed } from '@angular/core/testing';
import { cmsPublication, cmsRetainedTrees, cmsRouteRoles } from './cms-publication';
import {
  currentHomeTrees,
  findHomeTree,
  homeTrees,
  homeTreesWithProgress,
} from '../../features/home/home-tree-recommendations';
import { ProgressStore } from '../stores/progress-store';
import { createDemoWalkTasks } from './demo-walk-tasks';
import type { CmsConfig } from '../../../../functions/src/cms-domain';
const config = (): CmsConfig => ({
  harvestPoints: 80,
  species: ['榕樹'],
  scenes: [],
  rewards: [],
  trees: [],
  merchants: [
    {
      id: 'test-shop',
      name: '測試商家',
      address: '模擬位置',
      latitude: 25.0134,
      longitude: 121.4628,
      category: '美食',
      twqr: true,
      enabled: true,
      roles: ['planting', 'supply'],
      offer: '模擬優惠',
      terms: 'Demo',
      validUntil: '2099-12-31',
      resource: 'water',
      amount: 10,
      weather: 'sunny',
      timeOfDay: 'day',
    },
  ],
});
describe('Published CMS configuration in the walking client', () => {
  afterEach(() => {
    cmsPublication.set({ config: null, version: 0, managed: false });
    cmsRetainedTrees.set([]);
    cmsRouteRoles.set(null);
    TestBed.resetTestingModule();
  });
  it('preserves fixture fallback until a release exists', () => {
    expect(currentHomeTrees()).toEqual(homeTrees);
  });
  it('shows newly published merchants and live offers without rewriting player progress', () => {
    const c = config();
    cmsPublication.set({ config: c, version: 1, managed: true });
    const store = TestBed.inject(ProgressStore);
    store.ensureCmsTrees(currentHomeTrees(), true);
    expect(findHomeTree('merchant-test-shop')?.nickName).toBe('測試商家');
    const site = store.demoTrees()['merchant-test-shop'];
    expect(site.planted).toBe(false);
    const route = [
      { latitude: 25.012, longitude: 121.46 },
      { latitude: 25.015, longitude: 121.465 },
    ];
    expect(createDemoWalkTasks(route)).toEqual([]);
    cmsRouteRoles.set([{merchantId: 'test-shop', role: 'supply', reason: '已確認終點後的推薦'}]);
    expect(createDemoWalkTasks(route)[0].supplyStation.offer).toBe('模擬優惠');
    c.merchants[0].offer = '更新優惠';
    cmsPublication.set({ config: structuredClone(c), version: 2, managed: true });
    expect(createDemoWalkTasks(route)[0].supplyStation.offer).toBe('更新優惠');
    store.ensureCmsTrees(currentHomeTrees(), true);
    expect(store.demoTrees()['merchant-test-shop'].growth).toBe(site.growth);
  });
  it('retains a planted site when its merchant is reassigned or unpublished', () => {
    cmsPublication.set({ config: config(), version: 1, managed: true });
    const tree = currentHomeTrees()[0];
    cmsRetainedTrees.set([tree]);
    cmsRouteRoles.set([{ merchantId: 'test-shop', role: 'supply', reason: 'demo' }]);
    expect(findHomeTree(tree.id)?.position).toEqual(tree.position);
    cmsPublication.set({ config: null, version: 2, managed: true });
    expect(findHomeTree(tree.id)).toEqual(tree);
  });
  it('applies only permitted per-route roles and keeps disappeared supply stations out of new choices', () => {
    cmsPublication.set({ config: config(), version: 1, managed: true });
    cmsRouteRoles.set([{ merchantId: 'test-shop', role: 'planting', reason: 'demo' }]);
    const route = [
      { latitude: 25.012, longitude: 121.46 },
      { latitude: 25.015, longitude: 121.465 },
    ];
    expect(createDemoWalkTasks(route)).toHaveLength(0);
    cmsRouteRoles.set([{ merchantId: 'test-shop', role: 'supply', reason: 'demo' }]);
    expect(currentHomeTrees()).toHaveLength(1);
    expect(createDemoWalkTasks(route)).toHaveLength(1);
    const c = config();
    c.merchants[0].enabled = false;
    cmsPublication.set({ config: c, version: 2, managed: true });
    expect(createDemoWalkTasks(route)).toHaveLength(0);
  });
  it('does not crash when a new site arrives before its personal progress is initialized', () => {
    cmsPublication.set({ config: config(), version: 1, managed: true });
    expect(homeTreesWithProgress({})).toEqual([]);
  });
});
