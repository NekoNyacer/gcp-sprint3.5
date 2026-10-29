import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import type { CompanionTab } from './companion-roaming';

interface SceneTransition {
  animations: Animation[];
  cancelled: boolean;
  abort: AbortController;
  restore: () => void;
}

/** Drag-only scene motion. Ionic intentionally skips animations between tab stacks. */
@Injectable()
export class CompanionTabTransitionService implements OnDestroy {
  private host?: HTMLElement;
  private tabChanges?: Observable<{ tab: string }>;
  private running?: SceneTransition;

  attach(host: HTMLElement, tabChanges: Observable<{ tab: string }>): void {
    this.host = host;
    this.tabChanges = tabChanges;
  }

  async navigate(target: CompanionTab, direction: 1 | -1, change: () => Promise<boolean>): Promise<boolean> {
    this.cancel();
    const host = this.host;
    const outlet = host?.querySelector<HTMLElement>('ion-tabs ion-router-outlet');
    if (!host || !outlet?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return change();
    }

    // Hide between phases while Ionic attaches/restores the destination page.
    // Animate the live outlet, preserving canvases, scroll positions and cached pages.
    const opacity = outlet.style.getPropertyValue('opacity');
    const pointerEvents = outlet.style.getPropertyValue('pointer-events');
    const transition: SceneTransition = {
      animations: [], cancelled: false, abort: new AbortController(),
      restore: () => {
        outlet.style.opacity = opacity;
        outlet.style.pointerEvents = pointerEvents;
        host.classList.remove('companion-tab-transition');
      },
    };
    this.running = transition;
    host.classList.add('companion-tab-transition');
    outlet.style.opacity = '0';
    outlet.style.pointerEvents = 'none';
    let subscription: Subscription | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await this.play(transition, [outlet, host.querySelector('ion-header')], [
        { transform: 'translateX(0)', opacity: 1 },
        { transform: `translateX(${-direction * 32}px)`, opacity: 0 },
      ], 120, 'cubic-bezier(.4, 0, 1, 1)');
      if (transition.cancelled) return false;

      // ionTabsDidChange follows Ionic's stack cleanup; NavigationEnd alone is too early.
      const ready = new Promise<void>(resolve => {
        subscription = this.tabChanges?.subscribe(event => { if (event.tab === target) resolve(); });
        transition.abort.signal.addEventListener('abort', () => resolve(), { once: true });
      });
      const navigated = await change();
      if (!navigated || transition.cancelled) return navigated;
      await Promise.race([ready, new Promise<void>(resolve => { timeout = setTimeout(resolve, 2000); })]);
      if (transition.cancelled) return navigated;
      await this.play(transition, [outlet, host.querySelector('ion-header')], [
        { transform: `translateX(${direction * 32}px)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ], 180, 'cubic-bezier(0, 0, .2, 1)');
      return navigated;
    } finally {
      subscription?.unsubscribe();
      clearTimeout(timeout);
      if (this.running === transition) {
        this.cancel();
      }
    }
  }

  cancel(): void {
    const transition = this.running;
    if (!transition) return;
    this.running = undefined;
    transition.cancelled = true;
    transition.abort.abort();
    transition.animations.forEach(animation => animation.cancel());
    transition.restore();
  }

  ngOnDestroy(): void { this.cancel(); }

  private async play(transition: SceneTransition, elements: (HTMLElement | null)[], frames: Keyframe[], duration: number, easing: string): Promise<void> {
    transition.animations.forEach(animation => animation.cancel());
    transition.animations = elements.filter((element): element is HTMLElement => !!element)
      .map(element => element.animate(frames, { duration, easing, fill: 'both' }));
    await Promise.all(transition.animations.map(animation => animation.finished.catch(() => undefined)));
  }
}
