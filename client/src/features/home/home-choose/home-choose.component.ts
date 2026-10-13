import { Component, output } from '@angular/core';
import { IonCardTitle, IonCardSubtitle, IonCard, IonIcon, IonButton } from '@ionic/angular';
import { CubBadgeComponent } from '../../../shared/components/badge/badge.component';

@Component({
  selector: 'home-choose',
  templateUrl: './home-choose.component.html',
  styleUrls: ['./home-choose.component.scss'],
  imports: [IonCardTitle, IonCardSubtitle, IonCard, IonIcon, IonButton, CubBadgeComponent],
})
export class HomeChooseComponent {
  readonly back = output();
  readonly go = output();
}
