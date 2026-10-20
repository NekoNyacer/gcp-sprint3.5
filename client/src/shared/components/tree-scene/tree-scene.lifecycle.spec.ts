import { TestBed } from '@angular/core/testing';
import { TreeSceneComponent } from './tree-scene.component';

const renderers = vi.hoisted(() => ({
  instances: [] as {
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }[],
}));

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>();
  return Object.assign({}, three, {
    WebGLRenderer: class {
      readonly render = vi.fn();
      readonly dispose = vi.fn();
      setPixelRatio() {}
      setClearColor() {}
      setSize() {}
      forceContextLoss() {}
      constructor() {
        renderers.instances.push(this);
      }
    },
  });
});

describe('TreeSceneComponent presentation lifecycle', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;

  function drawFrames(): void {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback(performance.now());
    }
  }

  beforeEach(() => {
    renderers.instances.length = 0;
    frames.clear();
    nextFrame = 0;
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
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 320, 240),
    );
    TestBed.configureTestingModule({ imports: [TreeSceneComponent] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows only loading until the first frame, then redraws after revealing the canvas', async () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(renderers.instances).toHaveLength(1));
    const renderer = renderers.instances[0];
    expect(fixture.componentInstance.ready()).toBe(false);
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('載入');
    expect(fixture.nativeElement.querySelector('canvas.visible')).toBeNull();
    drawFrames();
    fixture.detectChanges();
    expect(fixture.componentInstance.ready()).toBe(true);
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
    expect(fixture.nativeElement.querySelector('canvas.visible')).not.toBeNull();
    expect(renderer.render).toHaveBeenCalledOnce();
    expect(frames.size).toBe(1);
    drawFrames();
    fixture.detectChanges();
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
  });

  it('starts every reopened scene loading 3D and disposes old renderers', async () => {
    for (let index = 0; index < 4; index++) {
      const fixture = TestBed.createComponent(TreeSceneComponent);
      fixture.detectChanges();
      await vi.waitFor(() => expect(renderers.instances).toHaveLength(index + 1));
      const renderer = renderers.instances[index];
      expect(fixture.componentInstance.ready()).toBe(false);
      fixture.componentInstance.refresh();
      drawFrames();
      fixture.detectChanges();
      expect(fixture.componentInstance.ready()).toBe(true);
      fixture.destroy();
      expect(renderer.dispose).toHaveBeenCalledOnce();
      drawFrames();
      expect(fixture.componentInstance.ready()).toBe(false);
    }
  });

  it('waits while hidden, then draws after presentation refresh', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getBoundingClientRect).mockReturnValue(
      new DOMRect(0, 0, 0, 0),
    );
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(renderers.instances).toHaveLength(1));
    drawFrames();
    expect(fixture.componentInstance.ready()).toBe(false);
    expect(renderers.instances[0].render).not.toHaveBeenCalled();
    vi.mocked(HTMLCanvasElement.prototype.getBoundingClientRect).mockReturnValue(
      new DOMRect(0, 0, 320, 240),
    );
    fixture.componentInstance.refresh();
    drawFrames();
    fixture.detectChanges();
    expect(fixture.componentInstance.ready()).toBe(true);
    expect(renderers.instances[0].render).toHaveBeenCalledOnce();
  });

  it('asks for consent after context loss before displaying SVG', async () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(renderers.instances).toHaveLength(1));
    drawFrames();
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('canvas')
      .dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    fixture.detectChanges();
    expect(renderers.instances[0].dispose).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      '3D 顯示中斷',
    );
    fixture.nativeElement.querySelector('.render-actions button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).not.toBeNull();
    drawFrames();
    expect(fixture.componentInstance.ready()).toBe(false);
  });

  it('retries a lost context using a fresh canvas', async () => {
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(renderers.instances).toHaveLength(1));
    drawFrames();
    fixture.detectChanges();
    const original = fixture.nativeElement.querySelector('canvas');
    original.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('.render-actions button')[1].click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(renderers.instances).toHaveLength(2));
    expect(fixture.nativeElement.querySelector('canvas')).not.toBe(original);
    expect(renderers.instances).toHaveLength(2);
    drawFrames();
    fixture.detectChanges();
    expect(fixture.componentInstance.ready()).toBe(true);
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
  });

  it('asks for fallback if rendering a frame throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fixture = TestBed.createComponent(TreeSceneComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(renderers.instances).toHaveLength(1));
    renderers.instances[0].render.mockImplementationOnce(() => {
      throw new Error('GPU unavailable');
    });
    drawFrames();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.tree-fallback')).toBeNull();
    expect(renderers.instances[0].dispose).toHaveBeenCalledOnce();
  });
});
