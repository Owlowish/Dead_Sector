import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { MANSION_ROOMS, MANSION_WAYPOINTS, MANSION_SPAWNS, MANSION_PICKUPS } from '../src/MansionConfig.ts';
import { MANSION_OPEN_SPAWN_POOL } from '../src/EncounterConfig.ts';
import { mansionMaterial } from '../src/MansionMaterials.ts';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const { Level } = await import('../src/Level.ts');
const scene = new THREE.Scene(), level = new Level(scene);
scene.updateMatrixWorld(true);
const altar = scene.getObjectByName('demonic-altar');
assert.ok(altar, 'L’autel est présent dans le vrai niveau');
assert.deepEqual(altar.position.toArray(), [-18, 0, 0], 'Le point focal reste dans la Galerie');
const meshes = [];
altar.traverse(object => {
  assert.ok(!object.isLight, 'Le sanctuaire réutilise l’éclairage existant');
  if (!object.isMesh) return;
  meshes.push(object);
  assert.equal(object.castShadow, false, 'Aucun rendu supplémentaire dans les cartes d’ombre');
  for (const attribute of Object.values(object.geometry.attributes)) {
    for (const value of attribute.array) assert.ok(Number.isFinite(value), 'Géométrie finie');
  }
});
assert.ok(meshes.length > 0);
const solids = level.getSolidMeshes();
const altarSolids = meshes.filter(mesh => solids.includes(mesh));
assert.ok(altarSolids.length > 0, 'Les surfaces solides sont transmises aux armes');
for (const mesh of meshes) {
  const materials = [].concat(mesh.material);
  if (materials.some(material => material.transparent || material.blending === THREE.AdditiveBlending)) {
    assert.equal(solids.includes(mesh), false, 'Lueurs, flammes et volutes ne bloquent ni tirs ni visibilité IA');
  }
}
for (const name of ['altar-wisps', 'altar-flames', 'altar-embers']) {
  const effect = altar.getObjectByName(name);
  assert.ok(effect, `Effet intégré : ${name}`);
  assert.equal(solids.includes(effect), false, 'Les effets opaques comme transparents restent hors des raycasts');
}
function cast(from, to, objects = altarSolids) {
  return new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, from.distanceTo(to))
    .intersectObjects(objects, false);
}
for (const y of [0.6, 2.1, 3.25]) {
  for (const [start, end] of [[-15, -21], [-21, -15]]) {
    assert.ok(cast(new THREE.Vector3(start, y, 0), new THREE.Vector3(end, y, 0)).length > 0,
      `Pierre et cristaux exposent leurs deux côtés aux tirs, hauteur ${y}`);
  }
}
assert.equal(cast(new THREE.Vector3(-15, 1.7, 1.5), new THREE.Vector3(-21, 1.7, 1.5)).length, 0,
  'Les effets extérieurs ne créent pas une boîte de tir invisible');

const room = MANSION_ROOMS.find(item => item.id === 'galerie');
const inRoom = point => point.x >= room.bounds.minX && point.x <= room.bounds.maxX
  && point.z >= room.bounds.minZ && point.z <= room.bounds.maxZ;
const safePoints = [...MANSION_WAYPOINTS, ...MANSION_SPAWNS.flatMap(group => group.pool),
  ...MANSION_OPEN_SPAWN_POOL, ...MANSION_PICKUPS].filter(inRoom);
for (const point of safePoints) assert.equal(level.isColliding(point.x, point.z, 0.45), false,
  `Nœud, apparition ou ressource préservé : ${point.x},${point.z}`);
assert.equal(level.isColliding(-18, 0, 0.4), true, 'Le corps de pierre possède une emprise physique');
for (const [x, z] of [[-18, 1.5], [-18, -1.5], [-20, 0], [-16, 0]]) {
  assert.equal(level.isColliding(x, z, 0.4), false, 'Les quatre approches gardent un passage praticable');
}
for (const [from, to] of [[[-18, 1, 3], [-18, 1, -3]], [[-18, 1, -3], [-18, 1, 3]]]) {
  let current = new THREE.Vector3(...from), target = new THREE.Vector3(...to), reached = false;
  for (let step = 0; step < 20; step++) {
    const next = level.findNextWaypoint(current, target, 0.4);
    assert.ok(next && level.isPathClear(current, next, 0.4), 'Chaque segment de contournement est praticable');
    if (next.distanceTo(target) < 0.05) { reached = true; break; }
    assert.ok(next.distanceTo(current) > 0.05, 'Le contournement progresse sans boucle sur le même nœud');
    current.copy(next);
  }
  assert.ok(reached, 'L’autel se contourne dans les deux sens');
}

function visualState(root = altar) {
  const state = [];
  root.traverse(object => {
    state.push([...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray(), object.visible]);
    if (object.material) for (const material of [].concat(object.material)) {
      state.push([material.opacity, material.emissiveIntensity, material.color?.getHex(), material.emissive?.getHex()]);
    }
    if (object.isInstancedMesh) state.push(Array.from(object.instanceMatrix.array));
    // Les attributs capturent aussi les effets animés en place, sans inspecter des champs privés.
    if (object.geometry) for (const attribute of Object.values(object.geometry.attributes)) {
      state.push(Array.from(attribute.array));
    }
  });
  return state;
}
const frozen = visualState();
level.update(0.1, 0);
assert.deepEqual(visualState(), frozen, 'Le delta d’ambiance nul fige cristaux, flammes et effets');
level.update(0, 0.1);
assert.notDeepEqual(visualState(), frozen, 'La reprise fait avancer les effets du sanctuaire');

const { DemonicAltar } = await import('../src/DemonicAltar.ts');
const slowScene = new THREE.Scene(), fastScene = new THREE.Scene();
const slow = new DemonicAltar(slowScene), fast = new DemonicAltar(fastScene);
for (let frame = 0; frame < 8 * 30; frame++) slow.update(1 / 30);
for (let frame = 0; frame < 8 * 144; frame++) fast.update(1 / 144);
const slowState = visualState(slowScene), fastState = visualState(fastScene);
assert.equal(slowState.length, fastState.length);
for (let row = 0; row < slowState.length; row++) {
  assert.equal(slowState[row].length, fastState[row].length);
  for (let column = 0; column < slowState[row].length; column++) {
    const a = slowState[row][column], b = fastState[row][column];
    if (typeof a === 'number') assert.ok(Math.abs(a - b) < 1e-5, 'Même pose et mêmes effets après huit secondes à30/144Hz');
    else assert.equal(a, b);
  }
}
slow.dispose(); fast.dispose();

const shared = new Set(['stone', 'wood'].flatMap(surface => {
  const material = mansionMaterial(surface);
  return [material, material.map];
}).filter(Boolean));
let sharedDisposals = 0;
for (const resource of shared) resource.addEventListener('dispose', () => sharedDisposals++);
const resources = new Set(meshes.flatMap(mesh => [mesh.geometry, ...[].concat(mesh.material)])
  .filter(resource => !shared.has(resource)));
const disposed = new Map();
for (const resource of resources) resource.addEventListener('dispose', () =>
  disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
const unrelated = solids.filter(mesh => !altarSolids.includes(mesh));
level.disposeDecor(); level.disposeDecor();
assert.equal(level.getSolidMeshes(), solids, 'La référence partagée des solides reste stable');
assert.ok(altarSolids.every(mesh => !solids.includes(mesh)), 'Aucun autel détruit dans les cibles de tir');
assert.ok(unrelated.some(mesh => solids.includes(mesh)), 'Les murs du manoir restent disponibles');
assert.equal(altar.parent, null, 'Le sanctuaire est entièrement retiré du niveau');
for (const resource of resources) assert.equal(disposed.get(resource), 1, 'Une seule libération par ressource possédée');
assert.equal(sharedDisposals, 0, 'Les matériaux et textures communs restent utilisables');
console.log(`PASS : autel intégré, pierres/cristaux et ajours réels, FX sans occlusion, ${safePoints.length} points sûrs,
contournement dans les deux sens, pause/reprise, cadence30/144Hz et nettoyage unique.`);
