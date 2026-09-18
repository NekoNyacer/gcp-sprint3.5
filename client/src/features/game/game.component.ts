import { Component, computed, inject } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonListHeader,
  IonLabel,
  IonAvatar,
  IonIcon,
} from '@ionic/angular';
import { GameStore } from './game.store';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  imports: [IonIcon, IonAvatar, IonLabel, IonListHeader, IonItem, IonList, IonButton, IonContent],
  providers: [GameStore],
})
export class GameComponent {
  private gameStore = inject(GameStore);
  topic = computed(() => this.gameStore.topic());
  isPreparing = computed(() => this.gameStore.status() === '等待玩家加入中');
  isPlaying = computed(() => this.gameStore.status() === '玩家發言中');
  players = computed(() => this.gameStore.players());
}
