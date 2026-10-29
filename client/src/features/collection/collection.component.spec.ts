import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { getState } from '@ngrx/signals';
import { CollectionComponent, CollectionSegment } from './collection.component';
import { ProgressStore } from '../../shared/stores/progress-store';
import { cmsPublication } from '../../shared/models/cms-publication';
import { currentHomeTrees } from '../home/home-tree-recommendations';

class TestCollectionComponent extends CollectionComponent {
  selectSegment(value: CollectionSegment): void {
    this.segment.set(value);
  }
  selectFilters(region: string[], cultivar: string[]): void {
    this.draftRegion.set(region);
    this.draftCultivar.set(cultivar);
    this.applyFilters();
  }
}

describe('Collection long-time-no-visit filter', () => {
  let progress: InstanceType<typeof ProgressStore>;
  let component: TestCollectionComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigateByUrl: vi.fn() } }],
    });
    progress = TestBed.inject(ProgressStore);
    progress.replaceProgress({ ...getState(progress), demoDay: '2026-10-22' });
    component = TestBed.runInInjectionContext(() => new TestCollectionComponent());
    component.selectSegment('longTimeNoSee');
  });

  afterEach(() => {
    cmsPublication.set({ config: null, version: 0, managed: false });
    TestBed.resetTestingModule();
  });

  it('updates species options and matches published postal codes independently of species and place', () => {
    const config = {
      merchants: [], scenes: [], rewards: [], harvestPoints: 80,
      species: ['櫻花', '櫻花新品種'],
      trees: [{ id: 'tree-1', name: '測試樹', species: '櫻花', place: '任意地點', postalCode: '220',
        latitude: 25.01, longitude: 121.46, empty: false, growth: 10, weather: 'sunny' as const, timeOfDay: 'day' as const }],
    };
    cmsPublication.set({ config, version: 1, managed: true });
    progress.ensureCmsTrees(currentHomeTrees(), true);
    component.selectSegment('cultivating');
    expect(component.cultivarOptions()).toEqual(['櫻花', '櫻花新品種']);
    component.selectFilters(['220'], ['櫻花']);
    expect(containsTree()).toBe(true);
    component.selectFilters(['114'], ['櫻花']);
    expect(containsTree()).toBe(false);
    component.selectFilters(['220'], ['櫻']);
    expect(containsTree()).toBe(false);
    cmsPublication.set({ config: { ...config, species: ['新物種'] }, version: 2, managed: true });
    expect(component.cultivarOptions()).toEqual(['新物種']);
  });

  it('keeps draft selection separate until apply and clears both filters', () => {
    component.selectSegment('cultivating');
    const count = component.collectionList().length;
    component.selectFilters(['unknown'], []);
    expect(component.collectionList()).toHaveLength(0);
    component.clearFilters();
    expect(component.collectionList()).toHaveLength(0);
    component.applyFilters();
    expect(component.collectionList()).toHaveLength(count);
  });

  function setTree(changes: Partial<ReturnType<typeof progress.demoTrees>[string]>): void {
    progress.replaceProgress({
      ...getState(progress),
      demoTrees: {
        ...progress.demoTrees(),
        'tree-1': {
          ...progress.demoTrees()['tree-1'],
          plantedAt: Date.parse('2026-09-01T00:00:00+08:00'),
          ...changes,
        },
      },
    });
  }

  function containsTree(): boolean {
    return component.collectionList().some((tree) => tree.id === 'tree-1');
  }

  it.each([
    ['2026-10-09', false],
    ['2026-10-08', true],
    ['2026-10-07', true],
    ['2026-10-22', false],
    ['2026-10-23', false],
  ])('filters a last visit on %s with inclusive 14-day boundaries', (visitedOn, expected) => {
    setTree({ visitedOn });
    expect(containsTree()).toBe(expected);
  });

  it.each([
    ['2026-10-08T23:59:59+08:00', true],
    ['2026-10-09T00:00:00+08:00', false],
  ])('uses the Taipei planting day when never visited: %s', (plantedAt, expected) => {
    setTree({ visitedOn: null, plantedAt: Date.parse(plantedAt) });
    expect(containsTree()).toBe(expected);
  });

  it('does not count visits from a previous planting cycle', () => {
    setTree({ visitedOn: '2026-09-01', plantedAt: Date.parse('2026-10-21T00:00:00+08:00') });
    expect(containsTree()).toBe(false);
  });

  it('removes a tree after a new visit and updates at the day boundary', () => {
    setTree({ visitedOn: '2026-10-09' });
    expect(containsTree()).toBe(false);
    progress.replaceProgress({ ...getState(progress), demoDay: '2026-10-23' });
    expect(containsTree()).toBe(true);
    setTree({ visitedOn: '2026-10-23' });
    expect(containsTree()).toBe(false);
  });

  it('excludes empty planting spots and preserves cultivating and harvested tabs', () => {
    setTree({ visitedOn: '2026-10-01', planted: false });
    expect(containsTree()).toBe(false);
    setTree({ planted: true, harvestCount: 0 });
    component.selectSegment('cultivating');
    expect(containsTree()).toBe(true);
    component.selectSegment('harvested');
    expect(containsTree()).toBe(false);
    setTree({ harvestCount: 1 });
    expect(containsTree()).toBe(true);
    component.selectSegment('cultivating');
    expect(containsTree()).toBe(false);
  });
});
