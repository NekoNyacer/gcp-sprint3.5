import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { IonButton, IonContent, IonIcon, ToastController } from '@ionic/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { HomeMapComponent } from './home-map/home-map.component';
import { LocationStore } from '../../shared/stores/location-store';
import {
  WalkDestination,
  WalkPhase,
  WalkSessionStore,
} from '../../shared/stores/walk-session-store';
import { ProgressStore } from '../../shared/stores/progress-store';
import { ModalService } from '../../shared/services/modal.service';
import { JoyStickComponent } from './joy-stick/joy-stick.component';
import { HomeIdleComponent } from './home-idle/home-idle.component';
import { HomePlanComponent } from './home-plan/home-plan.component';
import {
  MapboxDirectionsService,
  WalkingDirections,
} from '../../shared/services/mapbox-directions.service';
import { walkingTaskWaypoints } from '../../shared/models/walk-route';
import {
  METERS_PER_WALK_STEP,
  RoutedWalkTaskPoint,
  supplyRewardLabel,
  supplyRewardsLabel,
} from '../../shared/models/walk-task.models';
import { MapCameraController } from './home-map/map-camera.controller';
import {
  findHomeTree,
  homeTreesWithProgress,
  recommendHomeTrees,
} from './home-tree-recommendations';
import { HomeCultivateComponent } from './home-cultivate/home-cultivate.component';
import {
  haversineDistanceMeters,
  isValidGeoPoint,
  isWithinGeoRadius,
} from '../../shared/models/geo-distance';
import { TREE_CULTIVATION_RADIUS_METERS } from '../../environments/environment-dev';
import { GeoPoint } from '../../shared/models/geo.models';
import { DialogService } from '../../shared/services/dialog.service';
import { HomeSupplyStationComponent } from './home-supply-station/home-supply-station.component';
import { TreeNavigationService } from '../../shared/services/tree-navigation.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  imports: [
    IonIcon,
    IonButton,
    IonContent,
    HomeMapComponent,
    JoyStickComponent,
    HomeIdleComponent,
    HomePlanComponent,
    HomeCultivateComponent,
    HomeSupplyStationComponent,
  ],
  providers: [MapCameraController],
})
export class HomeComponent implements OnDestroy {
  private readonly treeNavigation = inject(TreeNavigationService);
  async ionViewDidEnter(): Promise<void> {
    const treeId = this.treeNavigation.take();
    if (!treeId) return;
    this.startPlanning();
    await this.selectDestination(treeId);
  }
  protected readonly ls = inject(LocationStore);
  protected readonly ws = inject(WalkSessionStore);
  protected readonly ps = inject(ProgressStore);
  private readonly modal = inject(ModalService);
  private readonly camera = inject(MapCameraController);
  private readonly directions = inject(MapboxDirectionsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private routeRequest: AbortController | null = null;
  private activeToast: HTMLIonToastElement | null = null;
  private toastRequest = 0;
  private previousCameraPhase: WalkPhase | null = null;
  private planningOverviewShown = false;
  private readonly routeCache = new Map<string, WalkingDirections>();
  private readonly joystick = viewChild(JoyStickComponent);
  private readonly planningPanel = viewChild(HomePlanComponent);
  readonly planningMapArea = () => this.planningPanel()?.visibleMapArea();
  readonly showTreeRecommendations = signal(true);
  readonly recommendationNow = signal(Date.now());
  readonly planningRecommendations = computed(() =>
    recommendHomeTrees(
      this.ls.current(),
      3,
      homeTreesWithProgress(this.ps.demoTrees(), this.ps.demoDay()),
      this.recommendationNow(),
    ),
  );
  private readonly recommendationClock = effect((onCleanup) => {
    if (!this.ws.isPlanning() || this.ws.hasDestination()) return;
    this.recommendationNow.set(Date.now());
    const timer = setInterval(() => this.recommendationNow.set(Date.now()), 60_000);
    onCleanup(() => clearInterval(timer));
  });
  readonly cultivationMessage = signal<string | null>(null);
  readonly checkInStation = signal<RoutedWalkTaskPoint | null>(null);
  protected readonly isCentered = computed(
    () => this.ls.current() !== null && this.camera.isFollowingPlayer(),
  );

  readonly nearbyTaskPoints = computed(() => {
    return this.ws.isPlanning() && this.ws.destinationConfirmed()
      ? this.ws.availableTaskPoints()
      : [];
  });
  reCenter() {
    const position = this.ls.current();
    if (!position) {
      console.log('目前無法取得位置，請確認定位後再試一次。');
      return;
    }
    this.camera.request({ kind: 'follow-player', position });
  }

  openCultivation(treeId: string): void {
    if (
      this.checkInStation() ||
      this.ws.isCultivating() ||
      (!this.ws.isIdle() && !this.ws.isPlanning() && !this.ws.hasActiveRoute())
    )
      return;
    const tree = findHomeTree(treeId);
    if (!tree) {
      this.cultivationMessage.set('找不到這棵小樹，請重新選擇。');
      return;
    }
    if (!this.ps.selectDemoTree(treeId)) {
      this.cultivationMessage.set(this.ps.cultivationError());
      return;
    }
    this.cultivationMessage.set(null);
    this.ws.setCheckInError(null);
    this.ws.startCultivating();
  }

  openStationCheckIn(taskId: string): void {
    if (this.ws.isCultivating() || this.checkInStation() || this.modal.isOpen()) return;
    const station = this.ws.taskPoints().find((point) => point.id === taskId);
    if (!this.ws.hasActiveRoute() || !station) {
      this.cultivationMessage.set('本次散步沒有這個補給站，請重新選擇。');
      return;
    }
    this.cultivationMessage.set(null);
    this.ws.setCheckInError(null);
    this.checkInStation.set(station);
  }

  openStationDetails(taskId: string): void {
    if (this.modal.isOpen()) return;
    const task = this.ws.taskRoutes().find((point) => point.id === taskId);
    if (!this.ws.isPlanning() || !this.ws.destinationConfirmed() || !task) {
      this.ws.setPlanningError('請先確定此終點並等待補給站載入，再查看補給站。');
      return;
    }

    const position = this.ls.current();
    const distance = isValidGeoPoint(position)
      ? `距離 ${(haversineDistanceMeters(position, task.position) / 1000).toFixed(1)} km`
      : '距離：尚無有效定位';
    const selected = this.ws.taskPoints().some((point) => point.id === taskId);
    this.modal
      .open(
        {
          title: task.name,
          appearance: 'supply-station',
          stationBadges: {
            category: task.supplyStation.category,
            isCathayTwqrMerchant: task.supplyStation.isCathayTwqrMerchant,
          },
          titleBadge: supplyRewardLabel(task.supplyStation.supply),
          subTitle: task.supplyStation.offer,
          description: task.supplyStation.terms,
          otherBadges: [
            `有效期限 ${task.supplyStation.validUntil}`,
            distance,
            `繞路約 +${task.estimatedExtraSteps} 步`,
          ],
          subBtnText: '下次再來',
          mainBtnText: selected ? '移出路線' : '加入路線',
        },
        'auto',
      )
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((action) => {
        if (action === 'confirm') this.toggleTaskPoint(taskId);
      });
  }

  claimStationSupply(): void {
    const station = this.checkInStation();
    if (!station || !this.ws.taskPoints().includes(station)) {
      this.ws.setCheckInError('補給站已變更，請返回地圖重新選擇。');
      return;
    }
    if (
      this.ws.hasActiveRoute() &&
      !this.ws.checkedInTaskIds().includes(station.id) &&
      !isWithinGeoRadius(this.ls.current(), station.position, TREE_CULTIVATION_RADIUS_METERS)
    ) {
      void this.showInteractionWarning();
      return;
    }
    this.ws.checkInTaskPoint(station.id);
  }

  async showInteractionWarning(): Promise<void> {
    await this.showToast('請靠近一點再進行互動');
  }

  async showToast(message: string): Promise<void> {
    const request = ++this.toastRequest;
    const previous = this.activeToast;
    this.activeToast = null;
    if (previous) await previous.dismiss();
    if (request !== this.toastRequest) return;
    const toast = await this.toast.create({
      message,
      duration: 2000,
      position: 'middle',
      cssClass: 'interaction-warning-toast',
    });
    if (request !== this.toastRequest) {
      await toast.dismiss();
      return;
    }
    this.activeToast = toast;
    await toast.present();
    if (request !== this.toastRequest) await toast.dismiss();
  }

  dismissToast(): void {
    this.toastRequest++;
    const toast = this.activeToast;
    this.activeToast = null;
    if (toast) void toast.dismiss();
  }

  closeStationCheckIn(): void {
    this.dismissToast();
    this.checkInStation.set(null);
    this.ws.setCheckInError(null);
  }

  confirmDestinationCheckIn(): void {
    const tree = findHomeTree(this.ps.activeDemoTreeId());
    if (!tree || !this.ws.isCultivating()) {
      this.ws.setCheckInError('請先開啟本次終點的小樹視窗。');
      return;
    }
    if (this.ws.checkInDestination(tree.id)) {
      this.cancelRouteRequest();
      this.routeCache.clear();
      this.ws.setCheckInError('已完成終點打卡，本次散步已結束。');
      const result = this.ws.completedWalkResult();
      if (!result) {
        this.ws.setCheckInError('無法讀取本次散步結算，請重新確認。');
        return;
      }
      this.dialog.openWalkResultDialog(result);
    }
  }

  private isWithinCultivationRange(origin: GeoPoint | null, target: GeoPoint): boolean {
    return isWithinGeoRadius(origin, target, TREE_CULTIVATION_RADIUS_METERS);
  }

  private readonly cameraEffect = afterRenderEffect(() => {
    const phase = this.ws.phase();
    const previousPhase = this.previousCameraPhase;
    this.previousCameraPhase = phase;
    if (phase === 'cultivating' || this.ws.hasActiveRoute()) return;
    if (previousPhase === 'cultivating' && (phase === 'idle' || phase === 'planning')) return;
    const destination = this.ws.destination();
    const player =
      phase === 'planning' && !destination && !this.planningOverviewShown
        ? this.ls.current()
        : untracked(() => this.ls.current());
    if (!player) return;

    if (phase === 'planning') {
      if (!destination) {
        if (this.planningOverviewShown) return;
        const trees = untracked(() => this.planningRecommendations());
        this.camera.request({
          kind: 'recommendations-overview',
          player,
          trees: trees.map((tree) => tree.position),
          visibleArea: untracked(() => this.planningMapArea()),
        });
        this.planningOverviewShown = true;
        return;
      }
      const route = this.ws.baseRoute();
      this.camera.request(
        destination && route.length > 0
          ? {
              kind: 'route-overview',
              player,
              destination: destination.position,
              route: [...route, ...this.nearbyTaskPoints().map((task) => task.position)],
              visibleArea: untracked(() => this.planningPanel()?.visibleMapArea()),
            }
          : { kind: 'planning-overview', position: player },
      );
      return;
    }
    this.camera.request({ kind: 'player', position: player });
  });

  /**閒置中：點選開始 */
  startPlanning() {
    this.cancelRouteRequest();
    this.routeCache.clear();
    this.planningOverviewShown = false;
    this.showTreeRecommendations.set(true);
    this.ws.startPlanning();
  }

  toggleTreeRecommendations(): void {
    if (this.ws.isPlanning() && !this.ws.hasDestination()) {
      this.showTreeRecommendations.update((visible) => !visible);
    }
  }

  /**選擇目的地中：點選返回 */
  back() {
    this.cancelRouteRequest();
    this.routeCache.clear();
    this.ws.cancelWalk();
  }

  confirmDestination(): void {
    this.ws.confirmDestination();
  }

  confirmRoute(): void {
    if (this.modal.isOpen()) return;
    if (!this.ws.isPlanning() || !this.ws.destinationConfirmed()) {
      this.ws.setPlanningError('請先確定此終點，再確認本次路線。');
      return;
    }
    if (this.ws.routeNeedsUpdate()) {
      this.ws.setPlanningError('沿途站點已變更，請先更新預覽路線。');
      return;
    }
    this.modal
      .open(
        {
          title: '確定開始挑戰？',
          description: `沿著此路線行走的話，預計獲得的資源`,
          titleBadge: supplyRewardsLabel(
            this.ws.taskPoints().map((task) => task.supplyStation.supply),
          ),
          mainBtnText: '確認',
          subBtnText: '返回',
        },
        0.21,
      )
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((action) => {
        if (action === 'confirm') {
          const destination = this.ws.destination();
          if (!destination) {
            this.ws.setPlanningError('請先選擇目的地，再確認本次散步。');
            return;
          }
          if (this.ws.startWalk(`walking-${destination.id}`)) {
            this.reCenter();
          }
        }
      });
  }

  requestRouteTermination(): void {
    if (!this.ws.hasActiveRoute() || this.dialog.isDialogOpen()) return;
    const routeId = this.ws.routeId();
    this.dialog
      .openDialog('即將取消本次目的地、補給站與路線，您確定嗎？', {
        title: '終止本次路線',
        mainBtnTxt: '確認終止',
        subBtnTxt: '繼續',
      })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((action) => {
        if (action === 'confirm' && this.ws.hasActiveRoute() && this.ws.routeId() === routeId) {
          this.stop();
        }
      });
  }

  private stop() {
    this.closeStationCheckIn();
    this.cancelRouteRequest();
    this.routeCache.clear();
    this.ws.cancelWalk();
  }

  async selectDestination(treeId: string, retry = false): Promise<void> {
    if (!this.ws.isPlanning() || (!retry && this.ws.destination()?.id === treeId)) return;
    if (this.ws.destinationConfirmed()) {
      this.ws.setPlanningError('終點已確定，請返回並重新規劃以更換終點。');
      return;
    }
    if (!this.ps.canVisitDemoTree(treeId)) {
      this.ws.setPlanningError('這個種植點今日已收成或已完成終點打卡，請選擇其他目的地。');
      return;
    }
    const tree = findHomeTree(treeId);
    const origin = this.ls.current();
    if (!tree || !origin) {
      this.ws.setPlanningError('請先取得目前位置並選擇有效的目的地。');
      return;
    }
    this.cancelRouteRequest();
    this.routeCache.clear();
    const request = new AbortController();
    this.routeRequest = request;
    const destination: WalkDestination = { id: tree.id, position: tree.position };
    this.ws.selectDestination(destination, []);
    this.ws.setRouteLoading(true);
    try {
      const base = await this.directions.walking([origin, destination.position], request.signal);
      if (!this.isCurrentRequest(request, treeId)) return;
      this.ws.setBaseRoute(base.coordinates, base.distanceMeters);
      const candidates = this.ws.availableTaskPoints();
      const tasks = await Promise.all(
        candidates.map(async (task): Promise<RoutedWalkTaskPoint> => {
          const detour = await this.directions.walking(
            [task.routeStop.position, task.position, task.routeStop.position],
            request.signal,
          );
          const extraSteps = Math.round(detour.distanceMeters / METERS_PER_WALK_STEP);
          return {
            ...task,
            position: detour.waypoints[1],
            estimatedExtraSteps: extraSteps,
            description: `虛擬${task.kind === 'water' ? '補水' : '肥料'}任務：Mapbox 預估繞路增加 ${extraSteps} 步。`,
            routeGeometry: detour.coordinates,
            routeDistanceMeters: detour.distanceMeters,
          };
        }),
      );
      if (!this.isCurrentRequest(request, treeId)) return;
      this.ws.setTaskRoutes(tasks);
    } catch (error: unknown) {
      if (!this.isCurrentRequest(request, treeId)) return;
      this.ws.setRoutingError(
        error instanceof Error ? error.message : '步行路線載入失敗，請稍後重試。',
      );
      request.abort();
    } finally {
      if (this.routeRequest === request) {
        this.ws.setRouteLoading(false);
        this.routeRequest = null;
      }
    }
  }

  retryRoute(): void {
    if (this.ws.routeNeedsUpdate()) {
      void this.updateRoute();
      return;
    }
    const destination = this.ws.destination();
    if (destination) void this.selectDestination(destination.id, true);
  }

  toggleTaskPoint(taskId: string): void {
    if (this.modal.isOpen()) return;
    const task = this.ws.taskRoutes().find((point) => point.id === taskId);
    const destination = this.ws.destination();
    if (!this.ws.isPlanning() || !this.ws.destinationConfirmed() || !task || !destination) {
      this.ws.setPlanningError('請先確定此終點並等待補給站載入，再查看補給站。');
      return;
    }
    if (this.ws.toggleTaskPoint(taskId)) {
      this.cancelRouteRequest();
      this.ws.setRouteLoading(false);
    }
  }

  toggleTreeStop(treeId: string): void {
    if (this.modal.isOpen()) return;
    const tree = findHomeTree(treeId);
    if (!tree) {
      this.ws.setPlanningError('找不到這個沿途種植點，請重新選擇。');
      return;
    }
    if (this.ws.toggleTreeStop({ id: tree.id, position: tree.position })) {
      this.cancelRouteRequest();
      this.ws.setRouteLoading(false);
    }
  }

  async updateRoute(): Promise<void> {
    if (
      !this.ws.isPlanning() ||
      !this.ws.destinationConfirmed() ||
      this.ws.routeLoading() ||
      !this.ws.routeNeedsUpdate()
    )
      return;
    const destination = this.ws.destination();
    const origin = this.ws.baseRoute()[0];
    if (!destination || !origin) {
      this.ws.setPlanningError('請先選擇目的地與有效的起點。');
      return;
    }
    const tasks = this.ws.taskPoints();
    const taskIds = tasks.map((task) => task.id);
    const treeStops = this.ws.treeStops();
    const treeIds = treeStops.map((point) => point.id);
    const points = walkingTaskWaypoints(origin, destination.position, [...tasks, ...treeStops]);
    const key = JSON.stringify(points);
    const cached = this.routeCache.get(key);
    if (cached) {
      this.ws.setPlannedRoute(cached.coordinates, cached.distanceMeters, taskIds, treeIds);
      return;
    }
    this.cancelRouteRequest();
    const request = new AbortController();
    this.routeRequest = request;
    this.ws.setPlanningError(null);
    this.ws.setRouteLoading(true);
    try {
      const route = await this.directions.walking(points, request.signal);
      if (!this.isCurrentRequest(request, destination.id)) return;
      this.routeCache.set(key, route);
      this.ws.setPlannedRoute(route.coordinates, route.distanceMeters, taskIds, treeIds);
    } catch (error: unknown) {
      if (!this.isCurrentRequest(request, destination.id)) return;
      this.ws.setRoutingError(
        error instanceof Error ? error.message : '連貫步行路線載入失敗，請稍後重試。',
      );
    } finally {
      if (this.routeRequest === request) {
        this.ws.setRouteLoading(false);
        this.routeRequest = null;
      }
    }
  }

  private isCurrentRequest(request: AbortController, treeId: string): boolean {
    return (
      this.routeRequest === request &&
      !request.signal.aborted &&
      (this.ws.isPlanning() || this.ws.cultivationReturnPhase() === 'planning') &&
      this.ws.destination()?.id === treeId
    );
  }

  private cancelRouteRequest(): void {
    this.routeRequest?.abort();
    this.routeRequest = null;
  }

  ionViewWillLeave(): void {
    this.closeStationCheckIn();
    this.ws.finishCultivating();
  }

  ngOnDestroy(): void {
    this.closeStationCheckIn();
    this.ws.finishCultivating();
    if (this.routeRequest && this.ws.isPlanning()) {
      this.ws.setRoutingError('路線載入已取消，請重新取得路線。');
      this.ws.setRouteLoading(false);
    }
    this.cancelRouteRequest();
    this.routeCache.clear();
  }

  setMapBearing(bearing: number): void {
    this.joystick()?.setMapBearing(bearing);
  }
}
