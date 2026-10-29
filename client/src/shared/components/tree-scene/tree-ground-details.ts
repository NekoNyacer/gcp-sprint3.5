import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TREE_GROUND_DETAILS,
  TREE_TURF_RINGS,
  TREE_TURF_SEGMENTS,
  treeTurfPoint,
} from './tree-ground-plan';

/** One static mesh/draw call for all pebbles, blades and wildflowers. */
export function createGroundDetails(): Mesh {
  const parts: BufferGeometry[] = [];
  const add = (source: BufferGeometry, hex: string) => {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    geometry.deleteAttribute('uv');
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    const color = new Color(hex);
    const count = geometry.getAttribute('position').count;
    const colors: number[] = [];
    for (let i = 0; i < count; i++) colors.push(color.r, color.g, color.b);
    if (!geometry.getAttribute('color'))
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
  };
  const turf = new BufferGeometry();
  const turfPositions: number[] = [];
  const turfColors: number[] = [];
  const turfIndices: number[] = [];
  for (let ring = 0; ring <= TREE_TURF_RINGS; ring++) {
    for (let segment = 0; segment <= TREE_TURF_SEGMENTS; segment++) {
      const angle = (segment * Math.PI * 2) / TREE_TURF_SEGMENTS;
      const { x, z } = treeTurfPoint(angle, ring / TREE_TURF_RINGS);
      turfPositions.push(x, 0.095, z);
      const variation = 0.5 + Math.sin(x * 17 + z * 11) * 0.18 + Math.cos(z * 21 - x * 7) * 0.14;
      const tone = new Color('#335f30').lerp(new Color('#84af55'), variation);
      turfColors.push(tone.r, tone.g, tone.b);
      if (ring < TREE_TURF_RINGS && segment < TREE_TURF_SEGMENTS) {
        const a = ring * (TREE_TURF_SEGMENTS + 1) + segment;
        const b = a + TREE_TURF_SEGMENTS + 1;
        turfIndices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  turf.setAttribute('position', new Float32BufferAttribute(turfPositions, 3));
  turf.setAttribute('color', new Float32BufferAttribute(turfColors, 3));
  turf.setIndex(turfIndices);
  add(turf, '#829c4e');
  for (const detail of TREE_GROUND_DETAILS) {
    const { x, z, size, angle } = detail;
    if (detail.kind === 'stone') {
      const stone = new DodecahedronGeometry(1, 0);
      stone.scale(size, size * 0.7, size * 0.8);
      stone.rotateY(angle);
      stone.translate(x, 0.09 + size * 0.35, z);
      add(stone, ['#a8aca0', '#8b998c', '#c3bda7'][parts.length % 3]);
      for (let patch = 0; patch < 2; patch++) {
        const moss = new SphereGeometry(1, 7, 4);
        moss.scale(size * 0.5, size * 0.07, size * 0.35);
        moss.rotateY(angle + patch);
        moss.translate(
          x + Math.cos(angle + patch) * size * 0.25,
          0.09 + size * 0.96,
          z + Math.sin(angle + patch) * size * 0.2,
        );
        add(moss, patch ? '#77964b' : '#58763d');
      }
    } else if (detail.kind === 'grass') {
      continue;
    } else {
      const stem = new CylinderGeometry(0.004, 0.005, size, 4);
      stem.translate(x, 0.09 + size / 2, z);
      add(stem, '#718950');
      for (let petal = 0; petal < 6; petal++) {
        const a = (petal * Math.PI) / 3;
        const flower = new SphereGeometry(size * 0.12, 5, 3);
        flower.scale(1, 0.6, 1);
        flower.translate(x + Math.cos(a) * size * 0.15, 0.09 + size, z + Math.sin(a) * size * 0.15);
        add(flower, petal % 2 ? '#ece3bd' : '#dfd4ae');
      }
      const heart = new SphereGeometry(size * 0.11, 5, 3);
      heart.translate(x, 0.09 + size * 1.04, z);
      add(heart, '#c8aa54');
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  const mesh = new Mesh(
    merged,
    new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide }),
  );
  mesh.name = 'ground-scenery';
  return mesh;
}
