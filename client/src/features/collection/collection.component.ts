import { Component, computed } from '@angular/core';
import { IonContent, IonChip, IonGrid, IonRow, IonCol } from '@ionic/angular';
import { Tree, TreeCardComponent } from './tree-card/tree-card.component';

@Component({
  selector: 'app-collection',
  templateUrl: './collection.component.html',
  imports: [IonContent, IonChip, IonGrid, IonRow, IonCol, TreeCardComponent],
})
export class CollectionComponent {
  collectionList = computed(
    () =>
      [
        { name: '國泰小樹苗', location: '台北市內湖區', growthLevel: '1' },
        {
          name: '國泰小樹幹',
          location: '新北市板橋區',
          growthLevel: '2',
        },
      ] satisfies Tree[],
  );
}
