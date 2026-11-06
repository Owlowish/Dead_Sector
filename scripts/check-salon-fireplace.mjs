import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';
import { mansionMaterial } from '../src/MansionMaterials.ts';
import { getImpactSurface } from '../src/ImpactSurface.ts';

const atlas = readSpritePng('public/assets/textures/mansion/hearth-reliefs-v1.png');
const pendingLoads = [];
const previousDocument = globalThis.document;
// Le masque utilise les vrais pixels exportés ; seul le canvas de lecture est simulé.
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    let drawnImage;
    return {
      width: 0, height: 0,
      getContext() {
        return {
          drawImage(image) { drawnImage = image; },
          getImageData() { return { data: drawnImage.data }; },
        };
      },
    };
  },
};
THREE.TextureLoader.prototype.load = function (url, onLoad) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  if (url.endsWith('/hearth-reliefs-v1.png')) texture.image = atlas;
  if (onLoad) pendingLoads.push({ texture, complete: () => onLoad(texture) });
  return texture;
};
const { SalonFireplace } = await import('../src/SalonFireplace.ts');
const { Level } = await import('../src/Level.ts');
const spec = { x: -14, y: 1.5, z: 13, width: 2.4, height: 3, depth: 4 };
const scene = new THREE.Scene();
const fireplace = new SalonFireplace(scene, spec);
scene.updateMatrixWorld(true);
const cast = (objects, y, z = 13) => new THREE.Raycaster(
  new THREE.Vector3(-10, y, z), new THREE.Vector3(-1, 0, 0),
).intersectObjects(objects, false)[0];

const reliefMeshes = fireplace.getShotBlockers().filter(mesh => ['salon-fireplace-reliefs', 'salon-fireplace-clock'].includes(mesh.name));
assert.equal(reliefMeshes.length, 2);
assert.ok(reliefMeshes.every(mesh => !mesh.visible), 'Les reliefs ne sont pas visibles avant chargement');
assert.equal(cast(reliefMeshes, 2.47), undefined, 'Une plaque non chargée ne devient pas un obstacle invisible');
pendingLoads.find(load => load.texture.name === 'salon-fireplace-reliefs-atlas').complete();
assert.ok(reliefMeshes.every(mesh => mesh.visible), 'Les deux plaques apparaissent après préparation du masque');

const sculptureHit = cast(fireplace.getShotBlockers(), 2.47);
assert.equal(sculptureHit?.object.name, 'salon-fireplace-reliefs', 'Un pixel opaque de la sculpture bloque les tirs');
const lowMarginHit = cast(fireplace.getShotBlockers(), 2.00);
assert.equal(lowMarginHit?.object.name, 'salon-fireplace-brick', 'La marge transparente du cartouche laisse le tir entrer dans le foyer');
assert.ok(lowMarginHit.point.x < -14.7);
const clock = scene.getObjectByName('salon-fireplace-clock');
const clockBounds = new THREE.Box3().setFromObject(clock);
const clockCenterY = (clockBounds.min.y + clockBounds.max.y) / 2;
assert.equal(cast([clock], clockCenterY + 0.245, 12.10), undefined, 'La marge transparente de la pendule laisse passer les tirs');
assert.equal(cast([clock], clockCenterY, 12.34)?.object, clock, 'Le cadran opaque de la pendule bloque le tir');
assert.equal(getImpactSurface(cast([clock], clockCenterY, 12.34)), 'metal');
const clockAlpha = alphaBounds(atlas, { x: 256, y: 256, width: 256, height: 256 });
const clockBottomMargin = (512 - clockAlpha.y - clockAlpha.height) / 256;
const visibleClockBase = clockBounds.min.y + clockBottomMargin * (clockBounds.max.y - clockBounds.min.y);
assert.ok(Math.abs(visibleClockBase - 3.005) < 0.002, 'Le socle visible de la pendule repose sur le manteau, marge alpha comprise');

// Une ouverture visuelle doit aussi être ouverte pour les tirs.
const backHit = cast(fireplace.getShotBlockers(), 1.3);
assert.equal(backHit?.object.name, 'salon-fireplace-brick');
assert.ok(backHit.point.x < -14.7, 'Un tir dans la bouche atteint le fond et ne frappe pas un volume invisible');
assert.equal(getImpactSurface(backHit), 'stone');
const ironHit = cast(fireplace.getShotBlockers(), 0.61);
assert.equal(ironHit?.object.name, 'salon-fireplace-iron');
assert.equal(getImpactSurface(ironHit), 'metal', 'La grille produit des impacts métalliques');
for (const z of [11.36, 14.64]) {
  const pillarHit = cast(fireplace.getShotBlockers(), 1.25, z);
  assert.equal(pillarHit?.object.name, 'salon-fireplace-stone');
  assert.ok(pillarHit.point.x > -13, 'Le tir rencontre chaque jambage avant le fond');
  assert.equal(getImpactSurface(pillarHit), 'stone');
}

const meshes = [];
scene.traverse(object => {
  assert.ok(!object.isLight, 'La refonte réutilise les lumières du Salon');
  if (!object.isMesh) return;
  meshes.push(object);
  assert.equal(object.castShadow, false, 'Aucun nouveau projecteur de géométrie dans les shadow maps');
  for (const attribute of Object.values(object.geometry.attributes)) {
    for (const value of attribute.array) assert.ok(Number.isFinite(value), 'Attribut géométrique fini');
  }
});
assert.ok(meshes.length <= 8, `Budget de huit surfaces au plus, feu inclus : ${meshes.length}`);
const fire = scene.getObjectByName('hearth-fire');
assert.ok(fire && !fireplace.getShotBlockers().includes(fire), 'Le feu ne bloque pas les tirs');
const fireBounds = new THREE.Box3().setFromObject(fire);
const height = fireBounds.max.y - fireBounds.min.y;
assert.ok(Math.abs(height - 1.9) < 1e-6);
assert.ok(fireBounds.min.z > 11.65 && fireBounds.max.z < 14.35, 'Flammes contenues entre les jambages');
const rootY = fire.position.y + height / 2 - 114.5 / 128 * height;
assert.ok(Math.abs(rootY - 0.23) < 1e-6, 'La racine des huit poses rejoint les braises');
assert.ok(fire.position.x < ironHit.point.x && fire.position.x > backHit.point.x, 'Feu entre le fond et la grille');

assert.equal(atlas.width, 512); assert.equal(atlas.height, 512);
for (const cell of [
  { x: 0, y: 0, width: 512, height: 256 },
  { x: 0, y: 256, width: 256, height: 256 },
  { x: 256, y: 256, width: 256, height: 256 },
]) {
  const bounds = alphaBounds(atlas, cell);
  assert.ok(bounds && bounds.width > cell.width / 2 && bounds.height > cell.height / 2, 'Chaque relief occupe sa cellule');
  assert.ok(bounds.x >= cell.x + 8 && bounds.y >= cell.y + 8
    && bounds.x + bounds.width <= cell.x + cell.width - 8
    && bounds.y + bounds.height <= cell.y + cell.height - 8, 'Marges alpha entre reliefs');
  assert.equal(atlas.data[(cell.y * atlas.width + cell.x) * 4 + 3], 0, 'Fond réellement transparent');
}

// Détruire la cheminée ne doit jamais invalider la pierre ou la brique partagées.
const shared = [mansionMaterial('stone'), mansionMaterial('brick')];
let sharedDisposals = 0;
for (const material of shared) {
  material.addEventListener('dispose', () => sharedDisposals++);
  material.map.addEventListener('dispose', () => sharedDisposals++);
}
const owned = new Set(meshes.flatMap(mesh => [mesh.geometry, mesh.material]));
for (const mesh of meshes) if (mesh.material.map && !shared.some(material => material.map === mesh.material.map)) owned.add(mesh.material.map);
const disposals = new Map();
for (const resource of owned) resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) ?? 0) + 1));
fireplace.dispose(); fireplace.dispose(); fireplace.update(0.1);
assert.equal(scene.children.length, 0, 'Géométrie et feu retirés de la scène');
for (const resource of owned) assert.equal(disposals.get(resource), 1, 'Chaque ressource possédée est libérée une fois');
assert.equal(sharedDisposals, 0, 'Matériaux et textures partagés conservés');

const lateScene = new THREE.Scene();
const firstLateLoad = pendingLoads.length;
const lateFireplace = new SalonFireplace(lateScene, spec);
const lateReliefs = lateFireplace.getShotBlockers().filter(mesh => mesh.name === 'salon-fireplace-reliefs' || mesh.name === 'salon-fireplace-clock');
lateFireplace.dispose(); lateFireplace.dispose();
for (const load of pendingLoads.slice(firstLateLoad)) load.complete();
assert.equal(lateScene.children.length, 0, 'Un chargement tardif ne réinstalle aucune ressource détruite');
assert.ok(lateReliefs.every(mesh => !mesh.visible), 'Les reliefs détruits avant chargement restent invisibles');
assert.equal(cast(lateReliefs, 2.47), undefined, 'Les anciennes références ne bloquent aucun tir après destruction');

const levelScene = new THREE.Scene();
const level = new Level(levelScene);
levelScene.updateMatrixWorld(true);
const collider = level.colliders.find(box => box.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(-14, 1.5, 13)) < 1e-6);
assert.ok(collider, 'Emprise physique de la cheminée conservée');
assert.ok(collider.getSize(new THREE.Vector3()).distanceTo(new THREE.Vector3(2.4, 3, 4)) < 1e-6);
assert.ok(level.isColliding(-14, 13, 0.45), 'Déplacements toujours bloqués dans le volume tactique');
const integratedHit = cast(level.getSolidMeshes(), 1.3);
assert.equal(integratedHit?.object.name, 'salon-fireplace-brick', 'Level expose les surfaces réelles aux tirs');
assert.ok(integratedHit.point.x < -14.7);
const integratedBlockers = level.getSolidMeshes().filter(mesh => mesh.name.startsWith('salon-fireplace-'));
assert.ok(integratedBlockers.length > 0);
level.disposeDecor(); level.disposeDecor();
assert.ok(integratedBlockers.every(mesh => !level.getSolidMeshes().includes(mesh)), 'Les bloqueurs retirés ne restent pas dans les cibles des armes');
assert.equal(levelScene.getObjectByName('salon-fireplace'), undefined);
assert.equal(levelScene.getObjectByName('hearth-fire'), undefined);
if (previousDocument === undefined) delete globalThis.document;
else globalThis.document = previousDocument;
console.log('PASS : bouche et marges alpha traversables aux tirs, sculptures/cadran opaques, impacts pierre/métal, collider préservé, huit surfaces sans lumière/ombre, nettoyage partagé et chargements tardifs.');
