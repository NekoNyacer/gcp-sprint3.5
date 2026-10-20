import {
  SCENE_TIMES,
  SCENE_WEATHERS,
  treeSceneBackground,
} from '../../models/tree-scene-environment';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TreeDisplayService } from '../../services/tree-display.service';
import { TreeSceneComponent } from './tree-scene.component';
import { PerspectiveCamera, Vector3 } from 'three';
import { TREE_GROWTH_PER_HARVEST } from '../../../environments/environment-dev';
import {
  DEMO_FRUIT_ICON,
  TREE_SWAY_MAX_DEGREES,
  DEMO_FRUIT_FALL_DURATION_MS,
  DEMO_FRUIT_PARTICLES,
} from '../../models/tree-cultivation';

const stageGrowth = (referenceGrowth: number) => (referenceGrowth * TREE_GROWTH_PER_HARVEST) / 5000;

function cameraPoint(width: number, height: number, x: number, y: number, z = 0) {
  const camera = new PerspectiveCamera(38, width / height, 0.1, 30);
  camera.position.set(0, 2.4, 6.4);
  camera.lookAt(0, 1.3, 0);
  camera.updateMatrixWorld();
  const point = new Vector3(x, y, z).project(camera);
  return { x: ((point.x + 1) * width) / 2, y: ((1 - point.y) * height) / 2 };
}

const cameraRootY = cameraPoint(320, 240, 0, 0).y;

describe('TreeSceneComponent fallback', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    TestBed.configureTestingModule({ imports: [TreeSceneComponent] });
    TestBed.overrideProvider(TreeDisplayService, { useValue: { mode: signal('2d') } });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function swayScene(growth: number) {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 320, 240),
    );
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.componentRef.setInput('growth', stageGrowth(growth));
    fixture.componentRef.setInput('interactive', true);
    fixture.detectChanges();
    const surface: HTMLElement = fixture.nativeElement.querySelector('.scene');
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => true);
    surface.releasePointerCapture = vi.fn();
    const harvested = vi.fn();
    fixture.componentInstance.harvestRequested.subscribe(harvested);
    const dispatch = (type: string, x: number) =>
      surface.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: 140,
          bubbles: true,
        }),
      );
    return { fixture, component: fixture.componentInstance, surface, harvested, dispatch };
  }

  it.each([
    [320, 240],
    [400, 220],
    [360, 280],
  ])('anchors the 2D preview to the 3D camera at %s × %s', (width, height) => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, width, height),
    );
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.componentRef.setInput('growth', stageGrowth(3000));
    fixture.detectChanges();
    const root = cameraPoint(width, height, 0, 0);
    expect(fixture.componentInstance.target().rootX).toBeCloseTo(root.x);
    expect(fixture.componentInstance.target().rootY).toBeCloseTo(root.y);
    for (const growth of [0, 500, 800, 1150, 1500, 3000, 4250, 5000]) {
      fixture.componentRef.setInput('growth', stageGrowth(growth));
      fixture.detectChanges();
      const transform = fixture.nativeElement
        .querySelector('.fallback-projection')
        .getAttribute('transform');
      const [sx, , , sy, tx, ty] = transform.slice(7, -1).split(' ').map(Number);
      const scale = fixture.componentInstance.visualScale();
      expect(160 * sx + tx).toBeCloseTo(root.x);
      expect(210 * sy + ty).toBeCloseTo(root.y);
      const top = cameraPoint(width, height, 0, 3.3 * scale);
      expect((210 - 3.3 * 58 * scale) * sy + ty).toBeCloseTo(top.y);
      const soil = fixture.componentInstance.target().soil;
      const rim = Array.from({ length: 64 }, (_, i) =>
        cameraPoint(
          width,
          height,
          Math.sin((i * Math.PI) / 32) * 1.2,
          -0.03,
          Math.cos((i * Math.PI) / 32) * 1.2,
        ),
      );
      expect(soil.x).toBeCloseTo(Math.min(...rim.map((p) => p.x)));
      expect(soil.y).toBeCloseTo(Math.min(...rim.map((p) => p.y)));
      expect(soil.width).toBeCloseTo(Math.max(...rim.map((p) => p.x)) - soil.x);
      expect(soil.height).toBeCloseTo(Math.max(...rim.map((p) => p.y)) - soil.y);
    }
  });

  it.each([false, true])('shows only soil before planting even with WebGL ready: %s', (ready) => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.componentRef.setInput('empty', true);
    fixture.detectChanges();
    fixture.componentInstance.ready.set(ready);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.soil-base') !== null).toBe(!ready);
    expect(root.querySelector<SVGGElement>('.fallback-tree')?.style.display).toBe(
      ready ? undefined : 'none',
    );
    expect(root.querySelector('canvas')?.classList.contains('visible')).toBe(ready);
    expect(fixture.componentInstance.label()).toBe('空的種植點');
    fixture.componentRef.setInput('empty', false);
    fixture.detectChanges();
    expect(root.querySelector('canvas')?.classList.contains('visible')).toBe(ready);
    expect(root.querySelector<SVGGElement>('.fallback-tree')?.style.display).toBe(
      ready ? undefined : '',
    );
  });

  it.each([false, true])(
    'switches weather and removes rain without changing tree state (WebGL ready: %s)',
    (ready) => {
      const fixture = TestBed.createComponent(TreeSceneComponent);
      fixture.detectChanges();
      fixture.componentInstance.ready.set(ready);
      fixture.componentRef.setInput('growth', stageGrowth(3000));
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      const surface = root.querySelector('.scene')!;
      expect(surface.classList.contains('weather-sunny')).toBe(true);
      expect(root.querySelector('.weather-rain')).toBeNull();
      const backgrounds = new Set([getComputedStyle(root.querySelector('.sky')!).backgroundImage]);

      for (const weather of ['rainy', 'cloudy', 'sunny']) {
        fixture.componentRef.setInput('weather', weather);
        fixture.detectChanges();
        expect(surface.classList.contains(`weather-${weather}`)).toBe(true);
        expect([...surface.classList].filter((name) => name.startsWith('weather-'))).toHaveLength(
          1,
        );
        backgrounds.add(getComputedStyle(root.querySelector('.sky')!).backgroundImage);
        expect(root.querySelectorAll('.rain-drop')).toHaveLength(weather === 'rainy' ? 48 : 0);
        if (weather === 'rainy') {
          const rain = root.querySelector('.weather-rain')!;
          expect(rain.getAttribute('aria-hidden')).toBe('true');
          expect(getComputedStyle(rain).pointerEvents).toBe('none');
          expect(new Set(fixture.componentInstance.rainParticles.map((drop) => drop.x)).size).toBe(
            48,
          );
        }
        expect(fixture.componentInstance.stage()).toBe('mature');
        expect(fixture.componentInstance.waterState()).toBe('normal');
        expect(fixture.componentInstance.soilWaterState()).toBe('normal');
        expect(fixture.componentInstance.resourceEffect()).toBeNull();
        expect(fixture.componentInstance.ready()).toBe(ready);
      }
      expect(backgrounds.size).toBe(3);
    },
  );

  it('switches all weather and time backgrounds without changing growth or care state', () => {
    const { fixture, component } = swayScene(3000);
    fixture.componentRef.setInput('waterState', 'watered');
    const growth = component.growth();
    for (const weather of SCENE_WEATHERS) {
      for (const time of SCENE_TIMES) {
        fixture.componentRef.setInput('weather', weather);
        fixture.componentRef.setInput('timeOfDay', time);
        fixture.detectChanges();
        const root: HTMLElement = fixture.nativeElement;
        expect(getComputedStyle(root.querySelector('.sky')!).backgroundImage).toContain(
          treeSceneBackground(weather, time),
        );
        expect(root.querySelector('.scene')!.classList.contains(`time-${time}`)).toBe(true);
        expect(component.growth()).toBe(growth);
        expect(component.waterState()).toBe('watered');
      }
    }
  });

  it('colors the soil as watered in rain without changing its care watering state', () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.componentRef.setInput('waterState', 'dry');
    fixture.componentRef.setInput('empty', true);
    fixture.componentRef.setInput('weather', 'rainy');
    fixture.detectChanges();

    expect(fixture.componentInstance.waterState()).toBe('dry');
    expect(fixture.componentInstance.soilWaterState()).toBe('watered');
    expect(fixture.nativeElement.querySelector('.soil-base').getAttribute('fill')).toBe('#61432e');
    expect(
      fixture.nativeElement.querySelector('.tree-fallback').getAttribute('aria-label'),
    ).toContain('缺水');

    fixture.componentRef.setInput('weather', 'sunny');
    fixture.detectChanges();
    expect(fixture.componentInstance.soilWaterState()).toBe('dry');
    expect(fixture.nativeElement.querySelector('.soil-base').getAttribute('fill')).toBe('#bf986c');
  });

  it.each([
    ['normal', '#9b7048', '正常'],
    ['watered', '#61432e', '已澆水'],
    ['dry', '#bf986c', '缺水'],
  ])(
    'shows %s soil and an accessible watering status without requiring feeding',
    (state, color, label) => {
      const fixture = TestBed.createComponent(TreeSceneComponent);
      fixture.componentRef.setInput('waterState', state);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.soil-base').getAttribute('fill')).toBe(color);
      expect(
        fixture.nativeElement.querySelector('.tree-fallback').getAttribute('aria-label'),
      ).toContain(label);
      expect(fixture.componentInstance.resourceEffect()).toBeNull();
      fixture.componentRef.setInput('growth', TREE_GROWTH_PER_HARVEST);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.soil-base').getAttribute('fill')).toBe(color);
    },
  );

  it('uses the illustrated background with glow only while light is being fed', () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.componentRef.setInput('weather', 'sunny');
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const background = getComputedStyle(root.querySelector('.sky')!).backgroundImage;
    expect(background).toContain('sunny-day.webp');
    expect(root.querySelector('.sunlight-glow')).toBeNull();
    fixture.componentRef.setInput('resourceEffect', 'light');
    fixture.detectChanges();
    expect(root.querySelector('.sunlight-glow')).not.toBeNull();
  });

  it('keeps expanded loading feedback out of scene sizing and pointer handling', () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const caption = root.querySelector('.caption')!;
    expect(caption.textContent).toContain('2D');
    expect(getComputedStyle(root).flexDirection).toBe('column');
    expect(getComputedStyle(caption).position).toBe('absolute');
    expect(getComputedStyle(caption).pointerEvents).toBe('none');
  });

  it.each([false, true])('removes the caption when 3D is ready (expanded: %s)', (expanded) => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.componentRef.setInput('expanded', expanded);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.caption')?.textContent).toContain('2D');

    fixture.componentInstance.ready.set(true);
    fixture.detectChanges();
    expect(root.querySelector('.caption')).toBeNull();

    fixture.componentInstance.ready.set(false);
    fixture.detectChanges();
    expect(root.querySelector('.caption')?.textContent).toContain('2D');
  });

  it.each([0, 499, 500, 1499, 1500, 2999])(
    'does not respond to dragging before the mature stage at growth %s',
    (growth) => {
      const { component, surface, harvested, dispatch } = swayScene(growth);
      dispatch('pointerdown', 160);
      for (const x of [200, 160, 200, 160]) dispatch('pointermove', x);
      expect(component.canSway()).toBe(false);
      expect(component.shakeAngle()).toBe(0);
      expect(surface.setPointerCapture).not.toHaveBeenCalled();
      expect(harvested).not.toHaveBeenCalled();
    },
  );

  it.each([
    [3000, 'none', false],
    [5000, 'none', false],
    [5000, 'ripe', false],
    [3000, 'ripe', true],
  ] as const)(
    'only sways without side effects at growth %s, fruit %s, permission %s',
    (growth, fruit, allowed) => {
      const { fixture, component, surface, harvested, dispatch } = swayScene(growth);
      fixture.componentRef.setInput('fruitState', fruit);
      fixture.componentRef.setInput('canHarvest', allowed);
      fixture.detectChanges();
      expect(surface.classList.contains('swayable')).toBe(true);
      expect(
        fixture.nativeElement.querySelector('canvas').getAttribute('aria-label'),
      ).not.toContain('旋轉');
      dispatch('pointerdown', 160);
      dispatch('pointermove', 1000);
      expect(component.shakeAngle()).toBe(TREE_SWAY_MAX_DEGREES);
      dispatch('pointermove', -1000);
      expect(component.shakeAngle()).toBe(-TREE_SWAY_MAX_DEGREES);
      for (const x of [200, 160, 200, 160]) dispatch('pointermove', x);
      expect(harvested).not.toHaveBeenCalled();
      expect(component.growth()).toBe(stageGrowth(growth));
      expect(component.fruitState()).toBe(fruit);
      dispatch('pointerup', 160);
      expect(component.shakeAngle()).toBe(0);
      expect(surface.releasePointerCapture).toHaveBeenCalledWith(1);
    },
  );

  it('emits a harvest only for ripe large-tree fruit with permission and deliberate reversals', () => {
    const { fixture, component, harvested, dispatch } = swayScene(5000);
    fixture.componentRef.setInput('fruitState', 'ripe');
    fixture.componentRef.setInput('canHarvest', true);
    fixture.detectChanges();
    dispatch('pointerdown', 160);
    dispatch('pointermove', 200);
    expect(harvested).not.toHaveBeenCalled();
    for (const x of [160, 200, 160]) dispatch('pointermove', x);
    expect(harvested).toHaveBeenCalledTimes(1);
    expect(component.shakeAngle()).toBe(0);
    dispatch('pointermove', 200);
    expect(harvested).toHaveBeenCalledTimes(1);
  });

  it('renders 50 small leaf-texture particles with staggered falls and no numeric fruit labels', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { fixture } = swayScene(5000);
    fixture.componentRef.setInput('fruitState', 'ripe');
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const particles = root.querySelectorAll<SVGGElement>('.fallback-fruit');
    expect(particles).toHaveLength(50);
    expect(root.querySelectorAll('.fallback-fruit.concealed')).toHaveLength(17);
    expect(root.querySelectorAll('.fallback-fruit:not(.concealed)')).toHaveLength(33);
    expect(root.querySelectorAll('.fruit-leaf-cover')).toHaveLength(0);
    expect(root.querySelectorAll('.fallback-fruit text')).toHaveLength(0);
    for (const particle of particles) {
      const image = particle.querySelector('image')!;
      expect(image.getAttribute('href')).toBe(DEMO_FRUIT_ICON);
      expect(image.getAttribute('width')).toBe('8');
      expect(image.getAttribute('height')).toBe('8');
    }
    fixture.componentRef.setInput('fruitState', 'falling');
    fixture.componentRef.setInput('harvestStartedAt', Date.now());
    fixture.detectChanges();
    expect(root.querySelectorAll('.fallback-fruit.falling')).toHaveLength(50);
    expect(root.querySelectorAll('.fallback-fruit.concealed')).toHaveLength(0);
    expect(root.querySelectorAll('.fruit-leaf-cover')).toHaveLength(0);
    for (const [index, particle] of Array.from(particles).entries()) {
      expect(particle.style.animationDuration).toBe(`${DEMO_FRUIT_FALL_DURATION_MS}ms`);
      expect(particle.style.animationDelay).toBe(`${DEMO_FRUIT_PARTICLES[index].delayMs}ms`);
    }
    fixture.componentRef.setInput('fruitState', 'none');
    fixture.detectChanges();
    expect(root.querySelectorAll('.fallback-fruit')).toHaveLength(0);
  });

  it('emits bounded falling leaves for a subtle sway and clears them after settling', () => {
    vi.useFakeTimers();
    const { fixture, component, dispatch } = swayScene(3000);
    vi.mocked(matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    dispatch('pointerdown', 160);
    for (let i = 0; i < 10; i++) {
      dispatch('pointermove', i % 2 ? 160 : 240);
      vi.advanceTimersByTime(340);
    }
    fixture.detectChanges();
    expect(component.fallenLeaves().length).toBeGreaterThan(0);
    expect(component.fallenLeaves().length).toBeLessThanOrEqual(12);
    expect(fixture.nativeElement.querySelectorAll('.fallen-leaf').length).toBeLessThanOrEqual(12);
    expect(Math.abs(component.shakeAngle())).toBeLessThanOrEqual(TREE_SWAY_MAX_DEGREES);
    dispatch('pointerup', 160);
    vi.advanceTimersByTime(1800);
    expect(component.fallenLeaves()).toEqual([]);
  });

  it('shows flowers before point icons and does not replay a stage burst when inspecting another tree', () => {
    const { fixture, component } = swayScene(3000);
    fixture.componentRef.setInput('growth', stageGrowth(4250));
    fixture.detectChanges();
    const flowers = fixture.nativeElement.querySelectorAll('.tree-flower');
    expect(flowers).toHaveLength(33);
    expect(component.stageBurst()).toBe(true);
    fixture.componentRef.setInput('growth', stageGrowth(5000));
    fixture.componentRef.setInput('fruitState', 'ripe');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.tree-flower')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('.tree-fruit')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('.fallback-fruit:not(.concealed)')).toHaveLength(
      33,
    );
    fixture.componentRef.setInput('interactionKey', 'another-tree');
    fixture.detectChanges();
    expect(component.stageBurst()).toBe(false);
  });

  it('does not count ordinary sway toward a newly permitted harvest', () => {
    const { fixture, harvested, dispatch } = swayScene(5000);
    fixture.componentRef.setInput('fruitState', 'ripe');
    fixture.detectChanges();
    dispatch('pointerdown', 160);
    for (const x of [200, 160, 200]) dispatch('pointermove', x);
    fixture.componentRef.setInput('canHarvest', true);
    fixture.detectChanges();
    dispatch('pointermove', 160);
    expect(harvested).not.toHaveBeenCalled();
    for (const x of [200, 160, 200, 160]) dispatch('pointermove', x);
    expect(harvested).toHaveBeenCalledTimes(1);
  });

  it.each(['falling', 'inactive', 'younger', 'blur', 'cancel', 'hidden'])(
    'returns upright and ends interaction after %s',
    (reason) => {
      const { fixture, component, surface, harvested, dispatch } = swayScene(3000);
      dispatch('pointerdown', 160);
      dispatch('pointermove', 200);
      expect(component.shakeAngle()).toBe(TREE_SWAY_MAX_DEGREES);
      if (reason === 'falling') fixture.componentRef.setInput('fruitState', 'falling');
      if (reason === 'inactive') fixture.componentRef.setInput('interactive', false);
      if (reason === 'younger') fixture.componentRef.setInput('growth', stageGrowth(1500));
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'cancel') dispatch('pointercancel', 200);
      if (reason === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      }
      fixture.detectChanges();
      expect(component.shakeAngle()).toBe(0);
      expect(surface.releasePointerCapture).toHaveBeenCalledWith(1);
      dispatch('pointermove', 160);
      expect(component.shakeAngle()).toBe(0);
      expect(harvested).not.toHaveBeenCalled();
    },
  );

  it('uses SVG when the display preference explicitly selects 2D', async () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.ready()).toBe(false);
    expect(fixture.nativeElement.querySelector('.tree-fallback')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.sky .cloud')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.sky-sun')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sunlight-glow')).toBeNull();
    expect(fixture.componentInstance.fallbackReason()).toContain('2D');
  });

  it('updates the accessible stage even when 3D is unavailable', async () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentRef.setInput('growth', stageGrowth(3000));
    fixture.detectChanges();
    expect(fixture.componentInstance.label()).toBe('大樹');
    expect(fixture.nativeElement.querySelector('.tree-fallback').getAttribute('aria-label')).toBe(
      '大樹 2D 預覽，正常',
    );
  });

  it('shows brown soil and only the exposed seed cap, then removes the soil rim after sprouting', async () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 240));
    fixture.componentRef.setInput('growth', stageGrowth(1));
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.soil-base')?.getAttribute('fill')).toBe('#9b7048');
    expect(root.querySelector('.fallback-seed')?.getAttribute('fill')).toBe(
      'url(#seed-hull-shade)',
    );
    expect(root.querySelector('.seed-soil-rim')).not.toBeNull();
    expect(fixture.componentInstance.target().modelY).toBeCloseTo(cameraPoint(320, 240, 0, 0.07).y);
    expect(fixture.componentInstance.wateringAimPoint()!.y).toBeCloseTo(cameraRootY);
    fixture.componentRef.setInput('growth', stageGrowth(500));
    fixture.detectChanges();
    expect(root.querySelector('.fallback-seed')).toBeNull();
    expect(root.querySelector('.seed-soil-rim')).toBeNull();
    expect(root.querySelector('.soil-base')?.getAttribute('fill')).toBe('#9b7048');
  });

  it('anchors fertilizer sparkles to the fallback soil and keeps them during light/water feeding', () => {
    const { fixture, component } = swayScene(500);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.fertilizer-soil')).toBeNull();
    fixture.componentRef.setInput('fertilized', true);
    fixture.detectChanges();
    const soil = root.querySelector<HTMLElement>('.fertilizer-soil')!;
    expect(soil.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(soil).pointerEvents).toBe('none');
    expect(root.querySelectorAll('.soil-sparkle')).toHaveLength(6);
    const layer = soil.parentElement!;
    expect(layer.getAttribute('x')).toBe('74');
    expect(layer.getAttribute('y')).toBe('196');
    expect(layer.getAttribute('width')).toBe('172');
    expect(layer.getAttribute('height')).toBe('30');
    expect(
      root.querySelector('.soil-base')!.compareDocumentPosition(layer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      layer.compareDocumentPosition(root.querySelector('.fallback-projection')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(soil.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    for (const resource of ['light', 'water'] as const) {
      fixture.componentRef.setInput('resourceEffect', resource);
      fixture.detectChanges();
      expect(root.querySelector('.fertilizer-soil')).toBe(soil);
    }
    const canvas = root.querySelector('canvas')!;
    vi.mocked(canvas.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 640, 480));
    fixture.componentRef.setInput('growth', stageGrowth(1500));
    fixture.detectChanges();
    expect(root.querySelector('.fertilizer-soil')).toBe(soil);
    expect(layer.getAttribute('width')).toBe('172');
    expect(root.querySelector('.tree-fallback')?.getAttribute('viewBox')).toBe('0 0 640 480');
    component.ready.set(true);
    fixture.detectChanges();
    expect(root.querySelector('.tree-fallback')).toBeNull();
    expect(root.querySelector('.fertilizer-soil')).toBeNull();
    fixture.componentRef.setInput('fertilized', false);
    fixture.detectChanges();
    expect(root.querySelector('.fertilizer-soil')).toBeNull();
  });

  it('pulls weeds upward without triggering shake or treating a click as removal', () => {
    vi.useFakeTimers();
    const { fixture, component, surface } = swayScene(3000);
    fixture.componentRef.setInput('weeds', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('button.weed')).toHaveLength(12);
    const weed = root.querySelector<HTMLButtonElement>('button.weed')!;
    expect(weed.getAttribute('aria-label')).toContain('拔除');
    expect(weed.style.left).not.toBe('');
    expect(weed.style.top).not.toBe('');
    const pulled = vi.fn();
    component.weedPulled.subscribe(pulled);
    const shake = vi.spyOn(component, 'beginShake');
    weed.setPointerCapture = vi.fn();
    weed.hasPointerCapture = vi.fn(() => true);
    weed.releasePointerCapture = vi.fn();
    const pointer = (type: string, y: number) =>
      weed.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          button: 0,
          isPrimary: true,
          clientX: 100,
          clientY: y,
        }),
      );
    weed.click();
    expect(pulled).not.toHaveBeenCalled();
    pointer('pointerdown', 160);
    pointer('pointermove', 115);
    expect(component.pullingWeed()?.lift).toBe(45);
    fixture.detectChanges();
    expect(weed.classList.contains('pulling')).toBe(true);
    expect(weed.style.getPropertyValue('--weed-lift')).toBe('45px');
    pointer('pointerup', 115);
    fixture.detectChanges();
    expect(weed.classList.contains('uprooted')).toBe(true);
    vi.advanceTimersByTime(240);
    expect(pulled).toHaveBeenCalledExactlyOnceWith(0);
    expect(shake).not.toHaveBeenCalled();
    component.ready.set(true);
    fixture.componentRef.setInput('weeds', [1, 2, 3]);
    fixture.detectChanges();
    expect(root.querySelectorAll('button.weed')).toHaveLength(3);
    expect(root.querySelector('.tree-fallback')).toBeNull();
    expect(surface.querySelector('button.weed')).not.toBeNull();
  });

  it('offers ArrowUp as a keyboard pull and ignores Enter and repeated keys', () => {
    vi.useFakeTimers();
    const { fixture, component } = swayScene(3000);
    fixture.componentRef.setInput('weeds', [0]);
    fixture.detectChanges();
    const weed = fixture.nativeElement.querySelector('.weed') as HTMLElement;
    const pulled = vi.fn();
    component.weedPulled.subscribe(pulled);
    weed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    vi.advanceTimersByTime(240);
    expect(pulled).not.toHaveBeenCalled();
    weed.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    weed.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, repeat: true }),
    );
    vi.advanceTimersByTime(240);
    expect(pulled).toHaveBeenCalledExactlyOnceWith(0);
  });

  it.each([
    ['pointerup', 150, 100],
    ['pointerup', 190, 100],
    ['pointerup', 100, 200],
    ['pointercancel', 100, 100],
    ['lostpointercapture', 100, 100],
  ])('does not remove a weed after %s at y=%s x=%s', (end, y, x) => {
    vi.useFakeTimers();
    const { fixture, component } = swayScene(3000);
    fixture.componentRef.setInput('weeds', [0]);
    fixture.detectChanges();
    const weed = fixture.nativeElement.querySelector('.weed') as HTMLElement;
    weed.setPointerCapture = vi.fn();
    weed.hasPointerCapture = vi.fn(() => true);
    weed.releasePointerCapture = vi.fn();
    const pulled = vi.fn();
    component.weedPulled.subscribe(pulled);
    for (const [type, px, py] of [
      ['pointerdown', 100, 160],
      ['pointermove', x, y],
      [end, x, y],
    ] as const) {
      weed.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: px,
          clientY: py,
        }),
      );
    }
    vi.advanceTimersByTime(300);
    expect(pulled).not.toHaveBeenCalled();
    expect(component.pullingWeed()).toBeNull();
  });

  it('cancels a pending uproot when the inspected tree changes', () => {
    vi.useFakeTimers();

    const { fixture, component } = swayScene(3000);
    fixture.componentRef.setInput('weeds', [0]);
    fixture.detectChanges();
    const weed = fixture.nativeElement.querySelector('.weed') as HTMLElement;
    weed.setPointerCapture = vi.fn();
    weed.hasPointerCapture = vi.fn(() => true);
    weed.releasePointerCapture = vi.fn();
    vi.mocked(matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    const pulled = vi.fn();
    component.weedPulled.subscribe(pulled);
    for (const [type, y] of [
      ['pointerdown', 160],
      ['pointerup', 100],
    ] as const) {
      weed.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: 100,
          clientY: y,
        }),
      );
    }
    expect(component.pullingWeed()?.uprooted).toBe(true);
    fixture.componentRef.setInput('interactionKey', 'another-tree');
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    expect(pulled).not.toHaveBeenCalled();
  });

  it('shows a leafy seedling instead of a miniature canopy, then switches to the young tree', () => {
    const { fixture, component } = swayScene(500);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.fallback-seedling .seedling-stem')).not.toBeNull();
    expect(root.querySelectorAll('.fallback-seedling .seedling-leaf')).toHaveLength(3);
    expect(component.target().modelY).toBeLessThan(cameraRootY);
    expect(component.wateringAimPoint()!.y).toBeCloseTo(cameraRootY);
    fixture.componentRef.setInput('growth', stageGrowth(1500));
    fixture.detectChanges();
    expect(root.querySelector('.fallback-seedling')).toBeNull();
    expect(root.querySelector('.fallback-tree-model')).not.toBeNull();
    expect(component.visualScale()).toBe(0.55);
  });

  it('keeps a held feeding point in range when the fallback grows into a mature tree', () => {
    const { fixture, component } = swayScene(1500);
    const young = component.target();
    const point = { x: young.x, y: young.y + young.radius - 1 };
    expect(component.containsFeedingPoint(point.x, point.y)).toBe(true);
    for (const growth of [3000, 5000, 50000]) {
      fixture.componentRef.setInput('growth', stageGrowth(growth));
      fixture.detectChanges();
      const target = component.target();
      expect(target.x).toBe(young.x);
      expect(target.y).toBe(young.y);
      expect(target.radius).toBe(young.radius);
      expect(component.containsFeedingPoint(point.x, point.y)).toBe(true);
      expect(component.wateringAimPoint()!.y).toBeCloseTo(cameraRootY);
    }
  });

  it('keeps the fruiting fallback size and aim capped at later growth', () => {
    const { fixture, component } = swayScene(5000);
    const target = component.target();
    const size = component.visualScale();
    fixture.componentRef.setInput('growth', stageGrowth(50000));
    fixture.detectChanges();
    expect(component.stage()).toBe('large');
    expect(component.visualScale()).toBe(size);
    expect(component.target()).toEqual(target);
  });

  it('asks before showing 2D after WebGL initialization failure', async () => {
    TestBed.overrideProvider(TreeDisplayService, { useValue: { mode: signal('3d') } });
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.renderError()).toContain('無法載入'));
    fixture.detectChanges();
    expect(errors).toHaveBeenCalled();
    expect(fixture.componentInstance.ready()).toBe(false);
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
    fixture.nativeElement.querySelector('.render-actions button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).not.toBeNull();
  });

  it('keeps feeding hit testing available in the 2D fallback', async () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20, 320, 240));
    fixture.componentRef.setInput('growth', stageGrowth(500));
    fixture.detectChanges();
    await fixture.whenStable();
    const { x, y, radius } = fixture.componentInstance.target();
    expect(fixture.componentInstance.containsFeedingPoint(20 + x, 20 + y)).toBe(true);
    expect(fixture.componentInstance.containsFeedingPoint(20 + x + radius + 1, 20 + y)).toBe(false);
  });

  it('adds only an upper glow for light feeding and preserves root aim after growth and resize', async () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas');
    const rect = vi
      .spyOn(canvas, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(20, 20, 320, 240));
    fixture.componentRef.setInput('resourceEffect', 'light');
    fixture.componentRef.setInput('growth', stageGrowth(500));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const glow = fixture.nativeElement.querySelector('.sunlight-glow');
    expect(glow).not.toBeNull();
    const glowStyle = getComputedStyle(glow);
    expect(glowStyle.position).toBe('absolute');
    expect(glowStyle.height).toBe('72%');
    expect(glowStyle.backgroundImage).toContain('radial-gradient');
    expect(fixture.nativeElement.querySelector('.sky-sun')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sunlight-rays')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.scene line')).toHaveLength(0);
    const aim = fixture.componentInstance.wateringAimPoint()!;
    expect(aim.x).toBe(180);
    expect(aim.y).toBeCloseTo(20 + cameraRootY);
    expect(fixture.componentInstance.target().modelY).toBeLessThan(cameraRootY);
    rect.mockReturnValue(new DOMRect(100, 50, 640, 480));
    fixture.componentRef.setInput('growth', stageGrowth(1500));
    fixture.detectChanges();
    expect(fixture.componentInstance.wateringAimPoint()!.x).toBe(420);
    expect(fixture.componentInstance.wateringAimPoint()!.y).toBeCloseTo(50 + cameraRootY * 2);
    fixture.componentRef.setInput('resourceEffect', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sunlight-glow')).toBeNull();
    fixture.componentRef.setInput('resourceEffect', 'water');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sunlight-glow')).toBeNull();
  });

  it.each([0, 500, 1500, 3000, 5000])(
    'aims at the fallback soil/trunk base at growth %s',
    async (growth) => {
      const notifyResize = vi.fn();
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: () => void) {
            notifyResize.mockImplementation(callback);
          }
          observe() {}
          disconnect() {}
        },
      );
      const fixture = TestBed.createComponent(TreeSceneComponent);
      fixture.detectChanges();
      const canvas = fixture.nativeElement.querySelector('canvas');
      const rect = vi
        .spyOn(canvas, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(20, 30, 320, 240));
      fixture.componentRef.setInput('growth', stageGrowth(growth));
      fixture.detectChanges();
      await fixture.whenStable();
      notifyResize();
      expect(fixture.componentInstance.wateringAimPoint()!.x).toBe(180);
      expect(fixture.componentInstance.wateringAimPoint()!.y).toBeCloseTo(30 + cameraRootY);
      rect.mockReturnValue(new DOMRect(100, 50, 640, 600));
      notifyResize();
      expect(fixture.componentInstance.wateringAimPoint()!.x).toBe(420);
      expect(fixture.componentInstance.wateringAimPoint()!.y).toBeCloseTo(50 + cameraRootY * 2.5);
    },
  );
});
