import {
  BufferGeometry,
  Color,
  CatmullRomCurve3,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { treeAppearance } from '../../../../../functions/src/tree-species';
import { TREE_CROWN } from './tree-canopy-plan';
export { TREE_CROWN } from './tree-canopy-plan';

export function treeRandom(): () => number {
  let state = 7251;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Two opaque meshes: merged tapered branches and two-triangle leaves. */
export function createTreeModel(young: boolean, species = '榕樹'): Group {
  const appearance = treeAppearance(species);
  const tree = new Group();
  tree.name = 'botanical-tree';
  const random = treeRandom();
  const branches: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0);
  // Continuous rings share vertices and radii; there are no stacked cone seams.
  const branch = (points: Vector3[], base: number, tip: number, segments = 7) => {
    const curve = new CatmullRomCurve3(points);
    const vertices: number[] = [];
    const bark: number[] = [];
    const indices: number[] = [];
    const sides = 7;
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments;
      const center = curve.getPoint(t);
      const orientation = new Quaternion().setFromUnitVectors(up, curve.getTangent(t));
      const radius = base * (1 - t) + tip * t;
      for (let side = 0; side <= sides; side++) {
        const angle = (side / sides) * Math.PI * 2;
        const ridge = 1 + Math.sin(angle * 3 + t * 2) * 0.07;
        const vertex = new Vector3(
          Math.cos(angle) * radius * ridge,
          0,
          Math.sin(angle) * radius * ridge,
        )
          .applyQuaternion(orientation)
          .add(center);
        vertices.push(vertex.x, vertex.y, vertex.z);
        const tone = new Color(appearance.bark).lerp(
          new Color(appearance.barkLight),
          0.35 + Math.cos(angle + 0.8) * 0.22 + Math.sin(angle * 4) * 0.09,
        );
        bark.push(tone.r, tone.g, tone.b);
        if (ring < segments && side < sides) {
          const a = ring * (sides + 1) + side;
          const b = a + sides + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(bark, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    branches.push(geometry);
    return curve;
  };
  const trunk = branch(
    [
      new Vector3(0, -0.035, 0),
      new Vector3(-0.045, 0.42, 0.015),
      new Vector3(-0.025, 0.85, 0.02),
      new Vector3(0.065, 1.28, 0),
      new Vector3(0.015, 1.74, -0.025),
      new Vector3(-0.04, 2.15, -0.055),
      new Vector3(0.14, 2.82, -0.12),
    ],
    0.073,
    0.003,
    24,
  );
  for (let root = 0; root < 5; root++) {
    const angle = (root / 5) * Math.PI * 2;
    branch(
      [
        new Vector3(Math.cos(angle) * 0.22, -0.03, Math.sin(angle) * 0.22),
        new Vector3(Math.cos(angle) * 0.075, 0.035, Math.sin(angle) * 0.075),
        new Vector3(-0.012, 0.19, 0),
      ],
      0.008,
      0.03,
      5,
    );
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const shade = new Color(appearance.shade);
  const green = new Color(appearance.leaf);
  const sun = new Color(appearance.sun);
  const color = new Color();
  for (const [x, y, z, radius] of TREE_CROWN) {
    const tip = new Vector3(x, y, z);
    const origin = trunk.getPoint(0.24 + y * 0.12);
    const fork = new Vector3(x * 0.48 + origin.x * 0.5, y * 0.76, z * 0.45);
    const limb = branch([origin, fork, tip], 0.024 + radius * 0.012, 0.0025, 10);
    for (let twig = 0; twig < 7; twig++) {
      const end = tip
        .clone()
        .add(
          new Vector3(
            (random() - 0.5) * radius * 1.7,
            (random() - 0.4) * radius,
            (random() - 0.5) * radius,
          ),
        );
      const start = limb.getPoint(0.55 + twig * 0.045);
      const bend = start.clone().lerp(end, 0.55);
      bend.y -= 0.045;
      branch([start, bend, end], 0.0045, 0.0008, 4);
    }
    for (let leaf = 0; leaf < (young ? 360 : 600); leaf++) {
      const azimuth = random() * Math.PI * 2;
      const vertical = random() * 2 - 1;
      const spread = Math.cbrt(random());
      const ring = Math.sqrt(1 - vertical * vertical);
      const dx = Math.cos(azimuth) * ring * spread;
      const dy = vertical * spread;
      const center = new Vector3(
        x + dx * radius * appearance.crownWidth,
        y + dy * radius * 0.78,
        z + Math.sin(azimuth) * ring * spread * radius * 0.8,
      );
      const angle = random() * Math.PI * 2;
      const size = 0.017 + random() * 0.018;
      const axis = new Vector3(Math.cos(angle), Math.sin(angle), (random() - 0.5) * 0.8)
        .normalize()
        .multiplyScalar(size);
      const side = new Vector3(-Math.sin(angle), Math.cos(angle), random() - 0.5)
        .normalize()
        .multiplyScalar(size * appearance.leafWidth);
      const light = Math.max(0, Math.min(1, 0.42 + dy * 0.4 - dx * 0.18 + random() * 0.28));
      color.copy(shade).lerp(green, Math.min(1, light * 1.8));
      if (light > 0.5) color.lerp(sun, (light - 0.5) * 1.8);
      const vertices = [
        center.clone().add(axis),
        center.clone().add(side),
        center.clone().sub(axis),
        center.clone().add(axis),
        center.clone().sub(axis),
        center.clone().sub(side),
      ];
      for (const vertex of vertices) {
        positions.push(vertex.x, vertex.y, vertex.z);
        colors.push(color.r, color.g, color.b);
      }
    }
  }
  const wood = new Mesh(
    mergeGeometries(branches),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
    }),
  );
  wood.name = 'tree-branches';
  branches.forEach((geometry) => geometry.dispose());
  const foliage = new BufferGeometry();
  foliage.setAttribute('position', new Float32BufferAttribute(positions, 3));
  foliage.setAttribute('color', new Float32BufferAttribute(colors, 3));
  foliage.computeVertexNormals();
  const leaves = new Mesh(
    foliage,
    new MeshStandardMaterial({
      vertexColors: true,
      side: DoubleSide,
      roughness: 1,
    }),
  );
  leaves.name = 'tree-foliage';
  tree.add(wood, leaves);
  tree.scale.setScalar(1);
  return tree;
}
