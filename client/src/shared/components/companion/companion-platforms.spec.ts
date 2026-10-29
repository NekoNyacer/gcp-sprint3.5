import { CompanionLedge, CompanionPlatforms, visibleCompanionLedges } from './companion-platforms';

describe('companion platforms', () => {
  const width = 390;
  const baseY = 750;
  const element = {} as Element;
  let ledges: CompanionLedge[];
  let platform: CompanionPlatforms;

  beforeEach(() => {
    ledges = [{element, left: 20, right: 350, top: 590}];
    platform = new CompanionPlatforms(document, () => 0, () => ledges);
  });

  it('jumps only to reachable ledges, lands and bounds walking to the card', () => {
    const start = platform.advance(3.6, 30, baseY, width);
    expect(start.jumping).toBe(true);
    expect(start.exitAllowed).toBe(false);
    const mid = platform.advance(.3, start.x, baseY, width);
    expect(mid.y).toBeLessThan(baseY);
    const landing = platform.advance(1, mid.x, baseY, width);
    expect(landing.jumping).toBe(false);
    expect(landing.onLedge).toBe(true);
    expect(landing.y).toBe(590);
    const edge = platform.advance(.1, 390, baseY, width);
    expect(edge.x).toBeLessThanOrEqual(width - 128);
    expect(edge.direction).toBe(-1);
    expect(edge.exitAllowed).toBe(false);
  });

  it('tracks a scrolling card when paused and returns to the bar when it disappears', () => {
    platform.advance(3.6, 40, baseY, width);
    const landing = platform.advance(1, 40, baseY, width);
    ledges = [{element, left: 20, right: 350, top: 620}];
    const moved = platform.advance(0, landing.x, baseY, width);
    expect(moved.y).toBe(620);
    expect(moved.onLedge).toBe(true);
    ledges = [];
    const recovered = platform.advance(0, moved.x, baseY, width);
    expect(recovered.y).toBe(baseY);
    expect(recovered.exitAllowed).toBe(true);
    expect(recovered.jumping).toBe(false);
  });

  it('descends to the tab edge if an active card disappears', () => {
    platform.advance(3.6, 40, baseY, width);
    const landing = platform.advance(1, 40, baseY, width);
    ledges = [];
    const falling = platform.advance(.05, landing.x, baseY, width);
    expect(falling.jumping).toBe(true);
    expect(falling.y).toBe(590);
    const finished = platform.advance(1, falling.x, baseY, width);
    expect(finished.y).toBe(baseY);
    expect(finished.exitAllowed).toBe(true);
  });

  it('can jump between adjacent cards at the same height', () => {
    ledges = [{element, left: 15, right: 150, top: 590}];
    platform = new CompanionPlatforms(document, () => .5, () => ledges);
    platform.advance(3.6, 40, baseY, width);
    const first = platform.advance(1, 40, baseY, width);
    const other = {} as Element;
    ledges.push({element: other, left: 160, right: 300, top: 590});
    const jumping = platform.advance(7, first.x, baseY, width);
    expect(jumping.jumping).toBe(true);
    const second = platform.advance(1.5, jumping.x, baseY, width);
    expect(second.onLedge).toBe(true);
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBe(590);
  });

  it('does not jump to unreachable or hidden surfaces and resets when the pet leaves the visible tab', () => {
    ledges[0].top = 300;
    expect(platform.advance(4, 30, baseY, width).jumping).toBe(false);
    ledges[0].top = 590;
    platform.advance(8, 30, baseY, width);
    expect(platform.advance(0, 30, baseY, width, false)).toEqual({
      x: 30, y: baseY, jumping: false, onLedge: false, exitAllowed: true,
    });
  });

  it('keeps the existing cross-tab edge behavior when the pet is partly offscreen', () => {
    const result = platform.advance(4, -100, baseY, width);
    expect(result.jumping).toBe(false);
    expect(result.x).toBe(-100);
    expect(result.exitAllowed).toBe(true);
  });

  it('ignores scroll-clipped and hidden Ionic surfaces', () => {
    const content = document.createElement('ion-content');
    const visible = document.createElement('div');
    const clipped = document.createElement('div');
    const hidden = document.createElement('div');
    for (const node of [visible, clipped, hidden]) {
      node.setAttribute('data-companion-ledge', '');
      content.appendChild(node);
    }
    hidden.hidden = true;
    document.body.appendChild(content);
    const rect = (left: number, top: number, w: number, h: number) =>
      ({left, top, width: w, height: h, right: left + w, bottom: top + h}) as DOMRect;
    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue(rect(0, 100, width, 600));
    vi.spyOn(visible, 'getBoundingClientRect').mockReturnValue(rect(20, 300, 200, 100));
    vi.spyOn(clipped, 'getBoundingClientRect').mockReturnValue(rect(20, 90, 200, 100));
    vi.spyOn(hidden, 'getBoundingClientRect').mockReturnValue(rect(20, 300, 200, 100));
    const found = visibleCompanionLedges(document, baseY, width);
    expect(found.map(x => x.element)).toEqual([visible]);
    content.remove();
  });
});
