import { TREE_ORNAMENTS } from './tree-appearance';
import {
  LIGHT_ENERGY_PER_SECOND,
  TREE_GROWTH_PER_HARVEST,
  TREE_WEED_PENALTY_THRESHOLD,
  TREE_WEEDS_ENABLED,
} from '../../environments/environment-dev';

export type TreeStage =
  | 'seed'
  | 'seedling'
  | 'smallSapling'
  | 'largeSapling'
  | 'young'
  | 'mature'
  | 'flowering'
  | 'large';
export const TREE_STAGE_GROWTH_RATIOS = {
  seed: 0,
  seedling: 0.1,
  smallSapling: 0.16,
  largeSapling: 0.23,
  young: 0.3,
  mature: 0.6,
  flowering: 0.85,
  large: 1,
} as const satisfies Record<TreeStage, number>;
export const TREE_MAX_MODEL_LEVEL = 3;
export type TreeWaterState = 'normal' | 'dry' | 'watered';
export const TREE_WATERED_DURATION_MS = 24 * 60 * 60 * 1000;
export const TREE_DRY_AFTER_MS = 7 * TREE_WATERED_DURATION_MS;
export const TREE_WATER_STATE_LABELS: Record<TreeWaterState, string> = {
  normal: '正常',
  dry: '缺水',
  watered: '已澆水',
};
export const TREE_SOIL_COLORS: Record<TreeWaterState, number> = {
  normal: 0x9b7048,
  dry: 0xbf986c,
  watered: 0x61432e,
};
export const TREE_SOIL_SPARKLES = [
  { x: 15, y: 48, delay: 0 },
  { x: 28, y: 28, delay: -1.1 },
  { x: 40, y: 68, delay: -0.4 },
  { x: 55, y: 36, delay: -1.6 },
  { x: 67, y: 65, delay: -0.8 },
  { x: 80, y: 42, delay: -1.3 },
];

export function treeWaterState(
  lastWateredAt: number | null,
  plantedAt: number,
  now = Date.now(),
): TreeWaterState {
  const elapsed = now - (lastWateredAt ?? plantedAt);
  if (lastWateredAt !== null && elapsed < TREE_WATERED_DURATION_MS) return 'watered';
  return elapsed > TREE_DRY_AFTER_MS ? 'dry' : 'normal';
}

export function treeStage(growth: number, target = TREE_GROWTH_PER_HARVEST): TreeStage {
  if (!Number.isSafeInteger(target) || target <= 0) {
    throw new RangeError('收成目標必須是大於零的安全整數。');
  }
  if (growth >= target * TREE_STAGE_GROWTH_RATIOS.large) return 'large';
  if (growth >= target * TREE_STAGE_GROWTH_RATIOS.flowering) return 'flowering';
  if (growth >= target * TREE_STAGE_GROWTH_RATIOS.mature) return 'mature';
  if (growth >= target * TREE_STAGE_GROWTH_RATIOS.young) return 'young';
  if (growth >= target * TREE_STAGE_GROWTH_RATIOS.largeSapling) return 'largeSapling';
  if (growth >= target * TREE_STAGE_GROWTH_RATIOS.smallSapling) return 'smallSapling';
  if (growth >= target * TREE_STAGE_GROWTH_RATIOS.seedling) return 'seedling';
  return 'seed';
}

export const TREE_STAGE_LABELS: Record<TreeStage, string> = {
  seed: '種子',
  seedling: '幼苗',
  smallSapling: '小樹苗',
  largeSapling: '大樹苗',
  young: '小樹',
  mature: '大樹',
  flowering: '開花',
  large: '結果',
};

export const TREE_STAGES = Object.keys(TREE_STAGE_GROWTH_RATIOS) as TreeStage[];
const TREE_STAGE_SCALES: Record<TreeStage, readonly [number, number]> = {
  seed: [1, 1.2],
  seedling: [0.12, 0.24],
  smallSapling: [0.24, 0.38],
  largeSapling: [0.38, 0.55],
  young: [0.55, 0.78],
  mature: [0.78, 0.83],
  flowering: [0.83, 0.85],
  large: [0.85, 0.85],
};

/** Absolute size from credited growth; repeated care never compounds the scale. */
export function treeVisualScale(growth: number, target = TREE_GROWTH_PER_HARVEST): number {
  const stage = treeStage(growth, target);
  const index = TREE_STAGES.indexOf(stage);
  const start = TREE_STAGE_GROWTH_RATIOS[stage];
  const end = TREE_STAGE_GROWTH_RATIOS[TREE_STAGES[index + 1]] ?? 1;
  const progress =
    end > start ? Math.max(0, Math.min(1, (growth / target - start) / (end - start))) : 1;
  const [from, to] = TREE_STAGE_SCALES[stage];
  return from + (to - from) * progress;
}

export type CultivationAllocation = {
  lightEnergy: number;
  water: boolean | number;
  fertilizer: boolean;
};

export const FERTILIZER_DURATION_MS = 24 * 60 * 60 * 1000;
export const LIGHT_ENERGY_PER_GROWTH = 150;
export const WATER_LIGHT_EQUIVALENT = 10;
export const WATER_DROPS_PER_GROWTH = LIGHT_ENERGY_PER_GROWTH / WATER_LIGHT_EQUIVALENT;
export const DAILY_LIGHT_ENERGY_LIMIT = 7500;
export const CARE_GROWTH_PRECISION = LIGHT_ENERGY_PER_GROWTH * 50;
export const DEMO_HARVEST_POINTS = 50;
export const DEMO_HARVEST_DURATION_MS = 1150;
export const DEMO_HARVEST_RECOVERY_DURATION_MS = 24 * 60 * 60 * 1000;
export const DEMO_FRUIT_ICON = 'images/assets/tree-point-particle.svg';
export const DEMO_FRUIT_FALL_DURATION_MS = DEMO_HARVEST_DURATION_MS - 180;
export const TREE_SWAY_MAX_DEGREES = 1.6;

export function treeParticleRandom(index: number, salt: number): number {
  let value = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function treeCanopyCenters(height: number) {
  return [
    { x: 0, y: height + 0.2, z: 0 },
    { x: -0.35, y: height, z: 0.05 },
    { x: 0.35, y: height + 0.1, z: 0.05 },
    { x: -0.12, y: height + 0.15, z: -0.35 },
    { x: 0.15, y: height + 0.15, z: 0.35 },
  ];
}

export const DEMO_FRUIT_PARTICLES = Array.from({ length: DEMO_HARVEST_POINTS }, (_, index) => {
  const center = TREE_ORNAMENTS[index % TREE_ORNAMENTS.length];
  const visibleWhenRipe = index < TREE_ORNAMENTS.length;
  return {
    x: 160 + center.x * 58 * 0.85,
    y: 210 - center.y * 58 * 0.85,
    origin: { x: center.x, y: center.y, z: center.z + 0.04 },
    visibleWhenRipe,
    landingX:
      160 +
      Math.cos(treeParticleRandom(index, 1) * Math.PI * 2) *
        Math.sqrt(treeParticleRandom(index, 2)) *
        68,
    landingY:
      211 +
      Math.sin(treeParticleRandom(index, 1) * Math.PI * 2) *
        Math.sqrt(treeParticleRandom(index, 2)) *
        7,
    delayMs: (index % 10) * 20,
  };
});

/** Seeded scatter, damped bounces, rolling and individual fade. No physics engine. */
export function harvestPointMotion(
  index: number,
  progress: number,
  origin: { x: number; y: number; z: number },
) {
  const t = Math.max(0, Math.min(1, progress));
  const particle = DEMO_FRUIT_PARTICLES[index];
  const impact = 0.42 + treeParticleRandom(index, 3) * 0.17;
  const fall = Math.min(1, t / impact) ** 2;
  const landed = Math.max(0, (t - impact) / (1 - impact));
  const roll = 1 - (1 - landed) ** 2;
  const angle = treeParticleRandom(index, 4) * Math.PI * 2;
  const distance = 0.1 + treeParticleRandom(index, 5) * 0.25;
  const x = (particle.landingX - 160) / 85;
  const z = (particle.landingY - 211) / 10;
  return {
    x: origin.x * (1 - fall) + x * fall + Math.cos(angle) * distance * roll,
    y:
      origin.y * (1 - fall) +
      0.03 * fall +
      Math.abs(Math.sin(landed * Math.PI * (2 + treeParticleRandom(index, 6) * 2))) *
        (1 - landed) ** 2 *
        (0.12 + treeParticleRandom(index, 7) * 0.16),
    z: origin.z * (1 - fall) + z * fall + Math.sin(angle) * distance * roll,
    spin: (treeParticleRandom(index, 8) - 0.5) * Math.PI * (t + roll * 4),
    opacity: 1 - Math.min(1, Math.max(0, (t - 0.76 - treeParticleRandom(index, 9) * 0.08) / 0.16)),
  };
}
export type TreeFruitState = 'none' | 'ripe' | 'falling';
export type CareResource = 'light' | 'water' | 'fertilizer';
export type StreamingCareResource = 'light' | 'water';
export type CarePoint = { x: number; y: number };
export type CareTarget = CarePoint & {
  radius: number;
  modelX: number;
  modelY: number;
  rootX: number;
  rootY: number;
  soil: CarePoint & { width: number; height: number };
};

export function wateringGeometry(pointer: CarePoint, target: CarePoint) {
  const direction = Math.atan2(target.y - pointer.y, target.x - pointer.x);
  const mirrored = pointer.x > target.x;
  // Nozzle center (74.5, 28) in the 80-unit SVG, displayed at 64 pixels.
  const nozzleOffset = { x: (74.5 - 40) * 0.8 * (mirrored ? -1 : 1), y: (28 - 40) * 0.8 };
  const rotation = direction - Math.atan2(nozzleOffset.y, nozzleOffset.x);
  // Keep the opening upright even when the root is almost directly above or below it.
  const angleDegrees = Math.max(
    -75,
    Math.min(75, (Math.atan2(Math.sin(rotation), Math.cos(rotation)) * 180) / Math.PI),
  );
  const angle = (angleDegrees * Math.PI) / 180;
  const rotated = {
    x: nozzleOffset.x * Math.cos(angle) - nozzleOffset.y * Math.sin(angle),
    y: nozzleOffset.x * Math.sin(angle) + nozzleOffset.y * Math.cos(angle),
  };
  const can = { x: pointer.x - rotated.x, y: pointer.y - rotated.y };
  const side = mirrored ? -1 : 1;
  const dropCount = 8;
  const drops = Array.from({ length: dropCount }, (_, index) => {
    const end = {
      x: pointer.x + side * (12 + (index % 3) * 5),
      y: pointer.y + 22 + (index % 2) * 5,
    };
    const control = { x: end.x, y: pointer.y + 4 };
    const t = (index + 1) / (dropCount + 1);
    const u = 1 - t;
    return {
      x: u ** 2 * pointer.x + 2 * u * t * control.x + t ** 2 * end.x,
      y: u ** 2 * pointer.y + 2 * u * t * control.y + t ** 2 * end.y,
      path: `M ${pointer.x} ${pointer.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`,
      rx: 2 + (index % 3) * 0.4,
      ry: 1.4 + (index % 2) * 0.3,
      delay: `${(-index * 0.6) / dropCount}s`,
    };
  });
  const splashes = Array.from({ length: 12 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const end = { x: target.x + side * (12 + (index % 6) * 3), y: target.y + 3 + (index % 3) * 2 };
    const control = { x: (target.x + end.x) / 2, y: target.y - 8 - (index % 4) * 4 };
    const t = (index + 1) / 13;
    const u = 1 - t;
    return {
      x: u ** 2 * target.x + 2 * u * t * control.x + t ** 2 * end.x,
      y: u ** 2 * target.y + 2 * u * t * control.y + t ** 2 * end.y,
      path: `M ${target.x} ${target.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`,
      radius: 1.5 + (index % 3) * 0.3,
      delay: `${(-index * 0.45) / 12}s`,
    };
  });
  return {
    can,
    mirrored,
    angle: angleDegrees,
    nozzle: pointer,
    target,
    drops,
    splashes,
  };
}

export class TreeShakeGesture {
  private anchor: number | null = null;
  private startedAt = 0;
  private direction = 0;
  private reversals = 0;

  move(x: number, now: number): boolean {
    if (this.anchor === null || now - this.startedAt > 1500) {
      this.anchor = x;
      this.startedAt = now;
      this.direction = 0;
      this.reversals = 0;
      return false;
    }
    const distance = x - this.anchor;
    if (Math.abs(distance) < 18) return false;
    const direction = Math.sign(distance);
    if (this.direction && direction !== this.direction) this.reversals++;
    this.direction = direction;
    this.anchor = x;
    if (this.reversals < 3) return false;
    this.reset();
    return true;
  }

  reset(): void {
    this.anchor = null;
    this.direction = 0;
    this.reversals = 0;
  }
}

export function weedPenaltyActive(count: number): boolean {
  return TREE_WEEDS_ENABLED && count >= TREE_WEED_PENALTY_THRESHOLD;
}

export function treeWeedPosition(id: number) {
  return {
    x: (id % 2 === 0 ? 14 : 62) + ((id * 17) % 25),
    y: 32 + ((id * 19) % 48),
  };
}

export function cultivationGrowth(
  allocation: CultivationAllocation,
  growthRemainder = 0,
  weedDebuff = false,
) {
  const water = waterDropCount(allocation.water);
  const lightEquivalent = allocation.lightEnergy + water * WATER_LIGHT_EQUIVALENT;
  const penalized = weedDebuff;
  const base = (lightEquivalent / LIGHT_ENERGY_PER_GROWTH) * (penalized ? 0.9 : 1);
  const bonus = allocation.fertilizer ? base / 5 : 0;
  // 50/60 ticks per light, or 45/54 with weeds, keep both multipliers exact.
  const ticks =
    lightEquivalent * (allocation.fertilizer ? 6 : 5) * (penalized ? 9 : 10) + growthRemainder;
  return {
    base,
    bonus,
    total: Math.floor(ticks / CARE_GROWTH_PRECISION),
    remainder: ticks % CARE_GROWTH_PRECISION,
  };
}

export function waterDropCount(water: boolean | number): number {
  return typeof water === 'boolean' ? Number(water) : water;
}

export function fertilizerActive(expiresAt: number | null, now = Date.now()): boolean {
  return expiresAt !== null && now < expiresAt;
}

export class ResourceFeedingClock {
  private previousTime: number;
  private activeSince: number | null = null;
  private completedActiveMs = 0;
  private delivered = 0;

  constructor(
    now: number,
    private readonly unitsPerSecond = LIGHT_ENERGY_PER_SECOND,
  ) {
    this.previousTime = now;
  }

  take(now: number, feeding: boolean): number {
    if (feeding && this.activeSince === null) this.activeSince = this.previousTime;
    if (!feeding && this.activeSince !== null) {
      this.completedActiveMs += this.previousTime - this.activeSince;
      this.activeSince = null;
    }
    this.previousTime = now;
    // Measure active stretches, rather than accumulating rounded per-frame energy.
    const activeMs =
      this.completedActiveMs + (this.activeSince === null ? 0 : now - this.activeSince);
    const whole = Math.floor((activeMs * this.unitsPerSecond) / 1000);
    const amount = whole - this.delivered;
    this.delivered = whole;
    return amount;
  }
}

export function taipeiDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
