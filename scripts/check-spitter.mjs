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
const impacts = [];
const onImpact = (point) => impacts.push(point.clone());
const blocked = new SpitProjectile(scene, new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.5, 4), onImpact);
assert.equal(blocked.update(0.3, scene, level, new THREE.Vector3(0, 1.5, 3), () => hits++), false);
assert.equal(hits, 0, 'Le mur protège le joueur');
assert.equal(impacts.length, 1, 'Le contact du mur déclenche un seul impact');

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
const direct = new SpitProjectile(scene, new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.5, 4), onImpact);
for (let i = 0; i < 8 && direct.update(0.1, scene, openLevel, new THREE.Vector3(0, 1.5, 2), () => hits++); i++);
assert.equal(hits, 2, 'Un impact direct applique un seul coup de 12 PV');
assert.equal(scene.children.filter((child) => child === direct.mesh).length, 0, 'Projectile retiré après impact');
assert.equal(impacts.length, 2, 'Le contact du joueur déclenche un seul impact');
const expired = new SpitProjectile(scene, new THREE.Vector3(), new THREE.Vector3(0, 0, 4), onImpact);
assert.equal(expired.update(5, scene, openLevel, new THREE.Vector3(8, 0, 0), () => assert.fail('Joueur hors trajectoire')), false);
expired.dispose(scene);
assert.equal(impacts.length, 2, 'Expiration et nettoyage ne déclenchent aucun impact');

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
preparing.takeDamage(80, true, 40);
assert.equal(preparing.getPose(), 'idle', 'La seconde balle 9 mm atteint le seuil de choc cumulé, même à la tête');
const headPreparing = new SpitterZombie(scene, clearLevel, 0, 0);
headPreparing.update(2.0, player, [], () => {});
headPreparing.takeDamage(80, true, 40);
assert.equal(headPreparing.getPose(), 'windup', 'Un tir 9 mm isolé à la tête ne compte que 40 de choc');
headPreparing.dispose(scene);

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

// Le vrai sélecteur introduit P3 après deux éliminations, escorte comprise dans les quotas.
const game = Object.create(Game.prototype);
const spawnScene = new THREE.Scene();
const spawnLevel = {
  isColliding: () => false,
  getFloorHeightAt: () => 2.4,
  hasLineOfSight: (from) => from.x !== 0,
  findNextWaypoint: (_from, to) => to,
  getDoors: () => [],
  getLastPathfindingDurationMs: () => 0,
};
Object.assign(game, {
  scene: spawnScene,
  level: spawnLevel,
  player: { camera: { position: new THREE.Vector3(0, 4.1, 0), getWorldDirection: (out) => out.set(0, 0, 1) }, audioListener: {} },
  currentTier: 3,
  state: 'playing',
  spawnQueue: ENCOUNTER_CONFIGS[2].totalZombies,
  tierSpitterSpawned: 0,
  tierAgileSpawned: 0,
  lastSpawnQuadrant: -1,
  zombies: [],
  encounterConfigs: ENCOUNTER_CONFIGS,
  maxSimultaneousZombies: 8,
  weapon: { setTargets() {} },
  zombieGroanBuffer: null,
  killsThisTier: 0,
  dropBudget: 0,
  defeatedZombies: new WeakSet(),
});
assert.equal(game.trySpawnZombie(), true);
assert.equal(game.zombies[0].getKind(), 'standard', 'P3 présente d’abord un standard');
game.spawnQueue--;
const eliminate = (zombie) => {
  zombie.takeDamage(10000, true);
  game.onZombieKilled(zombie);
};
eliminate(game.zombies[0]);
assert.equal(game.trySpawnZombie(), true);
game.spawnQueue--;
assert.equal(game.zombies[1].getKind(), 'standard', 'Une seule élimination ne suffit pas à introduire le Cracheur');
assert.equal(game.tierSpitterSpawned, 0);
eliminate(game.zombies[1]);
assert.equal(game.killsThisTier, 2);
assert.equal(game.trySpawnZombie(), true);
assert.equal(game.zombies[2].getKind(), 'spitter', 'Deux éliminations définitives autorisent le Cracheur');
assert.equal(game.zombies[3].getKind(), 'agile', 'Le Cracheur arrive avec un Coureur');
assert(game.zombies[2].getPosition().y >= 3.4, 'Le Cracheur apparaît sur le demi-niveau supérieur');
game.spawnQueue--;
// Ces scénarios testent les quotas, sans laisser une relève aléatoire occuper le budget d'escorte.
assert.equal(game.spawnQueue, 2, 'Les standards, le Cracheur et son escorte consomment quatre unités sur six');
for (const zombie of game.zombies) if (zombie.isAlive()) eliminate(zombie);
while (game.spawnQueue > 0) {
  assert.equal(game.trySpawnZombie(), true);
  game.spawnQueue--;
  for (const zombie of game.zombies) if (zombie.isAlive()) eliminate(zombie);
}
assert.equal(game.zombies.filter((zombie) => zombie.getKind() === 'spitter').length, 1, 'Exactement un cracheur pour les six ennemis du P3');
assert.equal(game.zombies.length, 6, 'Aucune escorte ajoutée hors quota P3');
for (const zombie of game.zombies) zombie.dispose(spawnScene);
function resetTier(tier) {
  Object.assign(game, {
    currentTier: tier, tierSpitterSpawned: 0, tierAgileSpawned: 0,
    tierCrawlerSpawned: 0, tierStandardSpawned: 0, zombies: [],
    killsThisTier: 0, defeatedZombies: new WeakSet(),
    spawnGroupIndex: 0, groupRespiteRemaining: null,
    spawnQueue: ENCOUNTER_CONFIGS[tier - 1].totalZombies,
  });
}
for (const tier of [4, 5, 6, 7]) {
  resetTier(tier);
  const config = ENCOUNTER_CONFIGS[tier - 1];
  game.spawnQueue = config.totalZombies;
  while (game.spawnQueue > 0) {
    if (config.spawnGroups && game.killsThisTier === 6 && game.spawnGroupIndex === 0) {
      assert.equal(game.trySpawnZombie(), false, 'Le second groupe P6 attend sa récupération');
      game.advanceSpawnGroup(0.01);
      game.advanceSpawnGroup(3);
      assert.equal(game.spawnGroupIndex, 1);
    }
    assert.equal(game.trySpawnZombie(), true, `Apparition du palier ${tier}`);
    game.spawnQueue--;
    for (const zombie of game.zombies) if (zombie.isAlive()) eliminate(zombie);
  }
  assert.equal(game.zombies.filter((zombie) => zombie.getKind() === 'spitter').length, config.maxSpitter, `Quota de Cracheurs P${tier}`);
  assert.equal(game.zombies.filter((zombie) => zombie.getKind() === 'agile').length, config.maxAgile, `Quota de Coureurs P${tier}`);
  assert.equal(game.zombies.length, config.totalZombies, `Les escortes restent dans le budget P${tier}`);
  assert(game.zombies.some((zombie) => zombie.getKind() === 'standard'), `Zombies standards encore présents P${tier}`);
  for (const zombie of game.zombies) zombie.dispose(spawnScene);
}
for (const tier of [6, 7]) {
  resetTier(tier);
  const config = ENCOUNTER_CONFIGS[tier - 1];
  game.spawnQueue = config.totalZombies;
  while (game.zombies.length < config.maxActiveZombies) {
    assert.equal(game.trySpawnZombie(), true, `La salve P${tier} remplit le nouveau plafond`);
    game.spawnQueue--;
  }
  const spitters = game.zombies.filter((z) => z.getKind() === 'spitter');
  const runners = game.zombies.filter((z) => z.getKind() === 'agile');
  assert.equal(spitters.length, config.maxSimultaneousSpitter, `Le plafond de Cracheurs P${tier} est respecté`);
  assert.ok(runners.length >= spitters.length, 'Chaque Cracheur a une escorte comprise dans le groupe');
  assert.ok(runners.length <= config.maxSimultaneousAgile, 'Les escortes respectent aussi le plafond des Coureurs');
  assert.ok(spitters.every((enemy) => runners.some((runner) => runner.getPosition().distanceTo(enemy.getPosition()) <= 8)), 'Chaque Cracheur conserve un Coureur proche');
  for (const zombie of game.zombies) zombie.dispose(spawnScene);
}
disposeAllZombieResources();
console.log('PASS : chute/cadavre, quotas P3–P7, annulation et collisions du projectile.');
