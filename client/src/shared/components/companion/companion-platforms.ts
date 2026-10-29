import { PET_WIDTH } from './companion-roaming';

/** An opt-in, visible horizontal ledge in viewport coordinates. */
export interface CompanionLedge {
  element: Element;
  left: number;
  right: number;
  top: number;
}

export interface CompanionPlatformPosition {
  x: number;
  /** Foot baseline in viewport coordinates, measured from the top. */
  y: number;
  jumping: boolean;
  onLedge: boolean;
  /** A pet standing on a card must not exit to the next tab from that card. */
  exitAllowed: boolean;
  direction?: 1 | -1;
  jumpDirection?: 'up' | 'down';
  progress?: number;
}

/**
 * Only explicit product surfaces are eligible. Ionic keeps old pages in the DOM,
 * so hidden pages, overlays and surfaces clipped under a scroll container are
 * excluded. Space is reserved above a card within the viewport for the full
 * 108px pet, while allowing it to extend above the content's scrolling region.
 */
export function visibleCompanionLedges(root: Document, baseY: number, width: number): CompanionLedge[] {
  const result: CompanionLedge[] = [];
  for (const element of Array.from(root.querySelectorAll('[data-companion-ledge]'))) {
    if (element.closest('.ion-page-hidden, [hidden], [inert], [aria-hidden="true"], ion-modal, ion-alert, ion-popover')) continue;
    const box = element.getBoundingClientRect();
    if (box.width < 36 || box.height < 8 || box.right <= 0 || box.left >= width) continue;
    const content = element.closest('ion-content');
    const clip = content?.getBoundingClientRect();
    const topLimit = Math.max(108, clip?.top ?? 0);
    const bottomLimit = Math.min(baseY - 14, clip?.bottom ?? baseY);
    // A partially scrolled-off edge is not a safe place to stand.
    if (box.top < topLimit || box.top > bottomLimit) continue;
    const style = root.defaultView?.getComputedStyle(element);
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0') continue;
    const left = Math.max(0, box.left), right = Math.min(width, box.right);
    const minX = Math.max(0, left - PET_WIDTH / 2 + 18);
    const maxX = Math.min(Math.max(0, width - PET_WIDTH), right - PET_WIDTH / 2 - 18);
    if (minX > maxX) continue;
    result.push({ element, left, right, top: box.top });
  }
  return result;
}

type Source = (baseY: number, width: number) => CompanionLedge[];
type Flight = { fromX: number; fromY: number; toX: number; toY: number; target: Element | null; elapsed: number; duration: number; falling: boolean };

/** Coordinates a pet's supported ledge, bounded walking and short jump arcs. */
export class CompanionPlatforms {
  private ledge: Element | null = null;
  private flight: Flight | null = null;
  private cooldown = 3.5;
  private lastY = 0;
  private readonly source: Source;
  private readonly random: () => number;

  constructor(root: Document, random: () => number = Math.random, source?: Source) {
    this.source = source ?? ((base, width) => visibleCompanionLedges(root, base, width));
    this.random = random;
  }

  reset(): void {
    this.ledge = null;
    this.flight = null;
    this.cooldown = 3.5;
    this.lastY = 0;
  }

  /** Resume normal support tracking after the player drops the pet. */
  adopt(element: Element | null, y: number): void {
    this.reset(); this.ledge = element; this.lastY = y; this.cooldown = 2;
  }

  /**
   * x is the existing roaming model's left edge. Call even while paused with
   * seconds = 0 to keep an engaged pet anchored when a scrollable card moves.
   */
  advance(seconds: number, x: number, baseY: number, width: number, enabled = true): CompanionPlatformPosition {
    if (!enabled) {
      this.reset();
      return {x, y: baseY, jumping: false, onLedge: false, exitAllowed: true};
    }
    const all = this.flight || this.ledge || (this.cooldown -= Math.max(0, seconds)) <= 0
      ? this.source(baseY, width) : [];
    if (this.flight) return this.advanceFlight(seconds, x, baseY, width, all);

    if (this.ledge) {
      const support = all.find(item => item.element === this.ledge);
      if (!support) {
        // The element may have been removed, filtered, or scrolled away.
        // Return to a safe visible tab edge instead of remaining suspended.
        this.ledge = null;
        this.cooldown = 4;
        if (seconds > 0 && this.lastY > 0 && this.lastY < baseY) {
          this.startFall(x, this.lastY, baseY, width);
          return this.advanceFlight(0, x, baseY, width, all);
        }
        return {x: this.clampX(x, width), y: baseY, jumping: false, onLedge: false, exitAllowed: true};
      }
      const min = Math.max(0, support.left - PET_WIDTH / 2 + 18);
      const max = Math.min(Math.max(0, width - PET_WIDTH), support.right - PET_WIDTH / 2 - 18);
      const bounded = Math.max(min, Math.min(x, Math.max(min, max)));
      const direction: 1 | -1 | undefined = x < min ? 1 : x > max ? -1 : undefined;
      this.cooldown -= Math.max(0, seconds);
      if (this.cooldown <= 0 && seconds > 0) {
        this.startFlight(bounded, support.top, this.chooseTarget(all, support, bounded, baseY, width), baseY, width);
        return this.advanceFlight(0, bounded, baseY, width, all);
      }
      this.lastY = support.top;
      return {x: bounded, y: support.top, jumping: false, onLedge: true, exitAllowed: false, direction};
    }

    if (this.cooldown <= 0 && seconds > 0 && x >= 0 && x <= Math.max(0, width - PET_WIDTH)) {
      const target = this.chooseTarget(all, null, x, baseY, width);
      if (target) {
        this.startFlight(this.clampX(x, width), baseY, target, baseY, width);
        return this.advanceFlight(0, x, baseY, width, all);
      }
      this.cooldown = 4 + this.random() * 4;
    }
    return {x, y: baseY, jumping: false, onLedge: false, exitAllowed: true};
  }

  private chooseTarget(all: CompanionLedge[], current: CompanionLedge | null, x: number, baseY: number, width: number): CompanionLedge | null {
    const y = current?.top ?? baseY;
    const center = x + PET_WIDTH / 2;
    const reachable = all.filter(item =>
      item.element !== current?.element && Math.abs(item.top - y) <= 220 &&
      (Math.abs(item.top - y) >= 14 || !!current && (item.left >= current.right + 4 || item.right <= current.left - 4)) &&
      Math.abs(Math.max(item.left + 18, Math.min(center, item.right - 18)) - center) <= 180 &&
      Math.max(0, item.left - PET_WIDTH / 2 + 18) <= Math.min(Math.max(0, width - PET_WIDTH), item.right - PET_WIDTH / 2 - 18) &&
      item.left < width && item.right > 0);
    if (!reachable.length || (current && this.random() < .3)) return null;
    return reachable[Math.min(reachable.length - 1, Math.floor(this.random() * reachable.length))];
  }

  private startFlight(x: number, y: number, target: CompanionLedge | null, baseY: number, width: number): void {
    const center = x + PET_WIDTH / 2;
    const targetX = target
      ? this.clampX(Math.max(target.left + 18, Math.min(center, target.right - 18)) - PET_WIDTH / 2, width)
      : this.clampX(x, width);
    const targetY = target?.top ?? baseY;
    this.flight = {fromX: x, fromY: y, toX: targetX, toY: targetY, target: target?.element ?? null, elapsed: 0,
      duration: Math.max(.55, Math.min(1.1, .55 + Math.abs(targetY - y) / 400)), falling: false};
    this.ledge = null;
  }

  private startFall(x: number, y: number, baseY: number, width: number): void {
    const safeX = this.clampX(x, width);
    this.flight = {fromX: safeX, fromY: y, toX: safeX, toY: baseY, target: null, elapsed: 0,
      duration: Math.max(.35, Math.min(.7, (baseY - y) / 400)), falling: true};
  }

  private advanceFlight(seconds: number, x: number, baseY: number, width: number, all: CompanionLedge[]): CompanionPlatformPosition {
    const flight = this.flight!;
    if (flight.target) {
      const target = all.find(item => item.element === flight.target);
      if (!target) {
        this.flight = null;
        this.cooldown = 4;
        if (seconds > 0 && this.lastY > 0 && this.lastY < baseY) {
          this.startFall(x, this.lastY, baseY, width);
          return this.advanceFlight(0, x, baseY, width, all);
        }
        return {x: this.clampX(x, width), y: baseY, jumping: false, onLedge: false, exitAllowed: true};
      }
      // Follow the destination if its card moves while the player scrolls.
      flight.toY = target.top;
      flight.toX = this.clampX(Math.max(target.left + 18, Math.min(flight.toX + PET_WIDTH / 2, target.right - 18)) - PET_WIDTH / 2, width);
    } else {
      flight.toY = baseY;
    }
    flight.elapsed += Math.max(0, seconds);
    const t = Math.min(1, flight.elapsed / flight.duration);
    const ease = t * t * (3 - 2 * t);
    const nextX = flight.fromX + (flight.toX - flight.fromX) * ease;
    const nextY = flight.fromY + (flight.toY - flight.fromY) * ease - (flight.falling ? 0 : Math.sin(Math.PI * t) * 34);
    this.lastY = nextY;
    if (t >= 1) {
      this.ledge = flight.target;
      this.flight = null;
      this.cooldown = 4 + this.random() * 4;
      return {x: nextX, y: flight.toY, jumping: false, onLedge: !!this.ledge, exitAllowed: !this.ledge};
    }
    return {x: nextX, y: nextY, jumping: true, onLedge: false, exitAllowed: false,
      jumpDirection: flight.toY < flight.fromY ? 'up' : 'down', progress: t,
      direction: flight.toX > flight.fromX ? 1 : flight.toX < flight.fromX ? -1 : undefined};
  }

  private clampX(x: number, width: number): number {
    return Math.max(0, Math.min(x, Math.max(0, width - PET_WIDTH)));
  }
}
