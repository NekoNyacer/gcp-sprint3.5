import { CompanionDrag } from './companion-drag';
import type { CompanionLedge } from './companion-platforms';

describe('CompanionDrag', () => {
  const width = 390, height = 844, floor = 777;
  let drag: CompanionDrag;
  const card = {} as Element;
  const ledge: CompanionLedge = { element: card, left: 20, right: 350, top: 500 };
  const frames = (count: number, ledges: readonly CompanionLedge[] = []) => {
    let last = drag.advance(0, ledges, floor, width, height);
    for (let i = 0; i < count; i++) last = drag.advance(.05, ledges, floor, width, height);
    return last;
  };
  beforeEach(() => { drag = new CompanionDrag(); });

  it('leaves a click below the threshold alone and preserves the pointer grip for a drag', () => {
    drag.begin(100, 700, 40, 750);
    expect(drag.move(104, 702, width, height, floor)).toBe(false);
    expect(drag.active).toBe(false);
    expect(drag.release([], floor, width, height)).toBe(false);
    drag.begin(100, 700, 40, 750);
    expect(drag.move(120, 500, width, height, floor)).toBe(true);
    expect(drag.phase).toBe('pickup'); expect(drag.x).toBe(60); expect(drag.y).toBe(550);
    expect(drag.advance(.1, [], floor, width, height).progress).toBeCloseTo(.25);
    expect(frames(6).phase).toBe('held');
    expect(drag.dragging).toBe(true);
  });

  it('clamps the full pet into the viewport without changing tabs', () => {
    drag.begin(100, 700, 40, 750);
    drag.move(-200, -200, width, height, floor);
    expect(drag.x).toBe(0); expect(drag.y).toBe(108);
    drag.move(2000, 2000, width, height, floor);
    expect(drag.x).toBe(width - 128); expect(drag.y).toBe(floor);
    expect(drag.advance(0, [], floor, width, height).exitAllowed).toBe(false);
  });

  it('falls under gravity onto the nearest horizontal ledge below its feet, then settles', () => {
    drag.begin(100, 700, 40, 750); drag.move(120, 250, width, height, floor);
    const below = { ...ledge, top: 650, element: {} as Element };
    expect(drag.release([below, ledge], floor, width, height)).toBe(true);
    const first = drag.advance(.05, [below, ledge], floor, width, height);
    const second = drag.advance(.05, [below, ledge], floor, width, height);
    expect(second.progress).toBeGreaterThan(first.progress!);
    expect(second.y - first.y).toBeGreaterThan(first.y - 300);
    const landed = frames(20, [below, ledge]);
    expect(landed.y).toBe(500); expect(landed.support).toBe(card);
    expect(landed.phase).toBe('idle'); expect(landed.settled).toBe(true);
    expect(drag.active).toBe(false);
  });

  it('never snaps upward onto a ledge above the released pet and ignores unrelated horizontal ledges', () => {
    drag.begin(100, 700, 40, 750); drag.move(120, 550, width, height, floor);
    drag.release([ledge], floor, width, height);
    expect(frames(24, [ledge]).y).toBe(floor);
    expect(drag.support).toBeNull();
    drag.begin(330, 700, 260, 750); drag.move(330, 200, width, height, floor);
    const elsewhere = { ...ledge, left: 0, right: 100 };
    drag.release([elsewhere], floor, width, height);
    expect(frames(30, [elsewhere]).y).toBe(floor);
  });

  it('rechecks support while falling and safely drops if its card disappears during landing', () => {
    drag.begin(100, 700, 40, 750); drag.move(120, 450, width, height, floor);
    drag.release([ledge], floor, width, height);
    let position = drag.advance(.05, [ledge], floor, width, height);
    expect(position.phase).toBe('landing');
    position = drag.advance(.05, [], floor, width, height);
    expect(position.phase).toBe('falling'); expect(position.y).toBe(500);
    expect(frames(20).y).toBe(floor);
  });

  it('can grab again during a fall, and cancellation prevents stale landing state', () => {
    drag.begin(100, 700, 40, 750); drag.move(120, 250, width, height, floor);
    drag.release([], floor, width, height); frames(2);
    const y = drag.y;
    drag.begin(110, y - 50, drag.x, y); drag.move(130, y - 70, width, height, floor);
    expect(drag.phase).toBe('pickup'); expect(drag.y).toBe(y - 20);
    drag.cancel();
    const state = frames(20, [ledge]);
    expect(state.phase).toBe('idle'); expect(state.settled).toBe(false); expect(state.support).toBeNull();
  });

  it('bounds resumed frames and clamps safely after a viewport resize', () => {
    drag.begin(100, 700, 40, 750); drag.move(120, 250, width, height, floor);
    drag.release([], floor, width, height);
    expect(drag.advance(60, [], floor, width, height).y).toBeCloseTo(308.5);
    const resized = drag.advance(0, [], 200, 100, 220);
    expect(resized.x).toBe(0); expect(resized.y).toBe(200);
    expect(drag.advance(Number.NaN, [], 200, 100, 220).y).toBe(200);
    const hiddenFloor = drag.advance(.05, [], 800, 100, 180);
    expect(hiddenFloor.y).toBeLessThanOrEqual(180);
  });
});
