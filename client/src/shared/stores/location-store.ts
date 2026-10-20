import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { GeoPoint } from '../models/geo.models';
import { DEMO_WALKING_SPEED_METERS_PER_SECOND, settings } from '../../environments/environment-dev';

const initialState: LocationState = {
  current: {
    //google板橋辦公室: 25.001001886332944, 121.45475418388244
    //西湖捷運站: 25.082,121.567
    latitude: 25.001001886332944,
    longitude: 121.45475418388244,
    accuracy: 0,
    observedAt: new Date(),
  },
  permission: 'unknown',
  source: null,
  error: null,
};

export const LocationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isInTargetRadius: computed(() => true),
  })),
  withMethods((store) => ({
    moveDemoBy: (
      latitudeDirection: number,
      longitudeDirection: number,
      elapsedSeconds: number,
      facingHeading?: number,
    ) => {
      const current = store.current();
      if (!current || !Number.isFinite(elapsedSeconds)) {
        return;
      }

      const elapsed = Math.min(Math.max(elapsedSeconds, 0), 0.1);
      if (
        elapsed === 0 ||
        (latitudeDirection === 0 &&
          longitudeDirection === 0 &&
          (facingHeading === undefined || facingHeading === current.heading)) ||
        !Number.isFinite(latitudeDirection) ||
        !Number.isFinite(longitudeDirection) ||
        (facingHeading !== undefined && !Number.isFinite(facingHeading))
      ) {
        return;
      }

      const latitudeDelta =
        (latitudeDirection * DEMO_WALKING_SPEED_METERS_PER_SECOND * elapsed) /
        METERS_PER_LATITUDE_DEGREE;
      const longitudeDelta =
        (longitudeDirection * DEMO_WALKING_SPEED_METERS_PER_SECOND * elapsed) /
        METERS_PER_LONGITUDE_DEGREE;
      const targetHeading =
        facingHeading !== undefined
          ? ((facingHeading % 360) + 360) % 360
          : ((Math.atan2(longitudeDirection, latitudeDirection) * 180) / Math.PI + 360) % 360;
      const previousHeading = current.heading;
      let heading = targetHeading;
      if (
        facingHeading === undefined &&
        typeof previousHeading === 'number' &&
        Number.isFinite(previousHeading)
      ) {
        // Exponential damping is frame-rate independent and turns along the shortest arc.
        const difference = ((targetHeading - previousHeading + 540) % 360) - 180;
        const blend = -Math.expm1(-elapsed / DEMO_HEADING_DAMPING_SECONDS);
        heading = (previousHeading + difference * blend + 360) % 360;
      }

      patchState(store, {
        source: 'demo',
        current: {
          ...current,
          latitude: current.latitude + latitudeDelta,
          longitude: current.longitude + longitudeDelta,
          heading,
          accuracy: 5,
          observedAt: new Date(),
        },
      });
    },
    startTracking: () => {},
    stopTracking: () => {},
    refreshCurrentPosition: () => {},
    distanceTo: (target: string) => {},
    createEvidenceSnapshot: () => {},
    reset: () => {},
  })),
);

const METERS_PER_LATITUDE_DEGREE = 111_320;
const METERS_PER_LONGITUDE_DEGREE = 100_700;
const DEMO_HEADING_DAMPING_SECONDS = 0.25;

export type LocationState = {
  current: LocationPoint | null;
  permission: 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';
  source: 'gps' | 'demo' | null;
  error: string | null;
};

export interface LocationPoint extends GeoPoint {
  accuracy: number;
  observedAt: Date;
  heading?: number;
  speedMps?: number;
}
