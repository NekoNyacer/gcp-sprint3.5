import { DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { IonButton, IonCard, IonIcon } from '@ionic/angular';
import {
  getHomeTreeRecommendation,
  homeTreesWithProgress,
  recommendHomeTrees,
} from '../home-tree-recommendations';
import { LocationStore } from '../../../shared/stores/location-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { WalkSessionStore } from '../../../shared/stores/walk-session-store';
import { USER_MOVE_METER_PER_STEP } from '../../../environments/environment-dev';
import { walkOutline, reloadOutline } from 'ionicons/icons';

@Component({
  selector: 'home-plan',
  templateUrl: './home-plan.component.html',
  styleUrls: ['./home-plan.component.scss'],
  imports: [IonCard, IonIcon, IonButton, DecimalPipe],
})
export class HomePlanComponent {
  readonly walkingIcon = walkOutline;
  readonly updateIcon = reloadOutline;
  readonly recommendationNow = input(Date.now());
  readonly recommendationsVisible = input(true);
  readonly toggleRecommendations = output<void>();
  readonly hasDestination = computed(() => this.ws.hasDestination());
  readonly destinationConfirmed = computed(() => this.ws.destinationConfirmed());
  private readonly topPanel = viewChild<ElementRef<HTMLDivElement>>('topPanel');
  private readonly bottomPanel = viewChild<ElementRef<HTMLDivElement>>('bottomPanel');
  private readonly ls = inject(LocationStore);
  private readonly ws = inject(WalkSessionStore);
  private readonly ps = inject(ProgressStore);
  private readonly currentTrees = computed(() =>
    homeTreesWithProgress(this.ps.demoTrees(), this.ps.demoDay()),
  );
  readonly recommendedTrees = computed(() =>
    recommendHomeTrees(this.ls.current(), 3, this.currentTrees(), this.recommendationNow()),
  );
  readonly selectedTree = computed(() =>
    getHomeTreeRecommendation(
      this.ws.destination()?.id,
      this.ls.current(),
      this.currentTrees(),
      this.recommendationNow(),
    ),
  );
  readonly availableStations = computed(() => [...this.ws.availableTaskPoints()].sort((a, b) =>
    a.routeStop.segmentIndex - b.routeStop.segmentIndex || a.routeStop.fraction - b.routeStop.fraction));
  readonly supplyRetry = output<void>();
  readonly selectedTreeStops = computed(() => this.ws.treeStops());
  readonly distanceMeters = computed(() => this.ws.plannedDistanceMeters());
  readonly estimateSteps = computed(() => this.distanceMeters() / USER_MOVE_METER_PER_STEP);
  readonly walkingMinutes = computed(() => Math.ceil(this.ws.plannedDurationSeconds() / 60));
  readonly planningError = computed(() => this.ws.planningError());
  readonly routeLoading = computed(() => this.ws.routeLoading());
  readonly routingFailed = computed(() => this.ws.routingFailed());
  readonly routeNeedsUpdate = computed(() => this.ws.routeNeedsUpdate());
  readonly routeRetry = output<void>();
  readonly routeUpdate = output<void>();
  readonly back = output<void>();
  readonly reselectDestination = output<void>();
  readonly confirmRoute = output<void>();
  readonly confirmDestination = output<void>();
  readonly treeSelect = output<string>();
  visibleMapArea(): { top: number; bottom: number } | undefined {
    const top = this.topPanel()?.nativeElement.getBoundingClientRect();
    const bottom = this.bottomPanel()?.nativeElement.getBoundingClientRect();
    return top ? { top: top.bottom, bottom: bottom?.top ?? window.innerHeight } : undefined;
  }
}
