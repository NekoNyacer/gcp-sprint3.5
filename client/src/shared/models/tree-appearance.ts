// Shared, deterministic crown silhouette; no downloaded model or texture required.
export const TREE_CROWN = [
  [-0.78, 1.48, 0.12, 0.38],
  [0.76, 1.64, 0.02, 0.43],
  [-0.98, 1.94, -0.12, 0.38],
  [-0.55, 2.12, 0.15, 0.46],
  [0.18, 1.94, 0.32, 0.42],
  [0.93, 2.1, -0.12, 0.36],
  [0.56, 2.35, 0.08, 0.44],
  [-0.22, 2.53, -0.08, 0.45],
  [0.14, 2.82, -0.12, 0.34],
  [-0.68, 2.48, -0.18, 0.31],
  [0.1, 2.28, -0.38, 0.45],
] as const;

export const TREE_ORNAMENTS = TREE_CROWN.flatMap(([x, y, z, radius], cluster) =>
  Array.from({ length: 3 }, (_, i) => ({
    x: x + Math.cos(cluster * 2.4 + i * 2.1) * radius * 0.55,
    y: y + Math.sin(cluster * 2.4 + i * 2.1) * radius * 0.4,
    z: z + radius * (0.65 + i * 0.04),
  })),
);
