import { inject, InjectionToken, Service } from '@angular/core';
import { getMapboxAccessToken } from '../../app/mapbox-runtime-config';
import { GeoPoint } from '../models/geo.models';

export type WalkingDirections = {
  coordinates: readonly GeoPoint[];
  distanceMeters: number;
  durationSeconds?: number;
  waypoints: readonly GeoPoint[];
};

export const MAPBOX_DIRECTIONS_TOKEN = new InjectionToken<string>(
  'Mapbox Directions public token',
  {
    providedIn: 'root',
    factory: getMapboxAccessToken,
  },
);

@Service()
export class MapboxDirectionsService {
  private readonly token = inject(MAPBOX_DIRECTIONS_TOKEN);
  async walking(points: readonly GeoPoint[], signal: AbortSignal): Promise<WalkingDirections> {
    if (points.length < 2 || !points.every(validPoint)) {
      throw new Error('步行路線需要至少 2 個有效座標。');
    }
    // Directions accepts 25 coordinates per request. Overlap each batch at its
    // final waypoint so any number of recommended stops forms one continuous walk.
    if (points.length > 25) {
      const parts: WalkingDirections[] = [];
      for (let start = 0; start < points.length - 1; start += 24) {
        signal.throwIfAborted();
        parts.push(await this.walking(points.slice(start, start + 25), signal));
      }
      return {
        coordinates: parts.flatMap((part, i) => i ? part.coordinates.slice(1) : part.coordinates),
        waypoints: parts.flatMap((part, i) => i ? part.waypoints.slice(1) : part.waypoints),
        distanceMeters: parts.reduce((sum, part) => sum + part.distanceMeters, 0),
        durationSeconds: parts.reduce((sum, part) => sum + (part.durationSeconds ?? part.distanceMeters / 1.25), 0),
      };
    }
    const token = this.token;
    if (!token) throw new Error('尚未設定 Mapbox public token，無法取得步行路線。');
    const coordinates = points.map((point) => `${point.longitude},${point.latitude}`).join(';');
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('steps', 'false');
    url.searchParams.set('alternatives', 'false');
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new Error('Mapbox 路線請求逾時，請稍後重試。');
      }
      if (error instanceof TypeError) {
        throw new Error('無法連線到 Mapbox 路線服務，請檢查網路後重試。');
      }
      throw error;
    }
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'Mapbox 路線服務授權失敗，請檢查 token 與網域限制。'
          : response.status === 429
            ? 'Mapbox 路線請求過於頻繁，請稍後重試。'
            : `Mapbox 路線服務暫時無法使用（HTTP ${response.status}）。`,
      );
    }
    const data: unknown = await response.json();
    if (!isRecord(data) || data['code'] !== 'Ok') {
      throw new Error(
        isRecord(data) && (data['code'] === 'NoRoute' || data['code'] === 'NoSegment')
          ? '目前找不到可步行的路線，請重新選擇目的地。'
          : 'Mapbox 未能提供有效的步行路線。',
      );
    }
    const routes = data['routes'];
    const waypoints = data['waypoints'];
    const route: unknown = Array.isArray(routes) ? routes[0] : undefined;
    const geometry = isRecord(route) ? route['geometry'] : undefined;
    if (
      !isRecord(route) ||
      typeof route['distance'] !== 'number' ||
      !Number.isFinite(route['distance']) ||
      route['distance'] < 0 ||
      !isRecord(geometry) ||
      geometry['type'] !== 'LineString' ||
      !Array.isArray(geometry['coordinates']) ||
      geometry['coordinates'].length < 2 ||
      !Array.isArray(waypoints) ||
      waypoints.length !== points.length
    ) {
      throw new Error('Mapbox 回傳的路線資料格式不完整。');
    }
    return {
      coordinates: geometry['coordinates'].map(readCoordinate),
      distanceMeters: route['distance'],
      durationSeconds: typeof route['duration'] === 'number' && Number.isFinite(route['duration']) && route['duration'] >= 0
        ? route['duration'] : route['distance'] / 1.25,
      waypoints: waypoints.map((waypoint: unknown) => {
        if (!isRecord(waypoint)) throw new Error('Mapbox 回傳的途經點格式不正確。');
        return readCoordinate(waypoint['location']);
      }),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180 &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90
  );
}

function readCoordinate(value: unknown): GeoPoint {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number'
  ) {
    throw new Error('Mapbox 回傳的路線座標不正確。');
  }
  const point = { longitude: value[0], latitude: value[1] };
  if (!validPoint(point)) throw new Error('Mapbox 回傳的路線座標超出有效範圍。');
  return point;
}
