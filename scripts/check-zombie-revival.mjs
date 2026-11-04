import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};

const { Zombie, disposeAllZombieResources } = await import('../src/Zombie.ts');
const { Game } = await import('../src/Game.ts');
const scene = new THREE.Scene();
const level = {
  getFloorHeightAt: () => 0,
  getSolidMeshes: () => [],
  isColliding: () => false,
  findNextWaypoint: (_start, target) => target,
};
const zombie = new Zombie(scene, level, 0, 0, 'standard', () => 0);
const game = Object.create(Game.prototype);
Object.assign(game, { state: 'playing', spawnQueue: 0, zombies: [zombie], enterRespite() { this.state = 'respite'; } });

zombie.takeDamage(100);
assert.equal(zombie.isAlive(), false);
assert.equal(zombie.isThreat(), true, 'Le cadavre qui va se relever compte encore dans la vague');
game.checkTierCompletion();
assert.equal(game.state, 'playing', 'La vague ne se termine pas avant la relève');
const remains = zombie.remains.mesh;
assert.equal(remains.visible, true);
for (let i = 0; i < 80; i++) zombie.updateDeath(0.05, new THREE.Vector3(0, 1.7, 4));
assert.equal(zombie.isAlive(), true);
assert.equal(zombie.getMesh().visible, true);
assert.equal(remains.visible, false, 'Le cadavre disparaît quand le zombie se relève');
assert.equal(zombie.health, 40);

zombie.takeDamage(40);
assert.equal(zombie.isThreat(), false, 'Une seconde mort est définitive');
assert.equal(remains.visible, true, 'Un nouveau cadavre reste visible');
game.checkTierCompletion();
assert.equal(game.state, 'respite');
zombie.dispose(scene);

const precise = new Zombie(scene, level, 0, 0, 'standard', () => 0);
precise.takeDamage(100, true);
assert.equal(precise.isThreat(), false, 'Une élimination à la tête empêche la relève');
precise.dispose(scene);

// Test de la relève du Coureur agile (Tâche 4)
const agile = new Zombie(scene, level, 0, 0, 'agile', () => 0); // random() = 0 < 0.12 -> déclenche la relève
Object.assign(game, { state: 'playing', spawnQueue: 0, zombies: [agile] });

agile.takeDamage(80);
assert.equal(agile.isAlive(), false);
assert.equal(agile.isThreat(), true, 'Le cadavre du Coureur compte encore comme menace pendant son délai');
game.checkTierCompletion();
assert.equal(game.state, 'playing', 'La vague ne se termine pas avant la relève du Coureur');
const agileRemains = agile.remains.mesh;
assert.equal(agileRemains.visible, true);

// Avancer la simulation (délai 2.0s + animation inverse)
for (let i = 0; i < 90; i++) agile.updateDeath(0.05, new THREE.Vector3(0, 1.7, 4));

assert.equal(agile.isAlive(), true, 'Le Coureur s\'est relevé');
assert.equal(agile.health, 40, 'Le Coureur revient avec 40 PV (moitié des 80 PV initiaux)');
assert.equal(agile.getMesh().visible, true);
assert.equal(agileRemains.visible, false, 'Le cadavre temporaire disparaît quand le Coureur se relève');
assert.equal(agile.getKind(), 'agile', 'Le Coureur conserve son identité agile');

// Deuxième mort définitive
agile.takeDamage(40);
assert.equal(agile.isAlive(), false);
assert.equal(agile.isThreat(), false, 'La seconde mort du Coureur est définitive');
assert.equal(agileRemains.visible, true, 'Le cadavre définitif reste visible');
game.checkTierCompletion();
assert.equal(game.state, 'respite', 'La vague peut maintenant se terminer');

// Test hasard contrôlé : sans relève si random() >= 0.12
const noRevivalAgile = new Zombie(scene, level, 0, 0, 'agile', () => 0.5);
noRevivalAgile.takeDamage(80);
assert.equal(noRevivalAgile.isAlive(), false);
assert.equal(noRevivalAgile.isThreat(), false, 'Pas de relève si le tirage est au-dessus de 12%');
noRevivalAgile.dispose(scene);

agile.dispose(scene);
disposeAllZombieResources();
console.log('PASS : relève unique standard et agile, animation inverse, cadavre final et fin de vague retardée.');
