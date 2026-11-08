import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Zombie } from '../src/Zombie.ts';
import { zombieDeathAnimation as config, zombieDeathDuration } from '../src/ZombieAnimation.ts';

const atlasHeader = readFileSync(new URL('../public/assets/zombies/zombie_death.png', import.meta.url));
assert.equal(atlasHeader.readUInt32BE(16), config.atlasWidth, 'Largeur réelle de la planche conforme au découpage');
assert.equal(atlasHeader.readUInt32BE(20), config.atlasHeight, 'Hauteur réelle de la planche conforme au découpage');

// Charge les vrais modules du jeu malgré leurs imports sans extension utilisés par Vite.
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? specifier + '.ts' : specifier, context);
} });
const { Game } = await import('../src/Game.ts');
const { Weapon } = await import('../src/Weapon.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const textures = [];
const disposedTextures = [];
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  texture.addEventListener('dispose', () => disposedTextures.push(texture));
  textures.push(texture);
  return texture;
};
const level = { isColliding: () => false, getFloorHeightAt: () => 0, getSolidMeshes: () => [], findNextWaypoint: (_start, target) => target, getDoors: () => [] };
function remains(zombie) { return zombie.remains.mesh; }
function makeSession(scene, zombies) {
  const game = Object.create(Game.prototype);
  const canvas = new EventTarget();
  const targetUpdates = [];
  Object.assign(game, {
    scene, zombies, level, state: 'playing', renderer: { domElement: canvas },
    player: { camera: { position: new THREE.Vector3(0, 1.7, 4) } },
    medkits: [], ammoBoxes: [], encounterConfigs: ENCOUNTER_CONFIGS, spawnQueue: 0,
    currentTier: 1, killsThisTier: 0, defeatedZombies: new WeakSet(),
    // Ce harnais de rendu suit les morts mais ne distribue aucune ressource.
    ammoDrops: [], dropBudget: 0, dropsMade: 0,
    weapon: { setTargets: targets => targetUpdates.push(targets), isWeaponUnlocked: () => false },
  });
  return { game, canvas, targetUpdates };
}
globalThis.window = Object.assign(new EventTarget(), { innerHeight: 900 });
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null, querySelector: () => null, querySelectorAll: () => [],
});
globalThis.Audio = class { play() { return Promise.resolve(); } };

const scene = new THREE.Scene();
const a = new Zombie(scene, level, 0, 0, 'standard', () => 1);
const b = new Zombie(scene, level, 2, 0, 'standard', () => 1);
const corpseA = remains(a), corpseB = remains(b);
assert.equal(corpseA.visible, false);
const loadedDeathTextures = textures.filter(texture => /zombie_(death|corpse)\.png/.test(texture.userData.url));
assert.equal(loadedDeathTextures.length, 1, 'Une seule planche de chute et cadavre pour deux zombies');
assert.equal(corpseA.material, corpseB.material, 'Matériau de chute partagé');
const firstFrameGeometry = corpseA.geometry;
const sourceUv = firstFrameGeometry.getAttribute('uv');
assert(Math.abs(sourceUv.getX(1) - 0.5) < 1e-6);
assert(Math.abs(sourceUv.getY(0) - 1) < 1e-6);

// Mort logique immédiate pendant une préparation d'attaque.
const attacks = [];
const audioCalls = { stop: 0, disconnect: 0, gain: 0 };
const voice = Object.assign(new THREE.Object3D(), {
  isPlaying: true,
  stop() { this.isPlaying = false; audioCalls.stop++; },
  disconnect() { audioCalls.disconnect++; },
  gain: { disconnect() { audioCalls.gain++; } },
});
a.groanAudio = voice;
a.getMesh().add(voice);
a.update(0, new THREE.Vector3(0, 1.7, 1.2), [], damage => attacks.push(damage));
a.takeDamage(100);
assert.equal(a.isAlive(), false);
assert.equal(a.getMesh().visible, false, 'Hitbox retirée des cibles visibles');
assert.equal(corpseA.visible, true);
assert.equal(audioCalls.stop, 1, 'Râle arrêté dès le coup fatal');
assert.equal(a.attackWindupRemaining, 0);
const position = a.getPosition().clone();
for (let i = 0; i < 20; i++) a.update(0.05, new THREE.Vector3(0, 1.7, 1.2), [b], damage => attacks.push(damage));
assert.deepEqual(attacks, []);
assert(a.getPosition().equals(position));

// La vraie Weapon traverse la chute visuelle et touche le mur derrière.
const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
camera.position.set(0, 1, 4);
camera.lookAt(0, 1, 0);
const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2));
wall.position.set(0, 1, -2);
const canvas = new EventTarget();
const hitObjects = [];
const weapon = new Weapon(camera, canvas, [a.getMesh()], [wall], () => assert.fail('Un cadavre ne reçoit pas de dégâts'), () => true, () => {});
weapon.unlockWeapon('pistol');
weapon.switchWeapon('pistol');
weapon.aimAmount = 1;
weapon.setOnImpact(impact => hitObjects.push(impact.object));
weapon.shoot();
assert.deepEqual(hitObjects, [wall]);

const session = makeSession(scene, [a, b]);
session.game.updateZombieRemains(0.14);
assert.equal(corpseA.geometry, firstFrameGeometry, 'Échap en combat suspend la chute');
document.pointerLockElement = session.canvas;
session.game.updateZombieRemains(0.14);
assert.notEqual(corpseA.geometry, firstFrameGeometry, 'La chute avance avec le contrôle actif');
assert.equal(session.game.killsThisTier, 1, 'La mort définitive est comptée par la vraie orchestration');
assert.equal(corpseB.geometry, firstFrameGeometry, 'Autre instance indépendante');
b.takeDamage(100);
assert.equal(corpseB.geometry, firstFrameGeometry, 'Deuxième mort démarre à la première pose');
assert.notEqual(corpseA.geometry, corpseB.geometry, 'Deux morts peuvent avoir des poses distinctes');
assert.equal(corpseA.material.map, corpseB.material.map, 'Textures communes, UV indépendants dans la géométrie');

// La pause et le bilan suspendent la chute ; la victoire conserve le contrôle libre.
document.pointerLockElement = null;
session.game.state = 'respite';
const pausedGeometry = corpseA.geometry;
session.game.updateZombieRemains(zombieDeathDuration + 0.1);
assert.equal(corpseA.geometry, pausedGeometry, 'Sans Pointer Lock la chute reste suspendue');
document.pointerLockElement = session.canvas;
session.game.runSummaryOpen = true;
session.game.updateZombieRemains(zombieDeathDuration + 0.1);
assert.equal(corpseA.geometry, pausedGeometry, 'Le bilan ouvert suspend aussi les cadavres');
session.game.runSummaryOpen = false;
session.game.state = 'won';
session.game.updateZombieRemains(zombieDeathDuration + 0.1);
assert.equal(session.game.killsThisTier, 2, 'Les callbacks des cadavres ne doublent pas les deux morts');
assert.equal(corpseA.material.map.userData.url, '/assets/zombies/zombie_death.png');
assert.equal(corpseB.material, corpseA.material, 'Matériau du corps partagé');
const finalPose = config.frames.at(-1);
const groundLocalY = (finalPose.y + finalPose.height / 2 - finalPose.groundY) / config.pixelsPerUnit;
assert(Math.abs(corpseA.position.y + groundLocalY - config.floorHeight) < 1e-8, 'Appui du dessin au niveau du sol');
const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(corpseA.quaternion);
assert(normal.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-8, 'Support vertical face au joueur');
const rotation = corpseA.quaternion.clone();
const geometry = corpseA.geometry;
a.updateDeath(10, session.game.player.camera.position);
a.takeDamage(40);
assert(corpseA.quaternion.equals(rotation));
assert.equal(corpseA.geometry, geometry, 'Corps stable après animation');
assert.equal(corpseA.castShadow, false, 'Pas d’ombre de grand panneau vertical pour le cadavre');
session.game.player.camera.position.set(4, 1.7, 0);
session.game.updateZombieRemains(0);
const sideNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(corpseA.quaternion);
assert(sideNormal.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-8, 'Cadavre face à la caméra même après la fin de la chute');
assert.equal(corpseA.geometry, geometry, 'Changer de vue ne relance pas l’animation');
assert.equal(corpseA.position.x, position.x);
assert.equal(corpseA.position.z, position.z);

const corpseTexture = corpseA.material.map;
let materialDisposals = 0;
corpseA.material.addEventListener('dispose', () => materialDisposals++);
a.dispose(scene);
a.dispose(scene);
assert.equal(materialDisposals, 0, 'Ne pas libérer le matériau encore utilisé par B');
assert(!disposedTextures.includes(corpseTexture));
assert.equal(corpseA.parent, null);
assert.deepEqual(audioCalls, { stop: 1, disconnect: 1, gain: 1 }, 'Voix détachée et nœuds audio déconnectés une seule fois');
assert.equal(voice.parent, null);

// Exécuter le vrai startTier, sans constructeur WebGL ; seuls ses collaborateurs sont fournis.
session.game.startTier(1);
assert.equal(scene.children.length, 0, 'Démarrage du palier : plus aucun acteur ni cadavre ancien');
assert.deepEqual(session.game.zombies, []);
assert.deepEqual(session.targetUpdates.at(-1), [], 'Anciennes cibles détachées de Weapon');
// Les ressources partagées survivent désormais à startTier pour éviter les à-coups de rechargement
assert(!disposedTextures.includes(corpseTexture), 'Ressource commune conservée en cache pour le palier suivant');

// Plusieurs cycles sans accumulation et mort pendant une chute encore inachevée.
for (let tier = 0; tier < 3; tier++) {
  const actors = Array.from({ length: 4 }, (_, i) => new Zombie(scene, level, i, 0, 'standard', () => 1));
  const f = makeSession(scene, actors);
  actors.forEach(actor => actor.takeDamage(100));
  f.game.state = 'won';
  document.pointerLockElement = f.canvas;
  f.game.updateZombieRemains(0.15);
  assert.notEqual(remains(actors[0]).geometry, firstFrameGeometry);
  f.game.startTier(1);
  assert.equal(scene.children.length, 0);
}

// Libération explicite finale à la fin de partie / destruction du jeu
const { disposeAllZombieResources } = await import('../src/Zombie.ts');
disposeAllZombieResources();
assert.equal(materialDisposals, 1, 'Matériau libéré lors de la libération finale');
assert(disposedTextures.includes(corpseTexture), 'Texture de cadavre libérée lors de la destruction finale');
assert.equal(new Set(disposedTextures).size, textures.length, 'Toutes les textures créées ont été libérées à la fin');
wall.geometry.dispose();
wall.material.dispose();
console.log('OK : mort immédiate, aucune attaque ni collision de tir, 4 poses indépendantes, cadavre billboard vertical ancré au sol.');
console.log('OK : pause, menu du dernier zombie, partage des ressources, vrai startTier et trois cycles sans accumulation.');
