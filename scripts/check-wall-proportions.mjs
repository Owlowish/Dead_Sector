import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mansionWallGeometry } from '../src/MansionWallGeometry.ts';
import { MANSION_WALLS, getMansionFloorHeight } from '../src/MansionConfig.ts';

let loads = 0;
THREE.TextureLoader.prototype.load = function(url) {
  loads++;
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};
const { mansionWallMaterial } = await import('../src/MansionWallMaterial.ts');
const material = mansionWallMaterial();
assert.equal(mansionWallMaterial(), material, 'Un matériau partagé entre les murs');
assert.equal(loads, 1, 'Une seule texture chargée');
assert.deepEqual(material.map.repeat.toArray(), [1, 1], 'Échelle portée par les UV, sans clone par mur');
assert.equal(material.map.wrapS, THREE.RepeatWrapping);
assert.equal(material.map.wrapT, THREE.ClampToEdgeWrapping);
assert.equal(material.map.magFilter, THREE.NearestFilter);
assert.equal(material.map.minFilter, THREE.NearestMipmapNearestFilter);
assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
assert.equal(material.map.userData.url, '/assets/textures/mansion/wall-bands-v1.png');

const walls = MANSION_WALLS.filter(wall => wall.materialType === 'wall' && !wall.surface);
const paperMin = 260.5 / 512, paperMax = 507.5 / 512;
const woodMin = 4.5 / 512, woodMax = 251.5 / 512;
const tolerance = 2e-5;
const axisNormals = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
const ray = new THREE.Raycaster();
let triangles = 0, rays = 0, woodEdges = 0, paperEdges = 0;

for (const wall of walls) {
  const source = new THREE.BoxGeometry(wall.width, wall.height, wall.depth);
  const geometry = mansionWallGeometry(wall);
  source.computeBoundingBox(); geometry.computeBoundingBox();
  assert.ok(source.boundingBox.min.distanceTo(geometry.boundingBox.min) < tolerance, 'Borne minimale conservée');
  assert.ok(source.boundingBox.max.distanceTo(geometry.boundingBox.max) < tolerance, 'Borne maximale conservée');
  assert.equal(geometry.groups.length, 0, 'Un seul appel de dessin par mur');
  triangles += geometry.index.count / 3;
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  const areas = [0, 0, 0, 0, 0, 0], seen = new Set();

  for (let index = 0; index < geometry.index.count; index += 3) {
    const vertices = [0, 1, 2].map(i => geometry.index.getX(index + i));
    const points = vertices.map(i => new THREE.Vector3().fromBufferAttribute(position, i));
    const n = new THREE.Vector3().fromBufferAttribute(normal, vertices[0]);
    const face = axisNormals.findIndex(axis => axis.equals(n));
    assert.ok(face >= 0, 'Une des six normales originales');
    for (const vertex of vertices) assert.ok(new THREE.Vector3().fromBufferAttribute(normal, vertex).equals(n));
    const cross = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
    assert.ok(cross.dot(n) > 0, 'Orientation extérieure conservée');
    areas[face] += cross.length() / 2;
    const signature = points.map(p => p.toArray().map(x => x.toFixed(5)).join(',')).sort().join('/');
    assert.ok(!seen.has(signature), 'Aucun triangle superposé'); seen.add(signature);
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
    const world = center.clone().add(new THREE.Vector3(wall.x, wall.y, wall.z));

    if (n.y !== 0) {
      for (const vertex of vertices) assert.ok(uv.getY(vertex) >= woodMin && uv.getY(vertex) <= woodMax);
      continue;
    }
    const floor = getMansionFloorHeight(world.x, world.z), woodTop = floor + 1.05;
    const isWood = world.y < woodTop;
    const heights = points.map(point => point.y + wall.y);
    assert.ok(!(Math.min(...heights) < woodTop - tolerance && Math.max(...heights) > woodTop + tolerance), 'Aucun triangle traversant la cimaise');
    const depths = points.map(point => point.z + wall.z);
    assert.ok(!(Math.min(...depths) < -7 - tolerance && Math.max(...depths) > -7 + tolerance), 'Découpe au changement de sol');
    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i], point = points[i];
      const along = n.z !== 0 ? n.z * (point.x + wall.x) : -n.x * (point.z + wall.z);
      assert.ok(Math.abs(uv.getX(vertex) * 2.1 - along) < tolerance, 'Phase et échelle horizontales mondiales');
      const v = uv.getY(vertex), min = isWood ? woodMin : paperMin, max = isWood ? woodMax : paperMax;
      assert.ok(v >= min - tolerance && v <= max + tolerance, 'Sous-bande isolée de son voisine');
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const delta = points[j].clone().sub(points[i]);
      if (Math.abs(delta.x) > tolerance || Math.abs(delta.z) > tolerance || Math.abs(delta.y) < tolerance) continue;
      const actual = (uv.getY(vertices[j]) - uv.getY(vertices[i])) / delta.y;
      const expected = world.y < floor ? 0 : (247 / 512) / (isWood ? 1.05 : 2.1);
      assert.ok(Math.abs(actual - expected) < tolerance, 'Même densité verticale quelle que soit la hauteur du mur');
      if (isWood && world.y >= floor) woodEdges++; else if (!isWood) paperEdges++;
    }
  }
  const expectedAreas = [wall.depth * wall.height, wall.depth * wall.height, wall.width * wall.depth, wall.width * wall.depth, wall.width * wall.height, wall.width * wall.height];
  areas.forEach((area, face) => assert.ok(Math.abs(area - expectedAreas[face]) < 1e-3, 'Surface de chaque face conservée'));

  const originalMesh = new THREE.Mesh(source, material), newMesh = new THREE.Mesh(geometry, material);
  originalMesh.updateMatrixWorld(); newMesh.updateMatrixWorld();
  const originalPositions = source.getAttribute('position');
  for (let face = 0; face < 6; face++) {
    const a = new THREE.Vector3().fromBufferAttribute(originalPositions, face * 4);
    const horizontal = new THREE.Vector3().fromBufferAttribute(originalPositions, face * 4 + 1).sub(a);
    const vertical = new THREE.Vector3().fromBufferAttribute(originalPositions, face * 4 + 2).sub(a);
    const n = axisNormals[face];
    for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) {
      const point = a.clone().addScaledVector(horizontal, (x + 0.5) / 7).addScaledVector(vertical, (y + 0.5) / 7);
      ray.set(point.clone().addScaledVector(n, 2), n.clone().negate());
      const before = ray.intersectObject(originalMesh)[0], after = ray.intersectObject(newMesh)[0];
      assert.ok(before && after, 'Aucune intersection perdue');
      assert.ok(Math.abs(before.distance - after.distance) < tolerance, 'Distance de tir conservée');
      assert.ok(after.face.normal.distanceTo(before.face.normal) < tolerance, 'Normale de tir conservée');
      rays++;
    }
  }
  source.dispose(); geometry.dispose();
}
assert.equal(walls.length, 14);
assert.equal(triangles, 448);
assert.ok(woodEdges > 0 && paperEdges > 0);

// Les deux faces longues doivent porter la cimaise à 1,05 m puis 3,45 m,
// dans le même mesh, de part et d'autre du demi-niveau.
for (const x of [-24, 24]) {
  const wall = walls.find(wall => wall.x === x), geometry = mansionWallGeometry(wall);
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(wall.x, wall.y, wall.z); mesh.updateMatrixWorld();
  const inward = new THREE.Vector3(-Math.sign(x), 0, 0);
  const sample = (z, y) => {
    ray.set(new THREE.Vector3(x - Math.sign(x) * 2, y, z), inward.clone().negate());
    const hit = ray.intersectObject(mesh)[0]; assert.ok(hit); return hit.uv;
  };
  for (const [z, floor] of [[8, 0], [-12, 2.4]]) {
    assert.ok(sample(z, floor + 1.04).y < 0.5, 'Bois juste sous la cimaise locale');
    assert.ok(sample(z, floor + 1.06).y > 0.5, 'Papier juste au-dessus de la cimaise locale');
    const first = sample(z, floor + 1.3), next = sample(z, floor + 3.4);
    assert.ok(Math.abs(first.y - next.y) < tolerance, 'Papier répété tous les 2,10 m, sans nouveau lambris');
  }
  geometry.dispose();
}

const atlas = readFileSync('public/assets/textures/mansion/wall-bands-v1.png');
assert.equal(atlas.readUInt32BE(16), 256); assert.equal(atlas.readUInt32BE(20), 512);
console.log(`PASS : ${walls.length} murs, ${triangles} triangles (+${triangles - walls.length * 12}), ${rays} rayons identiques ; cimaise locale 1,05 m, papier 2,10 m, atlas et matériau uniques.`);
