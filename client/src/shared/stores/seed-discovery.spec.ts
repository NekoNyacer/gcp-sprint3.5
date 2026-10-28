import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { patchState } from '@ngrx/signals';
import { ProgressStore } from './progress-store';
import { WalkSessionStore } from './walk-session-store';
import { LocationStore, type LocationPoint } from './location-store';
import { cmsPublication } from '../models/cms-publication';
import { homeTreesWithProgress } from '../../features/home/home-tree-recommendations';
import { demoPlantingSpots, TREE_GROWTH_PER_HARVEST } from '../../environments/environment-dev';
import type { CmsConfig } from '../../../../functions/src/cms-domain';
const catalog = (chancePercent = 100): CmsConfig => ({
  merchants: [],
  trees: [{ id: 'tree-5', name: '種植點', species: '', place: '板橋車站', latitude: 25.014,
    longitude: 121.464, empty: true, growth: 0, weather: 'sunny', timeOfDay: 'day' }],
  rewards: [],
  scenes: [],
  species: ['銀杏', '榕樹'],
  harvestPoints: 50,
  seedTypes: [
    {
      id: 'rare',
      name: '營運池',
      enabled: true,
      outcomes: [
        { species: '銀杏', weight: 1 },
        { species: '榕樹', weight: 99 },
      ],
    },
  ],
  walkSeedDrop: { enabled: true, chancePercent, seedTypeId: 'rare' },
});
describe('completed routes and mystery-seed lifecycle', () => {
  afterEach(() => {
    cmsPublication.set({ config: null, version: 0, managed: false });
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });
  function setup(chance = 100) {
    cmsPublication.set({ config: catalog(chance), version: 7, managed: true });
    const current = signal<LocationPoint | null>(null);
    TestBed.configureTestingModule({
      providers: [{ provide: LocationStore, useValue: { current } }],
    });
    const walk = TestBed.inject(WalkSessionStore),
      progress = TestBed.inject(ProgressStore);
    const destination = { id: 'tree-5', position: { latitude: 25.014, longitude: 121.464 } };
    walk.startPlanning();
    walk.selectDestination(destination, [
      { latitude: 25.01, longitude: 121.46 },
      destination.position,
    ]);
    walk.confirmDestination();
    expect(walk.startWalk('seed-route')).toBe(true);
    const near = () =>
      current.set({ ...destination.position, accuracy: 5, observedAt: new Date() });
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array: any) => {
      array.fill(0);
      return array;
    });
    return { walk, progress, near };
  }
  it('awards one hidden seed only after valid completion and prevents duplicate settlement', () => {
    const { walk, progress, near } = setup();
    const before = progress.inventory().seeds;
    expect(walk.checkInDestination('tree-5')).toBe(false);
    expect(progress.inventory().seeds).toBe(before);
    near();
    expect(walk.checkInDestination('wrong')).toBe(false);
    expect(walk.checkInDestination('tree-5')).toBe(true);
    expect(progress.inventory().seeds).toBe(before + 1);
    expect(progress.mysterySeeds()).toMatchObject([
      { species: '銀杏', seedTypeId: 'rare', version: 7,
        origin: { routeId: 'seed-route', place: '板橋車站', acquiredAt: expect.any(Number) } },
    ]);
    expect(walk.completedWalkResult()).toMatchObject({ earnedSeeds: 1, seedsBalance: before + 1 });
    expect(walk.checkInDestination('tree-5')).toBe(false);
    expect(progress.inventory().seeds).toBe(before + 1);
  });
  it('does not award on cancellation or a failed probability roll', () => {
    const { walk, progress, near } = setup(0);
    const before = progress.inventory().seeds;
    near();
    expect(walk.checkInDestination('tree-5')).toBe(true);
    expect(progress.inventory().seeds).toBe(before);
    expect(progress.mysterySeeds()).toEqual([]);
    expect(walk.completedWalkResult()?.earnedSeeds).toBe(0);
    walk.startPlanning();
    walk.cancelWalk();
    expect(progress.inventory().seeds).toBe(before);
  });
  it('does not roll a seed for a cancelled route even with guaranteed discovery configured', () => {
    const { walk, progress, near } = setup(100);
    const before = progress.inventory().seeds;
    near();
    walk.cancelWalk();
    expect(walk.checkInDestination('tree-5')).toBe(false);
    expect(crypto.getRandomValues).not.toHaveBeenCalled();
    expect(progress.inventory().seeds).toBe(before);
    expect(progress.mysterySeeds()).toEqual([]);
  });
  it('freezes departure settings and retains the acquired species through pool removal and planting', () => {
    const { walk, progress, near } = setup();
    cmsPublication.set({ config: { ...catalog(0), seedTypes: [] }, version: 8, managed: true });
    near();
    expect(walk.checkInDestination('tree-5')).toBe(true);
    const seed = progress.mysterySeeds()[0];
    expect(seed.origin?.place).toBe('板橋車站');
    progress.selectDemoTree(demoPlantingSpots[0].id);
    expect(progress.plantDemoSeed('我的旅行樹')).toBe(true);
    expect(progress.mysterySeeds()).toEqual([]);
    const id = progress.activeDemoTreeId(),
      tree = progress.demoTrees()[id];
    expect(tree).toMatchObject({ species: seed.species, seedTypeId: 'rare', plantingVersion: 7 });
    // Use the local planting-site catalog to inspect its display across stages.
    cmsPublication.set({ config: null, version: 0, managed: false });
    for (const ratio of [0, 0.1, 0.16, 0.23, 0.2999, 0.3, 0.6]) {
      patchState(progress as never, {
        demoTrees: {
          ...progress.demoTrees(),
          [id]: { ...tree, growth: ratio * TREE_GROWTH_PER_HARVEST },
        },
      });
      expect(homeTreesWithProgress(progress.demoTrees()).find((t) => t.id === id)?.species).toBe(
        ratio < 0.3 ? '神秘樹種' : '銀杏',
      );
    }
  });
  it('plants the selected seed rather than the first and rejects a stale selection without spending', () => {
    const { progress } = setup();
    progress.grantWalkSeed('櫻花', 'rare', 7, { routeId: 'route-a', place: '板橋車站', acquiredAt: 1 });
    progress.grantWalkSeed('銀杏', 'rare', 7, { routeId: 'route-b', place: '西湖', acquiredAt: 2 });
    const [first, second] = progress.mysterySeeds();
    progress.selectDemoTree(demoPlantingSpots[0].id);
    expect(progress.plantDemoSeed('選中的樹', undefined, second.id)).toBe(true);
    expect(progress.demoTrees()[progress.activeDemoTreeId()].species).toBe('銀杏');
    expect(progress.mysterySeeds()).toEqual([first]);
    progress.selectDemoTree(demoPlantingSpots[1].id);
    const balance = progress.inventory().seeds;
    expect(progress.plantDemoSeed('重複種植', undefined, second.id)).toBe(false);
    expect(progress.inventory().seeds).toBe(balance);
    expect(progress.plantDemoSeed('初始種子', undefined, 'legacy-seed-0')).toBe(true);
    expect(progress.mysterySeeds()).toEqual([first]);
  });
});
