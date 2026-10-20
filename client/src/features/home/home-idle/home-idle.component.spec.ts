import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HomeIdleComponent } from './home-idle.component';
import { WalkSessionStore } from '../../../shared/stores/walk-session-store';

describe('Home idle route termination hold', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function setup(active = true) {
    const hasActiveRoute = signal(active);
    TestBed.configureTestingModule({
      imports: [HomeIdleComponent],
      providers: [{ provide: WalkSessionStore, useValue: { hasActiveRoute } }],
    });
    const fixture = TestBed.createComponent(HomeIdleComponent);
    fixture.detectChanges();
    const terminate = vi.fn();
    const start = vi.fn();
    fixture.componentInstance.terminate.subscribe(terminate);
    fixture.componentInstance.start.subscribe(start);
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector('.terminate-btn');
    if (button) {
      button.setPointerCapture = vi.fn();
      button.hasPointerCapture = vi.fn(() => true);
      button.releasePointerCapture = vi.fn();
    }
    const pointer = (type: string, x = 100, id = 1) =>
      button!.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: 100,
          bubbles: true,
        }),
      );
    const key = (type: string, value: string, repeat = false) =>
      button!.dispatchEvent(
        new KeyboardEvent(type, { key: value, repeat, bubbles: true, cancelable: true }),
      );
    return { fixture, button, terminate, start, pointer, key, hasActiveRoute };
  }

  it('retains the departure button when no route is active', () => {
    const { fixture, button, start } = setup(false);
    expect(button).toBeNull();
    fixture.nativeElement.querySelector('ion-button.start-btn').click();
    expect(start).toHaveBeenCalledOnce();
  });

  it('ignores ordinary clicks and requires the full one-second hold', () => {
    const { fixture, button, terminate, pointer } = setup();
    expect(getComputedStyle(button!).pointerEvents).toBe('auto');
    button!.click();
    expect(terminate).not.toHaveBeenCalled();
    pointer('pointerdown');
    vi.advanceTimersByTime(999);
    expect(terminate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.holding()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(terminate).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.holding()).toBe(false);
    pointer('pointerup');
    button!.click();
    vi.advanceTimersByTime(2000);
    expect(terminate).toHaveBeenCalledOnce();
  });

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
    'cancels an incomplete hold on %s',
    (event) => {
      const { terminate, pointer } = setup();
      pointer('pointerdown');
      vi.advanceTimersByTime(999);
      pointer(event);
      vi.advanceTimersByTime(2000);
      expect(terminate).not.toHaveBeenCalled();
    },
  );

  it('cancels on dragging and does not cancel for another pointer', () => {
    const { terminate, pointer } = setup();
    pointer('pointerdown');
    pointer('pointerup', 100, 2);
    vi.advanceTimersByTime(500);
    pointer('pointermove', 113);
    vi.advanceTimersByTime(1000);
    expect(terminate).not.toHaveBeenCalled();
  });

  it.each([' ', 'Enter'])(
    'supports holding %s with the keyboard without repeat activation',
    (value) => {
      const { terminate, key } = setup();
      key('keydown', value);
      vi.advanceTimersByTime(999);
      key('keydown', value, true);
      expect(terminate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(terminate).toHaveBeenCalledOnce();
      key('keyup', value);
      vi.advanceTimersByTime(1000);
      expect(terminate).toHaveBeenCalledOnce();
    },
  );

  it('cancels short keyboard holds and Escape', () => {
    const { terminate, key } = setup();
    key('keydown', ' ');
    vi.advanceTimersByTime(999);
    key('keyup', ' ');
    vi.advanceTimersByTime(1000);
    key('keydown', 'Enter');
    key('keydown', 'Escape');
    vi.advanceTimersByTime(1000);
    expect(terminate).not.toHaveBeenCalled();
  });

  it.each(['blur', 'hidden', 'route-cleared', 'destroyed'])(
    'cancels a hold when %s',
    (interruption) => {
      const { fixture, terminate, pointer, hasActiveRoute } = setup();
      pointer('pointerdown');
      vi.advanceTimersByTime(500);
      if (interruption === 'blur') window.dispatchEvent(new Event('blur'));
      if (interruption === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (interruption === 'route-cleared') {
        hasActiveRoute.set(false);
        fixture.detectChanges();
      }
      if (interruption === 'destroyed') fixture.destroy();
      vi.advanceTimersByTime(1000);
      expect(terminate).not.toHaveBeenCalled();
    },
  );
});
