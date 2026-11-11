import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { AudioMix } from '../src/AudioMix.ts';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};
class Element extends EventTarget {
  value = '';
  properties = new Map();
  style = { setProperty: (name, value) => this.properties.set(name, value) };
  classList = { toggle() {} };
}
const elements = new Map();
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null,
  querySelector: selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  },
  querySelectorAll: () => [],
});
globalThis.Audio = class {
  volume = 1;
  currentTime = 0;
  play() { return Promise.resolve(); }
};
const { Game } = await import('../src/Game.ts');
const { Level } = await import('../src/Level.ts');
const { Weapon } = await import('../src/Weapon.ts');
const { Player } = await import('../src/Player.ts');
const { Zombie } = await import('../src/Zombie.ts');
const { SpitterZombie } = await import('../src/SpitterZombie.ts');
const { CrawlerZombie } = await import('../src/CrawlerZombie.ts');
const { HorrorDirector } = await import('../src/HorrorDirector.ts');
const { StormController } = await import('../src/StormController.ts');
const { EncounterBell } = await import('../src/EncounterBell.ts');

// Même fondu au bout d'une seconde à 30 et 144 images/s ; aucune modification du temps de jeu.
const fade = fps => {
  const mix = new AudioMix();
  mix.setVolume('effects', 0);
  for (let i = 0; i < fps; i++) mix.update(1 / fps, false);
  return mix;
};
assert.ok(Math.abs(fade(30).getVolume('effects') - fade(144).getVolume('effects')) < 1e-12);
const mix = new AudioMix();
assert.equal(mix.update(0.05, true), false, 'Un mix stable ne reprogramme pas les gains audio');
mix.setVolume('effects', 0);
mix.update(0, true);
assert.equal(mix.getVolume('effects'), 1, 'Un delta nul ne modifie pas le mix');
mix.update(0.05, true);
assert.ok(mix.getVolume('effects') > 0 && mix.getVolume('effects') < 1, 'Le réglage produit un fondu');
mix.setVolume('music', 4);
mix.setVolume('horror', -1);
mix.setVolume('ambience', NaN);
assert.equal(mix.getSetting('music'), 1);
assert.equal(mix.getSetting('horror'), 0);
assert.equal(mix.getSetting('ambience'), 1);

const scene = new THREE.Scene();
const level = new Level(scene);
const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
const weapon = new Weapon(camera, new Element(), [], [], () => {}, () => true, () => {});
weapon.soundBank = { volume: 1, setVolume(value) { this.volume = value; } };
const player = Object.assign(Object.create(Player.prototype), { flashlightClick: { volume: 1, setVolume(value) { this.volume = value; } } });
const audioSource = () => ({
  volume: -1, isPlaying: false, position: new THREE.Vector3(),
  setVolume(value) { this.volume = value; },
  play() { this.isPlaying = true; }, pause() { this.isPlaying = false; }, stop() { this.isPlaying = false; },
  disconnect() {}, removeFromParent() {},
});
const ambience = audioSource(), rain = audioSource(), thunder = audioSource(), creak = audioSource();
const music = { volume: -1, presence: -1, setVolume(volume, presence) { Object.assign(this, { volume, presence }); } };
const storm = new StormController(level.getStormLights(), () => 0);
storm.setRain(rain);
storm.setThunder(thunder);
const horror = new HorrorDirector(() => 0);
horror.setSource(creak);
const enemies = [new Zombie(scene, level, -14, 15), new Zombie(scene, level, -14, 15, 'agile'), new SpitterZombie(scene, level, -14, 15), new CrawlerZombie(scene, level, -14, 15)];
const enemySources = enemies.map(enemy => {
  const source = audioSource();
  if (enemy.getKind() === 'crawler') enemy.hissAudio = source;
  else enemy.groanAudio = source;
  return source;
});
const game = Object.assign(Object.create(Game.prototype), {
  state: 'playing', audioMix: new AudioMix(), ambianceAudio: ambience, music,
  stormController: storm, horrorDirector: horror, weapon, player, zombies: enemies,
  encounterBell: new EncounterBell(scene, 0, 2.5, 0),
});
game.setupAudioControls();
function changeVolume(channel, value) {
  const input = elements.get(`#${channel}-volume`);
  input.value = String(value);
  input.dispatchEvent(new Event('input'));
}
changeVolume('effects', 0);
game.updateAudioMix(1.5);
assert.equal(elements.get('#effects-volume-value').value, '0 %');
for (const [name, sound] of Object.entries(weapon.sounds)) {
  assert.equal(weapon.soundBank.volume, 0, `${name} et ses variantes suivent Effets`);
  assert(sound.clips.length > 0);
}
assert.equal(player.flashlightClick.volume, 0);
assert.ok(enemySources.every(source => source.volume === 0), 'Les quatre types ennemis suivent Effets');
assert.equal(ambience.volume, 0.15, 'Effets ne coupe pas l’ambiance');
assert.equal(music.volume, 0.4, 'Effets ne coupe pas la musique');
changeVolume('ambience', 0);
game.updateAudioMix(1.5);
assert.equal(ambience.volume, 0);
assert.equal(rain.volume, 0);
assert.equal(thunder.volume, 0);
assert.equal(creak.volume, 0, 'Le craquement suit Ambiance et son réglage propre');
const lateRain = audioSource();
storm.setRain(lateRain);
assert.equal(lateRain.volume, 0, 'Une source chargée tard reste muette');
assert.equal(music.volume, 0.4, 'Ambiance ne coupe pas la musique');
assert.equal(game.audioMix.update(1.5, true), false, 'Les fondus terminés ne provoquent plus de mise à jour des sources');
changeVolume('effects', 0.5);
game.updateAudioMix(1.5);
assert.equal(weapon.soundBank.volume * weapon.sounds.pistol.gain, 0.25);
assert.equal(weapon.soundBank.volume * weapon.sounds.shotgun.gain, 0.21);
assert.equal(player.flashlightClick.volume * 0.35, 0.175);
assert.deepEqual(enemySources.map(source => source.volume), [0.15, 0.125, 0.175, 0.175]);
game.state = 'exploration';
game.updateAudioMix(0.05);
assert.ok(music.presence > 1 / 3 && music.presence < 1, 'La baisse musicale entre combats est progressive');

// Une voix créée alors que les effets sont coupés doit être silencieuse dès sa création.
const param = () => ({ setTargetAtTime(value) { this.value = value; } });
const listener = { context: {
  currentTime: 0,
  createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
  createPanner: () => ({ connect() {}, disconnect() {} }),
}, getInput: () => ({}) };
for (const enemy of enemies) {
  enemy.setupAudio(listener, { duration: 1 }, 0);
  const source = enemy.getMesh().children.find(child => child instanceof THREE.PositionalAudio);
  assert.equal(source.gain.gain.value, 0, 'Nouveau son ennemi muet avant sa première lecture');
  enemy.dispose(scene);
}

// Éclair local, décroissance avec la distance et occultation par un vrai mesh.
const flash = level.getStormLights()[0];
flash.position.copy(level.getStormWindowPositions()[1]);
flash.intensity = 18;
const viewPosition = new THREE.Vector3(-8.5, 1.7, 16.2);
const localFlash = level.getLightingAt(viewPosition).stormFlash;
assert.ok(localFlash > 0.5 && localFlash <= 1, 'L’éclair atteint une position proche dans le Salon');
assert.equal(level.getLightingAt(flash.position.clone().add(new THREE.Vector3(30, 0, 0))).stormFlash, 0);
const blocker = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.1));
blocker.position.copy(flash.position).lerp(viewPosition, 0.5);
level.getSolidMeshes().push(blocker);
assert.equal(level.getLightingAt(viewPosition).stormFlash, 0, 'Un mur empêche le flash sur l’arme');
level.getSolidMeshes().pop();
flash.intensity = 0;
assert.equal(level.getLightingAt(viewPosition).stormFlash, 0, 'Fin de l’éclair sans lumière résiduelle');
assert.equal(scene.getObjectsByProperty('castShadow', true).filter(object => object.isLight).length, 2, 'Deux lumières à ombres conservées');
for (const name of ['salon-window-fill', 'salon-passage-fill']) {
  const light = scene.getObjectByName(name);
  assert.ok(light?.isPointLight && !light.castShadow && light.intensity < 1.5, 'Remplissage discret sans ombre');
}
weapon.setEnvironmentalLighting(0.7, 0.3);
weapon.update(0.2);
const rig = elements.get('.weapon-view');
const baseline = Number(rig.properties.get('--weapon-brightness'));
const warmth = Number(rig.properties.get('--weapon-warmth'));
weapon.setEnvironmentalLighting(0.7, 0.3, 0.8);
weapon.update(0);
assert.ok(Number(rig.properties.get('--weapon-brightness')) > baseline + 0.4, 'Le flash atteint immédiatement les couches DOM');
assert.ok(Number(rig.properties.get('--weapon-warmth')) < warmth, 'L’éclair atténue la teinte chaude');
weapon.setEnvironmentalLighting(0.7, 0.3, 0);
weapon.update(0);
assert.equal(Number(rig.properties.get('--weapon-brightness')), baseline, 'Retour à la luminosité ambiante sans traînée');
console.log('PASS : fondus indépendants du FPS, curseurs reliés, groupes sonores, chargements tardifs, éclair local/masqué et budget d’ombres.');
