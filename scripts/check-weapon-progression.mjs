// Vraies transitions/pickups/Weapon : récompenses garanties sans interrompre le contrôle.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null, hidden: false, hasFocus: () => true,
  querySelector: () => null, querySelectorAll: () => [],
});
globalThis.Audio = class { volume = 1; currentTime = 0; play() { return Promise.resolve(); } pause() {} };
THREE.TextureLoader.prototype.load = () => new THREE.Texture();

const { Game } = await import('../src/Game.ts');
const { Weapon } = await import('../src/Weapon.ts');
const { PistolPickup } = await import('../src/PistolPickup.ts');
const { ShotgunPickup } = await import('../src/ShotgunPickup.ts');
const { TierDiagnosticsTracker } = await import('../src/TierDiagnostics.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const fixtures = [];
function createGame(onHit = () => {}) {
  const scene = new THREE.Scene();
  const canvas = new EventTarget();
  const camera = new THREE.PerspectiveCamera(75);
  camera.position.set(0, 1.7, 0);
  const game = Object.create(Game.prototype);
  const weapon = new Weapon(camera, canvas, [], [], onHit, () => true, () => {});
  const pistolPickup = new PistolPickup(scene);
  const shotgunPickup = new ShotgunPickup(scene);
  pistolPickup.resetForNewRun(); shotgunPickup.resetForNewRun();
  const announcements = [];
  const notifications = [];
  Object.assign(game, {
    scene, player: { camera }, weapon, pistolPickup, shotgunPickup,
    level: { getFloorHeightAt: () => 0, isColliding: (_x, z) => z < -1.9,
      hasLineOfSight: () => true, findNextWaypoint: (_from, to) => to.clone(), getDoors: () => [] },
    renderer: { domElement: canvas }, encounterConfigs: ENCOUNTER_CONFIGS,
    tierDiagnostics: new TierDiagnosticsTracker(),
    state: 'playing', currentTier: 1, pendingTierStart: 0, zombies: [], spitProjectiles: [],
    medkits: [], ammoBoxes: [], ammoDrops: [], appliedUpgrades: [], upgradePedestals: [],
    hud: { clear() {}, setProgression() {}, setBoss() {}, setAmmo() {},
      announce: (text) => announcements.push(text), notifyWeapon: (id) => notifications.push(id) },
  });
  document.pointerLockElement = canvas;
  fixtures.push(game);
  return { game, weapon, pistolPickup, shotgunPickup, announcements, notifications };
}

try {
  const normal = createGame();
  const { game, weapon, pistolPickup, shotgunPickup } = normal;
  game.startTier(1);
  assert.equal(weapon.getActiveWeaponId(), 'axe');
  assert.equal(weapon.isWeaponUnlocked('pistol'), false);
  assert.equal(weapon.isWeaponUnlocked('shotgun'), false);
  assert.equal(pistolPickup.isActive(), false); assert.equal(shotgunPickup.isActive(), false);
  assert.equal(game.dropBudget, 0, 'P1 à la hache ne sème pas de munitions inutilisables');
  const beforePointer = document.pointerLockElement;
  game.enterRespite();
  assert.equal(game.state, 'exploration'); assert.equal(game.respiteTimer, 10);
  assert.equal(game.pendingTierStart, 2); assert.equal(document.pointerLockElement, beforePointer);
  assert.equal(pistolPickup.isActive(), true); assert.equal(shotgunPickup.isActive(), false);
  assert.equal(weapon.isWeaponUnlocked('pistol'), false, 'La purge présente d’abord une vraie récompense');
  assert.ok(pistolPickup.z > -1.9, 'Le dépôt contourne un point en collision');
  assert.equal(pistolPickup.tryPickup(new THREE.Vector3(pistolPickup.x, 4.1, pistolPickup.z), weapon), false,
    'Une arme ne traverse pas le plancher');
  const pickupPosition = new THREE.Vector3(pistolPickup.x, 1.7, pistolPickup.z);
  const pickupDirection = new THREE.Vector3(pistolPickup.x, 0, pistolPickup.z).normalize();
  assert.equal(pistolPickup.canInteract(game.player.camera.position, pickupDirection), true);
  game.player.camera.position.copy(pickupPosition);
  game.updatePickups(1, false);
  assert.equal(weapon.isWeaponUnlocked('pistol'), false, 'Pas de collecte sans contrôle');
  game.updatePickups(0.05, true);
  assert.equal(weapon.getActiveWeaponId(), 'pistol');
  assert.equal(pistolPickup.isConsumed(), true);
  assert.deepEqual(weapon.getAmmoStocks().pistol, { magazine: 10, reserve: 30, unlocked: true });
  assert.deepEqual(normal.notifications, ['pistol']);
  game.advanceRespite(9.99);
  assert.equal(game.state, 'exploration');
  game.advanceRespite(0.02);
  assert.equal(game.currentTier, 2); assert.equal(game.state, 'playing');
  assert.equal(weapon.getAmmoStocks().pistol.reserve, 30, 'Aucun double gain au prochain combat');
  assert.equal(weapon.isWeaponUnlocked('shotgun'), false);

  game.startTier(3);
  assert.equal(shotgunPickup.isActive(), false);
  game.enterRespite();
  assert.equal(game.pendingTierStart, 4); assert.equal(game.respiteTimer, 10);
  assert.equal(shotgunPickup.isActive(), true); assert.equal(weapon.isWeaponUnlocked('shotgun'), false);
  // Arme oubliée : le prochain combat la fournit avant les premières apparitions.
  game.advanceRespite(10);
  assert.equal(game.currentTier, 4); assert.equal(game.state, 'playing');
  assert.equal(weapon.getActiveWeaponId(), 'shotgun'); assert.equal(shotgunPickup.isConsumed(), true);
  assert.deepEqual(weapon.getAmmoStocks().shotgun, { magazine: 5, reserve: 25, unlocked: true });
  assert.equal(game.tierDiagnostics.getCurrentRecord().ammoAtStart.shotgun.unlocked, true);
  assert.ok(normal.announcements.some((text) => text.includes('FUSIL À POMPE ACQUIS')),
    'Le rattrapage est signalé après le nettoyage du HUD');
  const shotgunReserve = weapon.getReserveAmmoFor('shotgun');
  game.startTier(4);
  assert.equal(weapon.getReserveAmmoFor('shotgun'), shotgunReserve, 'Le rattrapage est unique');

  const forgotten = createGame();
  forgotten.game.startTier(1); forgotten.game.enterRespite(); forgotten.game.advanceRespite(10);
  assert.equal(forgotten.weapon.getActiveWeaponId(), 'pistol');
  assert.deepEqual(forgotten.weapon.getAmmoStocks().pistol, { magazine: 10, reserve: 30, unlocked: true });
  assert.equal(forgotten.shotgunPickup.isActive(), false);

  let lateHits = 0;
  const direct = createGame(() => lateHits++);
  direct.game.startTier(4);
  assert.equal(direct.weapon.isWeaponUnlocked('pistol'), true);
  assert.equal(direct.weapon.isWeaponUnlocked('shotgun'), true, 'Un saut direct garde les armes des paliers précédents');
  assert.equal(direct.game.tierDiagnostics.getCurrentRecord().ammoAtStart.pistol.unlocked, true);
  direct.weapon.switchWeapon('axe');
  direct.weapon.shoot();
  direct.game.tierDiagnostics.recordShot('axe');
  direct.game.tierDiagnostics.recordHit(0, 1, 'axe');
  const stats = direct.game.tierDiagnostics.getCurrentRecord().weaponStats;
  assert.equal(stats.axe.shotsFired, 1); assert.equal(stats.axe.bodyHits, 1); assert.equal(stats.axe.ammoGained, 0);
  assert.equal(stats.pistol.shotsFired, 0); assert.equal(stats.shotgun.shotsFired, 0);
  direct.game.startTier(4);
  const lateTarget = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.2));
  lateTarget.position.set(0, 1.7, -1.5);
  direct.weapon.setTargets([lateTarget]);
  direct.weapon.update(0.7);
  assert.equal(lateHits, 0, 'Un changement de rencontre annule le coup préparé avant le saut');
  lateTarget.geometry.dispose(); lateTarget.material.dispose();

  const economy = createGame();
  const previousRandom = Math.random;
  Math.random = () => 0.99;
  try {
    for (const encounter of ENCOUNTER_CONFIGS) {
      economy.game.startTier(encounter.tierNumber);
      if (encounter.finalEncounter) break;
      for (let index = 0; index < encounter.totalZombies; index++) {
        economy.game.onZombieKilled({ getPosition: () => new THREE.Vector3(0, 1, 0) });
      }
    }
  } finally { Math.random = previousRandom; }
  const totals = economy.game.ammoDrops.reduce((sum, box) => {
    sum[box.getWeaponType()] += box.getRemainingAmmo(); return sum;
  }, { pistol: 0, shotgun: 0 });
  const stock = economy.weapon.getAmmoStocks();
  assert.equal(totals.pistol + stock.pistol.magazine + stock.pistol.reserve, 260,
    'Dotation, drops P2–P7 et finale : plafond de 260 balles');
  assert.equal(totals.shotgun + stock.shotgun.magazine + stock.shotgun.reserve, 46,
    'Dotation et drops P4–P7 : plafond de 46 cartouches');

  // Relève et répétition de callbacks ne contournent pas l'arme de départ ou les dotations.
  const empty = createGame();
  empty.game.startTier(1);
  const defeated = { getPosition: () => new THREE.Vector3(0, 1, 0) };
  empty.game.onZombieKilled(defeated); empty.game.onZombieKilled(defeated);
  assert.equal(empty.game.killsThisTier, 1); assert.equal(empty.game.ammoDrops.length, 0);
  for (const pickup of [pistolPickup, shotgunPickup]) {
    pickup.resetForNewRun();
    assert.equal(pickup.isActive(), false); assert.equal(pickup.isConsumed(), false);
    assert.equal(pickup.collect(weapon), false, 'Une récompense masquée ne se collecte pas');
  }
  console.log('Progression hache → pistolet après P1 → pompe après P3, collecte/pause/étages/rattrapage, stocks et diagnostics : OK');
} finally {
  for (const game of fixtures) {
    game.weapon.dispose(); game.pistolPickup.dispose(); game.shotgunPickup.dispose();
    for (const drop of game.ammoDrops) drop.dispose();
  }
}
