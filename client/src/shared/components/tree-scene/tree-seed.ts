import { Mesh, SphereGeometry, MeshStandardMaterial, Color, Float32BufferAttribute } from 'three';
export function createSeedModel(surfaceY: number): Mesh {
  const seed = new Mesh(
    new SphereGeometry(0.2, 16, 10),
    new MeshStandardMaterial({ color: 0x93734f, roughness: 1, vertexColors: true }),
  );
  const hull = seed.geometry.getAttribute('position');
  const tones: number[] = [];
  for (let i = 0; i < hull.count; i++) {
    const x = hull.getX(i),
      y = hull.getY(i),
      z = hull.getZ(i);
    const seam = Math.abs(z) < 0.025 && x > 0;
    const tone = new Color(seam ? '#67563d' : '#d4c29d');
    if (!seam) tone.lerp(new Color('#7c7356'), (1 - y / 0.2) * 0.3);
    tones.push(tone.r, tone.g, tone.b);
  }
  seed.geometry.setAttribute('color', new Float32BufferAttribute(tones, 3));
  seed.scale.set(1, 0.7, 0.75);
  seed.position.y = surfaceY;
  return seed;
}
