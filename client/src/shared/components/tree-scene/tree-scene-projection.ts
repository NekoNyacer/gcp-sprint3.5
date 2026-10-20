/** Shared framing, kept free of Three.js so the preview remains immediately available. */
export const TREE_CAMERA = {
  fov: 38,
  position: [0, 2.4, 6.4] as const,
  target: [0, 1.3, 0] as const,
};

export function projectTreePoint(
  width: number,
  height: number,
  x: number,
  y: number,
  z = 0,
): { x: number; y: number } {
  const [, cy, cz] = TREE_CAMERA.position;
  const dy = cy - TREE_CAMERA.target[1];
  const distance = Math.hypot(dy, cz);
  const upY = cz / distance;
  const upZ = -dy / distance;
  const depth = ((cy - y) * dy + (cz - z) * cz) / distance;
  const pixels = height / (2 * Math.tan((TREE_CAMERA.fov * Math.PI) / 360) * depth);
  return { x: width / 2 + x * pixels, y: height / 2 - ((y - cy) * upY + (z - cz) * upZ) * pixels };
}

export function fallbackTreeFrame(width: number, height: number, scale: number) {
  const project = (x: number, y: number, z = 0) => projectTreePoint(width, height, x, y, z);
  const root = project(0, 0);
  // The SVG artwork uses 58 units per metre, rooted at (160, 210).
  // Fit the full vertical span rather than the old 4:3 letterboxed canvas.
  const top = project(0, 3.3 * scale);
  const sx = (project(1, 1.65 * scale).x - root.x) / 58;
  const sy = (root.y - top.y) / (3.3 * scale * 58);
  const rim = Array.from({ length: 64 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 64;
    return project(Math.sin(angle) * 1.2, -0.03, Math.cos(angle) * 1.2);
  });
  const soil = {
    x: Math.min(...rim.map((p) => p.x)),
    y: Math.min(...rim.map((p) => p.y)),
    width: Math.max(...rim.map((p) => p.x)) - Math.min(...rim.map((p) => p.x)),
    height: Math.max(...rim.map((p) => p.y)) - Math.min(...rim.map((p) => p.y)),
  };
  const soilSx = soil.width / 172;
  const soilSy = soil.height / 30;
  return {
    root,
    soil,
    transform: `matrix(${sx} 0 0 ${sy} ${root.x - 160 * sx} ${root.y - 210 * sy})`,
    soilTransform: `matrix(${soilSx} 0 0 ${soilSy} ${width / 2 - 160 * soilSx} ${soil.y + soil.height / 2 - 211 * soilSy})`,
    model: project(0, 1.65 * scale),
  };
}
