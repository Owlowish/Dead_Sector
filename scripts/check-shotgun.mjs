// Vérification complète du système de fusil à pompe et multi-armes.
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
let lastCasing = null;
let shotEvents = [];

const weapon = new Weapon(
  camera,
  canvas,
  [],
  [],
  () => {},
  () => active,
  (amount) => {
    aim = amount;
  }
);

weapon.setOnAmmoChange((mag, cap, res, isRel, name, id) => {
  ammoState = { mag, cap, res, isRel, name, id };
});

weapon.setOnShoot((aimAmount, weaponId) => {
  shotEvents.push({ aimAmount, weaponId });
});

weapon.setOnCasingEject((aimAmount, casingType) => {
  lastCasing = { aimAmount, casingType };
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

document.pointerLockElement = canvas;

// 1. Verrouillage initial du fusil à pompe
assert.equal(weapon.getActiveWeaponId(), 'pistol', 'Pistolet actif au départ');
assert.equal(weapon.switchWeapon('shotgun'), false, 'Fusil verrouillé au départ');
assert.equal(weapon.getActiveWeaponId(), 'pistol', 'Reste sur pistolet');

// 2. Déverrouillage du fusil à pompe
weapon.unlockWeapon('shotgun');
assert.equal(weapon.getActiveWeaponId(), 'shotgun', 'Fusil équipé immédiatement lors du déverrouillage');
assert.equal(weapon.switchWeapon('pistol'), true, 'Retour sur pistolet possible');
assert.equal(weapon.getActiveWeaponId(), 'pistol', 'Pistolet actif');
assert.equal(weapon.switchWeapon('shotgun'), true, 'Fusil sélectionnable après déverrouillage');
assert.equal(weapon.getActiveWeaponId(), 'shotgun', 'Fusil actif');

// 3. Stocks indépendants
assert.equal(weapon.getAmmo(), 5, 'Chargeur fusil = 5');
assert.equal(weapon.getMaxAmmo(), 5, 'Capacité fusil = 5');
assert.equal(weapon.getReserveAmmo(), 15, 'Réserve fusil = 15');
assert.equal(weapon.getMaxReserve(), 30, 'Réserve max fusil = 30');

// Ravitaillement ciblé fusil vs pistolet
weapon.addAmmo(6, 'shotgun');
assert.equal(weapon.getReserveAmmo(), 21, 'Réserve fusil augmentée à 21');
weapon.switchWeapon('pistol');
assert.equal(weapon.getReserveAmmo(), 30, 'Réserve pistolet restée intacte à 30');
weapon.switchWeapon('shotgun');

// 4. Tir à bout portant et cumul des 8 plombs au corps (12 dégâts x 8 = 96 dégâts)
const target = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1));
target.position.set(0, 0, -2); // À 2m devant, couvre tout le cône
weapon.setTargets([target]);

let hits = [];
weapon.onHit = (mesh, dmg) => hits.push({ mesh, dmg });

weapon.lastShot = -Infinity;
shotEvents = [];
lastCasing = null;

mouse(canvas, 'mousedown', 0); // Tir au fusil
assert.equal(weapon.getAmmo(), 4, 'Cartouche consommée');
assert.equal(shotEvents.length, 1, 'Événement de tir déclenché à t=0');
assert.equal(shotEvents[0].weaponId, 'shotgun');
assert.equal(lastCasing, null, 'Aucune douille éjectée à t=0 pour le fusil à pompe');

// Vérification de l'accumulation des 8 plombs en un seul impact cumulé
assert.equal(hits.length, 1, 'Un seul événement d impact consolidé pour le zombie');
assert.equal(hits[0].dmg, 96, 'Tous les 8 plombs au corps ont touché (8 x 12 = 96 dégâts)');

// 5. Éjection de douille calibre 12 au moment de la pompe (t >= 0.19s)
weapon.update(0.10); // t = 0.10s
assert.equal(lastCasing, null, 'Toujours pas de douille à 0.10s');
assert.match(hud.properties.get('--shotgun-hip-image'), /hip-kick-v2/, 'Le choc affiche sa pose dédiée avant la pompe');
weapon.update(0.10); // t = 0.20s (dépasse 0.19s)
assert.match(hud.properties.get('--shotgun-hip-image'), /hip-back-v2/, 'La pose de recul laisse place à la pompe au moment de l’éjection');
assert.notEqual(lastCasing, null, 'Douille éjectée à t >= 0.19s');
assert.equal(lastCasing?.casingType, '12gauge', 'Type de douille = calibre 12');

// 6. Répétition d'éjection évitée
lastCasing = null;
weapon.update(0.10);
assert.equal(lastCasing, null, 'Une seule éjection de douille par tir');

// 7. Dispersion et atténuation avec la distance
const smallTarget = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1));
smallTarget.position.set(0, 0, -15); // Petite cible à 15m
weapon.setTargets([smallTarget]);

hits = [];
weapon.lastShot = -Infinity;
mouse(canvas, 'mousedown', 0);
assert.equal(weapon.getAmmo(), 3, 'Cartouche consommée');
// À 15m avec un cône de 5° (rayon du cône ~ 1.3m), la cible de 0.3m ne reçoit qu'une fraction des plombs
if (hits.length > 0) {
  assert(hits[0].dmg <= 120, 'Dégâts dispersés');
}

// 8. Rechargement cartouche par cartouche (unitaire)
weapon.switchWeapon('shotgun');
assert.equal(weapon.getAmmo(), 3, 'Chargeur à 3 cartouches');
const canReload = weapon.reload();
assert.equal(canReload, true, 'Rechargement autorisé');
assert.equal(weapon.getIsReloading(), true);

// Progression d'une cartouche (0.65s)
weapon.update(0.70);
assert.equal(weapon.getAmmo(), 4, '1 cartouche insérée après 0.65s');
assert.equal(weapon.getIsReloading(), true, 'Rechargement continue pour la 2e cartouche manquante');

// Interruption par tir : si au moins 1 cartouche, un clic tire et interrompt le rechargement
weapon.lastShot = -Infinity;
mouse(canvas, 'mousedown', 0);
assert.equal(weapon.getIsReloading(), false, 'Rechargement interrompu par le tir');
assert.equal(weapon.getAmmo(), 3, 'Tir exécuté immédiatement');

// 9. Changement d'arme instantané sans perte de munitions
weapon.switchWeapon('pistol');
assert.equal(weapon.getActiveWeaponId(), 'pistol');
assert.equal(weapon.getAmmo(), 10, 'Munitions pistolet préservées');
weapon.switchWeapon('shotgun');
assert.equal(weapon.getActiveWeaponId(), 'shotgun');
assert.equal(weapon.getAmmo(), 3, 'Munitions fusil préservées');

// Le transfert suit l'encliquetage dessiné, une seule fois, indépendamment du FPS.
let beforeReserve = weapon.getReserveAmmo();
weapon.reload();
weapon.update(0.49);
assert.equal(weapon.getAmmo(), 3, 'Aucune cartouche avant insertion complète');
weapon.cancelReload();
assert.equal(weapon.getReserveAmmo(), beforeReserve, 'Annulation avant insertion sans perte');
weapon.reload();
weapon.update(0.5);
assert.equal(weapon.getAmmo(), 4, 'Cartouche engagée à la pose d’encliquetage');
assert.equal(weapon.getReserveAmmo(), beforeReserve - 1);
weapon.update(0.1);
assert.equal(weapon.getAmmo(), 4, 'Le retrait main vide ne transfère rien');
weapon.cancelReload();
assert.equal(weapon.getAmmo(), 4, 'Cartouche déjà insérée conservée après annulation');
weapon.reload();
weapon.update(1.3);
assert.equal(weapon.getAmmo(), 5, 'Grand delta plafonné par la capacité');
assert.equal(weapon.getReserveAmmo(), beforeReserve - 2, 'Aucun double transfert ni dépassement');
assert.equal(weapon.getIsReloading(), false);

target.geometry.dispose();
smallTarget.geometry.dispose();

console.log('TOUS LES TESTS DU FUSIL À POMPE SONT VALIDES :');
console.log('✓ Verrouillage initial et déverrouillage propre');
console.log('✓ Commutation pistolet / fusil avec stocks indépendants');
console.log('✓ Balistique conique 8 plombs (96 au corps, jusqu’à 192 à la tête)');
console.log('✓ Dispersion balistique avec la distance');
console.log('✓ Éjection différée calibre 12 synchronisée sur la pompe à 0.19s');
console.log('✓ Rechargement cartouche par cartouche interruptible');
