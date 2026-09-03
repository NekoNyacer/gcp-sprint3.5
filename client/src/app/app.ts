import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  IonApp,
  IonHeader,
  IonButton,
  IonMenu,
  IonToolbar,
  IonContent,
  IonTitle,
  IonMenuButton,
  IonButtons,
  IonAlert,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
} from '@ionic/angular';

@Component({
  imports: [
    RouterOutlet,
    IonApp,
    IonHeader,
    IonButton,
    IonMenu,
    IonToolbar,
    IonContent,
    IonTitle,
    IonMenuButton,
    IonButtons,
    IonAlert,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('client');
  alertButtons = ['Action'];
}
