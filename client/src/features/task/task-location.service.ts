import { isDevMode, Service } from '@angular/core';
import { LocationEvidence, TaskDestination } from './task.models';

@Service()
export class TaskLocationService {
  canUseLocalTestLocation(): boolean {
    return isDevMode()
      && typeof globalThis.location !== 'undefined'
      && isLoopbackHostname(globalThis.location.hostname);
  }

  localTestLocationFor(destination: TaskDestination): LocationEvidence {
    return {
      latitude: destination.latitude,
      longitude: destination.longitude,
      accuracy: 5,
      observedAt: new Date(),
    };
  }

  async getCurrentLocation(): Promise<LocationEvidence> {
    if (!navigator.geolocation) {
      throw new Error('此裝置不支援定位功能');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          observedAt: new Date(position.timestamp),
        }),
        () => reject(new Error('無法取得定位，請確認定位權限與 GPS 設定')),
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 },
      );
    });
  }
}

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
