import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IonModal } from '@ionic/angular';
import { HomeSupplyStationComponent } from './home-supply-station.component';
import { createDemoWalkTasks } from '../../../shared/models/demo-walk-tasks';
import { LocationPoint, LocationStore } from '../../../shared/stores/location-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { RoutedWalkTaskPoint } from '../../../shared/models/walk-task.models';
import { WalkSessionStore } from '../../../shared/stores/walk-session-store';

describe('Supply station cultivation-style modal', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function setup() {
    let now = 0;
    let nextFrame = 0;
    const frames = new Map<number, FrameRequestCallback>();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => frames.delete(id));
    const station: RoutedWalkTaskPoint = {
      ...createDemoWalkTasks([
        { latitude: 25.01, longitude: 121.46 },
        { latitude: 25.014, longitude: 121.464 },
      ])[0],
      routeGeometry: [],
      routeDistanceMeters: 0,
    };
    const current = signal<LocationPoint | null>({
      ...station.position,
      accuracy: 5,
      observedAt: new Date(),
    });
    const taskPoints = signal<RoutedWalkTaskPoint[]>([station]);
    const hasActiveRoute = signal(true);
    const isWalking = signal(true);
    const isArrived = signal(false);
    const checkedInTaskIds = signal<string[]>([]);
    const checkInError = signal<string | null>(null);
    TestBed.configureTestingModule({
      imports: [HomeSupplyStationComponent],
      providers: [
        { provide: LocationStore, useValue: { current } },
        {
          provide: WalkSessionStore,
          useValue: {
            taskPoints,
            hasActiveRoute,
            isWalking,
            isArrived,
            checkedInTaskIds,
            checkInError,
          },
        },
      ],
    });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const fixture = TestBed.createComponent(HomeSupplyStationComponent);
    const feedbackRequested = vi.fn();
    fixture.componentInstance.feedbackRequested.subscribe(feedbackRequested);
    fixture.componentRef.setInput('station', station);
    fixture.detectChanges();
    fixture.detectChanges();
    const disc: HTMLElement = fixture.nativeElement.querySelector('.station-spinner');
    vi.spyOn(disc, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 240, 240));
    Object.defineProperties(disc, {
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: vi.fn() },
    });
    frames.clear();
    const pointer = (type: string, x: number, at: number, pointerId = 1) => {
      now = at;
      disc.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, isPrimary: true, button: 0, clientX: x,
      }));
    };
    const advance = (at: number) => {
      now = at;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(at));
    };
    return {
      fixture,
      component: fixture.componentInstance,
      feedbackRequested,
      station,
      current,
      taskPoints,
      checkedInTaskIds,
      checkInError,
      hasActiveRoute,
      isWalking,
      disc,
      pointer,
      advance,
      frames,
    };
  }

  it('uses the shared handle-only sheet and protects content gestures', async () => {
    const { fixture, component } = setup();
    const modal = fixture.debugElement.query(By.directive(IonModal)).componentInstance;
    expect(modal.isOpen).toBe(true);
    expect(modal.breakpoints).toEqual([0, 1]);
    expect(modal.initialBreakpoint).toBe(1);
    expect(modal.handle).toBe(true);
    expect(modal.handleBehavior).toBe('none');
    expect(modal.backdropDismiss).toBe(false);
    expect(modal.canDismiss).toBe(true);
    const root: HTMLElement = fixture.nativeElement;
    const mouse = vi.fn();
    root.addEventListener('mousedown', mouse);
    root
      .querySelector('.station-layout')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(mouse).not.toHaveBeenCalled();
    const closing = vi.fn();
    component.closing.subscribe(closing);
    fixture.debugElement.query(By.directive(IonModal)).triggerEventHandler('willDismiss');
    expect(closing).toHaveBeenCalledOnce();
    const closed = vi.fn();
    component.closed.subscribe(closed);
    fixture.debugElement.query(By.directive(IonModal)).triggerEventHandler('didDismiss');
    expect(closed).toHaveBeenCalledOnce();
  });

  it('allows rotation everywhere and only requests eligible rewards', () => {
    const {
      fixture,
      component,
      station,
      current,
      taskPoints,
      checkedInTaskIds,
      checkInError,
      feedbackRequested,
    } = setup();
    const updatedStation: RoutedWalkTaskPoint = {
      ...station,
      supplyStation: { ...station.supplyStation, supply: { resource: 'fertilizer', amount: 3 } },
    };
    fixture.componentRef.setInput('station', updatedStation);
    taskPoints.set([updatedStation]);
    current.set(null);
    fixture.detectChanges();
    const disc: HTMLElement = fixture.nativeElement.querySelector('[role="slider"]');
    const turn = () => {
      for (let i = 0; i < 8; i++) {
        disc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      }
    };
    expect(component.rewardLabel()).toBe('+3肥料');
    expect(feedbackRequested).toHaveBeenLastCalledWith('尚無有效定位，取得定位並靠近後即可打卡。');
    expect(fixture.nativeElement.querySelector('.status')).toBeNull();
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();
    expect(disc.getAttribute('aria-disabled')).toBe('false');
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    turn();
    expect(component.rotation()).toBe(360);
    expect(claim).not.toHaveBeenCalled();
    current.set({ ...updatedStation.position, accuracy: 5, observedAt: new Date() });
    fixture.detectChanges();
    expect(component.canCheckIn()).toBe(true);
    turn();
    expect(claim).toHaveBeenCalledOnce();
    checkedInTaskIds.set([updatedStation.id]);
    fixture.detectChanges();
    expect(disc.getAttribute('aria-disabled')).toBe('false');
    expect(feedbackRequested).toHaveBeenLastCalledWith(
      expect.stringContaining('打卡成功！已領取 +3肥料'),
    );
    turn();
    expect(component.rotation()).toBe(1080);
    expect(claim).toHaveBeenCalledOnce();
    checkInError.set('補給資源設定無效');
    fixture.detectChanges();
    expect(feedbackRequested).toHaveBeenLastCalledWith('補給資源設定無效');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('blocks and reports a station already claimed today', () => {
    const { fixture, component, station, feedbackRequested } = setup();
    const progress = TestBed.inject(ProgressStore);
    expect(progress.grantDemoSupply(station.id, station.supplyStation.supply)).toBe(true);
    fixture.detectChanges();

    const disc: HTMLElement = fixture.nativeElement.querySelector('[role="slider"]');
    expect(component.firstTime()).toBe(false);
    expect(component.claimUnavailable()).toBe(true);
    expect(disc.getAttribute('aria-disabled')).toBe('false');
    expect(feedbackRequested).toHaveBeenLastCalledWith('本日已領取成功，不可重複領取。');
  });

  it('does not grant for taps or slow flicks but continues a fast flick after release', () => {
    const { component, pointer, advance } = setup();
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    pointer('pointerdown', 0, 0);
    pointer('pointerup', 0, 50);
    expect(component.rotating()).toBe(false);
    pointer('pointerdown', 0, 100);
    pointer('pointermove', 12, 1100);
    pointer('pointerup', 12, 1100);
    for (let at = 1116; at <= 1500; at += 16) advance(at);
    expect(claim).not.toHaveBeenCalled();
    pointer('pointerdown', 0, 2000);
    pointer('pointermove', 120, 2050);
    pointer('pointerup', 120, 2050);
    expect(claim).not.toHaveBeenCalled();
    expect(component.rotating()).toBe(true);
    for (let at = 2066; at <= 5000; at += 16) advance(at);
    expect(component.rotation()).toBeGreaterThan(1080);
    expect(claim).toHaveBeenCalledOnce();
    expect(component.rotating()).toBe(false);
  });

  it('only claims at 360 degrees and keeps success dependent on actual store credit', () => {
    const { fixture, component, pointer, disc } = setup();
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 239.9, 1000);
    expect(claim).not.toHaveBeenCalled();
    expect(component.turnProgress()).toBe(359);
    pointer('pointermove', 240, 2000);
    expect(claim).toHaveBeenCalledOnce();
    pointer('pointermove', 480, 3000);
    expect(claim).toHaveBeenCalledOnce();
    fixture.detectChanges();
    expect(disc.getAttribute('aria-valuenow')).toBe('360');
    expect(component.claimed()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('打卡成功');
  });

  it.each(['pointercancel', 'lostpointercapture'])('stops a cancelled gesture on %s', type => {
    const { component, pointer, advance } = setup();
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 100, 40);
    pointer(type, 100, 45);
    pointer('pointerup', 240, 50);
    advance(1000);
    expect(component.dragging()).toBe(false);
    expect(component.rotating()).toBe(false);
    expect(claim).not.toHaveBeenCalled();
  });

  it('ignores a different pointer and rejects release momentum after a pause', () => {
    const { component, pointer } = setup();
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 240, 20, 2);
    expect(component.rotation()).toBe(0);
    pointer('pointermove', 120, 50);
    pointer('pointerup', 120, 500);
    expect(component.rotating()).toBe(false);
    expect(claim).not.toHaveBeenCalled();
  });

  it.each(['dismiss', 'blur', 'hidden', 'destroy'])(
    'cancels queued inertia before any reward on %s',
    interruption => {
      const { fixture, component, pointer, advance, hasActiveRoute, isWalking } = setup();
      const claim = vi.fn();
      component.checkIn.subscribe(claim);
      pointer('pointerdown', 0, 0);
      pointer('pointerup', 120, 50);
      expect(component.rotating()).toBe(true);
      const spinFrame = vi.mocked(requestAnimationFrame).mock.results.at(-1)!.value;
      if (interruption === 'dismiss') component.onWillDismiss();
      if (interruption === 'blur') window.dispatchEvent(new Event('blur'));
      if (interruption === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (interruption === 'route-end') hasActiveRoute.set(false);
      if (interruption === 'phase-change') isWalking.set(false);
      if (interruption === 'destroy') fixture.destroy();
      else fixture.detectChanges();
      advance(1000);
      expect(cancelAnimationFrame).toHaveBeenCalledWith(spinFrame);
      expect(claim).not.toHaveBeenCalled();
      expect(component.rotating()).toBe(false);
    },
  );

  it('resets progress when switching stations or reopening, and blocks stale releases', () => {
    const { fixture, component, station, taskPoints, pointer, advance } = setup();
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    pointer('pointerdown', 0, 0);
    pointer('pointerup', 120, 50);
    const replacement = { ...station, id: 'replacement-station' };
    taskPoints.set([replacement]);
    fixture.componentRef.setInput('station', replacement);
    fixture.detectChanges();
    pointer('pointerup', 240, 100);
    advance(1000);
    expect(component.rotation()).toBe(0);
    expect(claim).not.toHaveBeenCalled();
    component.keySpin(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.turnProgress()).toBe(45);
    component.onWillDismiss();
    fixture.componentRef.setInput('station', null);
    fixture.detectChanges();
    fixture.componentRef.setInput('station', replacement);
    fixture.detectChanges();
    component.onDidPresent();
    expect(component.turnProgress()).toBe(0);
    expect(component.dragging()).toBe(false);
  });

  it('keeps rotating outside an active route without granting rewards', () => {
    const { fixture, component, hasActiveRoute, disc } = setup();
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    hasActiveRoute.set(false);
    fixture.detectChanges();
    for (let i = 0; i < 16; i++) {
      disc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    }
    expect(component.rotation()).toBe(720);
    expect(claim).not.toHaveBeenCalled();
  });

  it('supports a full keyboard turn without turning Enter into a claim shortcut', () => {
    const { component, disc } = setup();
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    disc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(component.turnProgress()).toBe(0);
    for (let i = 0; i < 7; i++) {
      disc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    }
    expect(claim).not.toHaveBeenCalled();
    expect(component.turnProgress()).toBe(315);
    disc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(claim).toHaveBeenCalledOnce();
  });

  it('allows credited momentum to finish visually without additional claims', () => {
    const { fixture, component, station, pointer, advance, checkedInTaskIds } = setup();
    const claim = vi.fn();
    component.checkIn.subscribe(claim);
    pointer('pointerdown', 0, 0);
    pointer('pointerup', 120, 50);
    advance(150);
    expect(claim).toHaveBeenCalledOnce();
    checkedInTaskIds.set([station.id]);
    fixture.detectChanges();
    expect(component.claimed()).toBe(true);
    expect(component.rotating()).toBe(true);
    for (let at = 166; at <= 3000; at += 16) advance(at);
    expect(component.rotation()).toBeGreaterThan(1080);
    expect(claim).toHaveBeenCalledOnce();
    pointer('pointerdown', 0, 3100);
    expect(component.dragging()).toBe(true);
  });
});
