import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocationPoint, LocationStore } from './location-store';
import { ProgressStore } from './progress-store';
import { WalkSessionStore } from './walk-session-store';
import { RoutedWalkTaskPoint, SupplyReward, supplyRewardsLabel } from '../models/walk-task.models';
import { createDemoWalkTasks } from '../models/demo-walk-tasks';
import { TREE_CULTIVATION_RADIUS_METERS } from '../../environments/environment-dev';

describe('Home walk check-ins', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function setup(supply: SupplyReward = { resource: 'water', amount: 17 }) {
    const current = signal<LocationPoint | null>(null);
    TestBed.configureTestingModule({
      providers: [{ provide: LocationStore, useValue: { current } }],
    });
    const store = TestBed.inject(WalkSessionStore);
    const progress = TestBed.inject(ProgressStore);
    const destination = { id: 'tree-5', position: { latitude: 25.014, longitude: 121.464 } };
    const route = [{ latitude: 25.01, longitude: 121.46 }, destination.position];
    const candidate = createDemoWalkTasks(route)[0];
    const station: RoutedWalkTaskPoint = {
      ...candidate,
      supplyStation: { ...candidate.supplyStation, supply },
      routeGeometry: route,
      routeDistanceMeters: 1500,
    };
    store.startPlanning();
    store.selectDestination(destination, route);
    store.confirmDestination();
    store.setTaskRoutes([station]);
    store.toggleTaskPoint(station.id);
    store.setPlannedRoute([route[0], station.position, destination.position], 1500, [station.id]);
    store.startWalk('walk');
    function moveNear(target: { latitude: number; longitude: number }, distance = 0) {
      current.set({
        ...target,
        latitude: target.latitude - ((distance / 6_371_000) * 180) / Math.PI,
        accuracy: 5,
        observedAt: new Date(),
      });
    }
    return { store, progress, current, station, destination, moveNear };
  }

  it.each(['water', 'fertilizer'] as const)(
    'grants the configured %s amount only once, preserving other resources and route',
    (resource) => {
      const { store, progress, station, moveNear } = setup({ resource, amount: 23 });
      moveNear(station.position);
      const inventory = progress.inventory();
      const route = store.route();
      expect(store.checkInTaskPoint(station.id)).toBe(true);
      expect(progress.inventory()).toEqual({
        ...inventory,
        [resource === 'water' ? 'waterDrops' : 'fertilizer']:
          inventory[resource === 'water' ? 'waterDrops' : 'fertilizer'] + 23,
      });
      const credited = progress.inventory();
      expect(store.checkedInTaskIds()).toEqual([station.id]);
      expect(store.route()).toBe(route);
      expect(store.isWalking()).toBe(true);
      expect(store.checkInTaskPoint(station.id)).toBe(false);
      expect(store.checkInError()).toContain('已領取');
      expect(progress.inventory()).toBe(credited);
    },
  );

  it.each([-1, 0, 1.5, NaN, Infinity])(
    'rejects invalid supply amount %s without marking claimed',
    (amount) => {
      const { store, progress, station, moveNear } = setup({ resource: 'water', amount });
      moveNear(station.position);
      const inventory = progress.inventory();
      expect(store.checkInTaskPoint(station.id)).toBe(false);
      expect(store.checkInError()).toContain('設定無效');
      expect(store.checkedInTaskIds()).toEqual([]);
      expect(progress.inventory()).toBe(inventory);
    },
  );

  it.each([
    TREE_CULTIVATION_RADIUS_METERS - 0.000001,
    TREE_CULTIVATION_RADIUS_METERS,
    TREE_CULTIVATION_RADIUS_METERS + 0.000001,
  ])('checks the inclusive station and destination radius at %s metres', (distance) => {
    const { store, progress, station, destination, moveNear } = setup();
    const inventory = progress.inventory();
    moveNear(station.position, distance);
    const allowed = distance <= TREE_CULTIVATION_RADIUS_METERS;
    expect(store.checkInTaskPoint(station.id)).toBe(allowed);
    if (!allowed) expect(progress.inventory()).toBe(inventory);
    moveNear(destination.position, distance);
    store.startCultivating();
    expect(store.checkInDestination(destination.id)).toBe(allowed);
    expect(store.hasActiveRoute()).toBe(!allowed);
    expect(store.isCultivating()).toBe(true);
  });

  it.each([null, { latitude: NaN, longitude: 121 }, { latitude: 91, longitude: 121 }])(
    'blocks both check-ins with missing or invalid location %s',
    (position) => {
      const { store, progress, current, station, destination } = setup();
      current.set(position ? { ...position, accuracy: 5, observedAt: new Date() } : null);
      const inventory = progress.inventory();
      expect(store.checkInTaskPoint(station.id)).toBe(false);
      expect(store.checkInDestination(destination.id)).toBe(false);
      expect(store.checkInError()).toContain('定位');
      expect(store.hasActiveRoute()).toBe(true);
      expect(progress.inventory()).toBe(inventory);
    },
  );

  it('does not grant rewards on proximity, unknown stations or inactive routes', () => {
    const { store, progress, station, moveNear } = setup();
    const inventory = progress.inventory();
    moveNear(station.position);
    expect(progress.inventory()).toBe(inventory);
    expect(store.checkedInTaskIds()).toEqual([]);
    expect(store.checkInTaskPoint('missing')).toBe(false);
    store.cancelWalk();
    expect(store.checkInTaskPoint(station.id)).toBe(false);
    expect(progress.inventory()).toBe(inventory);
  });

  it('clears all route data on destination confirmation but keeps cultivation open and earned inventory', () => {
    const { store, progress, station, destination, moveNear } = setup();
    moveNear(station.position);
    store.checkInTaskPoint(station.id);
    const inventory = progress.inventory();
    moveNear(destination.position);
    store.startCultivating();
    expect(store.checkInDestination('tree-9')).toBe(false);
    expect(store.hasActiveRoute()).toBe(true);
    expect(store.checkInDestination(destination.id)).toBe(true);
    expect(store.phase()).toBe('cultivating');
    expect(store.cultivationReturnPhase()).toBe('idle');
    expect(store.destination()).toBeNull();
    expect(store.route()).toEqual([]);
    expect(store.taskPoints()).toEqual([]);
    expect(store.checkedInTaskIds()).toEqual([]);
    expect(store.checkInError()).toBeNull();
    expect(progress.inventory()).toBe(inventory);
    expect(progress.canVisitDemoTree(destination.id)).toBe(false);
    expect(progress.unavailableDemoTreeIds()).toContain(destination.id);
    expect(store.checkInDestination(destination.id)).toBe(false);
    store.finishCultivating();
    expect(store.isIdle()).toBe(true);
  });

  it('limits each station to one claim per Taipei day across walks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T15:59:59.000Z'));
    const { store, progress, station, destination, moveNear } = setup();
    moveNear(station.position);
    expect(store.checkInTaskPoint(station.id)).toBe(true);
    const inventory = progress.inventory();
    store.cancelWalk();
    expect(store.checkedInTaskIds()).toEqual([]);
    store.startPlanning();
    store.selectDestination(destination, station.routeGeometry);
    store.confirmDestination();
    store.setTaskRoutes([station]);
    store.toggleTaskPoint(station.id);
    store.setPlannedRoute(station.routeGeometry, 1500, [station.id]);
    store.startWalk('new-walk');
    moveNear(station.position);
    expect(store.checkInTaskPoint(station.id)).toBe(false);
    expect(store.checkInError()).toBe('本日已領取成功，不可重複領取。');
    expect(progress.inventory()).toBe(inventory);

    vi.setSystemTime(new Date('2026-10-16T16:00:00.000Z'));
    expect(store.checkInTaskPoint(station.id)).toBe(true);
    expect(progress.inventory().waterDrops).toBe(inventory.waterDrops + 17);
  });

  it.each(['water', 'fertilizer'] as const)(
    'snapshots actual walk earnings including %s before clearing the route without extra credit',
    (resource) => {
      const { store, progress, station, destination, moveNear } = setup({ resource, amount: 23 });
      const startedAt = store.startedAt()!;
      const now = vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + 79 * 60_000);
      try {
        progress.addSteps(2184);
        moveNear(station.position);
        store.checkInTaskPoint(station.id);
        const inventory = progress.inventory();
        moveNear(destination.position);
        store.startCultivating();
        expect(store.checkInDestination(destination.id)).toBe(true);
        expect(store.completedWalkResult()).toEqual({
          durationMinutes: 79,
          stationCount: 1,
          steps: 2184,
          distanceMeters: 1638,
          earnedLightEnergy: 7500,
          earnedWaterDrops: resource === 'water' ? 23 : 0,
          earnedFertilizer: resource === 'fertilizer' ? 23 : 0,
          lightEnergyBalance: inventory.lightEnergy,
          waterDropsBalance: inventory.waterDrops,
          fertilizerBalance: inventory.fertilizer,
        });
        expect(progress.inventory()).toBe(inventory);
        const result = store.completedWalkResult();
        expect(store.checkInDestination(destination.id)).toBe(false);
        expect(store.completedWalkResult()).toBe(result);
        store.finishCultivating();
        store.startPlanning();
        expect(store.completedWalkResult()).toBeNull();
      } finally {
        now.mockRestore();
      }
    },
  );

  it('keeps walk totals across midnight and resource spending, excluding unclaimed supplies', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-15T15:59:00Z'));
      const { store, progress, destination, moveNear } = setup();
      progress.addSteps(10);
      vi.setSystemTime(new Date('2026-10-15T16:01:00Z'));
      progress.addSteps(20);
      expect(
        progress.cultivateDemoTree({
          lightEnergy: 10,
          water: true,
          fertilizer: false,
        }),
      ).toBe(true);
      const inventory = progress.inventory();
      moveNear(destination.position);
      expect(store.checkInDestination(destination.id)).toBe(true);
      expect(store.completedWalkResult()).toEqual({
        durationMinutes: 2,
        stationCount: 0,
        steps: 30,
        distanceMeters: 22.5,
        earnedLightEnergy: 7520,
        earnedWaterDrops: 0,
        earnedFertilizer: 0,
        lightEnergyBalance: inventory.lightEnergy,
        waterDropsBalance: inventory.waterDrops,
        fertilizerBalance: inventory.fertilizer,
      });
      expect(progress.inventory()).toBe(inventory);
    } finally {
      vi.useRealTimers();
    }
  });

  it('derives confirmation totals from supply amounts rather than station kinds or a fixed multiplier', () => {
    expect(
      supplyRewardsLabel([
        { resource: 'water', amount: 7 },
        { resource: 'water', amount: 13 },
        { resource: 'fertilizer', amount: 2 },
      ]),
    ).toBe('+20水 · +2肥料');
    expect(supplyRewardsLabel([])).toBe('無額外補給');
  });
});
