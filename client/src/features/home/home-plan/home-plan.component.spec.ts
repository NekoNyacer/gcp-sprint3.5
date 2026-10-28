import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HomePlanComponent } from './home-plan.component';
import { LocationPoint, LocationStore } from '../../../shared/stores/location-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { WalkDestination, WalkSessionStore } from '../../../shared/stores/walk-session-store';
import { createDemoWalkTasks } from '../../../shared/models/demo-walk-tasks';
import { RoutedWalkTaskPoint, WalkTaskPoint } from '../../../shared/models/walk-task.models';
import { homeTrees } from '../home-tree-recommendations';

describe('Home unified route planning', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    const current = signal<LocationPoint>({
      ...homeTrees[4].position,
      accuracy: 5,
      observedAt: new Date(),
    });
    const destination = signal<WalkDestination | null>(null);
    const destinationConfirmed = signal(false);
    const taskPoints = signal<RoutedWalkTaskPoint[]>([]);
    const plannedDistanceMeters = signal(0);
    const plannedDurationSeconds = signal(0);
    const planningError = signal<string | null>(null);
    const routeLoading = signal(false);
    const routeNeedsUpdate = signal(false);
    const availableTaskPoints = signal<WalkTaskPoint[]>([]);
    TestBed.configureTestingModule({
      imports: [HomePlanComponent],
      providers: [
        { provide: LocationStore, useValue: { current } },
        {
          provide: WalkSessionStore,
          useValue: {
            destination,
            destinationConfirmed,
            treeStops: signal([]),
            hasDestination: computed(() => destination() !== null),
            isPlanning: signal(true),
            taskPoints,
            availableTaskPoints,
            plannedDistanceMeters,
            plannedDurationSeconds,
            planningError,
            routeLoading,
            routingFailed: computed(() => planningError() !== null),
            routeNeedsUpdate,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(HomePlanComponent);
    fixture.detectChanges();
    return {
      fixture,
      destination,
      destinationConfirmed,
      taskPoints,
      availableTaskPoints,
      plannedDistanceMeters,
      plannedDurationSeconds,
      planningError,
      routeLoading,
      routeNeedsUpdate,
    };
  }

  it('confirms a candidate destination before offering intermediate stop selection and departure', () => {
    const { fixture, destination, destinationConfirmed, taskPoints, availableTaskPoints } = setup();
    const tree = fixture.componentInstance.recommendedTrees()[0];
    destination.set({ id: tree.id, position: tree.position });
    const lock = vi.fn();
    const confirm = vi.fn();
    fixture.componentInstance.confirmDestination.subscribe(lock);
    fixture.componentInstance.confirmRoute.subscribe(confirm);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('目的地');
    expect(fixture.nativeElement.textContent).not.toContain('0 個補給站');
    const button = fixture.debugElement.query(By.css('.plan-confirm'));
    expect(button.nativeElement.textContent).toContain('確認地點');
    button.triggerEventHandler('click');
    expect(lock).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
    destinationConfirmed.set(true);
    const station = createDemoWalkTasks([homeTrees[4].position, homeTrees[5].position])[0];
    availableTaskPoints.set([station]);
    taskPoints.set([{ ...station, routeGeometry: [], routeDistanceMeters: 0 }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('目的地');
    expect(fixture.nativeElement.textContent).toContain('已優化路線，沿途可補水並兌換商家優惠。');
    expect(fixture.nativeElement.textContent).toContain('點擊「出發」後即可開始導航。');
    expect(fixture.debugElement.query(By.css('.top .plan-confirm'))).toBeNull();
    const depart = fixture.debugElement.query(By.css('.bottom .departure-card .plan-confirm'));
    expect(depart.nativeElement.textContent).toContain('出發');
    depart.triggerEventHandler('click');
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('separates returning Home from browsing other destinations', () => {
    const {fixture, destination, destinationConfirmed} = setup();
    destination.set({id: homeTrees[4].id, position: homeTrees[4].position});
    const back = vi.fn();
    const reselect = vi.fn();
    const confirm = vi.fn();
    fixture.componentInstance.back.subscribe(back);
    fixture.componentInstance.reselectDestination.subscribe(reselect);
    fixture.componentInstance.confirmDestination.subscribe(confirm);
    fixture.detectChanges();
    const other = fixture.debugElement.query(By.css('.destination-reselect'));
    expect(other.nativeElement.textContent).toContain('再看看其他地點');
    other.triggerEventHandler('click');
    expect(reselect).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    fixture.debugElement.query(By.css('[aria-label="返回首頁"]')).triggerEventHandler('click');
    expect(back).toHaveBeenCalledOnce();
    destinationConfirmed.set(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.destination-reselect'))).toBeNull();
  });

  it('removes the crossed-out merchant list while retaining the map supply count', () => {
    const {fixture, destination, destinationConfirmed, availableTaskPoints, taskPoints} = setup();
    destination.set({id: homeTrees[4].id, position: homeTrees[4].position});
    destinationConfirmed.set(true);
    const stations = createDemoWalkTasks([homeTrees[4].position, homeTrees[5].position]).slice(0, 3);
    availableTaskPoints.set([...stations].reverse());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3 補給');
    expect(fixture.debugElement.query(By.css('.supply-summary'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.supply-options'))).toBeNull();
    expect(taskPoints()).toEqual([]);
  });

  it('offers a recommendation retry when no shops were returned and keeps route confirmation available', () => {
    const {fixture, destination, destinationConfirmed, routeLoading} = setup();
    destination.set({id: homeTrees[4].id, position: homeTrees[4].position});
    destinationConfirmed.set(true);
    const retry = vi.fn();
    fixture.componentInstance.supplyRetry.subscribe(retry);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('目前沒有沿途補給推薦');
    expect(fixture.nativeElement.textContent).not.toContain('沿途可補水並兌換商家優惠');
    expect(fixture.nativeElement.textContent).not.toContain('0 個補給站');
    fixture.debugElement.query(By.css('.supply-retry')).triggerEventHandler('click');
    expect(retry).toHaveBeenCalledOnce();
    expect(fixture.debugElement.query(By.css('.plan-confirm')).componentInstance.disabled).toBe(false);
    routeLoading.set(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.supply-retry'))).toBeNull();
  });

  it('displays the updated complete-route walking duration', () => {
    const {fixture, destination, plannedDurationSeconds} = setup();
    destination.set({id: homeTrees[4].id, position: homeTrees[4].position});
    plannedDurationSeconds.set(18 * 60 + 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('約 19 分鐘');
    plannedDurationSeconds.set(35 * 60);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('約 35 分鐘');
  });

  it('offers a recommendation visibility toggle before selection and hides it for any destination', () => {
    const { fixture, destination } = setup();
    const toggle = vi.fn();
    fixture.componentInstance.toggleRecommendations.subscribe(toggle);
    const button = fixture.debugElement.query(By.css('.recommendations-toggle'));
    expect(button.nativeElement.textContent).toContain('隱藏推薦資訊');
    expect(button.nativeElement.getAttribute('aria-pressed')).toBe('true');
    button.triggerEventHandler('click');
    expect(toggle).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('recommendationsVisible', false);
    fixture.detectChanges();
    expect(button.nativeElement.textContent).toContain('顯示推薦資訊');
    expect(button.nativeElement.getAttribute('aria-pressed')).toBe('false');
    destination.set({ id: homeTrees[0].id, position: homeTrees[0].position });
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.recommendations-toggle'))).toBeNull();
  });

  it('requires preview updating before enabling confirmation for changed stations in the same screen', () => {
    const {
      fixture,
      destination,
      destinationConfirmed,
      plannedDistanceMeters,
      routeLoading,
      routeNeedsUpdate,
    } = setup();
    const tree = fixture.componentInstance.recommendedTrees()[0];
    destination.set({ id: tree.id, position: tree.position });
    destinationConfirmed.set(true);
    routeNeedsUpdate.set(true);
    const confirm = vi.fn();
    const update = vi.fn();
    fixture.componentInstance.confirmRoute.subscribe(confirm);
    fixture.componentInstance.routeUpdate.subscribe(update);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('.plan-confirm'));
    expect(button.componentInstance.disabled).toBe(false);
    expect(button.nativeElement.textContent).toContain('更新路線');
    button.triggerEventHandler('click');
    expect(update).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();

    routeLoading.set(true);
    fixture.detectChanges();
    expect(button.componentInstance.disabled).toBe(true);
    routeLoading.set(false);
    routeNeedsUpdate.set(false);
    plannedDistanceMeters.set(1600);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2,133');
    expect(button.componentInstance.disabled).toBe(false);
    expect(button.nativeElement.textContent).toContain('出發');
    button.triggerEventHandler('click');
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('blocks confirmation without a destination, while loading, or after a routing error', () => {
    const { fixture, destination, planningError, routeLoading } = setup();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.plan-confirm'))).toBeNull();
    const tree = fixture.componentInstance.recommendedTrees()[0];
    destination.set({ id: tree.id, position: tree.position });
    routeLoading.set(true);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('.plan-confirm'));
    expect(button.componentInstance.disabled).toBe(true);
    expect(button.nativeElement.textContent).toContain('確認地點');
    routeLoading.set(false);
    planningError.set('無法取得路線');
    fixture.detectChanges();
    expect(button.componentInstance.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('無法取得路線');
    const retry = vi.fn();
    fixture.componentInstance.routeRetry.subscribe(retry);
    fixture.debugElement.query(By.css('.route-retry')).triggerEventHandler('click');
    expect(retry).toHaveBeenCalledOnce();
  });
});
