import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
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
