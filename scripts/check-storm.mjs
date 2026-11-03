import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };

const { StormController } = await import('../src/StormController.ts');
const { Level } = await import('../src/Level.ts');
const { Game } = await import('../src/Game.ts');
const { MANSION_STORM_WINDOWS } = await import('../src/MansionConfig.ts');

class Source {
  isPlaying = false;
  position = new THREE.Vector3();
  playCount = 0;
  pauseCount = 0;
  stopCount = 0;
  setVolume() {}
  play() { this.playCount++; this.isPlaying = true; }
  pause() { this.pauseCount++; this.isPlaying = false; }
  stop() { this.stopCount++; this.isPlaying = false; }
  disconnect() {}
  removeFromParent() {}
}

const playerPosition = new THREE.Vector3(2.5, 1.7, 16.7);
const tick = (controller, secs, active, positions) => {
  for (let i = 0; i < Math.ceil(secs / 0.05); i++) controller.update(0.05, active, playerPosition, positions);
};
const lights = [new THREE.PointLight(0xa9c9e8, 0, 13, 2)];
const randomValues = [0, 0.8, 0];
const controller = new StormController(lights, () => randomValues.shift() ?? 0);
const rain = new Source();
const thunder = new Source();
controller.setRain(rain);
controller.setThunder(thunder);
const positions = MANSION_STORM_WINDOWS.map(({ x, y, z }) => new THREE.Vector3(x, y, z));

tick(controller, 0.05, true, positions);
assert.equal(rain.playCount, 1, 'la pluie démarre après activation');
tick(controller, 12, true, positions);
assert.ok(lights.some((light) => light.intensity > 0), 'un flash allume une source réelle de la pièce');
const selectedIndex = Math.floor(0.8 * positions.length);
assert.ok(lights[0].position.distanceTo(positions[selectedIndex]) < 0.01, 'le tirage peut choisir une fenêtre éloignée avec une seule lumière');
assert.ok(thunder.position.distanceTo(positions[selectedIndex]) < 0.01, 'le tonnerre suit la fenêtre choisie');
tick(controller, 0.4, true, positions);
assert.ok(lights.every((light) => light.intensity === 0), 'les lumières reviennent à zéro');
assert.equal(thunder.playCount, 0, 'le tonnerre attend la fin du flash et son délai');
tick(controller, 0.9, true, positions);
assert.equal(thunder.playCount, 1, 'le tonnerre est déclenché après le flash');
tick(controller, 0.05, false, positions);
assert.ok(rain.pauseCount > 0, 'la pluie se met en pause quand le jeu est suspendu');
assert.ok(lights.every((light) => light.intensity === 0), 'la suspension coupe la lumière');

let audioReady = false;
const lateRain = new Source();
const lateController = new StormController([new THREE.PointLight()], () => 0, () => audioReady);
lateController.update(0.05, true, playerPosition, positions);
lateController.setRain(lateRain);
assert.equal(lateRain.playCount, 0, 'une source ne joue pas avant AudioContext running');
audioReady = true;
lateController.update(0.05, true, playerPosition, positions);
assert.equal(lateRain.playCount, 1, 'la pluie chargée en retard démarre dès que l’audio est actif');
playerPosition.set(-23.4, 3.7, -14);
lateController.update(0.05, true, playerPosition, positions);
assert.ok(lateRain.position.distanceTo(positions[4]) < 0.01, 'la pluie suit la fenêtre la plus proche');

globalThis.document = { pointerLockElement: null, hidden: false, hasFocus: () => true };
let gameSuspendedStorm = false;
const game = Object.create(Game.prototype);
Object.assign(game, {
  state: 'playing', renderer: { domElement: {} }, player: { audioListener: { context: {} } },
  ambianceAudio: null, horrorDirector: { suspend() {} }, zombies: [],
  stormController: { suspend() { gameSuspendedStorm = true; } },
});
game.syncAmbientAudio();
assert.ok(gameSuspendedStorm, 'Game suspend immédiatement l’orage à la perte du Pointer Lock');

const scene = new THREE.Scene();
const level = new Level(scene);
assert.equal(level.getStormLights().length, 1);
assert.equal(level.getStormWindowPositions().length, 6);
assert.equal(scene.getObjectsByProperty('name', 'storm-window').length, 6, 'six baies gothiques placées');
assert.equal(scene.getObjectsByProperty('name', 'storm-window-floor-light').length, 6, 'six projections au sol');
for (const spec of MANSION_STORM_WINDOWS) {
  const floor = level.getFloorHeightAt(spec.x, spec.z);
  assert.ok(spec.y - spec.height / 2 - floor >= 0.7, 'appui de fenêtre au-dessus du sol');
}
assert.equal(level.getStormLights().filter((light) => light.castShadow).length, 0);
assert.equal(MANSION_STORM_WINDOWS.filter((window) => level.getFloorHeightAt(window.x, window.z) > 2).length, 2, 'deux fenêtres sont sur le plateau haut');
console.log('Orage : géométrie présente, lumières réelles sans ombre, flash/délai tonnerre et pause audio vérifiés.');
