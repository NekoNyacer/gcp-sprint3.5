import { Component } from '@angular/core';
import {
  IonTitle,
  IonContent,
  IonToolbar,
  IonHeader,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonButton,
  IonCardSubtitle,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  imports: [
    IonCol,
    IonRow,
    IonCardHeader,
    IonContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonGrid,
  ],
})
export class HomeComponent {
  // activeTab: AppTab = 'home';
  // steps = 4280;
  // lightEnergy = 24;
  // showDemoNotice = false;
  // readonly Math = Math;
  // selectTab(tab: AppTab): void {
  //   this.activeTab = tab;
  // }
  // simulateWalk(): void {
  //   this.steps = Math.min(this.steps + 500, 7500);
  //   this.lightEnergy = this.steps <= 5000
  //     ? Math.floor(this.steps / 500) * 3
  //     : 30 + Math.floor((this.steps - 5000) / 500) * 4;
  //   this.showDemoNotice = true;
  //   window.setTimeout(() => {
  //     this.showDemoNotice = false;
  //   }, 2400);
  // }
}
