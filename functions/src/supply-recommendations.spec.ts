import { describe, expect, it } from 'vitest';
import type { Merchant } from './cms-domain.js';
import { distanceMeters, routePlacement, supplyCandidates, distributedSupplyFallback, spreadSupplySelections } from './supply-recommendations.js';
const origin = {latitude: 25.001, longitude: 121.4548};
const destination = {latitude: 25.082, longitude: 121.572};
const shop = (id: string, latitude: number, longitude: number, roles: Merchant['roles'] = ['supply']) =>
  ({id, latitude, longitude, roles}) as Merchant;
describe('destination-aware candidate corridor', () => {
  it('redistributes clustered AI selections across the walk while preserving its requested count', () => {
    const road = [{latitude: 25, longitude: 121.45}, {latitude: 25.04, longitude: 121.45}];
    const shops = [shop('cluster-a', 25.003, 121.45), shop('cluster-b', 25.0031, 121.45),
      shop('cluster-c', 25.0032, 121.45), shop('early', 25.01, 121.45),
      shop('middle', 25.02, 121.45), shop('late', 25.03, 121.45)];
    const selections = shops.slice(0, 3).map(m => ({merchantId: m.id, role: 'supply' as const, reason: 'AI'}));
    const before = structuredClone(shops);
    const spread = spreadSupplySelections(selections, shops, road);
    expect(spread.map(s => s.merchantId)).toEqual(['early', 'middle', 'late']);
    expect(spread).toHaveLength(selections.length);
    expect(shops).toEqual(before);
    expect(spreadSupplySelections([], shops, road)).toEqual([]);
  });

  it('does not pack multiple choices into a sparse cluster or invent merchants', () => {
    const road = [{latitude: 25, longitude: 121.45}, {latitude: 25.04, longitude: 121.45}];
    const shops = [shop('a', 25.02, 121.45), shop('b', 25.0201, 121.45), shop('c', 25.0202, 121.45)];
    const spread = distributedSupplyFallback(shops, road, 4500);
    expect(spread).toHaveLength(1);
    expect(shops.some(m => m.id === spread[0].merchantId)).toBe(true);
    expect(spreadSupplySelections(spread, shops, [road[0], road[0]])).toEqual([]);
  });

  it('prefers a shop on the road over one far to the side at the same progress', () => {
    const road = [{latitude: 25, longitude: 121.45}, {latitude: 25.04, longitude: 121.45}];
    const close = shop('on-road', 25.02, 121.45), distant = shop('off-road', 25.02, 121.455);
    expect(spreadSupplySelections([{merchantId: distant.id, role: 'supply', reason: 'AI'}], [distant, close], road)[0].merchantId).toBe(close.id);
  });

  it('measures progress along a bent road rather than ordering by direct origin distance', () => {
    const road = [{latitude: 25, longitude: 121.45}, {latitude: 25.03, longitude: 121.45},
      {latitude: 25.03, longitude: 121.48}, {latitude: 25, longitude: 121.48}];
    const start = shop('start', 25.005, 121.45), middle = shop('middle', 25.03, 121.465), end = shop('end', 25.001, 121.48);
    expect(routePlacement(start, road).routeFraction).toBeLessThan(0.1);
    expect(routePlacement(middle, road).routeFraction).toBeCloseTo(0.5, 1);
    expect(routePlacement(end, road).routeFraction).toBeGreaterThan(0.9);
    expect(supplyCandidates([end, start, middle], road, 9000).map(m => m.id)).toEqual(['start', 'middle', 'end']);
    expect(distributedSupplyFallback([], road, 9000)).toEqual([]);
    expect(distributedSupplyFallback([middle], road, 9000).map(s => s.merchantId)).toEqual(['middle']);
  });
  it('includes Neihu candidates beyond the old six-km origin radius on a long walk', () => {
    expect(distanceMeters(origin, destination)).toBeGreaterThan(6000);
    const nearby = shop('near-origin', 25.002, 121.455);
    const far = shop('near-destination', 25.082, 121.571);
    const offRoute = shop('off-route', 25.15, 121.51);
    const planting = shop('planting', 25.002, 121.455, ['planting']);
    expect(supplyCandidates([nearby, far, offRoute, planting], [origin, destination], 19000).map(s => s.id))
      .toEqual(expect.arrayContaining(['near-origin', 'near-destination']));
    expect(supplyCandidates([offRoute, planting], [origin, destination], 19000)).toEqual([]);
  });
  it('does not leak distant city stations into a short Banqiao walk or truncate seven candidates', () => {
    const shortEnd = {latitude: 25.012, longitude: 121.46};
    const shops = Array.from({length: 8}, (_, i) => shop(`shop-${i}`, 25.003 + i * 0.0005, 121.457));
    const matches = supplyCandidates([...shops, shop('neihu', destination.latitude, destination.longitude)], [origin, shortEnd], 1400);
    expect(matches).toHaveLength(8);
    expect(matches.some(s => s.id === 'neihu')).toBe(false);
  });
});
