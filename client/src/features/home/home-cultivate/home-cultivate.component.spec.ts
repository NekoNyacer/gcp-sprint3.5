import { TREE_WEEDS_ENABLED } from '../../../environments/environment-dev';
import { computed, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TreeDisplayService } from '../../../shared/services/tree-display.service';
import { LiveEnvironmentService } from '../../../shared/services/live-environment.service';
import { patchState } from '@ngrx/signals';
import { By } from '@angular/platform-browser';
import { IonModal } from '@ionic/angular';
import { HomeCultivateComponent } from './home-cultivate.component';
import { TreeSceneComponent } from '../../../shared/components/tree-scene/tree-scene.component';
import { treeSceneBackground } from '../../../shared/models/tree-scene-environment';
import { findHomeTree } from '../home-tree-recommendations';
import { LocationStore, type LocationPoint } from '../../../shared/stores/location-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { SessionStore } from '../../../shared/stores/session-store';
import { WalkSessionStore, type WalkDestination } from '../../../shared/stores/walk-session-store';
import { DialogService } from '../../../shared/services/dialog.service';
import {
  CareResource,
  StreamingCareResource,
  DEMO_HARVEST_DURATION_MS,
  TREE_SWAY_MAX_DEGREES,
  TREE_WATERED_DURATION_MS,
  TREE_DRY_AFTER_MS,
} from '../../../shared/models/tree-cultivation';
import {
  destination,
  demoPlantingSpots,
  TREE_GROWTH_PER_HARVEST,
} from '../../../environments/environment-dev';

const target = TREE_GROWTH_PER_HARVEST;
const nearTargetWater = (target - 1) * 15;

type CultivateWalkSessionStub = {
  isCultivating: WritableSignal<boolean>;
  hasActiveRoute: WritableSignal<boolean>;
  destination: WritableSignal<WalkDestination | null>;
  checkInError: WritableSignal<string | null>;
  finishCultivating: () => void;
};

let locationOverride: WritableSignal<LocationPoint | null | undefined>;
let walkSession: CultivateWalkSessionStub;

function createWalkSessionStub(): CultivateWalkSessionStub {
  const isCultivating = signal(true);
  return {
    isCultivating,
    hasActiveRoute: signal(false),
    destination: signal<WalkDestination | null>(null),
    checkInError: signal<string | null>(null),
    finishCultivating: vi.fn(() => isCultivating.set(false)),
  };
}

function createFixture() {
  const store = TestBed.inject(ProgressStore);
  if (!findHomeTree(store.activeDemoTreeId())) {
    const treeId = 'tree-1';
    store.selectDemoTree(treeId);
    patchState(store as never, {
      demoTrees: {
        ...store.demoTrees(),
        [treeId]: {
          ...store.demoTrees()[treeId],
          growth: 0,
          lastWateredAt: null,
          fertilizedOn: null,
          fertilizerExpiresAt: null,
          growthRemainder: 0,
          harvestCount: 0,
          harvestStartedAt: null,
        },
      },
    });
  }
  return TestBed.createComponent(HomeCultivateComponent);
}

describe('HomeCultivateComponent direct feeding', () => {
  it('disables collection preview care and requests navigation only after dismissal', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('externalOpen', true);
    fixture.componentRef.setInput('collectionPreview', true);
    const component = fixture.componentInstance;
    const navigate = vi.fn();
    component.navigationRequested.subscribe(navigate);
    expect(component.canCultivate()).toBe(false);
    expect(component.canHarvest()).toBe(false);
    component.navigateToTree();
    expect(navigate).not.toHaveBeenCalled();
    component.dismissed();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(component.ps.activeDemoTreeId());
    expect(walkSession.finishCultivating).not.toHaveBeenCalled();
    fixture.destroy();
  });
  it('opens independently for collection and closes without finishing the Home session', () => {
    const fixture = createFixture();
    walkSession.isCultivating.set(false);
    fixture.componentRef.setInput('externalOpen', true);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    expect(fixture.componentInstance.isOpen()).toBe(true);
    expect(fixture.componentInstance.showDestinationCheckIn()).toBe(false);
    fixture.componentInstance.dismissed();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(walkSession.finishCultivating).not.toHaveBeenCalled();
    fixture.destroy();
  });
  beforeEach(() => {
    TestBed.overrideProvider(SessionStore, { useValue: { displayName: () => '阿發' } });
    vi.spyOn(LiveEnvironmentService.prototype, 'weatherAt').mockResolvedValue({source: 'open-meteo', condition: 'cloudy',
      temperatureC: 25, precipitationMm: 0, observedAt: new Date().toISOString()});
    TestBed.overrideProvider(TreeDisplayService, { useValue: { mode: signal('2d') } });
    locationOverride = signal<LocationPoint | null | undefined>(undefined);
    walkSession = createWalkSessionStub();
    TestBed.overrideProvider(LocationStore, {
      useValue: {
        current: computed(() => {
          const override = locationOverride();
          if (override !== undefined) return override;
          const tree = findHomeTree(TestBed.inject(ProgressStore).activeDemoTreeId());
          return tree ? { ...tree.position, accuracy: 5, observedAt: new Date() } : null;
        }),
      },
    });
    TestBed.overrideProvider(WalkSessionStore, { useValue: walkSession });
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'performance'],
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function setup(withHarvestBindings = false) {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(HomeCultivateComponent, {
      set: {
        template: withHarvestBindings
          ? '<div #layout><app-tree-scene [growth]="ps.demoTreeGrowth()" [interactive]="true" [fruitState]="fruitState()" [harvestStartedAt]="ps.demoHarvestStartedAt()" [canHarvest]="canHarvest()" (harvestRequested)="harvest()" /></div>'
          : '<div #layout><app-tree-scene />@for (resource of resources; track resource) {<button [attr.data-resource]="resource" (pointerdown)="grab($event, resource)" (pointermove)="move($event)" (pointerup)="release($event)" (pointercancel)="cancel($event)"></button>}</div>',
        imports: [TreeSceneComponent],
      },
    });
    const fixture = createFixture();
    fixture.componentInstance.lightRate.set(100);
    fixture.componentInstance.waterRate.set(1);
    fixture.detectChanges();
    const scene: TreeSceneComponent = fixture.debugElement.query(
      By.directive(TreeSceneComponent),
    ).componentInstance;
    vi.spyOn(scene, 'canInteract').mockReturnValue(true);
    const range = vi.spyOn(scene, 'containsFeedingPoint').mockImplementation((x) => x > 100);
    const root: HTMLElement = fixture.nativeElement;
    for (const button of root.querySelectorAll('button')) {
      button.setPointerCapture = vi.fn();
      button.hasPointerCapture = vi.fn(() => true);
      button.releasePointerCapture = vi.fn();
    }

    const dispatch = (type: string, x: number, resource: CareResource = 'light') =>
      root.querySelector(`[data-resource="${resource}"]`)!.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: 200,
          bubbles: true,
        }),
      );
    const setRate = (resource: StreamingCareResource, value: string) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.value = value;
      input.addEventListener('input', (event) =>
        fixture.componentInstance.setRate(event, resource),
      );
      input.dispatchEvent(new Event('input'));
    };
    return {
      fixture,
      component: fixture.componentInstance,
      store: TestBed.inject(ProgressStore),
      range,
      dispatch,
      setRate,
    };
  }

  it('opens the backpack and applies the original fertilizer effect', () => {
    const { component, store } = setup();
    const before = store.inventory().fertilizer;
    component.toggleBackpack();
    expect(component.backpackOpen()).toBe(true);
    component.useBackpackItem('fertilizer');
    expect(store.inventory().fertilizer).toBe(before - 1);
    expect(component.fertilized()).toBe(true);
    expect(component.growthConversionRate()).toBe(120);
    component.useBackpackItem('fertilizer');
    expect(store.inventory().fertilizer).toBe(before - 1);
    component.onWillDismiss();
    expect(component.backpackOpen()).toBe(false);
  });

  it('plants only a confirmed backpack selection and ignores a repeated confirmation', () => {
    const { component, store, fixture } = setup();
    store.selectDemoTree(demoPlantingSpots[0].id);
    component.toggleBackpack();
    const seed = component.backpackSeeds()[0];
    expect(store.demoTreePlanted()).toBe(false);
    expect(store.inventory().seeds).toBe(1);
    component.plantBackpackSeed({ id: seed.id, name: '阿發的樹' });
    fixture.detectChanges();
    expect(store.demoTreePlanted()).toBe(true);
    expect(store.demoTrees()[store.activeDemoTreeId()].nickName).toBe('阿發的樹');
    expect(store.inventory().seeds).toBe(0);
    expect(component.canUse('water')).toBe(true);
    expect(component.backpackOpen()).toBe(false);
    component.plantBackpackSeed({ id: seed.id, name: '再次種植' });
    expect(store.inventory().seeds).toBe(0);
  });

  it('blocks backpack planting and fertilizer outside the care radius without spending inventory', () => {
    const { component, store } = setup();
    store.selectDemoTree(demoPlantingSpots[0].id);
    locationOverride.set(null);
    const denied = vi.fn();
    component.interactionDenied.subscribe(denied);
    const inventory = store.inventory();
    component.toggleBackpack();
    component.plantBackpackSeed({ id: 'legacy-seed-0', name: '阿發的樹' });
    component.useBackpackItem('fertilizer');
    expect(denied).toHaveBeenCalledTimes(2);
    expect(store.inventory()).toBe(inventory);
    expect(store.demoTreePlanted()).toBe(false);
  });

  it('uses live weather at the selected site and Taipei time without changing cultivation progress', async () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(HomeCultivateComponent, {
      set: {template: '<app-tree-scene [weather]="weather()" [timeOfDay]="timeOfDay()" />', imports: [TreeSceneComponent]},
    });
    vi.setSystemTime(new Date('2026-10-27T18:59:00+08:00'));
    const weatherAt = vi.mocked(LiveEnvironmentService.prototype.weatherAt);
    weatherAt.mockResolvedValueOnce({source: 'open-meteo', condition: 'rainy', temperatureC: 22,
      precipitationMm: 2, observedAt: new Date().toISOString()});
    const fixture = createFixture();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const scene: TreeSceneComponent = fixture.debugElement.query(
      By.directive(TreeSceneComponent),
    ).componentInstance;
    const inventory = component.ps.inventory();
    const growth = component.ps.demoTreeGrowth();
    expect(weatherAt).toHaveBeenCalledWith(findHomeTree(component.ps.activeDemoTreeId())!.position, expect.any(AbortSignal));
    expect(component.weather()).toBe('rainy');
    expect(scene.weather()).toBe('rainy');
    expect(scene.timeOfDay()).toBe('dusk');
    expect(fixture.nativeElement.querySelector('.sky').style.backgroundImage).toContain(treeSceneBackground('rainy', 'dusk'));
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(scene.timeOfDay()).toBe('night');
    expect(component.ps.demoTreeGrowth()).toBe(growth);
    expect(component.ps.inventory()).toEqual(inventory);
    component.ps.selectDemoTree('tree-5');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    expect(weatherAt).toHaveBeenLastCalledWith(findHomeTree('tree-5')!.position, expect.any(AbortSignal));
    expect(scene.weather()).toBe('cloudy');
  });

  it('keeps remote care controls clickable without a persistent proximity alert', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    TestBed.inject(ProgressStore).selectDemoTree('tree-5');
    locationOverride.set(null);
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.tree-title')?.textContent).toContain('銀杏123');
    expect(root.querySelector('.tree-title')?.textContent).toContain('板橋車站');
    expect(root.querySelector('.tree-badges')?.textContent).toContain('銀杏');
    expect(root.querySelector('.too-far-alert')).toBeNull();
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.resource'));
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    const denied = vi.fn();
    fixture.componentInstance.interactionDenied.subscribe(denied);
    buttons[0].dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }));
    expect(denied).toHaveBeenCalledOnce();

    locationOverride.set(undefined);
    fixture.detectChanges();
    expect(root.querySelector('.tree-status-info[role="status"]:not(.weed-status)')).toBeNull();
    expect(buttons.some((button) => !button.disabled)).toBe(true);
  });

  it('blocks pointer and keyboard resource use and harvest while viewing remotely', () => {
    const { fixture, component, store, dispatch } = setup();
    locationOverride.set(null);
    fixture.detectChanges();
    const denied = vi.fn();
    component.interactionDenied.subscribe(denied);
    const inventory = store.inventory();
    for (const resource of component.resources) {
      expect(component.canUse(resource)).toBe(false);
      dispatch('pointerdown', 200, resource);
      dispatch('pointerup', 200, resource);
      component.keyboardUse(resource);
    }
    expect(denied).toHaveBeenCalledTimes(6);
    vi.advanceTimersByTime(1000);
    expect(store.inventory()).toEqual(inventory);
    expect(component.heldResource()).toBeNull();
    store.selectDemoTree('tree-6');
    expect(store.demoFruitReady()).toBe(true);
    expect(component.canHarvest()).toBe(false);
    component.harvest();
    expect(store.demoHarvestStartedAt()).toBeNull();

    locationOverride.set(undefined);
    fixture.detectChanges();
    expect(component.canHarvest()).toBe(true);
    component.harvest();
    expect(store.demoHarvestStartedAt()).not.toBeNull();
  });

  it('warns once per remote shake while swaying without falling fruit or earning points', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const store = TestBed.inject(ProgressStore);
    store.selectDemoTree('tree-6');
    locationOverride.set(null);
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const scene: TreeSceneComponent = fixture.debugElement.query(
      By.directive(TreeSceneComponent),
    ).componentInstance;
    vi.spyOn(scene, 'canInteract').mockReturnValue(true);
    vi.spyOn(scene, 'containsFeedingPoint').mockReturnValue(true);
    const surface: HTMLElement = fixture.nativeElement.querySelector('.scene');
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => true);
    surface.releasePointerCapture = vi.fn();
    const denied = vi.fn();
    fixture.componentInstance.interactionDenied.subscribe(denied);
    const inventory = store.inventory();
    const dispatch = (type: string, x: number) =>
      surface.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: 140,
          bubbles: true,
        }),
      );

    dispatch('pointerdown', 160);
    dispatch('pointermove', 200);
    expect(scene.shakeAngle()).toBe(TREE_SWAY_MAX_DEGREES);
    for (const x of [160, 200, 160, 200]) dispatch('pointermove', x);
    expect(denied).toHaveBeenCalledOnce();
    expect(scene.fruitState()).toBe('ripe');
    expect(store.demoHarvestStartedAt()).toBeNull();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreePoints()).toBe(0);
    expect(store.inventory()).toEqual(inventory);
    dispatch('pointerup', 160);
    expect(scene.shakeAngle()).toBe(0);

    locationOverride.set(undefined);
    fixture.detectChanges();
    dispatch('pointerdown', 160);
    for (const x of [200, 160, 200, 160]) dispatch('pointermove', x);
    expect(denied).toHaveBeenCalledOnce();
    expect(store.demoHarvestStartedAt()).not.toBeNull();
  });

  it.each(['light', 'water'] as const)(
    'stops %s spending immediately on geographic range loss without closing the modal',
    (resource) => {
      const { fixture, component, store, dispatch } = setup();
      dispatch('pointerdown', 200, resource);
      vi.advanceTimersByTime(500);
      const inventory = store.inventory();
      locationOverride.set(null);
      fixture.detectChanges();
      expect(component.isOpen()).toBe(true);
      expect(component.heldResource()).toBeNull();
      expect(component.feeding()).toBe(false);
      vi.advanceTimersByTime(2000);
      dispatch('pointerup', 200, resource);
      expect(store.inventory()).toEqual(inventory);

      locationOverride.set(undefined);
      fixture.detectChanges();
      vi.advanceTimersByTime(1000);
      expect(store.inventory()).toEqual(inventory);
      dispatch('pointerdown', 200, resource);
      vi.advanceTimersByTime(1000);
      const key = resource === 'light' ? 'lightEnergy' : 'waterDrops';
      expect(store.inventory()[key]).toBeLessThan(inventory[key]);
    },
  );

  it('renders endpoint check-in in the existing care modal and disables it outside range', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    TestBed.inject(ProgressStore).selectDemoTree('tree-5');
    walkSession.hasActiveRoute.set(true);
    walkSession.destination.set({ id: 'tree-5', position: findHomeTree('tree-5')!.position });
    locationOverride.set(null);
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const confirm = vi.fn();
    fixture.componentInstance.destinationCheckIn.subscribe(confirm);
    const button = fixture.debugElement.query(By.css('.destination-check-in'));
    expect(button.nativeElement.textContent).toContain('確認打卡終點');
    expect(button.componentInstance.disabled).toBe(true);
    fixture.componentInstance.confirmDestinationCheckIn();
    expect(confirm).not.toHaveBeenCalled();
    locationOverride.set(undefined);
    fixture.detectChanges();
    button.nativeElement.click();
    expect(confirm).toHaveBeenCalledOnce();
    walkSession.hasActiveRoute.set(false);
    walkSession.destination.set(null);
    walkSession.checkInError.set('終點打卡成功！');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.destination-check-in'))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('終點打卡成功');
  });
  it.skipIf(TREE_WEEDS_ENABLED)(
    'hides paused weeds and keeps full nutrient absorption without clearing notifications',
    () => {
      TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
      TestBed.overrideComponent(IonModal, {
        set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
      });
      const fixture = createFixture();
      const component = fixture.componentInstance;
      component.ps.selectDemoTree('tree-2');
      fixture.detectChanges();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('button.weed')).toHaveLength(0);
      expect(fixture.nativeElement.querySelector('.ground-scenery')).not.toBeNull();
      expect(component.growthConversionRate()).toBe(100);
      const notified = vi.fn();
      component.feedbackRequested.subscribe(notified);
      component.pullWeed(0);
      expect(notified).not.toHaveBeenCalled();
      component.ps.activateDemoFertilizer();
      fixture.detectChanges();
      expect(component.growthConversionRate()).toBe(120);
    },
  );

  it.runIf(TREE_WEEDS_ENABLED)(
    'removes weeds individually and keeps the debuff through reopening until every weed is gone',
    () => {
      TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
      TestBed.overrideComponent(IonModal, {
        set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
      });
      const fixture = createFixture();
      const component = fixture.componentInstance;
      component.ps.selectDemoTree('tree-2');
      fixture.detectChanges();
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      const inventory = component.ps.inventory();
      expect(root.querySelectorAll('button.weed')).toHaveLength(12);
      expect(component.growthConversionRate()).toBe(90);
      const notified = vi.fn();
      component.feedbackRequested.subscribe(notified);
      const pullFirst = () => {
        const weed = root.querySelector<HTMLButtonElement>('button.weed')!;
        weed.setPointerCapture = vi.fn();
        weed.hasPointerCapture = vi.fn(() => true);
        weed.releasePointerCapture = vi.fn();
        for (const [type, y] of [
          ['pointerdown', 160],
          ['pointermove', 110],
          ['pointerup', 110],
        ] as const) {
          weed.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              pointerId: 1,
              isPrimary: true,
              button: 0,
              clientX: 100,
              clientY: y,
            }),
          );
        }
        vi.advanceTimersByTime(240);
      };
      locationOverride.set(null);
      fixture.detectChanges();
      const denied = vi.fn();
      component.interactionDenied.subscribe(denied);
      pullFirst();
      expect(denied).toHaveBeenCalledOnce();
      expect(component.ps.demoTreeWeeds()).toHaveLength(12);
      locationOverride.set(undefined);
      fixture.detectChanges();
      for (let index = 0; index < 3; index++) {
        pullFirst();
        fixture.detectChanges();
      }
      expect(component.ps.demoTreeWeeds()).toHaveLength(9);
      expect(root.querySelectorAll('button.weed')).toHaveLength(9);
      expect(component.growthConversionRate()).toBe(90);
      expect(component.ps.inventory()).toBe(inventory);
      walkSession.isCultivating.set(false);
      fixture.detectChanges();
      component.pullWeed(3);
      expect(component.ps.demoTreeWeeds()).toHaveLength(9);
      walkSession.isCultivating.set(true);
      fixture.detectChanges();
      expect(root.querySelectorAll('button.weed')).toHaveLength(9);
      expect(component.growthConversionRate()).toBe(90);
      component.ps.activateDemoFertilizer();
      fixture.detectChanges();
      expect(component.growthConversionRate()).toBe(108);
      expect(component.ps.demoWeedPenaltyActive()).toBe(true);
      while (component.ps.demoTreeWeeds().length > 1) {
        pullFirst();
        fixture.detectChanges();
      }
      expect(component.growthConversionRate()).toBe(108);
      pullFirst();
      fixture.detectChanges();
      expect(root.querySelectorAll('button.weed')).toHaveLength(0);
      expect(component.growthConversionRate()).toBe(120);
      expect(notified).toHaveBeenCalledExactlyOnceWith('已清除雜草，恢復養分吸收率。');
      component.ps.selectDemoTree('tree-3');
      fixture.detectChanges();
      expect(component.ps.demoTreeWeeds()).toHaveLength(10);
      expect(component.growthConversionRate()).toBe(108);
    },
  );

  it('refreshes the tree scene after every modal presentation completes', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const scene: TreeSceneComponent = fixture.debugElement.query(
      By.directive(TreeSceneComponent),
    ).componentInstance;
    const refresh = vi.spyOn(scene, 'refresh');
    const modal = fixture.debugElement.query(By.directive(IonModal));
    modal.triggerEventHandler('didPresent', new CustomEvent('didPresent'));
    modal.triggerEventHandler('didPresent', new CustomEvent('didPresent'));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('allows uninterrupted native handle dismissal while blocking other interactive dismissal', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const modal: IonModal = fixture.debugElement.query(By.directive(IonModal)).componentInstance;
    vi.spyOn(modal, 'dismiss').mockResolvedValue(true);
    expect(modal.handle).toBe(true);
    expect(modal.handleBehavior).toBe('none');
    expect(modal.backdropDismiss).toBe(false);
    expect(modal.breakpoints).toEqual([0, 1]);
    expect(modal.initialBreakpoint).toBe(1);
    // A callback makes Ionic snap back before dismissing, even when it resolves to true.
    expect(modal.canDismiss).toBe(true);
    const root: HTMLElement = fixture.nativeElement;
    const mouse = vi.fn();
    const touch = vi.fn();
    const pointer = vi.fn();
    root.addEventListener('mousedown', mouse);
    root.addEventListener('touchstart', touch);
    root.addEventListener('pointerdown', pointer);
    const scene = root.querySelector('.scene')!;
    scene.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    scene.dispatchEvent(new Event('touchstart', { bubbles: true }));
    scene.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(mouse).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
    expect(pointer).toHaveBeenCalledTimes(1);
    const finishCultivating = vi.spyOn(walkSession, 'finishCultivating');
    fixture.componentInstance.onWillDismiss();
    fixture.componentInstance.dismissed();
    expect(finishCultivating).toHaveBeenCalledOnce();
  });

  it('shakes down a second ripe tree after the first one has been harvested', () => {
    const { fixture, component, store } = setup(true);
    const surface: HTMLElement = fixture.nativeElement.querySelector('.scene');
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => true);
    surface.releasePointerCapture = vi.fn();
    const shake = () => {
      for (const [index, x] of [160, 200, 160, 200, 160].entries()) {
        surface.dispatchEvent(
          new PointerEvent(index === 0 ? 'pointerdown' : 'pointermove', {
            pointerId: 1,
            isPrimary: true,
            button: 0,
            clientX: x,
            clientY: 140,
            bubbles: true,
          }),
        );
      }
    };
    store.selectDemoTree('tree-6');
    fixture.detectChanges();
    expect(component.canHarvest()).toBe(true);
    shake();
    expect(store.demoHarvestStartedAt()).not.toBeNull();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    fixture.detectChanges();
    expect(component.canHarvest()).toBe(false);
    expect(store.demoTreePoints()).toBe(50);

    store.selectDemoTree('tree-4');
    store.applyTaskInventory({ waterDrops: target * 15, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 0, water: target * 15, fertilizer: false });
    fixture.detectChanges();
    expect(component.canHarvest()).toBe(true);
    shake();
    expect(store.demoHarvestStartedAt()).not.toBeNull();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    fixture.detectChanges();
    expect(component.canHarvest()).toBe(false);
    expect(store.demoTreePoints()).toBe(100);
  });

  it('shows soil sparkles throughout the fertilizer buff and removes them on expiry', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const scene: TreeSceneComponent = fixture.debugElement.query(
      By.directive(TreeSceneComponent),
    ).componentInstance;
    vi.spyOn(scene, 'canInteract').mockReturnValue(true);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.fertilizer-soil')).toBeNull();
    fixture.componentInstance.keyboardUse('fertilizer');
    fixture.detectChanges();
    expect(root.querySelector('.fertilizer-soil')).not.toBeNull();
    fixture.componentInstance.keyboardUse('water');
    fixture.detectChanges();
    expect(scene.resourceEffect()).toBe('water');
    expect(root.querySelector('.fertilizer-soil')).not.toBeNull();
    fixture.componentInstance.keyboardUse('water');
    vi.setSystemTime(TestBed.inject(ProgressStore).demoFertilizerExpiresAt()!);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(scene.fertilized()).toBe(false);
    expect(root.querySelector('.fertilizer-soil')).toBeNull();
  });

  it('preserves the compact resource dock and renders growth progress and the pouring can', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const modal: IonModal = fixture.debugElement.query(By.directive(IonModal)).componentInstance;
    vi.spyOn(modal, 'dismiss').mockResolvedValue(true);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.resource-dock button.resource')).toHaveLength(3);
    expect(root.querySelector('.growth-heading')?.textContent).toContain('0%');
    const panel = root.querySelector('.scene-shell > .panel')!;
    expect(panel.querySelector('.top > .tree-header')).not.toBeNull();
    expect(panel.querySelector('.top > .growth-heading progress')).not.toBeNull();
    expect(getComputedStyle(panel).pointerEvents).toBe('none');
    expect(getComputedStyle(panel.querySelector('.resource-dock')!).pointerEvents).toBe('auto');
    expect(getComputedStyle(panel.querySelector('.growth-heading')!).position).not.toBe('absolute');
    expect(getComputedStyle(panel.querySelector('.resource-dock')!).gridRow).toBe('3');
    expect(root.querySelector('.resource.water')?.getAttribute('aria-label')).toContain('15 滴');
    const canvas = root.querySelector('app-tree-scene canvas')!;
    const layout = root.querySelector('.cultivation-layout')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 50, 320, 240));
    vi.spyOn(layout, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 390, 600));
    const scene: TreeSceneComponent = fixture.debugElement.query(
      By.directive(TreeSceneComponent),
    ).componentInstance;
    scene.target.set({
      x: 160,
      y: 190,
      radius: 55,
      modelX: 160,
      modelY: 195,
      rootX: 160,
      rootY: 211,
      soil: { x: 74, y: 196, width: 172, height: 30 },
    });
    fixture.componentInstance.heldResource.set('water');
    fixture.componentInstance.ghost.set({ x: 120, y: 120 });
    fixture.componentInstance.feeding.set(true);
    fixture.componentInstance.inRange.set(true);
    fixture.detectChanges();
    expect(root.querySelector('.held-item svg.watering-can.pouring')).not.toBeNull();
    expect(root.querySelectorAll('.water-stream .water-drop')).toHaveLength(8);
    expect(root.querySelectorAll('.water-stream .water-splash')).toHaveLength(12);
    const stream = root.querySelector('.water-stream')!;
    expect(stream.parentElement).toBe(layout);
    const streamStyle = getComputedStyle(stream);
    expect(streamStyle.position).toBe('absolute');
    expect(streamStyle.width).toBe('100%');
    expect(streamStyle.height).toBe('100%');
    expect(streamStyle.pointerEvents).toBe('none');
    expect(streamStyle.overflow).toBe('hidden');
    expect(getComputedStyle(root.querySelector('.water-drop')!).fill).toBe('rgb(71, 174, 222)');
    const geometry = fixture.componentInstance.waterGeometry()!;
    expect(geometry.nozzle).toEqual({ x: 120, y: 120 });
    expect(geometry.target).toEqual({ x: 170, y: 261 });
    expect(root.querySelector('.water-impact')?.getAttribute('cx')).toBe('170');
    expect(root.querySelector('.water-impact')?.getAttribute('cy')).toBe('265');
    expect(root.querySelector('.water-guide')).toBeNull();
    expect(root.querySelector('animateMotion')).toBeNull();
    const can = root.querySelector<HTMLElement>('.held-item')!;
    expect(getComputedStyle(can).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(can).boxShadow).toBe('none');
    expect(Number.parseFloat(can.style.left)).toBeCloseTo(geometry.can.x);
    expect(Number.parseFloat(can.style.top)).toBeCloseTo(geometry.can.y);
    fixture.componentInstance.reducedMotion.set(false);
    fixture.detectChanges();
    const motions = root.querySelectorAll('.water-stream .water-drop animateMotion');
    expect(motions).toHaveLength(8);
    for (const [index, motion] of Array.from(motions).entries()) {
      expect(motion.getAttribute('path')).toBe(geometry.drops[index].path);
      expect(motion.getAttribute('dur')).toBe('0.6s');
      expect(motion.getAttribute('repeatCount')).toBe('indefinite');
    }
    const splashMotions = root.querySelectorAll('.water-stream .water-splash animateMotion');
    expect(splashMotions).toHaveLength(12);
    for (const [index, motion] of Array.from(splashMotions).entries()) {
      expect(motion.getAttribute('path')).toBe(geometry.splashes[index].path);
      expect(motion.getAttribute('repeatCount')).toBe('indefinite');
    }
    const store = TestBed.inject(ProgressStore);
    for (let tick = 0; tick < 3; tick++) {
      expect(store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false })).toBe(true);
      fixture.detectChanges();
      expect(root.querySelector('.water-stream')).toBe(stream);
      expect(root.querySelector('.water-stream animateMotion')).toBe(motions[0]);
      expect(getComputedStyle(stream).position).toBe('absolute');
    }
    fixture.componentInstance.feeding.set(false);
    fixture.detectChanges();
    expect(root.querySelector('.held-item svg.watering-can')).not.toBeNull();
    expect(root.querySelector('.water-stream')).toBeNull();
    expect(root.querySelector('.scene.watered')).not.toBeNull();
    expect(root.querySelector('.soil-base')?.getAttribute('fill')).toBe('#61432e');
    expect(root.querySelector('.tree-badges')?.textContent).toContain('已澆水');
    fixture.componentInstance.ghost.set({ x: 230, y: 120 });
    fixture.detectChanges();
    expect(root.querySelector<SVGElement>('.watering-can')!.style.transform).toContain(
      'scaleX(-1)',
    );
  });

  it('refreshes water status while open and after reopening or switching trees', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const store = TestBed.inject(ProgressStore);
    fixture.detectChanges();
    expect(component.waterState()).toBe('normal');
    store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false });
    fixture.detectChanges();
    expect(component.waterState()).toBe('watered');
    const wateredAt = store.demoTreeLastWateredAt()!;
    vi.setSystemTime(wateredAt + TREE_WATERED_DURATION_MS);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(component.waterState()).toBe('normal');
    expect(fixture.nativeElement.querySelector('.soil-base').getAttribute('fill')).toBe('#9b7048');
    walkSession.isCultivating.set(false);
    fixture.detectChanges();
    vi.setSystemTime(wateredAt + TREE_DRY_AFTER_MS + 1);
    walkSession.isCultivating.set(true);
    fixture.detectChanges();
    expect(component.waterState()).toBe('dry');
    expect(fixture.nativeElement.querySelector('.tree-badges').textContent).toContain('缺水');
    expect(fixture.nativeElement.querySelector('.soil-base').getAttribute('fill')).toBe('#bf986c');
    store.selectDemoTree('tree-4');
    store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false });
    fixture.detectChanges();
    expect(component.waterState()).toBe('watered');
    store.selectDemoTree('demo-tree');
    fixture.detectChanges();
    expect(component.waterState()).toBe('dry');
    store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false });
    fixture.detectChanges();
    expect(component.waterState()).toBe('watered');
  });

  it('shakes ripe SVG fruit, credits points after landing, and stays harvested', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const scene: TreeSceneComponent = fixture.debugElement.query(
      By.directive(TreeSceneComponent),
    ).componentInstance;
    vi.spyOn(scene, 'canInteract').mockReturnValue(true);
    vi.spyOn(scene, 'containsFeedingPoint').mockReturnValue(true);
    const surface = root.querySelector<HTMLElement>('.scene')!;
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => true);
    surface.releasePointerCapture = vi.fn();
    const store = TestBed.inject(ProgressStore);
    store.applyTaskInventory({ waterDrops: target * 15, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 0, water: target * 15, fertilizer: false });
    fixture.detectChanges();
    expect(root.querySelectorAll('.fallback-fruit')).toHaveLength(50);
    const dispatch = (type: string, x: number) =>
      surface.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: 120,
          bubbles: true,
        }),
      );
    dispatch('pointerdown', 100);
    for (const x of [140, 100, 140, 100]) dispatch('pointermove', x);
    fixture.detectChanges();
    expect(root.querySelectorAll('.fallback-fruit.falling')).toHaveLength(50);
    expect(store.demoTreePoints()).toBe(0);
    expect(root.querySelector('.harvest-panel button')).toBeNull();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS - 1);
    expect(store.demoTreePoints()).toBe(0);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(store.demoTreePoints()).toBe(50);
    expect(root.querySelector('.tree-badges cub-badge:nth-child(2)')?.textContent).toContain(
      '已收成',
    );
    expect(root.querySelector('.growth-heading')?.textContent).toContain('100%');
    expect(root.querySelectorAll('.fallback-fruit')).toHaveLength(0);
    expect(scene.stage()).toBe('large');
    expect(root.querySelector('progress')?.max).toBe(target);
    for (const resource of fixture.componentInstance.resources) {
      expect(fixture.componentInstance.canUse(resource)).toBe(false);
    }
    expect(root.querySelector('.tree-badges cub-badge:nth-child(2)')?.textContent).toContain(
      '已收成',
    );
    expect(root.querySelector('.harvest-panel button')).toBeNull();
    expect(fixture.componentInstance.stageLabel()).toBe('已收成');
    const resourceButtons = root.querySelectorAll<HTMLButtonElement>('.resource-dock button');
    expect(resourceButtons).toHaveLength(3);
    for (const button of resourceButtons) {
      expect(button.disabled).toBe(true);
    }
    const inventory = store.inventory();
    for (const resource of fixture.componentInstance.resources) {
      fixture.componentInstance.keyboardUse(resource);
    }
    vi.advanceTimersByTime(1000);
    expect(store.inventory()).toEqual(inventory);
    const modal: IonModal = fixture.debugElement.query(By.directive(IonModal)).componentInstance;
    vi.spyOn(modal, 'dismiss').mockResolvedValue(true);
    walkSession.isCultivating.set(false);
    fixture.detectChanges();
    walkSession.isCultivating.set(true);
    fixture.detectChanges();
    expect(root.querySelectorAll('.fallback-fruit')).toHaveLength(0);
    expect(root.querySelector('.tree-badges cub-badge:nth-child(2)')?.textContent).toContain(
      '已收成',
    );
    expect(root.querySelector('.harvest-panel button')).toBeNull();
  });

  it('keeps an hourly recovery toast open only while the harvested tree modal is open', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const store = TestBed.inject(ProgressStore);
    const treeId = 'tree-6';
    store.selectDemoTree(treeId);
    const harvestedAt = Date.now();
    patchState(store as never, {
      demoTrees: {
        ...store.demoTrees(),
        [treeId]: {
          ...store.demoTrees()[treeId],
          harvestCount: 1,
          harvestStartedAt: null,
          harvestedAt,
        },
      },
    });
    const fixture = TestBed.createComponent(HomeCultivateComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const toast = fixture.nativeElement.querySelector('ion-toast') as HTMLElement & {
      duration: number;
      isOpen: boolean;
      message: string;
      swipeGesture: string;
      cssClass: string;
    };

    expect(component.harvestRecoveryToastOpen()).toBe(true);
    expect(component.harvestRecoveryMessage()).toBe('此樹木已收成，將於24小時後搬進你的回憶林。');
    expect(toast.isOpen).toBe(true);
    expect(toast.duration).toBe(0);
    expect(toast.swipeGesture).toBe('none');
    expect(toast.cssClass).toContain('interaction-warning-toast');
    expect(toast.message).toBe(component.harvestRecoveryMessage());

    vi.advanceTimersByTime(60 * 60 * 1000);
    fixture.detectChanges();
    expect(component.harvestRecoveryMessage()).toContain('23小時');

    walkSession.isCultivating.set(false);
    fixture.detectChanges();
    expect(component.harvestRecoveryToastOpen()).toBe(false);
    expect(toast.isOpen).toBe(false);
    fixture.destroy();
  });

  it('finishes an accepted harvest after closing the modal without duplicating points', () => {
    const { component, fixture, store } = setup();
    store.applyTaskInventory({ waterDrops: target * 15, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 0, water: target * 15, fertilizer: false });
    component.harvest();
    component.harvest();
    fixture.destroy();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreePoints()).toBe(50);
    expect(store.demoTreeGrowth()).toBe(target);
  });

  it('opens the result only after crediting points and does not reopen it on confirmation', () => {
    const { component, fixture, store } = setup();
    const dialog = TestBed.inject(DialogService);
    const showResult = vi.spyOn(dialog, 'openTreePointResultDialog');
    store.selectDemoTree('tree-6');
    fixture.detectChanges();

    component.harvest();
    component.harvest();
    fixture.detectChanges();
    expect(showResult).not.toHaveBeenCalled();
    expect(dialog.isDialogOpen()).toBe(false);

    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS - 1);
    fixture.detectChanges();
    expect(showResult).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(showResult).toHaveBeenCalledExactlyOnceWith({
      earnedPoints: 50,
      balance: 50,
      isDemo: true,
    });

    dialog.closeDialog('confirm');
    fixture.detectChanges();
    expect(dialog.isDialogOpen()).toBe(false);
    expect(component.isOpen()).toBe(true);
    expect(showResult).toHaveBeenCalledTimes(1);
  });

  it('does not report an existing balance as a new harvest when the component is created', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(HomeCultivateComponent, {
      set: { template: '', imports: [] },
    });
    const store = TestBed.inject(ProgressStore);
    store.selectDemoTree('tree-6');
    expect(store.startDemoHarvest()).toBe(true);
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreePoints()).toBe(50);
    const dialog = TestBed.inject(DialogService);
    const showResult = vi.spyOn(dialog, 'openTreePointResultDialog');
    const fixture = createFixture();
    fixture.detectChanges();

    expect(showResult).not.toHaveBeenCalled();
    expect(dialog.isDialogOpen()).toBe(false);
  });

  it('ripens at the actual environment target and allows reward-free sway after harvest', () => {
    TestBed.configureTestingModule({ imports: [HomeCultivateComponent] });
    TestBed.overrideComponent(IonModal, {
      set: { template: '<ng-container [ngTemplateOutlet]="template"></ng-container>' },
    });
    const fixture = createFixture();
    fixture.detectChanges();
    fixture.detectChanges();
    const scene: TreeSceneComponent = fixture.debugElement.query(
      By.directive(TreeSceneComponent),
    ).componentInstance;
    vi.spyOn(scene, 'canInteract').mockReturnValue(true);
    vi.spyOn(scene, 'containsFeedingPoint').mockReturnValue(true);
    const root: HTMLElement = fixture.nativeElement;
    const surface = root.querySelector<HTMLElement>('.scene')!;
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => true);
    surface.releasePointerCapture = vi.fn();
    const store = TestBed.inject(ProgressStore);
    expect(store.demoGrowthTarget()).toBe(TREE_GROWTH_PER_HARVEST);
    const water = TREE_GROWTH_PER_HARVEST * 15;
    store.applyTaskInventory({ waterDrops: water, fertilizer: 5 });
    expect(store.cultivateDemoTree({ lightEnergy: 0, water, fertilizer: false })).toBe(true);
    fixture.detectChanges();
    expect(scene.stage()).toBe('large');
    expect(scene.canShakeHarvest()).toBe(true);
    expect(root.querySelectorAll('.fallback-fruit')).toHaveLength(50);
    const harvest = vi.spyOn(store, 'startDemoHarvest');
    fixture.componentInstance.harvest();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    fixture.detectChanges();
    const inventory = store.inventory();
    expect(scene.canSway()).toBe(true);
    expect(scene.canShakeHarvest()).toBe(false);
    for (const [type, x] of [
      ['pointerdown', 160],
      ['pointermove', 200],
      ['pointermove', 160],
      ['pointermove', 200],
      ['pointermove', 160],
      ['pointerup', 160],
    ] as const) {
      surface.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: 140,
          bubbles: true,
        }),
      );
    }
    expect(harvest).toHaveBeenCalledTimes(1);
    expect(store.demoTreePoints()).toBe(50);
    expect(store.demoTreeGrowth()).toBe(TREE_GROWTH_PER_HARVEST);
    expect(store.inventory()).toEqual(inventory);
    expect(scene.shakeAngle()).toBe(0);
  });

  it('spends exactly 100 light per second inside the range, nothing outside, and stops on release', () => {
    const { component, store, dispatch } = setup();
    dispatch('pointerdown', 0);
    vi.advanceTimersByTime(1000);
    expect(store.demoTreeGrowth()).toBe(0);
    dispatch('pointermove', 200);
    vi.advanceTimersByTime(1000);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(5000);
    expect(store.inventory().lightEnergy).toBe(5846);
    dispatch('pointermove', 0);
    vi.advanceTimersByTime(1000);
    expect(store.demoTreeGrowth()).toBe(0);
    dispatch('pointerup', 0);
    vi.advanceTimersByTime(1000);
    expect(component.heldResource()).toBeNull();
    expect(store.demoTreeGrowth()).toBe(0);
  });

  it('gives every feeding the active 24-hour fertilizer bonus', () => {
    const { component, store } = setup();
    component.keyboardUse('fertilizer');
    expect(store.inventory().fertilizer).toBe(4);
    expect(component.fertilized()).toBe(true);
    component.keyboardUse('light');
    vi.advanceTimersByTime(1000);
    component.keyboardUse('light');
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(6000);
    component.keyboardUse('water');
    vi.advanceTimersByTime(1000);
    component.keyboardUse('water');
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(6600);
    expect(store.inventory().waterDrops).toBe(776);
  });

  it('only consumes fertilizer on a successful drop and water during time held inside', () => {
    const { store, dispatch } = setup();
    dispatch('pointerdown', 0, 'water');
    dispatch('pointerup', 0, 'water');
    expect(store.inventory().waterDrops).toBe(777);
    dispatch('pointerdown', 0, 'fertilizer');
    dispatch('pointerup', 0, 'fertilizer');
    expect(store.inventory().fertilizer).toBe(5);
    dispatch('pointerdown', 0, 'fertilizer');
    dispatch('pointermove', 200, 'fertilizer');
    dispatch('pointercancel', 200, 'fertilizer');
    expect(store.inventory().fertilizer).toBe(5);
    dispatch('pointerdown', 0, 'fertilizer');
    dispatch('pointerup', 200, 'fertilizer');
    expect(store.inventory().fertilizer).toBe(4);
    dispatch('pointerdown', 0, 'water');
    dispatch('pointerup', 200, 'water');
    expect(store.inventory().waterDrops).toBe(777);
    dispatch('pointerdown', 0, 'water');
    dispatch('pointermove', 200, 'water');
    vi.advanceTimersByTime(1000);
    dispatch('pointerup', 200, 'water');
    expect(store.inventory().waterDrops).toBe(776);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(600);
  });

  it('continually pours at the configured water rate, pauses outside, and adds no drop on release', () => {
    const { component, store, dispatch, setRate } = setup();
    setRate('water', '5');
    dispatch('pointerdown', 0, 'water');
    vi.advanceTimersByTime(1000);
    expect(store.inventory().waterDrops).toBe(777);
    dispatch('pointermove', 200, 'water');
    expect(component.watering()).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(store.inventory().waterDrops).toBe(767);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(5000);
    dispatch('pointermove', 0, 'water');
    expect(component.watering()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(store.inventory().waterDrops).toBe(767);
    dispatch('pointerup', 0, 'water');
    vi.advanceTimersByTime(2000);
    expect(store.inventory().waterDrops).toBe(767);
    expect(component.heldResource()).toBeNull();
  });

  it('retains partial-drop time when moving out and back into range', () => {
    const { store, dispatch } = setup();
    dispatch('pointerdown', 200, 'water');
    vi.advanceTimersByTime(500);
    dispatch('pointermove', 0, 'water');
    vi.advanceTimersByTime(1000);
    dispatch('pointermove', 200, 'water');
    vi.advanceTimersByTime(500);
    expect(store.inventory().waterDrops).toBe(776);
  });

  it('uses a changed light rate on the next gesture without retroactive spending', () => {
    const { component, store, setRate } = setup();
    component.keyboardUse('light');
    vi.advanceTimersByTime(550);
    setRate('light', '250');
    expect(component.heldResource()).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(2750);
    component.keyboardUse('light');
    vi.advanceTimersByTime(1000);
    expect(store.demoTreeGrowth()).toBe(2);
    expect(store.demoGrowthRemainder()).toBe(250);
  });

  it.each(['0', '-1', '1.5', '', '9007199254740992'])(
    'reports invalid rate %s and prevents starting that resource',
    (value) => {
      const { component, store, setRate } = setup();
      setRate('water', value);
      expect(component.rateErrors().water).toBeTruthy();
      expect(component.canUse('water')).toBe(false);
      component.keyboardUse('water');
      vi.advanceTimersByTime(1000);
      expect(store.inventory().waterDrops).toBe(777);
      setRate('water', '3');
      expect(component.rateErrors().water).toBeNull();
      expect(component.canUse('water')).toBe(true);
    },
  );

  it('respects inventory, charges the whole overflowing water batch, then stops at 100%', () => {
    const { component, store, setRate } = setup();
    store.applyTaskInventory({ waterDrops: 2, fertilizer: 5 });
    setRate('water', '1000');
    component.keyboardUse('water');
    vi.advanceTimersByTime(1000);
    expect(store.inventory().waterDrops).toBe(0);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(1000);
    expect(component.heldResource()).toBeNull();
    store.applyTaskInventory({ waterDrops: nearTargetWater - 2, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 0, water: nearTargetWater - 2, fertilizer: false });
    expect(store.demoTreeGrowth()).toBe(target - 1);
    expect(store.demoGrowthRemainder()).toBe(0);
    store.applyTaskInventory({ waterDrops: 100, fertilizer: 5 });
    component.keyboardUse('water');
    vi.advanceTimersByTime(1000);
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.inventory().waterDrops).toBe(50);
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(component.heldResource()).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(store.inventory().waterDrops).toBe(50);
  });

  it('allows a final water drop to finish fractional growth and discards its excess', () => {
    const { component, store } = setup();
    store.applyTaskInventory({ waterDrops: nearTargetWater + 1, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 148, water: nearTargetWater, fertilizer: false });
    expect(store.demoTreeGrowth()).toBe(target - 1);
    expect(store.demoGrowthRemainder()).toBe(7400);
    expect(component.canUse('water')).toBe(true);
    component.keyboardUse('water');
    vi.advanceTimersByTime(1000);
    expect(store.inventory().waterDrops).toBe(0);
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(component.heldResource()).toBeNull();
  });

  it.each(['pointercancel', 'blur', 'hidden', 'dismiss', 'destroy'])(
    'stops water spending after %s',
    (reason) => {
      const { component, fixture, store, dispatch } = setup();
      dispatch('pointerdown', 200, 'water');
      vi.advanceTimersByTime(1000);
      expect(store.inventory().waterDrops).toBe(776);
      if (reason === 'pointercancel') dispatch('pointercancel', 200, 'water');
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (reason === 'dismiss') component.onWillDismiss();
      if (reason === 'destroy') fixture.destroy();
      vi.advanceTimersByTime(5000);
      expect(store.inventory().waterDrops).toBe(776);
    },
  );

  it.each(['pointercancel', 'blur', 'hidden', 'dismiss', 'destroy'])(
    'stops spending after %s without catching up',
    (reason) => {
      const { component, fixture, store, dispatch } = setup();
      dispatch('pointerdown', 200);
      vi.advanceTimersByTime(500);
      expect(store.demoTreeGrowth()).toBe(0);
      expect(store.demoGrowthRemainder()).toBe(2500);
      if (reason === 'pointercancel') dispatch('pointercancel', 200);
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (reason === 'dismiss') component.onWillDismiss();
      if (reason === 'destroy') fixture.destroy();
      vi.advanceTimersByTime(5000);
      expect(store.demoTreeGrowth()).toBe(0);
      expect(store.demoGrowthRemainder()).toBe(2500);
    },
  );

  it('charges the whole final light tick instead of trimming it to the growth target', () => {
    const { component, store, setRate } = setup();
    store.applyTaskInventory({ waterDrops: nearTargetWater, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 149, water: nearTargetWater, fertilizer: false });
    expect(store.demoTreeGrowth()).toBe(target - 1);
    expect(store.demoGrowthRemainder()).toBe(7450);
    setRate('light', '500');
    component.keyboardUse('light');
    vi.advanceTimersByTime(3000);
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.inventory().lightEnergy).toBe(5772);
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(component.heldResource()).toBeNull();
    expect(component.feedback()).toContain('上限');
    component.keyboardUse('light');
    vi.advanceTimersByTime(5000);
    expect(store.inventory().lightEnergy).toBe(5772);
  });
});
