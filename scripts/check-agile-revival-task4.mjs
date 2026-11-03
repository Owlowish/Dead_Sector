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

const { Zombie, disposeAllZombieResources } = await import('../src/Zombie.ts');
const { ZombieRemains } = await import('../src/ZombieRemains.ts');
const { Game } = await import('../src/Game.ts');

console.log('=== VÉRIFICATION EXHAUSTIVE DE LA RELÈVE DES COUREURS (TÂCHE 4) ===\n');

const scene = new THREE.Scene();
const level = {
  getFloorHeightAt: () => 0,
  getSolidMeshes: () => [],
  isColliding: () => false,
  findNextWaypoint: (_f, to) => to,
};

ZombieRemains.warmup();
Zombie.warmup();

// 1. Hasard contrôlé : pas de relève si tirage >= 0.12
console.log('1. Test absence de relève (tirage >= 12%)...');
{
  const noRevive = new Zombie(scene, level, 0, 0, 'agile', () => 0.25);
  noRevive.takeDamage(80);
  assert.equal(noRevive.isAlive(), false);
  assert.equal(noRevive.isThreat(), false, 'Mort directe sans relève');
  noRevive.dispose(scene);
  console.log('   -> PASS : Tirage >= 12% ne déclenche aucune relève.');
}

// 2. Relève agile complète (tirage < 0.12)
console.log('2. Test relève complète du Coureur (délai 2s, 40 PV, animation, pose agile)...');
{
  const agile = new Zombie(scene, level, 0, 0, 'agile', () => 0.05);
  agile.takeDamage(80);
  assert.equal(agile.isAlive(), false);
  assert.equal(agile.isThreat(), true, 'Compte comme menace active pendant l\'attente au sol');

  const game = Object.create(Game.prototype);
  Object.assign(game, { state: 'playing', spawnQueue: 0, zombies: [agile], enterRespite() { this.state = 'respite'; } });
  game.checkTierCompletion();
  assert.equal(game.state, 'playing', 'La vague ne se termine pas tant que le Coureur peut se relever');

  // Avancer pendant le délai au sol (1.5s / 2.0s)
  for (let i = 0; i < 30; i++) agile.updateDeath(0.05, new THREE.Vector3(0, 1.7, 5));
  assert.equal(agile.isAlive(), false, 'Toujours au sol');
  assert.equal(agile.isThreat(), true);

  // Terminer le délai de 2.0s et jouer l'animation inverse
  for (let i = 0; i < 60; i++) agile.updateDeath(0.05, new THREE.Vector3(0, 1.7, 5));

  assert.equal(agile.isAlive(), true, 'Le Coureur est désormais debout et vivant');
  assert.equal(agile.health, 40, 'PV restaurés à 40 (moitié des 80 initiaux)');
  assert.equal(agile.getKind(), 'agile');
  assert.equal(agile.getMesh().visible, true);
  assert.equal(agile.remains.mesh.visible, false, 'Le cadavre temporaire est masqué');
  assert.equal(agile.getState(), 'SEARCH');

  // Deuxième mort définitive
  agile.takeDamage(40);
  assert.equal(agile.isAlive(), false);
  assert.equal(agile.isThreat(), false, 'Seconde mort rigoureusement définitive');
  game.checkTierCompletion();
  assert.equal(game.state, 'respite', 'Fin de vague autorisée après la seconde mort définitive');
  agile.dispose(scene);
  console.log('   -> PASS : Relève agile, 40 PV, animation inverse et 2nde mort définitive conformes.');
}

// 3. Annulation propre au changement de palier / dispose
console.log('3. Test annulation au changement de palier (dispose pendant l\'attente au sol)...');
{
  const agile = new Zombie(scene, level, 0, 0, 'agile', () => 0.05);
  agile.takeDamage(80);
  assert.equal(agile.isThreat(), true);
  // Simuler le nettoyage de fin/début de palier
  agile.dispose(scene);
  assert.equal(agile.isThreat(), false, 'Dispose annule la menace en attente');
  assert.equal(agile.remains.mesh.visible, false);
  console.log('   -> PASS : Dispose nettoie intégralement l\'état de relève.');
}

// 4. Succession de plusieurs Coureurs indépendants
console.log('4. Test succession de plusieurs Coureurs avec relèves indépendantes...');
{
  const a1 = new Zombie(scene, level, 2, 0, 'agile', () => 0.05); // relève
  const a2 = new Zombie(scene, level, -2, 0, 'agile', () => 0.50); // pas de relève
  const a3 = new Zombie(scene, level, 0, 2, 'agile', () => 0.02); // relève

  a1.takeDamage(80);
  a2.takeDamage(80);
  a3.takeDamage(80);

  assert.equal(a1.isThreat(), true);
  assert.equal(a2.isThreat(), false);
  assert.equal(a3.isThreat(), true);

  for (let i = 0; i < 90; i++) {
    a1.updateDeath(0.05, new THREE.Vector3(0, 1.7, 5));
    a2.updateDeath(0.05, new THREE.Vector3(0, 1.7, 5));
    a3.updateDeath(0.05, new THREE.Vector3(0, 1.7, 5));
  }

  assert.equal(a1.isAlive(), true);
  assert.equal(a2.isAlive(), false);
  assert.equal(a3.isAlive(), true);

  a1.dispose(scene);
  a2.dispose(scene);
  a3.dispose(scene);
  console.log('   -> PASS : Multiples Coureurs gérés indépendamment avec ressources partagées.');
}

disposeAllZombieResources();
console.log('\n=============================================================');
console.log('TOUTES LES VALIDATIONS DE LA TÂCHE 4 ONT RÉUSSI (100%)');
console.log('=============================================================\n');
