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

/** Positions are CSS pixels; elapsed time is capped by the caller after suspension. */
export class CompanionRoaming {
  x = 16;
  direction: 1 | -1 = 1;
  behavior: AutonomousBehavior = 'walking';
  private remaining = 10;

  constructor(private readonly random: () => number = Math.random) {}

  advance(seconds: number, viewportWidth: number): 1 | -1 | null {
    this.remaining -= seconds;
    if (this.remaining <= 0) this.chooseBehavior();
    if (this.behavior !== 'walking') return null;
    this.x += this.direction * 96 * seconds;
    if (this.direction === 1 && this.x >= viewportWidth + 8) {
      return 1;
    } else if (this.direction === -1 && this.x <= -PET_WIDTH - 8) {
      return -1;
    }
    return null;
  }

  enterFromEdge(direction: 1 | -1, viewportWidth: number): void {
    this.direction = direction;
    this.x = direction === 1 ? -PET_WIDTH : viewportWidth;
    this.remaining = Math.max(this.remaining, 3.4);
  }

  keepVisible(viewportWidth: number): void {
    this.x = Math.max(4, Math.min(this.x, Math.max(4, viewportWidth - PET_WIDTH - 4)));
  }

  private chooseBehavior(): void {
    const choice = this.random();
    this.behavior = choice < .48 ? 'walking' : choice < .60 ? 'idle' : choice < .77 ? 'feeding' : choice < .90 ? 'playing' : 'sleeping';
    this.remaining = this.behavior === 'sleeping' ? 10 + this.random() * 15 :
      this.behavior === 'walking' ? 6 + this.random() * 9 : 3 + this.random() * 5;
    if (this.behavior === 'walking' && this.random() < .35) {
      this.direction = this.direction === 1 ? -1 : 1;
    }
  }
}
