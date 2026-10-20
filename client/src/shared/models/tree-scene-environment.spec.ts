import {
  destination,
  demoPlantingSpots,
  demoSupplyStations,
} from '../../environments/environment-dev';
import { homeTrees } from '../../features/home/home-tree-recommendations';
import { createDemoWalkTasks } from './demo-walk-tasks';
import {
  DEMO_POI_ENVIRONMENTS,
  SCENE_TIMES,
  SCENE_WEATHERS,
  treeSceneBackground,
} from './tree-scene-environment';

describe('tree scene environments', () => {
  it('provides twelve distinct backgrounds and exposes all combinations at existing tree POIs', () => {
    const all = SCENE_WEATHERS.flatMap((weather) =>
      SCENE_TIMES.map((time) => treeSceneBackground(weather, time)),
    );
    expect(new Set(all).size).toBe(12);
    expect(
      new Set(homeTrees.map((tree) => treeSceneBackground(tree.weather, tree.timeOfDay ?? 'day'))),
    ).toEqual(new Set(all));
  });

  it('configures every existing mock POI once with stable weather and time parameters', () => {
    const ids = [
      ...destination.features.map(({ properties }) => properties.treeId),
      ...demoPlantingSpots.map(({ id }) => id),
      ...demoSupplyStations.map(({ id }) => id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(Object.keys(DEMO_POI_ENVIRONMENTS))).toEqual(new Set(ids));
    for (const tree of homeTrees) {
      const environment = DEMO_POI_ENVIRONMENTS[tree.id as keyof typeof DEMO_POI_ENVIRONMENTS];
      expect(tree).toMatchObject(environment);
    }
    for (const station of demoSupplyStations) {
      expect(station).toMatchObject(
        DEMO_POI_ENVIRONMENTS[station.id as keyof typeof DEMO_POI_ENVIRONMENTS],
      );
    }
  });

  it('carries supply-station scene parameters into generated POIs without mixing them into offers', () => {
    const tasks = createDemoWalkTasks([
      { latitude: 25.01, longitude: 121.46 },
      { latitude: 25.02, longitude: 121.47 },
    ]);
    for (const task of tasks) {
      expect(task).toMatchObject(
        DEMO_POI_ENVIRONMENTS[task.id as keyof typeof DEMO_POI_ENVIRONMENTS],
      );
      expect(task.supplyStation).not.toHaveProperty('weather');
      expect(task.supplyStation).not.toHaveProperty('timeOfDay');
    }
  });
});
