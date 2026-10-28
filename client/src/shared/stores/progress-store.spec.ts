import { cmsPublication } from "../models/cms-publication";
import { homeTreesWithProgress } from "../../features/home/home-tree-recommendations";
import { TREE_WEEDS_ENABLED } from '../../environments/environment-dev';
import { patchState } from '@ngrx/signals';
import { TestBed } from '@angular/core/testing';
import { ProgressStore } from './progress-store';
import {
  DEMO_HARVEST_DURATION_MS,
  DEMO_HARVEST_RECOVERY_DURATION_MS,
} from '../models/tree-cultivation';
import {
  demoPlantingSpots,
  destination,
  TREE_GROWTH_PER_HARVEST,
} from '../../environments/environment-dev';

const target = TREE_GROWTH_PER_HARVEST;
const nearTargetWater = (target - 1) * 15;
const fertilizedWater = Math.ceil(target * 12.5);

describe('ProgressStore cultivation Demo', () => {
  it('requires a valid player name, snapshots one draw and hides its species while it is a seed', () => {
    const store = setup(); const id = demoPlantingSpots[0].id;
    store.selectDemoTree(id);
    const inventory = store.inventory();
    expect(store.plantDemoSeed('   ')).toBe(false);
    expect(store.plantDemoSeed('x'.repeat(41))).toBe(false);
    expect(store.plantDemoSeed('小樹', 'disabled-pool')).toBe(false);
    expect(store.inventory()).toBe(inventory);
    expect(store.plantDemoSeed('  我的旅行樹  ', 'mystery')).toBe(true);
    const tree = store.demoTrees()[id];
    expect(tree).toMatchObject({nickName: '我的旅行樹', seedTypeId: 'mystery', plantingVersion: 0});
    const planted = homeTreesWithProgress(store.demoTrees()).find(t => t.id === id)!;
    expect(planted.nickName).toBe('我的旅行樹'); expect(planted.species).toBe('神秘樹種');
    patchState(store as never, {demoTrees: {...store.demoTrees(), [id]: {...tree, growth: target * 0.3}}});
    expect(homeTreesWithProgress(store.demoTrees()).find(t => t.id === id)!.species).toBe(tree.species);
    store.selectDemoTree('tree-1'); store.selectDemoTree(id);
    expect(store.demoTrees()[id].species).toBe(tree.species);
    expect(store.inventory().seeds).toBe(inventory.seeds - 1);
  });

  it.skipIf(TREE_WEEDS_ENABLED)(
    'pauses weeds, pulling and the persisted debuff without reducing nutrient absorption',
    () => {
      const store = setup();
      store.selectDemoTree('tree-2');
      patchState(store as never, {
        demoTrees: {
          ...store.demoTrees(),
          'tree-2': { ...store.demoTrees()['tree-2'], weedDebuff: true },
        },
      });
      const before = store.demoTrees()['tree-2'];
      const inventory = store.inventory();
      expect(before.weedIds.length).toBeGreaterThan(0);
      expect(store.demoTreeWeeds()).toEqual([]);
      expect(store.demoWeedPenaltyActive()).toBe(false);
      expect(store.pullDemoWeed(0)).toBe(false);
      expect(store.demoTrees()['tree-2']).toBe(before);
      expect(store.inventory()).toBe(inventory);
      store.cultivateDemoTree({ lightEnergy: 150, water: 0, fertilizer: false });
      expect(store.demoTreeGrowth()).toBe(before.growth + 1);
      expect(store.demoGrowthRemainder()).toBe(0);
    },
  );
  afterEach(() => {
    cmsPublication.set({config: null, managed: false, version: 0});
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function setup() {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(ProgressStore);
    return store;
  }

  function mature(store: InstanceType<typeof ProgressStore>): void {
    store.applyTaskInventory({ waterDrops: target * 15, fertilizer: 5 });
    expect(store.cultivateDemoTree({ lightEnergy: 0, water: target * 15, fertilizer: false })).toBe(
      true,
    );
  }

  it('plants one seed only at an empty spot and preserves planting across tree switches', () => {
    const store = setup();
    const inventory = store.inventory();
    store.selectDemoTree(demoPlantingSpots[0].id);
    expect(store.demoTreePlanted()).toBe(false);
    expect(store.maximumDemoLightAllocation()).toBe(0);
    expect(store.maximumDemoWaterAllocation()).toBe(0);
    expect(store.activateDemoFertilizer()).toBe(false);
    expect(store.cultivateDemoTree({ lightEnergy: 150, water: 0, fertilizer: false })).toBe(false);
    expect(store.inventory()).toBe(inventory);
    expect(store.plantDemoSeed()).toBe(true);
    expect(store.demoTreePlanted()).toBe(true);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.inventory()).toEqual({ ...inventory, seeds: inventory.seeds - 1 });
    const plantedInventory = store.inventory();
    expect(store.plantDemoSeed()).toBe(false);
    expect(store.cultivationError()).toContain('空的種植點');
    expect(store.inventory()).toBe(plantedInventory);
    expect(store.cultivateDemoTree({ lightEnergy: 150, water: 0, fertilizer: false })).toBe(true);
    store.selectDemoTree('tree-1');
    store.selectDemoTree(demoPlantingSpots[0].id);
    expect(store.demoTreePlanted()).toBe(true);
    expect(store.demoTreeGrowth()).toBe(1);
    store.selectDemoTree(demoPlantingSpots[1].id);
    expect(store.plantDemoSeed()).toBe(false);
    expect(store.cultivationError()).toContain('種子已用完');
    expect(store.demoTreePlanted()).toBe(false);
    expect(store.demoTreeGrowth()).toBe(0);
  });

  it('excludes completed destinations until the next Taipei day without consuming unvisited spots', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T15:59:30Z'));
    const store = setup();
    const id = demoPlantingSpots[0].id;
    expect(store.canVisitDemoTree(id)).toBe(true);
    expect(store.markDemoTreeVisited(id)).toBe(true);
    expect(store.canVisitDemoTree(id)).toBe(false);
    expect(store.unavailableDemoTreeIds()).toContain(id);
    expect(store.canVisitDemoTree('tree-5')).toBe(true);
    expect(store.demoTrees()[id].planted).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(store.canVisitDemoTree(id)).toBe(true);
    expect(store.unavailableDemoTreeIds()).not.toContain(id);
  });

  it('excludes a harvested tree during recovery, then restores it to an empty planting point', () => {
    vi.useFakeTimers();
    const store = setup();
    const treeId = 'tree-6';
    store.selectDemoTree(treeId);
    expect(store.canVisitDemoTree(treeId)).toBe(true);
    expect(store.startDemoHarvest()).toBe(true);
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    const harvestedAt = store.demoTreeHarvestedAt();
    expect(harvestedAt).toBe(Date.now());
    expect(store.canVisitDemoTree(treeId)).toBe(false);
    expect(store.unavailableDemoTreeIds()).toContain(treeId);

    vi.advanceTimersByTime(DEMO_HARVEST_RECOVERY_DURATION_MS - 1);
    expect(store.demoTreePlanted()).toBe(true);
    expect(store.demoTreeHarvested()).toBe(true);
    expect(store.canVisitDemoTree(treeId)).toBe(false);

    vi.advanceTimersByTime(1);
    expect(store.demoTreePlanted()).toBe(false);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoHarvestCount()).toBe(0);
    expect(store.demoTreeHarvestedAt()).toBeNull();
    expect(store.canVisitDemoTree(treeId)).toBe(true);
    expect(store.unavailableDemoTreeIds()).not.toContain(treeId);
    expect(store.plantDemoSeed()).toBe(true);
    expect(store.demoTreePlanted()).toBe(true);
  });

  it('rejects supply inventory overflow without changing balances', () => {
    const store = setup();
    store.applyTaskInventory({ waterDrops: Number.MAX_SAFE_INTEGER, fertilizer: 5 });
    const inventory = store.inventory();
    expect(store.grantDemoSupply('station-overflow', { resource: 'water', amount: 1 })).toBe(false);
    expect(store.inventory()).toBe(inventory);
    expect(store.cultivationError()).toContain('超出');
  });

  it('limits each supply station to one claim per Taipei day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T15:59:59.000Z'));
    const store = setup();
    const reward = { resource: 'water' as const, amount: 4 };
    const originalInventory = store.inventory();

    expect(store.hasClaimedDemoSupplyToday('station-a')).toBe(false);
    expect(store.grantDemoSupply('station-a', reward)).toBe(true);
    expect(store.hasClaimedDemoSupplyToday('station-a')).toBe(true);
    const creditedInventory = store.inventory();
    expect(creditedInventory.waterDrops).toBe(originalInventory.waterDrops + reward.amount);

    expect(store.grantDemoSupply('station-a', reward)).toBe(false);
    expect(store.inventory()).toBe(creditedInventory);
    expect(store.cultivationError()).toBe('本日已領取成功，不可重複領取。');

    expect(store.hasClaimedDemoSupplyToday('station-b')).toBe(false);
    expect(store.grantDemoSupply('station-b', reward)).toBe(true);
    expect(store.inventory().waterDrops).toBe(creditedInventory.waterDrops + reward.amount);

    vi.setSystemTime(new Date('2026-10-16T16:00:00.000Z'));
    expect(store.hasClaimedDemoSupplyToday('station-a')).toBe(false);
    expect(store.grantDemoSupply('station-a', reward)).toBe(true);
    expect(store.inventory().waterDrops).toBe(creditedInventory.waterDrops + reward.amount * 2);
  });
  it('records watering per tree only after a successful allocation spending water', () => {
    vi.useFakeTimers();
    const store = setup();
    const plantedAt = store.demoTreePlantedAt();
    expect(store.demoTreeLastWateredAt()).toBeNull();
    store.cultivateDemoTree({ lightEnergy: 1, water: 0, fertilizer: false });
    store.activateDemoFertilizer();
    expect(store.demoTreeLastWateredAt()).toBeNull();
    store.cultivateDemoTree({ lightEnergy: 6000, water: 1, fertilizer: false });
    expect(store.demoTreeLastWateredAt()).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false })).toBe(true);
    const wateredAt = Date.now();
    expect(store.demoTreeLastWateredAt()).toBe(wateredAt);
    expect(store.demoTreePlantedAt()).toBe(plantedAt);
    vi.advanceTimersByTime(1000);
    store.cultivateDemoTree({ lightEnergy: 1, water: 0, fertilizer: false });
    expect(store.demoTreeLastWateredAt()).toBe(wateredAt);
    store.selectDemoTree('tree-4');
    expect(store.demoTreeLastWateredAt()).toBeNull();
    store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false });
    expect(store.demoTreeLastWateredAt()).toBe(Date.now());
    store.selectDemoTree('demo-tree');
    expect(store.demoTreeLastWateredAt()).toBe(wateredAt);
    store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false });
    expect(store.demoTreeLastWateredAt()).toBe(Date.now());
    vi.advanceTimersByTime(1000);
    store.applyTaskInventory({ waterDrops: 0, fertilizer: 0 });
    expect(store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false })).toBe(false);
    expect(store.demoTreeLastWateredAt()).toBe(Date.now() - 1000);
  });

  it('seeds every map tree with growth and a mix of expiring fertilizer effects', () => {
    vi.useFakeTimers();
    const store = setup();
    for (const { properties } of destination.features) {
      expect(store.selectDemoTree(properties.treeId)).toBe(true);
      expect(store.demoTreeGrowth()).toBe(properties.growth);
      expect(store.isDemoFertilizerActive()).toBe(properties.fertilizerRemainingMs > 0);
    }
    store.selectDemoTree('tree-5');
    const inventory = store.inventory();
    expect(store.activateDemoFertilizer()).toBe(false);
    expect(store.inventory()).toEqual(inventory);
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    expect(store.isDemoFertilizerActive()).toBe(false);
  });

  it.runIf(TREE_WEEDS_ENABLED)(
    'seeds each tree weeds independently and restores seeds only when the store reloads',
    () => {
      const store = setup();
      for (const { properties } of destination.features) {
        store.selectDemoTree(properties.treeId);
        expect(store.demoTreeWeeds()).toEqual(
          Array.from({ length: properties.weedCount }, (_, index) => index),
        );
      }
      store.selectDemoTree('tree-2');
      const inventory = store.inventory();
      const growth = store.demoTreeGrowth();
      expect(store.pullDemoWeed(0)).toBe(true);
      expect(store.pullDemoWeed(0)).toBe(false);
      expect(store.cultivationError()).toContain('找不到');
      expect(store.demoTreeWeeds()).toHaveLength(11);
      expect(store.demoTreeGrowth()).toBe(growth);
      expect(store.inventory()).toBe(inventory);
      expect(store.demoTreePoints()).toBe(0);
      store.selectDemoTree('tree-1');
      expect(store.demoTreeWeeds()).toHaveLength(6);
      store.selectDemoTree('tree-2');
      expect(store.demoTreeWeeds()).toHaveLength(11);
      TestBed.resetTestingModule();
      const reloaded = setup();
      reloaded.selectDemoTree('tree-2');
      expect(reloaded.demoTreeWeeds()).toHaveLength(12);
    },
  );

  it.runIf(TREE_WEEDS_ENABLED)(
    'keeps the weed debuff below ten and releases it only at zero without changing fractions',
    () => {
      const store = setup();
      store.selectDemoTree('tree-2');
      const growth = store.demoTreeGrowth();
      store.pullDemoWeed(0);
      store.pullDemoWeed(1);
      expect(store.demoTreeWeeds()).toHaveLength(10);
      expect(store.demoWeedPenaltyActive()).toBe(true);
      store.cultivateDemoTree({ lightEnergy: 150, water: 0, fertilizer: false });
      expect(store.demoTreeGrowth()).toBe(growth);
      expect(store.demoGrowthRemainder()).toBe(6750);
      store.pullDemoWeed(2);
      expect(store.demoWeedPenaltyActive()).toBe(true);
      expect(store.demoGrowthRemainder()).toBe(6750);
      store.cultivateDemoTree({ lightEnergy: 150, water: 0, fertilizer: false });
      expect(store.demoTreeGrowth()).toBe(growth + 1);
      expect(store.demoGrowthRemainder()).toBe(6000);
      store.selectDemoTree('tree-7');
      expect(store.demoTreeWeeds()).toHaveLength(9);
      expect(store.demoWeedPenaltyActive()).toBe(false);
      store.selectDemoTree('tree-2');
      expect(store.demoWeedPenaltyActive()).toBe(true);
      while (store.demoTreeWeeds().length > 1) {
        store.pullDemoWeed(store.demoTreeWeeds()[0]);
      }
      expect(store.demoWeedPenaltyActive()).toBe(true);
      store.pullDemoWeed(store.demoTreeWeeds()[0]);
      expect(store.demoTreeWeeds()).toHaveLength(0);
      expect(store.demoWeedPenaltyActive()).toBe(false);
      expect(store.demoGrowthRemainder()).toBe(6000);
      store.cultivateDemoTree({ lightEnergy: 150, water: 0, fertilizer: false });
      expect(store.demoTreeGrowth()).toBe(growth + 2);
      expect(store.demoGrowthRemainder()).toBe(6000);
    },
  );

  it.runIf(TREE_WEEDS_ENABLED)(
    'multiplies active fertilizer by the weed penalty, with no single-unit rounding loss',
    () => {
      const store = setup();
      store.selectDemoTree('tree-2');
      const growth = store.demoTreeGrowth();
      expect(store.activateDemoFertilizer()).toBe(true);
      for (let index = 0; index < 1250; index++) {
        expect(store.cultivateDemoTree({ lightEnergy: 1, water: 0, fertilizer: false })).toBe(true);
      }
      expect(store.demoTreeGrowth()).toBe(growth + 9);
      expect(store.demoGrowthRemainder()).toBe(0);
    },
  );

  it('preserves each tree independently while sharing resource inventory', () => {
    const store = setup();
    store.selectDemoTree('tree-4');
    const growth = store.demoTreeGrowth();
    expect(store.activateDemoFertilizer()).toBe(true);
    expect(store.cultivateDemoTree({ lightEnergy: 125, water: 0, fertilizer: false })).toBe(true);
    const expiresAt = store.demoFertilizerExpiresAt();
    store.selectDemoTree('tree-8');
    expect(store.isDemoFertilizerActive()).toBe(false);
    expect(store.demoTreeGrowth()).toBe(destination.features[7].properties.growth);
    store.selectDemoTree('tree-4');
    expect(store.demoTreeGrowth()).toBe(growth + 1);
    expect(store.demoFertilizerExpiresAt()).toBe(expiresAt);
    expect(store.inventory().lightEnergy).toBe(5946 - 125);
    expect(store.inventory().fertilizer).toBe(4);
    expect(store.selectDemoTree('missing')).toBe(false);
    expect(store.activeDemoTreeId()).toBe('tree-4');
    expect(store.cultivationError()).toBeTruthy();
  });

  it('credits a falling harvest to its original tree even after switching trees', () => {
    vi.useFakeTimers();
    const store = setup();
    store.selectDemoTree('tree-6');
    expect(store.startDemoHarvest()).toBe(true);
    store.selectDemoTree('tree-9');
    const growth = store.demoTreeGrowth();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreeHarvested()).toBe(false);
    expect(store.demoTreeGrowth()).toBe(growth);
    expect(store.demoTreePoints()).toBe(50);
    store.selectDemoTree('tree-6');
    expect(store.demoTreeHarvested()).toBe(true);
    expect(store.startDemoHarvest()).toBe(false);
  });

  it('allows all ten map trees to harvest once on the same day without duplicate credits', () => {
    vi.useFakeTimers();
    const store = setup();
    for (const { properties } of destination.features) {
      store.selectDemoTree(properties.treeId);
      const multiplier =
        (store.isDemoFertilizerActive() ? 1.2 : 1) * (store.demoWeedPenaltyActive() ? 0.9 : 1);
      const water = Math.ceil(((target - store.demoTreeGrowth()) * 15) / multiplier);
      if (water > 0) {
        store.applyTaskInventory({ waterDrops: water, fertilizer: 5 });
        expect(store.cultivateDemoTree({ lightEnergy: 0, water, fertilizer: false })).toBe(true);
      }
      expect(store.demoFruitReady()).toBe(true);
      expect(store.startDemoHarvest()).toBe(true);
      expect(store.startDemoHarvest()).toBe(false);
    }
    expect(store.demoTreePoints()).toBe(0);
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreePoints()).toBe(500);
    for (const { properties } of destination.features) {
      store.selectDemoTree(properties.treeId);
      expect(store.demoHarvestCount()).toBe(1);
      expect(store.startDemoHarvest()).toBe(false);
    }
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreePoints()).toBe(500);
  });

  it('deducts all resources and grows the tree atomically', () => {
    const store = setup();
    expect(store.cultivateDemoTree({ lightEnergy: 490, water: true, fertilizer: true })).toBe(true);
    expect(store.inventory()).toEqual({
      lightEnergy: 5456,
      waterDrops: 776,
      fertilizer: 4,
      seeds: 1,
    });
    expect(store.demoTreeGrowth()).toBe(4);
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(store.cultivationError()).toBeNull();
  });

  it.each([-1, 0.5, NaN, Infinity, 6000])(
    'rejects invalid or unaffordable light %s without spending',
    (lightEnergy) => {
      const store = setup();
      const before = store.inventory();
      expect(store.cultivateDemoTree({ lightEnergy, water: true, fertilizer: true })).toBe(false);
      expect(store.inventory()).toEqual(before);
      expect(store.demoTreeGrowth()).toBe(0);
      expect(store.cultivationError()).toBeTruthy();
    },
  );

  it('does not consume fertilizer without a base allocation', () => {
    const store = setup();
    expect(store.cultivateDemoTree({ lightEnergy: 0, water: false, fertilizer: true })).toBe(false);
    expect(store.inventory().fertilizer).toBe(5);
  });

  it('rejects unavailable water and fertilizer', () => {
    const store = setup();
    store.applyTaskInventory({ waterDrops: 0, fertilizer: 0 });
    expect(store.cultivateDemoTree({ lightEnergy: 10, water: true, fertilizer: false })).toBe(
      false,
    );
    expect(store.cultivateDemoTree({ lightEnergy: 10, water: false, fertilizer: true })).toBe(
      false,
    );
    expect(store.inventory().lightEnergy).toBe(5946);
  });

  it('allows fertilizer once per Taipei day and rejects repeated uses atomically', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T15:59:00Z'));
    const store = setup();
    const allocation = { lightEnergy: 10, water: false, fertilizer: true };
    expect(store.cultivateDemoTree(allocation)).toBe(true);
    const before = store.inventory();
    expect(store.cultivateDemoTree(allocation)).toBe(false);
    expect(store.inventory()).toEqual(before);
    vi.setSystemTime(new Date('2026-10-15T15:59:00Z'));
    expect(store.cultivateDemoTree(allocation)).toBe(true);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(1200);
  });

  it('applies a rolling 24-hour bonus to every light and water feeding, including after midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T15:59:00Z'));
    const store = setup();
    expect(store.activateDemoFertilizer()).toBe(true);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.inventory().fertilizer).toBe(4);
    expect(store.cultivateDemoTree({ lightEnergy: 150, water: false, fertilizer: false })).toBe(
      true,
    );
    expect(store.demoTreeGrowth()).toBe(1);
    expect(store.demoGrowthRemainder()).toBe(1500);
    vi.setSystemTime(new Date('2026-10-14T16:00:00Z'));
    expect(store.isDemoFertilizerActive()).toBe(true);
    expect(store.activateDemoFertilizer()).toBe(false);
    expect(store.inventory().fertilizer).toBe(4);
    expect(store.cultivateDemoTree({ lightEnergy: 0, water: true, fertilizer: false })).toBe(true);
    expect(store.demoTreeGrowth()).toBe(1);
    expect(store.demoGrowthRemainder()).toBe(2100);
    vi.setSystemTime(new Date('2026-10-15T15:59:00Z'));
    expect(store.isDemoFertilizerActive()).toBe(false);
    expect(store.cultivateDemoTree({ lightEnergy: 150, water: true, fertilizer: false })).toBe(
      true,
    );
    expect(store.demoTreeGrowth()).toBe(2);
    expect(store.demoGrowthRemainder()).toBe(2600);
    expect(store.activateDemoFertilizer()).toBe(true);
    expect(store.demoGrowthRemainder()).toBe(2600);
  });

  it('retains the 20% bonus across small feeding ticks', () => {
    const store = setup();
    store.activateDemoFertilizer();
    for (let i = 0; i < 125; i++) {
      expect(store.cultivateDemoTree({ lightEnergy: 1, water: false, fertilizer: false })).toBe(
        true,
      );
    }
    expect(store.demoTreeGrowth()).toBe(1);
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(store.inventory().lightEnergy).toBe(5821);
    expect(store.inventory().fertilizer).toBe(4);
  });

  it('allows the full affordable final allocation even with fertilizer and a fractional remainder', () => {
    const store = setup();
    store.applyTaskInventory({ waterDrops: nearTargetWater, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 0, water: nearTargetWater, fertilizer: false });
    store.activateDemoFertilizer();
    store.cultivateDemoTree({ lightEnergy: 4, water: false, fertilizer: false });
    const maximum = store.maximumDemoLightAllocation();
    expect(maximum).toBe(5942);
    expect(store.cultivateDemoTree({ lightEnergy: maximum, water: false, fertilizer: false })).toBe(
      true,
    );
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.inventory().lightEnergy).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(store.maximumDemoLightAllocation()).toBe(0);
  });

  it('rejects additional resource spending once the Demo milestone is already reached', () => {
    const store = setup();
    store.applyTaskInventory({ waterDrops: fertilizedWater, fertilizer: 5 });
    expect(
      store.cultivateDemoTree({ lightEnergy: 0, water: fertilizedWater, fertilizer: true }),
    ).toBe(true);
    expect(store.demoTreeGrowth()).toBe(target);
    const before = store.inventory();
    expect(store.cultivateDemoTree({ lightEnergy: 1, water: false, fertilizer: false })).toBe(
      false,
    );
    expect(store.inventory()).toEqual(before);
  });

  it('credits one light per eligible step up to the daily cap without consuming displayed steps', () => {
    const store = setup();
    store.addSteps(500);
    store.transformStepsToLightEnergy();
    expect(store.todaySteps()).toBe(15888 + 500);
    expect(store.inventory().lightEnergy).toBe(5946 + 7500);
    expect(store.lightEarnedToday()).toBe(7500);
    store.transformStepsToLightEnergy();
    store.addSteps(500);
    expect(store.inventory().lightEnergy).toBe(5946 + 7500);
    expect(store.demoTreeGrowth()).toBe(0);
  });

  it('resets the daily light allowance at Taipei midnight and never recredits spent light', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T15:59:00Z'));
    const store = setup();
    store.transformStepsToLightEnergy();
    store.cultivateDemoTree({ lightEnergy: 150, water: 0, fertilizer: false });
    store.transformStepsToLightEnergy();
    expect(store.inventory().lightEnergy).toBe(5946 + 7500 - 150);
    vi.setSystemTime(new Date('2026-10-14T16:00:00Z'));
    store.transformStepsToLightEnergy();
    expect(store.todaySteps()).toBe(0);
    expect(store.lightEarnedToday()).toBe(0);
    store.addSteps(500);
    expect(store.inventory().lightEnergy).toBe(5946 + 7500 - 150 + 500);
    expect(store.todaySteps()).toBe(500);
    store.transformStepsToLightEnergy();
    expect(store.lightEarnedToday()).toBe(500);
    store.addSteps(8000);
    expect(store.todaySteps()).toBe(8500);
    expect(store.lightEarnedToday()).toBe(7500);
    expect(store.inventory().lightEnergy).toBe(5946 + 15000 - 150);
  });

  it('keeps sub-point light progress across allocations and fertilizer activation', () => {
    const store = setup();
    expect(store.cultivateDemoTree({ lightEnergy: 149, water: 0, fertilizer: false })).toBe(true);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(7450);
    expect(store.inventory().lightEnergy).toBe(5797);
    expect(store.activateDemoFertilizer()).toBe(true);
    expect(store.demoGrowthRemainder()).toBe(7450);
    expect(store.cultivateDemoTree({ lightEnergy: 1, water: 0, fertilizer: false })).toBe(true);
    expect(store.demoTreeGrowth()).toBe(1);
    expect(store.demoGrowthRemainder()).toBe(10);
  });

  it('reaches the configured target through capped 7,500-step days and awards 50 points', () => {
    vi.useFakeTimers();
    const firstDay = Date.parse('2026-10-14T00:00:00Z');
    vi.setSystemTime(firstDay - 86400000);
    const store = setup();
    for (let day = 0; day < Math.ceil(target / 50); day++) {
      vi.setSystemTime(firstDay + day * 86400000);
      store.addSteps(7500);
      expect(store.lightEarnedToday()).toBe(7500);
      expect(store.cultivateDemoTree({ lightEnergy: 7500, water: 0, fertilizer: false })).toBe(
        true,
      );
      expect(store.demoTreeGrowth()).toBe(Math.min(target, (day + 1) * 50));
    }
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(store.demoFruitReady()).toBe(true);
    expect(store.startDemoHarvest()).toBe(true);
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreePoints()).toBe(50);
    expect(store.demoTreeHarvested()).toBe(true);
  });

  it('charges every light unit in an overflowing final allocation and discards excess growth', () => {
    const store = setup();
    store.applyTaskInventory({ waterDrops: nearTargetWater, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 0, water: nearTargetWater, fertilizer: false });
    const inventory = store.inventory();
    expect(store.maximumDemoLightAllocation()).toBe(inventory.lightEnergy);
    expect(store.cultivateDemoTree({ lightEnergy: 301, water: 0, fertilizer: false })).toBe(true);
    expect(store.inventory().lightEnergy).toBe(inventory.lightEnergy - 301);
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(store.cultivationError()).toBeNull();
  });

  it('charges an overflowing mixed light/water/fertilizer allocation atomically', () => {
    const store = setup();
    store.applyTaskInventory({ waterDrops: nearTargetWater, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 0, water: nearTargetWater, fertilizer: false });
    store.applyTaskInventory({ waterDrops: 100, fertilizer: 5 });
    const inventory = store.inventory();
    expect(store.cultivateDemoTree({ lightEnergy: 300, water: 45, fertilizer: true })).toBe(true);
    expect(store.inventory()).toEqual({
      ...inventory,
      lightEnergy: inventory.lightEnergy - 300,
      waterDrops: 55,
      fertilizer: 4,
    });
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.demoGrowthRemainder()).toBe(0);
  });

  it('keeps fractional water growth and combines it with light across small batches', () => {
    const store = setup();
    for (let i = 0; i < 14; i++) {
      expect(store.cultivateDemoTree({ lightEnergy: 0, water: 1, fertilizer: false })).toBe(true);
    }
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(7000);
    expect(store.cultivateDemoTree({ lightEnergy: 10, water: 0, fertilizer: false })).toBe(true);
    expect(store.demoTreeGrowth()).toBe(1);
    expect(store.demoGrowthRemainder()).toBe(0);
    expect(store.inventory().waterDrops).toBe(763);
  });

  it('rejects harvesting before maturity without issuing points or consuming inventory', () => {
    const store = setup();
    const inventory = store.inventory();
    expect(store.startDemoHarvest()).toBe(false);
    expect(store.demoTreePoints()).toBe(0);
    expect(store.demoHarvestCount()).toBe(0);
    expect(store.demoHarvestStartedAt()).toBeNull();
    expect(store.inventory()).toEqual(inventory);
    expect(store.cultivationError()).toBeTruthy();
  });

  it('credits fruit only after landing, exactly once, and preserves the large tree', () => {
    vi.useFakeTimers();
    const store = setup();
    mature(store);
    const inventory = store.inventory();
    expect(store.demoFruitReady()).toBe(true);
    expect(store.startDemoHarvest()).toBe(true);
    expect(store.startDemoHarvest()).toBe(false);
    expect(store.demoFruitReady()).toBe(false);
    expect(store.maximumDemoLightAllocation()).toBe(0);
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS - 1);
    expect(store.demoTreePoints()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(store.demoTreePoints()).toBe(50);
    expect(store.demoHarvestCount()).toBe(1);
    expect(store.demoHarvestStartedAt()).toBeNull();
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.demoTreeHarvested()).toBe(true);
    expect(store.demoGrowthTarget()).toBe(target);
    expect(store.inventory()).toEqual(inventory);
    expect(store.maximumDemoLightAllocation()).toBe(0);
    expect(store.maximumDemoWaterAllocation()).toBe(0);
    vi.advanceTimersByTime(10000);
    expect(store.demoTreePoints()).toBe(50);
  });

  it('blocks care during recovery, then allows planting a new seed after 24 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T15:00:00Z'));
    const store = setup();
    mature(store);
    store.startDemoHarvest();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    const harvestedAt = store.demoTreeHarvestedAt()!;
    const inventory = store.inventory();
    expect(store.cultivateDemoTree({ lightEnergy: 0, water: 500, fertilizer: false })).toBe(false);
    expect(store.cultivateDemoTree({ lightEnergy: 1, water: 0, fertilizer: false })).toBe(false);
    expect(store.activateDemoFertilizer()).toBe(false);
    expect(store.inventory()).toEqual(inventory);
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.demoFruitReady()).toBe(false);
    expect(store.startDemoHarvest()).toBe(false);
    expect(store.demoHarvestStartedAt()).toBeNull();
    expect(store.demoTreePoints()).toBe(50);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(store.startDemoHarvest()).toBe(false);
    expect(store.activateDemoFertilizer()).toBe(false);
    expect(store.demoTreePoints()).toBe(50);
    expect(store.demoHarvestCount()).toBe(1);
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.demoGrowthTarget()).toBe(target);
    expect(store.demoTreeHarvested()).toBe(true);
    expect(store.inventory()).toEqual(inventory);

    vi.advanceTimersByTime(harvestedAt + DEMO_HARVEST_RECOVERY_DURATION_MS - Date.now() - 1);
    expect(store.demoTreeHarvested()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.demoTreePlanted()).toBe(false);
    expect(store.demoTreeHarvested()).toBe(false);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoTreePoints()).toBe(50);
    expect(store.plantDemoSeed()).toBe(true);
    expect(store.demoTreePlanted()).toBe(true);
    expect(store.demoHarvestCount()).toBe(0);
  });

  it('keeps fertilizer accounting but blocks its use on the harvested tree', () => {
    vi.useFakeTimers();
    const store = setup();
    store.applyTaskInventory({ waterDrops: fertilizedWater, fertilizer: 5 });
    store.cultivateDemoTree({ lightEnergy: 0, water: fertilizedWater, fertilizer: true });
    const remainder = store.demoGrowthRemainder();
    store.startDemoHarvest();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoGrowthRemainder()).toBe(remainder);
    expect(store.isDemoFertilizerActive()).toBe(true);
    const inventory = store.inventory();
    expect(store.cultivateDemoTree({ lightEnergy: 0, water: 416, fertilizer: false })).toBe(false);
    expect(store.maximumDemoLightAllocation()).toBe(0);
    expect(store.demoTreeGrowth()).toBe(target);
    expect(store.maximumDemoWaterAllocation()).toBe(0);
    expect(store.inventory()).toEqual(inventory);
  });

  it('cleans up the pending harvest timer when the Demo store is destroyed', () => {
    vi.useFakeTimers();
    const store = setup();
    mature(store);
    store.startDemoHarvest();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreePoints()).toBe(0);
  });

  it('cleans up the pending recovery timer when the Demo store is destroyed', () => {
    vi.useFakeTimers();
    const store = setup();
    store.selectDemoTree('tree-6');
    expect(store.startDemoHarvest()).toBe(true);
    vi.advanceTimersByTime(DEMO_HARVEST_DURATION_MS);
    expect(store.demoTreeHarvested()).toBe(true);

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(DEMO_HARVEST_RECOVERY_DURATION_MS);
    expect(store.demoTreePlanted()).toBe(true);
    expect(store.demoTreeHarvested()).toBe(true);
  });

  it('deducts a batch of water drops atomically and applies the active fertilizer bonus', () => {
    const store = setup();
    store.activateDemoFertilizer();
    expect(store.cultivateDemoTree({ lightEnergy: 0, water: 5, fertilizer: false })).toBe(true);
    expect(store.demoTreeGrowth()).toBe(0);
    expect(store.demoGrowthRemainder()).toBe(3000);
    expect(store.inventory().waterDrops).toBe(772);
    expect(store.inventory().fertilizer).toBe(4);
    expect(store.maximumDemoWaterAllocation()).toBe(772);
  });

  it.each([-1, 0.5, NaN, Infinity, 778])(
    'rejects invalid or unaffordable water %s without spending',
    (water) => {
      const store = setup();
      const inventory = store.inventory();
      expect(store.cultivateDemoTree({ lightEnergy: 1, water, fertilizer: false })).toBe(false);
      expect(store.inventory()).toEqual(inventory);
      expect(store.demoTreeGrowth()).toBe(0);
      expect(store.cultivationError()).toBeTruthy();
    },
  );
});
