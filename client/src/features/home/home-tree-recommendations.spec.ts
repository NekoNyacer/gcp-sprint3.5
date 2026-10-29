import {
  destination,
  demoPlantingSpots,
  routeCoordinatesByTree,
  TREE_GROWTH_PER_HARVEST,
  TREE_WEED_PENALTY_THRESHOLD,
  TREE_WEEDS_ENABLED,
} from '../../environments/environment-dev';
import {
  estimateWalkingSteps,
  getHomeTreeRecommendation,
  recommendHomeTrees,
  RECOMMENDED_STEP_LIMIT,
  homeTrees,
  homeTreesWithProgress,
  getTreeRecommendationReason,
  HomeTree,
  RecommendedReason,
} from './home-tree-recommendations';
import { TREE_DRY_AFTER_MS } from '../../shared/models/tree-cultivation';

const BANQIAO_START = {
  latitude: 25.001001886332944,
  longitude: 121.45475418388244,
};

describe('home tree recommendations', () => {
  it('returns three nearby trees with distinct identities and actionable reasons', () => {
    const recommendations = recommendHomeTrees(BANQIAO_START);

    expect(recommendations).toHaveLength(3);
    expect(new Set(recommendations.map((tree) => tree.id)).size).toBe(3);
    expect(recommendations.every((tree) => tree.recommendedReason !== null)).toBe(true);
    expect(recommendations.every((tree) => tree.estimatedSteps <= RECOMMENDED_STEP_LIMIT)).toBe(
      true,
    );
  });

  it('provides a seeded route for every recommended tree', () => {
    const recommendations = recommendHomeTrees(BANQIAO_START);

    expect(recommendations.every((tree) => routeCoordinatesByTree[tree.id]?.length > 1)).toBe(true);
  });

  it('enriches a selected tree with the same estimated-step information', () => {
    const selectedTree = getHomeTreeRecommendation('tree-5', BANQIAO_START);

    expect(selectedTree).toMatchObject({
      id: 'tree-5',
      estimatedSteps: expect.any(Number),
      remainingGrowth: TREE_GROWTH_PER_HARVEST - Math.floor(TREE_GROWTH_PER_HARVEST * 0.984),
      status: '即將可收成',
    });
  });

  it('uses the same cultivation growth and target as every map marker', () => {
    expect(homeTrees).toHaveLength(destination.features.length + demoPlantingSpots.length);
    for (const tree of homeTrees.filter((tree) => !tree.empty)) {
      const marker = destination.features.find(({ properties }) => properties.treeId === tree.id)!;
      expect(tree.growth).toBe(marker.properties.growth);
      expect(tree.nextHarvestAt).toBe(TREE_GROWTH_PER_HARVEST);
    }
    expect(
      destination.features.some(({ properties }) => properties.fertilizerRemainingMs > 0),
    ).toBe(true);
    expect(
      destination.features.some(({ properties }) => properties.fertilizerRemainingMs === 0),
    ).toBe(true);
  });

  it('gives every tree its configured weather and includes all three test conditions', () => {
    expect(new Set(homeTrees.map((tree) => tree.weather))).toEqual(
      new Set(['sunny', 'rainy', 'cloudy']),
    );
    for (const { properties } of destination.features) {
      expect(homeTrees.find((tree) => tree.id === properties.treeId)?.weather).toBe(
        properties.weather,
      );
    }
  });

  it('returns null when the selected tree or current location is unavailable', () => {
    expect(getHomeTreeRecommendation('missing-tree', BANQIAO_START)).toBeNull();
    expect(getHomeTreeRecommendation('tree-5', null)).toBeNull();
    expect(getHomeTreeRecommendation(undefined, BANQIAO_START)).toBeNull();
  });

  it('never fills recommendation slots with unavailable or harvested trees', () => {
    const trees = homeTrees.map((tree) => ({
      ...tree,
      unavailable: tree.id !== demoPlantingSpots[0].id,
    }));
    expect(recommendHomeTrees(BANQIAO_START, 3, trees).map((tree) => tree.id)).toEqual([
      demoPlantingSpots[0].id,
    ]);
    expect(getHomeTreeRecommendation(demoPlantingSpots[0].id, BANQIAO_START, trees)).toMatchObject({
      status: '待種植',
      empty: true,
      recommendedReason: null,
    });
    expect(
      recommendHomeTrees(
        BANQIAO_START,
        3,
        trees.map((tree) => ({ ...tree, harvested: true })),
      ),
    ).toEqual([]);
  });

  it('labels harvested trees correctly and prioritizes trees that can still be cultivated', () => {
    const trees = homeTrees.map((tree) => ({ ...tree, harvested: tree.id === 'tree-6' }));
    expect(getHomeTreeRecommendation('tree-6', BANQIAO_START, trees)?.status).toBe('已收成');
    expect(recommendHomeTrees(BANQIAO_START, 3, trees).some((tree) => tree.id === 'tree-6')).toBe(
      false,
    );
  });

  it('uses live growth and completed harvests for both map and planner recommendations', () => {
    const progress = Object.fromEntries(
      homeTrees.map((tree) => [
        tree.id,
        {
          growth: tree.growth,
          harvestCount: tree.id === 'tree-6' ? 1 : 0,
          weedIds: Array.from({ length: tree.weedCount }, (_, index) => index),
          plantedAt: tree.plantedAt,
          lastWateredAt: tree.lastWateredAt,
        },
      ]),
    );
    progress['tree-9'].growth = TREE_GROWTH_PER_HARVEST;
    const trees = homeTreesWithProgress(progress);
    expect(trees.find((tree) => tree.id === 'tree-6')?.harvested).toBe(true);
    expect(recommendHomeTrees(BANQIAO_START, 3, trees)[0]).toMatchObject({
      id: 'tree-9',
      status: '可收成',
      remainingGrowth: 0,
    });
  });

  describe('Tree recommendation reasons', () => {
    const now = Date.UTC(2026, 9, 16, 7);
    function tree(changes: Partial<HomeTree> = {}): HomeTree {
      return {
        ...homeTrees[0],
        id: 'test-tree',
        position: BANQIAO_START,
        growth: 0,
        nextHarvestAt: 1000,
        weedCount: 0,
        harvested: false,
        plantedAt: now,
        lastWateredAt: null,
        ...changes,
      };
    }

    it.each<[number, RecommendedReason | null]>([
      [0, null],
      [49.999, null],
      [50, '種子即將進入新階段'],
      [99.999, '種子即將進入新階段'],
      [100, null],
      [249.999, null],
      [250, '樹苗即將進入新階段'],
      [299.999, '樹苗即將進入新階段'],
      [300, null],
      [549.999, null],
      [550, '小樹即將進入新階段'],
      [599.999, '小樹即將進入新階段'],
      [600, null],
      [899.999, null],
      [900, '大樹即將收成'],
      [999.999, '大樹即將收成'],
      [1000, '大樹可收成'],
      [1100, '大樹可收成'],
    ])('uses exact stage and reason boundaries at growth %s', (growth, reason) => {
      expect(getTreeRecommendationReason(tree({ growth }), now)).toBe(reason);
    });

    it.each([50, 100, 5000])('scales reason thresholds with harvest target %s', (target) => {
      expect(
        getTreeRecommendationReason(
          tree({
            nextHarvestAt: target,
            growth: target * 0.25,
          }),
          now,
        ),
      ).toBe('樹苗即將進入新階段');
      expect(
        getTreeRecommendationReason(
          tree({
            nextHarvestAt: target,
            growth: target * 0.9,
          }),
          now,
        ),
      ).toBe('大樹即將收成');
      expect(
        getTreeRecommendationReason(
          tree({
            nextHarvestAt: target,
            growth: target,
          }),
          now,
        ),
      ).toBe('大樹可收成');
    });

    it.each<[number, string]>([
      [0, '種子'],
      [100, '樹苗'],
      [300, '小樹'],
      [600, '大樹'],
    ])('prefixes the configured weed reason with the current tree type at %s', (growth, type) => {
      expect(
        getTreeRecommendationReason(
          tree({
            growth,
            weedCount: TREE_WEED_PENALTY_THRESHOLD,
          }),
          now,
        ),
      ).toBe(TREE_WEEDS_ENABLED ? `${type}附近雜草叢生` : null);
    });

    it('uses remaining weed count, not the persistent weed debuff', () => {
      expect(
        getTreeRecommendationReason(
          tree({
            weedCount: TREE_WEED_PENALTY_THRESHOLD - 1,
          }),
          now,
        ),
      ).toBeNull();
      expect(
        getTreeRecommendationReason(
          tree({
            weedCount: TREE_WEED_PENALTY_THRESHOLD,
          }),
          now,
        ),
      ).toBe(TREE_WEEDS_ENABLED ? '種子附近雜草叢生' : null);
    });

    it('uses strictly over seven days and falls back to planting time only before the first watering', () => {
      const plantedAt = now - TREE_DRY_AFTER_MS;
      expect(getTreeRecommendationReason(tree({ plantedAt }), now)).toBeNull();
      expect(getTreeRecommendationReason(tree({ plantedAt: plantedAt - 1 }), now)).toBe(
        '種子缺水了',
      );
      expect(
        getTreeRecommendationReason(
          tree({
            plantedAt: plantedAt - 1,
            lastWateredAt: now,
          }),
          now,
        ),
      ).toBeNull();
      expect(
        getTreeRecommendationReason(
          tree({
            lastWateredAt: now - TREE_DRY_AFTER_MS,
          }),
          now,
        ),
      ).toBeNull();
      expect(
        getTreeRecommendationReason(
          tree({
            lastWateredAt: now - TREE_DRY_AFTER_MS - 1,
          }),
          now,
        ),
      ).toBe('種子缺水了');
    });

    it('chooses only the highest-priority matching reason and never recommends care after harvest', () => {
      const needsCare = {
        weedCount: TREE_WEED_PENALTY_THRESHOLD,
        plantedAt: now - TREE_DRY_AFTER_MS - 1,
      };
      expect(getTreeRecommendationReason(tree({ ...needsCare, growth: 1000 }), now)).toBe(
        '大樹可收成',
      );
      expect(getTreeRecommendationReason(tree({ ...needsCare, growth: 900 }), now)).toBe(
        '大樹即將收成',
      );
      expect(getTreeRecommendationReason(tree({ ...needsCare, growth: 550 }), now)).toBe(
        '小樹缺水了',
      );
      expect(
        getTreeRecommendationReason(
          tree({
            ...needsCare,
            growth: 550,
            lastWateredAt: now,
          }),
          now,
        ),
      ).toBe(TREE_WEEDS_ENABLED ? '小樹附近雜草叢生' : '小樹即將進入新階段');
      expect(
        getTreeRecommendationReason(
          tree({
            ...needsCare,
            growth: 550,
            lastWateredAt: now,
            weedCount: 0,
          }),
          now,
        ),
      ).toBe('小樹即將進入新階段');
      expect(
        getTreeRecommendationReason(
          tree({
            ...needsCare,
            growth: 1000,
            harvested: true,
          }),
          now,
        ),
      ).toBeNull();
    });

    it('ranks every reason ahead of no-reason fallback within 8,000 steps in the confirmed order', () => {
      const trees = [
        tree({ id: 'fallback', growth: 880 }),
        tree({ id: 'transition', growth: 50 }),
        tree({ id: 'weeds', weedCount: TREE_WEED_PENALTY_THRESHOLD }),
        tree({ id: 'dry', plantedAt: now - TREE_DRY_AFTER_MS - 1 }),
        tree({ id: 'near-harvest', growth: 900 }),
        tree({ id: 'ready', growth: 1000 }),
      ];
      expect(recommendHomeTrees(BANQIAO_START, 6, trees, now).map(({ id }) => id)).toEqual(
        TREE_WEEDS_ENABLED
          ? ['ready', 'near-harvest', 'dry', 'weeds', 'transition', 'fallback']
          : ['ready', 'near-harvest', 'dry', 'transition', 'fallback', 'weeds'],
      );
      expect(recommendHomeTrees(BANQIAO_START, 3, trees, now).map(({ id }) => id)).toEqual([
        'ready',
        'near-harvest',
        'dry',
      ]);
    });

    it('retains original growth and distance ordering for ties and fills all three slots without invented reasons', () => {
      const trees = [
        tree({ id: 'young', growth: 350 }),
        tree({
          id: 'far',
          growth: 700,
          position: { ...BANQIAO_START, latitude: BANQIAO_START.latitude + 0.001 },
        }),
        tree({ id: 'near', growth: 700 }),
      ];
      const recommendations = recommendHomeTrees(BANQIAO_START, 3, trees, now);
      expect(recommendations.map(({ id }) => id)).toEqual(['near', 'far', 'young']);
      expect(recommendations.every(({ recommendedReason }) => recommendedReason === null)).toBe(
        true,
      );
    });

    it('preserves distance grouping and nearest-first fallback beyond 8,000 steps', () => {
      const trees = [
        tree({
          id: 'far-ready',
          growth: 1000,
          position: { ...BANQIAO_START, latitude: BANQIAO_START.latitude + 0.2 },
        }),
        tree({
          id: 'closer-no-reason',
          position: { ...BANQIAO_START, latitude: BANQIAO_START.latitude + 0.1 },
        }),
        tree({ id: 'within-limit' }),
      ];
      const recommendations = recommendHomeTrees(BANQIAO_START, 3, trees, now);
      expect(recommendations.map(({ id }) => id)).toEqual([
        'within-limit',
        'closer-no-reason',
        'far-ready',
      ]);
      expect(recommendations[0].estimatedSteps).toBeLessThanOrEqual(RECOMMENDED_STEP_LIMIT);
      expect(recommendations[1].estimatedSteps).toBeGreaterThan(RECOMMENDED_STEP_LIMIT);
    });

    it('reads changing per-tree weeds and water timestamps from live progress', () => {
      const progress: Parameters<typeof homeTreesWithProgress>[0] = Object.fromEntries(
        homeTrees.map((seed) => [
          seed.id,
          {
            growth: 0,
            harvestCount: 0,
            weedIds: Array.from({ length: TREE_WEED_PENALTY_THRESHOLD }, (_, index) => index),
            plantedAt: now - TREE_DRY_AFTER_MS - 1,
            lastWateredAt: null,
          },
        ]),
      );
      const id = homeTrees[0].id;
      expect(getTreeRecommendationReason(homeTreesWithProgress(progress)[0], now)).toBe(
        '種子缺水了',
      );
      progress[id].lastWateredAt = now;
      expect(getTreeRecommendationReason(homeTreesWithProgress(progress)[0], now)).toBe(
        TREE_WEEDS_ENABLED ? '種子附近雜草叢生' : null,
      );
      progress[id].weedIds = [];
      expect(getTreeRecommendationReason(homeTreesWithProgress(progress)[0], now)).toBeNull();
      progress[id].harvestCount = 1;
      progress[id].growth = TREE_GROWTH_PER_HARVEST;
      expect(getTreeRecommendationReason(homeTreesWithProgress(progress)[0], now)).toBeNull();
    });
  });
  it('estimates a longer walk with more steps', () => {
    const nearbySteps = estimateWalkingSteps(BANQIAO_START, {
      latitude: 25.0062,
      longitude: 121.458,
    });
    const fartherSteps = estimateWalkingSteps(BANQIAO_START, {
      latitude: 25.0237,
      longitude: 121.4496,
    });

    expect(fartherSteps).toBeGreaterThan(nearbySteps);
  });
});
