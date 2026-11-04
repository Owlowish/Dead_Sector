import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.Audio = class { volume = 1; play() { return Promise.resolve(); } };

const { Game } = await import('../src/Game.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const game = Object.create(Game.prototype);
const scene = new THREE.Scene();
Object.assign(game, {
  scene,
  level: { getFloorHeightAt: () => 0, getDoors: () => [] },
  weapon: { isWeaponUnlocked: () => false },
  encounterConfigs: ENCOUNTER_CONFIGS,
  currentTier: 6,
  ammoDrops: [],
  dropBudget: 4,
  dropsMade: 0,
  killsThisTier: 0,
  state: 'playing',
  medkits: [],
  ammoBoxes: [],
  zombies: [],
  spawnQueue: 0,
  appliedUpgrades: [],
  upgradePedestals: [],
  encounterBell: { setActive() {} },
  tierDiagnostics: { endTier() {}, recordAmmoDrop() {} },
  updateObjectiveDisplay() {},
});
const previousRandom = Math.random;
Math.random = () => 0.99;
for (let i = 0; i < 12; i++) {
  game.onZombieKilled({ getPosition: () => new THREE.Vector3(i * 2, 0, 0) });
  if (i === 1) assert.equal(game.ammoDrops.length, 2, 'deux drops dans les deux premières éliminations');
}
Math.random = previousRandom;
assert.equal(game.ammoDrops.length, 4, 'budget garanti même sans chance');
game.enterRespite();
assert.equal(game.state, 'exploration');
assert.equal(game.respiteTimer, 10);
assert.equal(game.pendingTierStart, 7);
assert.equal(game.ammoDrops.length, 4, 'les munitions restent au sol pendant l’accalmie');
let started = 0;
game.launchPendingTier = () => { started++; };
game.advanceRespite(9.9);
assert.equal(started, 0, 'le palier ne démarre pas avant la fin du décompte');
game.advanceRespite(0.1);
assert.equal(started, 1, 'le palier démarre à la fin du décompte');
for (const drop of game.ammoDrops) drop.dispose();
console.log('Budget de drops, première élimination et persistance : OK');
