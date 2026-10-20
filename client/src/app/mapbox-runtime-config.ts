import { settings } from '../environments/environment-dev';
import { mapboxAccessToken } from './mapbox-config';

export interface CatWalkRuntimeConfig {
  mapboxAccessToken?: string;
}

declare global {
  interface Window {
    __CAT_WALK_RUNTIME_CONFIG__?: CatWalkRuntimeConfig;
  }
}

/**
 * Reads the browser-only Mapbox public token generated for the current deploy.
 * A Mapbox public token is intentionally visible in the browser, but it must
 * be scoped and restricted to the deployed origins in Mapbox Console.
 */
export function getMapboxAccessToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  if (settings.isDev) {
    return mapboxAccessToken;
  }

  return window.__CAT_WALK_RUNTIME_CONFIG__?.mapboxAccessToken?.trim() ?? '';
}
