import { treeAppearance } from '../../../../../functions/src/tree-species';
import { treeSceneBackground, SceneTimeOfDay } from '../../models/tree-scene-environment';
import { saplingPlan } from './tree-sapling-plan';
import { TREE_GROUND_DETAILS, TREE_TURF_SEGMENTS, treeTurfPoint } from './tree-ground-plan';
import { TreeDisplayService } from '../../services/tree-display.service';
import { TREE_SCENE_RENDERER, TreeSceneRenderer } from './tree-scene-renderer';
import { fallbackTreeFrame, projectTreePoint } from './tree-scene-projection';
import { TREE_ORNAMENTS } from './tree-canopy-plan';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  inject,
  Injector,
  output,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  CareResource,
  CareTarget,
  CarePoint,
  treeStage,
  treeVisualScale,
  TREE_STAGES,
  TreeStage,
  TREE_SWAY_MAX_DEGREES,
  treeParticleRandom,
  harvestPointMotion,
  TREE_STAGE_LABELS,
  TreeFruitState,
  TreeWaterState,
  TREE_SOIL_COLORS,
  TREE_SOIL_SPARKLES,
  TREE_WATER_STATE_LABELS,
  TreeShakeGesture,
  DEMO_FRUIT_ICON,
  DEMO_FRUIT_PARTICLES,
  DEMO_FRUIT_FALL_DURATION_MS,
  treeWeedPosition,
} from '../../models/tree-cultivation';
import type { CultivationWeather } from '../../../environments/environment-dev';

@Component({
  selector: 'app-tree-scene',
  templateUrl: './tree-scene.component.html',
  styleUrl: './tree-scene.component.scss',
  host: { '[class.expanded]': 'expanded()' },
})
export class TreeSceneComponent implements OnDestroy {
  private static owner: TreeSceneComponent | null = null;
  private readonly display = inject(TreeDisplayService);
  private readonly loadRenderer = inject(TREE_SCENE_RENDERER);
  private readonly injector = inject(Injector);
  readonly canvasGeneration = signal(0);
  private readonly mounted = signal(false);
  private readonly acceptedFallback = signal(false);
  readonly renderError = signal<string | null>(null);
  readonly show2D = computed(
    () => !this.ready() && (this.display.mode() === '2d' || this.acceptedFallback()),
  );
  readonly sceneAvailable = computed(() => this.ready() || this.show2D());
  readonly species = input('榕樹');
  readonly appearance = computed(() => treeAppearance(this.species()));
  readonly growth = input(0);
  readonly empty = input(false);
  readonly weather = input<CultivationWeather>('sunny');
  readonly timeOfDay = input<SceneTimeOfDay>('day');
  readonly backgroundUrl = computed(() => treeSceneBackground(this.weather(), this.timeOfDay()));
  readonly rainParticles = Array.from({ length: 48 }, (_, index) => ({
    x: (index * 137 + 23) % 1000,
    duration: 0.8 + (index % 8) * 0.1,
    delay: -((index * 0.173) % 1.5),
    restingY: (index * 193 + 37) % 950,
  }));
  readonly celebration = input(0);
  readonly expanded = input(false);
  readonly interactive = input(false);
  readonly resourceEffect = input<CareResource | null>(null);
  readonly fertilized = input(false);
  readonly weeds = input<readonly number[]>([]);
  readonly weedPulled = output<number>();
  readonly interactionKey = input('');
  readonly pullingWeed = signal<{ id: number; lift: number; uprooted: boolean } | null>(null);
  private weedPointer: {
    element: HTMLElement;
    pointerId: number;
    id: number;
    x: number;
    y: number;
  } | null = null;
  private weedTimer: ReturnType<typeof setTimeout> | null = null;

  beginWeedPull(event: PointerEvent, id: number): void {
    event.stopPropagation();
    if (
      !this.interactive() ||
      !event.isPrimary ||
      event.button !== 0 ||
      document.hidden ||
      this.weedTimer !== null ||
      !(event.currentTarget instanceof HTMLElement)
    )
      return;
    event.preventDefault();
    this.cancelWeedPull();
    this.cancelShake();
    const element = event.currentTarget;
    this.weedPointer = {
      element,
      pointerId: event.pointerId,
      id,
      x: event.clientX,
      y: event.clientY,
    };
    this.pullingWeed.set({ id, lift: 0, uprooted: false });
    element.setPointerCapture(event.pointerId);
  }

  moveWeedPull(event: PointerEvent): void {
    event.stopPropagation();
    const pointer = this.weedPointer;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (!this.interactive() || document.hidden) {
      this.cancelWeedPull();
      return;
    }
    event.preventDefault();
    const lift = Math.max(0, Math.min(64, pointer.y - event.clientY));
    this.pullingWeed.set({ id: pointer.id, lift, uprooted: false });
  }

  endWeedPull(event: PointerEvent): void {
    event.stopPropagation();
    const pointer = this.weedPointer;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const lift = pointer.y - event.clientY;
    const valid =
      this.interactive() &&
      !document.hidden &&
      lift >= 32 &&
      Math.abs(event.clientX - pointer.x) <= Math.max(32, lift * 0.8);
    this.cancelWeedPull();
    if (!valid) return;
    this.finishWeedPull(pointer.id, Math.min(64, lift));
  }

  pullWeedWithKeyboard(event: KeyboardEvent, id: number): void {
    if (event.key !== 'ArrowUp') return;
    event.stopPropagation();
    event.preventDefault();
    if (event.repeat || !this.interactive() || document.hidden || this.weedTimer !== null) return;
    this.cancelWeedPull();
    this.finishWeedPull(id, 32);
  }

  private finishWeedPull(id: number, lift: number): void {
    this.pullingWeed.set({ id, lift, uprooted: true });
    this.weedTimer = setTimeout(
      () => {
        this.weedTimer = null;
        this.pullingWeed.set(null);
        if (
          !this.destroyed &&
          this.interactive() &&
          !document.hidden &&
          this.weeds().includes(id)
        ) {
          this.weedPulled.emit(id);
        }
      },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220,
    );
  }

  cancelWeedEvent(event: PointerEvent): void {
    event.stopPropagation();
    if (this.weedPointer?.pointerId === event.pointerId) this.cancelWeedPull();
  }

  readonly cancelWeedPull = (): void => {
    const pointer = this.weedPointer;
    this.weedPointer = null;
    if (this.weedTimer !== null) clearTimeout(this.weedTimer);
    this.weedTimer = null;
    this.pullingWeed.set(null);
    if (pointer?.element.hasPointerCapture(pointer.pointerId)) {
      pointer.element.releasePointerCapture(pointer.pointerId);
    }
  };
  readonly weedPositions = computed(() => {
    const soil = this.target().soil;
    return this.weeds().map((id) => {
      const position = treeWeedPosition(id);
      return {
        id,
        x: soil.x + (soil.width * position.x) / 100,
        y: soil.y + (soil.height * position.y) / 100,
      };
    });
  });
  readonly waterState = input<TreeWaterState>('normal');
  readonly soilWaterState = computed<TreeWaterState>(() =>
    this.empty() && this.weather() === 'rainy' ? 'watered' : this.waterState(),
  );
  readonly soilColor = computed(() => `#${TREE_SOIL_COLORS[this.soilWaterState()].toString(16)}`);
  readonly waterStateLabel = computed(() => TREE_WATER_STATE_LABELS[this.waterState()]);
  readonly targeting = input(false);
  readonly fruitState = input<TreeFruitState>('none');
  readonly harvestStartedAt = input<number | null>(null);
  readonly canHarvest = input(false);
  readonly shakeStarted = output<void>();
  readonly harvestRequested = output<void>();
  readonly shakeAngle = signal(0);
  readonly fallbackFruits = DEMO_FRUIT_PARTICLES.map((particle, index) => {
    const { x, y } = particle;
    const motionStyle: Record<string, string> = {};
    for (const percent of [25, 50, 65, 80, 100]) {
      const motion = harvestPointMotion(index, percent / 100, {
        x: (x - 160) / 85,
        y: (211 - y) / 65,
        z: 0,
      });
      motionStyle[`--p${percent}-x`] = 160 + motion.x * 85 - x + 'px';
      motionStyle[`--p${percent}-y`] = 211 - motion.y * 65 + motion.z * 10 - y + 'px';
      motionStyle[`--p${percent}-spin`] = motion.spin + 'rad';
      motionStyle[`--p${percent}-alpha`] = String(motion.opacity);
    }
    return { ...particle, x, y, motionStyle };
  });
  readonly fallenLeaves = signal<
    {
      id: number;
      x: number;
      y: number;
      drift: number;
      drop: number;
      spin: number;
      duration: number;
    }[]
  >([]);
  private leafSequence = 0;
  private lastLeafBurst = -Infinity;
  private leafCleanup: ReturnType<typeof setTimeout> | null = null;
  private previousFruitState: TreeFruitState = 'none';

  private spawnFallingLeaves(force = false): void {
    const now = performance.now();
    if (
      this.empty() ||
      TREE_STAGES.indexOf(this.stage()) < 4 ||
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (!force && now - this.lastLeafBurst < 320)
    )
      return;
    this.lastLeafBurst = now;
    const target = this.target();
    const leaves = Array.from({ length: force ? 6 : 3 }, () => {
      const id = this.leafSequence++;
      const x = target.modelX + (treeParticleRandom(id, 12) - 0.5) * target.radius * 1.5;
      const y =
        target.modelY - target.radius * 0.35 + treeParticleRandom(id, 13) * target.radius * 0.45;
      return {
        id,
        x,
        y,
        drift: (treeParticleRandom(id, 14) - 0.5) * 55,
        drop: Math.max(18, target.rootY - y + 3),
        spin: (treeParticleRandom(id, 15) - 0.5) * 500,
        duration: 1100 + treeParticleRandom(id, 16) * 550,
      };
    });
    this.fallenLeaves.update((current) => [...current, ...leaves].slice(-12));
    if (this.leafCleanup !== null) clearTimeout(this.leafCleanup);
    this.leafCleanup = setTimeout(() => {
      this.leafCleanup = null;
      this.fallenLeaves.set([]);
    }, 1700);
  }

  readonly clearFallingLeaves = (): void => {
    if (this.leafCleanup !== null) clearTimeout(this.leafCleanup);
    this.leafCleanup = null;
    this.fallenLeaves.set([]);
    this.lastLeafBurst = -Infinity;
  };
  readonly fruitIcon = DEMO_FRUIT_ICON;
  readonly fruitFallDuration = DEMO_FRUIT_FALL_DURATION_MS;
  readonly soilSparkles = TREE_SOIL_SPARKLES;
  readonly fruitAnimationDelay = computed(() => {
    const startedAt = this.harvestStartedAt();
    return startedAt === null ? 0 : -Math.max(0, Date.now() - startedAt);
  });
  readonly target = signal<CareTarget>({
    x: 0,
    y: 0,
    radius: 0,
    modelX: 0,
    modelY: 0,
    rootX: 0,
    rootY: 0,
    soil: { x: 0, y: 0, width: 0, height: 0 },
  });
  readonly ready = signal(false);
  private readonly fallbackViewport = signal({ width: 320, height: 240 });
  readonly fallbackViewBox = computed(() => {
    const { width, height } = this.fallbackViewport();
    return `0 0 ${width} ${height}`;
  });
  readonly fallbackFrame = computed(() => {
    const { width, height } = this.fallbackViewport();
    return fallbackTreeFrame(width, height, this.visualScale());
  });
  readonly groundDetails = computed(() => {
    const { width, height } = this.fallbackViewport();
    return TREE_GROUND_DETAILS.map((detail) => {
      const point = projectTreePoint(width, height, detail.x, -0.03, detail.z);
      const edge = projectTreePoint(width, height, detail.x + 1, -0.03, detail.z);
      return {
        ...detail,
        transform: `translate(${point.x} ${point.y}) scale(${(edge.x - point.x) * detail.size})`,
      };
    });
  });
  readonly turfPath = computed(() => {
    const { width, height } = this.fallbackViewport();
    const { soil } = this.fallbackFrame();
    return [1, 0]
      .map(
        (band) =>
          Array.from({ length: TREE_TURF_SEGMENTS }, (_, index) => {
            const angle = (index * Math.PI * 2) / TREE_TURF_SEGMENTS;
            const point = treeTurfPoint(angle, band);
            const projected = projectTreePoint(width, height, point.x, -0.025, point.z);
            return `${index ? 'L' : 'M'}${74 + ((projected.x - soil.x) * 172) / soil.width} ${196 + ((projected.y - soil.y) * 30) / soil.height}`;
          }).join(' ') + 'Z',
      )
      .join(' ');
  });
  readonly fallbackReason = computed(() =>
    this.show2D() ? '目前使用 2D 樹木。' : '正在載入 3D 樹木…',
  );
  readonly stage = computed(() => treeStage(this.growth()));
  readonly visualScale = computed(() => treeVisualScale(this.growth()));
  readonly stageBurst = signal(false);
  private previousStage: TreeStage | null = null;
  private previousTreeKey: string | null = null;
  readonly ornaments = TREE_ORNAMENTS.map((point) => ({
    x: 160 + point.x * 58,
    y: 210 - point.y * 58,
  }));
  readonly sapling = computed(() => {
    const stage = this.stage();
    if (stage !== 'seedling' && stage !== 'smallSapling' && stage !== 'largeSapling') return null;
    const plan = saplingPlan(stage);
    return {
      branches: plan.branches.map(({ points, radius }) => ({
        d:
          `M${160 + points[0][0] * 58} ${210 - points[0][1] * 58} ` +
          (points.length === 3
            ? `Q${160 + points[1][0] * 58} ${210 - points[1][1] * 58} ${160 + points[2][0] * 58} ${210 - points[2][1] * 58}`
            : `C${160 + points[1][0] * 58} ${210 - points[1][1] * 58} ${160 + points[2][0] * 58} ${210 - points[2][1] * 58} ${160 + points[3][0] * 58} ${210 - points[3][1] * 58}`),
        width: radius * 100,
      })),
      leaves: plan.leaves.map(({ x, y, angle, length }) => ({
        transform: `translate(${160 + x * 58} ${210 - y * 58}) rotate(${(-angle * 180) / Math.PI}) scale(${length * 58})`,
      })),
    };
  });
  readonly canSway = computed(
    () =>
      this.interactive() &&
      this.sceneAvailable() &&
      (this.stage() === 'mature' || this.stage() === 'flowering' || this.stage() === 'large') &&
      this.fruitState() !== 'falling',
  );
  readonly canShakeHarvest = computed(
    () =>
      this.canSway() &&
      this.stage() === 'large' &&
      this.canHarvest() &&
      this.fruitState() === 'ripe',
  );
  readonly label = computed(() => (this.empty() ? '空的種植點' : TREE_STAGE_LABELS[this.stage()]));
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private controller: TreeSceneRenderer | null = null;
  private renderGeneration = 0;
  private initializing = false;
  private destroyed = false;
  private previousCelebration = 0;
  private resize: ResizeObserver | null = null;
  private readonly shakeGesture = new TreeShakeGesture();
  private shakePointer: { element: HTMLElement; id: number; previousX: number } | null = null;

  constructor() {
    effect(() => {
      this.display.mode();
      if (!this.mounted()) return;
      untracked(() => {
        this.releaseRenderer();
        this.acceptedFallback.set(false);
        this.renderError.set(null);
        if (this.display.mode() === '3d') this.start3D();
        else this.updateFallbackTarget();
      });
    });
    effect(() => {
      this.weeds();
      this.interactionKey();
      this.interactive();
      this.cancelWeedPull();
      this.clearFallingLeaves();
    });
    afterRenderEffect(() => {
      if (this.ready()) this.controller?.refresh();
    });
    afterNextRender(() => {
      this.resize = new ResizeObserver(() => {
        if (!this.ready()) this.updateFallbackTarget();
      });
      this.resize.observe(this.canvas()!.nativeElement);
      this.updateFallbackTarget();
      window.addEventListener('blur', this.cancelShake);
      window.addEventListener('blur', this.cancelWeedPull);
      window.addEventListener('blur', this.clearFallingLeaves);
      document.addEventListener('visibilitychange', this.visibilityChanged);
      this.mounted.set(true);
    });
    effect(() => {
      const growth = this.growth();
      const species = this.species();
      const stage = this.stage();
      const key = this.interactionKey();
      const sameTree = this.previousTreeKey === key;
      if (!sameTree) this.previousStage = null;
      this.previousTreeKey = key;
      let enteringStage = false;
      if (stage !== this.previousStage) {
        enteringStage =
          this.previousStage !== null &&
          TREE_STAGES.indexOf(stage) >= 4 &&
          TREE_STAGES.indexOf(stage) > TREE_STAGES.indexOf(this.previousStage);
        this.stageBurst.set(enteringStage);
        this.previousStage = stage;
      }
      const empty = this.empty();
      const soilWaterState = this.soilWaterState();
      const celebration = this.celebration();
      this.controller?.setResourceEffect(this.resourceEffect());
      this.controller?.setTreeVisible(!empty);
      this.controller?.setWaterState(soilWaterState);
      this.controller?.setFertilized(this.fertilized());
      this.controller?.update(growth, celebration !== this.previousCelebration, sameTree, species);
      const fruitState = this.fruitState();
      this.controller?.setFruitState(fruitState, this.harvestStartedAt());
      if (enteringStage || (fruitState === 'falling' && this.previousFruitState !== 'falling')) {
        untracked(() => this.spawnFallingLeaves(true));
      }
      this.previousFruitState = fruitState;
      if (!this.canSway()) this.cancelShake();
      else if (!this.canShakeHarvest()) this.shakeGesture.reset();
      if (!this.ready()) this.updateFallbackTarget();
      this.previousCelebration = celebration;
    });
  }

  private start3D(): void {
    if (this.initializing || this.destroyed || this.display.mode() === '2d') return;
    this.initializing = true;
    const generation = this.renderGeneration;
    // A disposed WebGL context is lost. Retry/mode changes need a fresh canvas.
    this.canvasGeneration.update((value) => value + 1);
    afterNextRender(
      () => {
        if (this.destroyed || generation !== this.renderGeneration) return;
        this.resize?.disconnect();
        this.resize?.observe(this.canvas()!.nativeElement);
        void this.initialize(generation);
      },
      { injector: this.injector },
    );
  }

  private async initialize(generation: number): Promise<void> {
    try {
      const { TreeSceneController } = await this.loadRenderer();
      if (this.destroyed || generation !== this.renderGeneration) return;
      if (TreeSceneComponent.owner !== this) TreeSceneComponent.owner?.releaseRenderer();
      TreeSceneComponent.owner = this;
      this.controller = new TreeSceneController(
        this.canvas()!.nativeElement,
        (reason) => {
          if (!this.destroyed && generation === this.renderGeneration) this.requestFallback(reason);
        },
        (target) => this.target.set(target),
        () => {
          if (!this.destroyed && generation === this.renderGeneration && this.controller)
            this.ready.set(true);
        },
      );
      this.controller.setResourceEffect(this.resourceEffect());
      this.controller.setWaterState(this.soilWaterState());
      this.controller.setFertilized(this.fertilized());
      this.controller.update(this.growth(), false, true, this.species());
      this.controller.setTreeVisible(!this.empty());
      this.controller.setFruitState(this.fruitState(), this.harvestStartedAt());
    } catch (error) {
      if (this.destroyed || generation !== this.renderGeneration) return;
      console.error('Tree scene initialization failed', error);
      this.requestFallback('無法載入 3D 樹木。');
    } finally {
      if (generation === this.renderGeneration) this.initializing = false;
    }
  }

  refresh(): void {
    if (this.destroyed) return;
    if (this.controller) this.controller.refresh();
    else if (this.show2D()) this.updateFallbackTarget();
    else if (!this.renderError()) this.start3D();
  }

  private releaseRenderer(): void {
    this.renderGeneration++;
    this.initializing = false;
    this.cancelShake();
    this.cancelWeedPull();
    this.clearFallingLeaves();
    this.controller?.dispose();
    this.controller = null;
    if (TreeSceneComponent.owner === this) TreeSceneComponent.owner = null;
    this.ready.set(false);
  }

  private requestFallback(reason: string): void {
    this.releaseRenderer();
    this.renderError.set(reason);
  }

  confirmFallback(): void {
    this.renderError.set(null);
    this.acceptedFallback.set(true);
    if (!this.destroyed) this.updateFallbackTarget();
  }

  retry3D(): void {
    this.releaseRenderer();
    this.acceptedFallback.set(false);
    this.renderError.set(null);
    this.start3D();
  }

  private updateFallbackTarget(): void {
    const canvas = this.canvas();
    if (!canvas) return;
    const { width, height } = canvas.nativeElement.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    if (this.fallbackViewport().width !== width || this.fallbackViewport().height !== height)
      this.fallbackViewport.set({ width, height });
    const { root, soil, model } = fallbackTreeFrame(width, height, this.visualScale());
    const center = projectTreePoint(width, height, 0, 1);
    const edge = projectTreePoint(width, height, 1.1, 1);
    const radius = Math.min(Math.min(width, height) * 0.43, Math.max(48, edge.x - center.x));
    this.target.set({
      x: center.x,
      y: Math.min(height - radius, center.y),
      radius,
      modelX: model.x,
      modelY: this.stage() === 'seed' ? projectTreePoint(width, height, 0, 0.07).y : model.y,
      rootX: root.x,
      rootY: root.y,
      soil,
    });
  }

  wateringAimPoint(): CarePoint | null {
    if (!this.sceneAvailable()) return null;
    const target = this.target();
    const canvas = this.canvas();
    if (!canvas) return null;
    const rect = canvas.nativeElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { x: rect.left + target.rootX, y: rect.top + target.rootY };
  }

  beginShake(event: PointerEvent): void {
    if (
      !this.canSway() ||
      !event.isPrimary ||
      event.button !== 0 ||
      document.hidden ||
      !this.containsFeedingPoint(event.clientX, event.clientY) ||
      !(event.currentTarget instanceof HTMLElement)
    )
      return;
    event.preventDefault();
    this.cancelShake();
    const element = event.target instanceof HTMLCanvasElement ? event.target : event.currentTarget;
    this.shakePointer = { element, id: event.pointerId, previousX: event.clientX };
    element.setPointerCapture(event.pointerId);
    if (this.canShakeHarvest()) this.shakeGesture.move(event.clientX, performance.now());
    this.shakeStarted.emit();
  }

  moveShake(event: PointerEvent): void {
    const pointer = this.shakePointer;
    if (!pointer || pointer.id !== event.pointerId || !event.isPrimary) return;
    if (document.hidden || !this.canSway() || !this.canInteract()) {
      this.cancelShake();
      return;
    }
    event.preventDefault();
    const angle = Math.max(
      -TREE_SWAY_MAX_DEGREES,
      Math.min(TREE_SWAY_MAX_DEGREES, (event.clientX - pointer.previousX) * 0.05),
    );
    pointer.previousX = event.clientX;
    this.shakeAngle.set(angle);
    this.controller?.setShakeAngle(angle);
    if (Math.abs(angle) > 0.2) this.spawnFallingLeaves();
    if (!this.canShakeHarvest()) this.shakeGesture.reset();
    else if (this.shakeGesture.move(event.clientX, performance.now())) {
      this.cancelShake();
      this.harvestRequested.emit();
    }
  }

  endShake(event: PointerEvent): void {
    if (this.shakePointer?.id === event.pointerId) this.cancelShake();
  }

  readonly cancelShake = (): void => {
    const pointer = this.shakePointer;
    this.shakePointer = null;
    this.shakeGesture.reset();
    this.shakeAngle.set(0);
    if (pointer) {
      this.controller?.stopPointerInteraction();
      if (pointer.element.hasPointerCapture(pointer.id))
        pointer.element.releasePointerCapture(pointer.id);
    }
  };

  private readonly visibilityChanged = (): void => {
    if (document.hidden) {
      this.cancelShake();
      this.cancelWeedPull();
      this.clearFallingLeaves();
    }
  };

  containsFeedingPoint(clientX: number, clientY: number): boolean {
    const canvas = this.canvas();
    if (!canvas) return false;
    const rect = canvas.nativeElement.getBoundingClientRect();
    const { x, y, radius } = this.target();
    return (
      this.canInteract() &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom &&
      Math.hypot(clientX - rect.left - x, clientY - rect.top - y) <= radius
    );
  }

  canInteract(): boolean {
    if (!this.sceneAvailable()) return false;
    const canvas = this.canvas();
    if (!canvas) return false;
    const rect = canvas.nativeElement.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearFallingLeaves();
    this.cancelWeedPull();
    this.cancelShake();
    window.removeEventListener('blur', this.cancelShake);
    window.removeEventListener('blur', this.cancelWeedPull);
    window.removeEventListener('blur', this.clearFallingLeaves);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.resize?.disconnect();
    this.releaseRenderer();
  }
}
