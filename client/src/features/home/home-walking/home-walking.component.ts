import { Component, output } from '@angular/core';
import { IonIcon, IonButton, IonCard } from '@ionic/angular';

@Component({
  selector: 'home-walking',
  templateUrl: './home-walking.component.html',
  styleUrls: ['./home-walking.component.scss'],
  imports: [IonIcon, IonButton, IonCard],
})
export class HomeWalkingComponent {
  readonly stop = output();
}
