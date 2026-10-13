import { DecimalPipe } from '@angular/common';
import { Component, inject, output, signal } from '@angular/core';
import { IonButton, IonCard, IonCardSubtitle, IonCardTitle, IonIcon } from '@ionic/angular';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { CubBadgeComponent } from '../../../shared/components/badge/badge.component';

@Component({
  selector: 'home-idle',
  templateUrl: './home-idle.component.html',
  styleUrls: ['./home-idle.component.scss'],
  imports: [
    IonButton,
    IonCardSubtitle,
    IonCardTitle,
    IonCard,
    IonIcon,
    DecimalPipe,
    CubBadgeComponent,
  ],
})
export class HomeIdleComponent {
  protected readonly ps = inject(ProgressStore);
  readonly start = output();
  protected readonly selectedTree = signal<number | null>(null);
}
