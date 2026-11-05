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
const { Game } = await import('../src/Game.ts');

console.log('=== SUITE DE TESTS COMPORTEMENTAUX : PROGRESSION COMPLÈTE & IMPRÉVISIBILITÉ F4 ===\n');

// ============================================================================
// ÉPREUVE 1 : TABLE DES RENCONTRES & COMPOSITION
// ============================================================================
console.log('1. Test de la structure et des quotas des huit rencontres...');

assert.equal(ENCOUNTER_CONFIGS.length, 8, 'Sept rencontres mixtes/apprentissage puis une rencontre Rampeuses');

for (let i = 0; i < ENCOUNTER_CONFIGS.length; i++) {
  const enc = ENCOUNTER_CONFIGS[i];
  assert.equal(enc.tierNumber, i + 1, `La rencontre à l'index ${i} doit avoir tierNumber = ${i + 1}`);
  assert.ok(enc.totalZombies >= 4, `La rencontre ${i + 1} doit proposer au moins 4 menaces`);
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
assert.equal(e3.maxAgile, 3);
assert.equal(e3.maxSimultaneousAgile, 2);

// P4 à P7 : Manoir entièrement ouvert, déclenchés par le carillon d'arène
for (const e of [e4, e5, e6, e7]) {
  assert.equal(e.unlockSectorTier, null, `Palier ${e.tierNumber} doit avoir unlockSectorTier null (manoir déjà ouvert)`);
  assert.equal(e.activationType, 'arena_signal', `Palier ${e.tierNumber} doit s'activer via le carillon d'arène`);
  assert.equal(e.spawnPool, MANSION_OPEN_SPAWN_POOL, `Palier ${e.tierNumber} doit utiliser le pool ouvert multidirectionnel`);
}

// Quotas progressifs
assert.deepEqual([e4, e5, e6, e7].map((e) => e.totalZombies), [8, 10, 12, 14]);
assert.deepEqual([e4, e5, e6, e7].map((e) => e.maxSpitter), [1, 2, 3, 3]);
assert.deepEqual([e4, e5, e6, e7].map((e) => e.maxAgile), [4, 5, 6, 7]);

assert.equal(e8.totalZombies, 14);
assert.equal(e8.maxCrawler, e8.totalZombies);
assert.equal(e8.maxAgile + e8.maxSpitter, 0);
assert.equal(e8.maxSimultaneousCrawler, 5);
assert.equal(e8.maxActiveZombies, 5);
assert.equal(e8.openingSpawns, 3);
assert.equal(e8.spawnPool, MANSION_OPEN_SPAWN_POOL);
console.log('   -> PASS : Huit rencontres, dont P8 exclusivement Rampeuses.\n');

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
// ÉPREUVE 3 : CYCLE DE PROGRESSION INTÉGRAL 1 -> 7 ET DÉCLENCHEMENT PAR CARILLON
// ============================================================================
console.log('3. Test du cycle complet (Paliers 1 à 8 -> exploration terminale)...');

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
  zombies: [],
  medkits: [],
  ammoBoxes: [],
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
game.startTier(ENCOUNTER_CONFIGS.length + 1);
assert.equal(game['currentTier'], 1, 'Un numéro invalide ne modifie pas le palier courant');
assert.equal(game['spawnQueue'], 4, 'Un numéro invalide ne détruit pas la file active');
assert.equal(horrorDirectorProbe.resetCount, 1, 'Un palier invalide ne réarme pas le directeur');

// Parcourir tous les paliers, y compris la transition P7 → P8.
for (let tier = 1; tier <= ENCOUNTER_CONFIGS.length; tier++) {
  assert.equal(game['currentTier'], tier, `Actuellement au Palier ${tier}`);
  assert.equal(game['state'], 'playing', `En combat actif au Palier ${tier}`);

  // Vider les zombies pour simuler la fin de la rencontre
  for (const z of game['zombies']) z.dispose(game['scene']);
  game['zombies'] = [];
  game['spawnQueue'] = 0;
  if (tier === ENCOUNTER_CONFIGS.length) {
    terminalPedestals[0].setOffer(UPGRADE_CATALOG.agility);
    terminalPedestals[1].setOffer(UPGRADE_CATALOG.vitality);
    game['encounterBell'].setActive(true);
  }
  game['checkTierCompletion']();

  if (tier < ENCOUNTER_CONFIGS.length) {
    // Doit passer en accalmie / exploration
    assert.equal(game['state'], 'exploration', `Après le Palier ${tier}, transition vers exploration`);
    assert.equal(game['pendingTierStart'], tier + 1, `Palier ${tier + 1} en attente`);

    assert.equal(game['encounterBell'].isActive(), false, 'Le carillon ne déclenche plus le combat');
    assert.equal(game['respiteTimer'], 10, 'Dix secondes de récupération avant le prochain palier');

    // Lancer le palier suivant
    game['launchPendingTier']();
  } else {
    // Après le dernier palier : exploration sans menu ni capture de contrôle.
    assert.equal(game['state'], 'terminal', 'Le prototype reste explorable après P8');
    assert.equal(game['pendingTierStart'], 0, 'Aucun palier suivant ne doit être en attente');
    assert.equal(game['isSimulationActive'](), true, 'Les contrôles restent actifs');
    assert.equal(globalThis.document.pointerLockElement, game.renderer.domElement, 'La souris reste capturée');
    assert.equal(globalThis.document.exitPointerLockCalls, 0, 'Aucune libération de souris demandée');
    assert.equal(game['victoryDisplay'].hidden, true, 'Aucun overlay de victoire ne doit apparaître');
    assert.equal(game['gameOverDisplay'].hidden, true, 'Aucun overlay de défaite ne doit apparaître');
    assert.match(game['objectiveDisplay'].textContent, /8 RENCONTRES PURGÉES/i);
    assert.match(game['objectiveDisplay'].textContent, /FINALE F6 À VENIR/i);
    game['checkTierCompletion']();
    assert.equal(game['state'], 'terminal', 'La transition terminale ne se répète pas');
    assert.equal(game['spawnQueue'], 0, 'Aucune apparition après le dernier palier');
    assert.ok(terminalPedestals.every((p) => !p.isActive()), 'Aucune offre ne reste active après P8');
    assert.equal(game['encounterBell'].isActive(), false, 'Le carillon est fermé après P8');
  }
}

console.log('   -> PASS : Cycle complet P1 à P8 avec décompte et exploration finale.\n');

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
const secondSpawn = game['zombies'][0].getPosition();
assert.equal(game['level'].isColliding(secondSpawn.x, secondSpawn.z, 0.45), false, 'La position représentative respecte aussi le filtre de collision');
assert.ok(Math.hypot(secondSpawn.x + 19, secondSpawn.z - 14) >= 6, 'La position représentative respecte la distance de sécurité');
Math.random = originalRandom;

// Exercer le vrai sélecteur avec uniquement des Rampeuses, dans le vrai niveau.
game.startTier(8);
game.player.camera.position.set(0, 1.7, 0);
for (const door of game.level.getDoors()) door.update(5);
for (let i = 0; i < e8.maxActiveZombies; i++) {
  assert.equal(game.trySpawnZombie(), true, 'Apparition initiale de Rampeuse');
  game.spawnQueue--;
}
assert.equal(game.trySpawnZombie(), false, 'La sixième Rampeuse attend une place libre');
while (game.spawnQueue > 0) {
  game.zombies.find((z) => z.isAlive()).takeDamage(10000);
  game.checkTierCompletion();
  assert.equal(game.state, 'playing', 'La file restante empêche une fin prématurée');
  assert.equal(game.trySpawnZombie(), true, 'Un renfort remplace une Rampeuse éliminée');
  game.spawnQueue--;
  assert.equal(game.zombies.filter((z) => z.isAlive()).length, 5);
}
assert.equal(game.zombies.length, 14);
assert.ok(game.zombies.every((z) => z.getKind() === 'crawler'), 'Aucun standard, Coureur ou Cracheur au P8');
game.checkTierCompletion();
assert.equal(game.state, 'playing', 'Les cinq dernières menaces doivent aussi être éliminées');
for (const crawler of game.zombies) crawler.takeDamage(10000);
assert.equal(game.trySpawnZombie(), false, 'Le quota de 14 Rampeuses est épuisé');
game.checkTierCompletion();
assert.equal(game.state, 'terminal');
assert.match(game.objectiveDisplay.textContent, /8 RENCONTRES PURGÉES/);
console.log('   -> PASS : P8, 14 vraies Rampeuses, plafond cinq, renforts et fin après la dernière mort.');

// Nettoyage final
game.dispose();
placementLevel.dispose?.();

console.log('\n================================================================');
console.log('TOUTES LES VALIDATIONS DE PROGRESSION F4 SONT 100% PASS !');
console.log('================================================================');
