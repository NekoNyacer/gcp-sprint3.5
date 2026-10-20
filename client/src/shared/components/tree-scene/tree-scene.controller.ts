import { TREE_ORNAMENTS } from './tree-canopy-plan';
import { TREE_CAMERA } from './tree-scene-projection';
import { createSeedModel } from './tree-seed';
import { createSaplingModel } from './tree-sapling';
import { createTreeOrnaments } from './tree-ornaments';
import { createTreeGround } from './tree-ground';
import { createTreeModel } from './tree-model';
import {
  Box3,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  Group,
  Float32BufferAttribute,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  LinearFilter,
  PlaneGeometry,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Shape,
  ShapeGeometry,
  ShaderChunk,
  Sphere,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  CareResource,
  CareTarget,
  DEMO_HARVEST_DURATION_MS,
  DEMO_FRUIT_ICON,
  DEMO_FRUIT_PARTICLES,
  DEMO_FRUIT_FALL_DURATION_MS,
  treeStage,
  TreeStage,
  TreeFruitState,
  TreeWaterState,
  TREE_SOIL_COLORS,
  TREE_SOIL_SPARKLES,
  treeVisualScale,
  TREE_STAGES,
  TREE_SWAY_MAX_DEGREES,
  harvestPointMotion,
} from '../../models/tree-cultivation';

export class TreeSceneController {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(TREE_CAMERA.fov, 1, 0.1, 30);
  private readonly tree = new Group();
  private readonly soilSurfaceY: number;
  private readonly ground: Mesh<CylinderGeometry, MeshStandardMaterial>;
  private fruits: Points<BufferGeometry, PointsMaterial> | null = null;
  private fruitPositions: Float32BufferAttribute | null = null;
  private fruitTexture: Texture | null = null;
  private readonly fruitPoint = new Vector3();
  private readonly fruitOrigins = DEMO_FRUIT_PARTICLES.map(
    ({ origin }) => new Vector3(origin.x, origin.y, origin.z),
  );
  private fruitColors: Float32BufferAttribute | null = null;
  private fruitSpins: Float32BufferAttribute | null = null;
  private fruitState: TreeFruitState = 'none';
  private harvestStartedAt: number | null = null;
  private shakeAngle = 0;
  private foliage: Mesh | null = null;
  private foliageRest: Float32Array | null = null;
  private crownAngle = 0;

  private swayPoint(point: Vector3, angle: number): Vector3 {
    if (point.y <= 1.25) return point;
    const height = point.y - 1.25;
    const bend = angle * Math.min(1, height / 0.8);
    const x = point.x;
    point.x = x * Math.cos(bend) - height * Math.sin(bend);
    point.y = 1.25 + x * Math.sin(bend) + height * Math.cos(bend);
    return point;
  }

  private swayCrown(angle: number, pop = 1): void {
    if (!this.foliage || !this.foliageRest || (this.crownAngle === angle && this.popAmount === pop))
      return;
    this.popAmount = pop;
    this.crownAngle = angle;
    const positions = this.foliage.geometry.getAttribute('position');
    const scale = this.foliage.parent!.scale.x;
    const point = new Vector3();
    for (let i = 0; i < positions.count; i++) {
      point.fromArray(this.foliageRest, i * 3);
      const first = Math.floor(i / 6) * 18;
      const cx = (this.foliageRest[first] + this.foliageRest[first + 6]) * 0.5;
      const cy = (this.foliageRest[first + 1] + this.foliageRest[first + 7]) * 0.5;
      const cz = (this.foliageRest[first + 2] + this.foliageRest[first + 8]) * 0.5;
      point
        .set((point.x - cx) * pop + cx, (point.y - cy) * pop + cy, (point.z - cz) * pop + cz)
        .multiplyScalar(scale);
      this.swayPoint(point, angle).divideScalar(scale);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    positions.needsUpdate = true;
    this.foliage.geometry.computeBoundingSphere();
  }
  private readonly sunlight = new DirectionalLight(0xffefd3, 2.5);
  private readonly ambient = new HemisphereLight(0xdbe9e9, 0x52684a, 1.8);
  private readonly sunlightBaseIntensity = 2.5;
  private readonly resize: ResizeObserver;
  private readonly visibility: IntersectionObserver;
  private frame = 0;
  private canvasSize = { width: 0, height: 0 };
  private active = true;
  private disposed = false;
  private celebrationStarted: number | null = null;
  private scaleStarted: number | null = null;
  private scaleFrom = 1;
  private scaleTarget = 1;
  private lastGrowth: number | null = null;
  private ornaments: Mesh | null = null;
  private ornamentRest: Float32Array | null = null;
  private popAmount = 1;
  private currentStage: TreeStage | null = null;
  private resourceEffect: CareResource | null = null;
  private fertilizer: Group | null = null;
  private fertilizerTexture: DataTexture | null = null;
  private fertilizerStarted = 0;
  private soilBounds: CareTarget['soil'] = { x: 0, y: 0, width: 0, height: 0 };
  private viewport = { width: 1, height: 1 };
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFailure: (message: string) => void,
    private readonly onTargetChange: (target: CareTarget) => void,
    private readonly onRendered?: () => void,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(new Color('#b9e6ff'), 0);
    this.camera.position.set(...TREE_CAMERA.position);
    this.camera.lookAt(...TREE_CAMERA.target);
    this.scene.add(this.ambient);
    this.sunlight.position.set(-3, 5, 4);
    this.scene.add(this.sunlight, this.tree);
    const ground = createTreeGround();
    this.ground = ground;
    this.soilSurfaceY = ground.position.y + ground.geometry.parameters.height / 2;
    this.scene.add(ground);
    this.resize = new ResizeObserver(() => this.resizeCanvas());
    this.resize.observe(canvas);
    this.visibility = new IntersectionObserver(([entry]) => {
      this.active = entry.isIntersecting;
      this.syncVisibility();
    });
    this.visibility.observe(canvas);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    document.addEventListener('visibilitychange', this.syncVisibility);
    this.reducedMotion.addEventListener('change', this.motionChanged);
    this.resizeCanvas();
  }

  update(growth: number, celebrate = false, animate = true): void {
    const stage = treeStage(growth);
    const stageChanged = stage !== this.currentStage;
    const previousStage = animate ? this.currentStage : null;
    const growthChanged = growth !== this.lastGrowth || !animate;
    const visualScale = treeVisualScale(growth);
    if (growthChanged) {
      this.scaleFrom = this.tree.scale.x;
      this.scaleTarget = visualScale;
      this.scaleStarted =
        previousStage === null || this.reducedMotion.matches ? null : performance.now();
      if (previousStage === null || this.reducedMotion.matches)
        this.tree.scale.setScalar(visualScale);
      this.lastGrowth = growth;
    }
    if (stageChanged) {
      this.currentStage = stage;
      this.disposeTree();
      if (stage === 'seed') {
        const seed = createSeedModel(this.soilSurfaceY);
        this.tree.add(seed);
      } else if (stage === 'seedling' || stage === 'smallSapling' || stage === 'largeSapling') {
        this.tree.add(createSaplingModel(stage));
      } else {
        const model = createTreeModel(stage === 'young');
        this.tree.add(model);
        const foliage = model.getObjectByName('tree-foliage') as Mesh;
        const vertices = foliage.geometry.getAttribute('position');
        this.foliage = foliage;
        this.foliageRest = new Float32Array(vertices.array);
        this.crownAngle = 0;
      }
      if (stage === 'flowering') {
        this.ornaments = createTreeOrnaments();
        this.ornamentRest = new Float32Array(
          this.ornaments.geometry.getAttribute('position').array,
        );
        this.tree.add(this.ornaments);
      }
      if (previousStage === 'seed' || stage === 'seed') {
        this.scaleFrom = visualScale * 0.96;
        this.tree.scale.setScalar(this.scaleStarted === null ? visualScale : this.scaleFrom);
      }
      this.celebrationStarted =
        previousStage !== null &&
        TREE_STAGES.indexOf(stage) >= 4 &&
        TREE_STAGES.indexOf(stage) > TREE_STAGES.indexOf(previousStage) &&
        !this.reducedMotion.matches
          ? performance.now()
          : null;
      this.updateCareTarget();
    }
    if (stageChanged || growthChanged || celebrate) this.requestFrame();
  }

  setResourceEffect(resource: CareResource | null): void {
    if (resource === this.resourceEffect) return;
    this.resourceEffect = resource;
    this.sunlight.intensity = this.sunlightBaseIntensity + (resource === 'light' ? 1 : 0);
    this.requestFrame();
  }

  setWaterState(state: TreeWaterState): void {
    const color = TREE_SOIL_COLORS[state];
    if (this.ground.material.color.getHex() === color) return;
    this.ground.material.color.setHex(color);
    this.requestFrame();
  }

  setTreeVisible(visible: boolean): void {
    if (this.tree.visible === visible) return;
    this.tree.visible = visible;
    this.requestFrame();
  }

  setFertilized(active: boolean): void {
    if (active === (this.fertilizer !== null)) return;
    if (!active) {
      this.disposeFertilizer();
      this.requestFrame();
      return;
    }
    const group = new Group();
    group.name = 'fertilizer-soil';
    const size = 64;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        const radius = Math.hypot(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1);
        const alpha =
          radius < 0.2
            ? 0.3
            : radius < 0.65
              ? 0.3 - ((radius - 0.2) / 0.45) * 0.1
              : Math.max(0, 1 - (radius - 0.65) / 0.35) * 0.2;
        pixels.set([255, 233, 161, Math.round(alpha * 255)], offset);
      }
    }
    const texture = new DataTexture(pixels, size, size);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    this.fertilizerTexture = texture;
    const glow = new Mesh(
      new PlaneGeometry(2.4, 2.4),
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
    glow.name = 'soil-glow';
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = this.soilSurfaceY + 0.005;
    group.add(glow);
    const star = new Shape();
    star.moveTo(0, 0.5);
    star.lineTo(0.12, 0.12);
    star.lineTo(0.5, 0);
    star.lineTo(0.12, -0.12);
    star.lineTo(0, -0.5);
    star.lineTo(-0.12, -0.12);
    star.lineTo(-0.5, 0);
    star.lineTo(-0.12, 0.12);
    star.closePath();
    for (const _sparkle of TREE_SOIL_SPARKLES) {
      const sparkle = new Mesh(
        new ShapeGeometry(star),
        new MeshBasicMaterial({
          color: 0xfff5c4,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        }),
      );
      sparkle.name = 'soil-sparkle';
      sparkle.quaternion.copy(this.camera.quaternion);
      group.add(sparkle);
    }
    this.fertilizer = group;
    this.fertilizerStarted = performance.now();
    this.scene.add(group);
    this.requestFrame();
  }

  setFruitState(state: TreeFruitState, startedAt: number | null): void {
    if (this.currentStage !== 'large') state = 'none';
    if (state === this.fruitState && startedAt === this.harvestStartedAt) return;
    this.fruitState = state;
    this.harvestStartedAt = startedAt;
    if (state === 'none') {
      this.disposeFruits();
    } else if (!this.fruits) {
      const texture = new TextureLoader().load(
        DEMO_FRUIT_ICON,
        (loaded) => {
          if (this.fruitTexture === loaded) this.requestFrame();
        },
        undefined,
        (error) => {
          if (this.disposed || this.fruitTexture !== texture) return;
          console.error('Tree reward particle texture failed', error);
          this.onFailure('小樹點圖案載入失敗。');
        },
      );
      texture.colorSpace = SRGBColorSpace;
      this.fruitTexture = texture;
      this.fruitPositions = new Float32BufferAttribute(
        new Float32Array(this.fruitOrigins.length * 3),
        3,
      );
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', this.fruitPositions);
      this.fruitColors = new Float32BufferAttribute(
        new Float32Array(this.fruitOrigins.length * 4).fill(1),
        4,
      );
      this.fruitSpins = new Float32BufferAttribute(new Float32Array(this.fruitOrigins.length), 1);
      geometry.setAttribute('color', this.fruitColors);
      geometry.setAttribute('spin', this.fruitSpins);
      this.fruits = new Points(
        geometry,
        new PointsMaterial({
          map: texture,
          vertexColors: true,
          size: 0.12,
          transparent: true,
          alphaTest: 0.05,
          depthWrite: false,
        }),
      );
      this.fruits.material.onBeforeCompile = (shader) => {
        shader.vertexShader = 'attribute float spin; varying float vSpin;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSpin = spin;',
        );
        shader.fragmentShader = 'varying float vSpin;\n' + shader.fragmentShader;
        const map = ShaderChunk.map_particle_fragment.replace(
          'diffuseColor *= texture2D( map, uv );',
          `
          vec2 centered = uv - 0.5;
          float c = cos(vSpin), s = sin(vSpin);
          uv = mat2(c, -s, s, c) * centered + 0.5;
          if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
          diffuseColor *= texture2D(map, uv);
        `,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_particle_fragment>',
          map,
        );
      };
      this.fruits.material.customProgramCacheKey = () => 'tree-reward-spin-v1';
      this.scene.add(this.fruits);
    }
    // Flower positions become visible point icons; all credited points scatter on harvest.
    if (this.fruits) {
      this.fruits.material.depthTest = state !== 'falling';
      this.fruits.geometry.setDrawRange(
        0,
        state === 'ripe' ? TREE_ORNAMENTS.length : this.fruitOrigins.length,
      );
    }
    this.requestFrame();
  }

  setShakeAngle(degrees: number): void {
    this.shakeAngle =
      (-Math.max(-TREE_SWAY_MAX_DEGREES, Math.min(TREE_SWAY_MAX_DEGREES, degrees)) * Math.PI) / 180;
    this.requestFrame();
  }

  stopPointerInteraction(): void {
    this.setShakeAngle(0);
  }

  private updateCareTarget(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    this.camera.updateMatrixWorld();
    const sphere = new Box3().setFromObject(this.tree).getBoundingSphere(new Sphere());
    const center = sphere.center.clone().project(this.camera);
    const root = this.tree.getWorldPosition(new Vector3()).project(this.camera);
    // Keep the interaction area anchored independently of the growing canopy.
    const careCenter = new Vector3(0, 1, 0).project(this.camera);
    const careEdge = new Vector3(1.1, 1, 0).project(this.camera);
    const radius = Math.min(
      Math.min(width, height) * 0.43,
      Math.max(48, (Math.abs(careEdge.x - careCenter.x) * width) / 2),
    );
    const soilRim = Array.from(
      { length: this.ground.geometry.parameters.radialSegments },
      (_, index) => {
        const angle = (index * Math.PI * 2) / this.ground.geometry.parameters.radialSegments;
        const soilRadius = this.ground.geometry.parameters.radiusTop;
        const point = new Vector3(
          Math.sin(angle) * soilRadius,
          this.soilSurfaceY,
          Math.cos(angle) * soilRadius,
        ).project(this.camera);
        return { x: ((point.x + 1) * width) / 2, y: ((1 - point.y) * height) / 2 };
      },
    );
    const soilLeft = Math.min(...soilRim.map((point) => point.x));
    const soilTop = Math.min(...soilRim.map((point) => point.y));
    const target: CareTarget = {
      x: ((careCenter.x + 1) * width) / 2,
      y: Math.min(height - radius, ((1 - careCenter.y) * height) / 2),
      radius,
      modelX: ((center.x + 1) * width) / 2,
      modelY: ((1 - center.y) * height) / 2,
      rootX: ((root.x + 1) * width) / 2,
      rootY: ((1 - root.y) * height) / 2,
      soil: {
        x: soilLeft,
        y: soilTop,
        width: Math.max(...soilRim.map((point) => point.x)) - soilLeft,
        height: Math.max(...soilRim.map((point) => point.y)) - soilTop,
      },
    };
    this.soilBounds = target.soil;
    this.viewport = { width, height };
    this.onTargetChange(target);
  }

  private resizeCanvas(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0 || this.disposed) return;
    if (width !== this.canvasSize.width || height !== this.canvasSize.height) {
      this.renderer.setSize(width, height, false);
      this.canvasSize = { width, height };
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.currentStage !== null) this.updateCareTarget();
    this.requestFrame();
  }

  refresh(): void {
    if (this.disposed) return;
    this.active = this.hasVisibleCanvas();
    this.syncVisibility();
  }

  private hasVisibleCanvas(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth
    );
  }

  private requestFrame(): void {
    if (this.disposed || this.frame || !this.active || document.hidden) return;
    this.frame = requestAnimationFrame(this.render);
  }

  private readonly render = (now: number): void => {
    this.frame = 0;
    if (this.disposed || !this.active || document.hidden || this.currentStage === null) return;
    if (!this.hasVisibleCanvas()) return;
    const growthElapsed =
      this.scaleStarted === null ? 1 : Math.min(1, Math.max(0, (now - this.scaleStarted) / 520));
    const ease = 1 - (1 - growthElapsed) ** 3;
    this.tree.scale.setScalar(this.scaleFrom + (this.scaleTarget - this.scaleFrom) * ease);
    if (growthElapsed >= 1) this.scaleStarted = null;
    const elapsed =
      this.celebrationStarted === null ? 1 : Math.max(0, (now - this.celebrationStarted) / 850);
    const burst = elapsed < 1 ? 1 - Math.exp(-elapsed * 7) * Math.cos(elapsed * Math.PI * 3) : 1;
    if (elapsed >= 1) this.celebrationStarted = null;
    const startedAt = this.harvestStartedAt;
    const falling = this.fruitState === 'falling' && startedAt !== null;
    const progress =
      falling && startedAt !== null
        ? Math.min(1, Math.max(0, (Date.now() - startedAt) / DEMO_HARVEST_DURATION_MS))
        : 0;
    const crownAngle =
      this.shakeAngle +
      (elapsed < 1 ? Math.sin(elapsed * Math.PI * 6) * Math.exp(-elapsed * 4) * 0.018 : 0) +
      (falling && !this.reducedMotion.matches
        ? Math.sin(progress * Math.PI * 8) * 0.018 * (1 - progress)
        : 0);
    this.swayCrown(crownAngle, burst);
    if (this.ornaments && this.ornamentRest) {
      this.ornaments.visible = this.currentStage === 'flowering' || this.fruitState === 'ripe';
      const vertices = this.ornaments.geometry.getAttribute('position');
      const centers = this.ornaments.geometry.getAttribute('popCenter');
      for (let i = 0; i < vertices.count; i++) {
        const point = new Vector3().fromArray(this.ornamentRest, i * 3);
        const center = new Vector3().fromBufferAttribute(centers, i);
        point.sub(center).multiplyScalar(burst).add(center);
        this.swayPoint(point, crownAngle);
        vertices.setXYZ(i, point.x, point.y, point.z);
      }
      vertices.needsUpdate = true;
      this.ornaments.geometry.computeBoundingSphere();
    }
    this.tree.updateMatrixWorld(true);
    this.fruitOrigins.forEach((origin, index) => {
      if (!this.fruitPositions) return;
      const fruit = DEMO_FRUIT_PARTICLES[index];
      const point = this.swayPoint(this.fruitPoint.copy(origin), crownAngle).applyMatrix4(
        this.tree.matrixWorld,
      );
      if (falling) {
        const particleProgress = Math.min(
          1,
          Math.max(
            0,
            (progress * DEMO_HARVEST_DURATION_MS - fruit.delayMs) / DEMO_FRUIT_FALL_DURATION_MS,
          ),
        );
        const motion = harvestPointMotion(index, particleProgress, point);
        point.set(motion.x, motion.y, motion.z);
        this.fruitColors?.setW(index, motion.opacity);
        this.fruitSpins?.setX(index, motion.spin);
      } else {
        this.fruitColors?.setW(index, 1);
        this.fruitSpins?.setX(index, 0);
      }
      this.fruitPositions.setXYZ(index, point.x, point.y, point.z);
    });
    if (this.fruits && this.fruitPositions) {
      this.fruitPositions.needsUpdate = true;
      if (this.fruitColors) this.fruitColors.needsUpdate = true;
      if (this.fruitSpins) this.fruitSpins.needsUpdate = true;
      this.fruits.material.size = 0.12 * (falling ? 1 : burst);
      this.fruits.geometry.computeBoundingSphere();
    }
    this.fertilizer?.children.forEach((object, index) => {
      if (
        !(object instanceof Mesh) ||
        !(object.material instanceof MeshBasicMaterial) ||
        object.name !== 'soil-sparkle'
      )
        return;
      const sparkle = TREE_SOIL_SPARKLES[index - 1];
      const phase = ((now - this.fertilizerStarted) / 1000 - sparkle.delay) / 2.4;
      const pulse = (1 - Math.cos(phase * Math.PI * 2)) / 2;
      const x = this.soilBounds.x + (this.soilBounds.width * sparkle.x) / 100;
      const y = this.soilBounds.y + (this.soilBounds.height * sparkle.y) / 100 - pulse * 10;
      object.position.copy(this.soilEffectPoint(x, y));
      const pixelSize = object.position.distanceTo(this.soilEffectPoint(x + 1, y));
      object.scale.setScalar(pixelSize * 10 * (0.55 + pulse * 0.55));
      object.material.opacity = 0.15 + pulse * 0.85;
    });
    try {
      this.renderScene();
    } catch (error) {
      console.error('Tree scene rendering failed', error);
      this.onFailure('3D 樹木顯示失敗。');
      return;
    }
    if (this.disposed) return;
    this.onRendered?.();
    if (this.scaleStarted !== null || elapsed < 1 || (falling && progress < 1) || this.fertilizer)
      this.requestFrame();
  };

  private renderScene(): void {
    const fertilizer = this.fertilizer;
    if (!fertilizer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const autoClear = this.renderer.autoClear;
    const fruitVisible = this.fruits?.visible;
    const treeVisible = this.tree.visible;
    // Preserve soil depth for the buried seed, but composite sparkles before the tree.
    try {
      this.tree.visible = false;
      if (this.fruits) this.fruits.visible = false;
      fertilizer.visible = false;
      this.renderer.render(this.scene, this.camera);
      this.renderer.autoClear = false;
      this.ground.visible = false;
      fertilizer.visible = true;
      this.renderer.render(this.scene, this.camera);
      fertilizer.visible = false;
      this.tree.visible = treeVisible;
      if (this.fruits) this.fruits.visible = fruitVisible ?? true;
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.renderer.autoClear = autoClear;
      this.ground.visible = true;
      this.tree.visible = treeVisible;
      fertilizer.visible = true;
      if (this.fruits) this.fruits.visible = fruitVisible ?? true;
    }
  }

  private soilEffectPoint(x: number, y: number): Vector3 {
    const point = new Vector3(
      (x / this.viewport.width) * 2 - 1,
      1 - (y / this.viewport.height) * 2,
      0,
    ).unproject(this.camera);
    const direction = point.sub(this.camera.position);
    // Preserve the original screen-space animation while keeping it behind the tree.
    return direction
      .multiplyScalar((-0.4 - this.camera.position.z) / direction.z)
      .add(this.camera.position);
  }

  private readonly contextLost = (event: Event): void => {
    event.preventDefault();
    this.onFailure('3D 顯示中斷。');
  };
  private readonly motionChanged = (): void => {
    if (this.reducedMotion.matches) {
      this.celebrationStarted = null;
      this.scaleStarted = null;
      this.tree.scale.setScalar(this.scaleTarget);
      this.shakeAngle = 0;
      this.requestFrame();
    }
  };
  private readonly syncVisibility = (): void => {
    if (document.hidden || !this.active) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.celebrationStarted = null;
      this.scaleStarted = null;
      this.tree.scale.setScalar(this.scaleTarget);
    } else {
      this.resizeCanvas();
    }
  };

  private disposeTree(): void {
    this.foliage = null;
    this.foliageRest = null;
    this.ornaments = null;
    this.ornamentRest = null;
    this.popAmount = 1;
    this.crownAngle = 0;
    this.disposeGroup(this.tree);
  }

  private disposeFertilizer(): void {
    if (!this.fertilizer) return;
    this.scene.remove(this.fertilizer);
    this.disposeGroup(this.fertilizer);
    this.fertilizer = null;
    this.fertilizerTexture?.dispose();
    this.fertilizerTexture = null;
  }

  private disposeFruits(): void {
    if (!this.fruits) return;
    this.scene.remove(this.fruits);
    this.fruits.geometry.dispose();
    this.fruits.material.dispose();
    this.fruitTexture?.dispose();
    this.fruits = null;
    this.fruitPositions = null;
    this.fruitColors = null;
    this.fruitSpins = null;
    this.fruitTexture = null;
  }

  private disposeGroup(group: Group): void {
    group.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material))
          object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      }
    });
    group.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.visibility.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    document.removeEventListener('visibilitychange', this.syncVisibility);
    this.reducedMotion.removeEventListener('change', this.motionChanged);
    this.disposeTree();
    this.disposeFruits();
    this.disposeFertilizer();
    this.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if ('map' in material && material.map instanceof Texture) material.map.dispose();
          material.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
