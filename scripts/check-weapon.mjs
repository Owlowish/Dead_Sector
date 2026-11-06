// Vérifications ciblées de la logique Weapon sans navigateur.
import assert from 'node:assert/strict';
import * as THREE from 'three';

class Element extends EventTarget {
  properties = new Map();
  style = { setProperty: (name, value) => this.properties.set(name, value) };
  classList = { toggle() {} };
}
const canvas = new Element();
const hud = new Element();
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null,
  querySelector: () => hud,
  querySelectorAll: () => [new Element(), new Element()],
});
globalThis.Audio = class {
  currentTime = 0;
  volume = 1;
  play() { return Promise.resolve(); }
};

const { Weapon } = await import('../src/Weapon.ts');
const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
let active = true;
let aim = 0;
let ammoState = null;

const weapon = new Weapon(camera, canvas, [], [], () => {}, () => active, (amount) => {
  aim = amount;
  camera.fov = 75 + (58 - 75) * amount;
  camera.updateProjectionMatrix();
});
// Cette suite exerce le pistolet après son acquisition ; la hache initiale est couverte séparément.
weapon.unlockWeapon('pistol');

weapon.setOnAmmoChange((mag, cap, res, isRel) => {
  ammoState = { mag, cap, res, isRel };
});

function mouse(target, type, button) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'button', { value: button });
  target.dispatchEvent(event);
}

function key(target, type, code) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'code', { value: code });
  target.dispatchEvent(event);
}

// 1. État initial
assert.equal(weapon.getAmmo(), 10, 'Chargeur initial = 10');
assert.equal(weapon.getMaxAmmo(), 15, 'Capacité chargeur = 15');
assert.equal(weapon.getReserveAmmo(), 30, 'Réserve initiale = 30');
assert.equal(weapon.getMaxReserve(), 60, 'Capacité réserve = 60');
assert.equal(weapon.getIsReloading(), false, 'Non en rechargement au départ');

// 2. Visée et tir
document.pointerLockElement = canvas;
mouse(canvas, 'mousedown', 2); // ADS
for (let i = 0; i < 4; i++) weapon.update(0.05);
assert.equal(aim, 1, 'ADS actif');

mouse(canvas, 'mousedown', 0); // Tir
assert.equal(weapon.getAmmo(), 9, 'Balle décrémentée');
assert.equal(ammoState?.mag, 9, 'Notification HUD reçue');
assert.equal(hud.properties.get('--slide'), '0.5', 'Départ de la culasse en ADS');
weapon.update(0.04);
assert.equal(hud.properties.get('--slide'), '1', 'Culasse reculée');
weapon.update(0.10);
assert.equal(hud.properties.get('--slide'), '0', 'Culasse revenue avant la fin du recul général');

// Cooldown tir
mouse(canvas, 'mousedown', 0);
assert.equal(weapon.getAmmo(), 9, 'Cooldown respecté');

// 3. Déclenchement du rechargement
key(window, 'keydown', 'KeyR');
assert.equal(weapon.getIsReloading(), true, 'Rechargement démarré');
assert.equal(aim, 0, 'Le rechargement quitte immédiatement l ADS');
assert.equal(hud.properties.get('--slide'), '0', 'Aucune culasse mobile pendant rechargement');

// Tir impossible pendant rechargement
mouse(canvas, 'mousedown', 0);
assert.equal(weapon.getAmmo(), 9, 'Impossible de tirer en rechargeant');

// 4. Annulation par Échap
document.pointerLockElement = null;
document.dispatchEvent(new Event('pointerlockchange'));
assert.equal(weapon.getIsReloading(), false, 'Rechargement annulé sur Échap');
assert.equal(weapon.getAmmo(), 9, 'Aucun transfert de balle lors de l annulation');
assert.equal(weapon.getReserveAmmo(), 30, 'Réserve intacte');

// 5. Rechargement complet jusqu'au transfert
document.pointerLockElement = canvas;
key(window, 'keydown', 'KeyR');
assert.equal(weapon.getIsReloading(), true);

// Progression jusqu'au terme
let steps = 0;
while (weapon.getIsReloading() && steps < 50) {
  weapon.update(0.05);
  steps++;
}
assert.equal(weapon.getIsReloading(), false, 'Rechargement terminé');
// Needed: 15 - 9 = 6 balles. Transférées depuis 30.
assert.equal(weapon.getAmmo(), 15, 'Chargeur plein à 15');
assert.equal(weapon.getReserveAmmo(), 24, 'Réserve décrémentée de 6 (24 restantes)');

// 6. Rechargement impossible si chargeur plein
const fullReload = weapon.reload();
assert.equal(fullReload, false, 'Refus de recharger si chargeur plein');
assert.equal(weapon.getIsReloading(), false);

// 7. Ramassage d'AmmoBox (+6)
const added1 = weapon.addAmmo(6);
assert.equal(added1, true, 'AmmoBox acceptée');
assert.equal(weapon.getReserveAmmo(), 30, 'Réserve remontée à 30');

// Test de limite de réserve (max 60)
weapon.addAmmo(40);
assert.equal(weapon.getReserveAmmo(), 60, 'Réserve plafonnée à 60');
const addedOverflow = weapon.addAmmo(10);
assert.equal(addedOverflow, false, 'Refus de ramassage si réserve pleine');

// 8. Test de transfert partiel quand réserve inférieure au besoin
for (let i = 0; i < 15; i++) {
  weapon['lastShot'] = -Infinity;
  weapon['shoot']();
}
assert.equal(weapon.getAmmo(), 0, 'Chargeur vide');
weapon['reserveAmmo'] = 4;
weapon.reload();
steps = 0;
while (weapon.getIsReloading() && steps < 50) {
  weapon.update(0.05);
  steps++;
}
assert.equal(weapon.getAmmo(), 4, 'Transfert partiel exact min(15, 4) = 4');
assert.equal(weapon.getReserveAmmo(), 0, 'Réserve épuisée à 0');

// 9. Rechargement impossible si réserve vide
assert.equal(weapon.reload(), false, 'Refus de recharger si réserve vide');

// 10. Culasse à la hanche et annulations non couvertes par les scénarios précédents.
weapon.magazineAmmo = 3;
weapon.reserveAmmo = 8;
weapon.lastShot = -Infinity;
mouse(canvas, 'mousedown', 0);
weapon.update(0.04);
assert.equal(aim, 0);
assert.equal(hud.properties.get('--slide'), '1', 'Même cycle de culasse à la hanche');
weapon.reload();
weapon.update(0.4);
assert.equal(weapon.getAmmo(), 2, 'Pas de transfert pendant la manipulation');
window.dispatchEvent(new Event('blur'));
assert.equal(weapon.getIsReloading(), false, 'Annulation sur blur');
assert.equal(weapon.getReserveAmmo(), 8);

// 11. Une main vide à l'approche et au départ ; chargeur seulement à l'extraction/insertion.
assert.equal(hud.properties.get('--hand-opacity'), '0', 'Retour propre de la main au repos');
weapon.reload();
weapon.update(0.3);
active = false;
weapon.update(0.05);
assert.equal(weapon.getIsReloading(), false, 'Annulation en fin de partie');
assert.equal(weapon.getAmmo(), 2);
assert.equal(weapon.getReserveAmmo(), 8);

active = true;
assert.equal(weapon.reload(), true);
assert.equal(hud.properties.get('--magazine-opacity'), '0', 'Approche avec main vide');
weapon.update(0.20);
assert.equal(hud.properties.get('--magazine-opacity'), '0', 'Saisie sans chargeur neuf déjà en main');
weapon.update(0.20);
assert.equal(hud.properties.get('--magazine-opacity'), '1', 'Ancien chargeur extrait');
weapon.update(0.24);
assert.equal(hud.properties.get('--magazine-opacity'), '0', 'Échange hors champ');
weapon.update(0.20);
assert.equal(hud.properties.get('--magazine-opacity'), '1', 'Un nouveau chargeur présenté');
weapon.update(0.24);
assert.equal(hud.properties.get('--magazine-opacity'), '1', 'Insertion unique');
weapon.update(0.24);
assert.equal(hud.properties.get('--magazine-opacity'), '0', 'Chargeur inséré, plus de chargeur dans la main');
weapon.update(0.18);
assert.equal(hud.properties.get('--magazine-opacity'), '0', 'Retrait avec main vide');
weapon.update(0.18);
assert.equal(weapon.getIsReloading(), false);
assert.equal(weapon.getAmmo(), 10, 'Un seul transfert des huit balles disponibles');
assert.equal(weapon.getReserveAmmo(), 0);
assert.equal(hud.properties.get('--hand-opacity'), '0', 'Retour propre de la main au repos');

// 12. Test de mise à jour dynamique des cibles de tir (Atelier R2)
const newTargetMesh = { visible: true, updateWorldMatrix: () => {} };
weapon.setTargets([newTargetMesh]);
assert.equal(weapon['targets'].length, 1);
assert.equal(weapon['targets'][0], newTargetMesh, 'Nouvelles cibles dynamiques prises en compte dans Weapon');

// 13. Vraies intersections Three.js : rayon, effet et dégâts partagent le même résultat.
const target = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.5));
target.position.z = -6;
const blocker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2));
blocker.position.z = -3;
blocker.rotation.y = 0.2;
const impacts = [];
const damageHits = [];
weapon.setTargets([target]);
weapon.blockers = [];
weapon.onHit = (mesh, damage) => damageHits.push({ mesh, damage });
weapon.setOnImpact(impact => impacts.push(impact));
weapon.setOnShoot(() => { camera.rotation.x += 0.2; });
weapon.aimAmount = 1;
weapon.magazineAmmo = 4;
weapon.lastShot = -Infinity;
weapon.shoot();
assert.equal(damageHits.length, 1, 'Tir centré calculé avant le recul de caméra');
assert.equal(impacts[0].kind, 'zombie');
assert.equal(impacts[0].object, target);
assert(impacts[0].direction.equals(new THREE.Vector3(0, 0, -1)));
weapon.shoot();
assert.equal(impacts.length, 1, 'Aucun effet si cadence refuse le tir');
camera.rotation.set(0, 0, 0);
weapon.blockers = [blocker];
weapon.lastShot = -Infinity;
weapon.shoot();
assert.equal(damageHits.length, 1, 'Le mur bloque la cible');
assert.equal(impacts[1].kind, 'surface');
assert(impacts[1].normal.dot(impacts[1].direction) < 0);
const expectedNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(blocker.quaternion);
assert(impacts[1].normal.distanceTo(expectedNormal) < 1e-8, 'Normale mondiale sur surface tournée');
weapon.magazineAmmo = 0;
weapon.lastShot = -Infinity;
weapon.shoot();
assert.equal(impacts.length, 2, 'Aucun effet sans balle');
target.geometry.dispose();
target.material.dispose();
blocker.geometry.dispose();
blocker.material.dispose();

weapon.setEnvironmentalLighting(0.5, 0);
assert.ok(weapon.targetBrightness >= 0.18 && weapon.targetBrightness < 0.4, 'Une ambiance sombre ne laisse pas l’arme à sa luminosité source');
const darkTarget = weapon.targetBrightness;
weapon.setEnvironmentalLighting(0.9, 0.2);
assert.ok(weapon.targetBrightness > darkTarget, 'La présentation réagit encore aux zones éclairées');
weapon.setEnvironmentalLighting(4, 0);
assert.ok(weapon.targetBrightness <= 0.65, 'Le renfort ambiant ne blanchit pas les sprites');

console.log('TOUS LES TESTS SONT VALIDES :');
console.log('✓ Chargeur, capacité, réserve, plafond max');
console.log('✓ Tir accepté / refusé / cooldown');
console.log('✓ Déclenchement touche R, sortie ADS immédiate, tir bloqué pendant manipulation');
console.log('✓ Annulation sur blur / pointerlockchange / game over sans perte ni création de balle');
console.log('✓ Transfert atomique exact min(needed, reserve) à la fin');
console.log('✓ Notification continue vers le HUD');
console.log('✓ Cycle de culasse hanche/ADS et restauration des couches après annulation');
console.log('✓ Chronologie du chargeur visible et main vide avant/après remplacement');
console.log('✓ Mise à jour dynamique des cibles de tir pour les nouveaux paliers');
console.log('✓ Intersections réelles, obstacle prioritaire, normales mondiales et rayon avant recul');
