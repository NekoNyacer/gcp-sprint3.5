import type { CompanionLedge } from './companion-platforms';
import { PET_WIDTH } from './companion-roaming';

export const PET_DRAG_THRESHOLD = 8;
export const PET_PICKUP_SECONDS = .4;
export const PET_LANDING_SECONDS = .2;
const PET_HEIGHT = 108;
const GRAVITY = 1700;

export type CompanionDragPhase = 'idle' | 'pickup' | 'held' | 'falling' | 'landing';
export interface CompanionDragPosition {
  phase: CompanionDragPhase;
  x: number;
  /** Foot baseline, measured from the top of the viewport. */
  y: number;
  support: Element | null;
  /** True once a released drag has completed its landing hold. */
  settled: boolean;
  /** The caller must never change tabs while a drag/drop is active. */
  exitAllowed: boolean;
  /** Normalized current one-shot progress, for synchronizing sprite playback. */
  progress?: number;
}

/** Pure pointer-grip and gravity model. It never captures pointers or navigates. */
export class CompanionDrag {
  private currentPhase: CompanionDragPhase = 'idle';
  private currentX = 0;
  private currentY = 0;
  private pressed = false;
  private thresholdPassed = false;
  private startX = 0;
  private startY = 0;
  private gripX = 0;
  private gripY = 0;
  private elapsed = 0;
  private velocity = 0;
  private currentSupport: Element | null = null;
  private completed = false;
  private fallFrom = 0;
  private fallTarget = 0;

  get phase(): CompanionDragPhase { return this.currentPhase; }
  get x(): number { return this.currentX; }
  get y(): number { return this.currentY; }
  get support(): Element | null { return this.currentSupport; }
  /** Includes a pointer press that may still become an ordinary click. */
  get tracking(): boolean { return this.pressed; }
  get dragging(): boolean { return this.pressed && this.thresholdPassed; }
  /** Pickup/held/fall/landing; a below-threshold click is not an active drag. */
  get active(): boolean { return this.currentPhase !== 'idle'; }

  begin(pointerX: number, pointerY: number, petX: number, footY: number): boolean {
    if (![pointerX, pointerY, petX, footY].every(Number.isFinite)) return false;
    this.cancel();
    this.currentX = petX;
    this.currentY = footY;
    this.startX = pointerX;
    this.startY = pointerY;
    this.gripX = pointerX - petX;
    this.gripY = pointerY - footY;
    this.pressed = true;
    return true;
  }

  /** Returns true when this pointer gesture must suppress the ordinary click. */
  move(pointerX: number, pointerY: number, width: number, height: number, baseY: number): boolean {
    if (!this.pressed || ![pointerX, pointerY].every(Number.isFinite)) return false;
    if (!this.thresholdPassed) {
      if (Math.hypot(pointerX - this.startX, pointerY - this.startY) < PET_DRAG_THRESHOLD) return false;
      this.thresholdPassed = true;
      this.currentPhase = 'pickup';
      this.elapsed = 0;
    }
    // Preserve the exact point at which the player grabbed the pet; it must not
    // jump its centre under the pointer when the threshold is crossed.
    this.currentX = pointerX - this.gripX;
    this.currentY = pointerY - this.gripY;
    this.clamp(width, height, baseY);
    return true;
  }

  /** False means the player only clicked; leave normal pet interaction intact. */
  release(ledges: readonly CompanionLedge[], baseY: number, width: number, height: number): boolean {
    if (!this.pressed) return false;
    this.pressed = false;
    if (!this.thresholdPassed) return false;
    const floor = this.boundedBase(baseY, height);
    this.clamp(width, height, floor);
    this.currentPhase = 'falling';
    this.elapsed = 0;
    this.velocity = 0;
    this.currentSupport = null;
    this.completed = false;
    const target = this.landingTarget(ledges, floor);
    this.fallFrom = this.currentY;
    this.fallTarget = target.y;
    if (target.y <= this.currentY + .01) this.land(target.y, target.element);
    return true;
  }

  advance(seconds: number, ledges: readonly CompanionLedge[], baseY: number, width: number, height: number): CompanionDragPosition {
    const floor = this.boundedBase(baseY, height);
    this.clamp(width, height, floor);
    // A resumed/background frame must not turn into a teleport. Root normally
    // passes <=50ms; cap this independent model at100ms as a second boundary.
    const dt = Number.isFinite(seconds) ? Math.min(.1, Math.max(0, seconds)) : 0;
    if (this.currentPhase === 'pickup') {
      this.elapsed += dt;
      if (this.elapsed >= PET_PICKUP_SECONDS - 1e-8) this.currentPhase = 'held';
    } else if (this.currentPhase === 'falling') {
      const target = this.landingTarget(ledges, floor);
      this.fallTarget = target.y;
      const next = this.currentY + this.velocity * dt + .5 * GRAVITY * dt * dt;
      this.velocity += GRAVITY * dt;
      if (next >= target.y) this.land(target.y, target.element);
      else this.currentY = next;
    } else if (this.currentPhase === 'landing') {
      const support = this.currentSupport ? ledges.find(ledge => ledge.element === this.currentSupport && this.isHorizontalSupport(ledge)) : undefined;
      if (this.currentSupport && (!support || support.top < this.currentY - 1 || support.top > floor)) {
        // A card removed or scrolled away during landing is no longer support.
        this.currentPhase = 'falling';
        this.currentSupport = null;
        this.velocity = 0;
        this.elapsed = 0;
        this.fallFrom = this.currentY;
        this.fallTarget = floor;
      } else {
        this.currentY = support?.top ?? floor;
        this.elapsed += dt;
        if (this.elapsed >= PET_LANDING_SECONDS - 1e-8) {
          this.currentPhase = 'idle';
          this.thresholdPassed = false;
          this.completed = true;
        }
      }
    }
    return this.position();
  }

  /** Used for navigation, teardown or an interaction that takes ownership. */
  cancel(): void {
    this.currentPhase = 'idle';
    this.pressed = false;
    this.thresholdPassed = false;
    this.elapsed = 0;
    this.velocity = 0;
    this.currentSupport = null;
    this.completed = false;
  }

  private land(y: number, support: Element | null): void {
    this.currentY = y;
    this.currentSupport = support;
    this.currentPhase = 'landing';
    this.elapsed = 0;
    this.velocity = 0;
  }

  private landingTarget(ledges: readonly CompanionLedge[], baseY: number): { y: number; element: Element | null } {
    const base = this.safeBase(baseY);
    const support = ledges.filter(ledge => this.isHorizontalSupport(ledge) &&
      Number.isFinite(ledge.top) && ledge.top >= this.currentY - .01 && ledge.top < base)
      .sort((a, b) => a.top - b.top)[0];
    return support ? { y: support.top, element: support.element } : { y: base, element: null };
  }

  private isHorizontalSupport(ledge: CompanionLedge): boolean {
    const feetX = this.currentX + PET_WIDTH / 2;
    return Number.isFinite(ledge.left) && Number.isFinite(ledge.right) &&
      ledge.right - ledge.left >= 36 && feetX >= ledge.left + 18 && feetX <= ledge.right - 18;
  }

  private safeBase(baseY: number): number { return Number.isFinite(baseY) ? Math.max(0, baseY) : 0; }
  private boundedBase(baseY: number, height: number): number {
    return Math.min(Number.isFinite(height) ? Math.max(0, height) : 0, this.safeBase(baseY));
  }

  private clamp(width: number, height: number, baseY: number): void {
    const safeWidth = Number.isFinite(width) ? Math.max(0, width) : PET_WIDTH;
    const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
    const floor = Math.min(safeHeight, this.safeBase(baseY));
    this.currentX = Math.min(Math.max(0, safeWidth - PET_WIDTH), Math.max(0, this.currentX));
    this.currentY = Math.min(floor, Math.max(Math.min(PET_HEIGHT, floor), this.currentY));
  }

  private position(): CompanionDragPosition {
    const progress = this.currentPhase === 'pickup' ? Math.min(1, this.elapsed / PET_PICKUP_SECONDS) :
      this.currentPhase === 'landing' ? Math.min(1, this.elapsed / PET_LANDING_SECONDS) :
      this.currentPhase === 'falling' ? Math.min(1, Math.max(0, (this.currentY - this.fallFrom) / Math.max(.01, this.fallTarget - this.fallFrom))) : undefined;
    return { phase: this.currentPhase, x: this.currentX, y: this.currentY,
      support: this.currentSupport, settled: this.completed,
      exitAllowed: this.currentPhase === 'idle' && !this.pressed, progress };
  }
}
