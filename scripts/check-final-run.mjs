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
const { GuardianProjectile } = await import('../src/GuardianProjectile.ts');
const { PortraitParticles } = await import('../src/PortraitParticles.ts');
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
const portraitParticles = new PortraitParticles(scene, () => 0.5);
const portraitAudio = { stops: 0, plays: [], stop() { this.stops++; }, play(...args) { this.plays.push(args); } };
const music = { select(track, audible) { this.track = track; this.audible = audible; }, rewind() {} };
const weapon = new Weapon(player.camera, canvas, [], level.getSolidMeshes(), () => {}, () => game.isSimulationActive(), (amount) => player.setAimAmount(amount));
const diagnostics = new TierDiagnosticsTracker();
diagnostics.startTier(7); diagnostics.recordShot(); diagnostics.recordHit(1, 2); diagnostics.endTier();
diagnostics.startTier(8); diagnostics.recordShot(); diagnostics.recordDamageTaken(12);
const fields = ['duration', 'tiers', 'shots', 'hits', 'damage', 'mode', 'fatalHit'].map((name) => Object.assign(element(), { dataset: { runStat: name } }));
const title = element();
const fatalRow = element();
const summaryDisplay = Object.assign(element(), {
  querySelector: (selector) => selector === '#run-summary-title' ? title : selector === '[data-run-fatal]' ? fatalRow : element(),
  querySelectorAll: () => fields,
});
let clearedEffects = 0, resetStorm = 0, disposed = 0;
const disposable = () => ({ dispose() { disposed++; }, stopAudio() {} });
Object.assign(game, {
  scene, level, player, weapon, tierDiagnostics: diagnostics, portraitParticles, portraitAudio,
  encounterConfigs: ENCOUNTER_CONFIGS, renderer: { domElement: canvas },
  state: 'playing', currentTier: 8, pendingTierStart: 0, spawnQueue: 1, respiteTimer: 0,
  runElapsedSeconds: 125, completedTiers: new Set([1, 2, 3, 4, 5, 6, 7]),
  runResult: null, runSummaryOpen: false, debugMenuOpen: false, debugRun: false, disposed: false,
  summaryDisplay, summaryOpenButton: element(), pauseDisplay: element(),
  victoryDisplay: element(), gameOverDisplay: element(), objectiveDisplay: element(),
  promptDisplay: element(), damageOverlay: Object.assign(element(), { style: { opacity: '1' } }),
  zombies: [], spitProjectiles: [], medkits: [], ammoBoxes: [], ammoDrops: [], shellCasings: [],
  upgradePedestals: [], appliedUpgrades: [], ambianceAudio: null, music, bossMusic: 'boss1',
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
const transformation = { position: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, 1), phase: 2 };
game.onPortraitCue({ ...transformation, kind: 'transform-start' });
assert.equal(music.track, 'transformation');
game.onPortraitCue({ ...transformation, kind: 'transform-end' });
assert.equal(music.track, 'boss2');
portraitAudio.plays.length = 0;
game.onPortraitCue({ kind: 'transform-burst', position: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, 1), phase: 2 });
assert.ok(portraitParticles.getStats().active > 0, 'La transformation du vrai Game émet les fragments');
assert.equal(portraitAudio.plays.length, 1, 'Le signal de transformation commande une seule voix');
game.checkTierCompletion();
assert.equal(game.state, 'won');
assert.equal(music.track, 'victory');
assert.equal(portraitParticles.getStats().active, 0, 'La victoire nettoie les effets du boss');
const stoppedAfterWin = portraitAudio.stops;
assert.ok(stoppedAfterWin > 0, 'La victoire coupe le son de transformation');
game.onPortraitCue({ kind: 'transform-burst', position: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, 1), phase: 2 });
assert.equal(portraitParticles.getStats().active, 0, 'Aucun effet tardif après la victoire');
assert.equal(portraitAudio.plays.length, 1, 'Aucun son tardif après la victoire');
assert.equal(game.isSimulationActive(), true, 'Le déplacement reste disponible après la victoire');
assert.equal(game.runSummaryOpen, false);
assert.equal(game.victoryDisplay.hidden, true);
assert.equal(summaryDisplay.hidden, true, 'Le bilan est volontaire');
assert.equal(document.pointerLockElement, canvas);
assert.equal(document.exitCount, 0, 'La dernière élimination ne libère pas la souris');
assert.deepEqual(game.getRunSummary(), {
  result: 'won', elapsedSeconds: 125, completedTiers: 8, totalTiers: 8,
  shotsFired: 2, headHits: 1, bodyHits: 2, damageTaken: 12, fatalHit: null, debugUsed: false,
});
game.checkTierCompletion();
game.endGame('lost');
assert.equal(game.state, 'won', 'Un résultat terminé ne peut pas être remplacé');
assert.equal(diagnostics.getRecords().length, 2, 'La finale est enregistrée une seule fois');

game.openRunSummary();
assert.equal(game.isSimulationActive(), false);
assert.equal(music.track, 'victory', 'Le bilan ne relance pas une piste de pause');
assert.equal(summaryDisplay.hidden, false);
assert.equal(document.exitCount, 1, 'Seule l’ouverture volontaire libère la souris');
assert.equal(fields[0].textContent, '2:05');
assert.equal(fields[1].textContent, '8 / 8');
assert.equal(fields[2].textContent, '2');
assert.equal(fatalRow.hidden, true, 'Aucun coup fatal dans le bilan de victoire');
game.openRunSummary();
assert.equal(document.exitCount, 1, 'Ouvrir deux fois ne répète pas la transition');
game.closeRunSummary();
assert.equal(summaryDisplay.hidden, true);
assert.equal(game.state, 'won');
assert.equal(game.isSimulationActive(), true);
assert.equal(document.pointerLockElement, null, 'La fermeture attend un clic pour reprendre la souris');

// Une nouvelle tentative réutilise les systèmes, mais remet leurs données de partie à zéro.
game.ensureProgressionWeapons(8);
weapon.switchWeapon('shotgun');
weapon.upgradeAmmoCapacity(1.5); weapon.upgradeAccuracy(0.65);
weapon.magazineAmmo = 0; weapon.reserveAmmo = 0;
player.maxHealth = 140; player.health = 7; player.speedMultiplier = 1.12; player.flashlightOn = false;
player.applyAnkleGrab();
game.ammoDrops = [disposable()]; game.shellCasings = [disposable()]; game.spitProjectiles = [disposable()];
game.appliedUpgrades = ['ammo_capacity']; game.debugRun = true;
portraitParticles.transformation(new THREE.Vector3(), 'burst');
for (const door of level.getDoors()) {
  if (door.getType() === 'permanent_limit') continue;
  door.unlock(); door.toggle(); door.update(5, []);
}
game.restartRun();
assert.equal(game.state, 'playing');
assert.equal(music.track, 'pause');
assert.equal(game.currentTier, 1);
assert.equal(game.spawnQueue, ENCOUNTER_CONFIGS[0].totalZombies);
assert.equal(game.pendingTierStart, 0); assert.equal(game.respiteTimer, 0);
assert.equal(game.runResult, null); assert.equal(game.runElapsedSeconds, 0);
assert.equal(game.completedTiers.size, 0); assert.equal(game.debugRun, false);
assert.equal(game.ammoDrops.length + game.shellCasings.length + game.spitProjectiles.length + game.zombies.length, 0);
assert.equal(disposed, 4, 'Corps, projectile, drop et douille sont nettoyés');
assert.equal(clearedEffects, 1); assert.equal(resetStorm, 1);
assert.equal(portraitParticles.getStats().active, 0, 'Une nouvelle tentative efface toutes les particules');
assert.ok(portraitAudio.stops > stoppedAfterWin, 'Une nouvelle tentative coupe les voix restantes');
assert.equal(player.getHealth(), 100); assert.equal(player.getMaxHealth(), 100);
assert.equal(player.getSpeedMultiplier(), 1); assert.equal(player.isFlashlightOn(), true);
assert.equal(player.grabTimer, 0, 'Une nouvelle tentative efface un agrippement en cours');
assert.equal(player.grabSlowFactor, 1, 'Le ralentissement de la Rampeuse ne traverse pas les tentatives');
assert.deepEqual(player.camera.position.toArray(), [PLAYER_START_POSITION.x, 1.7, PLAYER_START_POSITION.z]);
assert.equal(weapon.getActiveWeaponId(), 'axe');
assert.equal(weapon.isWeaponUnlocked('pistol'), false); assert.equal(weapon.isWeaponUnlocked('shotgun'), false);
assert.equal(weapon.getAmmo(), 0); assert.equal(weapon.getMaxAmmo(), 0); assert.equal(weapon.getReserveAmmo(), 0);
assert.deepEqual(weapon.getAmmoStocks().pistol, { magazine: 10, reserve: 30, unlocked: false });
assert.deepEqual(level.getDoors().map((door) => [door.getId(), door.getState()]), initialDoors);
assert.equal(diagnostics.getRecords().length, 0);
assert.equal(diagnostics.getCurrentRecord().tierNumber, 1);
assert.equal(game.summaryOpenButton.hidden, true); assert.equal(summaryDisplay.hidden, true);
assert.equal(game.pauseDisplay.hidden, false);

document.pointerLockElement = canvas;
// Une touche fatale nettoie aussi les projectiles déjà retenus dans la nouvelle file,
// sans avancer ceux qui restaient dans la file parcourue.
player.health = 10;
weapon.unlockWeapon('pistol');
weapon.magazineAmmo = 8;
assert.equal(weapon.reload(), true);
const projectileOrigin = player.camera.position.clone();
const projectileSceneSize = scene.children.length;
const survivor = new GuardianProjectile(scene, projectileOrigin.clone().add(new THREE.Vector3(4, 0, 0)),
  projectileOrigin.clone().add(new THREE.Vector3(4, 0, -10)));
const fatal = new GuardianProjectile(scene, projectileOrigin.clone().add(new THREE.Vector3(0, 0, 1)), projectileOrigin);
const pending = new GuardianProjectile(scene, projectileOrigin.clone().add(new THREE.Vector3(0, 0, -5)), projectileOrigin);
const updates = [0, 0, 0];
const disposals = [0, 0, 0];
for (const [index, projectile] of [survivor, fatal, pending].entries()) {
  const update = projectile.update.bind(projectile);
  const dispose = projectile.dispose.bind(projectile);
  projectile.update = (...args) => { updates[index]++; return update(...args); };
  projectile.dispose = (...args) => { disposals[index]++; return dispose(...args); };
}
const previousLevel = game.level;
game.level = { getSolidMeshes: () => [] };
game.spitProjectiles = [survivor, fatal, pending];
try {
  game.updateProjectiles(0.1);
  assert.deepEqual(updates, [1, 1, 0], 'aucun projectile avancé après la touche fatale');
  assert.deepEqual(disposals, [1, 1, 1], 'les deux files de projectiles sont intégralement nettoyées');
  assert.equal(game.spitProjectiles.length, 0, 'aucun survivant réintroduit après endGame');
  assert.equal(scene.children.length, projectileSceneSize, 'les objets de tous les projectiles quittent la scène');
  assert.equal(player.getHealth(), 0);
  game.updateProjectiles(0.1);
  assert.deepEqual(updates, [1, 1, 0], 'aucune touche tardive après défaite');
} finally {
  game.level = previousLevel;
}
assert.equal(game.state, 'lost'); assert.equal(game.isSimulationActive(), false);
assert.equal(game.gameOverDisplay.hidden, false); assert.equal(summaryDisplay.hidden, true);
assert.equal(portraitParticles.getStats().active, 0, 'La défaite conserve aussi un pool vide');
assert.equal(document.pointerLockElement, null, 'La défaite conserve sa pause existante');
assert.deepEqual(game.getRunSummary().fatalHit, { cause: 'portrait-blade', tier: 1, reloading: true });
game.openRunSummary();
assert.equal(fatalRow.hidden, false);
assert.equal(fields.at(-1).textContent, 'Lame du Maître du Portrait pendant le rechargement · Palier 1');
game.restartRun();
assert.equal(player.isAlive(), true); assert.equal(game.currentTier, 1);
assert.equal(game.getRunSummary().completedTiers, 0);
assert.equal(game.getRunSummary().fatalHit, null);
portraitParticles.dispose();
console.log('Finale : file/relèves, victoire unique et libre, bilan volontaire et nouvelle tentative complète : OK. Audio/DOM simulés ; gameplay non validé.');
