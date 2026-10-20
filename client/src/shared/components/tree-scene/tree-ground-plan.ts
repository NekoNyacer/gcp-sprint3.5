/** Static scenery, unrelated to the removable weed mechanic. Keep the root area clear. */
const GRASS_PATCH_COUNT = 420;
export const TREE_GROUND_DETAILS = [
  ...Array.from({ length: 3 }, (_, i) => {
    const angle = i * 2.399 + 0.3;
    const radius = 0.73 + (i % 2) * 0.17;
    return {
      kind: 'stone' as const,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      size: 0.22 + (i % 3) * 0.035,
      angle,
    };
  }),
  ...Array.from({ length: GRASS_PATCH_COUNT }, (_, i) => {
    const angle = i * 2.399 + 1.1 + Math.sin(i * 3.17) * 0.18;
    const radius =
      Math.sqrt(0.36 ** 2 + ((i + 0.5) / GRASS_PATCH_COUNT) * (1.13 ** 2 - 0.36 ** 2)) +
      Math.sin(i * 1.78) * 0.012;
    return {
      kind: 'grass' as const,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      size: (0.16 + (i % 7) * 0.014) * Math.min(1, 0.35 + (radius - 0.36) * 1.2),
      angle,
    };
  }),
  ...Array.from({ length: 5 }, (_, i) => {
    const angle = i * 2.399 + 2.2;
    return {
      kind: 'flower' as const,
      x: Math.cos(angle) * 0.86,
      z: Math.sin(angle) * 0.86,
      size: 0.26 + (i % 2) * 0.035,
      angle,
    };
  }),
]
  .filter(
    (detail, _, all) =>
      detail.kind !== 'grass' ||
      !all.some(
        (stone) =>
          stone.kind === 'stone' &&
          Math.hypot(detail.x - stone.x, detail.z - stone.z) < stone.size * 0.65,
      ),
  )
  .sort((a, b) => a.z - b.z);

export const TREE_TURF_SEGMENTS = 80;
export const TREE_TURF_RINGS = 4;

/** An unbroken grassy surface with an irregular bare-soil opening at the roots. */
export function treeTurfPoint(angle: number, band: number) {
  const inner = 0.29 * (1 + Math.sin(angle * 5) * 0.12);
  const outer = 1.17 * (1 + Math.sin(angle * 5) * 0.018 + Math.cos(angle * 9) * 0.009);
  const radius = inner + (outer - inner) * band;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}
