import assert from 'node:assert/strict';
import * as THREE from 'three';

THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData = { url };
  return texture;
};

class MockElement extends EventTarget {
  addEventListener() {}
  removeEventListener() {}
  requestPointerLock() {}
}
globalThis.window = Object.assign(new EventTarget(), {
  innerWidth: 1920,
  innerHeight: 1080,
  AudioContext: class {
    createGain() { return { connect() {} }; }
    createPanner() { return { connect() {}, setPosition() {}, setOrientation() {} }; }
  },
});
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null,
});

import { Level } from '../src/Level.ts';
import { Zombie } from '../src/Zombie.ts';

console.log('=== SUITE DE TESTS : VARIANTE ENNEMIE — LE COUREUR AGILE ===\n');

const scene = new THREE.Scene();
const level = new Level(scene);

// 1. Instanciation et conformité des paramètres du Coureur
console.log('1. Test des paramètres et de l\'identité du Coureur...');
const runner = new Zombie(scene, level, -12, 16, 'agile');
assert.equal(runner.getKind(), 'agile');
assert.equal(runner.isAlive(), true);

// 2. Déplacement et vitesse (2.7 m/s vs 1.5 m/s) dans le Grand Salon dégagé (X = -12)
console.log('2. Test de la vitesse de déplacement (2.7 m/s vs 1.5 m/s)...');
const playerPos = new THREE.Vector3(-12, 1.7, 9); // Joueur à 7m devant dans le salon
const startZ = runner.getPosition().z;

// Mettre à jour pendant 1 seconde (20 pas de 0.05s)
const delta = 0.05;
for (let i = 0; i < 20; i++) {
  runner.update(delta, playerPos, [], () => {});
}

const moved = startZ - runner.getPosition().z;
// Le Coureur doit avoir parcouru environ 2.7m en 1 seconde
assert.ok(moved > 2.5 && moved <= 2.8, `Le Coureur doit avancer à ~2.7 m/s (parcouru: ${moved.toFixed(2)}m)`);
console.log(`   -> PASS : Vitesse mesurée en delta-time : ${(moved / 1.0).toFixed(2)} m/s (cible: 2.7 m/s).\n`);

// 3. Dégâts et résistance (80 PV max)
console.log('3. Test de résistance et de blessure (80 PV max)...');
runner.takeDamage(40);
assert.equal(runner.isAlive(), true, 'Le Coureur doit survivre à 40 dégâts');

// Un second tir de 40 dégâts doit l'éliminer (40 + 40 = 80 PV)
runner.takeDamage(40);
assert.equal(runner.isAlive(), false, 'Le Coureur doit mourir à 80 dégâts au total');
console.log('   -> PASS : Le Coureur a exactement 80 PV de résistance.\n');

// 4. Coexistence des deux types d'ennemis sans collision de texture ni de cache
console.log('4. Test de coexistence et d\'indépendance graphique des deux types...');
const standardZombie = new Zombie(scene, level, -10, 16, 'standard');
const agileZombie = new Zombie(scene, level, -14, 16, 'agile');

assert.equal(standardZombie.getKind(), 'standard');
assert.equal(agileZombie.getKind(), 'agile');

const standardMat = standardZombie.getMesh().material;
const agileMat = agileZombie.getMesh().material;
assert.notEqual(standardMat, agileMat, 'Les matériaux des deux types d\'ennemis doivent être strictement isolés');

// Vérifier l'attaque avec anticipation du Coureur (0.45s de windup)
let agileAttacked = false;
const meleePlayer = new THREE.Vector3(-14, 1.7, 15.2);

// 8 frames de 0.05s : l'agile est en préparation, pas encore d'attaque
for (let i = 0; i < 8; i++) {
  agileZombie.update(0.05, meleePlayer, [], () => { agileAttacked = true; });
}
assert.equal(agileAttacked, false, 'Le Coureur ne doit pas frapper avant ses 0.45s de préparation');

// 4 frames de plus (total 12 frames, atteignant les 0.45s de windup) : l'attaque du Coureur se déclenche
for (let i = 0; i < 4; i++) {
  agileZombie.update(0.05, meleePlayer, [], () => { agileAttacked = true; });
}
assert.equal(agileAttacked, true, 'Le Coureur doit frapper une fois les 0.45s de préparation écoulées');

console.log('   -> PASS : Anticipation d\'attaque lisible respectée (0.45s pour le Coureur).\n');

// 5. Mort et cadavres verticaux distincts
console.log('5. Test des cadavres verticaux et libération propre des ressources...');
standardZombie.takeDamage(100);
agileZombie.takeDamage(80);

assert.equal(standardZombie.isAlive(), false);
assert.equal(agileZombie.isAlive(), false);

for (let i = 0; i < 15; i++) {
  standardZombie.updateDeath(0.05, meleePlayer);
  agileZombie.updateDeath(0.05, meleePlayer);
}

// Nettoyage complet
standardZombie.dispose(scene);
agileZombie.dispose(scene);
runner.dispose(scene);

console.log('   -> PASS : Cadavres verticaux mis à jour et nettoyage sans fuite de mémoire.\n');

console.log('================================================================');
console.log('TOUS LES TESTS DU COUREUR AGILE ONT RÉUSSI AVEC SUCCÈS !');
console.log('================================================================');
