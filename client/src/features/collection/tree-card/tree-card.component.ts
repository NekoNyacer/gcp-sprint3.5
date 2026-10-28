import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { treeAppearance } from '../../../../../functions/src/tree-species';
import { IonCard, IonChip, IonLabel } from '@ionic/angular';

@Component({
  selector: 'app-tree-card',
  templateUrl: './tree-card.component.html',
  styleUrl: './tree-card.component.scss',
  imports: [DatePipe, IonChip, IonCard, IonLabel],
})
export class TreeCardComponent {
  tree = input.required<Tree>();
  readonly interactive = input(false);
  readonly selected = output<string>();
  readonly image = computed(() => {
    const stages: Record<string,string> = {種子:'seed', 幼苗:'seedling', 小樹苗:'smallSapling', 大樹苗:'largeSapling', 小樹:'young', 大樹:'mature', 開花:'flowering', 結果:'large'};
    const stage = stages[this.tree().stage] ?? 'mature';
    const early = ['seed','seedling','smallSapling','largeSapling'].includes(stage);
    return '/images/tree-species/' + (early ? '' : treeAppearance(this.tree().species).id + '-') + stage + '.png';
  });
  select(): void {
    if (this.interactive()) this.selected.emit(this.tree().id);
  }
}

export type Tree = {
  id: string;
  name: string;
  location: string;
  species: string;
  plantedAt: number;
  harvested: boolean;
  canHarvest: boolean;
  stage: string;
};
