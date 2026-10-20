import { SupplyStationSpin } from './supply-station-spin';

describe('Supply station spin physics', () => {
  function settle(spin: SupplyStationSpin, start: number): number {
    let completed = 0;
    for (let frame = 1; frame <= 600 && spin.spinning; frame++) {
      if (spin.advance(start + frame * 16)) completed++;
    }
    expect(spin.spinning).toBe(false);
    return completed;
  }

  it('does not turn a tap into rotation or a reward', () => {
    const spin = new SupplyStationSpin();
    spin.begin(0, 0, 240);
    expect(spin.move(0, 50)).toBe(false);
    spin.release(50);
    expect(settle(spin, 50)).toBe(0);
    expect(spin.angle).toBe(0);
  });

  it('lets a gentle flick stop without completing a turn', () => {
    const spin = new SupplyStationSpin();
    spin.begin(0, 0, 240);
    expect(spin.move(12, 1000)).toBe(false);
    spin.release(1000);
    expect(settle(spin, 1000)).toBe(0);
    expect(spin.angle).toBeGreaterThan(18);
    expect(spin.angle).toBeLessThan(30);
  });

  it.each([-1, 1])('continues a fast flick in direction %s for multiple turns, with one attempt', direction => {
    const spin = new SupplyStationSpin();
    spin.begin(0, 0, 240);
    expect(spin.move(direction * 120, 50)).toBe(false);
    spin.release(50);
    expect(settle(spin, 50)).toBe(1);
    expect(Math.abs(spin.angle)).toBeGreaterThan(1080);
  });

  it('requires an actual full turn rather than rounded progress', () => {
    const spin = new SupplyStationSpin();
    spin.begin(0, 0, 240);
    expect(spin.move(239.9, 1000)).toBe(false);
    expect(spin.progress).toBeLessThan(1);
    expect(spin.move(240, 2000)).toBe(true);
    expect(spin.move(480, 3000)).toBe(false);
  });

  it('does not count back-and-forth wiggles as a full turn', () => {
    const spin = new SupplyStationSpin();
    spin.begin(0, 0, 240);
    for (let i = 1; i <= 10; i++) {
      expect(spin.move(i % 2 ? 120 : 0, i * 1000)).toBe(false);
    }
    expect(spin.progress).toBe(0);
  });

  it('retains partial turns across gestures and permits a new attempt after completion', () => {
    const spin = new SupplyStationSpin();
    for (let i = 0; i < 4; i++) {
      spin.begin(0, i * 1000, 240);
      expect(spin.move(60, i * 1000 + 500)).toBe(i === 3);
      spin.stop();
    }
    spin.begin(0, 5000, 240);
    expect(spin.progress).toBe(0);
    expect(spin.move(-240, 6000)).toBe(true);
  });

  it('does not launch stale velocity after holding still before release', () => {
    const spin = new SupplyStationSpin();
    spin.begin(0, 0, 240);
    spin.move(120, 50);
    spin.move(120, 500);
    spin.release(500);
    expect(spin.spinning).toBe(false);
    expect(spin.angle).toBe(180);
  });

  it('integrates inertia independently of frame frequency', () => {
    const fine = new SupplyStationSpin();
    const coarse = new SupplyStationSpin();
    for (const spin of [fine, coarse]) {
      spin.begin(0, 0, 240);
      spin.move(120, 50);
      spin.release(50);
    }
    for (let now = 70; now <= 1050; now += 20) fine.advance(now);
    coarse.advance(1050);
    expect(fine.angle).toBeCloseTo(coarse.angle, 8);
  });

  it('uses recent flick speed even after holding the icon before moving', () => {
    const spin = new SupplyStationSpin();
    spin.begin(0, 0, 240);
    spin.move(10, 2000);
    spin.move(120, 2050);
    spin.release(2050);
    expect(settle(spin, 2050)).toBe(1);
    expect(spin.angle).toBeGreaterThan(1080);
  });

  it('supports keyboard turns in both directions and resets between stations', () => {
    const spin = new SupplyStationSpin();
    for (let i = 0; i < 7; i++) expect(spin.nudge(-1)).toBe(false);
    expect(spin.nudge(-1)).toBe(true);
    spin.reset();
    expect(spin.angle).toBe(0);
    expect(spin.progress).toBe(0);
    for (let i = 0; i < 7; i++) expect(spin.nudge(1)).toBe(false);
    expect(spin.nudge(1)).toBe(true);
  });
});
