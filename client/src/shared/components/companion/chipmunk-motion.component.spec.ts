import { TestBed } from '@angular/core/testing';
import { CHIPMUNK_CLIPS, ChipmunkMotionComponent, chipmunkFrameAt, chipmunkClipDuration } from './chipmunk-motion.component';

describe('chipmunk pose playback', () => {
  it('loops the authored running poses and keeps the full 20-frame food sequence in order', () => {
    const run = CHIPMUNK_CLIPS.walking!;
    expect(chipmunkFrameAt(run, 0)).toEqual({ index: 0, ended: false });
    expect(chipmunkFrameAt(run, 1 + 1000 * 10 / run.fps)).toEqual({ index: 0, ended: false });
    const food = CHIPMUNK_CLIPS.feeding!;
    expect(chipmunkFrameAt(food, 0).index).toBe(0);
    expect(chipmunkFrameAt(food, 1000 * 8 / food.fps).index).toBe(8);
    expect(chipmunkFrameAt(food, 1000 * 20 / food.fps)).toEqual({ index: 19, ended: true });
  });

  it('holds one-shot interaction poses instead of immediately snapping back to frame one', () => {
    for (const name of ['jumping', 'greeting', 'petting-head', 'petting-belly', 'success', 'confused'] as const) {
      const clip = CHIPMUNK_CLIPS[name]!;
      expect(chipmunkFrameAt(clip, 60000)).toEqual({ index: clip.frames - 1, ended: true });
    }
  });

  it('keeps the idle eyes open between natural, timed blinks', () => {
    const idle = CHIPMUNK_CLIPS.idle!;
    expect(chipmunkFrameAt(idle, 1199).index).toBe(0);
    expect(chipmunkFrameAt(idle, 1200).index).toBe(1);
    expect(chipmunkFrameAt(idle, 1200 + 83 * 4).index).toBe(4);
    expect(chipmunkFrameAt(idle, 1823).index).toBe(0);
  });

  it('keeps pickup, fall and directional jump key poses synchronized with their authored duration', () => {
    expect(chipmunkClipDuration(CHIPMUNK_CLIPS.pickup!)).toBe(400);
    expect(chipmunkClipDuration(CHIPMUNK_CLIPS.held!)).toBe(760);
    expect(chipmunkClipDuration(CHIPMUNK_CLIPS.falling!)).toBe(600);
    expect(chipmunkClipDuration(CHIPMUNK_CLIPS['jumping-up']!)).toBe(800);
    expect(chipmunkClipDuration(CHIPMUNK_CLIPS['jumping-down']!)).toBe(800);
    for (const action of ['pickup', 'falling', 'jumping-up', 'jumping-down'] as const) {
      const clip = CHIPMUNK_CLIPS[action]!;
      expect(chipmunkFrameAt(clip, chipmunkClipDuration(clip))).toEqual({index: clip.frames - 1, ended: true});
    }
    const held = CHIPMUNK_CLIPS.held!;
    expect(chipmunkFrameAt(held, chipmunkClipDuration(held))).toEqual({index: 0, ended: false});
  });
});

describe('chipmunk artwork loading', () => {
  let images: Array<{src: string; complete: boolean; naturalWidth: number; naturalHeight: number;
    onload: (() => void) | null; onerror: (() => void) | null}>;
  let callbacks: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let reduced: boolean;
  const context = {setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn()};

  beforeEach(() => {
    images = []; callbacks = new Map(); nextFrame = 0; reduced = false;
    context.drawImage.mockClear();
    class FakeImage {
      src = ''; complete = false; naturalWidth = 0; naturalHeight = 0;
      onload: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor() { images.push(this); }
      removeAttribute(name: string) { if (name === 'src') this.src = ''; }
    }
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++nextFrame, callback); return nextFrame; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(performance, 'now').mockReturnValue(100);
  });

  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function setup() {
    const fixture = TestBed.createComponent(ChipmunkMotionComponent);
    const source = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    Object.defineProperties(source, {
      complete: {value: true}, naturalWidth: {value: 1254}, naturalHeight: {value: 1254},
    });
    fixture.componentInstance.action = 'walking';
    fixture.detectChanges();
    return {fixture, source};
  }

  function runFrame(time: number) {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach(callback => callback(time));
  }

  it('draws the fallback while loading and starts the atlas when it becomes available', () => {
    const {fixture, source} = setup();
    expect(images).toHaveLength(1);
    runFrame(150);
    expect(context.drawImage.mock.calls.at(-1)?.[0]).toBe(source);
    const atlas = images[0];
    atlas.complete = true; atlas.naturalWidth = 2300; atlas.naturalHeight = 704;
    atlas.onload?.();
    runFrame(200);
    expect(context.drawImage.mock.calls.at(-1)?.[0]).toBe(atlas);
    fixture.destroy();
  });

  it('does not retry a failed atlas and respects reduced motion', () => {
    const {fixture} = setup();
    const atlas = images[0];
    atlas.complete = true;
    atlas.onerror?.();
    runFrame(150);
    fixture.componentInstance.actionSerial = 1;
    expect(images).toHaveLength(1);
    reduced = true;
    fixture.componentInstance.active = false;
    fixture.componentInstance.active = true;
    expect(fixture.componentInstance.canvasReady()).toBe(false);
    context.drawImage.mockClear();
    runFrame(250);
    expect(context.drawImage).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('releases the least recently used atlas and reloads it if the action returns', () => {
    const {fixture} = setup();
    const walking = images[0];
    fixture.componentInstance.action = 'greeting';
    fixture.componentInstance.action = 'feeding';
    fixture.componentInstance.action = 'petting-belly';
    expect(images).toHaveLength(4);
    expect(walking.src).toBe('');
    expect(walking.onload).toBeNull();
    fixture.componentInstance.action = 'walking';
    expect(images).toHaveLength(5);
    expect(images[4].src).toContain('/images/pet/animations/run-contact-review.png');
    fixture.destroy();
  });

  it('draws directional jump frames from physical progress rather than wall-clock age', () => {
    const {fixture} = setup();
    fixture.componentInstance.action = 'jumping-up';
    fixture.componentInstance.clipProgress = .5;
    const atlas = images[1];
    atlas.complete = true; atlas.naturalWidth = 1840; atlas.naturalHeight = 800;
    atlas.onload?.();
    runFrame(101);
    // At 400ms, the first four durations have elapsed: row2/cell1.
    expect(context.drawImage.mock.calls.at(-1)?.slice(1,5)).toEqual([0,400,460,400]);
    fixture.componentInstance.clipProgress = 1;
    runFrame(102);
    expect(context.drawImage.mock.calls.at(-1)?.slice(1,5)).toEqual([1380,400,460,400]);
    fixture.destroy();
  });

  it('uses a compact transparent sleeping fallback instead of the oversized old artwork', () => {
    const {fixture} = setup();
    fixture.componentInstance.action = 'sleeping';
    expect(fixture.componentInstance.imageSource).toContain('/animations/drag-drop/sleeping-static.png');
    expect(CHIPMUNK_CLIPS.sleeping?.path).toContain('/animations/drag-drop/sleeping-atlas.png');
    fixture.destroy();
  });
});
