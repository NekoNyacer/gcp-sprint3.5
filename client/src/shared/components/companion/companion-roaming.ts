export const PET_WIDTH = 128;
export const COMPANION_TABS = ['home', 'task', 'shop', 'collection', 'profile'] as const;
export type CompanionTab = typeof COMPANION_TABS[number];
export type AutonomousBehavior = 'walking' | 'idle' | 'feeding' | 'playing' | 'sleeping';

export function companionTab(url: string): CompanionTab | null {
  const root = url.split(/[?#]/)[0].split('/')[1];
  return COMPANION_TABS.find(tab => tab === root) ?? null;
}

export function adjacentTab(tab: CompanionTab, direction: 1 | -1): CompanionTab {
  return COMPANION_TABS[(COMPANION_TABS.indexOf(tab) + direction + COMPANION_TABS.length) % COMPANION_TABS.length];
}

/** Player-controlled dragging follows the visible bar and never wraps. */
export function adjacentDragTab(tab: CompanionTab, direction: 1 | -1): CompanionTab | null {
  return COMPANION_TABS[COMPANION_TABS.indexOf(tab) + direction] ?? null;
}

/** Positions are CSS pixels; elapsed time is capped by the caller after suspension. */
export class CompanionRoaming {
  x = 16;
  direction: 1 | -1 = 1;
  behavior: AutonomousBehavior = 'walking';
  private remaining = .48;
  private burstDuration = .48;
  private burstElapsed = 0;
  private burstSpeed = 330;

  constructor(private readonly random: () => number = Math.random) {}

  advance(seconds: number, viewportWidth: number): 1 | -1 | null {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    // Integrate each burst independently of render rate. Acceleration/braking
    // take only 35ms; the animal visibly stops between every pair of sprints.
    let elapsed = Math.min(seconds, 30);
    for (let transitions = 0; elapsed > 1e-8 && transitions < 100; transitions++) {
      const step = Math.min(elapsed, Math.max(0, this.remaining));
      if (this.behavior === 'walking') {
        this.x += this.direction * this.burstSpeed *
          (this.burstTravel(this.burstElapsed + step) - this.burstTravel(this.burstElapsed));
        this.burstElapsed += step;
      }
      this.remaining -= step;
      elapsed -= step;
      if (this.direction === 1 && this.x >= viewportWidth + 8) return 1;
      if (this.direction === -1 && this.x <= -PET_WIDTH - 8) return -1;
      if (this.remaining <= 1e-8) this.chooseBehavior(viewportWidth);
    }
    return null;
  }

  enterFromEdge(direction: 1 | -1, viewportWidth: number): void {
    this.direction = direction;
    this.x = direction === 1 ? -PET_WIDTH : viewportWidth;
    this.startBurst(.55 + this.random() * .15);
  }

  keepVisible(viewportWidth: number): void {
    this.x = Math.max(4, Math.min(this.x, Math.max(4, viewportWidth - PET_WIDTH - 4)));
  }

  observeFor(seconds = .8): void {
    this.behavior = 'idle'; this.remaining = seconds;
  }

  private chooseBehavior(viewportWidth: number): void {
    const choice = this.random();
    if (this.behavior === 'walking') {
      // Most stops are alert observation. Longer activities remain occasional.
      this.behavior = choice < .78 ? 'idle' : choice < .90 ? 'feeding' : choice < .98 ? 'playing' : 'sleeping';
    } else {
      this.behavior = choice < .80 ? 'walking' : choice < .88 ? 'idle' : choice < .94 ? 'feeding' : choice < .98 ? 'playing' : 'sleeping';
    }
    if (this.behavior === 'walking') {
      if (this.x < 0) this.direction = 1;
      else if (this.x > viewportWidth - PET_WIDTH) this.direction = -1;
      else if (this.random() < .22) this.direction = this.direction === 1 ? -1 : 1;
      this.startBurst(.28 + this.random() * .34);
    } else this.remaining = this.behavior === 'idle' ? .35 + this.random() * .85 :
      this.behavior === 'feeding' ? 3.5 + this.random() * 2.5 :
      this.behavior === 'playing' ? 1.6 + this.random() * 1.2 : 9 + this.random() * 8;
  }

  private startBurst(duration: number): void {
    this.behavior = 'walking';
    this.remaining = this.burstDuration = duration;
    this.burstElapsed = 0;
    this.burstSpeed = 280 + this.random() * 140;
  }

  private burstTravel(elapsed: number): number {
    const t = Math.min(this.burstDuration, elapsed), ramp = .035;
    if (t <= ramp) return t * t / (2 * ramp);
    if (t <= this.burstDuration - ramp) return t - ramp / 2;
    const tail = t - (this.burstDuration - ramp);
    return this.burstDuration - 1.5 * ramp + tail - tail * tail / (2 * ramp);
  }
}
