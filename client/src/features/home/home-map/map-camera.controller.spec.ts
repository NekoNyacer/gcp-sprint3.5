import {
  getRouteCameraPadding,
  MapCameraAdapter,
  MapCameraController,
  MapCameraIntent,
} from './map-camera.controller';

describe('Route camera card clearance', () => {
  it('places the usable map edges just below the upper panel and above the lower panel', () => {
    const padding = getRouteCameraPadding(844, 0, { top: 180, bottom: 640 })!;
    expect(padding.top).toBe(244);
    expect(844 - padding.bottom).toBe(616);
    expect(padding.left).toBe(24);
    expect(padding.right).toBe(24);
  });

  it('uses actual card edges on compact screens and accounts for a map offset', () => {
    const padding = getRouteCameraPadding(600, 40, { top: 180, bottom: 500 })!;
    expect(40 + padding.top).toBe(244);
    expect(40 + 600 - padding.bottom).toBe(476);
  });

  it('retains existing padding outside the measured planning view', () => {
    expect(getRouteCameraPadding(800, 0)).toEqual({
      top: 144,
      bottom: 336,
      left: 24,
      right: 24,
    });
  });

  it('does not fit a camera into a hidden or fully obstructed map', () => {
    expect(getRouteCameraPadding(0, 0)).toBeNull();
    expect(getRouteCameraPadding(600, 0, { top: 300, bottom: 350 })).toBeNull();
  });
});

describe('MapCameraController', () => {
  it('enables following before map readiness and replays the follow request on attach', () => {
    const controller = new MapCameraController();
    const adapter = new FakeMapCameraAdapter();
    const intent: MapCameraIntent = {
      kind: 'follow-player',
      position: { longitude: 121.4, latitude: 25 },
    };
    controller.request(intent);
    expect(controller.isFollowingPlayer()).toBe(true);
    controller.attach(adapter);
    expect(adapter.intents).toEqual([intent]);
    expect(controller.isFollowingPlayer()).toBe(true);
  });

  it('clears following for other camera intents and map detachment', () => {
    const controller = new MapCameraController();
    const adapter = new FakeMapCameraAdapter();
    controller.attach(adapter);
    const position = { longitude: 121.4, latitude: 25 };
    controller.request({ kind: 'follow-player', position });
    controller.request({ kind: 'planning-overview', position });
    expect(controller.isFollowingPlayer()).toBe(false);

    controller.request({ kind: 'follow-player', position });
    controller.detach(adapter);
    expect(controller.isFollowingPlayer()).toBe(false);
    const replacement = new FakeMapCameraAdapter();
    controller.attach(replacement);
    expect(replacement.intents).toEqual([]);
  });

  it('ignores stale cancellation and does not replay a cancelled follow request', () => {
    const controller = new MapCameraController();
    const adapter = new FakeMapCameraAdapter();
    controller.attach(adapter);
    controller.request({
      kind: 'follow-player',
      position: { longitude: 121.4, latitude: 25 },
    });
    controller.stopFollowing(new FakeMapCameraAdapter());
    expect(controller.isFollowingPlayer()).toBe(true);
    controller.stopFollowing(adapter);
    expect(controller.isFollowingPlayer()).toBe(false);
    controller.detach(adapter);
    const replacement = new FakeMapCameraAdapter();
    controller.attach(replacement);
    expect(replacement.intents).toEqual([]);
  });

  it('only marks the player centered after the map reports its actual screen offset', () => {
    const controller = new MapCameraController();
    const adapter = new FakeMapCameraAdapter();
    controller.attach(adapter);
    controller.request({ kind: 'player', position: { longitude: 121.4, latitude: 25 } });
    expect(controller.isPlayerCentered()).toBe(false);

    controller.reportPlayerCenterOffset(adapter, 8);
    expect(controller.isPlayerCentered()).toBe(true);

    controller.reportPlayerCenterOffset(adapter, 8.01);
    expect(controller.isPlayerCentered()).toBe(false);

    controller.reportPlayerCenterOffset(adapter, 0);
    expect(controller.isPlayerCentered()).toBe(true);
  });

  it('clears the centered state when the map detaches and ignores stale reports', () => {
    const controller = new MapCameraController();
    const first = new FakeMapCameraAdapter();
    const second = new FakeMapCameraAdapter();
    controller.attach(first);
    controller.reportPlayerCenterOffset(first, 0);
    expect(controller.isPlayerCentered()).toBe(true);

    controller.detach(first);
    expect(controller.isPlayerCentered()).toBe(false);
    controller.reportPlayerCenterOffset(first, 0);
    expect(controller.isPlayerCentered()).toBe(false);

    controller.attach(first);
    controller.reportPlayerCenterOffset(first, 0);
    controller.attach(second);
    expect(controller.isPlayerCentered()).toBe(false);
    controller.reportPlayerCenterOffset(first, 0);
    expect(controller.isPlayerCentered()).toBe(false);
    controller.reportPlayerCenterOffset(second, 0);
    controller.detach(first);
    expect(controller.isPlayerCentered()).toBe(true);
  });

  it.each([null, NaN, Infinity, -1])('treats unavailable or invalid offset %s as not centered', (offset) => {
    const controller = new MapCameraController();
    const adapter = new FakeMapCameraAdapter();
    controller.attach(adapter);
    controller.reportPlayerCenterOffset(adapter, 0);
    controller.reportPlayerCenterOffset(adapter, offset);
    expect(controller.isPlayerCentered()).toBe(false);
  });

  it('replays the latest intent when the map becomes ready', () => {
    const controller = new MapCameraController();
    const adapter = new FakeMapCameraAdapter();

    controller.request({
      kind: 'planning-overview',
      position: { longitude: 121.4, latitude: 25 },
    });
    controller.request({
      kind: 'route-overview',
      player: { longitude: 121.4, latitude: 25 },
      destination: { longitude: 121.5, latitude: 25.1 },
      route: [
        { longitude: 121.4, latitude: 25 },
        { longitude: 121.5, latitude: 25.1 },
      ],
    });
    controller.attach(adapter);

    expect(adapter.intents).toEqual([
      {
        kind: 'route-overview',
        player: { longitude: 121.4, latitude: 25 },
        destination: { longitude: 121.5, latitude: 25.1 },
        route: [
          { longitude: 121.4, latitude: 25 },
          { longitude: 121.5, latitude: 25.1 },
        ],
      },
    ]);
  });

  it('forwards new intents to the attached map adapter', () => {
    const controller = new MapCameraController();
    const adapter = new FakeMapCameraAdapter();
    controller.attach(adapter);

    controller.request({
      kind: 'player',
      position: { longitude: 121.4, latitude: 25 },
    });

    expect(adapter.intents).toHaveLength(1);
    expect(adapter.intents[0]?.kind).toBe('player');
  });

  it('stops forwarding intents after the adapter is detached', () => {
    const controller = new MapCameraController();
    const adapter = new FakeMapCameraAdapter();
    controller.attach(adapter);
    controller.detach(adapter);

    controller.request({
      kind: 'player',
      position: { longitude: 121.4, latitude: 25 },
    });

    expect(adapter.intents).toEqual([]);
  });
});

class FakeMapCameraAdapter implements MapCameraAdapter {
  readonly intents: MapCameraIntent[] = [];

  applyCameraIntent(intent: MapCameraIntent): void {
    this.intents.push(intent);
  }
}
