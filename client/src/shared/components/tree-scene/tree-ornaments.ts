import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { treeAppearance } from '../../../../../functions/src/tree-species';
import { TREE_ORNAMENTS } from './tree-canopy-plan';

export function createTreeOrnaments(species = '榕樹'): Mesh {
  const appearance = treeAppearance(species);
  const positions: number[] = [],
    colors: number[] = [],
    centers: number[] = [];
  for (const [index, center] of TREE_ORNAMENTS.entries()) {
    const add = (x: number, y: number, z: number, color: Color) => {
      positions.push(center.x + x, center.y + y, center.z + z);
      colors.push(color.r, color.g, color.b);
      centers.push(center.x, center.y, center.z);
    };
    {
      for (let petal = 0; petal < 6; petal++) {
        const angle = (petal * Math.PI * 2) / 5;
        const cx = petal === 5 ? 0 : Math.cos(angle) * 0.035;
        const cy = petal === 5 ? 0 : Math.sin(angle) * 0.035;
        const radius = petal === 5 ? 0.017 : 0.028;
        const color = new Color(petal === 5 ? appearance.flowerCenter : appearance.flower);
        for (let edge = 0; edge < 6; edge++) {
          const a = (edge * Math.PI) / 3,
            b = ((edge + 1) * Math.PI) / 3;
          add(cx, cy, 0.012, color);
          add(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 0, color);
          add(cx + Math.cos(b) * radius, cy + Math.sin(b) * radius, 0, color);
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('popCenter', new Float32BufferAttribute(centers, 3));
  geometry.computeVertexNormals();
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.85 }),
  );
  mesh.name = 'tree-flowers';
  return mesh;
}
