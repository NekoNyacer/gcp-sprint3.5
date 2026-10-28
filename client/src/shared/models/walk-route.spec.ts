import { haversineDistanceMeters } from './geo-distance';
import { distanceToRouteMeters, projectPointOnRoute, walkingTaskWaypoints } from './walk-route';
import { WalkTaskPoint } from './walk-task.models';
import { createDemoWalkTasks } from './demo-walk-tasks';
import { demoSupplyStations, routeCoordinatesByTree } from '../../environments/environment-dev';
import { homeTrees } from '../../features/home/home-tree-recommendations';

describe('Demo task routes', () => {
  const start = { longitude: 121.46, latitude: 25.01 };
  const middle = { longitude: 121.462, latitude: 25.012 };
  const destination = { longitude: 121.464, latitude: 25.014 };
  const task: WalkTaskPoint = {
    id: 'water',
    kind: 'water',
    name: '補水',
    description: 'Demo',
    supplyStation: {
      category: '美食',
      isCathayTwqrMerchant: true,
      offer: '買一送一',
      terms: 'Demo',
      supply: { resource: 'water', amount: 10 },
      validUntil: '2026/10/31',
    },
    position: { longitude: 121.461, latitude: 25.011 },
    isDemo: true,
    estimatedExtraSteps: 900,
    routeStop: { position: start, segmentIndex: 1, fraction: 0 },
  };

  it('requests just the origin and destination when no tasks are selected', () => {
    expect(walkingTaskWaypoints(start, destination, [])).toEqual([start, destination]);
  });

  it('uses the environment station list as the single source of merchant and placement data', () => {
    const tasks = createDemoWalkTasks([start, destination]);
    expect(tasks).toHaveLength(demoSupplyStations.length);
    demoSupplyStations.forEach((station, index) => {
      const { routeFraction, ...details } = station;
      const { supplyStation, ...taskDetails } = tasks[index];
      expect({ ...taskDetails, ...supplyStation }).toMatchObject(details);
      expect(routeFraction).toBeGreaterThanOrEqual(0);
      expect(routeFraction).toBeLessThanOrEqual(1);
      expect(tasks[index].routeStop.fraction).toBeCloseTo(routeFraction);
      expect(tasks[index].position).toEqual(tasks[index].routeStop.position);
      expect(distanceToRouteMeters(tasks[index].position, [start, destination])).toBeLessThan(0.01);
    });
  });

  it('orders task waypoints along the original route without returning to task anchors', () => {
    const second: WalkTaskPoint = {
      ...task,
      id: 'second',
      position: middle,
      routeStop: { position: destination, segmentIndex: 2, fraction: 0.5 },
    };
    expect(walkingTaskWaypoints(start, destination, [second, task])).toEqual([
      start,
      task.position,
      second.position,
      destination,
    ]);
    expect(walkingTaskWaypoints(start, destination, [task, second])).toEqual(
      walkingTaskWaypoints(start, destination, [second, task]),
    );
  });

  it('orders projected tree stops together with stations by their base-route position', () => {
    const route = [start, middle, destination];
    const projection = projectPointOnRoute({ longitude: 121.463, latitude: 25.013 }, route)!;
    expect(projection.segmentIndex).toBe(2);
    expect(projection.fraction).toBeCloseTo(0.5);
    expect(projection.distanceMeters).toBeCloseTo(0);
    const tree = {
      id: 'tree-stop',
      position: { longitude: 121.463, latitude: 25.013 },
      routeStop: projection,
    };
    expect(walkingTaskWaypoints(start, destination, [tree, task])).toEqual([
      start,
      task.position,
      tree.position,
      destination,
    ]);
    expect(walkingTaskWaypoints(start, destination, [task, tree])).toEqual(
      walkingTaskWaypoints(start, destination, [tree, task]),
    );
    expect(projectPointOnRoute(tree.position, [])).toBeNull();
    expect(projectPointOnRoute(tree.position, [start, start])).toBeNull();
  });

  for (const tree of homeTrees) {
    it(`generates the task counts and initial placement targets for ${tree.id}`, () => {
      const base = [
        ...(routeCoordinatesByTree[tree.id] ?? [[start.longitude, start.latitude]]).map(([longitude, latitude]) => ({
          longitude,
          latitude,
        })),
        tree.position,
      ];
      const tasks = createDemoWalkTasks(base);
      const water = tasks.filter((point) => point.kind === 'water');
      const fertilizer = tasks.filter((point) => point.kind === 'fertilizer');
      expect(water).toHaveLength(demoSupplyStations.filter(s => s.kind === 'water').length);
      expect(fertilizer).toHaveLength(demoSupplyStations.filter(s => s.kind === 'fertilizer').length);
      expect(new Set(tasks.map((point) => point.id)).size).toBe(demoSupplyStations.length);
      expect(tasks.every((point) => point.kind === 'water' || point.kind === 'fertilizer')).toBe(
        true,
      );
      expect(createDemoWalkTasks(base)).toEqual(tasks);
      for (const point of tasks) {
        expect(point.name.length).toBeGreaterThan(0);
        expect(['美食', '購物']).toContain(point.supplyStation.category);
        expect(point.supplyStation.isCathayTwqrMerchant).toBe(true);
        expect(point.supplyStation.offer.length).toBeGreaterThan(0);
        expect(point.supplyStation.terms.length).toBeGreaterThan(0);
        expect(point.supplyStation.validUntil).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
        expect(distanceToRouteMeters(point.position, base)).toBeLessThan(0.01);
        expect(point.estimatedExtraSteps).toBe(0);
      }
      for (let subset = 0; subset < 64; subset++) {
        const selected = tasks.filter((_, index) => (subset & (1 << index)) !== 0);
        const waypoints = walkingTaskWaypoints(base[0], tree.position, selected);
        expect(waypoints).toHaveLength(selected.length + 2);
        expect(waypoints[0]).toEqual(base[0]);
        expect(waypoints[waypoints.length - 1]).toEqual(tree.position);
        expect(walkingTaskWaypoints(base[0], tree.position, [...selected].reverse())).toEqual(
          waypoints,
        );
      }
    });
  }

  it('measures geographic distance in meters', () => {
    expect(haversineDistanceMeters(start, start)).toBe(0);
    expect(
      haversineDistanceMeters({ longitude: 0, latitude: 0 }, { longitude: 0, latitude: 0.01 }),
    ).toBeCloseTo(1111.949, 2);
  });

  it('does not generate challenges for an empty or stationary route', () => {
    expect(createDemoWalkTasks([])).toEqual([]);
    expect(createDemoWalkTasks([start, start])).toEqual([]);
  });

  it('uses the actual route rather than the straight origin-to-destination line', () => {
    const route = [
      { longitude: 0, latitude: 0 },
      { longitude: 0, latitude: 0.02 },
      { longitude: 0.02, latitude: 0.02 },
    ];
    expect(distanceToRouteMeters({ longitude: 0, latitude: 0.015 }, route)).toBe(0);
    expect(distanceToRouteMeters({ longitude: 0.01, latitude: 0.01 }, route)).toBeGreaterThan(1000);
    const tasks = createDemoWalkTasks(route);
    expect(tasks.every(task => distanceToRouteMeters(task.position, route) < 0.01)).toBe(true);
    expect(tasks[0].position.latitude).toBeLessThan(0.01);
    expect(tasks.at(-1)!.position.longitude).toBeGreaterThan(0.01);
    for (let i = 1; i < tasks.length; i++) {
      expect(haversineDistanceMeters(tasks[i - 1].position, tasks[i].position)).toBeGreaterThan(500);
    }
  });

  it('spreads stations inside a single long segment with duplicate endpoint vertices', () => {
    const route = [start, start, destination, destination];
    const tasks = createDemoWalkTasks(route);
    const fractions = tasks.map(t => (t.position.latitude - start.latitude) / (destination.latitude - start.latitude));
    expect(fractions[0]).toBeCloseTo(0.15);
    expect(fractions.at(-1)).toBeCloseTo(0.85);
    for (let i = 1; i < fractions.length; i++) expect(fractions[i] - fractions[i - 1]).toBeGreaterThan(0.15);
  });
});
