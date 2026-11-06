// Économie et diagnostics réels, sans rendu WebGL ni son.
import assert from 'node:assert/strict';
import * as THREE from 'three';

class Element extends EventTarget {
  style = { setProperty() {} };
  classList = { toggle() {}, add() {}, remove() {} };
}
const canvas = new Element();
const element = new Element();
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: canvas,
  querySelector: () => element,
  querySelectorAll: () => [element],
});
globalThis.Audio = class {
  volume = 1;
  currentTime = 0;
  play() { return Promise.resolve(); }
};
THREE.TextureLoader.prototype.load = () => new THREE.Texture();

const { Weapon } = await import('../src/Weapon.ts');
const { AmmoBox } = await import('../src/AmmoBox.ts');
const { TierDiagnosticsTracker } = await import('../src/TierDiagnostics.ts');
const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
const tracker = new TierDiagnosticsTracker();
const weapon = new Weapon(camera, canvas, [], [], (_mesh, _damage, shot) => {
  tracker.recordHit(shot.headHits, shot.bodyHits, shot.weaponId);
  tracker.recordDamageDealt();
}, () => true, () => {});
weapon.setOnShoot((_aim, weaponId) => tracker.recordShot(weaponId));
const scene = new THREE.Scene();
const playerPosition = new THREE.Vector3(0, 1.7, 0);

// Une même boîte peut alimenter plusieurs collectes, sans perte ni duplication.
weapon.reserveAmmo = 59;
const box = new AmmoBox(scene, 0, 0, 10, 'pistol');
assert.equal(box.tryPickup(playerPosition, weapon), true);
assert.equal(weapon.getReserveAmmoFor('pistol'), 60);
assert.equal(box.getRemainingAmmo(), 9);
assert.equal(box.isConsumed(), false);
assert.equal(scene.children.length, 1, 'le reliquat reste visible au sol');
assert.equal(box.tryPickup(playerPosition, weapon), false, 'réserve pleine : aucun faux gain');
assert.equal(box.getRemainingAmmo(), 9);
weapon.reserveAmmo = 55;
assert.equal(box.tryPickup(playerPosition, weapon), true);
assert.equal(box.getRemainingAmmo(), 4);
weapon.reserveAmmo = 0;
assert.equal(box.tryPickup(playerPosition, weapon), true);
assert.equal(weapon.getReserveAmmo(), 4);
assert.equal(box.getRemainingAmmo(), 0);
assert.equal(box.isConsumed(), true);
assert.equal(scene.children.length, 0);
assert.equal(box.tryPickup(playerPosition, weapon), false, 'aucun second gain après épuisement');
box.respawn();
assert.equal(box.getRemainingAmmo(), 10, 'le réarmement explicite restaure le lot initial');
assert.equal(box.isConsumed(), false);
assert.equal(box.tryPickup(new THREE.Vector3(0, 4.1, 0), weapon), false, 'autre étage');
assert.equal(box.tryPickup(new THREE.Vector3(3, 1.7, 0), weapon), false, 'hors portée');
const rampBox = new AmmoBox(scene, 0, 0, 10, 'pistol', 1.2);
weapon.reserveAmmo = 0;
assert.equal(rampBox.tryPickup(new THREE.Vector3(0, 2.9, 0), weapon), true, 'rampe : même sol réel');
assert.equal(rampBox.getRemainingAmmo(), 0);
const upperBox = new AmmoBox(scene, 0, 0, 10, 'pistol', 2.4);
assert.equal(upperBox.tryPickup(playerPosition, weapon), false, 'un lot au-dessus ne traverse pas le plancher');
rampBox.dispose(); upperBox.dispose();

// La capacité de l’arme visée est utilisée même lorsqu’une autre arme est tenue.
weapon.unlockWeapon('shotgun');
weapon.reserveAmmo = 29;
weapon.switchWeapon('pistol');
const pistolBefore = weapon.getReserveAmmo();
const shells = new AmmoBox(scene, 0, 0, 4, 'shotgun');
assert.equal(shells.tryPickup(playerPosition, weapon), true);
assert.equal(weapon.getReserveAmmoFor('shotgun'), 30);
assert.equal(weapon.getReserveAmmo(), pistolBefore);
assert.equal(shells.getRemainingAmmo(), 3);
for (const invalid of [0, -1, NaN, Infinity]) {
  assert.equal(weapon.addAmmo(invalid, 'pistol'), false);
}
assert.equal(weapon.getReserveAmmo(), pistolBefore);

weapon.resetForNewRun();
const startStock = weapon.getAmmoStocks();
tracker.startTier(4, startStock);
startStock.pistol.reserve = 999;
assert.equal(tracker.getCurrentRecord().ammoAtStart.pistol.reserve, 30, 'stock initial indépendant');
const originalPerformance = globalThis.performance;
let wallTime = 0;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => wallTime } });
try {
  tracker.advance(1.25);
  wallTime += 60_000; // Pause : aucun appel advance, malgré le temps mur écoulé.
  assert.equal(tracker.getCurrentRecord().durationSeconds, 1.25);
  tracker.advance(0.5);
  tracker.recordDamageTaken(12);
  assert.equal(tracker.getCurrentRecord().firstContactDelaySeconds, 1.75);
  tracker.advance(0);
  tracker.advance(-1);
  tracker.advance(NaN);
  tracker.advance(Infinity);
  tracker.setEnabled(false);
  tracker.advance(60);
  tracker.recordShot('shotgun');
  tracker.setEnabled(true);
  tracker.advance(0.5);

  // Un tir raté de pistolet puis huit plombs corps : deux tirs, huit impacts.
  weapon.shoot();
  weapon.unlockWeapon('shotgun');
  const target = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1));
  target.position.set(0, 0, -2);
  weapon.setTargets([target]);
  wallTime += 900;
  weapon.shoot();
  tracker.recordMedkit(1); // Soin effectif à 99/100 : un PV, pas les trente du lot.
  tracker.recordAmmoBox('pistol', 1);
  tracker.recordAmmoGain('shotgun', 3);
  const endStock = weapon.getAmmoStocks();
  tracker.endTier(endStock);
  endStock.shotgun.magazine = 999;
  const record = tracker.getRecords()[0];
  assert.equal(record.durationSeconds, 2.25, 'durée active, pause et horloge murale exclues');
  assert.equal(record.firstContactDelaySeconds, 1.75);
  assert.equal(record.shotsFired, 2);
  assert.equal(record.bodyHits, 8);
  assert.deepEqual(record.weaponStats.pistol, { shotsFired: 1, headHits: 0, bodyHits: 0, ammoGained: 1 });
  assert.deepEqual(record.weaponStats.shotgun, { shotsFired: 1, headHits: 0, bodyHits: 8, ammoGained: 3 });
  assert.equal(record.healthRestored, 1);
  assert.equal(record.medkitsCollected, 1);
  assert.equal(record.ammoBoxesCollected, 1);
  assert.equal(record.ammoAtEnd.shotgun.magazine, 4);
  assert.equal(record.ammoAtStart.shotgun.unlocked, false);
  assert.equal(record.ammoAtEnd.shotgun.unlocked, true);
  record.weaponStats.shotgun.bodyHits = 999;
  record.ammoAtStart.pistol.reserve = 999;
  assert.equal(tracker.getRecords()[0].weaponStats.shotgun.bodyHits, 8, 'lectures sans mutation des diagnostics');
  assert.equal(tracker.getRecords()[0].ammoAtStart.pistol.reserve, 30);
  assert.equal(tracker.getCurrentRecord(), null);
  tracker.endTier();
  assert.equal(tracker.getRecords().length, 1, 'fin de palier unique');
} finally {
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: originalPerformance });
}
tracker.clear();
tracker.startTier(1);
tracker.recordShot();
tracker.recordHit(1, 0);
assert.equal(tracker.getCurrentRecord().durationSeconds, 0);
assert.equal(tracker.getCurrentRecord().shotsFired, 1, 'anciens appels sans arme compatibles');
assert.equal(tracker.getCurrentRecord().weaponStats.pistol.headHits, 1);
assert.equal(tracker.getRecords().length, 0, 'nouvelle tentative sans ancien historique');

box.dispose();
shells.dispose();
weapon.dispose();
console.log('Reliquats, stocks indépendants, temps actif, tirs/plombs par arme et gains effectifs : OK');
