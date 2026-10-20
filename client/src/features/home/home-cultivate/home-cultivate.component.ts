import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonButton,
  IonChip,
  IonContent,
  IonIcon,
  IonLabel,
  IonModal,
  IonToast,
} from '@ionic/angular';
import { sunny, water, sparkles, bagHandle, leaf } from 'ionicons/icons';
import { CubBadgeComponent } from '../../../shared/components/badge/badge.component';
import { ProgressStore } from '../../../shared/stores/progress-store';
import {
  CareResource,
  fertilizerActive,
  ResourceFeedingClock,
  StreamingCareResource,
  wateringGeometry,
  taipeiDay,
  treeStage,
  TREE_STAGE_LABELS,
  treeWaterState,
  TREE_WATER_STATE_LABELS,
  TreeFruitState,
  DEMO_HARVEST_POINTS,
  DEMO_HARVEST_RECOVERY_DURATION_MS,
  LIGHT_ENERGY_PER_GROWTH,
  WATER_DROPS_PER_GROWTH,
  CARE_GROWTH_PRECISION,
} from '../../../shared/models/tree-cultivation';
import { TreeSceneComponent } from '../../../shared/components/tree-scene/tree-scene.component';
import {
  CultivationWeather,
  CultivationTimeOfDay,
  LIGHT_ENERGY_PER_SECOND,
  TREE_CULTIVATION_RADIUS_METERS,
  TREE_WEED_PENALTY_THRESHOLD,
  WATER_DROP_PER_SECOND,
} from '../../../environments/environment-dev';
import { DialogService } from '../../../shared/services/dialog.service';
import { LocationStore } from '../../../shared/stores/location-store';
import { WalkSessionStore } from '../../../shared/stores/walk-session-store';
import { findHomeTree } from '../home-tree-recommendations';
import {
  haversineDistanceMeters,
  isValidGeoPoint,
  isWithinGeoRadius,
} from '../../../shared/models/geo-distance';

@Component({
  selector: 'home-cultivate',
  templateUrl: './home-cultivate.component.html',
  styleUrls: ['./home-cultivate.component.scss'],
  imports: [
    IonToast,
    IonLabel,
    IonChip,
    IonButton,
    IonContent,
    IonIcon,
    IonModal,
    IonToast,
    CubBadgeComponent,
    DecimalPipe,
    TreeSceneComponent,
  ],
})
export class HomeCultivateComponent implements OnDestroy {
  private readonly dialog = inject(DialogService);
  private readonly ws = inject(WalkSessionStore);
  private readonly ls = inject(LocationStore);
  private readonly modal = viewChild(IonModal);
  private readonly scene = viewChild(TreeSceneComponent);
  private readonly layout = viewChild<ElementRef<HTMLDivElement>>('layout');
  readonly ps = inject(ProgressStore);
  readonly weedPenaltyThreshold = TREE_WEED_PENALTY_THRESHOLD;
  readonly growthConversionRate = computed(
    () => (this.fertilized() ? 120 : 100) * (this.ps.demoWeedPenaltyActive() ? 0.9 : 1),
  );
  readonly weatherLabels: Record<CultivationWeather, string> = {
    sunny: '晴天',
    rainy: '雨天',
    cloudy: '陰天',
  };
  private readonly tree = computed(() => findHomeTree(this.ps.activeDemoTreeId()));
  readonly weather = computed<CultivationWeather>(() => this.tree()?.weather ?? 'sunny');
  readonly timeOfDay = computed<CultivationTimeOfDay>(() => this.tree()?.timeOfDay ?? 'day');
  readonly isOpen = computed(() => this.ws.isCultivating());
  readonly treeName = computed(() =>
    !this.ps.demoTreePlanted() ? '空的種植點' : (this.tree()?.nickName ?? '小樹'),
  );
  readonly treeLocation = computed(() => this.tree()?.poiName ?? '');
  readonly treeSpecies = computed(() => this.tree()?.species ?? '榕樹');
  readonly canCultivate = computed(() => {
    const tree = this.tree();
    return (
      !!tree && isWithinGeoRadius(this.ls.current(), tree.position, TREE_CULTIVATION_RADIUS_METERS)
    );
  });
  readonly accessMessage = computed(() => {
    if (this.canCultivate()) return null;
    const position = this.ls.current();
    if (!isValidGeoPoint(position)) {
      return '尚無有效定位，目前僅能查看小樹；取得定位並靠近後即可培育。';
    }
    const tree = this.tree();
    if (!tree) return null;
    const distance = Math.ceil(haversineDistanceMeters(position, tree.position));
    return `距離「${tree.nickName}」約 ${distance} 公尺，目前僅能查看；請靠近至 ${TREE_CULTIVATION_RADIUS_METERS} 公尺內再培育。`;
  });
  readonly showDestinationCheckIn = computed(
    () => this.ws.hasActiveRoute() && this.ws.destination()?.id === this.tree()?.id,
  );
  readonly checkInMessage = computed(() => this.ws.checkInError());
  readonly destinationCheckIn = output<void>();
  readonly interactionDenied = output<void>();
  readonly feedbackRequested = output<string>();
  readonly closing = output<void>();
  readonly resources: readonly CareResource[] = ['light', 'water', 'fertilizer'];
  readonly backpackOpen = signal(false);
  readonly backpackIcon = bagHandle;
  readonly seedIcon = leaf;
  readonly canPlant = computed(
    () => this.canCultivate() && !this.ps.demoTreePlanted() && this.ps.inventory().seeds > 0,
  );
  readonly icons: Record<CareResource, string> = { light: sunny, water, fertilizer: sparkles };
  readonly labels: Record<CareResource, string> = {
    light: '光能',
    water: '水滴',
    fertilizer: '肥料',
  };
  readonly heldResource = signal<CareResource | null>(null);
  readonly ghost = signal<{ x: number; y: number } | null>(null);
  readonly inRange = signal(false);
  readonly feeding = signal(false);
  readonly watering = computed(() => this.feeding() && this.heldResource() === 'water');
  readonly reducedMotion = signal(false);
  private motionPreference: MediaQueryList | null = null;
  readonly heldPosition = computed(() => {
    const pointer = this.ghost();
    const target = this.localTreeAim();
    const rect = this.layout()?.nativeElement.getBoundingClientRect();
    if (this.pointer && rect)
      return { x: this.pointer.x - rect.left, y: this.pointer.y - rect.top };
    if (pointer || !this.watering()) return pointer;
    return target ? { x: target.x - 90, y: target.y - 100 } : null;
  });
  readonly waterGeometry = computed(() => {
    if (this.heldResource() !== 'water') return null;
    const pointer = this.heldPosition();
    const target = this.localTreeAim();
    return pointer && target ? wateringGeometry(pointer, target) : null;
  });
  readonly lightRate = signal(LIGHT_ENERGY_PER_SECOND);
  readonly waterRate = signal(WATER_DROP_PER_SECOND);
  readonly rateErrors = signal<Record<StreamingCareResource, string | null>>({
    light: null,
    water: null,
  });
  readonly celebration = signal(0);
  readonly feedback = signal('拿起資源，拖到小樹周圍試試看。');
  private readonly lastBurst = signal<CareResource | null>(null);
  readonly resourceEffect = computed(() =>
    this.ps.demoTreeHarvested() ? null : this.feeding() ? this.heldResource() : this.lastBurst(),
  );
  readonly stageLabel = computed(() =>
    this.ps.demoTreeHarvested() ? '已收成' : TREE_STAGE_LABELS[treeStage(this.ps.demoTreeGrowth())],
  );
  readonly harvestPoints = DEMO_HARVEST_POINTS;
  readonly lightEnergyPerGrowth = LIGHT_ENERGY_PER_GROWTH;
  readonly growthPrecision = CARE_GROWTH_PRECISION;
  readonly fruitState = computed<TreeFruitState>(() =>
    this.ps.demoHarvestStartedAt() !== null
      ? 'falling'
      : this.ps.demoFruitReady()
        ? 'ripe'
        : 'none',
  );
  readonly canHarvest = computed(
    () => this.isOpen() && this.canCultivate() && this.ps.demoFruitReady(),
  );
  private previousTreePoints = this.ps.demoTreePoints();
  private readonly now = signal(Date.now());
  readonly waterState = computed(() =>
    treeWaterState(this.ps.demoTreeLastWateredAt(), this.ps.demoTreePlantedAt(), this.now()),
  );
  readonly waterStateLabel = computed(() => TREE_WATER_STATE_LABELS[this.waterState()]);
  readonly fertilized = computed(() =>
    fertilizerActive(this.ps.demoFertilizerExpiresAt(), this.now()),
  );
  readonly fertilizerRemaining = computed(() => {
    const seconds = Math.max(
      0,
      Math.ceil(((this.ps.demoFertilizerExpiresAt() ?? 0) - this.now()) / 1000),
    );
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  });
  readonly harvestRecoveryToastOpen = computed(() => this.isOpen() && this.ps.demoTreeHarvested());
  readonly harvestRecoveryMessage = computed(() => {
    const harvestedAt = this.ps.demoTreeHarvestedAt();
    if (harvestedAt === null) return '';
    const hoursRemaining = Math.max(
      1,
      Math.ceil((harvestedAt + DEMO_HARVEST_RECOVERY_DURATION_MS - this.now()) / (60 * 60 * 1000)),
    );
    return `此樹木已收成，將於${hoursRemaining}小時後搬進你的回憶林。`;
  });
  confirmDestinationCheckIn(): void {
    if (this.isOpen() && this.showDestinationCheckIn() && this.canCultivate()) {
      this.destinationCheckIn.emit();
    }
  }
  private capture: { element: HTMLElement; pointerId: number } | null = null;
  private pointer: { x: number; y: number } | null = null;
  private pendingHarvestResult = false;
  private keyboardFeeding = false;
  private feedingClock: ResourceFeedingClock | null = null;
  private feedingTimer: ReturnType<typeof setInterval> | null = null;
  private statusTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    afterNextRender(() => {
      this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion.set(this.motionPreference.matches);
      this.motionPreference.addEventListener('change', this.motionChanged);
      document.addEventListener('visibilitychange', this.visibilityChanged);
      window.addEventListener('blur', this.interrupted);
    });
    effect(() => {
      const open = this.isOpen();
      untracked(() => {
        if (this.statusTimer !== null) clearInterval(this.statusTimer);
        this.statusTimer = null;
        if (open) {
          this.now.set(Date.now());
          this.statusTimer = setInterval(() => this.now.set(Date.now()), 1000);
        } else {
          this.stopGesture();
        }
      });
    });
    effect(() => {
      const allowed = this.canCultivate();
      const message = this.accessMessage();
      if (!allowed) {
        untracked(() => {
          this.stopGesture();
          this.feedback.set(message ?? '目前僅能查看小樹，請靠近後再培育。');
        });
      }
    });
    effect(() => {
      const points = this.ps.demoTreePoints();
      const earnedPoints = points - this.previousTreePoints;
      this.previousTreePoints = points;
      if (earnedPoints > 0 && this.pendingHarvestResult) {
        this.pendingHarvestResult = false;
        untracked(() => {
          this.feedback.set(`已收成！果實已落地，獲得 ${earnedPoints} 點 Demo 小樹點。`);
          this.dialog.openTreePointResultDialog({
            earnedPoints,
            balance: points,
            isDemo: true,
          });
        });
      }
    });
  }

  private localTreeAim() {
    const target = this.scene()?.wateringAimPoint();
    const rect = this.layout()?.nativeElement.getBoundingClientRect();
    return target && rect ? { x: target.x - rect.left, y: target.y - rect.top } : null;
  }

  openInfoModal(type: string) {
    console.log(type);
  }

  inventory(resource: CareResource): number {
    const inventory = this.ps.inventory();
    return resource === 'light'
      ? inventory.lightEnergy
      : resource === 'water'
        ? inventory.waterDrops
        : inventory.fertilizer;
  }

  canUse(resource: CareResource): boolean {
    if (
      !this.canCultivate() ||
      !this.ps.demoTreePlanted() ||
      this.ps.demoTreeHarvested() ||
      this.ps.demoTreeGrowth() >= this.ps.demoGrowthTarget() ||
      this.inventory(resource) < 1
    )
      return false;
    if (resource === 'fertilizer') {
      return (
        !this.fertilized() && this.ps.demoTreeFertilizedOn() !== taipeiDay(new Date(this.now()))
      );
    }
    if (this.rateErrors()[resource]) return false;
    return resource === 'light'
      ? this.ps.maximumDemoLightAllocation() > 0
      : this.ps.maximumDemoWaterAllocation() > 0;
  }

  rate(resource: StreamingCareResource): number {
    return resource === 'light' ? this.lightRate() : this.waterRate();
  }

  setRate(event: Event, resource: StreamingCareResource): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    this.tickFeeding();
    this.stopGesture();
    const rate = Number(event.target.value);
    if (!Number.isSafeInteger(rate) || rate < 1) {
      this.rateErrors.update((errors) => ({
        ...errors,
        [resource]: '每秒注入量請輸入大於零的安全整數。',
      }));
      return;
    }
    this.rateErrors.update((errors) => ({ ...errors, [resource]: null }));
    if (resource === 'light') this.lightRate.set(rate);
    else this.waterRate.set(rate);
    this.feedback.set('速率已更新，重新拿取資源即可使用新速率。');
  }

  grab(event: PointerEvent, resource: CareResource): void {
    if (!event.isPrimary || event.button !== 0 || !this.isOpen()) return;
    if (!this.canCultivate()) {
      event.preventDefault();
      event.stopPropagation();
      this.interactionDenied.emit();
      return;
    }
    if (!this.canUse(resource)) return;
    if (!(event.currentTarget instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    this.stopGesture();
    this.capture = { element: event.currentTarget, pointerId: event.pointerId };
    this.capture.element.setPointerCapture(event.pointerId);
    this.heldResource.set(resource);
    this.lastBurst.set(null);
    this.movePoint(event.clientX, event.clientY);
    if (resource !== 'fertilizer') this.startFeedingClock(resource);
  }

  move(event: PointerEvent): void {
    if (this.capture?.pointerId !== event.pointerId) return;
    event.preventDefault();
    this.tickFeeding();
    this.movePoint(event.clientX, event.clientY);
  }

  release(event: PointerEvent): void {
    if (this.capture?.pointerId !== event.pointerId) return;
    this.move(event);
    const resource = this.heldResource();
    if (resource === 'fertilizer' && this.inRange()) this.useFertilizer();
    else if (resource === 'fertilizer' && !this.inRange())
      this.feedback.set('請把資源放到小樹周圍的投餵範圍內；這次未扣除庫存。');
    else if (resource) this.feedback.set(resource === 'light' ? '已停止照射。' : '已停止澆水。');
    this.stopGesture();
  }

  cancel(event: PointerEvent): void {
    if (this.capture?.pointerId === event.pointerId) this.stopGesture();
  }

  keyboardUse(resource: CareResource): void {
    if (!this.isOpen() || document.hidden) return;
    if (!this.canCultivate()) {
      this.interactionDenied.emit();
      return;
    }
    if (!this.scene()?.canInteract()) return;
    if (resource === this.heldResource() && this.keyboardFeeding) {
      this.tickFeeding();
      this.stopGesture();
      this.feedback.set(resource === 'light' ? '已停止照射。' : '已停止澆水。');
      return;
    }
    if (!this.canUse(resource)) return;
    this.stopGesture();
    if (resource !== 'fertilizer') {
      this.keyboardFeeding = true;
      this.heldResource.set(resource);
      this.lastBurst.set(null);
      this.inRange.set(true);
      this.feeding.set(true);
      this.startFeedingClock(resource);
    } else {
      this.useFertilizer();
    }
  }

  private movePoint(x: number, y: number): void {
    this.pointer = { x, y };
    const rect = this.layout()?.nativeElement.getBoundingClientRect();
    this.ghost.set(rect ? { x: x - rect.left, y: y - rect.top } : null);
    const inside = this.scene()?.containsFeedingPoint(x, y) ?? false;
    this.inRange.set(inside);
    const resource = this.heldResource();
    this.feeding.set(inside && resource !== null && resource !== 'fertilizer');
    if (this.feeding() && resource && resource !== 'fertilizer') {
      this.feedback.set(
        `${resource === 'light' ? '照射中' : '澆水中'}：每秒消耗 ${this.rate(resource)} ${this.labels[resource]}；拖離或放手即可停止。`,
      );
    } else if (resource && resource !== 'fertilizer') {
      this.feedback.set('將資源移到圈內即可持續投餵。');
    }
  }

  private startFeedingClock(resource: StreamingCareResource): void {
    this.feedingClock = new ResourceFeedingClock(performance.now(), this.rate(resource));
    this.feedingTimer = setInterval(() => this.tickFeeding(), 50);
  }

  private tickFeeding(): void {
    const resource = this.heldResource();
    if (!this.feedingClock || !resource || resource === 'fertilizer') return;
    const scene = this.scene();
    if (document.hidden || !this.isOpen() || !this.canCultivate() || !scene?.canInteract()) {
      this.stopGesture();
      return;
    }
    const amount = this.feedingClock.take(performance.now(), this.feeding());
    if (amount > 0) {
      const maximum =
        resource === 'light'
          ? this.ps.maximumDemoLightAllocation()
          : this.ps.maximumDemoWaterAllocation();
      const spend = Math.min(amount, maximum);
      if (spend <= 0) {
        this.stopAtLimit(resource);
        return;
      }
      const previousStage = treeStage(this.ps.demoTreeGrowth());
      if (
        !this.ps.cultivateDemoTree({
          lightEnergy: resource === 'light' ? spend : 0,
          water: resource === 'water' ? spend : 0,
          fertilizer: false,
        })
      ) {
        this.stopGesture();
        return;
      }
      if (treeStage(this.ps.demoTreeGrowth()) !== previousStage)
        this.celebration.update((value) => value + 1);
      const remaining =
        resource === 'light'
          ? this.ps.maximumDemoLightAllocation()
          : this.ps.maximumDemoWaterAllocation();
      if (remaining === 0) {
        this.stopAtLimit(resource);
        return;
      }
    }
    const inside =
      this.keyboardFeeding ||
      (!!this.pointer && scene.containsFeedingPoint(this.pointer.x, this.pointer.y));
    this.inRange.set(inside);
    this.feeding.set(inside);
  }

  private stopAtLimit(resource: StreamingCareResource): void {
    this.stopGesture();
    this.feedback.set(
      this.inventory(resource) === 0
        ? `${this.labels[resource]}已用完，投餵已停止。`
        : '果實已成熟，已達本次成長上限；左右搖動小樹即可收成。',
    );
  }

  private useFertilizer(): void {
    if (!this.isOpen() || !this.canUse('fertilizer')) return;
    if (!this.ps.activateDemoFertilizer()) {
      this.feedback.set(this.ps.cultivationError() ?? '施肥失敗，請重新選擇。');
      return;
    }
    this.now.set(Date.now());
    this.lastBurst.set('fertilizer');
    this.celebration.update((value) => value + 1);
    this.feedback.set('施肥成功！接下來 24 小時，光能與水滴投餵均加乘 20%。');
  }

  toggleBackpack(): void {
    this.tickFeeding();
    this.stopGesture();
    this.backpackOpen.update((open) => !open);
  }

  useBackpackItem(item: 'fertilizer' | 'seed'): void {
    if (!this.isOpen()) return;
    if (!this.canCultivate()) {
      this.interactionDenied.emit();
      return;
    }
    this.stopGesture();
    if (item === 'fertilizer') {
      this.useFertilizer();
    } else if (this.ps.plantDemoSeed()) {
      this.celebration.update((value) => value + 1);
      this.feedback.set('種植成功！現在可以使用光能、水滴與肥料培養小樹。');
    } else {
      this.feedback.set(this.ps.cultivationError() ?? '種植失敗，請重新選擇。');
    }
  }

  onShakeStarted(): void {
    if (this.isOpen() && !this.canCultivate()) this.interactionDenied.emit();
  }

  harvest(): void {
    if (!this.canHarvest() || document.hidden || !this.scene()?.canInteract()) return;
    this.stopGesture();
    if (!this.ps.startDemoHarvest()) return;
    this.pendingHarvestResult = true;
    this.now.set(Date.now());
    this.feedback.set(`果實掉落中，落地後自動獲得 ${DEMO_HARVEST_POINTS} 點 Demo 小樹點。`);
  }

  private stopGesture(): void {
    if (this.feedingTimer !== null) clearInterval(this.feedingTimer);
    this.feedingTimer = null;
    this.feedingClock = null;
    const capture = this.capture;
    this.capture = null;
    if (capture?.element.hasPointerCapture(capture.pointerId))
      capture.element.releasePointerCapture(capture.pointerId);
    this.pointer = null;
    this.keyboardFeeding = false;
    this.heldResource.set(null);
    this.ghost.set(null);
    this.inRange.set(false);
    this.feeding.set(false);
  }

  private readonly interrupted = (): void => this.stopGesture();
  private readonly motionChanged = (event: MediaQueryListEvent): void =>
    this.reducedMotion.set(event.matches);
  private readonly visibilityChanged = (): void => {
    if (document.hidden) this.stopGesture();
    this.now.set(Date.now());
  };

  pullWeed(weedId: number): void {
    if (!this.isOpen()) return;
    if (!this.canCultivate()) {
      this.interactionDenied.emit();
      return;
    }
    this.tickFeeding();
    this.stopGesture();
    if (this.ps.pullDemoWeed(weedId)) {
      const remaining = this.ps.demoTreeWeeds().length;
      const message =
        remaining === 0 ? '已清除雜草，恢復養分吸收率。' : `已拔除一株雜草，剩餘 ${remaining} 株。`;
      this.feedback.set(message);
      if (remaining === 0) this.feedbackRequested.emit(message);
    } else {
      this.feedback.set(this.ps.cultivationError() ?? '拔草失敗，請重新選擇。');
    }
  }

  onDidPresent(): void {
    this.scene()?.refresh();
  }

  onWillDismiss(): void {
    this.scene()?.cancelWeedPull();
    this.stopGesture();
    this.backpackOpen.set(false);
    this.closing.emit();
  }

  dismissed(): void {
    this.stopGesture();
    this.ws.finishCultivating();
  }

  ngOnDestroy(): void {
    this.stopGesture();
    if (this.statusTimer !== null) clearInterval(this.statusTimer);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    window.removeEventListener('blur', this.interrupted);
    this.motionPreference?.removeEventListener('change', this.motionChanged);
    void this.modal()?.dismiss(undefined, 'handler');
  }
}
