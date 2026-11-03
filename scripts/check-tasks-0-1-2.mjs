import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
  }
});

THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};

const { SpitterZombie } = await import('../src/SpitterZombie.ts');
const { SpitProjectile } = await import('../src/SpitProjectile.ts');
const { ZombieRemains } = await import('../src/ZombieRemains.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const { TierDiagnosticsTracker } = await import('../src/TierDiagnostics.ts');
const { Game } = await import('../src/Game.ts');
const { disposeAllZombieResources } = await import('../src/Zombie.ts');

console.log('=== VÉRIFICATION COMPORTEMENTALE TÂCHES 0, 1 ET 2 ===\n');

// -------------------------------------------------------------
// TÂCHE 0 : DIAGNOSTICS LOCAUX ET DÉSACTIVABLES
// -------------------------------------------------------------
console.log('1. Test de TierDiagnosticsTracker (Tâche 0)...');
const tracker = new TierDiagnosticsTracker(true);
tracker.startTier(4);
tracker.recordSpawn('standard', 1);
tracker.recordSpawn('agile', 2);
tracker.updateActiveThreats(3);
tracker.recordShot();
tracker.recordShot();
tracker.recordDamageDealt();
tracker.recordDamageTaken(15);
tracker.recordMedkit();
tracker.recordAmmoBox();
tracker.recordRevival('standard');
tracker.endTier();

const records = tracker.getRecords();
assert.equal(records.length, 1);
const r = records[0];
assert.equal(r.tierNumber, 4);
assert.equal(r.shotsFired, 2);
assert.equal(r.damageTaken, 15);
assert.equal(r.medkitsCollected, 1);
assert.equal(r.ammoBoxesCollected, 1);
assert.equal(r.revivalsCount.standard, 1);
assert.equal(r.maxSimultaneousThreats, 3);
assert.equal(r.spawnedByType.standard, 1);
assert.equal(r.spawnedByType.agile, 1);
assert.ok(r.firstContactDelaySeconds !== null);
console.log('   -> PASS : Tracker de diagnostics complet et précis.');

// -------------------------------------------------------------
// TÂCHE 1 : ÉLIMINATION DE L\'ANGLE MORT DU CRACHEUR
// -------------------------------------------------------------
console.log('2. Test de l\'élimination de l\'angle mort du Cracheur (Tâche 1)...');
const scene = new THREE.Scene();
ZombieRemains.warmup();
SpitterZombie.warmup();

const levelClear = {
  getFloorHeightAt: () => 0,
  isColliding: () => false,
  getSolidMeshes: () => [],
};

// Tester les distances : 1 m, 3 m, 5 m
for (const dist of [1.2, 3.0, 5.0]) {
  const spitter = new SpitterZombie(scene, levelClear, 0, 0);
  const playerPos = new THREE.Vector3(0, 1.7, dist);
  // Cooldown initial écoulé
  spitter.update(2.0, playerPos, [], () => {});
  assert.equal(spitter.getPose(), 'windup', `Le Cracheur déclenche la préparation à ${dist} m`);
  spitter.dispose(scene);
}

// Tester annulation si trop proche (< 0.85 m) pendant windup
{
  const spitter = new SpitterZombie(scene, levelClear, 0, 0);
  const playerPos = new THREE.Vector3(0, 1.7, 2.0);
  spitter.update(2.0, playerPos, [], () => {});
  assert.equal(spitter.getPose(), 'windup');
  // Joueur se rapproche à 0.6 m (< 0.85 m)
  playerPos.set(0, 1.7, 0.6);
  spitter.update(0.1, playerPos, [], () => {});
  assert.equal(spitter.getPose(), 'idle', 'La préparation s\'annule si la cible devient trop proche');
  spitter.dispose(scene);
}

// Tester annulation par blessure lourde / gros choc (Tâche 6) pendant le windup
{
  const spitter = new SpitterZombie(scene, levelClear, 0, 0);
  const playerPos = new THREE.Vector3(0, 1.7, 3.0);
  spitter.update(2.0, playerPos, [], () => {});
  assert.equal(spitter.getPose(), 'windup');
  spitter.takeDamage(10);
  assert.equal(spitter.getPose(), 'windup', 'Une blessure légère n annule plus la préparation (résistance)');
  spitter.takeDamage(60);
  assert.equal(spitter.getPose(), 'idle', 'Un gros choc (>= 55 PV) annule la préparation');
  spitter.dispose(scene);
}

// Tester origine du projectile rapproché (ne traverse pas le joueur)
{
  const spitter = new SpitterZombie(scene, levelClear, 0, 0);
  const playerPos = new THREE.Vector3(0, 1.7, 1.5);
  let projectileOrigin = null;
  let projectileTarget = null;
  spitter.update(2.0, playerPos, [], () => {});
  // Terminer le windup (0.95 s)
  spitter.update(1.0, playerPos, [], (origin, target) => {
    projectileOrigin = origin;
    projectileTarget = target;
  });
  assert.ok(projectileOrigin !== null, 'Le crachat est parti');
  // Distance entre l'origine et le cracheur
  const spitterDist = projectileOrigin.distanceTo(spitter.getPosition());
  // Distance entre l'origine et le joueur
  const playerDist = projectileOrigin.distanceTo(playerPos);
  assert.ok(spitterDist >= 0.05, 'L\'origine est avancée par rapport au centre du cracheur');
  assert.ok(playerDist > 0.4, 'L\'origine ne traverse pas le joueur (reste en amont)');
  spitter.dispose(scene);
}
console.log('   -> PASS : Cracheur réactif à 1.2m, 3m, 5m sans angle mort, annulation et projectile sûrs.');

// -------------------------------------------------------------
// TÂCHE 2 : SALVE D\'OUVERTURE ET COMPOSITION GARANTIE
// -------------------------------------------------------------
console.log('3. Test des salves d\'ouverture et composition garantie (Tâche 2)...');

// Vérifier les données EncounterConfig P1-P7
assert.equal(ENCOUNTER_CONFIGS[0].openingSpawns, 1);
assert.equal(ENCOUNTER_CONFIGS[1].openingSpawns, 1);
assert.equal(ENCOUNTER_CONFIGS[2].openingSpawns, 1);
assert.equal(ENCOUNTER_CONFIGS[3].openingSpawns, 2, 'P4 ouverture de 2');
assert.equal(ENCOUNTER_CONFIGS[4].openingSpawns, 2, 'P5 ouverture de 2');
assert.equal(ENCOUNTER_CONFIGS[5].openingSpawns, 3, 'P6 ouverture de 3');
assert.equal(ENCOUNTER_CONFIGS[6].openingSpawns, 3, 'P7 ouverture de 3');

// Vérifier la composition garantie sur les paliers 4 à 7
const mockScene = new THREE.Scene();
const mockLevel = {
  isColliding: () => false,
  getFloorHeightAt: () => 0,
  hasLineOfSight: () => false,
  findNextWaypoint: (_f, to) => to,
  getDoors: () => [],
  getLastPathfindingDurationMs: () => 0,
};

for (const tier of [4, 5, 6, 7]) {
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    scene: mockScene,
    level: mockLevel,
    player: {
      camera: {
        position: new THREE.Vector3(0, 1.7, 0),
        getWorldDirection: (out) => out.set(0, 0, 1),
      },
      audioListener: {},
    },
    currentTier: tier,
    tierSpitterSpawned: 0,
    tierAgileSpawned: 0,
    tierStandardSpawned: 0,
    lastSpawnQuadrant: -1,
    zombies: [],
    encounterConfigs: ENCOUNTER_CONFIGS,
    weapon: { setTargets() {} },
    zombieGroanBuffer: null,
    tierDiagnostics: new TierDiagnosticsTracker(false),
  });

  const config = ENCOUNTER_CONFIGS[tier - 1];
  const spawnedKinds = [];

  // Simuler des apparitions avec libération progressive des places
  for (let i = 0; i < config.totalZombies; i++) {
    // Si on a atteint 4 zombies simultanés, en tuer un pour simuler le combat
    if (game.zombies.filter((z) => z.isAlive()).length >= 4) {
      const living = game.zombies.find((z) => z.isAlive());
      living?.takeDamage(10000);
    }
    let spawned = game.trySpawnZombie();
    if (!spawned) {
      // Un plafond simultané de type (ex: maxSimultaneousAgile) est atteint :
      // tuer le premier vivant pour libérer la place
      const living = game.zombies.find((z) => z.isAlive());
      living?.takeDamage(10000);
      spawned = game.trySpawnZombie();
    }
    assert.equal(spawned, true, `Apparition #${i + 1} du palier ${tier} doit réussir`);
    spawnedKinds.push(game.zombies.at(-1).getKind());
  }

  // Vérifier les quotas exacts
  const spitterCount = spawnedKinds.filter((k) => k === 'spitter').length;
  const agileCount = spawnedKinds.filter((k) => k === 'agile').length;
  const standardCount = spawnedKinds.filter((k) => k === 'standard').length;

  assert.equal(spitterCount, config.maxSpitter, `P${tier} : quota exact de cracheurs`);
  assert.equal(agileCount, config.maxAgile, `P${tier} : quota exact de coureurs`);
  assert.equal(standardCount, config.totalZombies - config.maxSpitter - config.maxAgile, `P${tier} : quota exact de standards`);
  assert.ok(standardCount >= 1, `P${tier} : au moins 1 standard garanti (trouvé: ${standardCount})`);

  for (const z of game.zombies) z.dispose(mockScene);
}
console.log('   -> PASS : Salves 2/2/3/3 et composition garantie sur P4–P7 sans écrasement opportuniste.');

disposeAllZombieResources();
console.log('\n=============================================================');
console.log('TOUTES LES VALIDATIONS DES TÂCHES 0, 1 ET 2 ONT RÉUSSI (100%)');
console.log('=============================================================\n');
