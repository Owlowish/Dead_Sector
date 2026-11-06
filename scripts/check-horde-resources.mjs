import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? specifier + '.ts' : specifier, context);
} });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.Audio = class { volume = 1; play() { return Promise.resolve(); } };
const canvas = {};
globalThis.document = { pointerLockElement: canvas, hidden: false, hasFocus: () => true };

const { Game } = await import('../src/Game.ts');
const { Zombie } = await import('../src/Zombie.ts');
const { TierDiagnosticsTracker } = await import('../src/TierDiagnostics.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');

function fixture(tier = 6) {
  const game = Object.create(Game.prototype);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.7, 0);
  const stock = {
    pistol: { magazine: 0, reserve: 0, unlocked: true },
    shotgun: { magazine: 0, reserve: 0, unlocked: false },
  };
  Object.assign(game, {
    scene: new THREE.Scene(), renderer: { domElement: canvas },
    level: {
      getFloorHeightAt: () => 0, getDoors: () => [], getSolidMeshes: () => [],
      isColliding: () => false,
      findNextWaypoint: (_from, to) => to.clone(),
    },
    player: { camera, resetForDebug() { camera.position.set(0, 1.7, 0); } },
    weapon: {
      isWeaponUnlocked: (kind) => stock[kind].unlocked,
      getAmmoStocks: () => structuredClone(stock),
      getReserveAmmoFor: (kind) => stock[kind].reserve,
      addAmmo(amount, kind) {
        const max = kind === 'pistol' ? 60 : 30;
        if (stock[kind].reserve >= max) return false;
        stock[kind].reserve = Math.min(max, stock[kind].reserve + amount);
        return true;
      },
      setTargets() {}, cancelReload() {},
    },
    encounterConfigs: ENCOUNTER_CONFIGS,
    currentTier: tier, ammoDrops: [], state: 'playing', medkits: [], ammoBoxes: [],
    zombies: [], spitProjectiles: [], shellCasings: [], spawnQueue: 0,
    appliedUpgrades: [], upgradePedestals: [], completedTiers: new Set(),
    finaleSupplyLots: 0,
    encounterBell: { setActive() {} }, hitEffects: { clear() {} },
    tierDiagnostics: new TierDiagnosticsTracker(),
    updateObjectiveDisplay() {}, updateHealthDisplay() {}, updateAmmoDisplay() {},
    setDebugMenuOpen() {},
  });
  game.startTier(tier);
  return { game, stock };
}

const remainingAmmo = (game) => game.ammoDrops.reduce((sum, box) => sum + box.getRemainingAmmo(), 0);
const dispose = (game) => {
  for (const zombie of game.zombies) zombie.dispose(game.scene);
  for (const box of game.ammoDrops) box.dispose();
};

// Le quota est fini, même avec chance maximale, et garanti sans chance.
const previousRandom = Math.random;
try {
  for (const random of [0, 0.99]) {
    Math.random = () => random;
    const { game } = fixture();
    const count = ENCOUNTER_CONFIGS[5].totalZombies;
    for (let i = 0; i < count; i++) {
      const enemy = { getPosition: () => new THREE.Vector3(i * 2, 1, 0) };
      game.onZombieKilled(enemy);
      game.onZombieKilled(enemy);
      if (i === 1) assert.equal(game.ammoDrops.length, 2, 'deux lots après les deux premières éliminations définitives');
    }
    assert.equal(game.killsThisTier, count, 'callbacks répétés sans élimination doublée');
    assert.equal(game.ammoDrops.length, 4, 'budget exact avec ou sans chance');
    assert.equal(game.dropBudget, 0);
    assert.equal(remainingAmmo(game), 40);

    game.enterRespite();
    assert.equal(game.state, 'exploration');
    assert.equal(game.respiteTimer, 10);
    assert.equal(game.pendingTierStart, 7);
    assert.equal(game.ammoDrops.length, 4, 'les lots restent pendant l’accalmie');
    game.advanceRespite(9.9);
    assert.equal(game.currentTier, 6, 'le combat attend les dix secondes');
    game.advanceRespite(0.1);
    assert.equal(game.currentTier, 7);
    assert.equal(game.state, 'playing');
    assert.equal(game.ammoDrops.length, 4, 'les lots restent au lancement suivant');
    dispose(game);
  }
} finally {
  Math.random = previousRandom;
}

// Exerce la vraie mort provisoire puis la vraie animation de relève.
{
  const { game } = fixture();
  const zombie = new Zombie(game.scene, game.level, 3, 0, 'standard', () => 0);
  game.zombies = [zombie];
  zombie.takeDamage(100);
  assert.equal(zombie.isAlive(), false);
  assert.equal(zombie.isThreat(), true);
  game.onZombieKilled(zombie);
  assert.equal(game.killsThisTier, 0, 'la mort provisoire ne consomme pas de quota');
  assert.equal(game.ammoDrops.length, 0, 'la mort provisoire ne produit pas de lot');
  document.hidden = true;
  for (let i = 0; i < 80; i++) game.updateZombieRemains(0.05);
  assert.equal(zombie.isAlive(), false, 'onglet masqué : la relève reste suspendue');
  document.hidden = false;
  document.hasFocus = () => false;
  for (let i = 0; i < 80; i++) game.updateZombieRemains(0.05);
  assert.equal(zombie.isAlive(), false, 'perte de focus : la relève reste suspendue');
  document.hasFocus = () => true;
  for (let i = 0; i < 120 && !zombie.isAlive(); i++) game.updateZombieRemains(0.05);
  assert.equal(zombie.isAlive(), true, 'la relève réelle a abouti');
  assert.equal(game.ammoDrops.length, 0);
  zombie.takeDamage(40);
  assert.equal(zombie.isThreat(), false, 'aucune seconde relève');
  game.onZombieKilled(zombie);
  for (let i = 0; i < 20; i++) game.updateZombieRemains(0.05);
  assert.equal(game.killsThisTier, 1);
  assert.equal(game.ammoDrops.length, 1, 'un seul lot, uniquement après la mort définitive');
  assert.equal(game.dropBudget, 3);
  assert.equal(game.tierDiagnostics.getCurrentRecord().revivalsCount.standard, 1);
  dispose(game);
}

// Le vrai callback de collecte enregistre le gain partiel appliqué, une seule fois.
{
  const { game, stock } = fixture();
  game.onZombieKilled({ getPosition: () => new THREE.Vector3(0, 1, 0) });
  stock.pistol.reserve = 59;
  assert.equal(game.collectAmmoBox(game.ammoDrops[0]), true);
  assert.equal(game.ammoDrops[0].getRemainingAmmo(), 9);
  assert.equal(game.collectAmmoBox(game.ammoDrops[0]), false);
  const record = game.tierDiagnostics.getCurrentRecord();
  assert.equal(record.ammoBoxesCollected, 1);
  assert.equal(record.weaponStats.pistol.ammoGained, 1, 'une seule place de réserve libre ne devient pas dix balles diagnostiquées');
  assert.equal(record.weaponStats.shotgun.ammoGained, 0);
  dispose(game);
}

// Les réserves finales existent dès l’accalmie, puis persistent sans réapparition.
{
  const { game, stock } = fixture(7);
  game.enterRespite();
  assert.equal(game.pendingTierStart, 8);
  assert.equal(game.ammoDrops.length, 3);
  assert.equal(remainingAmmo(game), 60);
  const supplies = [...game.ammoDrops];
  const firstPosition = game.scene.children[0].position;
  game.player.camera.position.set(firstPosition.x, 1.7, firstPosition.z);
  assert.equal(game.collectAmmoBox(supplies[0]), true);
  assert.equal(stock.pistol.reserve, 20);
  assert.equal(remainingAmmo(game), 40);
  game.advanceRespite(10);
  assert.equal(game.currentTier, 8);
  assert.equal(game.dropBudget, 0, 'aucun budget de drops des anciens renforts');
  assert.equal(game.ammoDrops.length, 3, 'aucun lot ne réapparaît au lancement');
  assert.equal(remainingAmmo(game), 40);
  assert.deepEqual(game.ammoDrops, supplies);
  const boss = { getPosition: () => new THREE.Vector3() };
  game.onZombieKilled(boss);
  game.onZombieKilled(boss);
  assert.equal(remainingAmmo(game), 40, 'la mort du boss ne ravitaille pas');
  game.prepareFinaleSupplies();
  assert.equal(remainingAmmo(game), 40, 'la préparation répétée ne recrée pas de stock');
  game.startTier(8);
  assert.equal(remainingAmmo(game), 40, 'le démarrage direct conserve le budget final déjà préparé');

  game.jumpToDebugTier(8);
  assert.equal(game.debugRun, true);
  assert.equal(game.ammoDrops.length, 3, 'le saut debug nettoie les anciens lots');
  assert.equal(remainingAmmo(game), 60);
  game.jumpToDebugTier(8);
  assert.equal(game.ammoDrops.length, 3, 'deux sauts debug ne cumulent pas les lots');
  assert.equal(remainingAmmo(game), 60);
  dispose(game);
}

// Préparation impossible : réessayer sans forcer de point dans un obstacle.
{
  const { game } = fixture(7);
  game.level.isColliding = () => true;
  game.enterRespite();
  assert.equal(game.ammoDrops.length, 0);
  game.level.isColliding = () => false;
  game.advanceRespite(10);
  assert.equal(game.ammoDrops.length, 3);
  assert.equal(remainingAmmo(game), 60);
  dispose(game);
}

// Préparation partielle : un lot collecté ne doit pas devenir un quatrième lot.
{
  const { game, stock } = fixture(7);
  game.level.isColliding = (x, z) => Math.abs(x - 2) > 0.001 || Math.abs(z) > 0.001;
  game.enterRespite();
  assert.equal(game.ammoDrops.length, 1, 'seul le point sûr a été utilisé');
  const first = game.ammoDrops[0];
  assert.equal(first.tryPickup(new THREE.Vector3(2, 1.7, 0), game.weapon), true);
  first.dispose();
  game.ammoDrops = [];
  assert.equal(stock.pistol.reserve, 20);
  game.level.isColliding = () => false;
  game.advanceRespite(10);
  assert.equal(game.ammoDrops.length, 2, 'compléter seulement les deux lots manquants');
  assert.equal(stock.pistol.reserve + remainingAmmo(game), 60, 'budget fini même après collecte du lot partiel');
  game.prepareFinaleSupplies();
  assert.equal(stock.pistol.reserve + remainingAmmo(game), 60);
  dispose(game);
}

console.log('Drops définitifs uniques, vraies relèves, budgets bornés, persistance et réserves finales sans duplication : OK');
