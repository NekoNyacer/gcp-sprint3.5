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

/** Only used on model failure. Gemini retains control of its own selection count. */
export function distributedSupplyFallback(candidates: Merchant[], route: readonly Point[], walkingDistance: number): Selection[] {
  const count = Math.min(candidates.length, Math.max(1, Math.ceil(walkingDistance / 1500)));
  const remaining = candidates.map(merchant => ({merchant, ...routePlacement(merchant, route)}));
  const selected: typeof remaining = [];
  for (let i = 0; i < count; i++) {
    const target = count === 1 ? 0.5 : i / (count - 1);
    remaining.sort((a, b) =>
      Math.abs(a.routeFraction - target) * walkingDistance + a.distanceMeters * 0.25 -
      (Math.abs(b.routeFraction - target) * walkingDistance + b.distanceMeters * 0.25) ||
      a.merchant.id.localeCompare(b.merchant.id));
    selected.push(remaining.shift()!);
  }
  return selected.sort((a, b) => a.alongRouteMeters - b.alongRouteMeters).map(({merchant}) => ({
    merchantId: merchant.id, role: 'supply',
    reason: '依整段路程分散安排沿途補給；實際步行與繞路仍由地圖服務驗證。',
  }));
}
