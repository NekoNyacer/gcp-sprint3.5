import { DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { IonButton, IonCard, IonCardSubtitle, IonCardTitle, IonIcon } from '@ionic/angular';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { WalkSessionStore } from '../../../shared/stores/walk-session-store';

@Component({
  selector: 'home-idle',
  templateUrl: './home-idle.component.html',
  styleUrls: ['./home-idle.component.scss'],
  imports: [IonButton, IonCardSubtitle, IonCardTitle, IonCard, IonIcon, DecimalPipe],
})
export class HomeIdleComponent implements OnDestroy {
  protected readonly ps = inject(ProgressStore);
  private readonly ws = inject(WalkSessionStore);
  readonly hasActiveRoute = computed(() => this.ws.hasActiveRoute());
  readonly start = output();
  readonly terminate = output();
  readonly holding = signal(false);
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private pointer: { element: HTMLElement; id: number; x: number; y: number } | null = null;
  private heldKey: string | null = null;

  constructor() {
    effect(() => {
      if (!this.hasActiveRoute()) this.cancelHold();
    });
    afterNextRender(() => {
      window.addEventListener('blur', this.cancelHold);
      document.addEventListener('visibilitychange', this.visibilityChanged);
    });
  }

  beginPointerHold(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || !(event.currentTarget instanceof HTMLElement))
      return;
    if (!this.hasActiveRoute() || this.holding()) return;
    event.preventDefault();
    this.pointer = {
      element: event.currentTarget,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    this.pointer.element.setPointerCapture(event.pointerId);
    this.beginHold();
  }

  movePointer(event: PointerEvent): void {
    if (this.pointer?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - this.pointer.x, event.clientY - this.pointer.y) > 12) {
      this.cancelHold();
    }
  }

  endPointerHold(event: PointerEvent): void {
    if (this.pointer?.id === event.pointerId) this.cancelHold();
  }

  beginKeyHold(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelHold();
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (event.repeat || this.holding() || !this.hasActiveRoute()) return;
    this.heldKey = event.key;
    this.beginHold();
  }

  endKeyHold(event: KeyboardEvent): void {
    if (event.key !== this.heldKey) return;
    event.preventDefault();
    this.cancelHold();
  }

  private beginHold(): void {
    if (document.hidden) {
      this.cancelHold();
      return;
    }
    this.holding.set(true);
    this.holdTimer = setTimeout(() => {
      const active = this.hasActiveRoute();
      this.cancelHold();
      if (active) this.terminate.emit();
    }, 1000);
  }

  readonly cancelHold = (): void => {
    if (this.holdTimer !== null) clearTimeout(this.holdTimer);
    this.holdTimer = null;
    this.holding.set(false);
    this.heldKey = null;
    const pointer = this.pointer;
    this.pointer = null;
    if (pointer?.element.hasPointerCapture(pointer.id)) {
      pointer.element.releasePointerCapture(pointer.id);
    }
  };

  private readonly visibilityChanged = (): void => {
    if (document.hidden) this.cancelHold();
  };

  ngOnDestroy(): void {
    this.cancelHold();
    window.removeEventListener('blur', this.cancelHold);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
  }
}
