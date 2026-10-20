import { GeoPoint } from './geo.models';
import { haversineDistanceMeters } from './geo-distance';
import { distanceToRouteMeters, routeDistanceMeters } from './walk-route';
import { METERS_PER_WALK_STEP, supplyRewardLabel, WalkTaskPoint } from './walk-task.models';
import { demoSupplyStations } from '../../environments/environment-dev';

export function createDemoWalkTasks(route: readonly GeoPoint[]): readonly WalkTaskPoint[] {
  const length = routeDistanceMeters(route);
  if (length === 0) return [];

  return demoSupplyStations.map((station, taskIndex): WalkTaskPoint => {
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
    const fraction = remaining / segmentLength < 0.5 ? 0 : 1;
    const anchor = fraction === 0 ? start : end;
    const distance = (estimatedExtraSteps * METERS_PER_WALK_STEP) / 2;
    const positions = Array.from({ length: 16 }, (_, index) =>
      offsetPoint(anchor, distance, (index * Math.PI) / 8 + taskIndex * Math.PI * 0.4),
    );
    const waterPosition = positions.find(
      (point) => distanceToRouteMeters(point, route) >= distance * 0.85,
    );
    positions.sort(
      (left, right) => distanceToRouteMeters(right, route) - distanceToRouteMeters(left, route),
    );
    const fertilizer = kind === 'fertilizer';
    return {
      id,
      name,
      supplyStation,
      weather,
      timeOfDay,
      kind,
      description: `Demo：${fertilizer ? '最遠挑戰，' : ''}約增加 ${estimatedExtraSteps} 步；靠近打卡可領取 ${supplyRewardLabel(supplyStation.supply)}，本次散步限領一次。`,
      position: !fertilizer && waterPosition ? waterPosition : positions[0],
      routeStop: { position: anchor, segmentIndex, fraction },
      estimatedExtraSteps,
      isDemo: true,
    };
  });
}

function offsetPoint(origin: GeoPoint, meters: number, bearing: number): GeoPoint {
  const radians = Math.PI / 180;
  const latitude = origin.latitude * radians;
  const longitude = origin.longitude * radians;
  const angle = meters / 6_371_000;
  const targetLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angle) + Math.cos(latitude) * Math.sin(angle) * Math.cos(bearing),
  );
  const targetLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angle) * Math.cos(latitude),
      Math.cos(angle) - Math.sin(latitude) * Math.sin(targetLatitude),
    );
  return { latitude: targetLatitude / radians, longitude: targetLongitude / radians };
}
