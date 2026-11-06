import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };

const { HorrorDirector } = await import('../src/HorrorDirector.ts');
const { Level } = await import('../src/Level.ts');
const { MANSION_HORROR_POINTS, MANSION_ROOMS } = await import('../src/MansionConfig.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const { Game } = await import('../src/Game.ts');

class FakeSource {
  isPlaying = false;
  position = new THREE.Vector3();
  volume = 0;
  playCount = 0;
  stopCount = 0;
  disconnectCount = 0;
  removeCount = 0;
  setVolume(volume) { this.volume = volume; }
  play() { this.playCount++; this.isPlaying = true; }
  stop() { this.stopCount++; this.isPlaying = false; }
  disconnect() { this.disconnectCount++; }
  removeFromParent() { this.removeCount++; }
}

const player = new THREE.Vector3(0, 1.7, 0);
const lookingNorth = new THREE.Vector3(0, 0, -1);
const behind = [{ x: 0, y: 1.3, z: 10 }];
const ahead = [{ x: 0, y: 1.3, z: -10 }];
// Pas binaire exact : les limites 3/4/6/10 s ne dépendent pas des arrondis de 0,05.
const STEP = 1 / 32;
const advance = (seconds, frame) => {
  assert.ok(Number.isInteger(seconds / STEP), 'la durée simulée doit être un nombre exact de pas');
  for (let i = 0; i < seconds / STEP; i++) frame(STEP);
};
const ticks = (director, seconds, eligible, points = behind) => {
  advance(seconds, (delta) => director.update(delta, eligible, player, lookingNorth, points));
};
const randomSequence = (...values) => {
  let calls = 0;
  const random = () => values[calls++] ?? 0;
  return { random, get calls() { return calls; } };
};

// Vraies méthodes de Game, sans construire WebGL ni l'AudioContext.
const makeGame = (random = () => 0) => {
  const source = new FakeSource();
  const director = new HorrorDirector(random);
  director.setSource(source);
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    state: 'exploration', currentTier: 1, pendingTierStart: 2, respiteTimer: 10,
    spawnQueue: 0, zombies: [], spitProjectiles: [], medkits: [], upgradePedestals: [],
    debugMenuOpen: false, horrorDirector: director, encounterConfigs: ENCOUNTER_CONFIGS,
    renderer: { domElement: {} },
    player: { camera: { position: player.clone(), getWorldDirection: () => lookingNorth.clone() } },
    level: { getAccessibleHorrorPoints: () => behind, getDoors: () => [] },
    weapon: { setTargets() {} }, ambianceAudio: null,
    updateObjectiveDisplay() {},
  });
  globalThis.document = { pointerLockElement: game.renderer.domElement, hidden: false, hasFocus: () => true };
  return { game, source, director };
};
const respiteTicks = (game, seconds) => {
  advance(seconds, (delta) => {
    // Période sous contrôle : même ordre que la boucle réelle, transition avant audio.
    if (game.state === 'exploration') game.advanceRespite(delta);
    game.updateHorrorAudio(delta);
  });
};

console.log('=== F5 — bruit spatial conditionnel ===');

// Le vrai filtre Game exclut les phases, menaces et conditions de pause.
{
  const invalidCases = [
    ['combat', (game) => { game.state = 'playing'; }],
    ['phase terminale', (game) => { game.state = 'terminal'; game.pendingTierStart = 0; }],
    ['menu debug', (game) => { game.debugMenuOpen = true; }],
    ['aucune rencontre en attente', (game) => { game.pendingTierStart = 0; }],
    ['apparitions en attente', (game) => { game.spawnQueue = 1; }],
    ['ennemi vivant', (game) => { game.zombies = [{ isAlive: () => true }]; }],
    ['souris libérée', () => { document.pointerLockElement = null; }],
    ['onglet masqué', () => { document.hidden = true; }],
    ['application sans focus', () => { document.hasFocus = () => false; }],
  ];
  for (const [label, invalidate] of invalidCases) {
    const { game, source, director } = makeGame();
    invalidate(game);
    advance(11, (delta) => game.updateHorrorAudio(delta));
    assert.equal(source.playCount, 0, `Game exclut ${label}`);
    director.dispose();
  }
}

// Régression : une accalmie réelle de dix secondes permet un son, avant le combat suivant.
{
  const { game, source, director } = makeGame();
  respiteTicks(game, 3 - STEP);
  assert.equal(source.playCount, 0, 'aucun son avant trois secondes éligibles');
  respiteTicks(game, STEP);
  assert.equal(source.playCount, 1, 'le son démarre pendant la fenêtre de dix secondes');
  assert.equal(game.state, 'exploration');
  assert.deepEqual(source.position.toArray(), [0, 1.3, 10]);
  respiteTicks(game, 7 - STEP);
  assert.equal(source.playCount, 1, 'une seule lecture avant la transition');
  assert.equal(source.isPlaying, true);
  respiteTicks(game, STEP);
  assert.equal(game.state, 'playing', 'le vrai advanceRespite lance la rencontre suivante');
  assert.equal(game.currentTier, 2);
  assert.equal(game.pendingTierStart, 0);
  assert.equal(source.isPlaying, false, 'startTier coupe le son précédent');
  advance(10, (delta) => game.updateHorrorAudio(delta));
  assert.equal(source.playCount, 1, 'aucun son supplémentaire en combat');
  director.dispose();
}

// La borne haute reste dans l'accalmie ; une source terminée ne rejoue pas.
{
  const { game, source, director } = makeGame(randomSequence(0, 0.999, 0).random);
  respiteTicks(game, 6 - STEP);
  assert.equal(source.playCount, 0, 'le délai peut approcher six secondes');
  respiteTicks(game, STEP);
  assert.equal(source.playCount, 1);
  source.stop();
  respiteTicks(game, 4 - STEP);
  assert.equal(source.playCount, 1, 'la fin naturelle du son ne réarme pas le directeur');
  director.dispose();
  assert.equal(source.disconnectCount, 1);
  assert.equal(source.removeCount, 1);
}

// Une accalmie silencieuse ne retire pas au hasard à chaque frame ou regain de focus.
{
  const sampled = randomSequence(0.35, 0, 0, 0);
  const { game, source, director } = makeGame(sampled.random);
  respiteTicks(game, 3);
  document.hidden = true;
  game.syncAmbientAudio();
  advance(20, (delta) => game.updateHorrorAudio(delta));
  assert.equal(game.respiteTimer, 7, 'la pause ne consomme pas l’accalmie');
  document.hidden = false;
  respiteTicks(game, 7 - STEP);
  assert.equal(source.playCount, 0, 'le tirage à 0,35 conserve toute l’accalmie silencieuse');
  assert.equal(sampled.calls, 1, 'ni frames, ni pause/reprise ne retirent la probabilité');
  respiteTicks(game, STEP);
  assert.equal(sampled.calls, 3, 'le vrai startTier effectue un nouveau tirage et son délai');
  Object.assign(game, { state: 'exploration', pendingTierStart: 3, spawnQueue: 0, respiteTimer: 10 });
  respiteTicks(game, 3);
  assert.equal(source.playCount, 1, 'le nouveau tirage permet un son à l’accalmie suivante');
  director.dispose();
}

// Pause : temps gelé, arrêt immédiat et quatre secondes de silence à la reprise.
{
  const sampled = randomSequence(0, 0, 0);
  const { game, source, director } = makeGame(sampled.random);
  respiteTicks(game, 1);
  document.hasFocus = () => false;
  game.syncAmbientAudio();
  advance(20, (delta) => game.updateHorrorAudio(delta));
  document.hasFocus = () => true;
  respiteTicks(game, 4);
  assert.equal(source.playCount, 0, 'quatre secondes de silence précèdent le délai restant');
  respiteTicks(game, 2 - STEP);
  assert.equal(source.playCount, 0, 'le délai reprend au lieu de repartir de zéro');
  assert.equal(sampled.calls, 2, 'la reprise de focus ne retire ni chance ni délai');
  respiteTicks(game, STEP);
  assert.equal(source.playCount, 1);
  document.pointerLockElement = null;
  game.syncAmbientAudio();
  assert.equal(source.isPlaying, false, 'syncAmbientAudio coupe une lecture dès la pause');
  director.dispose();
}

// Un délai proche de six secondes + le silence de reprise peut dépasser la fenêtre utile.
{
  const sampled = randomSequence(0, 0.999, 0, 0);
  const { game, source, director } = makeGame(sampled.random);
  respiteTicks(game, 5.5);
  document.pointerLockElement = null;
  game.syncAmbientAudio();
  advance(20, (delta) => game.updateHorrorAudio(delta));
  document.pointerLockElement = game.renderer.domElement;
  respiteTicks(game, 4.5 - STEP);
  assert.equal(source.playCount, 0);
  assert.equal(sampled.calls, 2, 'la pause tardive ne relance pas le hasard');
  respiteTicks(game, STEP);
  assert.equal(game.state, 'playing');
  assert.equal(source.playCount, 0, 'le son est abandonné si sa frame coïncide avec la transition');
  assert.equal(source.isPlaying, false);
  director.dispose();
}

// Aucun point valide, regard, distance et volume nul.
{
  const source = new FakeSource();
  const director = new HorrorDirector(() => 0);
  director.setSource(source);
  ticks(director, 3.5, true, ahead);
  assert.equal(source.playCount, 0, 'un point dans le cône de regard ne doit pas jouer');
  ticks(director, 2, true, [{ x: 0, y: 1.3, z: 5 }]);
  assert.equal(source.playCount, 0, 'un point trop proche ne doit pas jouer');
  ticks(director, 2, true, [{ x: 0, y: 1.3, z: 17 }]);
  assert.equal(source.playCount, 0, 'un point au-delà de 16 m ne doit pas jouer');
  ticks(director, 2, true, []);
  assert.equal(source.playCount, 0, 'aucun point admissible conserve le silence');
  ticks(director, 1, true, behind);
  assert.equal(source.playCount, 1, 'les points sont réévalués sans consommer l’accalmie');
  director.setVolume(0);
  assert.equal(source.isPlaying, false, 'le volume nul coupe aussi une lecture en cours');
  director.resetRespite();
  ticks(director, 10, true);
  assert.equal(source.playCount, 1, 'le volume nul désactive le prochain événement');
  assert.equal(source.volume, 0);
  director.setVolume(1.4);
  assert.equal(source.volume, 1, 'le volume ne dépasse jamais 1');
  director.dispose();
}

// Points de Level : portes ouvertes requises et altitude calculée depuis le sol.
{
  const level = new Level(new THREE.Scene());
  const atStart = level.getAccessibleHorrorPoints();
  assert.deepEqual(atStart.map((point) => [point.x, point.z]), [[16, 11], [-7, 14]], 'seuls les secteurs ouverts au départ sont proposés');
  assert.ok(atStart.every((point) => Math.abs(point.y - 1.3) < 1e-9), 'les points du rez-de-chaussée sont placés à 1,3 m du sol');
  for (const point of MANSION_HORROR_POINTS) {
    const room = MANSION_ROOMS.find((candidate) => candidate.id === point.roomId);
    assert.ok(room, `la pièce ${point.roomId} existe`);
    assert.ok(point.x > room.bounds.minX && point.x < room.bounds.maxX && point.z > room.bounds.minZ && point.z < room.bounds.maxZ, `(${point.x}, ${point.z}) appartient à ${point.roomId}`);
    assert.equal(level.isColliding(point.x, point.z, 0.3), false, `(${point.x}, ${point.z}) n'est pas dans un collider`);
    assert.ok(Math.abs(level.getFloorHeightAt(point.x, point.z) - (point.roomId === 'bibliotheque' || point.roomId === 'atelier' ? 2.4 : 0)) < 1e-9, `altitude de sol cohérente pour ${point.roomId}`);
  }

  const hallDoor = level.getDoors().find((door) => door.getId() === 'door_grand_hall');
  assert.ok(hallDoor);
  hallDoor.unlock();
  hallDoor.toggle();
  for (let i = 0; i < 100; i++) hallDoor.update(0.05, []);
  assert.equal(hallDoor.getState(), 'OPEN');
  const afterHall = level.getAccessibleHorrorPoints();
  assert.ok(afterHall.some((point) => point.x === 9 && point.z === 1), 'une porte ouverte ajoute le point du Grand Hall');
  assert.ok(!afterHall.some((point) => point.z === -13), 'les pièces hautes restent inaccessibles avant ouverture des escaliers');

  for (const id of ['door_library_stair', 'door_workshop_stair']) {
    const stair = level.getDoors().find((door) => door.getId() === id);
    assert.ok(stair);
    stair.unlock();
    stair.toggle();
    for (let i = 0; i < 100; i++) stair.update(0.05, []);
  }
  const upper = level.getAccessibleHorrorPoints().filter((point) => point.z === -13);
  assert.equal(upper.length, 2, 'les deux pièces hautes deviennent admissibles quand leurs portes sont réellement ouvertes');
  assert.ok(upper.every((point) => Math.abs(point.y - 3.7) < 1e-9), 'l’altitude des sources suit le plateau à +2,4 m');
}

// Un chargement tardif après destruction est libéré sans démarrer de son.
{
  const director = new HorrorDirector(() => 0);
  director.dispose();
  const lateSource = new FakeSource();
  director.setSource(lateSource);
  assert.equal(lateSource.disconnectCount, 1, 'une source livrée après dispose est immédiatement déconnectée');
  assert.equal(lateSource.removeCount, 1);
  assert.equal(lateSource.playCount, 0);
}

console.log('PASS : temporisation, phases, reprise, sélection spatiale, portes, altitude, volume et nettoyage.');
