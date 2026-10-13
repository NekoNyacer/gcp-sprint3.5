import { Component, computed, inject, viewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { HomeMapComponent } from './home-map/home-map.component';
import { LocationStore } from '../../shared/stores/location-store';
import { ProgressStore } from '../../shared/stores/progress-store';
import { ModalService } from '../../shared/services/modal.service';
import { JoyStickComponent } from './joy-stick/joy-stick.component';
import { HomeIdleComponent } from './home-idle/home-idle.component';
import { HomeChooseComponent } from './home-choose/home-choose.component';
import { HomeWalkingComponent } from './home-walking/home-walking.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  imports: [
    IonContent,
    HomeMapComponent,
    JoyStickComponent,
    HomeIdleComponent,
    HomeChooseComponent,
    HomeWalkingComponent,
  ],
})
export class HomeComponent {
  protected readonly ls = inject(LocationStore);
  protected readonly ps = inject(ProgressStore);
  private readonly modal = inject(ModalService);
  private readonly homeMap = viewChild.required(HomeMapComponent);
  readonly joystickTransform = viewChild.required(JoyStickComponent);
  readonly isIdle = computed(() => this.ls.status() === '閒置中');
  readonly isPlanning = computed(() => this.ls.status() === '選擇目的地中');
  readonly isWalking = computed(() => this.ls.status() === '行走中');
  readonly isArrived = computed(() => this.ls.status() === '抵達目的地');
  readonly isChosen = computed(() => this.ls.hasDestination());

  openModal() {
    this.modal.open();
  }

  /**閒置中：點選開始 */
  startPlanning() {
    const map = this.homeMap()!;
    map.zoom(14);
    this.ls.start();
  }

  /**選擇目的地中：點選返回 */
  back() {
    this.reset();
    this.ls.cancelWalk();
  }

  /**選擇目的地中：點選出發 */
  go() {
    this.homeMap()?.focusWalkRoute();
    this.ls.startWalk('test');
  }

  /**行走中：停止散步 */
  stop() {
    this.ls.cancelWalk();
  }

  cancelChose() {
    this.ls.removeDestination();
    this.removeRoute();
  }

  reset() {
    this.ls.removeDestination();
    const map = this.homeMap()!;
    map.focusPlayer(17);
    this.removeRoute();
  }

  removeRoute() {
    const map = this.homeMap()!;
    map.removeLayer('task-route-line');
    map.removeSource('task-route');
  }
}
