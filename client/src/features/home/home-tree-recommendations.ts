import { GeoPoint } from '../../shared/models/geo.models';
import { haversineDistanceMeters } from '../../shared/models/geo-distance';
import {
  TREE_STAGE_GROWTH_RATIOS,
  TreeStage,
  treeStage,
  treeWaterState,
  weedPenaltyActive,
  taipeiDay,
} from '../../shared/models/tree-cultivation';
import {
  type CultivationWeather,
  type CultivationTimeOfDay,
  destination,
  demoPlantingSpots,
  TREE_GROWTH_PER_HARVEST,
} from '../../environments/environment-dev';

export type HomeTreeStatus = '可收成' | '即將可收成' | '茁壯中' | '已收成' | '待種植';
export type RecommendedReason = `${RecommendedType}${RecommendedEvent}`;
type RecommendedType = '種子' | '樹苗' | '小樹' | '大樹';
type RecommendedEvent = '即將進入新階段' | '附近雜草叢生' | '缺水了' | '即將收成' | '可收成';

const RECOMMENDED_EVENTS: readonly RecommendedEvent[] = [
  '可收成',
  '即將收成',
  '缺水了',
  '附近雜草叢生',
  '即將進入新階段',
];
const RECOMMENDED_TREE_TYPES: Record<TreeStage, RecommendedType> = {
  seed: '種子',
  seedling: '樹苗',
  smallSapling: '樹苗',
  largeSapling: '樹苗',
  young: '小樹',
  mature: '大樹',
  flowering: '大樹',
  large: '大樹',
};

export type HomeTree = {
  empty?: boolean;
  unavailable?: boolean;
  id: string;
  nickName: string;
  species: string;
  weather: CultivationWeather;
  timeOfDay?: CultivationTimeOfDay;
  growth: number;
  nextHarvestAt: number;
  harvested?: boolean;
  weedCount: number;
  plantedAt: number;
  lastWateredAt: number | null;
  poiName: string;
  position: GeoPoint;
};

export type RecommendedHomeTree = HomeTree & {
  estimatedSteps: number;
  remainingGrowth: number;
  status: HomeTreeStatus;
  recommendedReason: RecommendedReason | null;
};

export const RECOMMENDED_STEP_TARGET = 7_500;
export const RECOMMENDED_STEP_LIMIT = 8_000;
export const RECOMMENDED_NEXT_STAGE_MARGIN = 0.05;
export const RECOMMENDED_NEAR_HARVEST_RATIO = 0.9;

const plantedHomeTrees: readonly HomeTree[] = [
  {
    id: 'tree-1',
    nickName: '櫻櫻',
    species: '櫻花',
    position: { longitude: 121.55563921922585, latitude: 25.0850596110976 },
    poiName: '西湖',
  },
  {
    id: 'tree-2',
    nickName: '柿柿柿柿子樹',
    species: '柿子',
    position: { longitude: 121.5751557682424, latitude: 25.0800804465638 },
    poiName: '內湖',
  },
  {
    id: 'tree-3',
    nickName: '小榕樹',
    species: '榕樹',
    position: { longitude: 121.56737274697623, latitude: 25.08256899377965 },
    poiName: '西湖',
  },
  {
    id: 'tree-4',
    nickName: '小桂花',
    species: '桂花',
    position: { longitude: 121.56756543034211, latitude: 25.079253203623452 },
    poiName: '港墘',
  },
  {
    id: 'tree-5',
    nickName: '銀杏123',
    species: '銀杏',
    position: { longitude: 121.46472052639257, latitude: 25.014441981908295 },
    poiName: '板橋車站',
  },
  {
    id: 'tree-6',
    nickName: '不長櫻桃的櫻花',
    species: '櫻花',
    position: { longitude: 121.4642, latitude: 25.0124 },
    poiName: '萬坪公園',
  },
  {
    id: 'tree-7',
    nickName: '我的小榕樹',
    species: '榕樹',
    position: { longitude: 121.4592, latitude: 25.0084 },
    poiName: '府中',
  },
  {
    id: 'tree-8',
    nickName: '大大楓香',
    species: '楓香',
    position: { longitude: 121.4653, latitude: 25.012 },
    poiName: '市民廣場',
  },
  {
    id: 'tree-9',
    nickName: '啊桂花',
    species: '桂花',
    position: { longitude: 121.458, latitude: 25.0062 },
    poiName: '新板',
  },
  {
    id: 'tree-10',
    nickName: '文青樟樹',
    species: '樟樹',
    position: { longitude: 121.4496, latitude: 25.0237 },
    poiName: '435 藝文特區',
  },
].map((tree) => {
  const marker = destination.features.find(({ properties }) => properties.treeId === tree.id);
  if (!marker) throw new Error(`Missing Demo tree marker: ${tree.id}`);
  return {
    ...tree,
    weather: marker.properties.weather,
    timeOfDay: marker.properties.timeOfDay,
    growth: marker.properties.growth,
    nextHarvestAt: TREE_GROWTH_PER_HARVEST,
    weedCount: marker.properties.weedCount,
    plantedAt: Date.now(),
    lastWateredAt: null,
    position: {
      longitude: marker.geometry.coordinates[0],
      latitude: marker.geometry.coordinates[1],
    },
  };
});

export const homeTrees: readonly HomeTree[] = [
  ...plantedHomeTrees,
  ...demoPlantingSpots.map((spot) => ({
    ...spot,
    empty: true,
    growth: 0,
    nextHarvestAt: TREE_GROWTH_PER_HARVEST,
    weedCount: 0,
    plantedAt: Date.now(),
    lastWateredAt: null,
  })),
];

export function findHomeTree(
  treeId: string,
  trees: readonly HomeTree[] = homeTrees,
): HomeTree | undefined {
  return trees.find((tree) => tree.id === treeId);
}

export function homeTreesWithProgress(
  progress: Readonly<
    Record<
      string,
      {
        growth: number;
        harvestCount: number;
        weedIds: readonly number[];
        plantedAt: number;
        lastWateredAt: number | null;
        planted?: boolean;
        harvestedOn?: string | null;
        visitedOn?: string | null;
      }
    >
  >,
  day = taipeiDay(),
): readonly HomeTree[] {
  return homeTrees.map((tree) => ({
    ...tree,
    growth: progress[tree.id].growth,
    harvested: progress[tree.id].harvestCount > 0,
    empty: progress[tree.id].planted === undefined ? tree.empty : !progress[tree.id].planted,
    unavailable: progress[tree.id].harvestedOn === day || progress[tree.id].visitedOn === day,
    weedCount: progress[tree.id].weedIds.length,
    plantedAt: progress[tree.id].plantedAt,
    lastWateredAt: progress[tree.id].lastWateredAt,
  }));
}

export function getHomeTreeRecommendation(
  treeId: string | null | undefined,
  origin: GeoPoint | null,
  trees: readonly HomeTree[] = homeTrees,
  now = Date.now(),
): RecommendedHomeTree | null {
  if (!treeId || !origin) return null;

  const tree = findHomeTree(treeId, trees);
  return tree ? toRecommendation(tree, origin, now) : null;
}

/**判斷推薦的終點樹 */
export function recommendHomeTrees(
  origin: GeoPoint | null,
  limit = 3,
  trees: readonly HomeTree[] = homeTrees,
  now = Date.now(),
): readonly RecommendedHomeTree[] {
  if (!origin || limit <= 0) return [];

  const ranked = trees
    .filter((tree) => !tree.unavailable && !tree.harvested)
    .map((tree) => toRecommendation(tree, origin, now))
    .sort(compareRecommendations);
  const withinTarget = ranked.filter((tree) => tree.estimatedSteps <= RECOMMENDED_STEP_LIMIT);
  const overTarget = ranked
    .filter((tree) => tree.estimatedSteps > RECOMMENDED_STEP_LIMIT)
    .sort((left, right) => left.estimatedSteps - right.estimatedSteps);

  return [...withinTarget, ...overTarget].slice(0, limit);
}

export function getTreeRecommendationReason(
  tree: HomeTree,
  now = Date.now(),
): RecommendedReason | null {
  if (tree.harvested || tree.unavailable || tree.empty) return null;
  const type = RECOMMENDED_TREE_TYPES[treeStage(tree.growth, tree.nextHarvestAt)];
  let event: RecommendedEvent;
  if (tree.growth >= tree.nextHarvestAt) {
    event = '可收成';
  } else if (tree.growth >= tree.nextHarvestAt * RECOMMENDED_NEAR_HARVEST_RATIO) {
    event = '即將收成';
  } else if (treeWaterState(tree.lastWateredAt, tree.plantedAt, now) === 'dry') {
    event = '缺水了';
  } else if (weedPenaltyActive(tree.weedCount)) {
    event = '附近雜草叢生';
  } else {
    const nextStage = Object.values(TREE_STAGE_GROWTH_RATIOS).find(
      (ratio) => tree.growth < tree.nextHarvestAt * ratio,
    );
    if (
      nextStage === undefined ||
      tree.nextHarvestAt * nextStage - tree.growth >
        tree.nextHarvestAt * RECOMMENDED_NEXT_STAGE_MARGIN
    )
      return null;
    event = '即將進入新階段';
  }
  return `${type}${event}`;
}

function toRecommendation(tree: HomeTree, origin: GeoPoint, now: number): RecommendedHomeTree {
  const remainingGrowth = Math.max(tree.nextHarvestAt - tree.growth, 0);
  return {
    ...tree,
    estimatedSteps: estimateWalkingSteps(origin, tree.position),
    remainingGrowth,
    recommendedReason: getTreeRecommendationReason(tree, now),
    status: tree.empty
      ? '待種植'
      : tree.harvested
        ? '已收成'
        : remainingGrowth === 0
          ? '可收成'
          : remainingGrowth <= tree.nextHarvestAt * 0.1
            ? '即將可收成'
            : '茁壯中',
  };
}

function compareRecommendations(left: RecommendedHomeTree, right: RecommendedHomeTree): number {
  return (
    recommendationPriority(left.recommendedReason) -
      recommendationPriority(right.recommendedReason) ||
    Number(!!left.harvested) - Number(!!right.harvested) ||
    left.remainingGrowth - right.remainingGrowth ||
    left.estimatedSteps - right.estimatedSteps
  );
}

function recommendationPriority(reason: RecommendedReason | null): number {
  const priority = RECOMMENDED_EVENTS.findIndex((event) => reason?.endsWith(event));
  return priority < 0 ? RECOMMENDED_EVENTS.length : priority;
}

export function estimateWalkingSteps(origin: GeoPoint, destination: GeoPoint): number {
  const directDistanceMeters = haversineDistanceMeters(origin, destination);
  const walkingDistanceMeters = directDistanceMeters * 1.18;
  return Math.max(100, Math.round(walkingDistanceMeters / 0.75 / 100) * 100);
}
