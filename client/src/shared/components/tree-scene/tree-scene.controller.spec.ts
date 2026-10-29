import { TREE_ORNAMENTS } from './tree-canopy-plan';
import {
  Box3,
  DirectionalLight,
  CylinderGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  ShapeGeometry,
  Vector3,
} from 'three';
import { TreeSceneController } from './tree-scene.controller';
import { TREE_GROWTH_PER_HARVEST } from '../../../environments/environment-dev';
import {
  DEMO_FRUIT_ICON,
  DEMO_FRUIT_PARTICLES,
  DEMO_HARVEST_DURATION_MS,
  CareTarget,
  TREE_SOIL_SPARKLES,
} from '../../models/tree-cultivation';

const renderer = vi.hoisted(() => ({
  render: vi.fn<(scene: Scene, camera: PerspectiveCamera) => void>(),
  loadTexture: vi.fn<(url: string) => void>(),
  setSize: vi.fn(),
}));

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>();
  return Object.assign({}, three, {
    WebGLRenderer: class {
      autoClear = true;
      render = renderer.render;
      setPixelRatio() {}
      setClearColor() {}
      setSize = renderer.setSize;
      dispose() {}
      forceContextLoss() {}
    },
    TextureLoader: class {
      load(url: string) {
        renderer.loadTexture(url);
        return new three.Texture();
      }
    },
  });
});

describe('TreeSceneController planted seed', () => {
  let controller: TreeSceneController | undefined;
  let frame: FrameRequestCallback | undefined;
  let visibilityChanged: (visible: boolean) => void;

  beforeEach(() => {
    renderer.render.mockReset();
    renderer.loadTexture.mockClear();
    renderer.setSize.mockClear();
    frame = undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          visibilityChanged = (isIntersecting) => callback([{ isIntersecting }]);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  });

  afterEach(() => {
    controller?.dispose();
    controller = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setup() {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 240));
    const onTarget = vi.fn<(target: CareTarget) => void>();
    const onRendered = vi.fn();
    const instance = new TreeSceneController(canvas, vi.fn(), onTarget, onRendered);
    controller = instance;
    return {
      controller: instance,
      canvas,
      onTarget,
      onRendered,
      draw(now = performance.now()): Scene {
        frame!(now);
        return renderer.render.mock.lastCall![0];
      },
    };
  }

  it('keeps a hidden modal unready and redraws when presentation makes it visible', () => {
    const { controller, canvas, draw, onRendered } = setup();
    const rect = vi.mocked(canvas.getBoundingClientRect);
    rect.mockReturnValue(new DOMRect(0, 0, 0, 0));
    controller.update(TREE_GROWTH_PER_HARVEST);
    frame!(performance.now());
    expect(renderer.render).not.toHaveBeenCalled();
    expect(onRendered).not.toHaveBeenCalled();
    visibilityChanged(false);
    rect.mockReturnValue(new DOMRect(0, 0, 320, 240));
    controller.refresh();
    draw();
    expect(renderer.render).toHaveBeenCalledOnce();
    expect(onRendered).toHaveBeenCalledOnce();
    expect(renderer.setSize).toHaveBeenCalledOnce();
    controller.refresh();
    draw();
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.setSize).toHaveBeenCalledOnce();
  });

  it('waits for an onscreen model frame and ignores stale frames after teardown', () => {
    const { controller, canvas, draw, onRendered } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST);
    vi.mocked(canvas.getBoundingClientRect).mockReturnValue(
      new DOMRect(0, innerHeight + 10, 320, 240),
    );
    frame!(performance.now());
    expect(onRendered).not.toHaveBeenCalled();
    controller.dispose();
    vi.mocked(canvas.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 320, 240));
    controller.refresh();
    frame!(performance.now());
    expect(renderer.render).not.toHaveBeenCalled();
    expect(onRendered).not.toHaveBeenCalled();
  });

  it('re-measures and redraws after the document becomes visible', () => {
    const { controller, canvas, draw, onRendered } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    frame!(performance.now());
    expect(onRendered).not.toHaveBeenCalled();
    vi.mocked(canvas.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 640, 480));
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    draw();
    expect(renderer.setSize).toHaveBeenLastCalledWith(640, 480, false);
    expect(onRendered).toHaveBeenCalledOnce();
  });

  function soil(scene: Scene): Mesh<CylinderGeometry, MeshStandardMaterial> {
    return scene.children.find(
      (object): object is Mesh<CylinderGeometry, MeshStandardMaterial> =>
        object instanceof Mesh &&
        object.geometry instanceof CylinderGeometry &&
        object.material instanceof MeshStandardMaterial,
    )!;
  }

  function seed(scene: Scene): Mesh<SphereGeometry> | undefined {
    return scene
      .getObjectsByProperty('type', 'Mesh')
      .find(
        (object): object is Mesh<SphereGeometry> =>
          object instanceof Mesh && object.geometry instanceof SphereGeometry,
      );
  }

  function particles(scene: Scene): Points<BufferGeometry, PointsMaterial> | undefined {
    return scene.children.find(
      (object): object is Points<BufferGeometry, PointsMaterial> =>
        object instanceof Points && object.material instanceof PointsMaterial,
    );
  }

  it('retains wet soil after pouring stops and applies normal/dry colors without rebuilding it', () => {
    const { controller, draw } = setup();
    controller.update(0);
    const ground = soil(draw());
    controller.setWaterState('watered');
    controller.setResourceEffect('water');
    expect(soil(draw()).material.color.getHex()).toBe(0x61432e);
    controller.setResourceEffect(null);
    controller.update(TREE_GROWTH_PER_HARVEST * 0.6);
    expect(soil(draw())).toBe(ground);
    expect(ground.material.color.getHex()).toBe(0x61432e);
    controller.setWaterState('normal');
    expect(soil(draw()).material.color.getHex()).toBe(0x9b7048);
    controller.setWaterState('dry');
    expect(soil(draw()).material.color.getHex()).toBe(0xbf986c);
  });

  it('keeps bright daylight lighting and restores it after resource feedback', () => {
    const { controller, draw } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST * 0.6);
    const scene = draw();
    const sunlight = scene.children.find(
      (object): object is DirectionalLight => object instanceof DirectionalLight,
    )!;
    expect(sunlight.intensity).toBe(2.5);
    expect(sunlight.color.getHex()).toBe(0xffefd3);
    controller.setResourceEffect('light');
    expect(sunlight.intensity).toBe(3.5);
    controller.setResourceEffect(null);
    expect(sunlight.intensity).toBe(2.5);
  });

  it('hides an empty planting point tree without hiding its soil platform', () => {
    const { controller, draw } = setup();
    controller.update(0);
    controller.setTreeVisible(false);

    let scene = draw();
    const tree = scene.children.find((object) => object instanceof Group)!;
    expect(tree.visible).toBe(false);
    expect(soil(scene).visible).toBe(true);

    controller.setFertilized(true);
    scene = draw();
    expect(tree.visible).toBe(false);
    expect(soil(scene).visible).toBe(true);

    controller.setTreeVisible(true);
    draw();
    expect(tree.visible).toBe(true);
  });

  it('projects the soil surface independently of tree size and scales it with the viewport', () => {
    const { controller, canvas, onTarget } = setup();
    controller.update(0);
    const target = onTarget.mock.lastCall![0];
    expect(target.soil.width).toBeGreaterThan(0);
    expect(target.soil.height).toBeGreaterThan(0);
    expect(target.soil.x).toBeLessThan(target.rootX);
    expect(target.soil.x + target.soil.width).toBeGreaterThan(target.rootX);
    expect(target.soil.y).toBeLessThan(target.rootY);
    expect(target.soil.y + target.soil.height).toBeGreaterThan(target.rootY);
    controller.update(TREE_GROWTH_PER_HARVEST * 0.1);
    expect(onTarget.mock.lastCall![0].soil).toEqual(target.soil);
    vi.mocked(canvas.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 640, 480));
    controller.update(TREE_GROWTH_PER_HARVEST * 0.6);
    const soil = onTarget.mock.lastCall![0].soil;
    expect(soil.x).toBeCloseTo(target.soil.x * 2);
    expect(soil.y).toBeCloseTo(target.soil.y * 2);
    expect(soil.width).toBeCloseTo(target.soil.width * 2);
    expect(soil.height).toBeCloseTo(target.soil.height * 2);
  });

  it('keeps the interaction area fixed across stages and updates it on resize', () => {
    let resize = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const { controller, canvas, onTarget } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST * 0.3);
    const young = onTarget.mock.lastCall![0];
    for (const ratio of [0.6, 1, 10, 0.1, 0]) {
      controller.update(TREE_GROWTH_PER_HARVEST * ratio);
      const target = onTarget.mock.lastCall![0];
      expect(target.x).toBe(young.x);
      expect(target.y).toBe(young.y);
      expect(target.radius).toBe(young.radius);
      expect(target.rootX).toBe(young.rootX);
      expect(target.rootY).toBe(young.rootY);
      if (ratio === 0.6) expect(target.modelY).toBeLessThan(young.modelY);
    }
    vi.mocked(canvas.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 640, 480));
    resize();
    const resized = onTarget.mock.lastCall![0];
    expect(resized.x).toBeCloseTo(young.x * 2);
    expect(resized.y).toBeCloseTo(young.y * 2);
    expect(resized.radius).toBeCloseTo(young.radius * 2);
    controller.update(TREE_GROWTH_PER_HARVEST * 0.6);
    expect(onTarget.mock.lastCall![0].y).toBe(resized.y);
  });

  it('caps fruiting and later size while keeping the mature silhouette bounded', () => {
    const { controller, draw } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST);
    const tree = draw().children.find((object) => object instanceof Group)!;
    const bounds = new Box3().setFromObject(tree);
    const foliage = tree.getObjectByName('tree-foliage') as Mesh;
    const branches = tree.getObjectByName('tree-branches') as Mesh;
    expect(foliage.geometry.getAttribute('position').count / 3).toBe(13200);
    expect(branches.geometry.getAttribute('position').count).toBeLessThan(10000);
    controller.update(TREE_GROWTH_PER_HARVEST * 10);
    draw(performance.now() + 1000);
    const later = new Box3().setFromObject(tree);
    expect(later.min.toArray()).toEqual(bounds.min.toArray());
    expect(later.max.toArray()).toEqual(bounds.max.toArray());
  });

  it('builds sparse plants with increasing branch and leaf counts before a canopy', () => {
    const { controller, draw } = setup();
    const leafCounts: number[] = [];
    for (const ratio of [0.1, 0.16, 0.23]) {
      controller.update(TREE_GROWTH_PER_HARVEST * ratio);
      const tree = draw(performance.now() + 1000).children.find(
        (object) => object instanceof Group,
      )!;
      expect(tree.getObjectByName('sapling-stem')).toBeInstanceOf(Mesh);
      expect(tree.getObjectByName('tree-foliage')).toBeUndefined();
      const leaves = tree.getObjectByName('sapling-leaves') as Mesh;
      leafCounts.push(leaves.geometry.getAttribute('position').count);
    }
    expect(leafCounts[1]).toBeGreaterThan(leafCounts[0]);
    expect(leafCounts[2]).toBeGreaterThan(leafCounts[1]);
    const tree = draw().children.find((object) => object instanceof Group)!;
    const old = tree.getObjectByName('sapling-leaves') as Mesh;
    const disposed = vi.spyOn(old.geometry, 'dispose');
    controller.update(TREE_GROWTH_PER_HARVEST * 0.3);
    draw(performance.now() + 1000);
    expect(tree.getObjectByName('sapling-stem')).toBeUndefined();
    expect(tree.getObjectByName('tree-foliage')).toBeInstanceOf(Mesh);
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('smoothly grows on every credit without shrinking or replaying a pulse', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { controller, draw } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST * 0.4);
    const tree = draw(now).children.find((object) => object instanceof Group)!;
    const before = tree.scale.x;
    controller.update(TREE_GROWTH_PER_HARVEST * 0.45);
    const sizes = [before];
    for (const step of [100, 260, 520, 800]) {
      now = 1000 + step;
      draw(now);
      sizes.push(tree.scale.x);
    }
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(sizes.at(-1)).toBeGreaterThan(before);
    controller.update(TREE_GROWTH_PER_HARVEST * 0.45, true);
    draw(now + 400);
    expect(tree.scale.x).toBe(sizes.at(-1));
  });

  it('bursts flowers and point icons while keeping the trunk fixed', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { controller, draw } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST * 0.6);
    const scene = draw(now);
    const tree = scene.children.find((object) => object instanceof Group)!;
    for (const ratio of [0.85, 1]) {
      now += 1000;
      controller.update(TREE_GROWTH_PER_HARVEST * ratio);
      if (ratio === 1) controller.setFruitState('ripe', null);
      draw(now);
      const wood = tree.getObjectByName('tree-branches') as Mesh;
      const rest = Array.from(wood.geometry.getAttribute('position').array);
      draw(now + 300);
      if (ratio === 0.85) expect(tree.getObjectByName('tree-flowers')).toBeInstanceOf(Mesh);
      else {
        expect(particles(scene)!.material.size).toBeGreaterThan(0);
        expect(tree.getObjectByName('tree-fruit')).toBeUndefined();
      }
      expect(Array.from(wood.geometry.getAttribute('position').array)).toEqual(rest);
      expect(tree.rotation.z).toBe(0);
      now += 900;
      draw(now);
      expect(tree.scale.x).toBeLessThanOrEqual(0.85);
    }
  });

  it('draws exactly 50 small textured points in one particle object, not fruit meshes', () => {
    const { controller, draw } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST);
    controller.setFruitState('ripe', null);
    const scene = draw();
    const reward = particles(scene)!;
    expect(reward.geometry.getAttribute('position').count).toBe(50);
    expect(reward.material.size).toBe(0.12);
    expect(reward.material.transparent).toBe(true);
    expect(reward.material.depthWrite).toBe(false);
    expect(reward.material.depthTest).toBe(true);
    expect(reward.material.map).not.toBeNull();
    expect(renderer.loadTexture).toHaveBeenCalledExactlyOnceWith(DEMO_FRUIT_ICON);
    expect(seed(scene)).toBeUndefined();
    const geometryDisposed = vi.spyOn(reward.geometry, 'dispose');
    const materialDisposed = vi.spyOn(reward.material, 'dispose');
    const textureDisposed = vi.spyOn(reward.material.map!, 'dispose');
    controller.setFruitState('none', null);
    expect(particles(scene)).toBeUndefined();
    expect(geometryDisposed).toHaveBeenCalledTimes(1);
    expect(materialDisposed).toHaveBeenCalledTimes(1);
    expect(textureDisposed).toHaveBeenCalledTimes(1);
  });

  it('replaces flowers with point icons at exactly the same crown positions', () => {
    const { controller, draw } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST);
    controller.setFruitState('ripe', null);
    const scene = draw();
    const reward = particles(scene)!;
    const positions = reward.geometry.getAttribute('position');
    expect(reward.geometry.drawRange.count).toBe(TREE_ORNAMENTS.length);
    expect(scene.getObjectByName('tree-fruit')).toBeUndefined();
    for (let i = 0; i < TREE_ORNAMENTS.length; i++) {
      expect(positions.getX(i)).toBeCloseTo(TREE_ORNAMENTS[i].x * 0.85);
      expect(positions.getY(i)).toBeCloseTo(TREE_ORNAMENTS[i].y * 0.85);
    }
  });

  it('composites fertilizer after soil and before the tree without soil occlusion, then disposes it', () => {
    const { controller, draw } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST);
    controller.setFertilized(true);
    const passes: { soil: boolean; tree: boolean; fertilizer: boolean }[] = [];
    renderer.render.mockImplementation((scene) => {
      passes.push({
        soil: soil(scene).visible,
        tree: scene.children.find((object) => object instanceof Group)!.visible,
        fertilizer: scene.getObjectByName('fertilizer-soil')!.visible,
      });
    });
    const scene = draw();
    expect(passes).toEqual([
      { soil: true, tree: false, fertilizer: false },
      { soil: false, tree: false, fertilizer: true },
      { soil: false, tree: true, fertilizer: false },
    ]);
    const effect = scene.getObjectByName('fertilizer-soil')!;
    expect(effect).toBeDefined();
    const glow = effect.getObjectByName('soil-glow')!;
    expect(glow.position.y).toBeGreaterThan(
      soil(scene).position.y + soil(scene).geometry.parameters.height / 2,
    );
    expect(effect.children.filter((child) => child.name === 'soil-sparkle')).toHaveLength(6);
    for (const object of effect.children) {
      expect(object).toBeInstanceOf(Mesh);
      if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial)) {
        throw new Error('Expected fertilizer mesh with an unlit material');
      }
      expect(object.material.depthTest).toBe(false);
      expect(object.material.depthWrite).toBe(false);
      if (object.name === 'soil-sparkle') expect(object.position.z).toBeLessThan(0);
    }
    if (!(glow instanceof Mesh) || !(glow.material instanceof MeshBasicMaterial)) {
      throw new Error('Expected soil glow mesh');
    }
    const textureDisposed = vi.spyOn(glow.material.map!, 'dispose');
    const geometryDisposed = vi.spyOn(glow.geometry, 'dispose');
    controller.setResourceEffect('water');
    controller.setWaterState('watered');
    controller.update(0);
    draw();
    expect(scene.getObjectByName('fertilizer-soil')).toBe(effect);
    controller.setFertilized(false);
    expect(scene.getObjectByName('fertilizer-soil')).toBeUndefined();
    expect(textureDisposed).toHaveBeenCalledOnce();
    expect(geometryDisposed).toHaveBeenCalledOnce();
    controller.setFertilized(true);
    const replacement = scene.getObjectByName('fertilizer-soil')!;
    expect(replacement).not.toBe(effect);
    controller.dispose();
    expect(scene.getObjectByName('fertilizer-soil')).toBeUndefined();
  });

  it('preserves the original scattered ten-pixel sparkles and gentle 2.4-second rise cycle', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const { controller, draw, onTarget } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST);
    controller.setFertilized(true);
    const scene = draw(100);
    const camera = renderer.render.mock.lastCall![1];
    const bounds = onTarget.mock.lastCall![0].soil;
    const sparkles = scene
      .getObjectByName('fertilizer-soil')!
      .children.filter(
        (object): object is Mesh<ShapeGeometry, MeshBasicMaterial> =>
          object instanceof Mesh && object.name === 'soil-sparkle',
      );
    expect(sparkles).toHaveLength(TREE_SOIL_SPARKLES.length);
    const screenPoint = (object: Mesh) => {
      const point = object.position.clone().project(camera);
      return { x: (point.x + 1) * 160, y: (1 - point.y) * 120 };
    };
    const first = sparkles[0];
    const initial = screenPoint(first);
    expect(initial.x).toBeCloseTo(bounds.x + bounds.width * 0.15);
    expect(initial.y).toBeCloseTo(bounds.y + bounds.height * 0.48);
    expect(first.material.opacity).toBeCloseTo(0.15);
    const initialScale = first.scale.x;
    expect(new Set(sparkles.map((sparkle) => sparkle.material.opacity)).size).toBeGreaterThan(3);
    draw(1300);
    expect(screenPoint(first).y).toBeCloseTo(initial.y - 10);
    expect(first.scale.x).toBeCloseTo(initialScale * 2);
    expect(first.material.opacity).toBeCloseTo(1);
    draw(2500);
    expect(screenPoint(first).y).toBeCloseTo(initial.y);
    expect(first.material.opacity).toBeCloseTo(0.15);
  });

  it('stagger-drops all 50 particles and lands the last one by the reward deadline', () => {
    vi.mocked(matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    const startedAt = Date.now();
    let wallTime = startedAt;
    vi.spyOn(Date, 'now').mockImplementation(() => wallTime);
    const { controller, draw } = setup();
    controller.update(TREE_GROWTH_PER_HARVEST);
    controller.setFruitState('falling', startedAt);
    const scene = draw();
    const reward = particles(scene)!;
    expect(reward.material.depthTest).toBe(false);
    const positions = reward.geometry.getAttribute('position');
    const firstY = positions.getY(0);
    const delayedOrigin = new Vector3(positions.getX(9), positions.getY(9), positions.getZ(9));
    const tree = scene.children.find((object) => object instanceof Group)!;
    wallTime = startedAt + 100;
    controller.setShakeAngle(0);
    draw();
    expect(positions.getY(0)).toBeLessThan(firstY);
    expect(positions.getY(9)).toBeCloseTo(delayedOrigin.y);
    wallTime = startedAt + DEMO_HARVEST_DURATION_MS;
    controller.setShakeAngle(0);
    draw();
    const ground = soil(scene);
    const landedY = ground.position.y + ground.geometry.parameters.height / 2 + 0.06;
    for (let index = 0; index < 50; index++) {
      expect(positions.getY(index)).toBeCloseTo(landedY);
      expect(Math.abs(positions.getX(index))).toBeLessThan(1.2);
      expect(reward.geometry.getAttribute('color').getW(index)).toBe(0);
    }
  });

  it('uses opaque brown soil to occlude the lower half of the seed', () => {
    const { controller, draw } = setup();
    controller.update(0);
    const scene = draw();
    const ground = soil(scene);
    const plantedSeed = seed(scene)!;
    const surfaceY = ground.position.y + ground.geometry.parameters.height / 2;
    const seedHalfHeight = plantedSeed.geometry.parameters.radius * plantedSeed.scale.y;
    expect(ground.material.color.getHex()).toBe(0x9b7048);
    expect(ground.material.transparent).toBe(false);
    expect(ground.material.depthWrite).toBe(true);
    expect(plantedSeed.position.y).toBeCloseTo(surfaceY);
    expect(plantedSeed.position.y - seedHalfHeight).toBeLessThan(surfaceY);
    expect(plantedSeed.position.y + seedHalfHeight).toBeGreaterThan(surfaceY);
  });

  it.each([500, 1500, 3000, 5000])('keeps the soil when the seed grows at %s', (growth) => {
    const { controller, draw } = setup();
    controller.update(0);
    const ground = soil(draw());
    controller.update((growth * TREE_GROWTH_PER_HARVEST) / 5000);
    const scene = draw();
    expect(soil(scene)).toBe(ground);
    expect(soil(scene).material.color.getHex()).toBe(0x9b7048);
    expect(seed(scene)).toBeUndefined();
  });

  it('does not freely rotate on canvas drag and resets a requested sway on release', () => {
    const { controller, canvas, draw } = setup();
    controller.update(0);
    const tree = seed(draw())!.parent!;
    controller.update(TREE_GROWTH_PER_HARVEST * 0.6);
    draw();
    canvas.setPointerCapture = vi.fn();
    for (const [type, x] of [
      ['pointerdown', 160],
      ['pointermove', 250],
      ['pointerup', 250],
    ] as const) {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          isPrimary: true,
          clientX: x,
          bubbles: true,
        }),
      );
    }
    expect(tree.rotation.y).toBe(0);
    expect(canvas.setPointerCapture).not.toHaveBeenCalled();
    draw(performance.now() + 1200);
    const wood = tree.getObjectByName('tree-branches') as Mesh;
    const foliage = tree.getObjectByName('tree-foliage') as Mesh;
    const woodBefore = Array.from(wood.geometry.getAttribute('position').array);
    const leavesBefore = Array.from(foliage.geometry.getAttribute('position').array);
    controller.setShakeAngle(5);
    draw();
    expect(tree.rotation.z).toBe(0);
    expect(Array.from(wood.geometry.getAttribute('position').array)).toEqual(woodBefore);
    expect(Array.from(foliage.geometry.getAttribute('position').array)).not.toEqual(leavesBefore);
    expect(tree.rotation.y).toBe(0);
    controller.stopPointerInteraction();
    draw();
    expect(tree.rotation.z).toBe(0);
    expect(
      Array.from(foliage.geometry.getAttribute('position').array).every(
        (value, i) => value === leavesBefore[i],
      ),
    ).toBe(true);
  });
});
