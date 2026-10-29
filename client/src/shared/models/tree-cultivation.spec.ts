import { TREE_ORNAMENTS } from './tree-appearance';
import {
  cultivationGrowth,
  ResourceFeedingClock,
  CARE_GROWTH_PRECISION,
  taipeiDay,
  treeStage,
  treeVisualScale,
  harvestPointMotion,
  wateringGeometry,
  TreeShakeGesture,
  DEMO_FRUIT_PARTICLES,
  DEMO_FRUIT_FALL_DURATION_MS,
  DEMO_HARVEST_DURATION_MS,
  treeWaterState,
  TREE_WATERED_DURATION_MS,
  TREE_DRY_AFTER_MS,
} from './tree-cultivation';
import { TREE_GROWTH_PER_HARVEST } from '../../environments/environment-dev';

describe('tree cultivation', () => {
  it('uses rolling watering boundaries and keeps never-watered trees normal for seven days', () => {
    const plantedAt = 1000;
    const wateredAt = 2000;
    expect(treeWaterState(null, plantedAt, plantedAt)).toBe('normal');
    expect(treeWaterState(null, plantedAt, plantedAt + TREE_DRY_AFTER_MS)).toBe('normal');
    expect(treeWaterState(null, plantedAt, plantedAt + TREE_DRY_AFTER_MS + 1)).toBe('dry');
    expect(treeWaterState(wateredAt, plantedAt, wateredAt)).toBe('watered');
    expect(treeWaterState(wateredAt, plantedAt, wateredAt + TREE_WATERED_DURATION_MS - 1)).toBe(
      'watered',
    );
    expect(treeWaterState(wateredAt, plantedAt, wateredAt + TREE_WATERED_DURATION_MS)).toBe(
      'normal',
    );
    expect(treeWaterState(wateredAt, plantedAt, wateredAt + TREE_DRY_AFTER_MS)).toBe('normal');
    expect(treeWaterState(wateredAt, plantedAt, wateredAt + TREE_DRY_AFTER_MS + 1)).toBe('dry');
  });

  it('lays out exactly 50 distinct reward particles and lands all of them before payout', () => {
    expect(DEMO_FRUIT_PARTICLES).toHaveLength(50);
    expect(
      new Set(
        DEMO_FRUIT_PARTICLES.filter((fruit) => fruit.visibleWhenRipe).map(
          (fruit) => `${fruit.x},${fruit.y}`,
        ),
      ).size,
    ).toBe(TREE_ORNAMENTS.length);
    expect(new Set(DEMO_FRUIT_PARTICLES.map((fruit) => fruit.delayMs)).size).toBe(10);
    for (const fruit of DEMO_FRUIT_PARTICLES) {
      expect(fruit.delayMs).toBeGreaterThanOrEqual(0);
      expect(fruit.delayMs + DEMO_FRUIT_FALL_DURATION_MS).toBeLessThanOrEqual(
        DEMO_HARVEST_DURATION_MS,
      );
      const x = (fruit.landingX - 160) / 86;
      const y = (fruit.landingY - 211) / 15;
      expect(x * x + y * y).toBeLessThan(1);
    }
  });

  it('anchors visible point icons to the same positions as the flowers', () => {
    expect(DEMO_FRUIT_PARTICLES.filter((fruit) => fruit.visibleWhenRipe)).toHaveLength(
      TREE_ORNAMENTS.length,
    );
    for (let i = 0; i < TREE_ORNAMENTS.length; i++) {
      const point = DEMO_FRUIT_PARTICLES[i];
      expect(point.origin.x).toBe(TREE_ORNAMENTS[i].x);
      expect(point.origin.y).toBe(TREE_ORNAMENTS[i].y);
      expect(point.origin.z).toBeGreaterThan(TREE_ORNAMENTS[i].z);
      expect(point.x).toBeGreaterThan(80);
      expect(point.x).toBeLessThan(240);
    }
  });

  it.each<[number, string]>([
    [0, 'seed'],
    [499, 'seed'],
    [500, 'seedling'],
    [799, 'seedling'],
    [800, 'smallSapling'],
    [1149, 'smallSapling'],
    [1150, 'largeSapling'],
    [1499, 'largeSapling'],
    [1500, 'young'],
    [2999, 'young'],
    [3000, 'mature'],
    [4249, 'mature'],
    [4250, 'flowering'],
    [4999, 'flowering'],
    [5000, 'large'],
  ])('uses the exact stage boundary at %s', (growth, stage) => {
    expect(treeStage(growth, 5000)).toBe(stage);
  });

  it.each([100, 5000, 150000])('scales all stage boundaries to harvest target %s', (target) => {
    expect(treeStage(0, target)).toBe('seed');
    expect(treeStage(target * 0.1 - 0.01, target)).toBe('seed');
    expect(treeStage(target * 0.1, target)).toBe('seedling');
    expect(treeStage(target * 0.16 - 0.01, target)).toBe('seedling');
    expect(treeStage(target * 0.16, target)).toBe('smallSapling');
    expect(treeStage(target * 0.23 - 0.01, target)).toBe('smallSapling');
    expect(treeStage(target * 0.23, target)).toBe('largeSapling');
    expect(treeStage(target * 0.3 - 0.01, target)).toBe('largeSapling');
    expect(treeStage(target * 0.3, target)).toBe('young');
    expect(treeStage(target * 0.6 - 0.01, target)).toBe('young');
    expect(treeStage(target * 0.6, target)).toBe('mature');
    expect(treeStage(target * 0.85 - 0.01, target)).toBe('mature');
    expect(treeStage(target * 0.85, target)).toBe('flowering');
    expect(treeStage(target - 0.01, target)).toBe('flowering');
    expect(treeStage(target, target)).toBe('large');
    expect(treeStage(target * 2, target)).toBe('large');
  });

  it('increases absolute visual size within every stage and caps later growth', () => {
    for (const [start, end] of [
      [0, 0.1],
      [0.1, 0.16],
      [0.16, 0.23],
      [0.23, 0.3],
      [0.3, 0.6],
      [0.6, 0.85],
      [0.85, 1],
    ]) {
      const low = treeVisualScale(start * 5000, 5000);
      const high = treeVisualScale((end - 0.0001) * 5000, 5000);
      expect(high).toBeGreaterThan(low);
    }
    expect(treeVisualScale(5000, 5000)).toBe(treeVisualScale(500000, 5000));
    for (const boundary of [0.16, 0.23, 0.3, 0.6, 0.85, 1]) {
      expect(treeVisualScale(boundary * 5000 - 0.001, 5000)).toBeCloseTo(
        treeVisualScale(boundary * 5000, 5000),
        5,
      );
    }
  });

  it('scatters rewards with different bounces, rolling and individual fade before payout', () => {
    const origin = { x: 0, y: 2, z: 0 };
    const paths = Array.from({ length: 50 }, (_, index) =>
      [0, 0.5, 0.65, 0.8, 1].map((time) => harvestPointMotion(index, time, origin)),
    );
    expect(
      new Set(paths.map((path) => path[4].x.toFixed(4) + ',' + path[4].z.toFixed(4))).size,
    ).toBe(50);
    expect(new Set(paths.map((path) => path[2].y.toFixed(5))).size).toBeGreaterThan(40);
    for (const path of paths) {
      expect(path[0]).toMatchObject(origin);
      expect(path[2].y).toBeGreaterThan(0.03);
      expect(path[4].opacity).toBe(0);
      expect(path[4].y).toBeCloseTo(0.03);
      expect(Math.hypot(path[4].x, path[4].z)).toBeLessThan(1.2);
      expect(path[4].spin).not.toBe(0);
      expect(path[4].x).not.toBe(path[2].x);
    }
  });

  it('uses the environment harvest target by default', () => {
    expect(treeStage(TREE_GROWTH_PER_HARVEST * 0.1)).toBe('seedling');
    expect(treeStage(TREE_GROWTH_PER_HARVEST * 0.3)).toBe('young');
    expect(treeStage(TREE_GROWTH_PER_HARVEST * 0.6)).toBe('mature');
    expect(treeStage(TREE_GROWTH_PER_HARVEST)).toBe('large');
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid harvest target %s explicitly',
    (target) => {
      expect(() => treeStage(0, target)).toThrow(RangeError);
    },
  );

  it('preserves the 5,000-growth economic reference independently of the development goal', () => {
    expect(cultivationGrowth({ lightEnergy: 750000, water: 0, fertilizer: false }).total).toBe(
      5000,
    );
    expect(cultivationGrowth({ lightEnergy: 0, water: 75000, fertilizer: false }).total).toBe(5000);
    expect(750000 / 7500).toBe(100);
  });

  it.each([9, 10, 11])(
    'applies weed penalties at the exact ten-weed threshold (%s weeds)',
    (weeds) => {
      const result = cultivationGrowth(
        { lightEnergy: 150, water: 0, fertilizer: false },
        0,
        weeds >= 10,
      );
      expect(result.total + result.remainder / CARE_GROWTH_PRECISION).toBe(weeds >= 10 ? 0.9 : 1);
      const fertilized = cultivationGrowth(
        { lightEnergy: 150, water: 0, fertilizer: true },
        0,
        weeds >= 10,
      );
      expect(fertilized.total + fertilized.remainder / CARE_GROWTH_PRECISION).toBe(
        weeds >= 10 ? 1.08 : 1.2,
      );
      const water = cultivationGrowth(
        { lightEnergy: 0, water: 15, fertilizer: true },
        0,
        weeds >= 10,
      );
      expect(water).toEqual(fertilized);
    },
  );

  it.each([false, true])(
    'keeps exact weed conversion across single-light allocations (fertilizer %s)',
    (fertilizer) => {
      let total = 0;
      let remainder = 0;
      const amount = fertilizer ? 1250 : 1500;
      for (let index = 0; index < amount; index++) {
        const result = cultivationGrowth({ lightEnergy: 1, water: 0, fertilizer }, remainder, true);
        total += result.total;
        remainder = result.remainder;
      }
      expect(total).toBe(9);
      expect(remainder).toBe(0);
    },
  );

  it('preserves earned fractions when clearing the weed debuff', () => {
    const before = cultivationGrowth({ lightEnergy: 100, water: 0, fertilizer: false }, 0, true);
    expect(before.remainder).toBe(4500);
    const after = cultivationGrowth(
      { lightEnergy: 100, water: 0, fertilizer: false },
      before.remainder,
      false,
    );
    expect(after.total).toBe(1);
    expect(after.remainder).toBe(2000);
  });

  it('converts light separately from water and retains fractional fertilizer growth', () => {
    expect(cultivationGrowth({ lightEnergy: 150, water: 15, fertilizer: true })).toEqual({
      base: 2,
      bonus: 0.4,
      total: 2,
      remainder: 3000,
    });
    expect(cultivationGrowth({ lightEnergy: 0, water: true, fertilizer: false }).total).toBe(0);
    expect(cultivationGrowth({ lightEnergy: 0, water: true, fertilizer: false }).remainder).toBe(
      500,
    );
  });

  it.each([149, 150, 151, 7500, 750000])(
    'converts %s light at exactly 150 light per growth',
    (lightEnergy) => {
      const growth = cultivationGrowth({ lightEnergy, water: 0, fertilizer: false });
      expect(growth.total).toBe(Math.floor(lightEnergy / 150));
      expect(growth.remainder).toBe((lightEnergy % 150) * 50);
    },
  );

  it('gives exactly 20% more growth across individual fertilized light units', () => {
    let remainder = 0;
    let total = 0;
    for (let i = 0; i < 750; i++) {
      const growth = cultivationGrowth({ lightEnergy: 1, water: 0, fertilizer: true }, remainder);
      total += growth.total;
      remainder = growth.remainder;
    }
    expect(total).toBe(6);
    expect(remainder).toBe(0);
    expect(cultivationGrowth({ lightEnergy: 125, water: 0, fertilizer: true }).total).toBe(1);
  });

  it('uses Taipei midnight rather than UTC midnight', () => {
    expect(taipeiDay(new Date('2026-10-14T15:59:59Z'))).toBe('2026-10-14');
    expect(taipeiDay(new Date('2026-10-14T16:00:00Z'))).toBe('2026-10-15');
  });

  it('feeds exactly 100 light energy per second regardless of tick frequency', () => {
    for (const ticks of [10, 20, 60, 120]) {
      const clock = new ResourceFeedingClock(0, 100);
      let total = 0;
      for (let i = 1; i <= ticks; i++) total += clock.take((i * 1000) / ticks, true);
      expect(total).toBe(100);
    }
  });

  it('counts only time inside the range and retains fractional energy within a gesture', () => {
    const clock = new ResourceFeedingClock(0, 100);
    expect(clock.take(5, true)).toBe(0);
    expect(clock.take(1005, false)).toBe(0);
    expect(clock.take(1010, true)).toBe(1);
    expect(clock.take(2010, true)).toBe(100);
  });

  it.each([1, 5, 10, 37, 250])(
    'uses the configured rate %s without frame-dependent rounding',
    (rate) => {
      for (const ticks of [10, 60, 120]) {
        const clock = new ResourceFeedingClock(0, rate);
        let units = 0;
        for (let i = 1; i <= ticks; i++) units += clock.take((i * 2000) / ticks, true);
        expect(units).toBe(rate * 2);
      }
    },
  );

  it('values each water drop as exactly ten light units for every fractional remainder', () => {
    for (const water of [0, 1, 14, 15, 16, 25, 75000]) {
      for (const fertilizer of [false, true]) {
        for (let remainder = 0; remainder < CARE_GROWTH_PRECISION; remainder++) {
          expect(cultivationGrowth({ lightEnergy: 0, water, fertilizer }, remainder)).toEqual(
            cultivationGrowth({ lightEnergy: water * 10, water: 0, fertilizer }, remainder),
          );
        }
      }
    }
    expect(cultivationGrowth({ lightEnergy: 0, water: 15, fertilizer: false }).total).toBe(1);
    expect(cultivationGrowth({ lightEnergy: 0, water: 150, fertilizer: false }).total).toBe(10);
    expect(cultivationGrowth({ lightEnergy: 0, water: 25, fertilizer: true }).total).toBe(2);
  });

  it.each([
    [100, 100],
    [-100, 100],
    [-100, -100],
    [100, -100],
    [0, 100],
    [100, 0],
    [0, 0],
  ])(
    'aims the nozzle at the root in direction (%s, %s) while keeping it at the pointer',
    (dx, dy) => {
      const pointer = { x: 200, y: 200 };
      const target = { x: 200 + dx, y: 200 + dy };
      const geometry = wateringGeometry(pointer, target);
      const angle = (geometry.angle * Math.PI) / 180;
      const nozzleX = geometry.mirrored ? -27.6 : 27.6;
      const nozzle = {
        x: geometry.can.x + nozzleX * Math.cos(angle) + 9.6 * Math.sin(angle),
        y: geometry.can.y + nozzleX * Math.sin(angle) - 9.6 * Math.cos(angle),
      };
      expect(nozzle.x).toBeCloseTo(pointer.x);
      expect(nozzle.y).toBeCloseTo(pointer.y);
      if (dx !== 0 || dy !== 0) {
        const difference =
          Math.atan2(pointer.y - geometry.can.y, pointer.x - geometry.can.x) - Math.atan2(dy, dx);
        expect(Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference)))).toBeLessThan(
          (35 * Math.PI) / 180,
        );
      }
      expect(geometry.mirrored).toBe(dx < 0);
      expect(Math.abs(geometry.angle)).toBeLessThanOrEqual(75);
      expect(Math.cos(angle)).toBeGreaterThan(0);
      expect(geometry.drops).toHaveLength(8);
      for (const drop of geometry.drops) {
        expect(drop.path.startsWith('M 200 200 Q ')).toBe(true);
        expect(Math.abs(drop.x - pointer.x)).toBeLessThanOrEqual(22);
        expect(drop.y - pointer.y).toBeGreaterThan(0);
        expect(drop.y - pointer.y).toBeLessThanOrEqual(27);
        expect(drop.path).not.toContain('NaN');
        expect(Number.isFinite(drop.x) && Number.isFinite(drop.y)).toBe(true);
        expect(Number.parseFloat(drop.delay)).toBeLessThanOrEqual(0);
        expect(Number.parseFloat(drop.delay)).toBeGreaterThan(-0.6);
      }
      expect(geometry.splashes).toHaveLength(12);
      for (const splash of geometry.splashes) {
        expect(splash.path.startsWith(`M ${target.x} ${target.y} Q `)).toBe(true);
        expect(Math.abs(splash.x - target.x)).toBeLessThanOrEqual(27);
        expect(Math.abs(splash.y - target.y)).toBeLessThanOrEqual(20);
      }
      expect(wateringGeometry(pointer, target)).toEqual(geometry);
      expect(Number.isFinite(geometry.angle)).toBe(true);
      const furtherTarget = { x: target.x * 5, y: target.y * 5 };
      if (furtherTarget.x < pointer.x === geometry.mirrored) {
        expect(wateringGeometry(pointer, furtherTarget).drops).toEqual(geometry.drops);
      }
    },
  );

  it('detects deliberate shaking after three substantial reversals', () => {
    const gesture = new TreeShakeGesture();
    expect(gesture.move(100, 0)).toBe(false);
    expect(gesture.move(140, 100)).toBe(false);
    expect(gesture.move(100, 200)).toBe(false);
    expect(gesture.move(140, 300)).toBe(false);
    expect(gesture.move(100, 400)).toBe(true);
    expect(gesture.move(140, 500)).toBe(false);
  });

  it('does not mistake jitter, one-way rotation, or an expired gesture for shaking', () => {
    const gesture = new TreeShakeGesture();
    for (let i = 0; i < 12; i++) expect(gesture.move(100 + (i % 2) * 5, i * 50)).toBe(false);
    gesture.reset();
    for (let i = 0; i < 8; i++) expect(gesture.move(i * 40, i * 100)).toBe(false);
    gesture.reset();
    gesture.move(100, 0);
    gesture.move(140, 100);
    gesture.move(100, 200);
    expect(gesture.move(140, 1600)).toBe(false);
    expect(gesture.move(100, 1700)).toBe(false);
    gesture.reset();
    expect(gesture.move(140, 1800)).toBe(false);
  });
});
