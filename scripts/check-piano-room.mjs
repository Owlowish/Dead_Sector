import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import {
  PIANO_ROOM_LAYOUT, PLAYER_START_POSITION, MANSION_ROOMS, MANSION_WAYPOINTS,
  MANSION_SPAWNS, MANSION_PICKUPS, MANSION_HORROR_POINTS, MANSION_STORM_WINDOWS,
} from '../src/MansionConfig.ts';
import { MANSION_OPEN_SPAWN_POOL } from '../src/EncounterConfig.ts';
import { mansionMaterial } from '../src/MansionMaterials.ts';
import { getFootstepSurfaceAt } from '../src/FootstepAudio.ts';
import { getImpactSurface } from '../src/ImpactSurface.ts';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const requestedTextures = [];
THREE.TextureLoader.prototype.load = function (url) {
  requestedTextures.push(url);
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};

const { PianoRoomDecor } = await import('../src/PianoRoomDecor.ts');
const { Level } = await import('../src/Level.ts');
const { piano, bench, carpet, console: consoleSpec } = PIANO_ROOM_LAYOUT;
const localToWorld = (x, y, z) => new THREE.Vector3(x, y, z)
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), piano.rotationY)
  .add(new THREE.Vector3(piano.x, 0, piano.z));
const scene = new THREE.Scene();
const decor = new PianoRoomDecor(scene);
scene.updateMatrixWorld(true);
const blockers = decor.getSolidMeshes();
assert.ok(blockers.length > 0, 'Le mobilier expose ses surfaces réelles aux tirs');

function verticalCast(objects, x, z) {
  // Départ sous le lustre : ce contrôle cible le mobilier, pas l’éclairage suspendu.
  return new THREE.Raycaster(localToWorld(x, 2.55, z), new THREE.Vector3(0, -1, 0), 0, 2.4)
    .intersectObjects(objects, false)[0];
}
const keyboardHit = verticalCast(blockers, 0.2, 1.32);
assert.ok(keyboardHit && keyboardHit.point.y > 0.8 && keyboardHit.point.y < 1.2,
  'Un tir atteint les touches à hauteur de clavier');
assert.equal(getImpactSurface(keyboardHit), 'wood', 'Le clavier utilise les impacts du mobilier');
const lidHit = verticalCast(blockers, 0, 0);
assert.ok(lidHit && lidHit.point.y > 1.2 && lidHit.point.y < 2.6,
  'Le couvercle ouvert arrête les tirs au-dessus du corps');
assert.equal(getImpactSurface(lidHit), 'wood');
const underStart = localToWorld(-1.3, 0.55, 0);
const underEnd = localToWorld(1.3, 0.55, 0);
assert.equal(new THREE.Raycaster(underStart, underEnd.clone().sub(underStart).normalize(), 0, underStart.distanceTo(underEnd))
  .intersectObjects(blockers, false).length, 0, 'Le vide entre les pieds ne devient pas une boîte de tir invisible');

const meshes = [];
scene.traverse(object => {
  assert.ok(!object.isLight, 'Le salon réutilise les sources lumineuses du niveau');
  if (!object.isMesh) return;
  meshes.push(object);
  assert.equal(object.castShadow, false, 'Le lot n’ajoute aucun rendu dans les cartes d’ombre');
  for (const attribute of Object.values(object.geometry.attributes)) {
    for (const value of attribute.array) assert.ok(Number.isFinite(value), 'Les géométries sont finies');
  }
});
assert.ok(meshes.length <= 16, `Le mobilier reste fusionné : ${meshes.length} surfaces, budget 16`);
for (const url of requestedTextures) {
  assert.ok(url.startsWith('/assets/') && existsSync(`public${url}`), `Texture réellement disponible : ${url}`);
}
const chandelierMeshes = meshes.filter(mesh => mesh.name.includes('chandelier'));
for (const mesh of chandelierMeshes) assert.ok(new THREE.Box3().setFromObject(mesh).min.y >= 2.6,
  'Le lustre laisse libre le volume de déplacement');

const shared = [mansionMaterial('carpet'), mansionMaterial('carpet', 2, 2), mansionMaterial('wood')];
const sharedResources = new Set(shared.flatMap(material => [material, material.map]));
let sharedDisposals = 0;
for (const resource of sharedResources) resource.addEventListener('dispose', () => sharedDisposals++);
const owned = new Set(meshes.flatMap(mesh => [mesh.geometry, ...[].concat(mesh.material)])
  .filter(resource => !sharedResources.has(resource)));
const disposalCounts = new Map();
for (const resource of owned) resource.addEventListener('dispose', () =>
  disposalCounts.set(resource, (disposalCounts.get(resource) ?? 0) + 1));
decor.dispose(); decor.dispose();
assert.equal(scene.children.length, 0, 'Le décor est entièrement retiré après destruction');
for (const resource of owned) assert.equal(disposalCounts.get(resource), 1, 'Une seule libération par ressource possédée');
assert.equal(sharedDisposals, 0, 'Les surfaces communes aux autres pièces restent utilisables');

const levelScene = new THREE.Scene();
const level = new Level(levelScene);
levelScene.updateMatrixWorld(true);
const room = MANSION_ROOMS.find(item => item.id === 'vestibule');
const inRoom = point => point.x >= room.bounds.minX && point.x <= room.bounds.maxX
  && point.z >= room.bounds.minZ && point.z <= room.bounds.maxZ;
const safePoints = [PLAYER_START_POSITION, ...MANSION_WAYPOINTS, ...MANSION_SPAWNS.flatMap(group => group.pool),
  ...MANSION_OPEN_SPAWN_POOL, ...MANSION_PICKUPS, ...MANSION_HORROR_POINTS].filter(inRoom);
for (const point of safePoints) assert.equal(level.isColliding(point.x, point.z, 0.45), false,
  `Départ, ressource, apparition ou nœud préservé : ${point.x},${point.z}`);
assert.equal(level.isColliding(piano.x, piano.z, 0.35), true, 'Le corps du piano bloque le déplacement');
const benchCenter = localToWorld(0, 0, bench.localZ);
assert.equal(level.isColliding(benchCenter.x, benchCenter.z, 0.35), true, 'La banquette possède une emprise physique');
assert.equal(level.isColliding(consoleSpec.x, consoleSpec.z, 0.35), true, 'La console possède une emprise physique');

const playerStart = new THREE.Vector3(PLAYER_START_POSITION.x, PLAYER_START_POSITION.y, PLAYER_START_POSITION.z);
function checkRoute(target) {
  let current = playerStart.clone();
  for (let step = 0; step < 20; step++) {
    const next = level.findNextWaypoint(current, target, 0.4);
    assert.ok(next, `Chemin conservé vers ${target.x},${target.z}`);
    assert.ok(level.isPathClear(current, next, 0.4), 'Chaque segment retourné est praticable');
    if (Math.hypot(next.x - target.x, next.z - target.z) < 0.05) return;
    assert.ok(Math.hypot(next.x - current.x, next.z - current.z) > 0.05,
      `La recherche de chemin progresse : ${current.x},${current.z} vers ${target.x},${target.z}`);
    current.copy(next);
  }
  assert.fail(`Le chemin n’atteint pas ${target.x},${target.z}`);
}
for (const [x, z] of [[-5.5, 9.5], [-5.5, 16.5], [16, 10], [18, 16], [8, 8]])
  checkRoute(new THREE.Vector3(x, 1.7, z));
const hallDoor = level.getDoors().find(door => door.getId() === 'door_grand_hall');
hallDoor.unlock(); hallDoor.toggle(); hallDoor.update(5);
checkRoute(new THREE.Vector3(0, 1.7, 4.5));

const window = MANSION_STORM_WINDOWS.find(item => inRoom(item));
assert.ok(window && window.z < playerStart.z && window.width >= 3.5, 'La grande fenêtre est visible devant l’arrivée');
assert.ok(window.y + window.height / 2 < level.getCeilingHeightAt(window.x, window.z), 'La fenêtre reste sous le plafond');
assert.equal(getFootstepSurfaceAt(carpet.x - carpet.width / 2 + 0.2, carpet.z), 'carpet', 'Les pas suivent le nouveau tapis');
assert.equal(getFootstepSurfaceAt(carpet.x - carpet.width / 2 - 0.2, carpet.z), 'wood', 'Le parquet reste distinct hors du tapis');

const solidArray = level.getSolidMeshes();
const names = new Set(blockers.map(mesh => mesh.name));
const integratedBlockers = solidArray.filter(mesh => names.has(mesh.name));
assert.equal(integratedBlockers.length, blockers.length, 'Level transmet toutes les surfaces du mobilier aux armes');
assert.equal(verticalCast(solidArray, 0.2, 1.32)?.object.name, keyboardHit.object.name, 'Les tirs intégrés atteignent le clavier réel');
const sentinel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
solidArray.push(sentinel);
level.disposeDecor(); level.disposeDecor();
assert.equal(level.getSolidMeshes(), solidArray, 'La référence partagée avec les armes reste stable');
assert.ok(solidArray.includes(sentinel), 'Le nettoyage conserve les solides étrangers au lot');
assert.ok(integratedBlockers.every(mesh => !solidArray.includes(mesh)), 'Aucun mobilier détruit ne reste dans les cibles');
assert.ok(solidArray.length > 10, 'Les murs et portes du manoir restent disponibles');
assert.equal(levelScene.getObjectByName('piano-room-decor'), undefined);
sentinel.geometry.dispose(); sentinel.material.dispose();

console.log(`PASS : piano/couvercle/clavier et ajours réels, ${meshes.length} surfaces sans lumière/ombre,
${safePoints.length} points sûrs, six itinéraires, fenêtre/tapis et nettoyage partagé.`);
