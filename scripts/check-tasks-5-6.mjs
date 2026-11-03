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
  texture.image = { width: 64, height: 64 };
  return texture;
};

if (typeof globalThis.Audio === 'undefined') {
  globalThis.Audio = class {
    volume = 1;
    play() { return Promise.resolve(); }
  };
}

const { Game } = await import('../src/Game.ts');
const { SpitterZombie } = await import('../src/SpitterZombie.ts');
const { MANSION_PICKUPS } = await import('../src/MansionConfig.ts');
const { Medkit } = await import('../src/Medkit.ts');
const { AmmoBox } = await import('../src/AmmoBox.ts');

console.log('=== VÉRIFICATION COMPORTEMENTALE TÂCHES 5 ET 6 ===\n');

// -------------------------------------------------------------
// 1. TÂCHE 5 : RÉARMEMENT UNIQUE ET ÉCONOMIE DE MUNITIONS
// -------------------------------------------------------------
console.log('1. Test de la règle du réarmement unique des ressources (Tâche 5)...');

// Vérification de la configuration des munitions 9mm (12 balles)
const pistolBoxes = MANSION_PICKUPS.filter((p) => p.type === 'ammo' && p.weaponType === 'pistol');
assert.equal(pistolBoxes.length, 4, '4 caisses de 9mm dans le manoir');
for (const box of pistolBoxes) {
  assert.equal(box.value, 12, 'Chaque caisse de 9mm contient désormais 12 balles (1 chargeur complet)');
}

// Test du cycle de réarmement unique dans Game
const scene = new THREE.Scene();
const mockGame = Object.create(Game.prototype);
mockGame.state = 'playing';
mockGame.currentTier = 1;
mockGame.pendingTierStart = 0;
mockGame.encounterConfigs = [{ totalZombies: 4 }, { totalZombies: 5 }];
mockGame.appliedUpgrades = [];
mockGame.upgradePedestals = [];
mockGame.zombies = [];
mockGame.spitProjectiles = [];
mockGame.scene = scene;
mockGame.tierDiagnostics = null;
mockGame.horrorDirector = null;
mockGame.encounterBell = { setActive: () => {} };
mockGame.updateObjectiveDisplay = () => {};
mockGame.level = {
  getDoors: () => [],
  getFloorHeightAt: () => 0,
};

const medkit = new Medkit(scene, 0, 0, 30, 0);
const ammoBox = new AmmoBox(scene, 0, 0, 12, 'pistol', 0);
mockGame.medkits = [medkit];
mockGame.ammoBoxes = [ammoBox];
mockGame.respawnPickups = Game.prototype.respawnPickups.bind(mockGame);

// Cas A : Objet consommé pendant le combat
const dummyPlayer = {
  camera: { position: new THREE.Vector3(0, 0, 0) },
  getPosition: () => new THREE.Vector3(0, 0, 0),
  getHealth: () => 50,
  getMaxHealth: () => 100,
  heal: (_n) => true,
};
const dummyWeapon = {
  addAmmo: (_n, _t) => true,
};

// Consommation en combat
assert.equal(medkit.tryPickup(dummyPlayer), true, 'Medkit ramassé en combat');
assert.equal(ammoBox.tryPickup(dummyPlayer.getPosition(), dummyWeapon), true, 'Boîte ramassée en combat');
assert.equal(medkit.isConsumed(), true, 'Medkit consommé');
assert.equal(ammoBox.isConsumed(), true, 'Boîte consommée');

// Fin de combat -> enterRespite() réarme une seule fois pour l'accalmie
mockGame.enterRespite = Game.prototype['enterRespite'].bind(mockGame);
mockGame.enterRespite();
assert.equal(mockGame.state, 'exploration');
assert.equal(medkit.isConsumed(), false, 'Medkit réarmé pour l accalmie');
assert.equal(ammoBox.isConsumed(), false, 'Boîte réarmée pour l accalmie');

// Cas B : Objet ramassé PENDANT l'accalmie pour se préparer
assert.equal(medkit.tryPickup(dummyPlayer), true, 'Medkit ramassé pendant l accalmie');
assert.equal(medkit.isConsumed(), true, 'Medkit consommé en accalmie');
assert.equal(ammoBox.isConsumed(), false, 'Boîte laissée sur place');

// Lancement du Palier 2 depuis l'exploration (via carillon / startTier)
mockGame.launchPendingTier = Game.prototype.launchPendingTier.bind(mockGame);
mockGame.startTier = Game.prototype.startTier.bind(mockGame);
mockGame.launchPendingTier();

// Vérification cruciale : l'objet consommé en accalmie NE réapparaît PAS au début du combat !
assert.equal(medkit.isConsumed(), true, 'Le medkit consommé en accalmie reste consommé (zéro double réarmement)');
assert.equal(ammoBox.isConsumed(), false, 'La boîte non consommée reste disponible');

// Cas C : Démarrage direct hors exploration (ex: initialisation P1 ou test direct)
medkit.tryPickup(dummyPlayer);
assert.equal(medkit.isConsumed(), true);
mockGame.state = 'initial_or_test';
mockGame.startTier(1);
assert.equal(medkit.isConsumed(), false, 'Un démarrage direct hors exploration réarme proprement les ressources');

console.log('   -> PASS : Réarmement unique strictement garanti, élimination du double réarmement.\n');

// -------------------------------------------------------------
// 2. TÂCHE 6 : TÉLÉGRAPHIE AUDIO ET RÈGLE DE GROS CHOC DU CRACHEUR
// -------------------------------------------------------------
console.log('2. Test de la télégraphie sonore et résistance du Cracheur (Tâche 6)...');

const mockLevel = {
  getFloorHeightAt: () => 0,
  isColliding: () => false,
  getSolidMeshes: () => [],
};
const spitter = new SpitterZombie(scene, mockLevel, 0, 0);

// Vérification de la configuration Audio
const mockListener = {
  context: {
    currentTime: 0,
    createGain: () => ({
      gain: { value: 1, setTargetAtTime: () => {} },
      connect: () => {},
    }),
    createPanner: () => ({
      connect: () => {},
      setPosition: () => {},
      setOrientation: () => {},
      refDistance: 1,
      maxDistance: 10000,
      rolloffFactor: 1,
      distanceModel: 'inverse',
      coneInnerAngle: 360,
      coneOuterAngle: 0,
      coneOuterGain: 0,
    }),
  },
  getInput: () => ({ connect: () => {} }),
};
const mockBuffer = {};
let audioPitch = 0;
let audioVolume = 0;

const origSetVolume = THREE.PositionalAudio.prototype.setVolume;
const origSetPlaybackRate = THREE.PositionalAudio.prototype.setPlaybackRate;

THREE.PositionalAudio.prototype.setVolume = function (v) {
  audioVolume = v;
  return origSetVolume ? origSetVolume.call(this, v) : this;
};
THREE.PositionalAudio.prototype.setPlaybackRate = function (p) {
  audioPitch = p;
  return origSetPlaybackRate ? origSetPlaybackRate.call(this, p) : this;
};

spitter.setupAudio(mockListener, mockBuffer);
assert.equal(audioPitch, 0.72, 'Pitch guttural plus grave que les zombies ordinaires (0.72)');
assert.equal(audioVolume, 0.35, 'Volume bien équilibré pour avertissement spatial (0.35)');

// Déclenchement de la télégraphie lors du windup
const playerTarget = new THREE.Vector3(0, 0, 6);
spitter.update(2.0, playerTarget, [], () => {});
assert.equal(spitter.getPose(), 'windup', 'Cracheur passe en windup');

// Résistance aux blessures ordinaires (Tâche 6)
spitter.takeDamage(1);
assert.equal(spitter.getPose(), 'windup', 'Une égratignure ne brise pas le windup');

spitter.takeDamage(40);
assert.equal(spitter.getPose(), 'windup', 'Une balle de pistolet isolée (40 PV) ne brise pas le windup');

// Cumul de dégâts brisant le windup (>= 75 PV cumulés)
spitter.takeDamage(40);
assert.equal(spitter.getPose(), 'idle', 'Deux balles consécutives (81 PV cumulés >= 75) interrompent le tir');

// Coup direct de fusil à pompe (gros choc >= 55 d un coup)
const shotgunVictim = new SpitterZombie(scene, mockLevel, 0, 0);
shotgunVictim.update(2.0, playerTarget, [], () => {});
assert.equal(shotgunVictim.getPose(), 'windup');
shotgunVictim.takeDamage(60);
assert.equal(shotgunVictim.getPose(), 'idle', 'Un tir lourd de fusil à pompe (60 PV >= 55) brise immédiatement le tir');

// Mort et nettoyage
shotgunVictim.takeDamage(240);
assert.equal(shotgunVictim.isAlive(), false, 'Mort après épuisement des PV');
shotgunVictim.dispose(scene);
spitter.dispose(scene);

// Rétablir les prototypes
THREE.PositionalAudio.prototype.setVolume = origSetVolume;
THREE.PositionalAudio.prototype.setPlaybackRate = origSetPlaybackRate;

console.log('   -> PASS : Télégraphie gutturale et règle de gros choc (fusil et cumul pistolet) validées à 100%.\n');

console.log('=============================================================');
console.log('TOUTES LES VALIDATIONS DES TÂCHES 5 ET 6 ONT RÉUSSI (100%)');
console.log('=============================================================');
