import { TestBed } from '@angular/core/testing';
import { LocationStore } from './location-store';

describe('Demo user heading', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each([
    [1, 0, 0],
    [0, 1, 90],
    [-1, 0, 180],
    [0, -1, 270],
    [1, 1, 45],
    [1, -1, 315],
  ])(
    'records clockwise-from-north heading for movement (%s, %s)',
    (latitude, longitude, heading) => {
      const store = TestBed.inject(LocationStore);
      store.moveDemoBy(latitude, longitude, 0.05);
      expect(store.current()?.heading).toBeCloseTo(heading);
      expect(store.source()).toBe('demo');
    },
  );

  it('retains the last heading and position when movement stops or input is invalid', () => {
    const store = TestBed.inject(LocationStore);
    store.moveDemoBy(0, 1, 0.05);
    const position = store.current();
    store.moveDemoBy(0, 0, 0.05);
    store.moveDemoBy(1, 0, 0);
    store.moveDemoBy(NaN, 1, 0.05);
    expect(store.current()).toBe(position);
    expect(store.current()?.heading).toBe(90);
  });

  it('accepts explicit facing independently of movement direction or stationary turns', () => {
    const store = TestBed.inject(LocationStore);
    store.moveDemoBy(0, 0, 0.05, 90);
    const position = store.current()!;
    expect(position.heading).toBe(90);
    store.moveDemoBy(0, -1, 0.05, 90);
    expect(store.current()!.longitude).toBeLessThan(position.longitude);
    expect(store.current()?.heading).toBe(90);
    const moving = store.current()!;
    store.moveDemoBy(0, 0, 0.05, 450);
    expect(store.current()?.heading).toBe(90);
    expect(store.current()?.latitude).toBe(moving.latitude);
    expect(store.current()?.longitude).toBe(moving.longitude);
    store.moveDemoBy(0, 0, 0.05, 120);
    expect(store.current()?.heading).toBe(120);
    expect(store.current()?.longitude).toBe(moving.longitude);
  });

  it('rejects invalid explicit facing without moving or changing orientation', () => {
    const store = TestBed.inject(LocationStore);
    const position = store.current();
    store.moveDemoBy(1, 0, 0.05, NaN);
    store.moveDemoBy(1, 0, 0.05, Infinity);
    expect(store.current()).toBe(position);
  });
  it('turns progressively while retaining immediate positional movement', () => {
    const store = TestBed.inject(LocationStore);
    store.moveDemoBy(1, 0, 0.05);
    const start = store.current()!;
    store.moveDemoBy(0, 1, 0.05);
    const heading = store.current()!.heading!;
    expect(heading).toBeGreaterThan(0);
    expect(heading).toBeLessThan(20);
    expect(store.current()?.latitude).toBe(start.latitude);
    expect(store.current()!.longitude).toBeGreaterThan(start.longitude);
    for (let i = 0; i < 14; i++) store.moveDemoBy(0, 1, 0.05);
    expect(store.current()!.heading).toBeGreaterThan(85);
    expect(store.current()!.heading).toBeLessThan(90);
  });

  it.each([
    [350, 10, 1],
    [10, 350, -1],
  ])('takes the short arc from %s to %s across north', (start, target, direction) => {
    const store = TestBed.inject(LocationStore);
    const moveTo = (degrees: number) =>
      store.moveDemoBy(
        Math.cos((degrees * Math.PI) / 180),
        Math.sin((degrees * Math.PI) / 180),
        0.05,
      );
    moveTo(start);
    moveTo(target);
    const heading = store.current()!.heading!;
    const change = ((heading - start + 540) % 360) - 180;
    expect(change * direction).toBeGreaterThan(0);
    expect(Math.abs(change)).toBeLessThan(5);
    for (let i = 0; i < 19; i++) moveTo(target);
    const remaining = ((target - store.current()!.heading! + 540) % 360) - 180;
    expect(Math.abs(remaining)).toBeLessThan(0.4);
  });

  it('produces the same damping at different frame rates', () => {
    const simulate = (elapsed: number, frames: number) => {
      TestBed.resetTestingModule();
      const store = TestBed.inject(LocationStore);
      store.moveDemoBy(1, 0, 0.01);
      for (let i = 0; i < frames; i++) store.moveDemoBy(0, 1, elapsed);
      return store.current()!.heading!;
    };
    expect(simulate(1 / 60, 60)).toBeCloseTo(simulate(1 / 30, 30), 8);
  });

  it('damps a reversal without an instantaneous half turn or overshoot', () => {
    const store = TestBed.inject(LocationStore);
    store.moveDemoBy(1, 0, 0.01);
    store.moveDemoBy(-1, 0, 0.016);
    expect(store.current()!.heading).toBeGreaterThan(348);
    expect(store.current()!.heading).toBeLessThan(360);
    for (let i = 0; i < 60; i++) store.moveDemoBy(-1, 0, 0.016);
    expect(store.current()!.heading).toBeGreaterThan(180);
    expect(store.current()!.heading).toBeLessThan(184);
  });
});
