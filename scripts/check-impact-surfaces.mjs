import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { getImpactSurface, setImpactSurface } from '../src/ImpactSurface.ts';
import { HitEffects } from '../src/HitEffects.ts';

THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
const { Door } = await import('../src/Door.ts');
const { Level } = await import('../src/Level.ts');

const wood = setImpactSurface(new THREE.MeshBasicMaterial(), 'wood');
const stone = setImpactSurface(new THREE.MeshBasicMaterial(), 'stone');
const metal = setImpactSurface(new THREE.MeshBasicMaterial(), 'metal');
const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), [wood, stone, stone, stone, metal, stone]);
wall.position.z = -4;
wall.userData.impactSurface = 'stone';
wall.updateWorldMatrix(true, true);
const front = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1)).intersectObject(wall)[0];
const side = new THREE.Raycaster(new THREE.Vector3(4, 0, -4), new THREE.Vector3(-1, 0, 0)).intersectObject(wall)[0];
assert.equal(getImpactSurface(front), 'metal', 'Le vrai rayon lit le matériau de la face avant');
assert.equal(getImpactSurface(side), 'wood', 'Une autre face du même mesh produit un impact bois');
assert.equal(getImpactSurface({ object: new THREE.Mesh() }), 'stone', 'Décor sans métadonnées : repli minéral explicite');
const untagged = new THREE.Mesh();
untagged.userData.impactSurface = 'wood';
assert.equal(getImpactSurface({ object: untagged }), 'wood', 'Les bloqueurs sans matériau annoté peuvent donner un repli explicite');

const scene = new THREE.Scene();
const effects = new HitEffects(scene);
const palettes = [];
for (const surface of ['wood', 'stone', 'metal']) {
  effects.emit({ kind: 'surface', surface, object: wall, point: front.point,
    normal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(0, 0, -1) });
  assert.equal(effects.particles.length, 6);
  palettes.push(effects.particles[0].mesh.material.color.getHex());
  effects.update(0, new THREE.PerspectiveCamera());
  assert.equal(effects.particles[0].age, 0, 'Les nouvelles variantes restent figées avec delta nul');
  effects.clear();
}
assert.equal(new Set(palettes).size, 3, 'Éclats bois, poussière pierre et étincelles métal ont trois palettes');
effects.dispose();

const level = new Level(new THREE.Scene());
const floor = level.getSolidMeshes().find((mesh) => mesh.geometry.type === 'PlaneGeometry' && mesh.position.y === 0);
assert.ok(floor, 'Le parquet visible est maintenant une surface de tir');
assert.equal(getImpactSurface({ object: floor }), 'wood');
assert.ok(level.getSolidMeshes().some((mesh) => getImpactSurface({ object: mesh }) === 'metal'), 'Les ferrures réelles sont interrogeables par les rayons');

const door = new Door(new THREE.Scene(), { x: 0, z: 0, name: 'Test', type: 'sector_access' });
door.toggle();
door.update(1);
assert.equal(door.isOpen(), true);
assert.equal(door.isColliding(1, 0, 0.2), false, 'Passage libre lorsque les battants sont ouverts');
door.resetForNewRun();
assert.equal(door.getState(), 'LOCKED');
assert.equal(door.isOpen(), false);
assert.equal(door.isColliding(1, 0, 0.2), true, 'La fermeture immédiate rétablit aussi la collision');
const doorRay = new THREE.Raycaster(new THREE.Vector3(1, 2, 2), new THREE.Vector3(0, 0, -1));
assert.ok(doorRay.intersectObjects(door.getSolidMeshes(), false).length, 'Les matrices des battants correspondent immédiatement à la porte fermée');

class Element extends EventTarget {
  listenerCount = 0;
  properties = new Map();
  classes = new Set();
  style = { setProperty: (key, value) => this.properties.set(key, value) };
  classList = {
    toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
    add: (name) => this.classes.add(name),
    remove: (name) => this.classes.delete(name),
  };
  addEventListener(...args) { this.listenerCount++; super.addEventListener(...args); }
}
const canvas = new Element();
const elements = new Map();
globalThis.window = Object.assign(new Element(), { innerHeight: 900 });
globalThis.document = Object.assign(new Element(), {
  pointerLockElement: canvas,
  querySelector: (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  },
  querySelectorAll: () => [new Element(), new Element()],
});
const sounds = [];
globalThis.Audio = class {
  currentTime = 0;
  volume = 1;
  constructor(src) { this.src = src; }
  play() { sounds.push(this.src); return Promise.resolve(); }
  pause() {}
};
const { Weapon } = await import('../src/Weapon.ts');
const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
let hud = null;
let ejections = 0;
const impacts = [];
const weapon = new Weapon(camera, canvas, [], [wall], () => assert.fail('Un mur ne reçoit pas de dégâts ennemi'), () => true, () => {});
weapon.soundBank = { play(url) { sounds.push(url); }, stop() {}, setVolume() {}, dispose() {} };
const initial = structuredClone(weapon.weapons);
weapon.unlockWeapon('pistol');
weapon.setOnAmmoChange((magazine, capacity, reserve, reloading, name, id) => { hud = { magazine, capacity, reserve, reloading, name, id }; });
weapon.setOnImpact((impact) => impacts.push(impact));
weapon.setOnCasingEject(() => ejections++);
for (const surface of ['wood', 'stone', 'metal']) {
  wall.material[4] = { wood, stone, metal }[surface];
  weapon.getActiveWeapon().hipSpreadDeg = 0;
  weapon.lastShot = -Infinity;
  sounds.length = 0;
  impacts.length = 0;
  weapon.shoot();
  assert.equal(impacts[0].surface, surface, 'La surface du rayon traverse Weapon et le callback graphique');
  assert.deepEqual(sounds.filter((src) => src.includes('/impact-')), [`/assets/sounds/impact-${surface}-soft.wav`]);
}
wall.material[4] = wood;
sounds.length = 0;
for (let shot = 0; shot < 3; shot++) {
  weapon.lastShot = -Infinity;
  weapon.shoot();
}
assert.deepEqual(sounds.filter((src) => src.includes('/impact-wood')), [
  '/assets/sounds/impact-wood-soft-2.wav', '/assets/sounds/impact-wood-soft-3.wav',
  '/assets/sounds/impact-wood-soft.wav',
]);
assert.deepEqual(sounds.filter((src) => src.includes('/shot-soft')), [
  '/assets/sounds/shot-soft.wav', '/assets/sounds/shot-soft-2.wav', '/assets/sounds/shot-soft-3.wav',
]);
weapon.unlockWeapon('shotgun');
weapon.getActiveWeapon().hipSpreadDeg = 0;
weapon.lastShot = -Infinity;
sounds.length = 0;
impacts.length = 0;
weapon.shoot();
assert.equal(impacts.length, 8, 'Les huit plombs gardent leurs intersections et effets');
assert.equal(sounds.filter((src) => src.includes('/impact-')).length, 1, 'Une seule réponse de surface pour une détonation de fusil');

weapon.upgradeAmmoCapacity();
weapon.upgradeAccuracy();
weapon.aimHeld = true;
weapon.aimAmount = 1;
weapon.headMarkerTimer = setTimeout(() => assert.fail('Marqueur hérité de la tentative précédente'), 500);
elements.get('.crosshair').classList.add('head-hit');
const listenerCount = canvas.listenerCount + window.listenerCount + document.listenerCount;
const beforeResetEjections = ejections;
weapon.resetForNewRun();
assert.deepEqual(weapon.weapons, initial, 'Stocks, capacités, dispersion et verrouillage initiaux restaurés après bonus et tirs');
assert.equal(weapon.getActiveWeaponId(), 'axe');
assert.equal(hud.id, 'axe');
assert.equal(hud.magazine, 0);
assert.equal(hud.reserve, 0);
assert.equal(hud.reloading, false);
assert.equal(weapon.aimAmount, 0);
assert.equal(weapon.muzzleLight.intensity, 0);
assert.equal(elements.get('.crosshair').classes.has('head-hit'), false);
assert.equal(elements.get('.weapon-view').properties.get('--recoil'), '0px');
weapon.update(0.5);
assert.equal(ejections, beforeResetEjections, 'Aucune douille de fusil différée ne traverse le redémarrage');
assert.equal(weapon.switchWeapon('shotgun'), false);
assert.equal(weapon.recoilDuration, 2, 'Réglage du recul conservé');
weapon.unlockWeapon('pistol');
assert.equal(weapon.reload(), true);
weapon.update(0.5);
weapon.resetForNewRun();
assert.equal(weapon.getIsReloading(), false, 'Une recharge en cours ne traverse pas le redémarrage');
assert.equal(canvas.listenerCount + window.listenerCount + document.listenerCount, listenerCount, 'Les redémarrages ne recréent aucun écouteur');

for (const name of ['wood', 'stone']) {
  const wav = fs.readFileSync(`public/assets/sounds/impact-${name}-soft.wav`);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 22050);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.ok(wav.length < 10000, 'Chaque nouvel impact reste sous 10 ko');
}
console.log('PASS : vraies faces multi-matériaux, repli, palettes, sons uniques, parquet/ferrures, reset armes/portes, pause et budgets WAV.');
