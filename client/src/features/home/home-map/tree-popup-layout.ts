export type TreePopupAnchor =
  | 'bottom'
  | 'top'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right'
  | 'left'
  | 'right';

export type PopupBounds = { left: number; right: number; top: number; bottom: number };
export type TreePopupSize = { x: number; y: number; width: number; height: number };

export const TREE_POPUP_OFFSET = 26;
export const TREE_POPUP_WIDTH = 140;

const anchors: readonly TreePopupAnchor[] = [
  'bottom', 'top-left', 'top-right', 'top', 'bottom-left', 'bottom-right', 'left', 'right',
];

export function treePopupBounds(
  point: TreePopupSize,
  anchor: TreePopupAnchor,
): PopupBounds {
  const diagonal = TREE_POPUP_OFFSET / Math.SQRT2;
  const left = anchor.endsWith('-left')
    ? point.x + diagonal
    : anchor.endsWith('-right')
      ? point.x - diagonal - point.width
      : anchor === 'left'
        ? point.x + TREE_POPUP_OFFSET
        : anchor === 'right'
          ? point.x - TREE_POPUP_OFFSET - point.width
          : point.x - point.width / 2;
  const top = anchor.startsWith('bottom')
    ? point.y - (anchor === 'bottom' ? TREE_POPUP_OFFSET : diagonal) - point.height
    : anchor.startsWith('top')
      ? point.y + (anchor === 'top' ? TREE_POPUP_OFFSET : diagonal)
      : point.y - point.height / 2;
  return { left, top, right: left + point.width, bottom: top + point.height };
}

function overlap(left: PopupBounds, right: PopupBounds): number {
  return (
    Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left)) *
    Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
  );
}

export function layoutTreePopups(
  points: readonly TreePopupSize[],
  viewport: PopupBounds,
): readonly TreePopupAnchor[] {
  let best: TreePopupAnchor[] = [];
  let bestScore = Infinity;
  const visit = (chosen: TreePopupAnchor[], bounds: PopupBounds[], score: number): void => {
    if (score >= bestScore) return;
    if (chosen.length === points.length) {
      best = [...chosen];
      bestScore = score;
      return;
    }
    const point = points[chosen.length];
    for (const anchor of anchors) {
      const candidate = treePopupBounds(point, anchor);
      const outside = point.width * point.height - overlap(candidate, viewport);
      const collisions = bounds.reduce((total, other) => total + overlap(candidate, other), 0);
      visit([...chosen, anchor], [...bounds, candidate], score + outside * 10 + collisions);
    }
  };
  // Planning supplies at most three cards, so checking all anchor combinations is bounded.
  visit([], [], 0);
  return best;
}
