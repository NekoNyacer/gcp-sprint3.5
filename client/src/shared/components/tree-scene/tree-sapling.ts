import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { saplingPlan, SaplingStage } from './tree-sapling-plan';

export function createSaplingModel(stage: SaplingStage): Group {
  const model = new Group();
  model.name = 'botanical-sapling';
  const plan = saplingPlan(stage);
  const wood = plan.branches.map(({ points, radius }) => {
    const curve = new CatmullRomCurve3(points.map((point) => new Vector3(...point)));
    const geometry = new TubeGeometry(curve, 10, radius, 6, false);
    const vertices = geometry.getAttribute('position');
    for (let ring = 0; ring <= 10; ring++) {
      const center = curve.getPointAt(ring / 10);
      for (let side = 0; side <= 6; side++) {
        const index = ring * 7 + side;
        const vertex = new Vector3()
          .fromBufferAttribute(vertices, index)
          .sub(center)
          .multiplyScalar(1 - (ring / 10) * 0.85)
          .add(center);
        vertices.setXYZ(index, vertex.x, vertex.y, vertex.z);
      }
    }
    geometry.computeVertexNormals();
    return geometry;
  });
  const branches = new Mesh(
    mergeGeometries(wood),
    new MeshStandardMaterial({ color: stage === 'seedling' ? '#7e9267' : '#947f58', roughness: 1 }),
  );
  branches.name = 'sapling-stem';
  wood.forEach((geometry) => geometry.dispose());
  const leafShape = new Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.45, 0.3, 1, 0);
  leafShape.quadraticCurveTo(0.45, -0.3, 0, 0);
  const leaves = plan.leaves.map(({ x, y, z, angle, length }, index) => {
    const geometry = new ShapeGeometry(leafShape, 6);
    const vertices = geometry.getAttribute('position');
    const colors: number[] = [];
    for (let i = 0; i < vertices.count; i++) {
      const along = vertices.getX(i);
      vertices.setZ(i, Math.sin(along * Math.PI) * 0.11);
      const color = new Color('#35636a').lerp(
        new Color('#c4d17d'),
        0.3 + along * 0.55 + (index % 3) * 0.04,
      );
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.scale(length, length, length);
    geometry.rotateZ(angle);
    geometry.translate(x, y, z);
    return geometry;
  });
  const foliage = mergeGeometries(leaves);
  foliage.computeVertexNormals();
  const leafMesh = new Mesh(
    foliage,
    new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1 }),
  );
  leafMesh.name = 'sapling-leaves';
  leaves.forEach((geometry: BufferGeometry) => geometry.dispose());
  model.add(branches, leafMesh);
  return model;
}
