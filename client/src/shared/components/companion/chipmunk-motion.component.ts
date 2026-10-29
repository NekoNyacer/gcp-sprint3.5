import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, signal } from '@angular/core';

export type ChipmunkAction = 'idle' | 'greeting' | 'feeding' | 'playing' | 'walking' | 'petted' | 'sleeping';

/** Articulated run frames; quiet stationary actions use a small 2D deformation mesh. */
@Component({
  selector: 'chipmunk-motion',
  template: `
    <img #source [src]="imageSource" alt="" aria-hidden="true"
      [style.visibility]="canvasReady() ? 'hidden' : 'visible'" (load)="imageLoaded()" />
    <img #runAtlas class="atlas-source" src="/images/pet/chipmunk-run-cycle.png" alt="" aria-hidden="true" (load)="imageLoaded()" />
    <canvas #canvas aria-hidden="true" [style.visibility]="canvasReady() ? 'visible' : 'hidden'"></canvas>
  `,
  styles: [`
    :host { position: relative; display: block; width: 100%; height: 100%; }
    img, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: center bottom; }
    img.atlas-source { display: none; }
  `],
})
export class ChipmunkMotionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('source', { static: true }) private source!: ElementRef<HTMLImageElement>;
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('runAtlas', { static: true }) private runAtlas!: ElementRef<HTMLImageElement>;

  private currentAction: ChipmunkAction = 'idle';
  @Input() set action(value: ChipmunkAction) {
    const previousSource = this.imageSource;
    this.currentAction = value;
    if (previousSource !== this.imageSource) {
      cancelAnimationFrame(this.frame);
      this.canvasReady.set(false);
    }
  }
  get action(): ChipmunkAction { return this.currentAction; }
  get imageSource(): string {
    const pose = this.action === 'walking' ? 'running' : this.action === 'feeding' ? 'eating' :
      this.action === 'sleeping' ? 'sleeping' : 'neutral';
    return `/images/pet/chipmunk-${pose}.png`;
  }
  @Input() set actionSerial(_value: number) { this.actionStart = performance.now(); }
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
  }

  private syncAnimation(): void {
    if (!this.initialized) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
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
    if (this.action === 'walking') {
      const atlas = this.runAtlas.nativeElement;
      if (atlas.complete && atlas.naturalWidth) {
        const frameIndex = Math.floor(t * 24) % 12;
        const cellWidth = atlas.naturalWidth / 4, cellHeight = atlas.naturalHeight / 3;
        const spriteScale = Math.min(width / cellWidth, height / cellHeight);
        const drawWidth = cellWidth * spriteScale, drawHeight = cellHeight * spriteScale;
        context.drawImage(atlas, frameIndex % 4 * cellWidth, Math.floor(frameIndex / 4) * cellHeight,
          cellWidth, cellHeight, (width - drawWidth) / 2, height - drawHeight, drawWidth, drawHeight);
      } else {
        context.drawImage(image, left, top, imageWidth, imageHeight);
      }
      this.frame = requestAnimationFrame(next => this.drawFrame(context, next));
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
