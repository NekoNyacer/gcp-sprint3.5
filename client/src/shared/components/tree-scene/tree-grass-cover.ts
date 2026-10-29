import {
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
} from 'three';
import { TREE_GROUND_DETAILS } from './tree-ground-plan';
import { grassPatchPixels } from './tree-grass-patch';

/** Dense overlapping painted clumps: one static draw call, no per-blade animation. */
export function createGrassCover(): Mesh<BufferGeometry, MeshBasicMaterial> {
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [];
  for (const patch of TREE_GROUND_DETAILS) {
    if (patch.kind !== 'grass') continue;
    for (let card = 0; card < 3; card++) {
      const angle = patch.angle + (card * Math.PI) / 3;
      const width = patch.size * 1.7;
      const dx = (Math.cos(angle) * width) / 2,
        dz = (Math.sin(angle) * width) / 2;
      const y = 0.096,
        height = patch.size;
      const vertices = [
        [patch.x - dx, y, patch.z - dz],
        [patch.x + dx, y, patch.z + dz],
        [patch.x - dx, y + height, patch.z - dz],
        [patch.x + dx, y + height, patch.z + dz],
      ];
      // Keep roots on the platform instead of forming a floating skirt around its rim.
      for (const vertex of vertices) {
        const radius = Math.hypot(vertex[0], vertex[2]);
        if (radius > 1.17) {
          vertex[0] *= 1.17 / radius;
          vertex[2] *= 1.17 / radius;
        }
      }
      const tint = new Color('#c8deb0').lerp(
        new Color('#ffffff'),
        0.5 + Math.sin(patch.angle * 7) * 0.35,
      );
      const uv = [
        [0, 1],
        [1, 1],
        [0, 0],
        [1, 0],
      ];
      for (const i of [0, 1, 2, 2, 1, 3]) {
        positions.push(...vertices[i]);
        uvs.push(...uv[i]);
        colors.push(tint.r, tint.g, tint.b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const texture = new DataTexture(grassPatchPixels(), 256, 256);
  // Typed-array textures use their stored row order; the UVs put blade roots at the soil.
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      side: DoubleSide,
      alphaTest: 0.35,
      alphaToCoverage: true,
      depthWrite: true,
    }),
  );
  mesh.name = 'ground-grass-cover';
  return mesh;
}
