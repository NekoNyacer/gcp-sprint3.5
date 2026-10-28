import type { Merchant, Selection } from './cms-domain.js';
export type Point = {latitude: number; longitude: number};
export function validPoint(value: unknown): value is Point {
  const p = value as Point | null;
  return !!p && typeof p.latitude === 'number' && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    typeof p.longitude === 'number' && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
}
export function distanceMeters(a: Point, b: Point): number {
  const r = Math.PI / 180;
  const h = Math.sin((a.latitude - b.latitude) * r / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin((a.longitude - b.longitude) * r / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function routePlacement(point: Point, route: readonly Point[]) {
  const sx = 111320 * Math.cos(point.latitude * Math.PI / 180), sy = 111320;
  let best = Infinity;
  let travelled = 0, alongRouteMeters = 0;
  for (let i = 1; i < route.length; i++) {
    const ax = (route[i - 1].longitude - point.longitude) * sx, ay = (route[i - 1].latitude - point.latitude) * sy;
    const bx = (route[i].longitude - point.longitude) * sx, by = (route[i].latitude - point.latitude) * sy;
    const dx = bx - ax, dy = by - ay;
    const t = dx * dx + dy * dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    const proximity = Math.hypot(ax + t * dx, ay + t * dy);
    const segmentLength = distanceMeters(route[i - 1], route[i]);
    if (proximity < best - 0.001) {
      best = proximity;
      alongRouteMeters = travelled + segmentLength * t;
    }
    travelled += segmentLength;
  }
  return {distanceMeters: best, alongRouteMeters, routeFraction: travelled ? alongRouteMeters / travelled : 0};
}
export function routeProximity(point: Point, route: readonly Point[]): number {
  return routePlacement(point, route).distanceMeters;
}
export function supplyCandidates(merchants: Merchant[], route: Point[], walkingDistance: number): Merchant[] {
  const corridor = Math.min(1800, Math.max(500, walkingDistance * 0.08));
  return merchants.filter(m => m.roles.includes('supply') && routeProximity(m, route) <= corridor)
    .sort((a, b) => routePlacement(a, route).alongRouteMeters - routePlacement(b, route).alongRouteMeters);
}

/** Keep the requested count where spaced candidates exist, without moving merchant coordinates. */
export function spreadSupplySelections(selections: Selection[], candidates: Merchant[], route: readonly Point[]): Selection[] {
  const count = Math.min(selections.length, candidates.length);
  if (!count) return [];
  const length = route.reduce((total, p, i) => total + (i ? distanceMeters(route[i - 1], p) : 0), 0);
  if (!length) return [];
  const minimumGap = Math.min(250, length / (count + 1) * 0.6);
  const preferred = new Map(selections.map(s => [s.merchantId, s]));
  const remaining = candidates.map(merchant => ({merchant, ...routePlacement(merchant, route)}));
  const selected: typeof remaining = [];
  for (let i = 0; i < count; i++) {
    const target = length * (i + 1) / (count + 1);
    const score = (p: typeof remaining[number]) => Math.abs(p.alongRouteMeters - target) + p.distanceMeters * 2;
    const spaced = remaining.filter(candidate => selected.every(other =>
      Math.abs(candidate.alongRouteMeters - other.alongRouteMeters) >= minimumGap &&
      distanceMeters(candidate.merchant, other.merchant) >= minimumGap));
    spaced.sort((a, b) => score(a) - score(b) ||
      Number(preferred.has(b.merchant.id)) - Number(preferred.has(a.merchant.id)) ||
      a.merchant.id.localeCompare(b.merchant.id));
    if (!spaced.length) break;
    const next = spaced[0];
    selected.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return selected.sort((a, b) => a.alongRouteMeters - b.alongRouteMeters).map(({merchant}) => preferred.get(merchant.id) ?? ({
    merchantId: merchant.id, role: 'supply',
    reason: '依整段路程分散安排沿途補給；實際步行與繞路仍由地圖服務驗證。',
  }));
}

/** Only used on model failure; successful Gemini output supplies its own requested count. */
export function distributedSupplyFallback(candidates: Merchant[], route: readonly Point[], walkingDistance: number): Selection[] {
  const count = Math.min(candidates.length, Math.max(1, Math.ceil(walkingDistance / 1500)));
  return spreadSupplySelections(candidates.slice(0, count).map(m => ({merchantId: m.id, role: 'supply',
    reason: '依整段路程分散安排沿途補給；實際步行與繞路仍由地圖服務驗證。'})), candidates, route);
}
