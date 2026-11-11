import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Level } from '../src/Level.ts';

THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const level = new Level(new THREE.Scene());
const blockers = level.getSolidMeshes();
const ray = new THREE.Raycaster();
// Oracle : intersections exhaustives natives, sans la portée ni l'arrêt au premier obstacle.
function exhaustive(from, to) {
  const distance = from.distanceTo(to);
  if (distance < 0.001) return true;
  ray.set(from, to.clone().sub(from).divideScalar(distance));
  ray.near = 0.1; ray.far = distance;
  for (const mesh of blockers) mesh.updateWorldMatrix(true, false);
  return ray.intersectObjects(blockers, false).length === 0;
}
let seed = 4163;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
let checked = 0;
for (const open of [false, true]) {
  if (open) for (const door of level.getDoors()) { door.unlock(); door.toggle(); door.update(5, []); }
  for (let i = 0; i < 400; i++) {
    const point = () => new THREE.Vector3(random() * 46 - 23, random() * 4 + 0.1, random() * 38 - 19);
    const from = point(), to = point();
    assert.equal(level.hasLineOfSight(from, to), exhaustive(from, to), `rayon réel ${i}, portes ouvertes=${open}`);
    checked++;
  }
}

// Portées imbriquées : une seule synchronisation, puis réactualisation hors portée.
const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 4), new THREE.MeshBasicMaterial());
const parent = new THREE.Group(); parent.add(wall);
blockers.splice(0, blockers.length, wall);
const from = new THREE.Vector3(-3, 1, 0), to = new THREE.Vector3(3, 1, 0);
let updates = 0;
const update = wall.updateWorldMatrix;
wall.updateWorldMatrix = function (...args) { updates++; return update.apply(this, args); };
level.beginVisibilityQueryBatch();
assert.equal(level.hasLineOfSight(from, to), false);
level.beginVisibilityQueryBatch();
assert.equal(level.hasLineOfSight(from, to), false);
level.endVisibilityQueryBatch();
assert.equal(level.hasLineOfSight(from, to), false);
level.endVisibilityQueryBatch();
assert.equal(updates, 1, 'Les matrices ne sont mises à jour qu’une fois pendant la sélection synchrone');
parent.position.z = 20;
assert.equal(level.hasLineOfSight(from, to), true, 'Une transformation de parent est relue hors portée');
assert.equal(updates, 2);
try {
  level.beginVisibilityQueryBatch();
  level.hasLineOfSight(from, to);
  throw new Error('sélection abandonnée');
} catch {} finally { level.endVisibilityQueryBatch(); }
parent.position.z = 0;
assert.equal(level.hasLineOfSight(from, to), false, 'Pas de cache périmé après abandon d’une sélection');

wall.layers.set(1);
assert.equal(level.hasLineOfSight(from, to), true, 'Les layers du Raycaster natif restent respectés');
wall.layers.set(0);
assert.equal(level.hasLineOfSight(from, from.clone().addScalar(0.00001)), true, 'Segment nul');
assert.equal(level.hasLineOfSight(new THREE.Vector3(-3, 1, 0), new THREE.Vector3(-2, 1, 0)), true, 'Obstacle après la cible ignoré');
console.log(`PASS : ${checked} rayons du vrai manoir, portes, portée imbriquée, abandon, parents mobiles, layers et distance.`);
