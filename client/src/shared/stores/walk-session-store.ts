import { DEFAULT_SEED_TYPES, DEFAULT_WALK_SEED_DROP, drawWalkSeed, type WalkSeedDrop, type SeedType } from '../../../../functions/src/planting-catalog';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { GeoPoint } from '../models/geo.models';
import {
  METERS_PER_WALK_STEP,
  RoutedWalkTaskPoint,
  WalkRoutePoint,
} from '../models/walk-task.models';
import { WalkResult } from '../models/walk-result';
import { projectPointOnRoute, routeDistanceMeters } from '../models/walk-route';
import { createDemoWalkTasks } from '../models/demo-walk-tasks';
import { isWithinGeoRadius } from '../models/geo-distance';
import { TREE_CULTIVATION_RADIUS_METERS } from '../../environments/environment-dev';
import { LocationStore } from './location-store';
import { ProgressStore } from './progress-store';
import { cmsPublication } from '../models/cms-publication';
import { findHomeTree } from '../../features/home/home-tree-recommendations';

export type WalkDestination = {
  id: string;
  position: GeoPoint;
};

export type WalkPhase = 'idle' | 'planning' | 'walking' | 'cultivating' | 'arrived';

type WalkSessionState = {
  seedDropSnapshot: { rule: WalkSeedDrop; pools: SeedType[]; version: number; destinationPlace: string } | null;
  phase: WalkPhase;
  cultivationReturnPhase: 'idle' | 'planning' | 'walking' | 'arrived' | null;
  routeId: string | null;
  destination: WalkDestination | null;
  destinationConfirmed: boolean;
  baseRoute: readonly GeoPoint[];
  route: readonly GeoPoint[];
  routedTaskIds: readonly string[];
  routedTreeIds: readonly string[];
  treeStops: readonly WalkRoutePoint[];
  plannedDistanceMeters: number;
  plannedDurationSeconds: number;
  taskPoints: readonly RoutedWalkTaskPoint[];
  taskRoutes: readonly RoutedWalkTaskPoint[];
  baseDistanceMeters: number;
  baseDurationSeconds: number;
  routeLoading: boolean;
  routingFailed: boolean;
  planningError: string | null;
  startedAt: Date | null;
  distanceMeters: number;
  progress: number;
  currentWaypointId: string | null;
  checkedInTaskIds: readonly string[];
  checkInError: string | null;
  startingSteps: number;
  startingLightEnergy: number;
  completedWalkResult: WalkResult | null;
};

const initialState: WalkSessionState = {
  seedDropSnapshot: null,
  phase: 'idle',
  cultivationReturnPhase: null,
  routeId: null,
  destination: null,
  destinationConfirmed: false,
  baseRoute: [],
  route: [],
  routedTaskIds: [],
  routedTreeIds: [],
  treeStops: [],
  plannedDistanceMeters: 0,
  plannedDurationSeconds: 0,
  taskPoints: [],
  taskRoutes: [],
  baseDistanceMeters: 0,
  baseDurationSeconds: 0,
  routeLoading: false,
  routingFailed: false,
  planningError: null,
  startedAt: null,
  distanceMeters: 0,
  progress: 0,
  currentWaypointId: null,
  checkedInTaskIds: [],
  checkInError: null,
  startingSteps: 0,
  startingLightEnergy: 0,
  completedWalkResult: null,
};

export const WalkSessionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    availableTaskPoints: computed(() => {
      if (!cmsPublication().managed) return store.taskRoutes().length > 0 ? store.taskRoutes() : createDemoWalkTasks(store.baseRoute());
      return createDemoWalkTasks(store.baseRoute()).map(task => {
        const routed = store.taskRoutes().find(old => old.id === task.id &&
          old.position.latitude === task.position.latitude && old.position.longitude === task.position.longitude);
        return { ...task, routeGeometry: routed?.routeGeometry ?? [], routeDistanceMeters: routed?.routeDistanceMeters ?? 0,
          description: routed?.description ?? task.description,
          estimatedExtraSteps: routed?.estimatedExtraSteps ?? task.estimatedExtraSteps };
      });
    }),
    routeNeedsUpdate: computed(
      () =>
        store.taskPoints().length !== store.routedTaskIds().length ||
        store.taskPoints().some((point) => !store.routedTaskIds().includes(point.id)) ||
        store.treeStops().length !== store.routedTreeIds().length ||
        store.treeStops().some((point) => !store.routedTreeIds().includes(point.id)),
    ),
    isIdle: computed(() => store.phase() === 'idle'),
    isPlanning: computed(() => store.phase() === 'planning'),
    isWalking: computed(() => store.phase() === 'walking'),
    isArrived: computed(() => store.phase() === 'arrived'),
    isCultivating: computed(() => store.phase() === 'cultivating'),
    hasActiveRoute: computed(() => store.routeId() !== null),
    hasDestination: computed(() => store.destination() !== null),
  })),
  withMethods((store) => {
    const location = inject(LocationStore);
    const progress = inject(ProgressStore);
    return {
      refreshSelectedStation(station: RoutedWalkTaskPoint): void {
        patchState(store, { taskPoints: store.taskPoints().map(p => p.id === station.id ? station : p) });
      },
      setCheckInError: (checkInError: string | null) => patchState(store, { checkInError }),
      checkInTaskPoint: (taskId: string) => {
        const task = store.taskPoints().find((point) => point.id === taskId);
        if (!store.hasActiveRoute() || !task || (!store.isWalking() && !store.isArrived())) {
          patchState(store, { checkInError: '本次散步沒有這個補給站，請重新選擇。' });
          return false;
        }
        if (store.checkedInTaskIds().includes(taskId)) {
          patchState(store, { checkInError: '本次散步已領取此補給站的資源。' });
          return false;
        }
        if (!isWithinGeoRadius(location.current(), task.position, TREE_CULTIVATION_RADIUS_METERS)) {
          patchState(store, {
            checkInError: `請取得有效定位並靠近至 ${TREE_CULTIVATION_RADIUS_METERS} 公尺內再打卡。`,
          });
          return false;
        }
        if (!progress.grantDemoSupply(taskId, task.supplyStation.supply)) {
          patchState(store, { checkInError: progress.cultivationError() });
          return false;
        }
        patchState(store, {
          checkedInTaskIds: [...store.checkedInTaskIds(), taskId],
          checkInError: null,
        });
        return true;
      },
      checkInDestination: (treeId: string) => {
        const destination = store.destination();
        const startedAt = store.startedAt();
        if (!store.hasActiveRoute() || !startedAt || destination?.id !== treeId) {
          patchState(store, { checkInError: '這棵小樹不是本次散步的終點，請重新選擇。' });
          return false;
        }
        if (
          !isWithinGeoRadius(
            location.current(),
            destination.position,
            TREE_CULTIVATION_RADIUS_METERS,
          )
        ) {
          patchState(store, {
            checkInError: `請取得有效定位並靠近至 ${TREE_CULTIVATION_RADIUS_METERS} 公尺內再打卡終點。`,
          });
          return false;
        }
        const keepCultivating = store.isCultivating();
        if (!progress.markDemoTreeVisited(treeId)) {
          patchState(store, { checkInError: progress.cultivationError() });
          return false;
        }
        const steps = progress.totalRecordedSteps() - store.startingSteps();
        const rewards = store
          .taskPoints()
          .filter((point) => store.checkedInTaskIds().includes(point.id))
          .map((point) => point.supplyStation.supply);
        const seedTable = store.seedDropSnapshot();
        const rolls = crypto.getRandomValues(new Uint32Array(2));
        const species = seedTable ? drawWalkSeed(seedTable.rule, seedTable.pools,
          rolls[0] / 4294967296, rolls[1] / 4294967296) : null;
        if (species && seedTable) progress.grantWalkSeed(species, seedTable.rule.seedTypeId, seedTable.version, {
          routeId: store.routeId()!,
          place: seedTable.destinationPlace,
          acquiredAt: Date.now(),
        });
        const inventory = progress.inventory();
        const completedWalkResult: WalkResult = {
          earnedSeeds: species ? 1 : 0,
          seedsBalance: inventory.seeds,
          durationMinutes: Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60_000)),
          stationCount: store.checkedInTaskIds().length,
          steps,
          distanceMeters: steps * METERS_PER_WALK_STEP,
          earnedLightEnergy: progress.totalRecordedLightEnergy() - store.startingLightEnergy(),
          earnedWaterDrops: rewards
            .filter((reward) => reward.resource === 'water')
            .reduce((sum, reward) => sum + reward.amount, 0),
          earnedFertilizer: rewards
            .filter((reward) => reward.resource === 'fertilizer')
            .reduce((sum, reward) => sum + reward.amount, 0),
          lightEnergyBalance: inventory.lightEnergy,
          waterDropsBalance: inventory.waterDrops,
          fertilizerBalance: inventory.fertilizer,
        };
        patchState(store, {
          ...initialState,
          phase: keepCultivating ? 'cultivating' : 'idle',
          cultivationReturnPhase: keepCultivating ? 'idle' : null,
          completedWalkResult,
        });
        return true;
      },
      startCultivating: () => {
        const phase = store.phase();
        if (
          phase === 'idle' ||
          phase === 'planning' ||
          phase === 'walking' ||
          phase === 'arrived'
        ) {
          patchState(store, { phase: 'cultivating', cultivationReturnPhase: phase });
        }
      },
      finishCultivating: () => {
        if (store.isCultivating()) {
          patchState(store, {
            phase: store.cultivationReturnPhase() ?? 'idle',
            cultivationReturnPhase: null,
          });
        }
      },
      startPlanning: () => {
        patchState(store, { ...initialState, phase: 'planning' });
      },
      selectDestination: (destination: WalkDestination, route: readonly GeoPoint[]) => {
        if (!store.isPlanning()) return;
        if (store.destinationConfirmed()) {
          patchState(store, { planningError: '終點已確定，請返回並重新規劃以更換終點。' });
          return;
        }
        if (!progress.canVisitDemoTree(destination.id)) {
          patchState(store, { planningError: '這個種植點今日已無法造訪，請選擇其他目的地。' });
          return;
        }
        patchState(store, {
          destination,
          destinationConfirmed: false,
          baseRoute: route,
          route,
          routedTaskIds: [],
          routedTreeIds: [],
          treeStops: [],
          plannedDistanceMeters: routeDistanceMeters(route),
          plannedDurationSeconds: routeDistanceMeters(route) / 1.25,
          taskPoints: [],
          taskRoutes: [],
          checkedInTaskIds: [],
          checkInError: null,
          baseDistanceMeters: routeDistanceMeters(route),
          baseDurationSeconds: routeDistanceMeters(route) / 1.25,
          planningError: null,
          routingFailed: false,
        });
      },
      confirmDestination: () => {
        const destination = store.destination();
        if (!store.isPlanning() || !destination || store.destinationConfirmed()) {
          patchState(store, { planningError: '請先選擇本次路線的候選終點。' });
          return false;
        }
        if (!progress.canVisitDemoTree(destination.id)) {
          patchState(store, { planningError: '這個種植點今日已無法造訪，請選擇其他目的地。' });
          return false;
        }
        if (store.routeLoading() || store.routingFailed() || store.baseRoute().length < 2) {
          patchState(store, { planningError: '請先完成終點步行路線載入，再確定此終點。' });
          return false;
        }
        patchState(store, { destinationConfirmed: true, planningError: null });
        return true;
      },
      setBaseRoute: (route: readonly GeoPoint[], distanceMeters: number, durationSeconds = distanceMeters / 1.25) => {
        patchState(store, {
          baseRoute: route,
          baseDistanceMeters: distanceMeters,
          baseDurationSeconds: durationSeconds,
          route,
          plannedDistanceMeters: distanceMeters,
          plannedDurationSeconds: durationSeconds,
          routedTaskIds: [],
          routedTreeIds: [],
        });
      },
      setPlannedRoute: (
        route: readonly GeoPoint[],
        distanceMeters: number,
        taskIds: readonly string[],
        treeIds: readonly string[] = [],
        durationSeconds = distanceMeters / 1.25,
      ) => {
        patchState(store, {
          route,
          plannedDistanceMeters: distanceMeters,
          plannedDurationSeconds: durationSeconds,
          routedTaskIds: taskIds,
          routedTreeIds: treeIds,
          planningError: null,
          routingFailed: false,
        });
      },
      setTaskRoutes: (tasks: readonly RoutedWalkTaskPoint[]) => {
        patchState(store, { taskRoutes: tasks, routingFailed: false, planningError: null });
      },
      setRouteLoading: (routeLoading: boolean) => patchState(store, { routeLoading }),
      setPlanningError: (planningError: string | null) => patchState(store, { planningError }),
      setRoutingError: (planningError: string) =>
        patchState(store, { planningError, routingFailed: true }),
      clearDestination: () => {
        patchState(store, {
          destination: null,
          destinationConfirmed: false,
          baseRoute: [],
          route: [],
          plannedDistanceMeters: 0,
          plannedDurationSeconds: 0,
          routedTaskIds: [],
          routedTreeIds: [],
          treeStops: [],
          taskPoints: [],
          taskRoutes: [],
          checkedInTaskIds: [],
          checkInError: null,
          baseDistanceMeters: 0,
          baseDurationSeconds: 0,
          routeLoading: false,
          routingFailed: false,
          planningError: null,
        });
      },
      toggleTaskPoint: (taskId: string) => {
        const destination = store.destination();
        const source = store.availableTaskPoints().find((point) => point.id === taskId);
        const candidate = source ? { ...source, routeGeometry: 'routeGeometry' in source ? source.routeGeometry : [],
          routeDistanceMeters: 'routeDistanceMeters' in source ? source.routeDistanceMeters : 0 } as RoutedWalkTaskPoint : undefined;
        if (!store.isPlanning() || !store.destinationConfirmed() || !destination || !candidate) {
          patchState(store, {
            planningError: '請先確定此終點並等待補給站載入，再加入本次路線提供的補給站。',
          });
          return false;
        }
        const selected = store.taskPoints().some((point) => point.id === taskId);
        const taskPoints = selected
          ? store.taskPoints().filter((point) => point.id !== taskId)
          : [...store.taskPoints(), candidate];
        patchState(store, {
          taskPoints,
          planningError: null,
          routingFailed: false,
          ...(taskPoints.length === 0 && store.treeStops().length === 0
            ? {
                route: store.baseRoute(),
                plannedDistanceMeters: store.baseDistanceMeters(),
                plannedDurationSeconds: store.baseDurationSeconds(),
                routedTaskIds: [],
                routedTreeIds: [],
              }
            : {}),
        });
        return true;
      },
      toggleTreeStop: (point: WalkDestination) => {
        if (!store.isPlanning() || !store.destinationConfirmed() || !store.destination()) {
          patchState(store, { planningError: '請先確定此終點，再加入沿途種植點。' });
          return false;
        }
        if (point.id === store.destination()?.id) {
          patchState(store, { planningError: '本次終點不能重複加入為沿途種植點。' });
          return false;
        }
        const selected = store.treeStops().some((stop) => stop.id === point.id);
        if (!selected && !progress.canVisitDemoTree(point.id)) {
          patchState(store, { planningError: '這個種植點今日已無法造訪，只能查看狀態。' });
          return false;
        }
        const projection = projectPointOnRoute(point.position, store.baseRoute());
        if (!projection) {
          patchState(store, { planningError: '無法計算沿途種植點的路線順序，請返回重新規劃。' });
          return false;
        }
        const treeStops = selected
          ? store.treeStops().filter((stop) => stop.id !== point.id)
          : [
              ...store.treeStops(),
              {
                ...point,
                routeStop: {
                  position: projection.position,
                  segmentIndex: projection.segmentIndex,
                  fraction: projection.fraction,
                },
              },
            ];
        patchState(store, {
          treeStops,
          planningError: null,
          routingFailed: false,
          ...(treeStops.length === 0 && store.taskPoints().length === 0
            ? {
                route: store.baseRoute(),
                plannedDistanceMeters: store.baseDistanceMeters(),
                plannedDurationSeconds: store.baseDurationSeconds(),
                routedTaskIds: [],
                routedTreeIds: [],
              }
            : {}),
        });
        return true;
      },
      startWalk: (routeId: string) => {
        const destination = store.destination();
        if (destination && !progress.canVisitDemoTree(destination.id)) {
          patchState(store, { planningError: '這個種植點今日已無法造訪，請選擇其他目的地。' });
          return false;
        }
        if (!store.destinationConfirmed()) {
          patchState(store, { planningError: '請先確定此終點，再確認本次路線。' });
          return false;
        }
        if (store.treeStops().some((point) => !progress.canVisitDemoTree(point.id))) {
          patchState(store, { planningError: '沿途種植點已無法造訪，請移出後更新預覽路線。' });
          return false;
        }
        if (store.routeNeedsUpdate()) {
          patchState(store, { planningError: '沿途站點已變更，請先更新預覽路線。' });
          return false;
        }
        if (
          store.routeLoading() ||
          store.routingFailed() ||
          !store.isPlanning() ||
          !store.destination() ||
          store.route().length < 2
        ) {
          patchState(store, { planningError: '請先完成目的地選擇，再確認本次散步。' });
          return false;
        }

        patchState(store, {
          phase: 'walking',
          seedDropSnapshot: JSON.parse(JSON.stringify({
            rule: cmsPublication().config?.walkSeedDrop ?? DEFAULT_WALK_SEED_DROP,
            pools: cmsPublication().config?.seedTypes ?? DEFAULT_SEED_TYPES,
            version: cmsPublication().version,
            destinationPlace: progress.demoTrees()[destination!.id]?.site?.poiName ?? findHomeTree(destination!.id)?.poiName ?? '本次散步終點',
          })),
          routeId,
          startedAt: new Date(),
          startingSteps: progress.totalRecordedSteps(),
          startingLightEnergy: progress.totalRecordedLightEnergy(),
          completedWalkResult: null,
          distanceMeters: 0,
          progress: 0,
          currentWaypointId: null,
          planningError: null,
        });
        return true;
      },
      updateProgress: (progress: number, distanceMeters: number, currentWaypointId?: string) => {
        patchState(store, {
          progress: Math.min(Math.max(progress, 0), 1),
          distanceMeters: Math.max(distanceMeters, 0),
          currentWaypointId: currentWaypointId ?? store.currentWaypointId(),
        });
      },
      arrive: () => {
        if (store.phase() === 'walking') {
          patchState(store, { phase: 'arrived', progress: 1 });
        } else if (store.cultivationReturnPhase() === 'walking') {
          patchState(store, { cultivationReturnPhase: 'arrived', progress: 1 });
        }
      },
      cancelWalk: () => {
        patchState(store, { ...initialState, phase: 'idle' });
      },
      reset: () => {
        patchState(store, { ...initialState, phase: 'idle' });
      },
    };
  }),
);
