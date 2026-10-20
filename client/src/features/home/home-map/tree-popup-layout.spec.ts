import { layoutTreePopups, PopupBounds, treePopupBounds, TreePopupSize } from './tree-popup-layout';

function intersection(a: PopupBounds, b: PopupBounds): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

describe('Tree recommendation popup placement', () => {
  const viewport = { left: 12, right: 378, top: 180, bottom: 640 };

  it.each([
    [{ x: 195, y: 400 }, { x: 195, y: 400 }, { x: 195, y: 400 }],
    [{ x: 170, y: 380 }, { x: 205, y: 390 }, { x: 195, y: 420 }],
    [{ x: 100, y: 280 }, { x: 270, y: 430 }, { x: 140, y: 500 }],
  ])('shows three complete, non-overlapping compact cards for %j', (...locations) => {
    const points: TreePopupSize[] = locations.map((point) => ({ ...point, width: 140, height: 122 }));
    const anchors = layoutTreePopups(points, viewport);
    expect(anchors).toHaveLength(3);
    const bounds = points.map((point, index) => treePopupBounds(point, anchors[index]));
    bounds.forEach((rect, index) => {
      expect(rect.left).toBeGreaterThanOrEqual(viewport.left);
      expect(rect.right).toBeLessThanOrEqual(viewport.right);
      expect(rect.top).toBeGreaterThanOrEqual(viewport.top);
      expect(rect.bottom).toBeLessThanOrEqual(viewport.bottom);
      for (const other of bounds.slice(index + 1)) expect(intersection(rect, other)).toBe(0);
    });
  });

  it('supports an unavailable location yielding no recommendations', () => {
    expect(layoutTreePopups([], viewport)).toEqual([]);
  });

  it('keeps a single card inside the screen near each edge', () => {
    for (const point of [{ x: 40, y: 210 }, { x: 350, y: 600 }]) {
      const size = { ...point, width: 140, height: 122 };
      const [anchor] = layoutTreePopups([size], viewport);
      const rect = treePopupBounds(size, anchor);
      expect(rect.left).toBeGreaterThanOrEqual(viewport.left);
      expect(rect.right).toBeLessThanOrEqual(viewport.right);
      expect(rect.top).toBeGreaterThanOrEqual(viewport.top);
      expect(rect.bottom).toBeLessThanOrEqual(viewport.bottom);
    }
  });
});
