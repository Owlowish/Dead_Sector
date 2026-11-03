import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};

const { spitterAnimation } = await import('../src/SpitterAnimation.ts');
const { SpitterZombie } = await import('../src/SpitterZombie.ts');
const { SpitProjectile } = await import('../src/SpitProjectile.ts');
const { ZombieRemains } = await import('../src/ZombieRemains.ts');
const { Game } = await import('../src/Game.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const { disposeAllZombieResources } = await import('../src/Zombie.ts');
for (const pose of spitterAnimation.poses) assert(existsSync(new URL(`../public/assets/zombies/spitter/${pose}.png`, import.meta.url)));
for (const pose of ['death-a', 'corpse']) assert(existsSync(new URL(`../public/assets/zombies/spitter/${pose}.png`, import.meta.url)));
assert.equal(spitterAnimation.walkPoseDuration, 0.5);
assert.equal(spitterAnimation.windupDuration, 0.95);
assert.equal(spitterAnimation.releaseDuration, 0.18);
assert.equal(spitterAnimation.recoveryDuration, 0.65);
assert.equal(spitterAnimation.attackCooldown, 2.4);

const scene = new THREE.Scene();
ZombieRemains.warmup();
const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2));
wall.position.set(0, 1.5, 1);
wall.updateMatrixWorld(true);
const level = { getFloorHeightAt: () => 2.4, isColliding: () => false, getSolidMeshes: () => [wall] };
const spitter = new SpitterZombie(scene, level, 0, 0);
assert.equal(spitter.getKind(), 'spitter');
assert.equal(spitter.getMesh().geometry.parameters.width, 1.6);
assert.equal(spitter.getMesh().geometry.parameters.height, 2.7);
assert.equal(spitter.healthLeft, 240);
assert.equal(spitter.remains.mesh.material.map.userData.url, '/assets/zombies/spitter/death-a.png', 'Le préchauffage conserve le cadavre propre au Cracheur');
const fallen = new SpitterZombie(scene, level, 1, 0);
fallen.takeDamage(240);
assert.equal(fallen.remains.mesh.visible, true);
fallen.updateDeath(0.25, new THREE.Vector3(0, 4, 3));
assert.equal(fallen.remains.mesh.material.map.userData.url, '/assets/zombies/spitter/death.png', 'Pose intermédiaire de chute');
fallen.updateDeath(0.25, new THREE.Vector3(0, 4, 3));
assert.equal(fallen.remains.mesh.material.map.userData.url, '/assets/zombies/spitter/corpse.png', 'Cadavre final distinct');
fallen.dispose(scene);

// Un projectile s'arrête au premier solide, même si son pas traverse le mur.
let hits = 0;
const blocked = new SpitProjectile(scene, new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.5, 4));
assert.equal(blocked.update(0.3, scene, level, new THREE.Vector3(0, 1.5, 3), () => hits++), false);
assert.equal(hits, 0, 'Le mur protège le joueur');

// Un grand delta compare aussi l'ordre d'impact : le joueur avant le mur reçoit le coup.
const behindPlayerWall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2));
behindPlayerWall.position.set(0, 1.5, 2);
behindPlayerWall.updateMatrixWorld(true);
const wallAfterPlayerLevel = { getSolidMeshes: () => [behindPlayerWall] };
const fastStep = new SpitProjectile(scene, new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.5, 4));
assert.equal(fastStep.update(0.5, scene, wallAfterPlayerLevel, new THREE.Vector3(0, 1.5, 1.5), () => hits++), false);
assert.equal(hits, 1, 'Le joueur croisé avant le mur est touché pendant un gros pas');

// Sans mur, un impact direct transfère les dégâts une fois puis retire le projectile.
const openLevel = { getSolidMeshes: () => [] };
const direct = new SpitProjectile(scene, new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.5, 4));
for (let i = 0; i < 8 && direct.update(0.1, scene, openLevel, new THREE.Vector3(0, 1.5, 2), () => hits++); i++);
assert.equal(hits, 2, 'Un impact direct applique un seul coup de 12 PV');
assert.equal(scene.children.filter((child) => child === direct.mesh).length, 0, 'Projectile retiré après impact');

// La préparation est annulée par une blessure avant la libération.
const clearLevel = { getFloorHeightAt: () => 2.4, isColliding: () => false, getSolidMeshes: () => [] };
const preparing = new SpitterZombie(scene, clearLevel, 0, 0);
const player = new THREE.Vector3(0, 3.0, 8);
preparing.update(1.9, player, [], () => assert.fail('Pas de tir avant préparation'));
preparing.update(0.1, player, [], () => assert.fail('Pas de tir à la première frame d’alerte'));
assert.equal(preparing.getPose(), 'windup');
preparing.takeDamage(1);
assert.equal(preparing.getPose(), 'windup', 'Une égratignure n’annule pas la préparation (résistance)');
preparing.takeDamage(40);
assert.equal(preparing.getPose(), 'windup', 'Une balle de pistolet isolée (40 dégâts) ne brise pas le windup');
preparing.takeDamage(40);
assert.equal(preparing.getPose(), 'idle', 'Deux balles de pistolet (81 dégâts cumulés >= 75) interrompent le tir');

// Coup lourd de fusil à pompe direct (gros choc >= 55)
const shotgunPreparing = new SpitterZombie(scene, clearLevel, 0, 0);
shotgunPreparing.update(2.0, player, [], () => {});
assert.equal(shotgunPreparing.getPose(), 'windup');
shotgunPreparing.takeDamage(60);
assert.equal(shotgunPreparing.getPose(), 'idle', 'Un coup lourd de fusil à pompe brise immédiatement le tir');
shotgunPreparing.dispose(scene);

// Les deux poses de marche durent chacune la totalité de leur demi-seconde.
const walker = new SpitterZombie(scene, clearLevel, 0, 0);
const farPlayer = new THREE.Vector3(0, 4.1, 18);
walker.update(0.3, farPlayer, [], () => {});
assert.equal(walker.getPose(), 'walk-a');
walker.update(0.3, farPlayer, [], () => {});
assert.equal(walker.getPose(), 'walk-a', 'La pose A tient pendant sa durée');
walker.update(0.25, farPlayer, [], () => {});
assert.equal(walker.getPose(), 'walk-b');
walker.update(0.1, farPlayer, [], () => {});
assert.equal(walker.getPose(), 'walk-b', 'La pose B tient pendant sa durée');
walker.dispose(scene);

// Un mur hors de portée immédiate déclenche le waypoint local au lieu d'une marche bloquée.
const partition = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 4));
partition.position.set(0, 3.5, 0);
partition.updateMatrixWorld(true);
const aroundWall = { ...clearLevel, getSolidMeshes: () => [partition], findNextWaypoint: () => new THREE.Vector3(-1, 2.4, 1) };
const routed = new SpitterZombie(scene, aroundWall, -1, 0);
routed.update(0.3, new THREE.Vector3(15, 4.1, 0), [], () => {});
assert(routed.getPosition().z > 0, 'Le cracheur commence le détour choisi par Level');
routed.dispose(scene);
preparing.dispose(scene);
spitter.dispose(scene);
SpitterZombie.disposeSharedResources();

// Le vrai sélecteur de Game réserve bien une seule apparition, sans augmenter le quota.
const game = Object.create(Game.prototype);
const spawnScene = new THREE.Scene();
const spawnLevel = {
  isColliding: () => false,
  getFloorHeightAt: () => 2.4,
  hasLineOfSight: () => false,
  findNextWaypoint: (_from, to) => to,
  getDoors: () => [],
  getLastPathfindingDurationMs: () => 0,
};
Object.assign(game, {
  scene: spawnScene,
  level: spawnLevel,
  player: { camera: { position: new THREE.Vector3(0, 4.1, 0), getWorldDirection: (out) => out.set(0, 0, 1) }, audioListener: {} },
  currentTier: 3,
  tierSpitterSpawned: 0,
  tierAgileSpawned: 0,
  lastSpawnQuadrant: -1,
  zombies: [],
  encounterConfigs: ENCOUNTER_CONFIGS,
  weapon: { setTargets() {} },
  zombieGroanBuffer: null,
});
assert.equal(game.trySpawnZombie(), true);
assert.equal(game.zombies[0].getKind(), 'spitter', 'Le premier spawn P3 réservé est le cracheur');
assert(game.zombies[0].getPosition().y >= 3.4, 'Le cracheur apparaît sur le demi-niveau supérieur');
for (let i = 0; i < ENCOUNTER_CONFIGS[2].totalZombies - 1; i++) {
  assert.equal(game.trySpawnZombie(), true);
  game.zombies.at(-1).takeDamage(10000);
}
assert.equal(game.zombies.filter((zombie) => zombie.getKind() === 'spitter').length, 1, 'Exactement un cracheur pour les six ennemis du P3');
for (const zombie of game.zombies) zombie.dispose(spawnScene);
for (const tier of [4, 5, 6, 7]) {
  game.currentTier = tier;
  game.tierSpitterSpawned = 0;
  game.tierAgileSpawned = 0;
  game.tierStandardSpawned = 0;
  game.zombies = [];
  const config = ENCOUNTER_CONFIGS[tier - 1];
  for (let i = 0; i < config.totalZombies; i++) {
    assert.equal(game.trySpawnZombie(), true, `Apparition ${i + 1} du palier ${tier}`);
    game.zombies.at(-1).takeDamage(10000);
  }
  assert.equal(game.zombies.filter((zombie) => zombie.getKind() === 'spitter').length, config.maxSpitter, `Quota de Cracheurs P${tier}`);
  assert.equal(game.zombies.filter((zombie) => zombie.getKind() === 'agile').length, config.maxAgile, `Quota de Coureurs P${tier}`);
  assert(game.zombies.some((zombie) => zombie.getKind() === 'standard'), `Zombies standards encore présents P${tier}`);
  for (const zombie of game.zombies) zombie.dispose(spawnScene);
}
disposeAllZombieResources();
console.log('PASS : chute/cadavre, quotas P3–P7, annulation et collisions du projectile.');
