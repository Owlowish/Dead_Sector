import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

// Résolution automatique des imports sans extension .ts pour Node.js
registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? specifier + '.ts' : specifier, context);
  }
});

// Patch TextureLoader pour exécution Node headless
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData = { url };
  return texture;
};

class MockElement extends EventTarget {
  textContent = '';
  style = {};
  hidden = false;
  classList = {
    toggle() {},
  };
  addEventListener() {}
  removeEventListener() {}
  requestPointerLock() {}
}

globalThis.window = Object.assign(new EventTarget(), {
  innerWidth: 1920,
  innerHeight: 1080,
  location: { reload() {} },
  AudioContext: class {
    createGain() { return { connect() {} }; }
    createPanner() { return { connect() {}, setPosition() {}, setOrientation() {} }; }
  },
});

globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null,
  querySelector: () => new MockElement(),
  querySelectorAll: () => [new MockElement()],
  body: { appendChild() {} },
  createElement: () => new MockElement(),
  createElementNS: () => new MockElement(),
});

globalThis.Audio = class {
  volume = 1;
  play() { return Promise.resolve(); }
  catch() {}
};

import { ENCOUNTER_CONFIGS } from '../src/EncounterConfig.ts';
import { EncounterBell } from '../src/EncounterBell.ts';
import { Level } from '../src/Level.ts';
const { Game } = await import('../src/Game.ts');

console.log('=== SUITE DE TESTS COMPORTEMENTAUX : RENCONTRES & PROGRESSION F1 ===\n');

// ============================================================================
// ÉPREUVE 1 : CONFIGURATION DÉCOUPLÉE RENCONTRES VS SECTEURS
// ============================================================================
console.log('1. Test de la table des rencontres (EncounterConfig)...');

assert.ok(ENCOUNTER_CONFIGS.length >= 4, 'La configuration des rencontres doit comporter au moins 4 rencontres');

const [enc1, enc2, enc3, enc4] = ENCOUNTER_CONFIGS;

// Rencontre 1
assert.equal(enc1.tierNumber, 1);
assert.equal(enc1.unlockSectorTier, 1, 'Palier 1 déverrouille le Grand Hall Nord');
assert.equal(enc1.maxAgile, 0, 'Palier 1 ne comporte aucun agile (apprentissage standard)');

// Rencontre 2
assert.equal(enc2.tierNumber, 2);
assert.equal(enc2.unlockSectorTier, 2, 'Palier 2 déverrouille les accès au plateau haut (+2.4m)');
assert.equal(enc2.maxAgile, 2, 'Palier 2 introduit 2 coureurs agiles');
assert.equal(enc2.maxSimultaneousAgile, 1, 'Au plus 1 coureur simultané au Palier 2');

// Rencontre 3
assert.equal(enc3.tierNumber, 3);
assert.equal(enc3.unlockSectorTier, null, 'Palier 3 n\'a pas de nouveau secteur : tout le manoir est ouvert');
assert.equal(enc3.maxAgile, 3, 'Palier 3 comporte 3 coureurs agiles');
assert.equal(enc3.maxSimultaneousAgile, 2, 'Au plus 2 coureurs simultanés au Palier 3');

// Rencontre 4 (Validation F1)
assert.equal(enc4.tierNumber, 4);
assert.equal(enc4.unlockSectorTier, null, 'Palier 4 se déroule dans le manoir déjà intégralement ouvert');
assert.equal(enc4.activationType, 'arena_signal', 'Palier 4 est déclenché par signal / carillon d\'arène');
assert.equal(enc4.totalZombies, 4, 'Palier 4 est un cas court et intense de 4 ennemis');
assert.equal(enc4.maxAgile, 2, 'Palier 4 comporte 2 coureurs agiles');

console.log('   -> PASS : Configuration des 4 rencontres découplée et conforme.\n');

// ============================================================================
// ÉPREUVE 2 : LE DISPOSITIF D\'ACTIVATION DANS LE MONDE (EncounterBell)
// ============================================================================
console.log('2. Test du dispositif d\'activation volontaire (EncounterBell)...');

const scene = new THREE.Scene();
const level = new Level(scene);
const bellFloorY = level.getFloorHeightAt(0, 2.5);
const bell = new EncounterBell(scene, 0, 2.5, bellFloorY);

assert.equal(bell.isActive(), false, 'Le carillon doit être inactif au démarrage');

// Joueur à proximité orienté vers le carillon
const playerNearPos = new THREE.Vector3(0, 1.7, 4.0); // à 1.5m du carillon
const cameraFacingBell = new THREE.Vector3(0, 0, -1); // regarde vers le Nord (carillon à z=2.5)

assert.equal(bell.canInteract(playerNearPos, cameraFacingBell), false, 'Interaction refusée car carillon inactif');

// Activation pendant l'accalmie
bell.setActive(true);
assert.equal(bell.isActive(), true, 'Le carillon est désormais actif');
assert.equal(bell.canInteract(playerNearPos, cameraFacingBell), true, 'Interaction possible en face à 1.5m');

// Joueur trop loin
const playerFarPos = new THREE.Vector3(0, 1.7, 10.0);
assert.equal(bell.canInteract(playerFarPos, cameraFacingBell), false, 'Interaction refusée à distance > 2.8m');

// Joueur tournant le dos au carillon
const cameraFacingAway = new THREE.Vector3(0, 0, 1);
assert.equal(bell.canInteract(playerNearPos, cameraFacingAway), false, 'Interaction refusée quand le joueur ne regarde pas le carillon');

// Déclenchement
bell.trigger();
assert.equal(bell.isActive(), false, 'Après déclenchement, le carillon redevient immédiatement inactif');
assert.equal(bell.canInteract(playerNearPos, cameraFacingBell), false, 'Anti-rebond : interaction impossible après déclenchement');

console.log('   -> PASS : Détection 3D, orientation, activation et anti-rebond validés.\n');

// ============================================================================
// ÉPREUVE 3 : CYCLE DE PROGRESSION COMPLET DE JEU (PALIERS 1 -> 2 -> 3 -> 4 -> VICTOIRE)
// ============================================================================
console.log('3. Test du cycle de progression complet (Game) : Paliers 1 à 4...');

const gameScene = new THREE.Scene();
const gameLevel = new Level(gameScene);
const gameBell = new EncounterBell(gameScene, 0, 2.5, gameLevel.getFloorHeightAt(0, 2.5));
const objDisplay = new MockElement();

const game = Object.create(Game.prototype);
Object.assign(game, {
  scene: gameScene,
  level: gameLevel,
  encounterBell: gameBell,
  encounterConfigs: ENCOUNTER_CONFIGS.slice(0, 4),
  currentTier: 1,
  pendingTierStart: 0,
  spawnQueue: 0,
  spawnCooldownTimer: 0,
  tierAgileSpawned: 0,
  maxSimultaneousZombies: 4,
  state: 'playing',
  zombies: [],
  medkits: [],
  ammoBoxes: [],
  objectiveDisplay: objDisplay,
  player: {
    camera: {
      position: new THREE.Vector3(8, 1.7, 16),
      getWorldDirection: () => new THREE.Vector3(0, 0, -1),
    },
  },
  perfTracker: { recordTransition() {}, recordSpawn() {}, recordPathfinding() {} },
  weapon: { setTargets() {} },
  endGame(result) {
    this.state = result;
    if (this.objectiveDisplay) {
      this.objectiveDisplay.textContent = result === 'won'
        ? 'PROTOTYPE PURGÉ — LES 4 RENCONTRES ONT ÉTÉ ÉLIMINÉES'
        : 'MISSION ÉCHOUÉE';
    }
  },
});
game.startTier(1);

// 3.1 Vérifier le Palier 1
assert.equal(game['currentTier'], 1, 'Départ au Palier 1');
assert.equal(game['state'], 'playing', 'Le jeu commence en état playing');
assert.equal(game['spawnQueue'], 4, 'File de 4 zombies au Palier 1');

// Portes initiales : Grand Hall et Bibliothèque verrouillées
const doors = game['level'].getDoors();
const hallDoor = doors.find((d) => d.getName() === 'Grand Hall Nord');
const libDoor = doors.find((d) => d.getName() === 'Escalier de la Bibliothèque');

assert.equal(hallDoor.isLocked(), true, 'Porte Grand Hall verrouillée au Palier 1');
assert.equal(libDoor.isLocked(), true, 'Porte Bibliothèque verrouillée au Palier 1');

// Simuler la purge du Palier 1
game['zombies'] = [];
game['spawnQueue'] = 0;
game['checkTierCompletion']();

assert.equal(game['state'], 'exploration', 'Le jeu passe en exploration après le Palier 1');
assert.equal(game['pendingTierStart'], 2, 'Palier 2 en attente de démarrage');
assert.equal(hallDoor.isLocked(), false, 'Porte Grand Hall déverrouillée');
assert.equal(libDoor.isLocked(), true, 'Porte Bibliothèque toujours verrouillée');

// 3.2 Lancer le Palier 2 (déclenchement immersif par la porte)
game['launchPendingTier']();
assert.equal(game['currentTier'], 2, 'Passage au Palier 2');
assert.equal(game['state'], 'playing');
assert.equal(game['pendingTierStart'], 0);
assert.equal(game['spawnQueue'] + game['zombies'].length, 5, 'Total de 5 menaces au Palier 2');

// Simuler la purge du Palier 2
for (const z of game['zombies']) z.dispose(game['scene']);
game['zombies'] = [];
game['spawnQueue'] = 0;
game['checkTierCompletion']();

assert.equal(game['state'], 'exploration');
assert.equal(game['pendingTierStart'], 3, 'Palier 3 en attente');
assert.equal(libDoor.isLocked(), false, 'Porte Bibliothèque déverrouillée');

// 3.3 Lancer le Palier 3
game['launchPendingTier']();
assert.equal(game['currentTier'], 3, 'Passage au Palier 3');
assert.equal(game['state'], 'playing');
assert.equal(game['spawnQueue'] + game['zombies'].length, 6, 'Total de 6 menaces au Palier 3');

// Simuler la purge du Palier 3 (IMPORTANT : AUCUNE VICTOIRE PRÉMATURÉE !)
for (const z of game['zombies']) z.dispose(game['scene']);
game['zombies'] = [];
game['spawnQueue'] = 0;
game['checkTierCompletion']();

assert.notEqual(game['state'], 'won', 'NE DOIT PAS déclencher la victoire après le Palier 3 !');
assert.equal(game['state'], 'exploration', 'Doit passer en exploration sécurisée pour préparer la rencontre 4');
assert.equal(game['pendingTierStart'], 4, 'Palier 4 en attente');
assert.equal(game['encounterBell'].isActive(), true, 'Le carillon d\'arène doit être activé dans le Grand Hall');

// 3.4 Lancer le Palier 4 via le carillon d\'arène
game['encounterBell'].trigger();
game['launchPendingTier']();

assert.equal(game['currentTier'], 4, 'Passage au Palier 4 (Manoir Ouvert)');
assert.equal(game['state'], 'playing');
assert.equal(game['pendingTierStart'], 0);
assert.equal(game['encounterBell'].isActive(), false, 'Le carillon est redevenu inactif pendant le combat');

// Les portes ouvertes aux paliers 1 et 2 DOIVENT RESTER OUVERTES au Palier 4 !
assert.equal(hallDoor.isLocked(), false, 'La porte du Grand Hall reste déverrouillée au Palier 4');
assert.equal(libDoor.isLocked(), false, 'La porte de la Bibliothèque reste déverrouillée au Palier 4');

// File d'attente du Palier 4
assert.equal(game['spawnQueue'], 4, '4 zombies prévus pour la patrouille combinée du Palier 4');

// 3.5 Purge du Palier 4 -> Fin explicite du prototype !
for (const z of game['zombies']) z.dispose(game['scene']);
game['zombies'] = [];
game['spawnQueue'] = 0;
game['checkTierCompletion']();

assert.equal(game['state'], 'terminal', 'Le prototype reste explorable à la fin de sa table de rencontres');
assert.match(game['objectiveDisplay'].textContent, /7 RENCONTRES PURGÉES/i);
assert.match(game['objectiveDisplay'].textContent, /FINALE F6 À VENIR/i);

console.log('   -> PASS : Cycle complet 1->2->3->4->Exploration terminale validé.\n');

// ============================================================================
// ÉPREUVE 4 : SÉCURITÉ ET DISPERSION DES APPARITIONS DU PALIER 4
// ============================================================================
console.log('4. Test de légalité du pool de spawn du Palier 4 (Manoir Ouvert)...');

assert.ok(enc4.spawnPool.length >= 10, 'Le pool du Palier 4 doit comporter au moins 10 points candidats');

for (const pt of enc4.spawnPool) {
  // 1. Hors collision de décor
  assert.equal(level.isColliding(pt.x, pt.z, 0.45), false, `Spawn (${pt.x}, ${pt.z}) doit être libre de collision`);

  // 2. Dans les limites du manoir
  assert.ok(pt.x >= enc4.sectorBounds.minX && pt.x <= enc4.sectorBounds.maxX);
  assert.ok(pt.z >= enc4.sectorBounds.minZ && pt.z <= enc4.sectorBounds.maxZ);
}

// Vérifier la présence de points dans les 3 secteurs
const sector1Spawns = enc4.spawnPool.filter((p) => p.z >= 6.0);
const sector2Spawns = enc4.spawnPool.filter((p) => p.z >= -6.0 && p.z < 6.0);
const sector3Spawns = enc4.spawnPool.filter((p) => p.z < -6.0);

assert.ok(sector1Spawns.length >= 3, 'Doit comporter des points dans le Secteur 1');
assert.ok(sector2Spawns.length >= 2, 'Doit comporter des points dans le Secteur 2');
assert.ok(sector3Spawns.length >= 2, 'Doit comporter des points dans le Secteur 3');

console.log('   -> PASS : Points de spawn légaux, dispersés sur l\'ensemble des 3 secteurs du manoir.\n');

// Nettoyage final
game.dispose();

console.log('================================================================');
console.log('TOUTES LES VALIDATIONS DE PROGRESSION F1 ONT RÉUSSI AVEC SUCCÈS !');
console.log('================================================================');
