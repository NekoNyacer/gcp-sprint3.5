import { Component, computed, inject, signal } from '@angular/core';
import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonToolbar,
  IonButton,
  IonIcon,
  IonModal,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular';
import { TreeCardComponent } from './tree-card/tree-card.component';
import { ProgressStore } from '../../shared/stores/progress-store';
import { currentHomeTrees, homeTreesWithProgress } from '../home/home-tree-recommendations';
import { TREE_STAGE_LABELS, taipeiDay, treeStage } from '../../shared/models/tree-cultivation';
import { CollectionMapComponent } from './collection-map.component';
import { HomeCultivateComponent } from '../home/home-cultivate/home-cultivate.component';
import { Router } from '@angular/router';
import { TreeNavigationService } from '../../shared/services/tree-navigation.service';
import { FormsModule } from '@angular/forms';
import { REGION_MAP } from '../../shared/const/region-map';
import { cmsPublication } from '../../shared/models/cms-publication';

@Component({
  selector: 'app-collection',
  templateUrl: './collection.component.html',
  styleUrl: './collection.component.scss',
  imports: [
    FormsModule,
    IonModal,
    IonIcon,
    IonButton,
    IonLabel,
    IonSegmentButton,
    IonSegment,
    IonToolbar,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    TreeCardComponent,
    CollectionMapComponent,
    HomeCultivateComponent,
    IonSelect,
    IonSelectOption,
  ],
})
export class CollectionComponent {
  private readonly router = inject(Router);
  private readonly treeNavigation = inject(TreeNavigationService);
  protected readonly filterModalOpen = signal(false);
  protected filterWords = signal<FilterWords>({ region: [], cultivar: [] });
  readonly hasActiveFilters = computed(() => {
    const { region, cultivar } = this.filterWords();
    return region.length > 0 || cultivar.length > 0;
  });
  protected readonly draftRegion = signal<string[]>([]);
  protected readonly draftCultivar = signal<string[]>([]);
  readonly cultivarOptions = computed(() => {
    const publication = cmsPublication();
    return publication.managed
      ? (publication.config?.species ?? [])
      : [...new Set(currentHomeTrees().map((tree) => tree.species))];
  });

  readonly Regions = Object.entries(REGION_MAP).map(([code, name]) => ({
    code,
    name,
  }));
  async navigateToTree(treeId: string): Promise<void> {
    this.cultivationOpen.set(false);
    this.treeNavigation.request(treeId);
    try {
      if (!(await this.router.navigateByUrl('/home'))) this.treeNavigation.take();
    } catch {
      this.treeNavigation.take();
    }
  }
  readonly cultivationOpen = signal(false);
  openCultivation(treeId: string): void {
    if (!this.cultivationOpen() && this.progress.selectDemoTree(treeId))
      this.cultivationOpen.set(true);
  }
  protected readonly viewMode = signal<'grid' | 'map'>('grid');
  protected readonly isGridMode = computed(() => this.viewMode() === 'grid');
  private readonly progress = inject(ProgressStore);
  protected readonly segment = signal<CollectionSegment>('cultivating');
  private readonly trees = computed(() =>
    homeTreesWithProgress(this.progress.demoTrees(), this.progress.demoDay())
      .filter((tree) => !tree.empty)
      .map((tree) => ({
        id: tree.id,
        position: tree.position,
        name: tree.nickName,
        location: tree.poiName,
        species: tree.species,
        postalCode: tree.postalCode,
        plantedAt: tree.plantedAt,
        visitedOn: this.progress.demoTrees()[tree.id].visitedOn,
        harvested: !!tree.harvested,
        canHarvest:
          !tree.harvested &&
          tree.growth >= tree.nextHarvestAt &&
          this.progress.demoTrees()[tree.id].harvestStartedAt === null,
        stage: TREE_STAGE_LABELS[treeStage(tree.growth, tree.nextHarvestAt)],
      })),
  );
  readonly collectionList = computed(() => {
    //首先根據狀態分類
    const listByStatus = this.trees().filter((tree) => {
      if (this.segment() === 'harvested') return tree.harvested;

      if (this.segment() === 'longTimeNoSee') {
        return (
          Date.parse(this.progress.demoDay()) -
            Math.max(
              Date.parse(tree.visitedOn ?? taipeiDay(new Date(tree.plantedAt))),
              Date.parse(taipeiDay(new Date(tree.plantedAt))),
            ) >=
          14 * 24 * 60 * 60 * 1000
        );
      }

      return !tree.harvested;
    });

    //然後再根據篩選內容進行分類
    const { cultivar, region } = this.filterWords();
    return listByStatus.filter((tree) => {
      const matchesCultivar = cultivar.length === 0 || cultivar.includes(tree.species);
      const matchesRegion =
        region.length === 0 || (!!tree.postalCode && region.includes(tree.postalCode));
      return matchesCultivar && matchesRegion;
    });
  });
  readonly harvestableCount = computed(
    () => this.collectionList().filter((tree) => tree.canHarvest).length,
  );

  openFilterModal() {
    const { region, cultivar } = this.filterWords();
    this.draftRegion.set([...region]);
    this.draftCultivar.set([...cultivar]);
    this.filterModalOpen.set(true);
  }

  clearFilters(): void {
    this.draftRegion.set([]);
    this.draftCultivar.set([]);
  }

  applyFilters(): void {
    this.filterWords.set({
      region: [...this.draftRegion()],
      cultivar: [...this.draftCultivar()],
    });
    this.filterModalOpen.set(false);
  }
}

export type CollectionSegment = 'cultivating' | 'harvested' | 'longTimeNoSee';
type FilterWords = {
  region: string[];
  cultivar: string[];
};
