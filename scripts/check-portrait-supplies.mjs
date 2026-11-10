import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null, hidden: false, hasFocus: () => true,
  querySelector: () => null, querySelectorAll: () => [],
});
globalThis.Audio = class { volume = 1; currentTime = 0; play() { return Promise.resolve(); } pause() {} };

const { Game } = await import('../src/Game.ts');
const { Level } = await import('../src/Level.ts');
const { Weapon } = await import('../src/Weapon.ts');
const { GuardianZombie } = await import('../src/GuardianZombie.ts');
const { Medkit } = await import('../src/Medkit.ts');
const { TierDiagnosticsTracker } = await import('../src/TierDiagnostics.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');

const canvas = new EventTarget(), scene = new THREE.Scene(), level = new Level(scene);
for (const door of level.getDoors()) {
  if (door.getType() === 'permanent_limit') continue;
  door.unlock(); if (door.getState() === 'CLOSED') door.toggle(); door.update(5, []);
}
const source = ENCOUNTER_CONFIGS[7].spawnPool.find((point) => !level.isColliding(point.x, point.z, 0.4));
assert.ok(source, 'Un point réel du duel est disponible');
const camera = new THREE.PerspectiveCamera(75);
camera.position.set(source.x + 4, level.getFloorHeightAt(source.x, source.z) + 1.7, source.z);
const player = {
  camera, health: 40, getHealth() { return this.health; }, getMaxHealth: () => 100,
  isAlive() { return this.health > 0; }, heal(amount) {
    if (this.health >= 100) return false;
    this.health = Math.min(100, this.health + amount); return true;
  },
};
const weapon = new Weapon(camera, canvas, [], level.getSolidMeshes(), () => {}, () => true, () => {});
weapon.unlockWeapon('pistol'); weapon.unlockWeapon('shotgun');
const boss = new GuardianZombie(scene, level, source.x, source.z);
const diagnostics = new TierDiagnosticsTracker(); diagnostics.startTier(8, weapon.getAmmoStocks());
const game = Object.assign(Object.create(Game.prototype), {
  scene, level, player, weapon, renderer: { domElement: canvas }, encounterConfigs: ENCOUNTER_CONFIGS,
  state: 'playing', currentTier: 8, debugMenuOpen: false, runSummaryOpen: false,
  guardianSupplyElapsed: 0, guardianHealthSupplyElapsed: 0, guardianSupplyIndex: 0,
  guardianAmmoDrops: [], guardianMedkitDrops: [], medkits: [], ammoBoxes: [], ammoDrops: [],
  tierDiagnostics: diagnostics,
});
document.pointerLockElement = canvas;
const run = (seconds) => { for (let i = 0; i < Math.round(seconds / 0.05); i++) game.updateGuardianSupplies(0.05, boss); };
const counts = () => [game.guardianAmmoDrops.length, game.guardianMedkitDrops.length];
run(19.95); assert.deepEqual(counts(), [0, 0], 'Aucun drop avant vingt secondes actives');
run(0.05); assert.deepEqual(counts(), [2, 0]);
assert.deepEqual(game.guardianAmmoDrops.map((drop) => [drop.getWeaponType(), drop.getRemainingAmmo()]), [['pistol', 20], ['shotgun', 4]]);
for (const drop of game.guardianAmmoDrops) {
  const pos = drop.group.position;
  assert.equal(level.isColliding(pos.x, pos.z, 0.4), false);
  assert.ok(Math.abs(pos.y - 0.3 - level.getFloorHeightAt(pos.x, pos.z)) < 1e-8, 'Le drop utilise le vrai sol');
  assert.ok(level.findNextWaypoint(pos.clone(), camera.position, 0.4), 'Le drop possède un trajet praticable vers le joueur');
}
const beforePause = game.guardianSupplyElapsed;
for (const pause of ['pointer', 'hidden', 'focus', 'debug', 'summary', 'won', 'dead', 'boss-dead', 'not-final']) {
  const saved = { pointer: document.pointerLockElement, hidden: document.hidden, focus: document.hasFocus,
    debug: game.debugMenuOpen, summary: game.runSummaryOpen, state: game.state, health: player.health,
    bossAlive: boss.isAlive, tier: game.currentTier };
  if (pause === 'pointer') document.pointerLockElement = null;
  if (pause === 'hidden') document.hidden = true;
  if (pause === 'focus') document.hasFocus = () => false;
  if (pause === 'debug') game.debugMenuOpen = true;
  if (pause === 'summary') game.runSummaryOpen = true;
  if (pause === 'won') game.state = 'won';
  if (pause === 'dead') player.health = 0;
  if (pause === 'boss-dead') boss.isAlive = () => false;
  if (pause === 'not-final') game.currentTier = 7;
  run(60);
  assert.equal(game.guardianSupplyElapsed, beforePause, `${pause} : décompte suspendu`);
  assert.deepEqual(counts(), [2, 0]);
  document.pointerLockElement = saved.pointer; document.hidden = saved.hidden; document.hasFocus = saved.focus;
  game.debugMenuOpen = saved.debug; game.runSummaryOpen = saved.summary; game.state = saved.state;
  player.health = saved.health; boss.isAlive = saved.bossAlive; game.currentTier = saved.tier;
}
game.updateGuardianSupplies(600, boss);
assert.ok(game.guardianSupplyElapsed <= beforePause + 0.05 + 1e-8, 'Une longue frame ne rattrape pas les lots manqués');
run(19.95); assert.deepEqual(counts(), [4, 1], 'Premier soin de trente à quarante secondes');
const medkit = game.guardianMedkitDrops[0], medkitPos = medkit.group.position;
camera.position.set(medkitPos.x, medkitPos.y - 0.35 + 1.7, medkitPos.z);
weapon.weapons.pistol.reserve = 60; weapon.weapons.shotgun.reserve = 30;
game.updatePickups(0.01, false); assert.equal(player.health, 40, 'La collecte est suspendue hors contrôle');
game.updatePickups(0.01, true);
assert.equal(player.health, 70); assert.equal(game.guardianMedkitDrops.length, 0);
assert.equal(diagnostics.getCurrentRecord().healthRestored, 30);
assert.equal(diagnostics.getCurrentRecord().medkitsCollected, 1);
assert.equal(medkit.group.parent, null, 'Le soin consommé quitte la scène');
medkit.respawn(); assert.equal(medkit.group.parent, null, 'Un soin temporaire libéré ne se réarme pas');

const pistolDrop = game.guardianAmmoDrops.find((drop) => drop.getWeaponType() === 'pistol');
const ammoPos = pistolDrop.group.position;
camera.position.set(ammoPos.x, ammoPos.y - 0.3 + 1.7, ammoPos.z);
weapon.weapons.pistol.reserve = 59;
assert.equal(game.collectAmmoBox(pistolDrop), true); assert.equal(pistolDrop.getRemainingAmmo(), 19);
weapon.weapons.pistol.reserve = 0;
assert.equal(game.collectAmmoBox(pistolDrop), true); assert.equal(pistolDrop.getRemainingAmmo(), 0);
assert.equal(diagnostics.getCurrentRecord().weaponStats.pistol.ammoGained, 20);
assert.equal(diagnostics.getCurrentRecord().ammoBoxesCollected, 2, 'Les deux collectes partielles sont comptées');
player.health = 40;
run(300);
assert.ok(game.guardianAmmoDrops.filter((drop) => !drop.isConsumed() && drop.getWeaponType() === 'pistol').length <= 4);
assert.ok(game.guardianAmmoDrops.filter((drop) => !drop.isConsumed() && drop.getWeaponType() === 'shotgun').length <= 4);
assert.equal(game.guardianMedkitDrops.length, 2, 'Deux soins non consommés au maximum');
const allDrops = [...game.guardianAmmoDrops, ...game.guardianMedkitDrops];
game.clearGuardianSupplies(); assert.deepEqual(counts(), [0, 0]);
assert.equal(game.guardianSupplyElapsed, 0); assert.equal(game.guardianHealthSupplyElapsed, 0);
assert.ok(allDrops.every((drop) => drop.group.parent === null), 'Le nettoyage enlève tous les objets temporaires');
player.health = 100; run(40);
assert.deepEqual(counts(), [4, 0], 'Vie pleine : pas de soin superflu');
const collision = level.isColliding;
level.isColliding = () => true;
run(40); assert.deepEqual(counts(), [4, 0], 'Aucun objet dans un emplacement bloqué');
level.isColliding = collision;
const tierDrops = [...game.guardianAmmoDrops];
game.zombies = []; game.spitProjectiles = [];
game.startTier(7);
assert.deepEqual(counts(), [0, 0]);
assert.equal(game.guardianSupplyElapsed, 0); assert.equal(game.guardianHealthSupplyElapsed, 0);
assert.ok(tierDrops.every((drop) => drop.group.parent === null), 'Le vrai changement de palier nettoie le ravitaillement du duel');

// Medkit réel : rampe, plancher distinct, absence de destruction de la texture partagée.
const rampMedkit = new Medkit(scene, 0, 0, 30, 1.2);
player.health = 40;
camera.position.set(0, 1.7, 0); assert.equal(rampMedkit.tryPickup(player), false);
camera.position.set(0, 2.9, 0); assert.equal(rampMedkit.tryPickup(player), true);
const material = rampMedkit.group.children[0].material, texture = material.map;
let materialDisposals = 0, textureDisposals = 0;
material.addEventListener('dispose', () => materialDisposals++);
texture.addEventListener('dispose', () => textureDisposals++);
rampMedkit.dispose(); rampMedkit.dispose();
assert.equal(materialDisposals, 1); assert.equal(textureDisposals, 0);
boss.dispose(scene); weapon.dispose(); level.disposeDecor(); GuardianZombie.disposeSharedResources();
console.log('Portrait : ravitaillement 20/40 s, pauses/états, lots bornés accessibles, reliquats, soins sur rampes, diagnostics et nettoyage : OK');
