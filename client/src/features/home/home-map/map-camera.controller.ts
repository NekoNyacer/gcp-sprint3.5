import { computed, Injectable, signal } from '@angular/core';
import { GeoPoint } from '../../../shared/models/geo.models';

export type MapCameraIntent =
  | { kind: 'player'; position: GeoPoint }
  | { kind: 'follow-player'; position: GeoPoint & { heading?: number } }
  | { kind: 'planning-overview'; position: GeoPoint }
  | {
      kind: 'recommendations-overview';
      player: GeoPoint;
      trees: readonly GeoPoint[];
      visibleArea?: { top: number; bottom: number };
    }
  | {
      kind: 'route-overview';
      player: GeoPoint;
      destination: GeoPoint;
      route: readonly GeoPoint[];
      visibleArea?: { top: number; bottom: number };
    };

export interface MapCameraAdapter {
  applyCameraIntent(intent: MapCameraIntent): void;
}

export function getRouteCameraPadding(
  height: number,
  mapTop: number,
  visibleArea?: { top: number; bottom: number },
): { top: number; bottom: number; left: number; right: number } | null {
  if (height <= 0) return null;
  const top = visibleArea ? Math.max(0, visibleArea.top - mapTop) + 64 : Math.round(height * 0.18);
  const bottom = visibleArea
    ? Math.max(0, mapTop + height - visibleArea.bottom) + 24
    : Math.round(height * 0.42);
  if (top + bottom >= height) return null;
  return { top, bottom, left: 24, right: 24 };
}

@Injectable()
export class MapCameraController {
  private adapter: MapCameraAdapter | null = null;
  private latestIntent: MapCameraIntent | null = null;
  private readonly playerCenterOffset = signal<number | null>(null);
  private readonly followingPlayer = signal(false);
  readonly isFollowingPlayer = this.followingPlayer.asReadonly();
  readonly isPlayerCentered = computed(() => {
    const offset = this.playerCenterOffset();
    return offset !== null && Number.isFinite(offset) && offset >= 0 && offset <= 8;
  });

  reportPlayerCenterOffset(adapter: MapCameraAdapter, offsetPixels: number | null): void {
    if (this.adapter === adapter) {
      this.playerCenterOffset.set(offsetPixels);
    }
  }

  request(intent: MapCameraIntent): void {
    this.latestIntent = intent;
    this.followingPlayer.set(intent.kind === 'follow-player');
    this.adapter?.applyCameraIntent(intent);
  }

  stopFollowing(adapter: MapCameraAdapter): void {
    if (this.adapter !== adapter) return;
    this.followingPlayer.set(false);
    if (this.latestIntent?.kind === 'follow-player') {
      this.latestIntent = null;
    }
  }

  attach(adapter: MapCameraAdapter): void {
    this.playerCenterOffset.set(null);
    this.adapter = adapter;
    if (this.latestIntent) {
      adapter.applyCameraIntent(this.latestIntent);
    }
  }

  detach(adapter: MapCameraAdapter): void {
    if (this.adapter === adapter) {
      this.stopFollowing(adapter);
      this.adapter = null;
      this.playerCenterOffset.set(null);
    }
  }
}
