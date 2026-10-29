import { Subject } from 'rxjs';
import { CompanionTabTransitionService } from './companion-tab-transition.service';

interface PendingAnimation {
  element: HTMLElement;
  frames: Keyframe[];
  finish: () => void;
  cancel: ReturnType<typeof vi.fn>;
}

describe('drag tab scene transitions', () => {
  let service: CompanionTabTransitionService;
  let host: HTMLElement;
  let outlet: HTMLElement;
  let changes: Subject<{ tab: string }>;
  let animations: PendingAnimation[];
  let reduced: boolean;
  let originalAnimate: PropertyDescriptor | undefined;

  beforeEach(() => {
    reduced = false;
    animations = [];
    originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: function (this: HTMLElement, frames: Keyframe[]) {
        let finish!: () => void;
        let reject!: (reason: Error) => void;
        const finished = new Promise<void>((resolve, fail) => { finish = resolve; reject = fail; });
        const cancel = vi.fn(() => reject(new Error('Animation cancelled')));
        animations.push({ element: this, frames, finish, cancel });
        return { finished, cancel } as unknown as Animation;
      },
    });
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
    host = document.createElement('app-shell');
    host.innerHTML = '<ion-header></ion-header><ion-tabs><ion-router-outlet></ion-router-outlet><ion-tab-bar></ion-tab-bar></ion-tabs><app-companion></app-companion>';
    outlet = host.querySelector('ion-router-outlet')!;
    outlet.style.opacity = '.6';
    outlet.style.pointerEvents = 'auto';
    changes = new Subject();
    service = new CompanionTabTransitionService();
    service.attach(host, changes);
  });

  afterEach(() => {
    service.ngOnDestroy();
    if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    vi.unstubAllGlobals();
  });

  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const finishPhase = async () => { animations.slice().forEach(animation => animation.finish()); await flush(); };
  const expectRestored = () => {
    expect(outlet.style.opacity).toBe('0.6');
    expect(outlet.style.pointerEvents).toBe('auto');
    expect(host.classList.contains('companion-tab-transition')).toBe(false);
  };

  it('finishes the old scene before navigating and waits for the destination stack before revealing it', async () => {
    const change = vi.fn().mockResolvedValue(true);
    const result = service.navigate('task', 1, change);
    expect(change).not.toHaveBeenCalled();
    expect(outlet.style.opacity).toBe('0');
    expect(outlet.style.pointerEvents).toBe('none');
    expect(animations).toHaveLength(2);
    await finishPhase();
    expect(change).toHaveBeenCalledOnce();
    expect(animations).toHaveLength(2);
    changes.next({ tab: 'collection' });
    await flush();
    expect(animations).toHaveLength(2);
    changes.next({ tab: 'task' });
    await flush();
    expect(animations).toHaveLength(4);
    expect(animations.map(animation => animation.element.tagName)).toEqual([
      'ION-ROUTER-OUTLET', 'ION-HEADER', 'ION-ROUTER-OUTLET', 'ION-HEADER',
    ]);
    await finishPhase();
    await expect(result).resolves.toBe(true);
    expectRestored();
  });

  it.each([1, -1] as const)('slides the old and new scenes in the matching direction (%s)', async direction => {
    const result = service.navigate('task', direction, async () => {
      changes.next({ tab: 'task' });
      return true;
    });
    expect(animations[0].frames[1]['transform']).toBe(`translateX(${-direction * 32}px)`);
    await finishPhase();
    expect(animations[2].frames[0]['transform']).toBe(`translateX(${direction * 32}px)`);
    expect(animations[2].frames[1]['transform']).toBe('translateX(0)');
    await finishPhase();
    await result;
    expectRestored();
  });

  it('cancels the outgoing scene without navigating and restores existing styles', async () => {
    const change = vi.fn().mockResolvedValue(true);
    const result = service.navigate('task', 1, change);
    service.cancel();
    await expect(result).resolves.toBe(false);
    expect(change).not.toHaveBeenCalled();
    expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
    expectRestored();
  });

  it('can cancel while waiting for Ionic without leaving the page invisible', async () => {
    const result = service.navigate('task', 1, async () => true);
    await finishPhase();
    service.cancel();
    await expect(result).resolves.toBe(true);
    changes.next({ tab: 'task' });
    await flush();
    expect(animations).toHaveLength(2);
    expectRestored();
  });

  it('restores the outgoing scene if navigation is declined', async () => {
    const result = service.navigate('task', 1, async () => false);
    await finishPhase();
    await expect(result).resolves.toBe(false);
    expect(animations).toHaveLength(2);
    expectRestored();
  });

  it('restores the scene when routing rejects', async () => {
    const failure = new Error('Route failed');
    const result = service.navigate('task', 1, async () => { throw failure; });
    const rejected = expect(result).rejects.toBe(failure);
    await finishPhase();
    await rejected;
    expectRestored();
  });

  it('navigates directly with reduced motion without hiding the scene or animating it', async () => {
    reduced = true;
    const change = vi.fn().mockResolvedValue(true);
    await expect(service.navigate('task', 1, change)).resolves.toBe(true);
    expect(change).toHaveBeenCalledOnce();
    expect(animations).toHaveLength(0);
    expectRestored();
  });
});
