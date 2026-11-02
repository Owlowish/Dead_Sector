import assert from 'node:assert/strict';
import * as THREE from 'three';

THREE.TextureLoader.prototype.load = function () {
  return new THREE.Texture();
};

import { Level } from '../src/Level.ts';
import { MANSION_WAYPOINTS } from '../src/MansionConfig.ts';

console.log('=== SUITE DE TESTS : NAVIGATION RÉUTILISABLE & RÈGLES PHYSIQUES ===\n');

const scene = new THREE.Scene();
const level = new Level(scene);

// 1. Test des deux escaliers monumentaux (Ouest et Est)
console.log('1. Test de navigabilité des deux escaliers (Ouest & Est)...');
// Escalier Ouest : pied (-12.25, 1.0, 0.5) vers palier haut (-12.25, 3.4, -9.5)
// Noter que la porte de l'escalier Ouest est initialement fermée/verrouillée (Palier 3)
// Déverrouillons et ouvrons la porte de la bibliothèque pour tester l'escalier Ouest
const libraryDoor = level.getDoors().find((d) => d.getName().includes('Bibliothèque'));
assert.ok(libraryDoor, 'La porte de la bibliothèque doit exister');

// Porte fermée : le chemin vers le haut doit être NULL
const westFoot = new THREE.Vector3(-12.25, 1.0, 0.5);
const westTop = new THREE.Vector3(-12.25, 3.4, -9.5);
const pathBlocked = level.findNextWaypoint(westFoot, westTop, 0.4);
assert.equal(pathBlocked, null, 'Escalier Ouest bloqué tant que la porte est fermée');

// Déverrouiller et ouvrir la porte
libraryDoor.unlock();
libraryDoor.toggle();
libraryDoor.update(5.0, []); // Ouverture complète -> état 'OPEN'
assert.equal(libraryDoor.getState(), 'OPEN');

const pathOpenWest = level.findNextWaypoint(westFoot, westTop, 0.4);
assert.notEqual(pathOpenWest, null, 'Chemin praticable trouvé via l\'escalier Ouest une fois la porte ouverte');
console.log('   -> PASS : Escalier Ouest navigable avec altitude correcte.\n');

// Escalier Est : test analogue avec la porte de l'atelier
console.log('2. Test de l\'escalier Est et état des portes en mouvement...');
const workshopDoor = level.getDoors().find((d) => d.getName().includes('Atelier'));
assert.ok(workshopDoor, 'La porte de l\'atelier doit exister');
workshopDoor.unlock();

const eastFoot = new THREE.Vector3(12.25, 1.0, 0.5);
const eastTop = new THREE.Vector3(12.25, 3.4, -9.5);

// Porte déverrouillée mais FERMÉE ('CLOSED') : doit bloquer
assert.equal(workshopDoor.getState(), 'CLOSED');
assert.equal(level.findNextWaypoint(eastFoot, eastTop, 0.4), null, 'Porte déverrouillée mais fermée reste infranchissable');

// Porte EN MOUVEMENT ('OPENING') : doit encore bloquer tant que non complètement ouverte
workshopDoor.toggle();
workshopDoor.update(0.2, []); // Début de rotation, state 'OPENING'
assert.equal(workshopDoor.getState(), 'OPENING');
assert.equal(level.findNextWaypoint(eastFoot, eastTop, 0.4), null, 'Battant en mouvement reste un obstacle physique');

// Porte ENTIÈREMENT OUVERTE ('OPEN')
workshopDoor.update(5.0, []);
assert.equal(workshopDoor.getState(), 'OPEN');
const pathOpenEast = level.findNextWaypoint(eastFoot, eastTop, 0.4);
assert.notEqual(pathOpenEast, null, 'Escalier Est franchissable une fois la porte totalement ouverte');
console.log('   -> PASS : Porte fermée, déverrouillée et en mouvement bloquent rigoureusement.\n');

// 3. Test de non-contournement des garde-corps et balustrades
console.log('3. Test d\'étanchéité des balustrades (aucun raccourci artificiel)...');
// Tentative de passage direct à travers la balustrade centrale de surplomb (X = 0, Z = -7)
const hallCenter = new THREE.Vector3(0, 1.0, -1.0);
const libraryInterior = new THREE.Vector3(0, 3.4, -14.0);
const crossBalustrade = level.isPathClear(hallCenter, libraryInterior, 0.4);
assert.equal(crossBalustrade, false, 'La balustrade centrale de soutènement bloque la ligne directe');

// Le chemin doit obligatoirement contourner par l'un des escaliers ouverts
const detourPath = level.findNextWaypoint(hallCenter, libraryInterior, 0.4);
assert.notEqual(detourPath, null);
// Le premier pas ne doit pas traverser le mur à Z = -7
assert.ok(detourPath.z > -7.0 || detourPath.x > 8 || detourPath.x < -8, 'Le chemin contourne vers les escaliers latéraux');
console.log('   -> PASS : Garde-corps et différences de hauteur étanches, contournement obligatoire.\n');

// 4. Test de temps de réponse CPU du graphe précalculé
console.log('4. Test de rapidité de résolution (budget < 1ms par requête)...');
const t0 = performance.now();
for (let i = 0; i < 50; i++) {
  level.findNextWaypoint(westFoot, westTop, 0.4);
}
const elapsedMs = (performance.now() - t0) / 50;
console.log(`   -> Durée moyenne par recherche Dijkstra : ${elapsedMs.toFixed(3)} ms`);
assert.ok(elapsedMs < 0.5, `La recherche doit prendre < 0.5 ms (mesuré: ${elapsedMs.toFixed(3)} ms)`);
console.log('   -> PASS : Résolution instantanée sur graphe précalculé.\n');

console.log('================================================================');
console.log('TOUS LES TESTS DE NAVIGATION ET RÈGLES PHYSIQUES SONT 100% VALIDES !');
console.log('================================================================');
