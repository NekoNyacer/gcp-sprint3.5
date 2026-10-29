import {
  Color,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import { TREE_SOIL_COLORS } from '../../models/tree-cultivation';
import { createGroundDetails } from './tree-ground-details';
import { createGrassCover } from './tree-grass-cover';

/** A shallow, irregular earth patch with a small baked grain texture. */
export function createTreeGround(): Mesh<CylinderGeometry, MeshStandardMaterial> {
  const geometry = new CylinderGeometry(1.2, 1.24, 0.18, 64, 1);
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const angle = Math.atan2(z, x);
    const radius = Math.hypot(x, z);
    const edge = 1 + Math.sin(angle * 5) * 0.025 + Math.cos(angle * 9) * 0.012;
    positions.setXYZ(i, x * edge, positions.getY(i) < 0 ? 0.025 : 0.09, z * edge);
    const tone = new Color('#f0e4cb');
    if (positions.getY(i) < 0.05) tone.set('#625b4c');
    else if (radius > 0.9) tone.lerp(new Color('#809372'), 0.32 + Math.sin(angle * 7) * 0.2);
    colors.push(tone.r, tone.g, tone.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 1947;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed / 4294967296) * 26;
      const mottling = Math.sin(x * 0.17 + Math.sin(y * 0.13)) * 8 + Math.cos(y * 0.23) * 5;
      const value = Math.round(205 + grain + mottling);
      pixels.set([value, value - 3, value - 10, 255], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(pixels, size, size);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  const ground = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: TREE_SOIL_COLORS.normal,
      map: texture,
      vertexColors: true,
      roughness: 1,
    }),
  );
  ground.name = 'botanical-soil';
  ground.position.y = -0.12;
  ground.add(createGroundDetails(), createGrassCover());
  return ground;
}
