import { TestBed } from '@angular/core/testing';
import { TreeDisplayService } from '../../services/tree-display.service';
import { TreeSceneComponent } from './tree-scene.component';
import { TREE_SCENE_RENDERER, TreeSceneRendererModule } from './tree-scene-renderer';

type Renderer = {
  fail: (reason: string) => void;
  rendered: () => void;
  dispose: ReturnType<typeof vi.fn>;
};
const fake: { instances: Renderer[] } = { instances: [] };
class FakeRenderer {
  dispose = vi.fn();
  refresh = vi.fn();
  update = vi.fn();
  setResourceEffect = vi.fn();
  setWaterState = vi.fn();
  setFertilized = vi.fn();
  setTreeVisible = vi.fn();
  setFruitState = vi.fn();
  setShakeAngle = vi.fn();
  stopPointerInteraction = vi.fn();
  constructor(
    _canvas: HTMLCanvasElement,
    public fail: (reason: string) => void,
    _target: unknown,
    private onRendered?: () => void,
  ) {
    fake.instances.push(this);
  }
  rendered = () => this.onRendered?.();
}

describe('Tree scene rendering choice', () => {
  let loader: ReturnType<typeof vi.fn<() => Promise<TreeSceneRendererModule>>>;

  beforeEach(() => {
    localStorage.removeItem('cat-walk.tree-display-mode');
    fake.instances.length = 0;
    loader = vi.fn(async () => ({ TreeSceneController: FakeRenderer }));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 320, 240),
    );
    TestBed.configureTestingModule({
      imports: [TreeSceneComponent],
      providers: [{ provide: TREE_SCENE_RENDERER, useValue: loader }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem('cat-walk.tree-display-mode');
  });

  async function mount() {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('waits for a 3D frame without showing SVG, including with reduced motion', async () => {
    const fixture = await mount();
    expect(loader).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
    expect(fixture.nativeElement.querySelector('.render-status').textContent).toContain('載入');
    expect(fixture.componentInstance.wateringAimPoint()).toBeNull();
    expect(fixture.componentInstance.canInteract()).toBe(false);
    fake.instances[0].rendered();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('canvas.visible')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.render-status')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
  });

  it('asks after runtime failure and only shows 2D after acceptance, without saving it', async () => {
    const fixture = await mount();
    const renderer = fake.instances[0];
    renderer.rendered();
    renderer.fail('3D 顯示中斷。');
    fixture.detectChanges();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      '要改用 2D',
    );
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
    expect(fixture.componentInstance.canInteract()).toBe(false);
    fixture.nativeElement.querySelector('.render-actions button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).not.toBeNull();
    expect(fixture.componentInstance.canInteract()).toBe(true);
    expect(TestBed.inject(TreeDisplayService).mode()).toBe('3d');
    expect(localStorage.getItem('cat-walk.tree-display-mode')).toBeNull();
    renderer.rendered();
    fixture.detectChanges();
    expect(fixture.componentInstance.ready()).toBe(false);
  });

  it('asks after a rejected load and can retry 3D without opting into 2D', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loader.mockRejectedValueOnce(new Error('unavailable'));
    const fixture = await mount();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
    fixture.nativeElement.querySelectorAll('.render-actions button')[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fake.instances[0].rendered();
    fixture.detectChanges();
    expect(fixture.componentInstance.ready()).toBe(true);
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
  });

  it('uses explicit 2D without importing WebGL and switches modes immediately', async () => {
    const settings = TestBed.inject(TreeDisplayService);
    settings.setMode('2d');
    const fixture = await mount();
    expect(loader).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).not.toBeNull();
    settings.setMode('3d');
    fixture.detectChanges();
    await fixture.whenStable();
    fake.instances[0].rendered();
    fixture.detectChanges();
    expect(fixture.componentInstance.ready()).toBe(true);
    settings.setMode('2d');
    fixture.detectChanges();
    expect(fake.instances[0].dispose).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(['2d', 'destroy'] as const)('ignores a pending load after %s', async (action) => {
    let resolve!: (module: TreeSceneRendererModule) => void;
    loader.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const fixture = await mount();
    if (action === '2d') {
      TestBed.inject(TreeDisplayService).setMode('2d');
      fixture.detectChanges();
    } else fixture.destroy();
    resolve({ TreeSceneController: FakeRenderer });
    await Promise.resolve();
    expect(fake.instances).toHaveLength(0);
    if (action === '2d')
      expect(fixture.nativeElement.querySelector('.tree-fallback')).not.toBeNull();
  });
});
