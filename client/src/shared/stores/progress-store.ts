import { DEFAULT_SEED_TYPES, drawSpecies, type MysterySeed, type SeedOrigin } from "../../../../functions/src/planting-catalog";
import { computed, DestroyRef, inject } from '@angular/core';
import { TREE_WEEDS_ENABLED } from '../../environments/environment-dev';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
  withHooks,
  withProps,
} from '@ngrx/signals';
import {
  CultivationAllocation,
  cultivationGrowth,
  fertilizerActive,
  FERTILIZER_DURATION_MS,
  taipeiDay,
  waterDropCount,
  DEMO_HARVEST_POINTS,
  DEMO_HARVEST_DURATION_MS,
  DEMO_HARVEST_RECOVERY_DURATION_MS,
  DAILY_LIGHT_ENERGY_LIMIT,
  weedPenaltyActive,
} from '../models/tree-cultivation';
import {
  demoPlantingSpots,
  destination,
  TREE_GROWTH_PER_HARVEST,
} from '../../environments/environment-dev';
import { SupplyReward } from '../models/walk-task.models';
import { cmsPublication } from '../models/cms-publication';
import type { HomeTree } from '../../features/home/home-tree-recommendations';

type DemoTreeCultivation = {
  nickName?: string;
  species?: string;
  seedTypeId?: string;
  plantingVersion?: number;
  site?: HomeTree;
  harvestVersion?: number;
  harvestAwardPoints?: number;
  planted: boolean;
  harvestedOn: string | null;
  visitedOn: string | null;
  growth: number;
  weedIds: readonly number[];
  weedDebuff: boolean;
  plantedAt: number;
  lastWateredAt: number | null;
  fertilizedOn: string | null;
  fertilizerExpiresAt: number | null;
  growthRemainder: number;
  harvestCount: number;
  harvestStartedAt: number | null;
  harvestedAt: number | null;
};

function createDemoTrees(): Record<string, DemoTreeCultivation> {
  const now = Date.now();
  const empty: DemoTreeCultivation = {
    planted: true,
    harvestedOn: null,
    visitedOn: null,
    growth: 0,
    weedIds: [],
    weedDebuff: false,
    plantedAt: now,
    lastWateredAt: null,
    fertilizedOn: null,
    fertilizerExpiresAt: null,
    growthRemainder: 0,
    harvestCount: 0,
    harvestStartedAt: null,
    harvestedAt: null,
  };
  return Object.fromEntries([
    ['demo-tree', empty],
    ...demoPlantingSpots.map((spot) => [spot.id, { ...empty, planted: false }]),
    ...destination.features.map(({ properties }) => {
      if (!Number.isSafeInteger(properties.weedCount) || properties.weedCount < 0) {
        throw new RangeError(`Invalid weed count for Demo tree: ${properties.treeId}`);
      }
      return [
        properties.treeId,
        {
          ...empty,
          weedIds: Array.from({ length: properties.weedCount }, (_, index) => index),
          weedDebuff: weedPenaltyActive(properties.weedCount),
          growth: properties.growth,
          fertilizedOn:
            properties.fertilizerRemainingMs > 0
              ? taipeiDay(new Date(now + properties.fertilizerRemainingMs - FERTILIZER_DURATION_MS))
              : null,
          fertilizerExpiresAt:
            properties.fertilizerRemainingMs > 0 ? now + properties.fertilizerRemainingMs : null,
        },
      ];
    }),
  ]);
}

/**此Store管理:
 * 目前(本日)走了多少步
 * 有多少庫存資源(光能/水滴/肥料)
 * */

export const createProgressState = (demo = true): ProgressState => ({
  todaySteps: demo ? 15888 : 0,
  todayStepsDay: taipeiDay(),
  lightEarnedOn: null,
  lightEarnedToday: 0,
  totalRecordedSteps: 0,
  totalRecordedLightEnergy: 0,
  inventory: {
    lightEnergy: demo ? 5946 : 0,
    waterDrops: demo ? 777 : 0,
    fertilizer: demo ? 5 : 0,
    seeds: demo ? 1 : 0,
  },
  mysterySeeds: [],
  demoDay: taipeiDay(),
  demoSupplyStationClaimedOn: {},
  activeDemoTreeId: 'demo-tree',
  demoTrees: Object.fromEntries(Object.entries(createDemoTrees()).map(([id, tree]) => [id,
    demo ? tree : { ...tree, growth: 0, weedIds: [], weedDebuff: false,
      fertilizedOn: null, fertilizerExpiresAt: null },
  ])),
  demoTreePoints: 0,
  cultivationError: null,
});

export const ProgressStore = signalStore(
  { providedIn: 'root' },
  withState(() => createProgressState()),
  withProps(() => ({})),
  withComputed((store) => ({
    demoTreePlanted: computed(() => store.demoTrees()[store.activeDemoTreeId()].planted),
    unavailableDemoTreeIds: computed(() =>
      Object.entries(store.demoTrees())
        .filter(
          ([, tree]) =>
            tree.harvestCount > 0 ||
            tree.harvestedOn === store.demoDay() ||
            tree.visitedOn === store.demoDay(),
        )
        .map(([id]) => id),
    ),
    demoTreeGrowth: computed(() => store.demoTrees()[store.activeDemoTreeId()].growth),
    demoTreeWeeds: computed(() =>
      TREE_WEEDS_ENABLED ? store.demoTrees()[store.activeDemoTreeId()].weedIds : [],
    ),
    demoTreePlantedAt: computed(() => store.demoTrees()[store.activeDemoTreeId()].plantedAt),
    demoTreeLastWateredAt: computed(
      () => store.demoTrees()[store.activeDemoTreeId()].lastWateredAt,
    ),
    demoTreeFertilizedOn: computed(() => store.demoTrees()[store.activeDemoTreeId()].fertilizedOn),
    demoFertilizerExpiresAt: computed(
      () => store.demoTrees()[store.activeDemoTreeId()].fertilizerExpiresAt,
    ),
    demoGrowthRemainder: computed(
      () => store.demoTrees()[store.activeDemoTreeId()].growthRemainder,
    ),
    demoHarvestCount: computed(() => store.demoTrees()[store.activeDemoTreeId()].harvestCount),
    demoHarvestStartedAt: computed(
      () => store.demoTrees()[store.activeDemoTreeId()].harvestStartedAt,
    ),
    demoTreeHarvestedAt: computed(() => store.demoTrees()[store.activeDemoTreeId()].harvestedAt),
  })),
  withComputed((store) => ({
    demoGrowthTarget: computed(() => TREE_GROWTH_PER_HARVEST),
    demoTreeHarvested: computed(() => store.demoHarvestCount() > 0),
    demoWeedPenaltyActive: computed(
      () => TREE_WEEDS_ENABLED && store.demoTrees()[store.activeDemoTreeId()].weedDebuff,
    ),
    demoFruitReady: computed(
      () =>
        store.demoTreePlanted() &&
        store.demoHarvestCount() === 0 &&
        store.demoHarvestStartedAt() === null &&
        store.demoTreeGrowth() >= TREE_GROWTH_PER_HARVEST,
    ),
  })),
  withMethods((store) => {
    const harvestTimers = new Set<ReturnType<typeof setTimeout>>();
    const recoveryTimers = new Set<ReturnType<typeof setTimeout>>();
    inject(DestroyRef).onDestroy(() => {
      for (const timer of harvestTimers) clearTimeout(timer);
      for (const timer of recoveryTimers) clearTimeout(timer);
    });
    const patchTree = (
      changes: Partial<DemoTreeCultivation>,
      state: Partial<ProgressState> = {},
      treeId = store.activeDemoTreeId(),
    ): void => {
      patchState(store, {
        ...state,
        demoTrees: {
          ...store.demoTrees(),
          [treeId]: { ...store.demoTrees()[treeId], ...changes },
        },
      });
    };
    const creditStepLight = (steps: number, day: string): void => {
      const earned = store.lightEarnedOn() === day ? store.lightEarnedToday() : 0;
      const eligible = Math.min(steps, DAILY_LIGHT_ENERGY_LIMIT);
      const light = Math.max(0, eligible - earned);
      patchState(store, {
        todaySteps: steps,
        todayStepsDay: day,
        inventory: { ...store.inventory(), lightEnergy: store.inventory().lightEnergy + light },
        lightEarnedOn: day,
        lightEarnedToday: earned + light,
        totalRecordedLightEnergy: store.totalRecordedLightEnergy() + light,
      });
    };
    return {
      reconcileCmsHarvest(treeId: string, amount: number, version: number): void {
        const tree = store.demoTrees()[treeId]; if (!tree || !tree.harvestCount) return;
        const previous = tree.harvestAwardPoints ?? DEMO_HARVEST_POINTS;
        if (previous === amount && tree.harvestVersion === version) return;
        patchTree({ harvestVersion: version, harvestAwardPoints: amount },
          { demoTreePoints: Math.max(0, store.demoTreePoints() + amount - previous) }, treeId);
      },
      ensureCmsTrees(trees: readonly HomeTree[], demo: boolean): void {
        let changed = false; const next = { ...store.demoTrees() };
        const template = createDemoTrees()['demo-tree'];
        for (const site of trees) {
          const existing = next[site.id];
          if (!existing) { next[site.id] = { ...template, planted: !site.empty, growth: demo ? site.growth : 0, site }; changed = true; }
          else if (!existing.site || (!existing.planted && JSON.stringify(existing.site) !== JSON.stringify(site))) {
            next[site.id] = { ...existing, site }; changed = true;
          }
        }
        if (changed) patchState(store, { demoTrees: next });
      },
      replaceProgress(state: ProgressState): void {
        for (const timer of harvestTimers) clearTimeout(timer);
        for (const timer of recoveryTimers) clearTimeout(timer);
        harvestTimers.clear();
        recoveryTimers.clear();
        patchState(store, state);
      },
      recoverHarvestedTrees(): void {
        for (const [id, tree] of Object.entries(store.demoTrees())) {
          if (tree.harvestedAt !== null && tree.harvestCount > 0 &&
              Date.now() - tree.harvestedAt >= DEMO_HARVEST_RECOVERY_DURATION_MS) {
            patchTree({ planted: false, harvestedOn: null, growth: 0, weedIds: [],
              weedDebuff: false, plantedAt: Date.now(), lastWateredAt: null,
              fertilizedOn: null, fertilizerExpiresAt: null, growthRemainder: 0,
              harvestCount: 0, harvestStartedAt: null, harvestedAt: null }, {}, id);
          }
        }
      },
      canVisitDemoTree(treeId: string): boolean {
        const tree = store.demoTrees()[treeId];
        const day = taipeiDay();
        return (
          !!tree && tree.harvestCount === 0 && tree.harvestedOn !== day && tree.visitedOn !== day
        );
      },
      markDemoTreeVisited(treeId: string): boolean {
        if (!store.demoTrees()[treeId]) {
          patchState(store, { cultivationError: '找不到這個種植點，無法完成造訪。' });
          return false;
        }
        patchTree({ visitedOn: taipeiDay() }, { demoDay: taipeiDay() }, treeId);
        return true;
      },
      grantWalkSeed(species: string, seedTypeId: string, version: number, origin?: SeedOrigin): void {
        patchState(store, {
          mysterySeeds: [...store.mysterySeeds(), { id: crypto.randomUUID(), species, seedTypeId, version, ...(origin ? { origin } : {}) }],
          inventory: { ...store.inventory(), seeds: store.inventory().seeds + 1 },
        });
      },
      plantDemoSeed(nickName = '我的小樹', seedTypeId?: string, inventorySeedId?: string): boolean {
        const name = nickName.trim();
        if (!name || name.length > 40) {
          patchState(store, { cultivationError: '請輸入 1 至 40 字的小樹名稱。' }); return false;
        }
        const pools = cmsPublication().config?.seedTypes ?? DEFAULT_SEED_TYPES;
        const genericCount = Math.max(0, store.inventory().seeds - store.mysterySeeds().length);
        const acquired = inventorySeedId
          ? store.mysterySeeds().find(s => s.id === inventorySeedId)
          : store.mysterySeeds()[0];
        if (inventorySeedId && !acquired &&
            !Array.from({ length: genericCount }, (_, i) => `legacy-seed-${i}`).includes(inventorySeedId)) {
          patchState(store, { cultivationError: '這顆種子已不在背包中，請重新選擇。' }); return false;
        }
        const seed = pools.find(s => s.id === (seedTypeId ?? pools.find(p => p.enabled)?.id) && s.enabled);
        if (!acquired && !seed) { patchState(store, { cultivationError: '此種子類型暫停種植。' }); return false; }

        if (store.demoTreePlanted()) {
          patchState(store, { cultivationError: '種子只能用在空的種植點。' });
          return false;
        }
        if (store.inventory().seeds < 1) {
          patchState(store, { cultivationError: '種子已用完，無法種植。' });
          return false;
        }
        const plantedAt = Date.now();
        patchTree(
          {
            planted: true,
            nickName: name,
            species: acquired?.species ?? drawSpecies(seed!, crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296),
            seedTypeId: acquired?.seedTypeId ?? seed!.id,
            plantingVersion: acquired?.version ?? cmsPublication().version,
            harvestedOn: null,
            growth: 0,
            weedIds: [],
            weedDebuff: false,
            plantedAt,
            lastWateredAt: null,
            fertilizedOn: null,
            fertilizerExpiresAt: null,
            growthRemainder: 0,
            harvestCount: 0,
            harvestStartedAt: null,
            harvestedAt: null,
          },
          {
            mysterySeeds: acquired ? store.mysterySeeds().filter(s => s.id !== acquired.id) : store.mysterySeeds(),
            inventory: { ...store.inventory(), seeds: store.inventory().seeds - 1 },
            cultivationError: null,
          },
        );
        return true;
      },
      selectDemoTree(treeId: string): boolean {
        if (!store.demoTrees()[treeId]) {
          patchState(store, { cultivationError: '找不到這棵小樹的培育資料。' });
          return false;
        }
        patchState(store, { activeDemoTreeId: treeId, cultivationError: null });
        return true;
      },
      pullDemoWeed(weedId: number): boolean {
        if (!TREE_WEEDS_ENABLED) return false;
        const weeds = store.demoTreeWeeds();
        if (!Number.isSafeInteger(weedId) || !weeds.includes(weedId)) {
          patchState(store, { cultivationError: '找不到這株雜草，請重新選擇。' });
          return false;
        }
        const remaining = weeds.filter((id) => id !== weedId);
        patchTree(
          {
            weedIds: remaining,
            weedDebuff: remaining.length > 0 && store.demoWeedPenaltyActive(),
          },
          { cultivationError: null },
        );
        return true;
      },
      startDemoHarvest(): boolean {
        let error: string | null = null;
        if (store.demoTreeHarvested()) {
          error = '這棵小樹已收成，不能重複收成。';
        } else if (store.demoHarvestStartedAt() !== null) {
          error = '果實正在落地，請稍候。';
        } else if (!store.demoFruitReady()) {
          error = '成長值尚未達到收成門檻。';
        }
        if (error) {
          patchState(store, { cultivationError: error });
          return false;
        }
        const treeId = store.activeDemoTreeId();
        const harvestPoints = cmsPublication().config?.harvestPoints ?? DEMO_HARVEST_POINTS;
        patchTree(
          { harvestStartedAt: Date.now(), harvestVersion: cmsPublication().version, harvestAwardPoints: harvestPoints },
          {
            cultivationError: null,
          },
        );
        const timer = setTimeout(() => {
          harvestTimers.delete(timer);
          const harvestedAt = Date.now();
          patchTree(
            {
              harvestCount: store.demoTrees()[treeId].harvestCount + 1,
              harvestStartedAt: null,
              harvestedOn: taipeiDay(),
              harvestedAt,
            },
            {
              demoTreePoints: store.demoTreePoints() + harvestPoints,
            },
            treeId,
          );
          const recoveryTimer = setTimeout(() => {
            recoveryTimers.delete(recoveryTimer);
            const tree = store.demoTrees()[treeId];
            if (!tree || tree.harvestCount === 0 || tree.harvestedAt !== harvestedAt) return;
            patchTree(
              {
                planted: false,
                harvestedOn: null,
                growth: 0,
                weedIds: [],
                weedDebuff: false,
                plantedAt: Date.now(),
                lastWateredAt: null,
                fertilizedOn: null,
                fertilizerExpiresAt: null,
                growthRemainder: 0,
                harvestCount: 0,
                harvestStartedAt: null,
                harvestedAt: null,
              },
              { demoDay: taipeiDay() },
              treeId,
            );
          }, DEMO_HARVEST_RECOVERY_DURATION_MS);
          recoveryTimers.add(recoveryTimer);
        }, DEMO_HARVEST_DURATION_MS);
        harvestTimers.add(timer);
        return true;
      },
      isDemoFertilizerActive(): boolean {
        return fertilizerActive(store.demoFertilizerExpiresAt());
      },
      maximumDemoLightAllocation(): number {
        return store.demoTreePlanted() &&
          store.demoTreeGrowth() < store.demoGrowthTarget() &&
          !store.demoTreeHarvested()
          ? store.inventory().lightEnergy
          : 0;
      },
      maximumDemoWaterAllocation(): number {
        return store.demoTreePlanted() &&
          store.demoTreeGrowth() < store.demoGrowthTarget() &&
          !store.demoTreeHarvested()
          ? store.inventory().waterDrops
          : 0;
      },
      activateDemoFertilizer(): boolean {
        let error: string | null = null;
        if (!store.demoTreePlanted()) {
          error = '請先使用種子，再為小樹施肥。';
        } else if (store.demoTreeHarvested()) {
          error = '這棵小樹已收成，不能再施肥。';
        } else if (fertilizerActive(store.demoFertilizerExpiresAt())) {
          error = '肥料加乘仍在生效，不必重複施肥。';
        } else if (store.demoTreeFertilizedOn() === taipeiDay()) {
          error = '這棵樹今天已使用肥料。';
        } else if (store.inventory().fertilizer < 1) {
          error = '肥料庫存不足。';
        } else if (store.demoTreeGrowth() >= store.demoGrowthTarget()) {
          error = '果實已成熟，無須再施肥。';
        }
        if (error) {
          patchState(store, { cultivationError: error });
          return false;
        }
        patchTree(
          {
            fertilizedOn: taipeiDay(),
            fertilizerExpiresAt: Date.now() + FERTILIZER_DURATION_MS,
          },
          {
            inventory: { ...store.inventory(), fertilizer: store.inventory().fertilizer - 1 },
            cultivationError: null,
          },
        );
        return true;
      },
      cultivateDemoTree(allocation: CultivationAllocation): boolean {
        const inventory = store.inventory();
        const day = taipeiDay();
        const active = fertilizerActive(store.demoFertilizerExpiresAt());
        const fertilized = active || allocation.fertilizer;
        const remainder = store.demoGrowthRemainder();
        const waterDrops = waterDropCount(allocation.water);
        const growth = cultivationGrowth(
          { ...allocation, fertilizer: fertilized },
          remainder,
          store.demoWeedPenaltyActive(),
        );
        let error: string | null = null;
        if (!Number.isSafeInteger(allocation.lightEnergy) || allocation.lightEnergy < 0) {
          error = '光能必須是非負整數。';
        } else if (!Number.isSafeInteger(waterDrops) || waterDrops < 0) {
          error = '水滴必須是非負整數。';
        } else if (!store.demoTreePlanted()) {
          error = '請先使用種子，再投入培養資源。';
        } else if (store.demoTreeHarvested()) {
          error = '這棵小樹已收成，不能再投入資源。';
        } else if (store.demoTreeGrowth() >= store.demoGrowthTarget()) {
          error = '果實已成熟，請停止投餵並收成。';
        } else if (
          allocation.lightEnergy > inventory.lightEnergy ||
          waterDrops > inventory.waterDrops ||
          (allocation.fertilizer && inventory.fertilizer < 1)
        ) {
          error = '資源不足，請重新調整投入數量。';
        } else if (allocation.fertilizer && (active || store.demoTreeFertilizedOn() === day)) {
          error = '肥料仍在生效或今天已施肥，無須重複使用。';
        } else if (growth.base <= 0) {
          error = '請投入光能或一滴水，才能培養小樹。';
        }
        if (error) {
          patchState(store, { cultivationError: error });
          return false;
        }
        const nextGrowth = Math.min(
          store.demoGrowthTarget(),
          store.demoTreeGrowth() + growth.total,
        );
        patchTree(
          {
            growth: nextGrowth,
            lastWateredAt: waterDrops > 0 ? Date.now() : store.demoTreeLastWateredAt(),
            fertilizedOn: allocation.fertilizer ? day : store.demoTreeFertilizedOn(),
            fertilizerExpiresAt: allocation.fertilizer
              ? Date.now() + FERTILIZER_DURATION_MS
              : store.demoFertilizerExpiresAt(),
            growthRemainder: nextGrowth === store.demoGrowthTarget() ? 0 : growth.remainder,
          },
          {
            inventory: {
              ...inventory,
              lightEnergy: inventory.lightEnergy - allocation.lightEnergy,
              waterDrops: inventory.waterDrops - waterDrops,
              fertilizer: inventory.fertilizer - (allocation.fertilizer ? 1 : 0),
            },
            cultivationError: null,
          },
        );
        return true;
      },
      hasClaimedDemoSupplyToday(stationId: string): boolean {
        return store.demoSupplyStationClaimedOn()[stationId] === taipeiDay();
      },
      grantDemoSupply(stationId: string, reward: SupplyReward): boolean {
        if (!stationId) {
          patchState(store, { cultivationError: '補給站識別無效，無法領取資源。' });
          return false;
        }
        const claimedOn = store.demoSupplyStationClaimedOn();
        const day = taipeiDay();
        if (claimedOn[stationId] === day) {
          patchState(store, { cultivationError: '本日已領取成功，不可重複領取。' });
          return false;
        }
        if (
          !Number.isSafeInteger(reward.amount) ||
          reward.amount <= 0 ||
          (reward.resource !== 'water' && reward.resource !== 'fertilizer')
        ) {
          patchState(store, { cultivationError: '補給資源設定無效，請確認資源種類與正整數數量。' });
          return false;
        }
        const key = reward.resource === 'water' ? 'waterDrops' : 'fertilizer';
        const amount = store.inventory()[key] + reward.amount;
        if (!Number.isSafeInteger(amount)) {
          patchState(store, { cultivationError: '補給資源超出可儲存的數量。' });
          return false;
        }
        patchState(store, {
          inventory: { ...store.inventory(), [key]: amount },
          demoSupplyStationClaimedOn: { ...claimedOn, [stationId]: day },
          cultivationError: null,
        });
        return true;
      },
      applyTaskInventory(inventory: { waterDrops: number; fertilizer: number }): void {
        patchState(store, {
          inventory: {
            ...store.inventory(),
            waterDrops: inventory.waterDrops,
            fertilizer: inventory.fertilizer,
          },
        });
      },
      /**將步數轉為光能 */
      transformStepsToLightEnergy: () => {
        const day = taipeiDay();
        creditStepLight(store.todayStepsDay() === day ? store.todaySteps() : 0, day);
      },
      /**增加步數 */
      addSteps: (steps: number) => {
        if (!Number.isSafeInteger(steps) || steps <= 0) {
          return;
        }

        const day = taipeiDay();
        creditStepLight((store.todayStepsDay() === day ? store.todaySteps() : 0) + steps, day);
        patchState(store, { totalRecordedSteps: store.totalRecordedSteps() + steps });
      },
    };
  }),
  withHooks((store) => ({
    onInit() {
      const timer = setInterval(() => {
        const day = taipeiDay();
        if (day !== store.demoDay()) patchState(store, { demoDay: day });
        store.recoverHarvestedTrees();
        if (day !== store.todayStepsDay()) {
          patchState(store, { todaySteps: 0, todayStepsDay: day,
            lightEarnedOn: day, lightEarnedToday: 0 });
        }
      }, 60_000);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    },
  })),
);

export type ProgressState = {
  mysterySeeds: MysterySeed[];
  demoDay: string;
  todaySteps: number;
  todayStepsDay: string;
  lightEarnedOn: string | null;
  lightEarnedToday: number;
  totalRecordedSteps: number;
  totalRecordedLightEnergy: number;
  activeDemoTreeId: string;
  demoTrees: Record<string, DemoTreeCultivation>;
  demoSupplyStationClaimedOn: Record<string, string>;
  demoTreePoints: number;
  cultivationError: string | null;
  inventory: {
    lightEnergy: number;
    waterDrops: number;
    fertilizer: number;
    seeds: number;
  };
};
