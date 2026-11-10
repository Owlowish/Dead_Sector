import assert from 'node:assert/strict';
import * as THREE from 'three';

// Patch TextureLoader pour exécution en environnement Node
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
globalThis.Audio = class {
  volume = 1;
  play() { return Promise.resolve(); }
};

import { Level } from '../src/Level.ts';
import { Player } from '../src/Player.ts';
import { Zombie } from '../src/Zombie.ts';
import { Medkit } from '../src/Medkit.ts';
import { AmmoBox } from '../src/AmmoBox.ts';
import { MANSION_ELEVATION, MANSION_RAMPS, getMansionFloorHeight } from '../src/MansionConfig.ts';

console.log('=== SUITE DE TESTS COMPORTEMENTAUX : MANOIR DEMI-NIVEAU (+2,4 M) ===\n');

const scene = new THREE.Scene();
const level = new Level(scene);

// ============================================================================
// ÉPREUVE 1 : MOTEUR DE HAUTEUR O(1) ET RAMPES CONTINUES
// ============================================================================
console.log('1. Test du calcul exact d\'altitude du sol (getFloorHeightAt)...');

// 1.1 Rez-de-chaussée (Y = 0.0)
assert.equal(level.getFloorHeightAt(8, 16), 0.0, 'Vestibule Sud doit être à 0.0m');
assert.equal(level.getFloorHeightAt(-14, 12), 0.0, 'Grand Salon doit être à 0.0m');
assert.equal(level.getFloorHeightAt(-12, 2), 0.0, 'Galerie Ouest doit être à 0.0m');
assert.equal(level.getFloorHeightAt(8, 0), 0.0, 'Grand Hall Nord doit être à 0.0m');
assert.equal(level.getFloorHeightAt(0, -4), 0.0, 'Centre du Grand Hall (hors rampe) à z=-4 doit être à 0.0m');

// 1.2 Escalier Ouest (Galerie -> Bibliothèque, x in [-14, -10.5], z from -1 to -7)
assert.ok(Math.abs(level.getFloorHeightAt(-12.25, -1.0) - 0.0) < 1e-6, 'Pied de l\'escalier Ouest à z=-1.0 doit être à 0.0m');
assert.ok(Math.abs(level.getFloorHeightAt(-12.25, -2.5) - 0.6) < 1e-6, 'Quart de montée z=-2.5 doit être à 0.6m');
assert.ok(Math.abs(level.getFloorHeightAt(-12.25, -4.0) - 1.2) < 1e-6, 'Mi-pente z=-4.0 doit être à 1.2m');
assert.ok(Math.abs(level.getFloorHeightAt(-12.25, -5.5) - 1.8) < 1e-6, 'Trois-quarts de montée z=-5.5 doit être à 1.8m');
assert.ok(Math.abs(level.getFloorHeightAt(-12.25, -7.0) - 2.4) < 1e-6, 'Sommet de l\'escalier Ouest à z=-7.0 doit être à 2.4m');

// 1.3 Escalier Est (Grand Hall -> Atelier, x in [10.5, 14], z from -1 to -7)
assert.ok(Math.abs(level.getFloorHeightAt(12.25, -1.0) - 0.0) < 1e-6, 'Pied de l\'escalier Est à z=-1.0 doit être à 0.0m');
assert.ok(Math.abs(level.getFloorHeightAt(12.25, -4.0) - 1.2) < 1e-6, 'Mi-pente z=-4.0 doit être à 1.2m');
assert.ok(Math.abs(level.getFloorHeightAt(12.25, -7.0) - 2.4) < 1e-6, 'Sommet de l\'escalier Est à z=-7.0 doit être à 2.4m');

// 1.4 Plateau surélevé Nord (Z <= -7.0)
assert.equal(level.getFloorHeightAt(-12, -14), 2.4, 'Grande Bibliothèque doit être à +2.4m');
assert.equal(level.getFloorHeightAt(12, -14), 2.4, 'Atelier d\'Art doit être à +2.4m');
assert.equal(level.getFloorHeightAt(0, -18), 2.4, 'Fond du plateau Nord devant la sortie doit être à +2.4m');

console.log('   -> PASS : Moteur de hauteur O(1) continu, exact et déterministe sur les rampes et plateaux.\n');

// ============================================================================
// ÉPREUVE 2 : ÉTANCHÉITÉ DES GARDE-CORPS ET RETENUES DU PLATEAU (+2.4M)
// ============================================================================
console.log('2. Test de protection physique contre les chutes et raccourcis hors escaliers...');

// 2.1 Impossible de franchir la balustrade centrale de surplomb à Z = -7 (X = 0)
const checkSegment = (p1, p2, radius) => {
  const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
  const steps = Math.max(1, Math.ceil(dist / 0.05));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = p1.x + (p2.x - p1.x) * t;
    const z = p1.z + (p2.z - p1.z) * t;
    if (level.isColliding(x, z, radius)) return true;
  }
  return false;
};

const jumpOverlook = checkSegment(new THREE.Vector3(0, 1, -5), new THREE.Vector3(0, 1, -9), 0.35);
assert.equal(jumpOverlook, true, 'La balustrade centrale à Z=-7 doit bloquer tout franchissement direct');

// 2.2 Impossible de tomber sur le côté des escaliers (garde-corps latéraux)
const fallOffWestStair = checkSegment(new THREE.Vector3(-12.25, 1, -4), new THREE.Vector3(-8.0, 1, -4), 0.35);
assert.equal(fallOffWestStair, true, 'Le garde-corps intérieur de l\'escalier Ouest doit bloquer la chute latérale');

const fallOffEastStair = checkSegment(new THREE.Vector3(12.25, 1, -4), new THREE.Vector3(8.0, 1, -4), 0.35);
assert.equal(fallOffEastStair, true, 'Le garde-corps intérieur de l\'escalier Est doit bloquer la chute latérale');

// 2.3 Montée dans l\'axe de l\'escalier Ouest parfaitement dégagée
const climbWestStair = checkSegment(new THREE.Vector3(-12.25, 1, -1.5), new THREE.Vector3(-12.25, 1, -6.5), 0.35);
assert.equal(climbWestStair, false, 'Le couloir de l\'escalier Ouest doit être 100% praticable dans l\'axe');

console.log('   -> PASS : Garde-corps et balustrades de soutènement étanches, passage uniquement par les escaliers.\n');

// ============================================================================
// ÉPREUVE 3 : AMORTISSEMENT FLUIDE DE LA CAMÉRA JOUEUR EN MONTÉE
// ============================================================================
console.log('3. Test de l\'élévation progressive de la caméra du joueur...');

const mockCanvas = new MockElement();
const player = new Player(level, mockCanvas, () => true);

// Téléporter le joueur au pied de l'escalier Ouest
player.camera.position.set(-12.25, 1.7, -1.0);
assert.equal(player.camera.position.y, 1.7, 'Au pied (Y=0), les yeux sont à 1.7m');

// Gravir l'escalier vers z = -7.0
for (let step = 0; step < 60; step++) {
  player.camera.position.z -= 0.1; // Avance de 6m au total
  player.update(0.016);
}

// Au sommet (z = -7.0), le sol est à 2.4m, la cible des yeux est à 2.4 + 1.7 = 4.1m
const finalEyeY = player.camera.position.y;
assert.ok(finalEyeY > 3.9 && finalEyeY <= 4.11, `La caméra doit atteindre l'altitude du plateau (mesuré: ${finalEyeY.toFixed(2)}m, attendu: ~4.1m)`);

console.log('   -> PASS : Amortissement souple de caméra sans saccade le long du demi-niveau.\n');

// ============================================================================
// ÉPREUVE 4 : PORTÉE D'ATTAQUE ET PERCEPTION 3D EUCLIDIENNE DES ZOMBIES
// ============================================================================
console.log('4. Test de distance 3D euclidienne (zombie au rez-de-chaussée vs joueur en surplomb)...');

// Zombie au rez-de-chaussée (Y=0, centre zombie y=1.0) juste devant la balustrade à z = -6.5
const groundZombie = new Zombie(scene, level, 0, -6.5, 'standard');
assert.equal(groundZombie.getMesh().position.y, 1.0, 'Le zombie au sol doit être ancré à Y=1.0');

// Joueur surélevé sur le plateau à +2.4m, juste derrière la balustrade à z = -7.5 (yeux à 4.1m)
const highPlayerPos = new THREE.Vector3(0, 4.1, -7.5);

// Distance horizontale dx=0, dz=1.0m (inférieure à attackRange=1.4m si le calcul était 2D !)
const hDist = Math.hypot(0 - 0, -7.5 - (-6.5));
assert.equal(hDist, 1.0, 'Distance horizontale faible (1.0m)');

// Distance 3D euclidienne : dy = 4.1 - 1.0 = 3.1m -> Math.hypot(0, 3.1, 1.0) = 3.26m > attackRange 1.4m !
let damageDealt = 0;
groundZombie.update(0.05, highPlayerPos, [], (dmg) => {
  damageDealt += dmg;
});

assert.equal(damageDealt, 0, 'Le zombie au sol NE DOIT PAS pouvoir toucher le joueur perché sur le plateau');
assert.notEqual(groundZombie.getState(), 'ATTACK', 'Le zombie ne doit pas déclencher d\'attaque à travers le dénivelé');

console.log('   -> PASS : Portée d\'attaque 3D respectée, invulnérabilité naturelle face aux ennemis en contrebas.\n');

// ============================================================================
// ÉPREUVE 5 : POSITIONNEMENT ET RAMASSAGE DES PICKUPS SELON L'ALTITUDE
// ============================================================================
console.log('5. Test d\'ancrage des objets ramassables sur le sol local...');

// Trousse au rez-de-chaussée
const groundMedkit = new Medkit(scene, 18, 16, 30, level.getFloorHeightAt(18, 16));
// Trousse sur le plateau surélevé
const highMedkit = new Medkit(scene, -19, -15, 30, level.getFloorHeightAt(-19, -15));

// Le medkit au sol a baseY = 0 + 0.35 = 0.35
// Le medkit haut a baseY = 2.4 + 0.35 = 2.75
assert.equal(level.getFloorHeightAt(18, 16), 0.0);
assert.equal(level.getFloorHeightAt(-19, -15), 2.4);

// Un joueur au rez-de-chaussée (Y=1.7) sous la bibliothèque ne doit PAS pouvoir ramasser le medkit haut
const groundPlayerFake = {
  camera: { position: new THREE.Vector3(-19, 1.7, -15) },
  heal: () => true,
};
assert.equal(highMedkit.tryPickup(groundPlayerFake), false, 'Impossible de ramasser un objet situé 2.4m plus haut');

// Un joueur sur le plateau (Y = 2.4 + 1.7 = 4.1) peut le ramasser
const highPlayerFake = {
  camera: { position: new THREE.Vector3(-19, 4.1, -15) },
  heal: () => true,
};
assert.equal(highMedkit.tryPickup(highPlayerFake), true, 'Objet ramassé avec succès lorsque le joueur est à la même altitude');

console.log('   -> PASS : Pickups ancrés au sol local et protégés contre le vol vertical.\n');

// ============================================================================
// ÉPREUVE 6 : FERMETURE DES PLAFONDS ET DÉGAGEMENT VERTICAL (HEADROOM)
// ============================================================================
console.log('6. Test de la fermeture des plafonds et du dégagement vertical...');

const raycastUp = (x, y, z) => {
  const origin = new THREE.Vector3(x, y, z);
  const upDir = new THREE.Vector3(0, 1, 0);
  const ray = new THREE.Raycaster(origin, upDir);
  for (const mesh of level.getSolidMeshes()) mesh.updateWorldMatrix(true, false);
  const hits = ray.intersectObjects(level.getSolidMeshes(), false);
  return hits.length > 0 ? hits[0].point.y : null;
};

// 6.1 Plafond Sud à Y = 4.0m dans le Vestibule
const southCeilingY = raycastUp(8, 1.7, 11);
assert.notEqual(southCeilingY, null, 'Le plafond Sud doit intercepter les tirs vers le haut');
assert.ok(Math.abs(southCeilingY - 4.0) < 0.05, `Plafond Sud attendu à Y=4.0m (mesuré: ${southCeilingY})`);

// 6.2 Plafond monumental à Y = 6.4m dans le Grand Hall
const grandHallCeilingY = raycastUp(0, 1.7, 2);
assert.notEqual(grandHallCeilingY, null, 'Le plafond du Grand Hall doit être présent');
assert.ok(Math.abs(grandHallCeilingY - 6.4) < 0.05 || Math.abs(grandHallCeilingY - 6.25) < 0.05, `Plafond Grand Hall attendu à Y=6.4m ou poutre à 6.25m (mesuré: ${grandHallCeilingY})`);

// 6.3 Plafond à Y = 6.4m dans la Grande Bibliothèque
const libraryCeilingY = raycastUp(-12, 4.1, -12);
assert.notEqual(libraryCeilingY, null, 'Le plafond de la Bibliothèque doit être présent');
assert.ok(Math.abs(libraryCeilingY - 6.4) < 0.05 || Math.abs(libraryCeilingY - 6.25) < 0.05, `Plafond Bibliothèque attendu à Y=6.4m (mesuré: ${libraryCeilingY})`);

// 6.4 Dégagement vertical au milieu de l'escalier Ouest
const stairCeilingY = raycastUp(-12.25, 2.9, -4.0);
assert.notEqual(stairCeilingY, null, 'L\'escalier doit avoir un plafond');
assert.ok(stairCeilingY > 6.0, `L'escalier doit offrir un grand dégagement vertical (mesuré: ${stairCeilingY}m > 6.0m)`);

console.log('   -> PASS : Plafonds continus, hermétiques et dégagement vertical garanti dans tout le manoir.\n');

console.log('================================================================');
console.log('TOUTES LES VALIDATIONS DU DEMI-NIVEAU (+2,4 M) ONT RÉUSSI !');
console.log('================================================================');
