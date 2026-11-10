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
  exitPointerLockCalls: 0,
  exitPointerLock() { this.exitPointerLockCalls++; this.pointerLockElement = null; },
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

import { ENCOUNTER_CONFIGS, MANSION_OPEN_SPAWN_POOL } from '../src/EncounterConfig.ts';
import { EncounterBell } from '../src/EncounterBell.ts';
import { Level } from '../src/Level.ts';
import { MANSION_ROOMS, MANSION_UPGRADE_PEDESTALS, PLAYER_START_POSITION } from '../src/MansionConfig.ts';
import { UpgradePedestal } from '../src/UpgradePedestal.ts';
import { UPGRADE_CATALOG } from '../src/UpgradeConfig.ts';
import { GuardianZombie } from '../src/GuardianZombie.ts';
const { Game } = await import('../src/Game.ts');

console.log('=== CONTRÔLES LOGIQUES : PROGRESSION ET APPARITIONS SÛRES F4 ===\n');

// ============================================================================
// ÉPREUVE 1 : SEPT RENCONTRES ORDINAIRES PUIS FINALE
// ============================================================================
console.log('1. Test des sept rencontres ordinaires et de la finale...');

assert.equal(ENCOUNTER_CONFIGS.length, 8, 'La tentative comporte sept rencontres puis une finale');

for (let i = 0; i < ENCOUNTER_CONFIGS.length; i++) {
  const enc = ENCOUNTER_CONFIGS[i];
  assert.equal(enc.tierNumber, i + 1, `La rencontre à l'index ${i} doit avoir tierNumber = ${i + 1}`);
  assert.ok(enc.totalZombies >= (enc.finalEncounter ? 1 : 4), `La rencontre ${i + 1} conserve ses menaces prévues`);
  assert.ok(enc.maxAgile <= enc.totalZombies, `Le quota d'agiles ne peut dépasser le total d'ennemis`);
  assert.ok(enc.maxSimultaneousAgile <= 4, `Plafond d'agiles simultanés borné à 4`);
  assert.ok(enc.maxSpitter + enc.maxAgile + (enc.maxCrawler ?? 0) <= enc.totalZombies, `Les quotas tiennent dans le total au palier ${enc.tierNumber}`);
  assert.ok(enc.maxSimultaneousSpitter <= 3, `Pas plus de trois cracheurs simultanés`);
  assert.ok(enc.maxActiveZombies <= 8, `Plafond global par rencontre borné à huit`);
}

// Vérifications spécifiques des intentions tactiques
const [e1, e2, e3, e4, e5, e6, e7, e8] = ENCOUNTER_CONFIGS;

// P1 : Apprentissage standard
assert.equal(e1.unlockSectorTier, 1);
assert.equal(e1.maxAgile, 0);

// P2 : Découverte du Hall et premiers coureurs
assert.equal(e2.unlockSectorTier, 2);
assert.equal(e2.maxAgile, 2);
assert.equal(e2.maxSimultaneousAgile, 1);

// P3 : Verticalité et fin d'ouverture du manoir
assert.equal(e3.unlockSectorTier, null);
assert.equal(e3.maxAgile, 2);
assert.equal(e3.maxSimultaneousAgile, 2);

// Les dernières rencontres réutilisent le manoir ouvert ; le carillon reste inactif.
for (const e of [e4, e5, e6, e7, e8]) {
  assert.equal(e.unlockSectorTier, null, `Palier ${e.tierNumber} doit avoir unlockSectorTier null (manoir déjà ouvert)`);
  assert.equal(e.activationType, 'arena_signal', `Palier ${e.tierNumber} conserve ses métadonnées d'arène`);
  assert.equal(e.spawnPool, MANSION_OPEN_SPAWN_POOL, `Palier ${e.tierNumber} doit utiliser le pool ouvert multidirectionnel`);
}

// Quotas progressifs
assert.deepEqual([e4, e5, e6, e7].map((e) => e.totalZombies), [8, 10, 12, 14]);
assert.deepEqual([e4, e5, e6, e7].map((e) => e.maxSpitter), [1, 2, 2, 2]);
assert.deepEqual([e4, e5, e6, e7].map((e) => e.maxAgile), [3, 4, 4, 5]);
assert.ok(ENCOUNTER_CONFIGS.slice(0, 7).every((e) => !e.finalEncounter), 'Aucune victoire prématurée avant P8');
assert.equal(e8.finalEncounter, true);
assert.equal(e8.totalZombies, 1);
assert.equal(e8.maxAgile, 0);
assert.equal(e8.maxSpitter, 0);
assert.equal(e8.maxCrawler ?? 0, 0);
assert.equal(e8.maxActiveZombies, 1);

console.log('   -> PASS : Compositions P1–P7 et duel P8 conformes.\n');

// ============================================================================
// ÉPREUVE 2 : POOL OUVERT MULTIDIRECTIONNEL ET COUVERTURE DES 4 POINTS CARDINAUX
// ============================================================================
console.log('2. Test de la couverture spatiale du pool d\'apparition ouvert (MANSION_OPEN_SPAWN_POOL)...');

const sceneTest = new THREE.Scene();
const levelTest = new Level(sceneTest);

assert.ok(MANSION_OPEN_SPAWN_POOL.length >= 20, 'Le pool doit contenir au moins 20 points de spawn candidats');

// Vérification de légalité physique pour chaque point
for (const pt of MANSION_OPEN_SPAWN_POOL) {
  assert.equal(levelTest.isColliding(pt.x, pt.z, 0.45), false, `Point (${pt.x}, ${pt.z}) en collision solide`);
  assert.ok(pt.x >= -23.5 && pt.x <= 23.5, `Point (${pt.x}, ${pt.z}) hors limites X`);
  assert.ok(pt.z >= -19.5 && pt.z <= 19.5, `Point (${pt.x}, ${pt.z}) hors limites Z`);
}

// Vérification de la présence dans les 4 secteurs cardinaux et 2 étages
const salonSpawns = MANSION_OPEN_SPAWN_POOL.filter((p) => p.z >= 6 && p.x < 0);
const vestibuleSpawns = MANSION_OPEN_SPAWN_POOL.filter((p) => p.z >= 6 && p.x >= 0);
const galerieSpawns = MANSION_OPEN_SPAWN_POOL.filter((p) => p.z >= -6 && p.z < 6 && p.x < 0);
const hallSpawns = MANSION_OPEN_SPAWN_POOL.filter((p) => p.z >= -6 && p.z < 6 && p.x >= 0);
const biblioSpawns = MANSION_OPEN_SPAWN_POOL.filter((p) => p.z < -6 && p.x < 0);
const atelierSpawns = MANSION_OPEN_SPAWN_POOL.filter((p) => p.z < -6 && p.x >= 0);

assert.ok(salonSpawns.length >= 3, 'Doit comporter des points au Sud-Ouest (Grand Salon)');
assert.ok(vestibuleSpawns.length >= 3, 'Doit comporter des points au Sud-Est (Vestibule)');
assert.ok(galerieSpawns.length >= 3, 'Doit comporter des points à l\'Ouest (Galerie)');
assert.ok(hallSpawns.length >= 3, 'Doit comporter des points au Centre/Nord (Grand Hall)');
assert.ok(biblioSpawns.length >= 3, 'Doit comporter des points au Nord-Ouest haut (+2.4m, Bibliothèque)');
assert.ok(atelierSpawns.length >= 3, 'Doit comporter des points au Nord-Est haut (+2.4m, Atelier)');

console.log('   -> PASS : 26 points validés couvrant tous les angles et étages du manoir.\n');

// ============================================================================
// ÉPREUVE 3 : CYCLE DE PROGRESSION INTÉGRAL 1 -> 8 SANS MENU AUTOMATIQUE
// ============================================================================
console.log('3. Test du cycle complet (Paliers 1 à 8 -> victoire explorable)...');

const gameScene = new THREE.Scene();
const gameLevel = new Level(gameScene);
const gameBell = new EncounterBell(gameScene, 0, 2.5, gameLevel.getFloorHeightAt(0, 2.5));
const terminalPedestals = [
  new UpgradePedestal(gameScene, -7, 8.5, gameLevel.getFloorHeightAt(-7, 8.5)),
  new UpgradePedestal(gameScene, -7, 17, gameLevel.getFloorHeightAt(-7, 17)),
];
const objDisplay = new MockElement();
const horrorDirectorProbe = {
  resetCount: 0,
  resetRespite() { this.resetCount++; },
  suspend() {},
  dispose() {},
};

const game = Object.create(Game.prototype);
Object.assign(game, {
  scene: gameScene,
  level: gameLevel,
  encounterBell: gameBell,
  encounterConfigs: ENCOUNTER_CONFIGS,
  currentTier: 1,
  pendingTierStart: 0,
  spawnQueue: 0,
  spawnCooldownTimer: 0,
  tierAgileSpawned: 0,
  lastSpawnQuadrant: -1,
  maxSimultaneousZombies: 8,
  state: 'playing',
  runElapsedSeconds: 0,
  completedTiers: new Set(),
  runResult: null,
  runSummaryOpen: false,
  debugRun: false,
  zombies: [],
  medkits: [],
  ammoBoxes: [],
  ammoDrops: [],
  objectiveDisplay: objDisplay,
  victoryDisplay: Object.assign(new MockElement(), { hidden: true }),
  gameOverDisplay: Object.assign(new MockElement(), { hidden: true }),
  pauseDisplay: new MockElement(),
  promptDisplay: new MockElement(),
  upgradePedestals: terminalPedestals,
  player: {
    camera: {
      position: new THREE.Vector3(8, 1.7, 16),
      getWorldDirection: () => new THREE.Vector3(0, 0, -1),
    },
    audioListener: {},
  },
  weapon: { setTargets() {}, cancelReload() {} },
  renderer: { domElement: {} },
  ambianceAudio: null,
  syncAmbientAudio() {},
  horrorDirector: horrorDirectorProbe,
});
globalThis.document.pointerLockElement = game.renderer.domElement;

game.startTier(1);
assert.equal(game['currentTier'], 1);
assert.equal(game['spawnQueue'], 4);
assert.equal(horrorDirectorProbe.resetCount, 1, 'Le départ valide d’un combat réarme le directeur pour la prochaine accalmie');
game.startTier(9);
assert.equal(game['currentTier'], 1, 'Un numéro invalide ne modifie pas le palier courant');
assert.equal(game['spawnQueue'], 4, 'Un numéro invalide ne détruit pas la file active');
assert.equal(horrorDirectorProbe.resetCount, 1, 'Un palier invalide ne réarme pas le directeur');

// Le même chemin de transition doit fonctionner jusqu'à la vraie finale.
for (let tier = 1; tier <= 8; tier++) {
  assert.equal(game['currentTier'], tier, `Actuellement au Palier ${tier}`);
  assert.equal(game['state'], 'playing', `En combat actif au Palier ${tier}`);

  // Vider les zombies pour simuler la fin de la rencontre
  for (const z of game['zombies']) z.dispose(game['scene']);
  game['zombies'] = [];
  game['spawnQueue'] = 0;
  if (tier === 8) {
    terminalPedestals[0].setOffer(UPGRADE_CATALOG.agility);
    terminalPedestals[1].setOffer(UPGRADE_CATALOG.vitality);
    game['encounterBell'].setActive(true);
  }
  game['checkTierCompletion']();

  if (tier < 8) {
    // Doit passer en accalmie / exploration
    assert.equal(game['state'], 'exploration', `Après le Palier ${tier}, transition vers exploration`);
    assert.equal(game['pendingTierStart'], tier + 1, `Palier ${tier + 1} en attente`);

    assert.equal(game['encounterBell'].isActive(), false, 'Le carillon ne déclenche plus le combat');
    assert.equal(game['respiteTimer'], 10, 'Dix secondes de récupération avant le prochain palier');

    game['advanceRespite'](9.5);
    assert.equal(game['state'], 'exploration', 'La rencontre suivante attend les dix secondes');
    game['advanceRespite'](0.5);
  } else {
    // Une victoire doit laisser le joueur explorer sans présenter automatiquement le bilan.
    assert.equal(game['state'], 'won', 'La finale termine la tentative');
    assert.equal(game['pendingTierStart'], 0, 'Aucun palier suivant ne doit être en attente');
    assert.equal(game['isSimulationActive'](), true, 'Les contrôles restent actifs');
    assert.equal(globalThis.document.pointerLockElement, game.renderer.domElement, 'La souris reste capturée');
    assert.equal(globalThis.document.exitPointerLockCalls, 0, 'Aucune libération de souris demandée');
    assert.equal(game['victoryDisplay'].hidden, true, 'Aucun overlay de victoire ne doit apparaître');
    assert.equal(game['gameOverDisplay'].hidden, true, 'Aucun overlay de défaite ne doit apparaître');
    assert.equal(game.getRunSummary().result, 'won', 'Le résultat public correspond à la finale terminée');
    game['checkTierCompletion']();
    assert.equal(game['state'], 'won', 'La victoire ne se répète pas');
    assert.equal(game['spawnQueue'], 0, 'Aucune neuvième apparition');
    assert.ok(terminalPedestals.every((p) => !p.isActive()), 'Aucune offre ne reste active après la finale');
    assert.equal(game['encounterBell'].isActive(), false, 'Le carillon reste fermé après la finale');
  }
}

console.log('   -> PASS : Cycle complet P1–P8, P7 ne gagne pas, décompte et contrôle conservés.\n');

// L'appel public direct utilisé par l'instrumentation doit synchroniser son palier.
game.startTier(7);
assert.equal(game['currentTier'], 7, 'startTier(7) met à jour le palier courant');
assert.equal(game['spawnQueue'], e7.totalZombies, 'startTier(7) lit la configuration du palier 7');
game.startTier(0);
assert.equal(game['currentTier'], 7, 'Un numéro direct invalide ne change pas le palier');
assert.equal(game['spawnQueue'], e7.totalZombies, 'Un numéro direct invalide ne détruit pas la file');

// ============================================================================
// ÉPREUVE 4 : IMPRÉVISIBILITÉ & DISPERSION MULTIDIRECTIONNELLE DES APPARITIONS
// ============================================================================
console.log('4. Test des points d’apparition sûrs et de l’escorte du Cracheur...');

// Les présentoirs ont été retirés : leurs anciens emplacements ne doivent plus bloquer le salon.
const placementLevel = new Level(new THREE.Scene());
const salon = MANSION_ROOMS.find((room) => room.id === 'salon');
assert.ok(salon);
for (const pedestal of MANSION_UPGRADE_PEDESTALS) {
  assert.ok(pedestal.x >= salon.bounds.minX && pedestal.x <= salon.bounds.maxX, 'Présentoir dans le Grand Salon X');
  assert.ok(pedestal.z >= salon.bounds.minZ && pedestal.z <= salon.bounds.maxZ, 'Présentoir dans le Grand Salon Z');
  assert.equal(placementLevel.isColliding(pedestal.x, pedestal.z, 0.45), false, 'Aucune collision invisible à la place du présentoir retiré');
  assert.equal(placementLevel.isColliding(pedestal.x, pedestal.z - 0.85, 0.4), false, 'Un joueur peut se placer devant le présentoir');
  const route = placementLevel.findNextWaypoint(
    new THREE.Vector3(PLAYER_START_POSITION.x, PLAYER_START_POSITION.y, PLAYER_START_POSITION.z),
    new THREE.Vector3(pedestal.x, 1.1, pedestal.z),
    0.4
  );
  assert.ok(route, 'Un chemin relie le départ aux anciens emplacements d’offre');
}
assert.equal(placementLevel.isColliding(-12, 16, 0.4), false, 'Le départ du test Coureur reste libre');
assert.equal(placementLevel.isPathClear(new THREE.Vector3(-5.5, 1, 16.5), new THREE.Vector3(-14, 1, 17), 0.4), true, 'La traversée du salon ne contourne plus les socles retirés');

// Réinitialiser le jeu au Palier 4 (manoir ouvert) avec le joueur au centre du Grand Hall
game['currentTier'] = 4;
game.startTier(4);
// Les portes des secteurs précédents ont été ouvertes par le joueur pendant son exploration
for (const d of game['level'].getDoors()) {
  if (d.getType() === 'sector_access') {
    d.unlock();
    d.toggle();
    d.update(5.0);
  }
}
game['player'].camera.position.set(0, 1.7, 0); // Centre du Grand Hall

// Hasard contrôlé : choisir successivement dans les meilleurs candidats éligibles.
const originalRandom = Math.random;
const randomValues = [0, 0.25, 0.5, 0.75];
let randomIndex = 0;
Math.random = () => randomValues[randomIndex++ % randomValues.length];

// Simuler l'apparition de 4 zombies consécutifs
const spawnedQuadrants = [];
for (let i = 0; game['zombies'].length < 4; i++) {
  const success = game.trySpawnZombie();
  assert.equal(success, true, `L'apparition ${i + 1} doit réussir dans le manoir ouvert`);
  game.spawnQueue--;
  const newestZombie = game['zombies'][game['zombies'].length - 1];
  const zPos = newestZombie.getPosition();
  assert.equal(game['level'].isColliding(zPos.x, zPos.z, 0.45), false, 'Le spawn respecte le filtre de collision');
  assert.ok(Math.hypot(zPos.x - game['player'].camera.position.x, zPos.z - game['player'].camera.position.z) >= 6, 'Le spawn reste à distance de sécurité');
  assert.ok(ENCOUNTER_CONFIGS[3].sectorBounds.minX <= zPos.x && zPos.x <= ENCOUNTER_CONFIGS[3].sectorBounds.maxX, 'Le spawn reste dans les limites X');
  assert.ok(ENCOUNTER_CONFIGS[3].sectorBounds.minZ <= zPos.z && zPos.z <= ENCOUNTER_CONFIGS[3].sectorBounds.maxZ, 'Le spawn reste dans les limites Z');
  for (const other of game['zombies'].slice(0, -1)) {
    const otherPos = other.getPosition();
    assert.ok(Math.hypot(zPos.x - otherPos.x, zPos.z - otherPos.z) >= 1.8, 'Le spawn respecte la séparation minimale');
  }
  const spawnDx = zPos.x - game['player'].camera.position.x;
  const spawnDz = zPos.z - game['player'].camera.position.z;
  const spawnDistance = Math.hypot(spawnDx, spawnDz);
  const cameraDir = game['player'].camera.getWorldDirection(new THREE.Vector3());
  const inDirectView = (spawnDx / spawnDistance) * cameraDir.x + (spawnDz / spawnDistance) * cameraDir.z > 0.45;
  if (inDirectView) {
    const spawnFloorY = game['level'].getFloorHeightAt(zPos.x, zPos.z);
    assert.equal(game['level'].hasLineOfSight(game['player'].camera.position, new THREE.Vector3(zPos.x, spawnFloorY + 1, zPos.z)), false, 'Un spawn dans le champ direct doit être masqué');
  }
  assert.ok(game['level'].findNextWaypoint(new THREE.Vector3(zPos.x, game['level'].getFloorHeightAt(zPos.x, zPos.z) + 1, zPos.z), game['player'].camera.position, 0.4), 'Le spawn conserve un chemin praticable');
  const dx = zPos.x - game['player'].camera.position.x;
  const dz = zPos.z - game['player'].camera.position.z;
  const angle = Math.atan2(dz, dx);
  const q = Math.floor(((angle + Math.PI + Math.PI / 4) % (2 * Math.PI)) / (Math.PI / 2)) % 4;
  spawnedQuadrants.push(q);
}

// Vérifier que les zombies n'ont PAS tous popé dans le même quadrant
const uniqueQuadrants = new Set(spawnedQuadrants);
console.log(`   Quadrants des apparitions : [${spawnedQuadrants.join(', ')}] (Directions distinctes : ${uniqueQuadrants.size})`);
const spitter = game['zombies'].find((z) => z.getKind() === 'spitter');
const escorts = game['zombies'].filter((z) => z.getKind() === 'agile');
assert.ok(spitter && escorts.some((z) => z.getPosition().distanceTo(spitter.getPosition()) <= 8), 'Le Cracheur arrive avec un Coureur proche');

// Deuxième position représentative : aile sud-ouest. Les contraintes de sécurité restent actives.
game['player'].camera.position.set(-19, 1.7, 14);
game['zombies'].forEach((z) => z.dispose(game['scene']));
game['zombies'] = [];
game['lastSpawnQuadrant'] = -1;
const secondPositionSpawned = game.trySpawnZombie();
assert.equal(secondPositionSpawned, true, 'Au moins un point sûr doit rester accessible depuis le Salon');
game.spawnQueue--;
const secondSpawn = game['zombies'][0].getPosition();
assert.equal(game['level'].isColliding(secondSpawn.x, secondSpawn.z, 0.45), false, 'La position représentative respecte aussi le filtre de collision');
assert.ok(Math.hypot(secondSpawn.x + 19, secondSpawn.z - 14) >= 6, 'La position représentative respecte la distance de sécurité');
Math.random = originalRandom;

// Le dernier duo P3 reste atteignable depuis le fond de l’Atelier, immobile.
game.startTier(3);
game.player.camera.position.set(12, 4.1, -18);
Object.assign(game, { spawnQueue: 2, killsThisTier: 4, tierStandardSpawned: 3, tierAgileSpawned: 1 });
assert.ok(game.trySpawnZombie(), 'Le repli P3 trouve une arrivée depuis le fond de l’Atelier');
game.spawnQueue--;
if (game.spawnQueue > 0) {
  assert.equal(game.spawnCooldownTimer, 2);
  assert.ok(game.trySpawnZombie(), 'L’escorte séparée conserve un autre point sûr');
  game.spawnQueue--;
}
assert.deepEqual(game.zombies.map((zombie) => zombie.getKind()), ['spitter', 'agile']);
assert.ok(game.zombies.every((zombie) => zombie.getPosition().y > 2.4), 'Le duo conserve son entrée à l’étage');
game.player.camera.position.set(-19, 1.7, 14);

// Finale réelle : le vrai Gardien arrive seul et doit mourir pour terminer.
game.startTier(8);
const finalSpawned = [];
Math.random = () => 0.1;
try {
  let finalActiveSeconds = 0;
  for (let frame = 0; frame < 2600 && game.state === 'playing'; frame++) {
    const active = () => game.zombies.filter((z) => typeof z.isThreat === 'function' ? z.isThreat() : z.isAlive());
    if (game.spawnQueue > 0 && active().length < e8.maxActiveZombies) {
      const before = game.zombies.length;
      if (game.trySpawnZombie()) {
        game.spawnQueue--; // La boucle Game consomme l'unité principale ; l'escorte consomme la sienne.
        finalSpawned.push(...game.zombies.slice(before));
      }
    }
    assert.ok(active().length <= 1, 'Le Gardien reste seul pendant le duel');
    if (game.spawnQueue > 0) {
      game.checkTierCompletion();
      assert.equal(game.state, 'playing', 'Le boss encore en attente empêche la victoire');
    }
    for (const zombie of active()) {
      zombie.update(0.05, game.player.camera.position, [], () => {}, () => {});
      finalActiveSeconds += 0.05;
      zombie.takeDamage(10000, true);
      if (finalActiveSeconds < 119.99) assert.equal(zombie.isAlive(), true, 'Aucune victoire avant deux minutes actives');
    }
    game.checkTierCompletion();
  }
} finally {
  Math.random = originalRandom;
}
assert.equal(finalSpawned.length, 1, 'Le duel ne crée qu’une menace');
assert.ok(finalSpawned[0] instanceof GuardianZombie, 'La vraie classe du boss est instanciée');
assert.equal(finalSpawned[0].getMaxHealth(), 2400, 'Le duel utilise le budget de PV renforcé');
assert.equal(finalSpawned[0].isThreat(), false, 'Le Gardien mort ne programme aucune relève');
assert.equal(game.state, 'won', 'La mort du Gardien termine le duel');

// Nettoyage final
game.dispose();
placementLevel.dispose?.();

console.log('\n================================================================');
console.log('CONTRÔLES LOGIQUES F4 RÉUSSIS. Gameplay non validé par ce script.');
console.log('================================================================');
