import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MansionFurnishings, mansionFurnishingParts, furnishingBudget } from '../src/MansionFurnishings.ts';
import { MANSION_ROOMS, MANSION_WALLS, getMansionFloorHeight } from '../src/MansionConfig.ts';

const scene = new THREE.Scene();
const furnishings = new MansionFurnishings(scene);
const group = scene.getObjectByName('mansion-furnishings');
assert.ok(group);
assert.equal(group.children.length, 6);
assert.ok(group.children.length <= furnishingBudget.maxMeshes);
assert.equal(new Set(group.children.map(mesh => mesh.material)).size, 1, 'Un matériau partagé pour les six pièces');
const material = group.children[0].material;
assert.equal(material.map, null, 'Aucune image ou texture GPU ajoutée');
assert.equal(material.transparent, false);
assert.equal(material.vertexColors, true);
assert.equal(scene.getObjectsByProperty('isLight', true).length, 0);

let triangles = 0;
for (const mesh of group.children) {
  assert.equal(mesh.castShadow, false, 'Pas de soumission dans les passes des ombres');
  assert.equal(mesh.receiveShadow, true);
  assert.equal(mesh.matrixAutoUpdate, false);
  assert.equal(mesh.geometry.groups.length, 0, 'Un seul appel de dessin par pièce visible');
  assert.ok(mesh.geometry.boundingBox && mesh.geometry.boundingSphere, 'Élimination hors champ disponible');
  assert.equal(mesh.geometry.index, null);
  const position = mesh.geometry.getAttribute('position');
  const normal = mesh.geometry.getAttribute('normal');
  const color = mesh.geometry.getAttribute('color');
  assert.equal(position.count, color.count);
  assert.equal(position.count, normal.count);
  triangles += position.count / 3;
  for (let i = 0; i < position.count; i++) {
    assert.ok(Number.isFinite(position.getX(i)) && Number.isFinite(position.getY(i)) && Number.isFinite(position.getZ(i)));
    assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(normal, i).length() - 1) < 1e-5);
    for (const value of [color.getX(i), color.getY(i), color.getZ(i)]) assert.ok(value >= 0 && value <= 1);
  }
}
assert.ok(triangles <= furnishingBudget.maxTriangles, `${triangles} triangles dans le budget`);

// On contrôle les volumes réels des primitives, pas uniquement leurs points de placement.
function partGeometry(part) {
  let geometry = part.shape === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
    : part.shape === 'octahedron' ? new THREE.OctahedronGeometry(1, 0) : new THREE.BoxGeometry(1, 1, 1);
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...part.center),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), part.rotationY ?? 0),
    new THREE.Vector3(...part.size),
  ));
  geometry.computeBoundingBox();
  return geometry;
}
const structural = new THREE.MeshBasicMaterial();
const supportMeshes = MANSION_WALLS.map(wall => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.width, wall.height, wall.depth), structural);
  mesh.position.set(wall.x, wall.y, wall.z);
  mesh.updateMatrixWorld(true);
  return mesh;
});
const offsets = new Map(MANSION_ROOMS.map(room => [room.id, 0]));
for (const part of mansionFurnishingParts) {
  const room = MANSION_ROOMS.find(candidate => candidate.id === part.roomId);
  assert.ok(room);
  const [x, y, z] = part.center;
  assert.ok(x >= room.bounds.minX && x <= room.bounds.maxX && z >= room.bounds.minZ && z <= room.bounds.maxZ);
  const wall = MANSION_WALLS[part.supportIndex];
  assert.ok(wall, `Support de ${part.feature}`);
  const geometry = partGeometry(part), bounds = geometry.boundingBox;
  const mesh = group.getObjectByName(`mansion-furnishings-${part.roomId}`);
  const mergedPosition = mesh.geometry.getAttribute('position');
  const count = geometry.index?.count ?? geometry.getAttribute('position').count;
  const offset = offsets.get(part.roomId), mergedBounds = new THREE.Box3();
  for (let i = offset; i < offset + count; i++) mergedBounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(mergedPosition, i));
  assert.ok(mergedBounds.min.distanceTo(bounds.min) < 1e-5 && mergedBounds.max.distanceTo(bounds.max) < 1e-5,
    'La fusion conserve les dimensions, le placement et la rotation des volumes contrôlés');
  offsets.set(part.roomId, offset + count);
  const floor = getMansionFloorHeight(x, z), ceiling = z > 6 ? 4 : 6.4;
  assert.ok(bounds.min.y > floor && bounds.max.y < ceiling + 0.001, `${part.roomId}/${part.feature} entre sol et plafond`);
  if (bounds.min.y < floor + 2.5) {
    assert.equal(wall.materialType, 'obstacle', `${part.feature} ne pénètre pas les trajets du joueur`);
    assert.ok(bounds.min.x >= wall.x - wall.width / 2 && bounds.max.x <= wall.x + wall.width / 2
      && bounds.min.z >= wall.z - wall.depth / 2 && bounds.max.z <= wall.z + wall.depth / 2,
    `${part.roomId}/${part.feature} dans l'emprise déjà bloquante`);
  }
  if (part.feature.startsWith('cornice') || part.feature.startsWith('entrance-corbel')) {
    assert.equal(wall.materialType, 'wall');
    const supportBounds = new THREE.Box3().setFromObject(supportMeshes[part.supportIndex]);
    const samples = [new THREE.Vector3(x, y, z)];
    if (part.feature.startsWith('cornice')) {
      const along = wall.width > wall.depth ? 'x' : 'z';
      const low = samples[0].clone(), high = samples[0].clone();
      low[along] = bounds.min[along] + 0.01; high[along] = bounds.max[along] - 0.01;
      samples.push(low, high);
    }
    for (const target of samples) {
      const outward = supportBounds.clampPoint(target, new THREE.Vector3()).sub(target).normalize();
      const hits = new THREE.Raycaster(target, outward, 0, 0.45).intersectObject(supportMeshes[part.supportIndex]);
      assert.ok(hits.length > 0, `${part.roomId}/${part.feature} adossé à un mur plein, hors porte`);
    }
  }
  geometry.dispose();
}
for (const room of MANSION_ROOMS) {
  const parts = mansionFurnishingParts.filter(part => part.roomId === room.id);
  assert.ok(parts.some(part => part.feature === 'cornice-body'), `Couronnement dans ${room.id}`);
  assert.ok(parts.some(part => !part.feature.startsWith('cornice')), `Repère propre à ${room.id}`);
  assert.equal(offsets.get(room.id), group.getObjectByName(`mansion-furnishings-${room.id}`).geometry.getAttribute('position').count);
}
for (const mesh of supportMeshes) mesh.geometry.dispose();
structural.dispose();

let disposed = 0;
for (const mesh of group.children) mesh.geometry.addEventListener('dispose', () => disposed++);
material.addEventListener('dispose', () => disposed++);
furnishings.dispose();
furnishings.dispose();
assert.equal(disposed, 7, 'Six géométries et matériau libérés une seule fois');
assert.equal(group.parent, null);
console.log(`PASS : ${mansionFurnishingParts.length} primitives, six pièces, ${triangles} triangles, six appels au plus ; supports, emprises basses, plafonds et nettoyage.`);
