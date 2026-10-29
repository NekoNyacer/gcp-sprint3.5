export type SaplingStage = 'seedling' | 'smallSapling' | 'largeSapling';
export type PlantPoint = readonly [number, number, number];
export type PlantBranch = { points: PlantPoint[]; radius: number };
export type PlantLeaf = { x: number; y: number; z: number; angle: number; length: number };

/** Same plant structure feeds WebGL and the SVG fallback. All heights are normalized. */
export function saplingPlan(stage: SaplingStage): { branches: PlantBranch[]; leaves: PlantLeaf[] } {
  const stem: PlantPoint[] = [
    [0, 0, 0],
    [-0.07, 0.85, 0],
    [0.06, 1.8, 0],
    [0, 2.7, 0],
  ];
  const branches: PlantBranch[] = [
    {
      points: stem,
      radius: stage === 'seedling' ? 0.032 : stage === 'smallSapling' ? 0.045 : 0.06,
    },
  ];
  const leaves: PlantLeaf[] = [];
  if (stage === 'seedling') {
    leaves.push(
      { x: 0.035, y: 2.05, z: 0.02, angle: 2.6, length: 0.8 },
      { x: 0.035, y: 2.12, z: 0.025, angle: 0.55, length: 0.85 },
      { x: 0, y: 2.55, z: 0.01, angle: 1.45, length: 0.25 },
    );
  } else {
    const count = stage === 'smallSapling' ? 5 : 9;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const y = 0.55 + (i / count) * 1.8;
      const reach = (0.72 - (i / count) * 0.26 + Math.sin(i * 2.1) * 0.18) * side;
      const z = Math.sin(i * 2.4) * 0.15;
      branches.push({
        points: [
          [0, y, 0],
          [reach * 0.4, y + 0.15, z * 0.5],
          [reach, y + 0.55 + Math.sin(i * 1.8) * 0.12, z],
        ],
        radius: 0.014 + (count - i) * 0.0008,
      });
      const leafCount = stage === 'smallSapling' ? 2 : 3;
      for (let leaf = 0; leaf < leafCount; leaf++) {
        const t = 0.4 + (leaf / leafCount) * 0.6;
        leaves.push({
          x: reach * t,
          y: y + 0.55 * t,
          z: z + 0.025,
          angle: leaf % 2 ? 0.65 : 2.5,
          length: stage === 'smallSapling' ? 0.33 : 0.27,
        });
      }
    }
    leaves.push({ x: 0, y: 2.6, z: 0, angle: 1.5, length: 0.25 });
  }
  return { branches, leaves };
}
