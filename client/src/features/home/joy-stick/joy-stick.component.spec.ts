import { TestBed } from '@angular/core/testing';
import { LocationStore } from '../../../shared/stores/location-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { JoyStickComponent } from './joy-stick.component';
import { MapCameraController } from '../home-map/map-camera.controller';
import {
  DEMO_JOYSTICK_DEAD_ZONE_RATIO,
  DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND,
  DEMO_WALKING_SPEED_METERS_PER_SECOND,
} from '../../../environments/environment-dev';

describe('Joystick movement and continuous steering', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setup(following = true) {
    const addSteps = vi.fn();
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);
    TestBed.configureTestingModule({
      imports: [JoyStickComponent],
      providers: [MapCameraController, { provide: ProgressStore, useValue: { addSteps } }],
    });
    TestBed.overrideComponent(JoyStickComponent, {
      set: { template: '<div #joystick></div>', imports: [] },
    });
    const fixture = TestBed.createComponent(JoyStickComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('div') as HTMLDivElement;
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
    element.setPointerCapture = vi.fn();
    element.hasPointerCapture = vi.fn(() => false);
    const event = (clientX: number, clientY: number) =>
      new PointerEvent('pointermove', { pointerId: 1, clientX, clientY });
    const store = TestBed.inject(LocationStore);
    const camera = TestBed.inject(MapCameraController);
    if (following) camera.request({ kind: 'follow-player', position: store.current()! });
    return {
      fixture,
      joystick: fixture.componentInstance,
      store,
      camera,
      addSteps,
      event,
      atAngle: (degrees: number) =>
        event(
          50 + 23 * Math.sin((degrees * Math.PI) / 180),
          50 - 23 * Math.cos((degrees * Math.PI) / 180),
        ),
      tick: (timestamp: number) => frame!(timestamp),
    };
  }

  function angularChange(previous: number, next: number): number {
    return ((next - previous + 540) % 360) - 180;
  }

  describe('screen-relative movement without camera following', () => {
    it.each([
      [0, 0, 1, 0],
      [0, 90, 0, 1],
      [0, 180, -1, 0],
      [0, 270, 0, -1],
      [90, 0, 0, 1],
      [90, 90, -1, 0],
      [90, 180, 0, -1],
      [90, 270, 1, 0],
      [225, 0, -Math.SQRT1_2, -Math.SQRT1_2],
    ])(
      'moves in screen direction at bearing %s and stick angle %s',
      (bearing, angle, north, east) => {
        const { joystick, store, camera, atAngle, tick } = setup(false);
        const move = vi.spyOn(store, 'moveDemoBy');
        const position = store.current()!;
        joystick.setMapBearing(bearing);
        joystick.startJoystick(atAngle(angle));
        tick(16);
        const [latitude, longitude, elapsed, facing] = move.mock.calls.at(-1)!;
        expect(latitude).toBeCloseTo(north, 8);
        expect(longitude).toBeCloseTo(east, 8);
        expect(elapsed).toBe(0.016);
        expect(facing).toBeUndefined();
        const target = (bearing + angle) % 360;
        expect(angularChange(target, store.current()!.heading!)).toBeCloseTo(0, 8);
        expect(store.current()!.latitude - position.latitude).toBeCloseTo(
          (north * DEMO_WALKING_SPEED_METERS_PER_SECOND * 0.016) / 111_320,
          8,
        );
        expect(camera.isFollowingPlayer()).toBe(false);
      },
    );

    it('smooths facing along the shortest arc without damping the movement direction', () => {
      const { joystick, store, atAngle, tick } = setup(false);
      store.moveDemoBy(0, 0, 0.1, 350);
      const move = vi.spyOn(store, 'moveDemoBy');
      joystick.startJoystick(atAngle(10));
      tick(16);
      const expectedHeading = 350 + 20 * (1 - Math.exp(-0.016 / 0.25));
      expect(store.current()!.heading).toBeCloseTo(expectedHeading, 8);
      const [north, east] = move.mock.calls.at(-1)!;
      expect(north).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 8);
      expect(east).toBeCloseTo(Math.sin((10 * Math.PI) / 180), 8);
      for (let timestamp = 32; timestamp <= 2016; timestamp += 16) tick(timestamp);
      expect(Math.abs(angularChange(store.current()!.heading!, 10))).toBeLessThan(0.01);
    });

    it('caps diagonal movement at full speed and credits translation in every direction', () => {
      const { joystick, store, event, tick, addSteps } = setup(false);
      const move = vi.spyOn(store, 'moveDemoBy');
      joystick.startJoystick(event(100, 0));
      for (let timestamp = 50; timestamp <= 1200; timestamp += 50) tick(timestamp);
      const [north, east] = move.mock.calls.at(-1)!;
      expect(north).toBeCloseTo(Math.SQRT1_2);
      expect(east).toBeCloseTo(Math.SQRT1_2);
      expect(Math.hypot(north, east)).toBeCloseTo(1);
      expect(addSteps.mock.calls.reduce((total, [steps]) => total + steps, 0)).toBe(2);
    });

    it('applies radial dead zone and remaps lateral speed continuously', () => {
      const { joystick, store, event, tick, addSteps } = setup(false);
      const move = vi.spyOn(store, 'moveDemoBy');
      const position = store.current();
      joystick.startJoystick(event(50 + 23 * DEMO_JOYSTICK_DEAD_ZONE_RATIO, 50));
      tick(16);
      expect(store.current()).toBe(position);
      expect(move).not.toHaveBeenCalled();
      const radius = DEMO_JOYSTICK_DEAD_ZONE_RATIO + (1 - DEMO_JOYSTICK_DEAD_ZONE_RATIO) / 2;
      joystick.moveJoystick(event(50 + 23 * radius, 50));
      tick(32);
      expect(move.mock.calls.at(-1)![1]).toBeCloseTo(0.5);
      const afterMove = store.current();
      joystick.moveJoystick(event(50, 50));
      for (let timestamp = 48; timestamp <= 2048; timestamp += 16) tick(timestamp);
      expect(store.current()).toBe(afterMove);
      expect(addSteps).not.toHaveBeenCalled();
    });

    it('keeps screen mode and reference until release when recenter enables following', () => {
      const { joystick, store, camera, atAngle, tick } = setup(false);
      const move = vi.spyOn(store, 'moveDemoBy');
      joystick.setMapBearing(90);
      joystick.startJoystick(atAngle(90));
      tick(16);
      camera.request({ kind: 'follow-player', position: store.current()! });
      joystick.setMapBearing(180);
      tick(32);
      expect(move.mock.calls.at(-1)![0]).toBeCloseTo(-1);
      expect(move.mock.calls.at(-1)![1]).toBeCloseTo(0);
      expect(move.mock.calls.at(-1)![3]).toBeUndefined();
      joystick.endJoystick(atAngle(90));
      const position = store.current()!;
      joystick.startJoystick(atAngle(90));
      tick(48);
      expect(store.current()!.latitude).toBe(position.latitude);
      expect(store.current()!.longitude).toBe(position.longitude);
      expect(angularChange(position.heading!, store.current()!.heading!)).toBeGreaterThan(0);
    });

    it('keeps steering mode until release when following stops, then uses the latest map bearing', () => {
      const { joystick, store, camera, atAngle, tick } = setup();
      joystick.startJoystick(atAngle(90));
      tick(16);
      const position = store.current()!;
      camera.request({ kind: 'planning-overview', position });
      joystick.setMapBearing(90);
      tick(32);
      expect(store.current()!.latitude).toBe(position.latitude);
      expect(store.current()!.longitude).toBe(position.longitude);
      joystick.endJoystick(atAngle(90));
      const move = vi.spyOn(store, 'moveDemoBy');
      joystick.startJoystick(atAngle(90));
      tick(48);
      expect(move.mock.calls.at(-1)![0]).toBeCloseTo(-1);
      expect(move.mock.calls.at(-1)![1]).toBeCloseTo(0);
      expect(store.current()!.latitude).toBeLessThan(position.latitude);
      expect(move.mock.calls.at(-1)![3]).toBeUndefined();
    });
  });

  it.each([0, 0.1, DEMO_JOYSTICK_DEAD_ZONE_RATIO])(
    'does not move, turn, or award steps within the radial dead zone at %s',
    (radius) => {
      const { joystick, store, event, tick, addSteps } = setup();
      const position = store.current();
      const offset = (23 * radius) / Math.SQRT2;
      joystick.startJoystick(event(50 + offset, 50 - offset));
      for (let timestamp = 16; timestamp <= 2016; timestamp += 16) tick(timestamp);
      expect(store.current()).toBe(position);
      expect(addSteps).not.toHaveBeenCalled();
    },
  );

  it('ramps forward speed smoothly from the dead zone edge to full strength', () => {
    const { joystick, store, event, tick } = setup();
    const move = vi.spyOn(store, 'moveDemoBy');
    joystick.startJoystick(event(50, 50 - 23 * (DEMO_JOYSTICK_DEAD_ZONE_RATIO + 0.001)));
    tick(16);
    expect(move.mock.calls.at(-1)![0]).toBeCloseTo(0.001 / (1 - DEMO_JOYSTICK_DEAD_ZONE_RATIO));
    joystick.moveJoystick(
      event(
        50,
        50 - 23 * (DEMO_JOYSTICK_DEAD_ZONE_RATIO + (1 - DEMO_JOYSTICK_DEAD_ZONE_RATIO) / 2),
      ),
    );
    tick(32);
    expect(move.mock.calls.at(-1)![0]).toBeCloseTo(0.5);
    joystick.moveJoystick(event(50, 0));
    tick(48);
    expect(move.mock.calls.at(-1)![0]).toBeCloseTo(1);
    expect(move.mock.calls.at(-1)![1]).toBeCloseTo(0);
  });

  it('splits diagonal input into capped forward speed and continuous turning', () => {
    const { joystick, store, event, tick } = setup();
    const move = vi.spyOn(store, 'moveDemoBy');
    joystick.startJoystick(event(100, 0));
    tick(16);
    const [latitude, longitude, , facing] = move.mock.calls.at(-1)!;
    expect(Math.hypot(latitude, longitude)).toBeCloseTo(Math.SQRT1_2);
    expect(facing).toBeGreaterThan(0);
    expect(facing).toBeLessThan(1);
    expect(store.current()?.heading).toBe(facing);
  });

  it.each([
    [90, 1],
    [270, -1],
  ])(
    'keeps turning at stick angle %s past a fixed heading without moving or awarding steps',
    (angle, direction) => {
      const { joystick, store, atAngle, tick, addSteps } = setup();
      const position = store.current()!;
      joystick.startJoystick(atAngle(angle));
      let previous = 0;
      let totalTurn = 0;
      for (let timestamp = 20; timestamp <= 3000; timestamp += 20) {
        tick(timestamp);
        const heading = store.current()!.heading!;
        const turn = angularChange(previous, heading);
        expect(turn * direction).toBeGreaterThan(0);
        expect(Math.abs(turn)).toBeLessThanOrEqual(
          DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND * 0.02,
        );
        totalTurn += turn;
        previous = heading;
        joystick.setMapBearing(heading);
        joystick.moveJoystick(atAngle(angle));
      }
      const expectedTurn =
        DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND * (3 - 0.25 * (1 - Math.exp(-3 / 0.25)));
      expect(totalTurn).toBeCloseTo(direction * expectedTurn, 7);
      expect(Math.abs(totalTurn)).toBeGreaterThan(180);
      expect(store.current()?.latitude).toBe(position.latitude);
      expect(store.current()?.longitude).toBe(position.longitude);
      expect(addSteps).not.toHaveBeenCalled();
    },
  );

  it('backs up at 180 degrees without reversing facing and credits actual movement steps', () => {
    const { joystick, store, atAngle, tick, addSteps } = setup();
    store.moveDemoBy(0, 0, 0.1, 40);
    const position = store.current()!;
    joystick.startJoystick(atAngle(180));
    for (let timestamp = 50; timestamp <= 1200; timestamp += 50) tick(timestamp);
    expect(store.current()?.heading).toBe(40);
    expect(store.current()!.latitude).toBeLessThan(position.latitude);
    expect(store.current()!.longitude).toBeLessThan(position.longitude);
    expect(addSteps.mock.calls.reduce((total, [steps]) => total + steps, 0)).toBe(2);
  });

  it('switches directly from forward to backward without a half-turn correction', () => {
    const { joystick, store, atAngle, tick } = setup();
    joystick.startJoystick(atAngle(0));
    tick(16);
    const position = store.current()!;
    joystick.moveJoystick(atAngle(180));
    tick(32);
    expect(store.current()?.heading).toBe(position.heading);
    expect(store.current()!.latitude).toBeLessThan(position.latitude);
  });

  it('uses the player facing for forward movement and does not let camera rotation steer it', () => {
    const { joystick, store, atAngle, tick } = setup();
    store.moveDemoBy(0, 0, 0.1, 90);
    joystick.setMapBearing(180);
    joystick.startJoystick(atAngle(0));
    tick(16);
    const position = store.current()!;
    joystick.setMapBearing(270);
    joystick.moveJoystick(atAngle(0));
    tick(32);
    expect(store.current()?.heading).toBe(90);
    expect(store.current()?.latitude).toBe(position.latitude);
    expect(store.current()!.longitude).toBeGreaterThan(position.longitude);
  });

  it.each([
    [0, 1],
    [90, 1],
    [350, 1],
    [0, -1],
    [90, -1],
    [350, -1],
  ])(
    'reduces turning speed without reversing when moving 30 to 20 degrees (bearing %s, side %s)',
    (bearing, side) => {
      const { joystick, store, atAngle, tick } = setup();
      joystick.setMapBearing(bearing);
      joystick.startJoystick(atAngle(side * 30));
      for (let timestamp = 20; timestamp <= 1000; timestamp += 20) tick(timestamp);
      const initialRate =
        side * 0.5 * DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND * (1 - Math.exp(-1 / 0.25));
      const targetRate =
        Math.sin((side * 20 * Math.PI) / 180) * DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND;
      let previous = store.current()!.heading!;
      let previousTurn = Math.abs(initialRate) * 0.02;
      let totalTurn = 0;
      joystick.moveJoystick(atAngle(side * 20));
      for (let timestamp = 1020; timestamp <= 2000; timestamp += 20) {
        tick(timestamp);
        const heading = store.current()!.heading!;
        const turn = angularChange(previous, heading);
        expect(turn * side).toBeGreaterThan(0);
        expect(Math.abs(turn)).toBeLessThan(previousTurn);
        totalTurn += turn;
        previousTurn = Math.abs(turn);
        previous = heading;
        joystick.setMapBearing(heading);
        joystick.moveJoystick(atAngle(side * 20));
      }
      const expectedTurn =
        targetRate + (initialRate - targetRate) * 0.25 * (1 - Math.exp(-1 / 0.25));
      expect(totalTurn).toBeCloseTo(expectedTurn, 7);
    },
  );

  it('smoothly reverses turning when the stick crosses from right to left', () => {
    const { joystick, store, atAngle, tick } = setup();
    joystick.startJoystick(atAngle(90));
    for (let timestamp = 20; timestamp <= 1000; timestamp += 20) tick(timestamp);
    const beforeReversal = store.current()!.heading!;
    joystick.moveJoystick(atAngle(270));
    tick(1020);
    expect(angularChange(beforeReversal, store.current()!.heading!)).toBeGreaterThan(0);
    for (let timestamp = 1040; timestamp <= 1500; timestamp += 20) tick(timestamp);
    const afterReversal = store.current()!.heading!;
    tick(1520);
    expect(angularChange(afterReversal, store.current()!.heading!)).toBeLessThan(0);
  });

  it('stops all motion on dead-zone entry and resumes without residual turning velocity', () => {
    const { joystick, store, atAngle, event, tick, addSteps } = setup();
    joystick.startJoystick(atAngle(90));
    tick(16);
    const position = store.current();
    joystick.moveJoystick(event(51, 49));
    for (let timestamp = 32; timestamp <= 2032; timestamp += 16) tick(timestamp);
    expect(store.current()).toBe(position);
    expect(addSteps).not.toHaveBeenCalled();
    joystick.moveJoystick(atAngle(90));
    tick(2048);
    const expectedTurn =
      DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND * (0.016 - 0.25 * (1 - Math.exp(-0.016 / 0.25)));
    expect(angularChange(position!.heading!, store.current()!.heading!)).toBeCloseTo(
      expectedTurn,
      8,
    );
  });

  it('stops rotation on release and retains facing when starting a new forward gesture', () => {
    const { joystick, store, atAngle, tick } = setup();
    joystick.startJoystick(atAngle(90));
    tick(16);
    joystick.endJoystick(atAngle(90));
    const heading = store.current()!.heading!;
    expect(cancelAnimationFrame).toHaveBeenCalled();
    joystick.setMapBearing(180);
    joystick.startJoystick(atAngle(0));
    tick(32);
    expect(store.current()?.heading).toBe(heading);
  });

  it('stops turning when horizontal input returns to neutral while continuing forward', () => {
    const { joystick, store, atAngle, tick } = setup();
    joystick.startJoystick(atAngle(90));
    for (let timestamp = 20; timestamp <= 1000; timestamp += 20) tick(timestamp);
    const position = store.current()!;
    joystick.moveJoystick(atAngle(0));
    tick(1020);
    expect(store.current()?.heading).toBe(position.heading);
    expect(store.current()!.latitude).toBeGreaterThan(position.latitude);
    expect(store.current()!.longitude).toBeGreaterThan(position.longitude);
  });

  it('integrates held turning consistently at different frame rates', () => {
    const simulate = (frames: number) => {
      TestBed.resetTestingModule();
      const { fixture, joystick, store, atAngle, tick } = setup();
      joystick.startJoystick(atAngle(90));
      for (let frame = 1; frame <= frames; frame++) tick((frame * 1000) / frames);
      const heading = store.current()!.heading!;
      fixture.destroy();
      return heading;
    };
    expect(simulate(60)).toBeCloseTo(simulate(30), 8);
  });

  it('bounds motion and turning after a long animation-frame pause', () => {
    const { joystick, store, atAngle, tick } = setup();
    const move = vi.spyOn(store, 'moveDemoBy');
    joystick.startJoystick(atAngle(45));
    tick(10000);
    expect(move.mock.calls.at(-1)![2]).toBe(0.1);
    expect(store.current()!.heading).toBeLessThan(
      DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND * 0.1,
    );
  });
});
