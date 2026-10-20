import { TestBed } from '@angular/core/testing';
import { WalkSessionStore } from './walk-session-store';
import { createDemoWalkTasks } from '../models/demo-walk-tasks';
import { GeoPoint } from '../models/geo.models';
import { WalkDestination } from './walk-session-store';
import { ProgressStore } from './progress-store';
import { demoPlantingSpots } from '../../environments/environment-dev';

describe('WalkSessionStore', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('owns planning, destination, and walking state independently from location', () => {
    const store = configureStore();
    const destination = {
      id: 'tree-1',
      position: { longitude: 121.5, latitude: 25.1 },
    };
    const route = [{ longitude: 121.4, latitude: 25 }, destination.position];

    store.startPlanning();
    setDestination(store, destination, route);

    expect(store.isPlanning()).toBe(true);
    expect(store.hasDestination()).toBe(true);
    expect(store.startWalk('route-1')).toBe(true);
    expect(store.isWalking()).toBe(true);
    expect(store.routeId()).toBe('route-1');
  });

  it('does not start a walk without a destination and route', () => {
    const store = configureStore();

    store.startPlanning();

    expect(store.startWalk('route-1')).toBe(false);
    expect(store.isPlanning()).toBe(true);
  });

  it('allows an empty destination and rejects visited destinations on selection and confirmation', () => {
    const store = configureStore();
    const progress = TestBed.inject(ProgressStore);
    const spot = demoPlantingSpots[0];
    const route = [{ longitude: 121.46, latitude: 25.01 }, spot.position];
    store.startPlanning();
    store.selectDestination(spot, route);
    expect(store.destination()?.id).toBe(spot.id);
    expect(store.confirmDestination()).toBe(true);
    expect(store.startWalk('planting-route')).toBe(true);
    store.cancelWalk();
    expect(progress.canVisitDemoTree(spot.id)).toBe(true);
    store.startPlanning();
    store.selectDestination(spot, route);
    progress.markDemoTreeVisited(spot.id);
    expect(store.startWalk('visited-route')).toBe(false);
    expect(store.planningError()).toContain('無法造訪');
    store.clearDestination();
    store.selectDestination(spot, route);
    expect(store.destination()).toBeNull();
    expect(store.planningError()).toContain('無法造訪');
  });

  it('opens and closes cultivation without interrupting an active plan', () => {
    const store = configureStore();
    store.cancelWalk();
    store.startCultivating();
    expect(store.isCultivating()).toBe(true);
    store.finishCultivating();
    expect(store.isIdle()).toBe(true);
    store.startPlanning();
    store.startCultivating();
    expect(store.isCultivating()).toBe(true);
    expect(store.cultivationReturnPhase()).toBe('planning');
    store.finishCultivating();
    expect(store.isPlanning()).toBe(true);
  });

  it('clears route data when the walk is cancelled', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, { id: 'tree-1', position: { longitude: 121.5, latitude: 25.1 } }, [
      { longitude: 121.5, latitude: 25.1 },
    ]);

    store.cancelWalk();

    expect(store.isIdle()).toBe(true);
    expect(store.destination()).toBeNull();
    expect(store.route()).toEqual([]);
  });

  it('clamps progress to the valid range', () => {
    const store = configureStore();

    store.updateProgress(1.5, -10);

    expect(store.progress()).toBe(1);
    expect(store.distanceMeters()).toBe(0);
  });

  const destination = { id: 'tree-5', position: { longitude: 121.464, latitude: 25.014 } };
  const baseRoute = [{ longitude: 121.46, latitude: 25.01 }, destination.position];
  const task = createDemoWalkTasks(baseRoute)[0];

  it.each(['walking', 'arrived'] as const)(
    'preserves the route and returns to %s after viewing a tree',
    (phase) => {
      const store = configureStore();
      store.startPlanning();
      setDestination(store, destination, baseRoute);
      store.toggleTaskPoint(task.id);
      const route = [baseRoute[0], task.position, destination.position];
      store.setPlannedRoute(route, 1800, [task.id]);
      store.startWalk('demo');
      if (phase === 'arrived') store.arrive();
      const startedAt = store.startedAt();

      store.startCultivating();
      expect(store.isCultivating()).toBe(true);
      expect(store.hasActiveRoute()).toBe(true);
      expect(store.destination()).toEqual(destination);
      expect(store.route()).toEqual(route);
      expect(store.taskPoints()).toMatchObject([task]);
      expect(store.startedAt()).toEqual(startedAt);
      store.finishCultivating();
      expect(store.phase()).toBe(phase);
      expect(store.route()).toEqual(route);
      expect(store.cultivationReturnPhase()).toBeNull();

      store.cancelWalk();
      expect(store.hasActiveRoute()).toBe(false);
      expect(store.route()).toEqual([]);
      expect(store.taskPoints()).toEqual([]);
    },
  );

  it('keeps the tree modal open if arrival occurs during cultivation', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    store.startWalk('demo');
    store.startCultivating();
    store.arrive();
    expect(store.isCultivating()).toBe(true);
    expect(store.progress()).toBe(1);
    store.finishCultivating();
    expect(store.isArrived()).toBe(true);
    expect(store.hasActiveRoute()).toBe(true);
  });

  it('toggles tasks without duplicates and restores the base route on removal', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    expect(store.toggleTaskPoint(task.id)).toBe(true);
    expect(store.taskPoints()).toMatchObject([task]);
    expect(store.routeNeedsUpdate()).toBe(true);
    expect(store.route()).toEqual(baseRoute);
    expect(store.startWalk('demo')).toBe(false);
    expect(store.toggleTaskPoint(task.id)).toBe(true);
    expect(store.taskPoints()).toEqual([]);
    expect(store.route()).toEqual(baseRoute);
    expect(store.routeNeedsUpdate()).toBe(false);
  });

  it('keeps selected tasks after departure and prevents editing during walking', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    store.toggleTaskPoint(task.id);
    store.setPlannedRoute([baseRoute[0], task.position, destination.position], 1800, [task.id]);
    store.startWalk('demo');
    expect(store.taskPoints()).toMatchObject([task]);
    expect(store.toggleTaskPoint(task.id)).toBe(false);
    expect(store.taskPoints()).toMatchObject([task]);
    expect(store.planningError()).not.toBeNull();
  });

  it('clears tasks on destination changes, clearing, and cancellation', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    store.toggleTaskPoint(task.id);
    store.clearDestination();
    setDestination(store, { ...destination, id: 'other' }, baseRoute);
    expect(store.taskPoints()).toEqual([]);
    store.toggleTaskPoint(task.id);
    store.clearDestination();
    expect(store.taskPoints()).toEqual([]);
    expect(store.route()).toEqual([]);
    setDestination(store, destination, baseRoute);
    store.toggleTaskPoint(task.id);
    store.cancelWalk();
    expect(store.taskPoints()).toEqual([]);
    expect(store.planningError()).toBeNull();
  });

  it('rejects tasks without a destination but accepts loaded stations immediately during planning', () => {
    const store = configureStore();
    store.startPlanning();
    expect(store.toggleTaskPoint(task.id)).toBe(false);
    setDestination(store, destination, baseRoute);
    expect(store.toggleTaskPoint(task.id)).toBe(true);
    expect(store.toggleTaskPoint('outside')).toBe(false);
    expect(store.taskPoints()).toHaveLength(1);
    expect(store.planningError()).not.toBeNull();
  });

  it('offers only one fertilizer challenge and accepts its larger detour', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    const fertilizer = store.availableTaskPoints().filter((point) => point.kind === 'fertilizer');
    expect(fertilizer).toHaveLength(1);
    expect(store.toggleTaskPoint(fertilizer[0].id)).toBe(true);
    expect(store.taskPoints()).toEqual(fertilizer);
  });

  it('allows final confirmation without selecting any tasks', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    expect(store.isWalking()).toBe(false);
    expect(store.taskPoints()).toEqual([]);
    expect(store.startWalk('demo')).toBe(true);
    expect(store.isWalking()).toBe(true);
  });

  it('locks the destination after confirmation until planning is restarted', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    store.toggleTaskPoint(task.id);
    store.selectDestination({ ...destination, id: 'tree-8' }, baseRoute);
    expect(store.destination()?.id).toBe(destination.id);
    expect(store.taskPoints()).toHaveLength(1);
    expect(store.planningError()).toContain('終點已確定');
    store.cancelWalk();
    store.startPlanning();
    store.selectDestination({ ...destination, id: 'tree-8' }, baseRoute);
    expect(store.destination()?.id).toBe('tree-8');
    expect(store.destinationConfirmed()).toBe(false);
    expect(store.taskPoints()).toEqual([]);
    expect(store.isPlanning()).toBe(true);
    expect(store.startWalk('demo')).toBe(false);
  });

  it('blocks confirmation while loading or after a routing error', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    store.setRouteLoading(true);
    expect(store.startWalk('demo')).toBe(false);
    store.setRouteLoading(false);
    store.setRoutingError('Mapbox 無法取得路線');
    expect(store.startWalk('demo')).toBe(false);
  });

  it('uses the whole-route Directions distance rather than adding independent challenge estimates', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    store.setBaseRoute(baseRoute, 1234);
    const routed = store.taskRoutes()[0];
    store.setTaskRoutes([{ ...routed, routeDistanceMeters: 777 }]);
    store.toggleTaskPoint(routed.id);
    expect(store.plannedDistanceMeters()).toBe(1234);
    store.setPlannedRoute([baseRoute[0], routed.position, destination.position], 1900, [routed.id]);
    expect(store.plannedDistanceMeters()).toBe(1900);
    expect(store.routeNeedsUpdate()).toBe(false);
  });

  it('allows candidate replacement but blocks stops and departure until the destination is confirmed', () => {
    const store = configureStore();
    store.startPlanning();
    store.selectDestination(destination, baseRoute);
    expect(store.destinationConfirmed()).toBe(false);
    expect(store.toggleTaskPoint(task.id)).toBe(false);
    expect(store.toggleTreeStop(demoPlantingSpots[0])).toBe(false);
    expect(store.startWalk('demo')).toBe(false);
    store.selectDestination({ ...destination, id: 'tree-8' }, baseRoute);
    expect(store.destination()?.id).toBe('tree-8');
    expect(store.confirmDestination()).toBe(true);
    expect(store.isPlanning()).toBe(true);
    expect(store.hasActiveRoute()).toBe(false);
  });

  it('rechecks destination eligibility and route readiness when locking the destination', () => {
    const store = configureStore();
    store.startPlanning();
    store.selectDestination(destination, []);
    expect(store.confirmDestination()).toBe(false);
    store.setBaseRoute(baseRoute, 1200);
    store.setRouteLoading(true);
    expect(store.confirmDestination()).toBe(false);
    store.setRouteLoading(false);
    TestBed.inject(ProgressStore).markDemoTreeVisited(destination.id);
    expect(store.confirmDestination()).toBe(false);
    expect(store.destinationConfirmed()).toBe(false);
  });

  it('routes trees and empty points separately from station rewards and preserves them through care', () => {
    const store = configureStore();
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    const tree = { id: 'tree-8', position: { longitude: 121.462, latitude: 25.012 } };
    const spot = demoPlantingSpots[0];
    expect(store.toggleTreeStop(destination)).toBe(false);
    expect(store.toggleTreeStop(tree)).toBe(true);
    expect(store.toggleTreeStop(spot)).toBe(true);
    expect(store.taskPoints()).toEqual([]);
    expect(store.treeStops().map((stop) => stop.id)).toEqual([tree.id, spot.id]);
    expect(store.routeNeedsUpdate()).toBe(true);
    expect(store.startWalk('demo')).toBe(false);
    store.toggleTaskPoint(task.id);
    store.setPlannedRoute(baseRoute, 2400, [task.id], [tree.id, spot.id]);
    expect(store.routeNeedsUpdate()).toBe(false);
    store.toggleTaskPoint(task.id);
    expect(store.route()).toEqual(baseRoute);
    expect(store.plannedDistanceMeters()).toBe(2400);
    expect(store.routeNeedsUpdate()).toBe(true);
    store.setPlannedRoute(baseRoute, 2000, [], [tree.id, spot.id]);
    expect(store.startWalk('demo')).toBe(true);
    expect(store.toggleTreeStop(tree)).toBe(false);
    store.startCultivating();
    store.finishCultivating();
    expect(store.treeStops()).toHaveLength(2);
    store.cancelWalk();
    expect(store.treeStops()).toEqual([]);
    expect(store.routedTreeIds()).toEqual([]);
    expect(store.destinationConfirmed()).toBe(false);
  });

  it('rejects unavailable stops on adding and departure but still permits their removal', () => {
    const store = configureStore();
    const progress = TestBed.inject(ProgressStore);
    const spot = demoPlantingSpots[0];
    store.startPlanning();
    setDestination(store, destination, baseRoute);
    progress.markDemoTreeVisited('tree-8');
    expect(store.toggleTreeStop({ id: 'tree-8', position: spot.position })).toBe(false);
    expect(store.toggleTreeStop(spot)).toBe(true);
    store.setPlannedRoute(baseRoute, 1800, [], [spot.id]);
    progress.markDemoTreeVisited(spot.id);
    expect(store.startWalk('demo')).toBe(false);
    expect(store.planningError()).toContain('移出');
    expect(store.toggleTreeStop(spot)).toBe(true);
    expect(store.treeStops()).toEqual([]);
    expect(store.routeNeedsUpdate()).toBe(false);
    expect(store.plannedDistanceMeters()).toBe(store.baseDistanceMeters());
  });
});

function setDestination(
  store: InstanceType<typeof WalkSessionStore>,
  destination: WalkDestination,
  route: readonly GeoPoint[],
): void {
  store.selectDestination(destination, route);
  store.setTaskRoutes(
    createDemoWalkTasks(route).map((task) => ({
      ...task,
      routeGeometry: [task.routeStop.position, task.position, task.routeStop.position],
      routeDistanceMeters: task.estimatedExtraSteps * 0.75,
    })),
  );
  store.confirmDestination();
}

function configureStore(): InstanceType<typeof WalkSessionStore> {
  TestBed.configureTestingModule({ providers: [WalkSessionStore] });
  return TestBed.inject(WalkSessionStore);
}
