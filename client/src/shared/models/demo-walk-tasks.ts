import { GeoPoint } from './geo.models';
import { haversineDistanceMeters } from './geo-distance';
import { routeDistanceMeters, projectPointOnRoute } from './walk-route';
import { cmsPublication, cmsRouteRoles } from './cms-publication';
import { METERS_PER_WALK_STEP, supplyRewardLabel, WalkTaskPoint } from './walk-task.models';
import { demoSupplyStations } from '../../environments/environment-dev';

export function createDemoWalkTasks(route: readonly GeoPoint[]): readonly WalkTaskPoint[] {
  const length = routeDistanceMeters(route);
  if (length === 0) return [];

  const publication = cmsPublication();
  if (publication.managed) {
    const roles = cmsRouteRoles();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return (publication.config?.merchants ?? []).filter(m => m.enabled && m.roles.includes('supply') && m.validUntil >= today &&
      roles?.some(s => s.merchantId === m.id && s.role === 'supply')).flatMap(m => {
      const position = { latitude: m.latitude, longitude: m.longitude };
      const projection = projectPointOnRoute(position, route);
      if (!projection) return [];
      return [{ id: m.id, name: m.name, kind: m.resource, position,
        weather: m.weather, timeOfDay: m.timeOfDay,
        supplyStation: { category: m.category, isCathayTwqrMerchant: m.twqr, offer: m.offer, terms: m.terms,
          validUntil: m.validUntil, supply: { resource: m.resource, amount: m.amount } },
        routeStop: { position: projection.position, segmentIndex: projection.segmentIndex, fraction: projection.fraction },
        estimatedExtraSteps: Math.round(haversineDistanceMeters(projection.position, position) * 2 / METERS_PER_WALK_STEP),
        isDemo: true as const, description: 'Demo 固定商家站點；繞路步數待道路路線驗證。' }];
    });
  }

  return demoSupplyStations.map((station): WalkTaskPoint => {
    const {
      id,
      name,
      kind,
      routeFraction,
      estimatedExtraSteps,
      weather,
      timeOfDay,
      ...supplyStation
    } = station;
    let remaining = length * routeFraction;
    let segmentIndex = 1;
    for (; segmentIndex < route.length - 1; segmentIndex++) {
      const segmentLength = haversineDistanceMeters(route[segmentIndex - 1], route[segmentIndex]);
      if (segmentLength > 0 && remaining <= segmentLength) break;
      remaining -= segmentLength;
    }
    const start = route[segmentIndex - 1];
    const end = route[segmentIndex];
    const segmentLength = haversineDistanceMeters(start, end);
    const fraction = segmentLength > 0 ? Math.max(0, Math.min(1, remaining / segmentLength)) : 0;
    const anchor = {
      longitude: start.longitude + (end.longitude - start.longitude) * fraction,
      latitude: start.latitude + (end.latitude - start.latitude) * fraction,
    };
    return {
      id,
      name,
      supplyStation,
      weather,
      timeOfDay,
      kind,
      description: `Demo 沿途補給；靠近打卡可領取 ${supplyRewardLabel(supplyStation.supply)}，每站每日限領一次。`,
      position: anchor,
      routeStop: { position: anchor, segmentIndex, fraction },
      estimatedExtraSteps: 0,
      isDemo: true,
    };
  });
}
