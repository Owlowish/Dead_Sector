import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
globalThis.window = Object.assign(new EventTarget(), {});
let focused = true;
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null, hidden: false, hasFocus: () => focused,
});
globalThis.Audio = class { play() { return Promise.resolve(); } };
const originalLoad = THREE.TextureLoader.prototype.load;
const originalRandom = Math.random;
THREE.TextureLoader.prototype.load = function (url) {
  return new THREE.Texture({ width: 512, height: 512, src: url });
};
Math.random = () => 0.9;
const { Game } = await import('../src/Game.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const { Zombie } = await import('../src/Zombie.ts');
const fixtures = [];
function makeGame(tier) {
  const game = Object.create(Game.prototype);
  const floor = tier === 3 ? 2.4 : 0;
  const configs = ENCOUNTER_CONFIGS.map((config) => ({ ...config,
    spawnPool: [-18, -12, -6, 0, 6, 12, 18].flatMap((x) => [{ x, z: -10 }, { x, z: -16 }]),
  }));
  Object.assign(game, {
    scene: new THREE.Scene(),
    level: {
      getDoors: () => [], getFloorHeightAt: () => floor,
      isColliding: () => false, getSolidMeshes: () => [],
      findNextWaypoint: (_from, to) => to.clone(), hasLineOfSight: () => true,
    },
    encounterConfigs: configs, currentTier: tier, state: 'playing',
    player: { camera: { position: new THREE.Vector3(0, floor + 1.7, 0),
      getWorldDirection: () => new THREE.Vector3(0, 0, 1) } },
    weapon: { setTargets() {}, isWeaponUnlocked: () => false },
    renderer: { domElement: {} }, zombies: [], medkits: [], ammoDrops: [],
    appliedUpgrades: [], upgradePedestals: [],
  });
  game.startTier(tier);
  // Éviter de mélanger l'économie des munitions avec les tests d'orchestration.
  game.dropBudget = 0;
  document.pointerLockElement = game.renderer.domElement;
  fixtures.push(game);
  return game;
}
function spawn(game) {
  const before = game.zombies.length;
  if (!game.trySpawnZombie()) return [];
  game.spawnQueue--; // L'unité principale est consommée par la vraie boucle de Game.
  return game.zombies.slice(before);
}
function defeat(game, zombie, headshot = true) {
  zombie.takeDamage(10000, headshot);
  game.onZombieKilled(zombie);
}
const active = (game) => game.zombies.filter((zombie) => zombie instanceof Zombie ? zombie.isThreat() : zombie.isAlive());
const counters = (game) => [game.spawnQueue, game.tierStandardSpawned, game.tierAgileSpawned,
  game.tierSpitterSpawned, game.tierCrawlerSpawned, game.zombies.length];

try {
  const axeOpening = makeGame(1);
  axeOpening.encounterConfigs[0].spawnPool = ENCOUNTER_CONFIGS[0].spawnPool;
  Math.random = () => 0;
  const [firstStandard] = spawn(axeOpening);
  Math.random = () => 0.9;
  assert.equal(firstStandard.getKind(), 'standard');
  assert.deepEqual(spawn(axeOpening), [], 'Le premier Standard de P1 est isolé');
  defeat(axeOpening, firstStandard, false);
  assert.equal(firstStandard.isThreat(), true);
  assert.deepEqual(spawn(axeOpening), [], 'Sa mort provisoire conserve le duel de P1');
  for (let i = 0; i < 80 && !firstStandard.isAlive(); i++) axeOpening.updateZombieRemains(0.1);
  assert.equal(firstStandard.isAlive(), true);
  assert.deepEqual(spawn(axeOpening), [], 'Le Standard relevé reste la seule menace');
  defeat(axeOpening, firstStandard, false);
  assert.equal(axeOpening.killsThisTier, 1);
  assert.equal(spawn(axeOpening).length, 1, 'La première élimination définitive libère la file');
  assert.equal(spawn(axeOpening).length, 1, 'Le plafond ordinaire de P1 revient ensuite');

  const intro = makeGame(3);
  const [first] = spawn(intro);
  assert.equal(first.getKind(), 'standard', 'P3 commence par un standard');
  defeat(intro, first);
  const [second] = spawn(intro);
  assert.equal(second.getKind(), 'standard', 'Une seule élimination ne déverrouille aucun spécialiste');
  defeat(intro, second);
  const pair = spawn(intro);
  assert.deepEqual(pair.map((zombie) => zombie.getKind()), ['spitter', 'agile'], 'Deux éliminations définitives introduisent le Cracheur et son escorte');
  assert.ok(pair.every((zombie) => zombie.getPosition().y > 2.4), 'P3 garde le Cracheur à l’étage');
  assert.equal(intro.killsThisTier, 2);

  const crawlerIntro = makeGame(4);
  const opening = spawn(crawlerIntro);
  assert.equal(opening.some((zombie) => zombie.getKind() === 'crawler'), false);
  defeat(crawlerIntro, opening[0]);
  const afterOne = spawn(crawlerIntro);
  assert.equal(afterOne.some((zombie) => zombie.getKind() === 'crawler'), false, 'Une seule élimination ne présente pas la Rampeuse');
  defeat(crawlerIntro, opening[1]);
  assert.equal(crawlerIntro.killsThisTier, 2);
  assert.equal(spawn(crawlerIntro)[0].getKind(), 'crawler', 'La Rampeuse devient éligible après le premier engagement');

  const revived = makeGame(3);
  const pending = new Zombie(revived.scene, revived.level, 0, -10, 'standard', () => 0);
  revived.zombies.push(pending);
  defeat(revived, pending, false);
  assert.equal(pending.isThreat(), true, 'Une mort provisoire demeure une menace');
  assert.equal(revived.killsThisTier, 0, 'Une relève ne déverrouille aucune introduction');
  focused = false;
  revived.updateZombieRemains(10);
  assert.equal(pending.isAlive(), false, 'La perte de focus suspend la relève même si Pointer Lock reste acquis');
  focused = true;
  document.hidden = true;
  revived.updateZombieRemains(10);
  assert.equal(pending.isAlive(), false, 'Un onglet masqué suspend aussi la relève');
  document.hidden = false;
  for (let i = 0; i < 80 && !pending.isAlive(); i++) revived.updateZombieRemains(0.1);
  assert.equal(pending.isAlive(), true, 'Le vrai cycle de relève aboutit');
  assert.equal(revived.killsThisTier, 0);
  defeat(revived, pending);
  revived.updateZombieRemains(0.1);
  revived.onZombieKilled(pending);
  assert.equal(revived.killsThisTier, 1, 'Une élimination définitive compte une fois malgré les passages ultérieurs');

  const grouped = makeGame(6);
  Math.random = () => 0;
  while (grouped.spawnQueue > 6) {
    const created = spawn(grouped);
    assert.ok(created.length > 0, 'La première poussée avance sans bloquer ses escortes');
    for (const zombie of created) defeat(grouped, zombie, grouped.spawnQueue !== 6);
  }
  Math.random = () => 0.9;
  const lastThreat = active(grouped)[0];
  assert.ok(lastThreat instanceof Zombie && !lastThreat.isAlive(), 'La dernière mort provisoire garde le premier groupe actif');
  assert.equal(grouped.killsThisTier, 5);
  grouped.advanceSpawnGroup(10);
  assert.equal(grouped.groupRespiteRemaining, null, 'Une relève en attente ne déclenche pas la récupération du groupe');
  for (let i = 0; i < 80 && !lastThreat.isAlive(); i++) grouped.updateZombieRemains(0.1);
  assert.equal(lastThreat.isAlive(), true);
  defeat(grouped, lastThreat);
  assert.equal(grouped.killsThisTier, 6);
  assert.deepEqual(grouped.zombies.reduce((counts, zombie) => {
    counts[zombie.getKind()]++; return counts;
  }, { standard: 0, agile: 0, spitter: 0, crawler: 0 }), { standard: 3, agile: 2, spitter: 1, crawler: 0 });
  const beforeRecovery = counters(grouped);
  assert.deepEqual(spawn(grouped), [], 'Aucune unité du second groupe ne fuit dans le premier');
  assert.deepEqual(counters(grouped), beforeRecovery);
  grouped.checkTierCompletion();
  assert.equal(grouped.state, 'playing', 'Les six renforts empêchent une fausse fin de palier');
  let respiteNotice;
  const activeAmmo = { magazine: 8, capacity: 15, reserve: 0, isReloading: false };
  grouped.hud = { announce: (text) => { respiteNotice = text; } };
  grouped.weapon.getAmmoState = () => activeAmmo;
  grouped.advanceSpawnGroup(0.05);
  assert.equal(grouped.groupRespiteRemaining, 3);
  assert.match(respiteNotice, /REPOSITIONNEZ-VOUS/, 'Une réserve vide ne demande pas de recharger');
  for (let i = 0; i < 10; i++) grouped.advanceSpawnGroup(0);
  assert.equal(grouped.groupRespiteRemaining, 3, 'Le temps suspendu ne consomme pas la récupération');
  activeAmmo.reserve = 10;
  grouped.advanceSpawnGroup(2.99);
  assert.match(respiteNotice, /RECHARGEZ/, 'La consigne suit une recharge redevenue possible');
  assert.equal(grouped.spawnGroupIndex, 0);
  assert.deepEqual(spawn(grouped), [], 'Le second groupe attend les trois secondes complètes');
  grouped.advanceSpawnGroup(0.01);
  assert.equal(grouped.spawnGroupIndex, 1);
  assert.match(respiteNotice, /RENFORTS/);
  grouped.hud = undefined;
  while (grouped.spawnQueue > 0) {
    const created = spawn(grouped);
    assert.ok(created.length > 0, 'La deuxième poussée reste réalisable');
    assert.ok(active(grouped).length <= 6);
    for (const zombie of created) defeat(grouped, zombie);
  }
  assert.equal(grouped.killsThisTier, 12);
  assert.deepEqual([grouped.tierStandardSpawned, grouped.tierAgileSpawned, grouped.tierSpitterSpawned, grouped.tierCrawlerSpawned], [4, 4, 2, 2]);
  grouped.checkTierCompletion();
  assert.equal(grouped.state, 'exploration', 'Les deux groupes terminés autorisent la vraie accalmie');
  assert.equal(grouped.respiteTimer, 10, 'L’accalmie normale reste de dix secondes');

  // Une paire sans deux positions sûres doit laisser avancer un type isolé.
  const fallback = makeGame(3);
  fallback.encounterConfigs[2].spawnPool = [{ x: 0, z: -10 }];
  fallback.encounterConfigs[2].fallbackSpawnPool = [];
  for (let i = 0; i < 2; i++) defeat(fallback, spawn(fallback)[0]);
  const solo = spawn(fallback);
  assert.equal(solo[0].getKind(), 'agile', 'Le Coureur libre peut apparaître à la place de la paire impossible');
  assert.equal(fallback.tierSpitterSpawned, 0, 'La tentative de paire ne consomme pas le Cracheur');
  assert.equal(fallback.tierAgileSpawned, 1, 'Seul le Coureur indépendant consomme son quota');
  defeat(fallback, solo[0]);
  const lastStandard = spawn(fallback);
  assert.equal(lastStandard[0].getKind(), 'standard', 'Le dernier Coureur reste réservé à son escorte');
  defeat(fallback, lastStandard[0]);
  const reserved = counters(fallback);
  fallback.level.isColliding = () => true;
  assert.equal(spawn(fallback).length, 0, 'Sans point sûr, la paire attend sans voler son escorte');
  assert.deepEqual(counters(fallback), reserved, 'Une tentative impossible ne consomme ni file ni quota');
  fallback.level.isColliding = () => false;
  fallback.encounterConfigs[2].fallbackSpawnPool = [{ x: 14, z: -10 }];
  assert.deepEqual(spawn(fallback).map((zombie) => zombie.getKind()), ['spitter'], 'Deux points sûrs trop éloignés autorisent un départ séparé');
  assert.equal(fallback.spawnCooldownTimer, 2, 'L’escorte attend deux secondes de combat');
  assert.equal(fallback.spawnQueue, 1);
  fallback.checkTierCompletion();
  assert.equal(fallback.state, 'playing');
  assert.deepEqual(spawn(fallback).map((zombie) => zombie.getKind()), ['agile'], 'Le Coureur réservé arrive au second point');
  assert.equal(fallback.spawnQueue, 0, 'Le duo séparé consomme exactement ses deux unités');

  const flanking = makeGame(5);
  flanking.encounterConfigs[4].spawnPool = [{ x: -17, z: 0 }, { x: 17, z: -4 }, { x: 15, z: -5 }];
  const [flanker] = spawn(flanking);
  assert.equal(flanker.getKind(), 'agile', 'P5 ouvre par le Coureur indépendant');
  assert.equal(flanker.getPosition().x, -17, 'Le Coureur privilégie le flanc bas');
  const rampPair = spawn(flanking);
  assert.deepEqual(rampPair.map((zombie) => zombie.getKind()), ['spitter', 'agile']);
  assert.equal(rampPair[0].getPosition().x, 17, 'Le Cracheur privilégie la rampe lorsqu’une paire sûre y existe');

  const noRoom = makeGame(5);
  // Réserver tous les Coureurs aux deux escortes isole le manque de places
  // d'un éventuel plafond de Coureurs déjà atteint.
  noRoom.encounterConfigs[4].maxAgile = 2;
  noRoom.level.hasLineOfSight = () => false;
  for (let i = 0; i < 4; i++) assert.equal(spawn(noRoom).length, 1);
  assert.equal(active(noRoom).length, 4);
  noRoom.level.hasLineOfSight = () => true;
  const capacityFallback = spawn(noRoom);
  assert.equal(capacityFallback[0].getKind(), 'standard', 'Avec une seule place, un standard remplace la paire');
  assert.equal(active(noRoom).length, 5, 'Le fallback n’outrepasse pas le plafond actif');
  assert.equal(noRoom.tierAgileSpawned, 0, 'Aucune escorte n’est consommée sans son Cracheur');
  assert.equal(noRoom.tierSpitterSpawned, 0);
  const capFull = counters(noRoom);
  assert.deepEqual(spawn(noRoom), []);
  assert.deepEqual(counters(noRoom), capFull, 'Un plafond complet ne consomme aucun quota');
  // Un blocage géométrique total garde tous les compteurs stables.
  defeat(noRoom, capacityFallback[0]);
  const blocked = counters(noRoom);
  noRoom.level.isColliding = () => true;
  assert.deepEqual(spawn(noRoom), []);
  assert.deepEqual(counters(noRoom), blocked);
  console.log('Game réel : introductions définitives, relèves uniques, groupes/pause P6, quotas et fallback de paire : OK.');
} finally {
  for (const game of fixtures) {
    for (const zombie of game.zombies) zombie.dispose(game.scene);
    for (const box of game.ammoDrops) box.dispose();
  }
  focused = true;
  document.hidden = false;
  THREE.TextureLoader.prototype.load = originalLoad;
  Math.random = originalRandom;
}
