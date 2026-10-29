import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject, signal,
} from '@angular/core';

type PettingArea = 'head' | 'belly';
const UNIFIED_ROOT = '/images/pet/animations/petting-unified/';
export const PETTING_CLIPS = {
  breathing: { path: UNIFIED_ROOT + 'idle-atlas.png', fps: 6, frames: 10 },
  expression: { path: UNIFIED_ROOT + 'expression-master-atlas.png', fps: 6, frames: 10 },
  head: { path: UNIFIED_ROOT + 'head-atlas.png', fps: 8, frames: 10 },
  belly: { path: UNIFIED_ROOT + 'belly-atlas.png', fps: 8, frames: 10 },
} as const;

@Component({
  selector: 'app-companion-petting',
  templateUrl: './companion-petting.component.html',
  styleUrl: './companion-petting.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanionPettingComponent implements AfterViewInit, OnDestroy {
  @Input() reducedMotion = false;
  @Output() readonly closed = new EventEmitter<void>();
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('dialog') private dialog?: ElementRef<HTMLDialogElement>;

  readonly area = signal<PettingArea>('head');
  readonly frame = signal(0);
  readonly hint = signal('摸摸我的頭或肚子吧！');
  readonly closing = signal(false);
  readonly idle = signal(true);
  readonly idleClip = signal<'breathing' | 'expression'>('breathing');
  readonly spriteReady = signal(false);
  readonly bubbleVisible = signal(true);
  readonly previousSprite = signal<{path: string; position: string; size: string} | null>(null);
  private readonly document = inject(DOCUMENT);
  private previousFocus: HTMLElement | null = null;
  private pointerId: number | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastArea: PettingArea | null = null;
  private lastTouch = 0;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private previousOverflow = '';
  private resumeTimer?: ReturnType<typeof setTimeout>;
  private dragY: number | null = null;
  private bubbleTimer?: ReturnType<typeof setTimeout>;
  private blendTimer?: ReturnType<typeof setTimeout>;
  private spriteSequence = 0;
  private readonly decoded = new Set<string>();
  private readonly loading = new Map<string, Promise<void>>();
  private get activeClip() { return PETTING_CLIPS[this.idle() ? this.idleClip() : this.area()]; }

  get spritePath(): string {
    return `url("${this.spriteReady() ? this.activeClip.path : UNIFIED_ROOT + 'neutral.png'}")`;
  }
  get spritePosition(): string {
    const frame = this.frame();
    return this.spriteReady() ? `${(frame % 5) * 25}% ${Math.floor(frame / 5) * 100}%` : '0% 0%';
  }
  get spriteSize(): string { return this.spriteReady() ? '500% 200%' : '100% 100%'; }

  ngAfterViewInit(): void {
    this.previousFocus = this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
    this.previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    const dialog = this.dialog?.nativeElement;
    if (dialog) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    this.closeButton?.nativeElement.focus({ preventScroll: true });
    for (const path of Object.values(PETTING_CLIPS).map(clip => clip.path)) {
      const image = new Image(); image.src = path;
      if (typeof image.decode === 'function') this.loading.set(path, image.decode().then(() => { this.decoded.add(path); }).catch(() => {}));
      else this.decoded.add(path);
    }
    this.showBubble();
    this.startIdle();
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    clearTimeout(this.closeTimer);
    clearTimeout(this.resumeTimer);
    clearTimeout(this.bubbleTimer); clearTimeout(this.blendTimer); this.spriteSequence++;
    const dialog = this.dialog?.nativeElement;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    this.document.body.style.overflow = this.previousOverflow;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  }

  react(area: PettingArea): void {
    if (this.closing()) return;
    this.stopAnimation();
    clearTimeout(this.resumeTimer);
    this.hint.set(area === 'head' ? '嗯～好舒服！' : '嘻嘻，肚子癢癢的！');
    this.showBubble();
    const clip = PETTING_CLIPS[area];
    this.switchSprite(clip.path, () => {
    this.idle.set(false);
    this.area.set(area);
    const reduced = this.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.frame.set(reduced ? 3 : 0);
    if (reduced) { this.resumeTimer = setTimeout(() => this.startIdle(), 1300); return; }
    this.timer = setInterval(() => {
      const next = this.frame() + 1;
      if (next >= clip.frames) { this.stopAnimation(); this.resumeTimer = setTimeout(() => this.startIdle(), 200); return; }
      this.frame.set(next);
    }, 1000 / clip.fps);
    });
  }

  pointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    const target = event.currentTarget as HTMLElement;
    if (target.setPointerCapture) target.setPointerCapture(event.pointerId);
    this.touchAt(event, target, true);
  }

  pointerMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.touchAt(event, event.currentTarget as HTMLElement, false);
  }

  pointerEnd(event: PointerEvent): void {
    if (this.pointerId === event.pointerId) this.pointerId = null;
    this.lastArea = null;
  }

  handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.requestClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = this.dialog?.nativeElement.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    if (!controls?.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  requestClose(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.stopAnimation();
    clearTimeout(this.resumeTimer);
    this.spriteSequence++;
    const finish = () => {
      const dialog = this.dialog?.nativeElement;
      if (dialog?.open && typeof dialog.close === 'function') dialog.close();
      this.closed.emit();
    };
    if (this.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) finish();
    else this.closeTimer = setTimeout(finish, 190);
  }

  cancel(event: Event): void { event.preventDefault(); this.requestClose(); }

  dragStart(event: PointerEvent): void {
    this.dragY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  dragEnd(event: PointerEvent): void {
    if (this.dragY !== null && event.clientY - this.dragY > 55) this.requestClose();
    this.dragY = null;
  }
  dragCancel(): void { this.dragY = null; }

  private startIdle(): void {
    if (this.closing()) return;
    this.stopAnimation();
    this.switchSprite(PETTING_CLIPS.breathing.path, () => {
    this.idle.set(true); this.idleClip.set('breathing'); this.frame.set(0);
    if (this.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    let cycles = 0;
    let waiting = false;
    this.timer = setInterval(() => {
      if (this.document.hidden || waiting) return;
      if (this.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) { this.frame.set(0); return; }
      if (this.frame() < 9) { this.frame.update(frame => frame + 1); return; }
      if (this.idleClip() === 'breathing') cycles++;
      const clip = this.idleClip() === 'breathing' && cycles >= 3 ? 'expression' : 'breathing';
      if (clip === this.idleClip()) { this.frame.set(0); return; }
      waiting = true;
      this.switchSprite(PETTING_CLIPS[clip].path, () => {
        this.idleClip.set(clip); this.frame.set(0); waiting = false;
        if (clip === 'breathing') cycles = 0;
      });
    }, 1000 / PETTING_CLIPS.breathing.fps);
    });
  }

  private showBubble(): void {
    clearTimeout(this.bubbleTimer); this.bubbleVisible.set(true);
    this.bubbleTimer = setTimeout(() => this.bubbleVisible.set(false), 3000);
  }

  private switchSprite(path: string, update: () => void): void {
    const sequence = ++this.spriteSequence;
    const apply = () => {
      if (sequence !== this.spriteSequence || this.closing()) return;
      const atSharedNeutral = !this.spriteReady() || this.frame() === 0 || this.frame() === 9;
      if (!this.spritePath.includes(path) && !this.reducedMotion && !atSharedNeutral) {
        this.previousSprite.set({ path: this.spritePath, position: this.spritePosition, size: this.spriteSize });
        clearTimeout(this.blendTimer);
        this.blendTimer = setTimeout(() => this.previousSprite.set(null), 180);
      }
      else { clearTimeout(this.blendTimer); this.previousSprite.set(null); }
      this.spriteReady.set(true);
      update();
    };
    if (this.decoded.has(path)) apply();
    else void this.loading.get(path)?.then(() => { if (this.decoded.has(path)) apply(); });
  }

  backdropClick(event: MouseEvent): void {
    if (event.target !== this.dialog?.nativeElement) return;
    const rect = this.dialog.nativeElement.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.requestClose();
  }

  private touchAt(event: PointerEvent, target: HTMLElement, force: boolean): void {
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    // The left side is the tail; the visible head and belly sit right of centre.
    const area: PettingArea | null = x >= .40 && x <= .94 && y >= .08 && y <= .50 ? 'head'
      : x >= .40 && x <= .94 && y > .50 && y <= .91 ? 'belly' : null;
    if (!area) { this.lastArea = null; return; }
    const now = Date.now();
    if (force || area !== this.lastArea || now - this.lastTouch > 1000) {
      this.lastArea = area;
      this.lastTouch = now;
      this.react(area);
    }
  }

  private stopAnimation(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
}
