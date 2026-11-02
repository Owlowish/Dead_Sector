import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sampleShotDirection, spreadAngle, spreadRadiusPixels } from '../src/WeaponSpread.ts';
import { HitEffects } from '../src/HitEffects.ts';
import { Medkit } from '../src/Medkit.ts';
import { AmmoBox } from '../src/AmmoBox.ts';

const forward = new THREE.Vector3(0, 0, -1);
for (const aim of [0, 0.3, 0.8, 1]) {
  for (let i = 0; i < 1000; i++) {
    const direction = sampleShotDirection(aim);
    assert(Math.abs(direction.length() - 1) < 1e-12);
    assert(direction.angleTo(forward) <= spreadAngle(aim) + 1e-10, 'Rayon dans le cône affiché');
    if (aim === 1) assert(direction.equals(forward), 'ADS sans dispersion');
  }
}
assert(Math.abs(spreadRadiusPixels(0, 75, 900) - 20.48) < 0.02);
assert.equal(spreadRadiusPixels(1, 58, 900), 0);
// Un échantillon en bordure doit se projeter précisément sur le bord intérieur du viseur.
const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
const edge = sampleShotDirection(0, () => 1);
const ndc = edge.clone().multiplyScalar(10).project(camera);
assert(Math.abs(Math.hypot(ndc.x * 1600 / 2, ndc.y * 900 / 2) - spreadRadiusPixels(0, 75, 900)) < 1e-8);

const scene = new THREE.Scene();
const effects = new HitEffects(scene);
const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
wall.position.set(2, 1, -4);
wall.rotation.y = Math.PI / 4;
scene.add(wall);
wall.updateWorldMatrix(true, false);
const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(wall.quaternion);
const point = wall.localToWorld(new THREE.Vector3(0, 0, 0.5));
const impact = { kind: 'surface', object: wall, point, normal, direction: normal.clone().negate() };
effects.emit(impact);
assert.equal(wall.children.length, 1, 'Trace attachée au solide touché');
const mark = wall.children[0];
assert(mark.getWorldPosition(new THREE.Vector3()).distanceTo(point.clone().addScaledVector(normal, 0.006)) < 1e-8);
assert(new THREE.Vector3(0, 0, 1).applyQuaternion(mark.getWorldQuaternion(new THREE.Quaternion())).distanceTo(normal) < 1e-8);
const localPosition = mark.position.clone();
wall.rotation.y += 1;
wall.position.y += 2;
assert(mark.position.equals(localPosition), 'La trace suit la porte sans glisser localement');
for (let i = 0; i < 100; i++) effects.emit(impact);
assert.equal(effects.marks.length, 24, 'Plafond de traces');
assert.equal(effects.particles.length, 64, 'Plafond de particules');
effects.update(0, camera);
assert.equal(effects.marks[0].age, 0, 'Pause : durée des effets suspendue');
effects.update(0.5, camera);
assert.equal(effects.particles.length, 0, 'Particules expirées');
assert.equal(effects.marks.length, 24);
effects.update(5, camera);
assert.equal(effects.marks.length, 0, 'Traces expirées');
assert.equal(wall.children.length, 0, 'Meshes retirés du parent');
effects.emit({ ...impact, kind: 'zombie' });
assert.equal(effects.marks.length, 0, 'Sang transitoire sans trace sur le billboard');
assert.equal(effects.particles.length, 9);
effects.dispose();
assert.equal(scene.children.length, 1, 'Nettoyage complet hors décor');

THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};
const pickupScene = new THREE.Scene();
const medkit = new Medkit(pickupScene, 0, 0);
const ammo = new AmmoBox(pickupScene, 3, 0, 8);
const medGroup = pickupScene.children[0];
assert(medGroup.children[0].material instanceof THREE.MeshStandardMaterial, 'Sprite affecté par les lumières');
assert.equal(medGroup.children[0].material.map.magFilter, THREE.NearestFilter);
medkit.update(0.05, new THREE.Vector3(2, 1.7, 0));
assert(Math.abs(medGroup.rotation.y - Math.PI / 2) < 1e-9, 'Billboard vertical vers le joueur');
let full = true;
let healing = 0;
const player = { camera: { position: new THREE.Vector3() }, heal: amount => { if (full) return false; healing += amount; return true; } };
assert.equal(medkit.tryPickup(player), false, 'Soin conservé si santé pleine');
full = false;
assert.equal(medkit.tryPickup(player), true);
assert.equal(medkit.tryPickup(player), false);
assert.equal(healing, 30, 'Soin unique, quantité conservée');
medkit.respawn();
medkit.respawn();
assert.equal(pickupScene.children.length, 2, 'Respawn sans duplication');
let added = 0;
assert.equal(ammo.tryPickup(new THREE.Vector3(), { addAmmo: () => true }), false, 'Hors rayon');
assert.equal(ammo.tryPickup(new THREE.Vector3(3, 0, 0), { addAmmo: () => false }), false, 'Réserve pleine');
assert.equal(ammo.tryPickup(new THREE.Vector3(3, 0, 0), { addAmmo: amount => { added += amount; return true; } }), true);
assert.equal(added, 8);
console.log('OK : cône/ADS/projection viseur, impacts et portes mobiles, plafonds/nettoyage/pause, pickups et ramassage.');
