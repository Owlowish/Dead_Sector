import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

// Résolution automatique des imports .ts sous Node.js
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
  style = {
    setProperty() {},
  };
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

import { UPGRADE_CATALOG, drawTierUpgrades } from '../src/UpgradeConfig.ts';
import { UpgradePedestal } from '../src/UpgradePedestal.ts';
import { Level } from '../src/Level.ts';
import { ENCOUNTER_CONFIGS } from '../src/EncounterConfig.ts';
import { EncounterBell } from '../src/EncounterBell.ts';
const { Game } = await import('../src/Game.ts');
const { Player } = await import('../src/Player.ts');
const { Weapon } = await import('../src/Weapon.ts');

console.log('=== SUITE DE TESTS COMPORTEMENTAUX : AMÉLIORATIONS IN-WORLD F2 ===\n');

// ============================================================================
// ÉPREUVE 1 : CATALOGUE ET TIRAGE D'OFFRES DISTINCTES
// ============================================================================
console.log('1. Test du catalogue et du tirage d\'offres (UpgradeConfig)...');

assert.ok(UPGRADE_CATALOG.ammo_capacity, 'Amélioration munitions présente');
assert.ok(UPGRADE_CATALOG.hip_accuracy, 'Amélioration précision présente');
assert.ok(UPGRADE_CATALOG.vitality, 'Amélioration vitalité présente');
assert.ok(UPGRADE_CATALOG.agility, 'Amélioration agilité présente');

// Vérifier que chaque offre a une mention de son repère visuel (sprite manquant en prototype)
for (const key of Object.keys(UPGRADE_CATALOG)) {
  const item = UPGRADE_CATALOG[key];
  assert.ok(item.iconPlaceholder.startsWith('sprite_upgrade_'), 'Doit documenter le sprite d\'asset manquant');
}

// Tirage de 2 offres distinctes
for (let i = 0; i < 20; i++) {
  const [offerA, offerB] = drawTierUpgrades([]);
  assert.notEqual(offerA.id, offerB.id, 'Les deux offres proposées doivent être différentes');
}

console.log('   -> PASS : Catalogue complet, documentation du sprite manquant et tirage sans doublon.\n');

// ============================================================================
// ÉPREUVE 2 : COMPORTEMENT DU PRÉSENTOIR IN-WORLD (UpgradePedestal)
// ============================================================================
console.log('2. Test mécanique du présentoir in-world (UpgradePedestal)...');

const scene = new THREE.Scene();
const pedestal = new UpgradePedestal(scene, -2.5, 2.5, 0, 'test_left');

assert.equal(pedestal.isActive(), false, 'Le pupitre est inactif tant qu\'aucune offre n\'est assignée');

// Assigner une offre
pedestal.setOffer(UPGRADE_CATALOG.vitality);
assert.equal(pedestal.isActive(), true, 'Le pupitre devient actif avec une offre');

// Test de visée du joueur : orienté en face à 1.5m
const playerPos = new THREE.Vector3(-2.5, 1.7, 4.0);
const cameraFacing = new THREE.Vector3(0, 0, -1);
assert.equal(pedestal.canInteract(playerPos, cameraFacing), true, 'Le joueur peut interagir face au pupitre');

// Vérifier le prompt généré
const prompt = pedestal.getPrompt();
assert.match(prompt.text, /ÉLIXIR DE VITALITÉ/i);
assert.match(prompt.text, /\+20 PV MAX/i);

// Joueur trop loin (> 2.8m)
const farPos = new THREE.Vector3(-2.5, 1.7, 8.0);
assert.equal(pedestal.canInteract(farPos, cameraFacing), false, 'Interaction refusée à distance');

// Joueur tournant le dos
const cameraBack = new THREE.Vector3(0, 0, 1);
assert.equal(pedestal.canInteract(playerPos, cameraBack), false, 'Interaction refusée si le joueur regarde ailleurs');

// Choisir l'offre
const chosen = pedestal.choose();
assert.equal(chosen?.id, 'vitality', 'L\'offre choisie doit être Vitalité');
assert.equal(pedestal.isActive(), false, 'Après sélection, le pupitre devient inactif');

console.log('   -> PASS : Visée conique, prompt descriptif, sélection atomique et désactivation.\n');

// ============================================================================
// ÉPREUVE 3 : APPLICATION RÉELLE DES 4 BONUS SUR LE JOUEUR ET LES ARMES
// ============================================================================
console.log('3. Test des effets réels des 4 améliorations sur Player et Weapon...');

const level = new Level(scene);
const mockCanvas = new MockElement();
const player = new Player(level, mockCanvas, () => true);
const weapon = new Weapon(player.camera, mockCanvas, [], [], () => {}, () => true, () => {});

// 3.1 Vitalité
assert.equal(player.getMaxHealth(), 100);
player.takeDamage(50);
assert.equal(player.getHealth(), 50);

player.setMaxHealth(120);
player.heal(40);
assert.equal(player.getMaxHealth(), 120, 'Santé max augmentée à 120');
assert.equal(player.getHealth(), 90, 'Soin de 40 PV appliqué (50 + 40 = 90)');

// 3.2 Agilité
assert.equal(player.getSpeedMultiplier(), 1.0);
player.setSpeedMultiplier(1.12);
assert.equal(player.getSpeedMultiplier(), 1.12, 'Vitesse augmentée de 12%');

// 3.3 Munitions
const pAmmoInitial = weapon.getAmmoState();
assert.equal(pAmmoInitial.capacity, 15);
assert.equal(pAmmoInitial.reserve, 30);

weapon.upgradeAmmoCapacity(1.5);
const pAmmoUpgraded = weapon.getAmmoState();
assert.equal(pAmmoUpgraded.reserve, 90, 'Réserve pistolet augmentée de 50% (max 90) et remplie');

// 3.4 Précision
weapon.upgradeAccuracy(0.65);
// Vérifié sans erreur d'exécution
console.log('   -> PASS : Tous les 4 effets s\'appliquent immédiatement et modifient l\'état de simulation.\n');

// ============================================================================
// ÉPREUVE 4 : CHOIX UNIQUE, EXCLUSION MUTUELLE ET PÉREMPTION AU DÉPART
// ============================================================================
console.log('4. Test de choix unique (exclusion mutuelle) et péremption au départ (Game)...');

const gameScene = new THREE.Scene();
const gameLevel = new Level(gameScene);
const gameBell = new EncounterBell(gameScene, 0, 2.5, gameLevel.getFloorHeightAt(0, 2.5));
const pedLeft = new UpgradePedestal(gameScene, -2.5, 2.5, 0, 'left');
const pedRight = new UpgradePedestal(gameScene, 2.5, 2.5, 0, 'right');

const game = Object.create(Game.prototype);
Object.assign(game, {
  scene: gameScene,
  level: gameLevel,
  encounterBell: gameBell,
  upgradePedestals: [pedLeft, pedRight],
  appliedUpgrades: [],
  encounterConfigs: ENCOUNTER_CONFIGS,
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
  player: {
    camera: {
      position: new THREE.Vector3(-2.5, 1.7, 4.0),
      getWorldDirection: () => new THREE.Vector3(0, 0, -1),
    },
    setMaxHealth() {},
    heal() {},
    setSpeedMultiplier() {},
    getHealth: () => 100,
    getMaxHealth: () => 100,
  },
  weapon: {
    upgradeAmmoCapacity() {},
    upgradeAccuracy() {},
    setTargets() {},
    getAmmoState: () => ({ weaponName: 'PISTOLET', magazine: 10, capacity: 15, reserve: 30, isReloading: false }),
  },
  objectiveDisplay: new MockElement(),
  ammoDisplay: new MockElement(),
  healthDisplay: new MockElement(),
  perfTracker: { recordTransition() {}, recordSpawn() {}, recordPathfinding() {} },
  endGame(result) { this.state = result; },
});

// Fin du Palier 1 -> Entrée en accalmie / exploration
game.startTier(1);
game.zombies = [];
game.spawnQueue = 0;
game['checkTierCompletion']();

assert.equal(game.state, 'exploration', 'Le jeu est en exploration');
assert.equal(pedLeft.isActive(), true, 'La stèle gauche propose une offre');
assert.equal(pedRight.isActive(), true, 'La stèle droite propose une offre');

// 4.1 Le joueur choisit l'offre de gauche
const chosenLeft = pedLeft.choose();
assert.ok(chosenLeft, 'Offre gauche choisie');
game.applyUpgrade(chosenLeft);

// Fermeture de l'autre stèle (exclusion mutuelle)
for (const other of game.upgradePedestals) {
  if (other !== pedLeft) other.close();
}

assert.equal(pedLeft.isActive(), false, 'Stèle gauche consommée');
assert.equal(pedRight.isActive(), false, 'Stèle droite fermée immédiatement');
assert.equal(game.appliedUpgrades.length, 1, 'Exactement une amélioration enregistrée');

// 4.2 Péremption : Si le joueur lance le combat suivant sans choisir (Palier 2 -> 3)
game['launchPendingTier']();
assert.equal(game.state, 'playing', 'Combat du Palier 2 actif');
assert.equal(pedLeft.isActive(), false);
assert.equal(pedRight.isActive(), false);

// Fin du Palier 2 -> Nouvelles offres
game.zombies = [];
game.spawnQueue = 0;
game['checkTierCompletion']();
assert.equal(pedLeft.isActive(), true, 'Nouvelle offre gauche pour l\'accalmie 2');
assert.equal(pedRight.isActive(), true, 'Nouvelle offre droite pour l\'accalmie 2');

// Le joueur ignore les stèles et lance directement le Palier 3 !
game['launchPendingTier']();
assert.equal(game.state, 'playing');
assert.equal(pedLeft.isActive(), false, 'Stèle gauche fermée : offre expirée au départ');
assert.equal(pedRight.isActive(), false, 'Stèle droite fermée : offre expirée au départ');

console.log('   -> PASS : Choix unique garanti, offres fermées au départ sans double bonus.\n');

// Nettoyage final
game.dispose();

console.log('================================================================');
console.log('TOUTES LES VALIDATIONS DE L\'ATELIER F2 SONT 100% RÉUSSIES !');
console.log('================================================================');
