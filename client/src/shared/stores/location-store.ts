import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { LngLat } from 'mapbox-gl';

const initialState: LocationState = {
  current: {
    //google板橋辦公室: 25.001001886332944, 121.45475418388244
    //西湖捷運站: 25.082,121.567
    latitude: 25.001001886332944,
    longitude: 121.45475418388244,
    accuracy: 0,
    observedAt: new Date(),
  },
  status: '行走中',
  permission: 'unknown',
  source: null,
  error: null,
  walk: {
    status: 'idle',
    routeId: null,
    startedAt: null,
    distanceMeters: 0,
    progress: 0,
    currentWaypointId: null,
  },
  destination: null,
};

export const LocationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({})),
  withComputed((store) => ({
    isInTargetRadius: computed(() => true),
    hasDestination: computed(() => !!store.destination()),
  })),
  withMethods((store) => ({
    moveDemoBy: (latitudeDirection: number, longitudeDirection: number, elapsedSeconds: number) => {
      const current = store.current();
      if (!current || !Number.isFinite(elapsedSeconds)) {
        return;
      }

      const elapsed = Math.min(Math.max(elapsedSeconds, 0), 0.1);
      if (
        elapsed === 0 ||
        (latitudeDirection === 0 && longitudeDirection === 0) ||
        !Number.isFinite(latitudeDirection) ||
        !Number.isFinite(longitudeDirection)
      ) {
        return;
      }

      const latitudeDelta =
        (latitudeDirection * DEMO_WALKING_SPEED_METERS_PER_SECOND * elapsed) /
        METERS_PER_LATITUDE_DEGREE;
      const longitudeDelta =
        (longitudeDirection * DEMO_WALKING_SPEED_METERS_PER_SECOND * elapsed) /
        METERS_PER_LONGITUDE_DEGREE;

      patchState(store, {
        source: 'demo',
        current: {
          ...current,
          latitude: current.latitude + latitudeDelta,
          longitude: current.longitude + longitudeDelta,
          accuracy: 5,
          observedAt: new Date(),
        },
      });
    },
    start: () => {
      patchState(store, { status: '選擇目的地中' });
    },
    setDestination: (destination: LngLat[]) => {
      patchState(store, { destination });
    },
    removeDestination: () => {
      patchState(store, { destination: null });
    },
    go: () => {
      patchState(store, { status: '行走中' });
    },
    startTracking: () => {},
    stopTracking: () => {},
    refreshCurrentPosition: () => {},
    startWalk: (routeId: string) => {
      patchState(store, { status: '行走中' });
    },
    cancelWalk: () => {
      patchState(store, { status: '閒置中' });
    },
    setDemoProgress: (progress: string) => {},
    distanceTo: (target: string) => {},
    createEvidenceSnapshot: () => {},
    reset: () => {},
  })),
  withHooks({
    onInit(store) {},
  }),
);

const DEMO_WALKING_SPEED_METERS_PER_SECOND = 1.5;
const METERS_PER_LATITUDE_DEGREE = 111_320;
const METERS_PER_LONGITUDE_DEGREE = 100_700;

export type LocationState = {
  current: LocationPoint | null;
  status: '閒置中' | '選擇目的地中' | '行走中' | '抵達目的地';
  permission: 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';
  source: 'gps' | 'demo' | null;
  error: string | null;
  destination: LngLat[] | null;
  walk: {
    status: 'idle' | 'active' | 'paused';
    routeId: string | null;
    startedAt: Date | null;
    distanceMeters: number;
    progress: number; // 0 ~ 1
    currentWaypointId: string | null;
  };
};

export type LocationPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  observedAt: Date;
  heading?: number;
  speedMps?: number;
};
