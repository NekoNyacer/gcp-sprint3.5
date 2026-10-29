import { GeoPoint } from './geo.models';
import { haversineDistanceMeters } from './geo-distance';
import { WalkRoutePoint } from './walk-task.models';

export function distanceToRouteMeters(point: GeoPoint, route: readonly GeoPoint[]): number {
  return projectPointOnRoute(point, route)?.distanceMeters ?? Infinity;
}

export function projectPointOnRoute(
  point: GeoPoint,
  route: readonly GeoPoint[],
): (WalkRoutePoint['routeStop'] & { distanceMeters: number }) | null {
  const radians = Math.PI / 180;
  const metersPerDegree = 6_371_000 * radians;
  const longitudeScale = metersPerDegree * Math.cos(point.latitude * radians);
  let closest: (WalkRoutePoint['routeStop'] & { distanceMeters: number }) | null = null;
  for (let index = 1; index < route.length; index++) {
    const start = route[index - 1];
    const end = route[index];
    const x = (end.longitude - start.longitude) * longitudeScale;
    const y = (end.latitude - start.latitude) * metersPerDegree;
    const lengthSquared = x * x + y * y;
    if (lengthSquared === 0) continue;
    const px = (point.longitude - start.longitude) * longitudeScale;
    const py = (point.latitude - start.latitude) * metersPerDegree;
    const projection = (px * x + py * y) / lengthSquared;
    const clamped = Math.min(1, Math.max(0, projection));
    const distance = Math.hypot(px - clamped * x, py - clamped * y);
    if (!closest || distance < closest.distanceMeters) {
      closest = {
        distanceMeters: distance,
        position: {
          longitude: start.longitude + (end.longitude - start.longitude) * clamped,
          latitude: start.latitude + (end.latitude - start.latitude) * clamped,
        },
        segmentIndex: index,
        fraction: clamped,
      };
    }
  }
  return closest;
}

export function routeDistanceMeters(route: readonly GeoPoint[]): number {
  return route.reduce(
    (distance, point, index) =>
      distance + (index > 0 ? haversineDistanceMeters(route[index - 1], point) : 0),
    0,
  );
}

export function walkingTaskWaypoints(
  origin: GeoPoint,
  destination: GeoPoint,
  tasks: readonly WalkRoutePoint[],
): readonly GeoPoint[] {
  return [
    origin,
    ...tasks
      .slice()
      .sort(
        (left, right) =>
          left.routeStop.segmentIndex - right.routeStop.segmentIndex ||
          left.routeStop.fraction - right.routeStop.fraction ||
          left.id.localeCompare(right.id),
      )
      .map((task) => task.position),
    destination,
  ];
}
