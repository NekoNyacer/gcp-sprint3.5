import { GeoPoint } from './geo.models';

export function isValidGeoPoint(point: GeoPoint | null): point is GeoPoint {
  return (
    point !== null &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}

export function isWithinGeoRadius(
  origin: GeoPoint | null,
  target: GeoPoint,
  radius: number,
): boolean {
  // Account for sub-micrometre rounding at the inclusive distance boundary.
  return (
    isValidGeoPoint(origin) &&
    isValidGeoPoint(target) &&
    Number.isFinite(radius) &&
    radius >= 0 &&
    haversineDistanceMeters(origin, target) <= radius + 1e-7
  );
}

export function haversineDistanceMeters(origin: GeoPoint, destination: GeoPoint): number {
  const radians = Math.PI / 180;
  const haversine =
    Math.sin(((destination.latitude - origin.latitude) * radians) / 2) ** 2 +
    Math.cos(origin.latitude * radians) *
      Math.cos(destination.latitude * radians) *
      Math.sin(((destination.longitude - origin.longitude) * radians) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
