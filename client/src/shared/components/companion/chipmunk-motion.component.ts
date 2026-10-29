import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, signal } from '@angular/core';

export type ChipmunkAction = 'idle' | 'greeting' | 'feeding' | 'playing' | 'walking' | 'petted' | 'sleeping'
  | 'jumping' | 'jumping-up' | 'jumping-down' | 'pickup' | 'held' | 'falling'
  | 'petting-head' | 'petting-belly' | 'thinking' | 'success' | 'confused';

export interface ChipmunkClip {
  path: string;
  columns: number;
  rows: number;
  frames: number;
  fps: number;
  loop: boolean;
  /** Transparent padding beneath the registered foot baseline, in source pixels. */
  footInset?: number;
  sequence?: readonly number[];
  durations?: readonly number[];
}

const ANIMATIONS = '/images/pet/animations/';
/** Frame geometry and timing are kept here rather than inferred from a PNG's dimensions. */
export const CHIPMUNK_CLIPS: Partial<Record<ChipmunkAction, ChipmunkClip>> = {
  walking: {path: ANIMATIONS + 'run-contact-review.png', columns: 5, rows: 2, frames: 10, fps: 26, loop: true, footInset: 14},
  jumping: {path: ANIMATIONS + 'jump-food-prepared/jump-v3-atlas.png', columns: 4, rows: 3, frames: 12, fps: 12, loop: false, footInset: 40},
  pickup: {path: ANIMATIONS + 'drag-drop/pickup-atlas.png', columns: 2, rows: 2, frames: 4, fps: 10, loop: false, footInset: 24, durations: [80,90,110,120]},
  held: {path: ANIMATIONS + 'drag-drop/held-atlas.png', columns: 2, rows: 2, frames: 4, fps: 6, loop: true, footInset: 24, durations: [220,160,220,160]},
  falling: {path: ANIMATIONS + 'drag-drop/falling-atlas.png', columns: 4, rows: 2, frames: 8, fps: 14, loop: false, footInset: 24, durations: [60,60,80,80,70,70,70,110]},
  'jumping-up': {path: ANIMATIONS + 'drag-drop/jumping-up-atlas.png', columns: 4, rows: 2, frames: 8, fps: 10, loop: false, footInset: 24, durations: [100,90,100,110,110,100,100,90]},
  'jumping-down': {path: ANIMATIONS + 'drag-drop/jumping-down-atlas.png', columns: 4, rows: 2, frames: 8, fps: 10, loop: false, footInset: 24, durations: [100,90,100,110,110,100,100,90]},
  sleeping: {path: ANIMATIONS + 'drag-drop/sleeping-atlas.png', columns: 4, rows: 2, frames: 8, fps: 3, loop: true, footInset: 24, durations: [400,300,300,400,400,300,300,400]},
  feeding: {path: ANIMATIONS + 'jump-food-prepared/food-sequence-v4-atlas.png', columns: 4, rows: 5, frames: 20, fps: 8, loop: false, footInset: 40},
  playing: {path: ANIMATIONS + 'registered-interactions/play-atlas.png', columns: 4, rows: 2, frames: 8, fps: 5, loop: false, footInset: 46},
  greeting: {path: ANIMATIONS + 'registered-interactions/attention-atlas.png', columns: 4, rows: 2, frames: 8, fps: 6, loop: false, footInset: 46},
  idle: {
    path: ANIMATIONS + 'registered-blink/blink-study-atlas.png', columns: 4, rows: 2, frames: 8, fps: 12, loop: true, footInset: 46,
    sequence: [0, 1, 2, 3, 4, 3, 2, 1], durations: [1200, 83, 83, 83, 125, 83, 83, 83],
  },
  petted: {path: ANIMATIONS + 'registered-closeups/head-rub-atlas.png', columns: 4, rows: 2, frames: 8, fps: 6, loop: false, footInset: 46},
  'petting-head': {path: ANIMATIONS + 'registered-closeups/head-rub-atlas.png', columns: 4, rows: 2, frames: 8, fps: 6, loop: false, footInset: 46},
  'petting-belly': {path: ANIMATIONS + 'registered-closeups/belly-rub-atlas.png', columns: 4, rows: 2, frames: 8, fps: 6, loop: false, footInset: 46},
  thinking: {path: ANIMATIONS + 'agent-states/thinking-atlas.png', columns: 4, rows: 2, frames: 8, fps: 6, loop: true, footInset: 46},
  success: {path: ANIMATIONS + 'agent-states/success-atlas.png', columns: 4, rows: 2, frames: 8, fps: 6, loop: false, footInset: 46},
  confused: {path: ANIMATIONS + 'agent-states/confused-atlas.png', columns: 4, rows: 2, frames: 8, fps: 6, loop: false, footInset: 46},
};

/** One authored pass in milliseconds, including held key poses. */
export function chipmunkClipDuration(clip: ChipmunkClip): number {
  const frames = clip.sequence?.length ?? clip.frames;
  return clip.durations?.length === frames ? clip.durations.reduce((sum, value) => sum + value, 0) : frames * 1000 / clip.fps;
}

/** Return the authored frame and whether a one-shot has reached its final pose. */
export function chipmunkFrameAt(clip: ChipmunkClip, elapsedMs: number): {index: number; ended: boolean} {
  const sequence = clip.sequence ?? Array.from({length: clip.frames}, (_, index) => index);
  if (clip.durations?.length === sequence.length) {
    const total = clip.durations.reduce((sum, duration) => sum + duration, 0);
    let elapsed = clip.loop ? Math.max(0, elapsedMs) % total : Math.min(Math.max(0, elapsedMs), total - 1);
    let index = 0;
    while (index < sequence.length - 1 && elapsed >= clip.durations[index]) elapsed -= clip.durations[index++];
    return {index: sequence[index], ended: !clip.loop && elapsedMs >= total};
  }
  const raw = Math.floor(Math.max(0, elapsedMs) * clip.fps / 1000);
  return {index: sequence[clip.loop ? raw % sequence.length : Math.min(raw, sequence.length - 1)],
    ended: !clip.loop && raw >= sequence.length};
}

/** Render authored poses, retaining a static fallback and the gentle sleeping mesh. */
@Component({
  selector: 'chipmunk-motion',
  template: `
    <img #source [src]="imageSource" alt="" aria-hidden="true"
      [style.visibility]="canvasReady() ? 'hidden' : 'visible'" (load)="imageLoaded()" />
    <canvas #canvas aria-hidden="true" [style.visibility]="canvasReady() ? 'visible' : 'hidden'"></canvas>
  `,
  styles: [`
    :host { position: relative; display: block; width: 100%; height: 100%; }
    img, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: center bottom; }
  `],
})
export class ChipmunkMotionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('source', { static: true }) private source!: ElementRef<HTMLImageElement>;
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  private readonly atlases = new Map<string, HTMLImageElement>();
  private readonly failedAtlases = new Set<string>();
  private readonly atlasCacheLimit = 3;

  private currentAction: ChipmunkAction = 'idle';
  @Input() set action(value: ChipmunkAction) {
    const previousSource = this.imageSource;
    const changed = this.currentAction !== value;
    this.currentAction = value;
    if (changed) this.actionStart = performance.now();
    if (previousSource !== this.imageSource) {
      cancelAnimationFrame(this.frame);
      this.canvasReady.set(false);
    }
    if (changed) this.syncAnimation();
  }
  get action(): ChipmunkAction { return this.currentAction; }
  get imageSource(): string {
    if (this.action === 'sleeping') return '/images/pet/animations/drag-drop/sleeping-static.png';
    const pose = this.action === 'walking' ? 'running' : this.action === 'feeding' ? 'eating' :
      'neutral';
    return `/images/pet/chipmunk-${pose}.png`;
  }
  @Input() set actionSerial(_value: number) { this.actionStart = performance.now(); this.syncAnimation(); }
  /** Optional normalized physical trajectory progress for jumps/falls. */
  @Input() clipProgress: number | null = null;
  @Input() set active(value: boolean) {
    this.enabled = value;
    this.syncAnimation();
  }

  readonly canvasReady = signal(false);
  private enabled = true;
  private initialized = false;
  private visible = true;
  private frame = 0;
  private startTime = 0;
  private actionStart = 0;
  private reducedMotion?: MediaQueryList;
  private observer?: IntersectionObserver;
  private readonly onPreferenceChange = () => this.syncAnimation();
  private readonly onVisibilityChange = () => this.syncAnimation();
  private readonly subdivisions = 12;

  ngAfterViewInit(): void {
    this.initialized = true;
    if (!this.actionStart) this.actionStart = performance.now();
    if (typeof window.matchMedia === 'function') {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion.addEventListener('change', this.onPreferenceChange);
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.syncAnimation();
      });
      this.observer.observe(this.canvas.nativeElement);
    }
    this.syncAnimation();
  }

  imageLoaded(): void { this.syncAnimation(); }

  ngOnDestroy(): void {
    this.initialized = false;
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.reducedMotion?.removeEventListener('change', this.onPreferenceChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    for (const image of this.atlases.values()) this.releaseAtlas(image);
    this.atlases.clear();
    this.failedAtlases.clear();
  }

  private releaseAtlas(image: HTMLImageElement): void {
    image.onload = null;
    image.onerror = null;
    image.removeAttribute('src');
  }

  private atlasFor(clip: ChipmunkClip): HTMLImageElement | null {
    if (this.failedAtlases.has(clip.path)) return null;
    let image = this.atlases.get(clip.path);
    if (image) {
      // Refresh insertion order so only the least recently used image is released.
      this.atlases.delete(clip.path);
      this.atlases.set(clip.path, image);
    } else {
      if (this.atlases.size >= this.atlasCacheLimit) {
        const oldest = this.atlases.entries().next().value;
        if (oldest) {
          this.atlases.delete(oldest[0]);
          this.releaseAtlas(oldest[1]);
        }
      }
      image = new Image();
      this.atlases.set(clip.path, image);
      const requestedImage = image;
      image.onload = () => {
        if (this.initialized && this.atlases.get(clip.path) === requestedImage &&
          CHIPMUNK_CLIPS[this.action]?.path === clip.path) {
          // Start the authored sequence when it actually becomes visible.
          this.actionStart = performance.now();
          this.syncAnimation();
        }
      };
      image.onerror = () => {
        if (this.atlases.get(clip.path) !== requestedImage) return;
        this.failedAtlases.add(clip.path);
        this.atlases.delete(clip.path);
        this.releaseAtlas(requestedImage);
        this.syncAnimation();
      };
      image.src = clip.path;
    }
    return image;
  }

  private syncAnimation(): void {
    if (!this.initialized) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    const clip = CHIPMUNK_CLIPS[this.action];
    if (clip && this.enabled) this.atlasFor(clip);
    const image = this.source.nativeElement;
    const shouldAnimate = this.enabled && this.visible && !document.hidden && !this.reducedMotion?.matches;
    if (!shouldAnimate || !image.complete || !image.naturalWidth) {
      this.canvasReady.set(false);
      return;
    }
    let context: CanvasRenderingContext2D | null;
    try { context = this.canvas.nativeElement.getContext('2d'); }
    catch { this.canvasReady.set(false); return; }
    if (!context) { this.canvasReady.set(false); return; }
    this.canvasReady.set(true);
    this.startTime = performance.now();
    this.frame = requestAnimationFrame((time) => this.drawFrame(context, time));
  }

  private drawFrame(context: CanvasRenderingContext2D, time: number): void {
    try {
      this.render(context, time);
    } catch {
      // A failed canvas operation must leave the static illustration available.
      this.frame = 0;
      this.canvasReady.set(false);
    }
  }

  private render(context: CanvasRenderingContext2D, time: number): void {
    if (!this.initialized || !this.enabled) return;
    const canvas = this.canvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    const image = this.source.nativeElement;
    // Match object-fit: contain even when the parent is not square.
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    const left = (width - imageWidth) / 2;
    const top = height - imageHeight;
    const t = (time - this.startTime) / 1000;
    const actionTime = Math.max(0, (time - this.actionStart) / 1000);
    const clip = CHIPMUNK_CLIPS[this.action];
    if (clip) {
      const atlas = this.atlasFor(clip);
      if (atlas && atlas.complete && atlas.naturalWidth && atlas.naturalHeight) {
        const elapsed = this.clipProgress !== null && Number.isFinite(this.clipProgress)
          ? Math.max(0, Math.min(1, this.clipProgress)) * chipmunkClipDuration(clip)
          : time - this.actionStart;
        const {index, ended} = chipmunkFrameAt(clip, elapsed);
        const cellWidth = atlas.naturalWidth / clip.columns, cellHeight = atlas.naturalHeight / clip.rows;
        const spriteScale = Math.min(width / cellWidth, height / cellHeight);
        const drawWidth = cellWidth * spriteScale, drawHeight = cellHeight * spriteScale;
        context.drawImage(atlas, index % clip.columns * cellWidth, Math.floor(index / clip.columns) * cellHeight,
          cellWidth, cellHeight, (width - drawWidth) / 2, height - drawHeight + (clip.footInset ?? 0) * spriteScale,
          drawWidth, drawHeight);
        if (!ended) this.frame = requestAnimationFrame(next => this.drawFrame(context, next));
      } else {
        context.drawImage(image, left, top, imageWidth, imageHeight);
      }
      return;
    }
    const n = this.subdivisions;
    const points: Array<Array<[number, number]>> = [];
    for (let row = 0; row <= n; row++) {
      points[row] = [];
      for (let col = 0; col <= n; col++) {
        const x = col / n;
        const y = row / n;
        const [dx, dy] = this.displacement(x, y, t, actionTime);
        points[row][col] = [left + (x + dx) * imageWidth, top + (y + dy) * imageHeight];
      }
    }
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const a = points[row][col], b = points[row][col + 1];
        const c = points[row + 1][col], d = points[row + 1][col + 1];
        this.triangle(context, image, a, b, c, col / n, row / n, n);
        this.triangle(context, image, d, c, b, (col + 1) / n, (row + 1) / n, -n);
      }
    }
    this.frame = requestAnimationFrame((next) => this.drawFrame(context, next));
  }

  private displacement(x: number, y: number, t: number, actionTime: number): [number, number] {
    const gaussian = (cx: number, cy: number, sx: number, sy: number) =>
      Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) * 2);
    if (this.action === 'sleeping') {
      return [0, -.004 * gaussian(.55, .60, .45, .35) * Math.sin(t * 1.7)];
    }
    const head = gaussian(.57, .30, .30, .25);
    const tail = gaussian(.23, .42, .26, .29);
    const hands = gaussian(.56, .57, .28, .14);
    const breath = gaussian(.55, .67, .30, .28);
    const sway = Math.sin(t * 2.0);
    let dx = tail * .012 * Math.sin(t * 2.2) + head * .003 * sway;
    let dy = -breath * .003 * Math.sin(t * 1.8);
    const envelope = Math.max(0, Math.min(1, actionTime / .22, (1.8 - actionTime) / .3));
    if (this.action === 'petted') {
      dx += envelope * head * .014 * Math.sin(actionTime * 4);
      dy += envelope * head * .009 * (1 - Math.cos(actionTime * 4));
      dx += envelope * tail * .020 * Math.sin(actionTime * 7);
    } else if (this.action === 'greeting') {
      dx += envelope * head * .009 * Math.sin(actionTime * 6);
      dy += envelope * hands * .012 * Math.sin(actionTime * 6);
    } else if (this.action === 'feeding') {
      dy += hands * .012 * Math.sin(t * 9);
      dx += head * .005 * Math.sin(t * 9);
    } else if (this.action === 'playing') {
      dx += tail * .022 * Math.sin(t * 7) + head * .008 * Math.sin(t * 5);
      dy += hands * .015 * Math.sin(t * 7) - .025 * Math.abs(Math.sin(t * 3.5));
    }
    return [dx, dy];
  }

  private triangle(ctx: CanvasRenderingContext2D, image: HTMLImageElement,
    origin: [number, number], xPoint: [number, number], yPoint: [number, number],
    x: number, y: number, inverseStep: number): void {
    ctx.save();
    ctx.beginPath();
    // Slight overlap hides antialiasing seams between adjacent triangles.
    const cx = (origin[0] + xPoint[0] + yPoint[0]) / 3;
    const cy = (origin[1] + xPoint[1] + yPoint[1]) / 3;
    const outward = (point: [number, number]): [number, number] => {
      const dx = point[0] - cx, dy = point[1] - cy;
      const scale = 1 + 1.25 / Math.max(1, Math.hypot(dx, dy));
      return [cx + dx * scale, cy + dy * scale];
    };
    const p = outward(origin), q = outward(xPoint), r = outward(yPoint);
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(r[0], r[1]); ctx.closePath(); ctx.clip();
    ctx.setTransform((xPoint[0] - origin[0]) * inverseStep / image.naturalWidth,
      (xPoint[1] - origin[1]) * inverseStep / image.naturalWidth,
      (yPoint[0] - origin[0]) * inverseStep / image.naturalHeight,
      (yPoint[1] - origin[1]) * inverseStep / image.naturalHeight,
      origin[0] - (xPoint[0] - origin[0]) * inverseStep * x - (yPoint[0] - origin[0]) * inverseStep * y,
      origin[1] - (xPoint[1] - origin[1]) * inverseStep * x - (yPoint[1] - origin[1]) * inverseStep * y);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
}
