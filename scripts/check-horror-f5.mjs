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
const ticks = (director, seconds, eligible, points = behind) => {
  const count = Math.ceil(seconds / 0.05);
  for (let i = 0; i < count; i++) director.update(0.05, eligible, player, lookingNorth, points);
};

console.log('=== F5 — bruit spatial conditionnel ===');

// Le vrai calcul d'éligibilité de Game doit exclure chaque état et chaque condition de focus.
{
  globalThis.document = {
    pointerLockElement: null,
    hidden: false,
    hasFocus: () => true,
  };
  const makeGame = () => {
    const source = new FakeSource();
    const director = new HorrorDirector(() => 0);
    director.setSource(source);
    const game = Object.create(Game.prototype);
    Object.assign(game, {
      state: 'exploration',
      pendingTierStart: 2,
      spawnQueue: 0,
      zombies: [],
      horrorDirector: director,
      renderer: { domElement: {} },
      player: { camera: { position: player.clone(), getWorldDirection: () => lookingNorth.clone() } },
      level: { getAccessibleHorrorPoints: () => behind },
      ambianceAudio: null,
    });
    globalThis.document.pointerLockElement = game.renderer.domElement;
    return { game, source, director };
  };
  const invalidCases = [
    ['combat', (game) => { game.state = 'playing'; }],
    ['phase terminale', (game) => { game.state = 'terminal'; game.pendingTierStart = 0; }],
    ['aucune rencontre en attente', (game) => { game.pendingTierStart = 0; }],
    ['apparitions en attente', (game) => { game.spawnQueue = 1; }],
    ['ennemi vivant', (game) => { game.zombies = [{ isAlive: () => true }]; }],
    ['souris libérée', (game) => { globalThis.document.pointerLockElement = null; }],
    ['onglet masqué', () => { globalThis.document.hidden = true; }],
    ['application sans focus', () => { globalThis.document.hasFocus = () => false; }],
  ];
  for (const [label, invalidate] of invalidCases) {
    globalThis.document.hidden = false;
    globalThis.document.hasFocus = () => true;
    const { game, source, director } = makeGame();
    invalidate(game);
    for (let i = 0; i < 420; i++) game.updateHorrorAudio(0.05);
    assert.equal(source.playCount, 0, `Game exclut ${label} même après 21 secondes`);
    director.dispose();
  }

  globalThis.document.hidden = false;
  globalThis.document.hasFocus = () => true;
  const { game, source, director } = makeGame();
  for (let i = 0; i < 362; i++) game.updateHorrorAudio(0.05);
  assert.equal(source.playCount, 1, 'Game transmet une exploration admissible au vrai directeur');
  globalThis.document.pointerLockElement = null;
  game.syncAmbientAudio();
  assert.equal(source.isPlaying, false, 'syncAmbientAudio arrête réellement le craquement à la pause');
  director.dispose();
}

// Délai, sélection regard/distance et unicité de l'événement.
{
  const source = new FakeSource();
  const director = new HorrorDirector(() => 0);
  director.setSource(source);
  ticks(director, 17.95, true);
  assert.equal(source.playCount, 0, 'le délai minimum de 18 s doit être respecté');
  ticks(director, 0.1, true);
  assert.equal(source.playCount, 1, 'un point à 10 m derrière le joueur doit être choisi');
  assert.deepEqual(source.position.toArray(), [0, 1.3, 10], 'la source audio prend la position du point choisi');
  ticks(director, 40, true);
  assert.equal(source.playCount, 1, 'une seule lecture par accalmie malgré les frames suivantes');
  director.dispose();
  assert.equal(source.stopCount, 1, 'dispose arrête la source active');
  assert.equal(source.disconnectCount, 1, 'dispose libère la source audio');
  assert.equal(source.removeCount, 1, 'dispose retire le PositionalAudio de la scène');
}

// Intervalle maximal et aucune activité dans les phases non éligibles.
{
  const source = new FakeSource();
  const director = new HorrorDirector(() => 0.999);
  director.setSource(source);
  ticks(director, 60, false);
  assert.equal(source.playCount, 0, 'combat, terminal et pause sont exclus par le contexte non éligible');
  ticks(director, 29.95, true);
  assert.equal(source.playCount, 0, 'le délai aléatoire peut atteindre 30 s');
  ticks(director, 0.1, true);
  assert.equal(source.playCount, 1, 'l’événement devient possible après 30 s éligibles');
  director.dispose();
}

// Pause : arrêt, gel du temps et silence imposé à la reprise.
{
  const source = new FakeSource();
  const director = new HorrorDirector(() => 0);
  director.setSource(source);
  ticks(director, 12, true);
  director.suspend();
  assert.equal(source.isPlaying, false, 'la suspension coupe la source immédiatement');
  ticks(director, 50, false);
  ticks(director, 3.95, true);
  assert.equal(source.playCount, 0, 'la reprise impose au moins quatre secondes de silence');
  ticks(director, 6.1, true);
  assert.equal(source.playCount, 1, 'le délai restant reprend après le silence de reprise');
  director.dispose();
}

// Aucun point valide, regard, distance et volume nul.
{
  const source = new FakeSource();
  const director = new HorrorDirector(() => 0);
  director.setSource(source);
  ticks(director, 18.5, true, ahead);
  assert.equal(source.playCount, 0, 'un point dans le cône de regard ne doit pas jouer');
  ticks(director, 2, true, [{ x: 0, y: 1.3, z: 5 }]);
  assert.equal(source.playCount, 0, 'un point trop proche ne doit pas jouer');
  ticks(director, 2, true, [{ x: 0, y: 1.3, z: 17 }]);
  assert.equal(source.playCount, 0, 'un point au-delà de 16 m ne doit pas jouer');
  ticks(director, 2, true, []);
  assert.equal(source.playCount, 0, 'aucun point admissible conserve le silence');
  ticks(director, 1, true, behind);
  assert.equal(source.playCount, 1, 'le directeur réévalue les points sans consommer l’accalmie');
  director.resetRespite();
  director.setVolume(0);
  ticks(director, 20, true, behind);
  assert.equal(source.playCount, 1, 'le volume zéro désactive l’événement');
  assert.equal(source.volume, 0, 'le volume appliqué à la source vaut zéro');
  director.dispose();
}

{
  const source = new FakeSource();
  const director = new HorrorDirector(() => 0);
  director.setSource(source);
  ticks(director, 18.1, true);
  assert.equal(source.isPlaying, true);
  director.setVolume(0);
  assert.equal(source.isPlaying, false, 'passer le volume à zéro coupe aussi une lecture en cours');
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
