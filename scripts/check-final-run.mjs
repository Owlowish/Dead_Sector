import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.window = Object.assign(new EventTarget(), { location: { reload() { assert.fail('La tentative ne doit pas recharger la page'); } } });
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null, hidden: false, hasFocus: () => true,
  querySelector: () => null, querySelectorAll: () => [],
  exitCount: 0,
  exitPointerLock() { this.exitCount++; this.pointerLockElement = null; },
});
globalThis.Audio = class {
  volume = 1; currentTime = 0;
  play() { return Promise.resolve(); }
  pause() {}
};

const { Game } = await import('../src/Game.ts');
const { Player } = await import('../src/Player.ts');
const { Weapon } = await import('../src/Weapon.ts');
const { Level } = await import('../src/Level.ts');
const { Zombie } = await import('../src/Zombie.ts');
const { ShotgunPickup } = await import('../src/ShotgunPickup.ts');
const { TierDiagnosticsTracker } = await import('../src/TierDiagnostics.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const { PLAYER_START_POSITION } = await import('../src/MansionConfig.ts');

const element = () => ({ hidden: true, textContent: '', style: {}, focus() {} });
const scene = new THREE.Scene();
const level = new Level(scene);
// P1 verrouille les quatre accès de progression et la sortie condamnée.
const initialDoors = level.getDoors().map((door) => [door.getId(), 'LOCKED']);
const canvas = new EventTarget();
const player = Object.create(Player.prototype);
Object.assign(player, {
  level, keys: new Set(), health: 100, maxHealth: 100, speedMultiplier: 1,
  camera: new THREE.PerspectiveCamera(75), eyeHeight: 1.7, normalFov: 75, aimedFov: 58,
  yaw: 0, pitch: 0, recoilPitch: 0, recoilYaw: 0, recoilRoll: 0,
  flashlight: { intensity: 22 }, flashlightIntensity: 22, flashlightOn: true,
  audioListener: { context: { resume: () => Promise.resolve() } },
});
player.resetForDebug();
const game = Object.create(Game.prototype);
const weapon = new Weapon(player.camera, canvas, [], level.getSolidMeshes(), () => {}, () => game.isSimulationActive(), (amount) => player.setAimAmount(amount));
const pickup = new ShotgunPickup(scene);
const diagnostics = new TierDiagnosticsTracker();
diagnostics.startTier(7); diagnostics.recordShot(); diagnostics.recordHit(1, 2); diagnostics.endTier();
diagnostics.startTier(8); diagnostics.recordShot(); diagnostics.recordDamageTaken(12);
const fields = ['duration', 'tiers', 'shots', 'hits', 'damage', 'mode'].map((name) => Object.assign(element(), { dataset: { runStat: name } }));
const title = element();
const summaryDisplay = Object.assign(element(), {
  querySelector: (selector) => selector === '#run-summary-title' ? title : element(),
  querySelectorAll: () => fields,
});
let clearedEffects = 0, resetStorm = 0, disposed = 0;
const disposable = () => ({ dispose() { disposed++; }, stopAudio() {} });
Object.assign(game, {
  scene, level, player, weapon, shotgunPickup: pickup, tierDiagnostics: diagnostics,
  encounterConfigs: ENCOUNTER_CONFIGS, renderer: { domElement: canvas },
  state: 'playing', currentTier: 8, pendingTierStart: 0, spawnQueue: 1, respiteTimer: 0,
  runElapsedSeconds: 125, completedTiers: new Set([1, 2, 3, 4, 5, 6, 7]),
  runResult: null, runSummaryOpen: false, debugMenuOpen: false, debugRun: false, disposed: false,
  summaryDisplay, summaryOpenButton: element(), pauseDisplay: element(),
  victoryDisplay: element(), gameOverDisplay: element(), objectiveDisplay: element(),
  promptDisplay: element(), damageOverlay: Object.assign(element(), { style: { opacity: '1' } }),
  zombies: [], spitProjectiles: [], medkits: [], ammoBoxes: [], ammoDrops: [], shellCasings: [],
  upgradePedestals: [], appliedUpgrades: [], ambianceAudio: null, musicAudio: null,
  hitEffects: { clear() { clearedEffects++; } },
  horrorDirector: { resetRespite() {}, suspend() {} },
  stormController: { suspend() {}, resetForNewRun() { resetStorm++; } },
});
document.pointerLockElement = canvas;

// La file et une relève restent des menaces, même au dernier palier.
game.checkTierCompletion();
assert.equal(game.state, 'playing');
game.spawnQueue = 0;
const pendingRevival = Object.assign(Object.create(Zombie.prototype), {
  alive: false, revivalPending: true, stopAudio() {}, dispose() { disposed++; },
});
game.zombies = [pendingRevival];
game.checkTierCompletion();
assert.equal(game.state, 'playing', 'Une relève en attente interdit la victoire');
pendingRevival.revivalPending = false;
game.checkTierCompletion();
assert.equal(game.state, 'won');
assert.equal(game.isSimulationActive(), true, 'Le déplacement reste disponible après la victoire');
assert.equal(game.runSummaryOpen, false);
assert.equal(game.victoryDisplay.hidden, true);
assert.equal(summaryDisplay.hidden, true, 'Le bilan est volontaire');
assert.equal(document.pointerLockElement, canvas);
assert.equal(document.exitCount, 0, 'La dernière élimination ne libère pas la souris');
assert.deepEqual(game.getRunSummary(), {
  result: 'won', elapsedSeconds: 125, completedTiers: 8, totalTiers: 8,
  shotsFired: 2, headHits: 1, bodyHits: 2, damageTaken: 12, debugUsed: false,
});
game.checkTierCompletion();
game.endGame('lost');
assert.equal(game.state, 'won', 'Un résultat terminé ne peut pas être remplacé');
assert.equal(diagnostics.getRecords().length, 2, 'La finale est enregistrée une seule fois');

game.openRunSummary();
assert.equal(game.isSimulationActive(), false);
assert.equal(summaryDisplay.hidden, false);
assert.equal(document.exitCount, 1, 'Seule l’ouverture volontaire libère la souris');
assert.equal(fields[0].textContent, '2:05');
assert.equal(fields[1].textContent, '8 / 8');
assert.equal(fields[2].textContent, '2');
game.openRunSummary();
assert.equal(document.exitCount, 1, 'Ouvrir deux fois ne répète pas la transition');
game.closeRunSummary();
assert.equal(summaryDisplay.hidden, true);
assert.equal(game.state, 'won');
assert.equal(game.isSimulationActive(), true);
assert.equal(document.pointerLockElement, null, 'La fermeture attend un clic pour reprendre la souris');

// Une nouvelle tentative réutilise les systèmes, mais remet leurs données de partie à zéro.
pickup.collect(weapon);
weapon.upgradeAmmoCapacity(1.5); weapon.upgradeAccuracy(0.65);
weapon.magazineAmmo = 0; weapon.reserveAmmo = 0;
player.maxHealth = 140; player.health = 7; player.speedMultiplier = 1.12; player.flashlightOn = false;
game.ammoDrops = [disposable()]; game.shellCasings = [disposable()]; game.spitProjectiles = [disposable()];
game.appliedUpgrades = ['ammo_capacity']; game.debugRun = true;
for (const door of level.getDoors()) {
  if (door.getType() === 'permanent_limit') continue;
  door.unlock(); door.toggle(); door.update(5, []);
}
game.restartRun();
assert.equal(game.state, 'playing');
assert.equal(game.currentTier, 1);
assert.equal(game.spawnQueue, ENCOUNTER_CONFIGS[0].totalZombies);
assert.equal(game.pendingTierStart, 0); assert.equal(game.respiteTimer, 0);
assert.equal(game.runResult, null); assert.equal(game.runElapsedSeconds, 0);
assert.equal(game.completedTiers.size, 0); assert.equal(game.debugRun, false);
assert.equal(game.ammoDrops.length + game.shellCasings.length + game.spitProjectiles.length + game.zombies.length, 0);
assert.equal(disposed, 4, 'Corps, projectile, drop et douille sont nettoyés');
assert.equal(clearedEffects, 1); assert.equal(resetStorm, 1);
assert.equal(player.getHealth(), 100); assert.equal(player.getMaxHealth(), 100);
assert.equal(player.getSpeedMultiplier(), 1); assert.equal(player.isFlashlightOn(), true);
assert.deepEqual(player.camera.position.toArray(), [PLAYER_START_POSITION.x, 1.7, PLAYER_START_POSITION.z]);
assert.equal(weapon.getActiveWeaponId(), 'pistol'); assert.equal(weapon.isWeaponUnlocked('shotgun'), false);
assert.equal(weapon.getAmmo(), 10); assert.equal(weapon.getMaxAmmo(), 15); assert.equal(weapon.getReserveAmmo(), 30);
assert.equal(pickup.isConsumed(), false);
assert.deepEqual(level.getDoors().map((door) => [door.getId(), door.getState()]), initialDoors);
assert.equal(diagnostics.getRecords().length, 0);
assert.equal(diagnostics.getCurrentRecord().tierNumber, 1);
assert.equal(game.summaryOpenButton.hidden, true); assert.equal(summaryDisplay.hidden, true);
assert.equal(game.pauseDisplay.hidden, false);

document.pointerLockElement = canvas;
player.takeDamage(100);
game.endGame('lost');
assert.equal(game.state, 'lost'); assert.equal(game.isSimulationActive(), false);
assert.equal(game.gameOverDisplay.hidden, false); assert.equal(summaryDisplay.hidden, true);
assert.equal(document.pointerLockElement, null, 'La défaite conserve sa pause existante');
game.restartRun();
assert.equal(player.isAlive(), true); assert.equal(game.currentTier, 1);
assert.equal(game.getRunSummary().completedTiers, 0);
console.log('Finale : file/relèves, victoire unique et libre, bilan volontaire et nouvelle tentative complète : OK. Audio/DOM simulés ; gameplay non validé.');
