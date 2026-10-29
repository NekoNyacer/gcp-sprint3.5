import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon, IonButton, IonCard, IonCardSubtitle, IonCardTitle } from '@ionic/angular';
import { CubBadgeComponent } from '../../../shared/components/badge/badge.component';
import { MapCameraController } from '../home-map/map-camera.controller';
import { LocationStore } from '../../../shared/stores/location-store';

@Component({
  selector: 'home-walking',
  templateUrl: './home-walking.component.html',
  styleUrls: ['./home-walking.component.scss'],
  imports: [IonCardTitle, IonCardSubtitle, IonIcon, IonButton, IonCard, CubBadgeComponent],
})
export class HomeWalkingComponent {
  readonly destinationName = input('散步目的地');
  readonly camera = inject(MapCameraController);
  readonly taskCount = input(0);
  readonly stop = output();
  readonly locationError = signal<string | null>(null);
}
