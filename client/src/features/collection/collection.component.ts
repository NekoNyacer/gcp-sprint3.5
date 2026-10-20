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
} from '@ionic/angular';
import { TreeCardComponent } from './tree-card/tree-card.component';
import { ProgressStore } from '../../shared/stores/progress-store';
import { homeTreesWithProgress } from '../home/home-tree-recommendations';
import { TREE_STAGE_LABELS, treeStage } from '../../shared/models/tree-cultivation';
import { CollectionMapComponent } from './collection-map.component';
import { HomeCultivateComponent } from '../home/home-cultivate/home-cultivate.component';
import { Router } from '@angular/router';
import { TreeNavigationService } from '../../shared/services/tree-navigation.service';

@Component({
  selector: 'app-collection',
  templateUrl: './collection.component.html',
  styleUrl: './collection.component.scss',
  imports: [
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
  ],
})
export class CollectionComponent {
  private readonly router = inject(Router);
  private readonly treeNavigation = inject(TreeNavigationService);
  async navigateToTree(treeId: string): Promise<void> {
    this.cultivationOpen.set(false);
    this.treeNavigation.request(treeId);
    try {
      if (!await this.router.navigateByUrl('/home')) this.treeNavigation.take();
    } catch {
      this.treeNavigation.take();
    }
  }
  readonly cultivationOpen = signal(false);
  openCultivation(treeId: string): void {
    if (!this.cultivationOpen() && this.progress.selectDemoTree(treeId)) this.cultivationOpen.set(true);
  }
  protected readonly viewMode = signal<'grid' | 'map'>('grid');
  protected readonly isGridMode = computed(() => this.viewMode() === 'grid');
  private readonly progress = inject(ProgressStore);
  protected readonly segment = signal('all');
  private readonly trees = computed(() =>
    homeTreesWithProgress(this.progress.demoTrees(), this.progress.demoDay())
      .filter((tree) => !tree.empty)
      .map((tree) => ({
        id: tree.id,
        position: tree.position,
        name: tree.nickName,
        location: tree.poiName,
        species: tree.species,
        plantedAt: tree.plantedAt,
        harvested: !!tree.harvested,
        canHarvest: !tree.harvested && tree.growth >= tree.nextHarvestAt &&
          this.progress.demoTrees()[tree.id].harvestStartedAt === null,
        stage: TREE_STAGE_LABELS[treeStage(tree.growth, tree.nextHarvestAt)],
      })),
  );
  readonly collectionList = computed(() => this.trees().filter((tree) =>
    this.segment() === 'favorites' ? tree.harvested :
    this.segment() === 'longTimeNoSee' ? false : !tree.harvested,
  ));
  readonly harvestableCount = computed(() =>
    this.collectionList().filter((tree) => tree.canHarvest).length,
  );
}
