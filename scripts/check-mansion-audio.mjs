import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { AudioMix, AUDIO_SETTINGS_KEY } from '../src/AudioMix.ts';
import { FootstepAudio, FOOTSTEP_DURATIONS, FOOTSTEP_BASE_GAIN, createFootstepSamples, getFootstepSurfaceAt } from '../src/FootstepAudio.ts';
import { SALON_RUNNERS } from '../src/MansionFloorSurfaces.ts';

class Param {
  value = 1;
  setTargetAtTime(value) { this.value = value; }
}
class Node {
  disconnected = false;
  connect() {}
  disconnect() { this.disconnected = true; }
}
class FakeContext {
  sampleRate = 48000;
  currentTime = 0;
  state = 'running';
  sources = [];
  gains = [];
  bufferCount = 0;
  starts = [];
  createGain() { const node = Object.assign(new Node(), { gain: new Param() }); this.gains.push(node); return node; }
  createStereoPanner() { return Object.assign(new Node(), { pan: new Param() }); }
  createBuffer(channels, size, sampleRate) {
    this.bufferCount++;
    const data = new Float32Array(size);
    return { duration: size / sampleRate, getChannelData: () => data };
  }
  createBufferSource() {
    const node = Object.assign(new Node(), { buffer: null, playbackRate: new Param(), onended: null, endAt: Infinity, stopped: false });
    node.start = () => { node.endAt = this.currentTime + node.buffer.duration / node.playbackRate.value; this.starts.push(node); };
    node.stop = () => { node.stopped = true; node.onended?.(); };
    this.sources.push(node);
    return node;
  }
  advance(delta) {
    this.currentTime += delta;
    for (const source of this.sources) if (!source.stopped && source.endAt <= this.currentTime) {
      source.stopped = true;
      source.onended?.();
    }
  }
}

const run = (fps, speed, seconds = 6) => {
  const context = new FakeContext();
  const audio = new FootstepAudio(context, new Node());
  audio.update(1 / fps, { x: 0, z: 14 }, true);
  for (let i = 1; i <= fps * seconds; i++) {
    context.advance(1 / fps);
    audio.update(1 / fps, { x: i * speed / fps, z: 14 }, true);
  }
  return { context, audio };
};
assert.equal(run(30, 5).context.starts.length, run(144, 5).context.starts.length, 'Distance de marche égale : même nombre de pas à 30 et 144 Hz');
assert.equal(run(30, 9).context.starts.length, run(144, 9).context.starts.length, 'Distance de course égale : même cadence à 30 et 144 Hz');
assert.ok(run(60, 9).context.starts.length > run(60, 5).context.starts.length, 'La course augmente la cadence');
const { context, audio } = run(60, 5);
assert.equal(context.gains[0].gain.value, FOOTSTEP_BASE_GAIN, 'Le gain initial utilise le niveau de pas commun');
audio.setVolume(0.5);
assert.equal(context.gains[0].gain.value, FOOTSTEP_BASE_GAIN * 0.5, 'Effets multiplie le niveau de pas commun');
audio.setVolume(1);
assert.equal(context.bufferCount, 3, 'Les trois timbres sont synthétisés une fois');
const count = context.starts.length;
for (let i = 0; i < 300; i++) audio.update(1 / 60, { x: 30, z: 14 }, true);
assert.equal(context.starts.length, count, 'Pousser un mur ou rester immobile ne produit aucun pas');
audio.update(1 / 60, { x: -18, z: -13 }, true);
assert.equal(context.starts.length, count, 'Un saut debug ne joue pas un pas');
audio.update(1 / 60, { x: -17.8, z: -13 }, false);
assert.equal(audio.voices.length, 0, 'Une pause coupe les sources en cours');
audio.update(1 / 60, { x: -4, z: -13 }, true);
assert.equal(context.starts.length, count, 'Reprise sans rattrapage des pas');
context.state = 'suspended';
for (let i = 0; i < 90; i++) audio.update(1 / 60, { x: i / 6, z: 14 }, true);
assert.equal(context.starts.length, count, 'Le contexte suspendu ne démarre aucune voix');
context.state = 'running';
audio.setVolume(0);
for (let i = 0; i < 90; i++) audio.update(1 / 60, { x: i / 6, z: 14 }, true);
assert.equal(context.starts.length, count, 'Le canal Effets muet ne démarre aucune voix');
audio.setVolume(1);
audio.update(1 / 60, { x: 0, z: 14 }, true);
for (let i = 1; i <= 150; i++) audio.update(1 / 60, { x: i / 6, z: 14 }, true);
assert.ok(audio.voices.length <= 2, 'Deux voix maximum, même si on retarde les callbacks de fin');
const pending = [...audio.voices];
audio.dispose();
assert.equal(audio.voices.length, 0);
assert.equal(audio.buffers, null);
assert.ok(pending.every(voice => voice.source.stopped && voice.source.disconnected && voice.pan.disconnected && voice.source.buffer === null));
audio.dispose();
audio.update(1 / 60, { x: 30, z: 14 }, true);
assert.equal(audio.voices.length, 0, 'Dispose est idempotent et interdit les nouvelles voix');

for (const surface of Object.keys(FOOTSTEP_DURATIONS)) {
  const samples = createFootstepSamples(surface, 48000);
  assert.equal(samples.length, Math.ceil(FOOTSTEP_DURATIONS[surface] * 48000));
  assert.ok(samples.every(Number.isFinite));
  assert.ok(samples.some(sample => Math.abs(sample) > 0.01));
  assert.ok(Math.max(...samples.map(Math.abs)) < 0.8, 'Pas de saturation dans les buffers');
  assert.ok(samples[0] === 0);
  assert.ok(Math.abs(samples.at(-1)) < 0.0001, 'Fin amortie sans discontinuité importante');
  assert.deepEqual(samples, createFootstepSamples(surface, 48000), 'Synthèse reproductible');
}
for (const runner of SALON_RUNNERS) assert.equal(getFootstepSurfaceAt(runner.x, runner.z), 'carpet');
assert.equal(getFootstepSurfaceAt(-12, -4), 'stairs');
assert.equal(getFootstepSurfaceAt(12, -4), 'stairs');
assert.equal(getFootstepSurfaceAt(0, 14), 'wood');

const saved = [];
const storage = { getItem: () => null, setItem: (key, value) => saved.push([key, value]) };
const mix = new AudioMix(storage);
mix.setVolume('effects', 0.25);
for (let i = 0; i < 120; i++) mix.update(1 / 60, true);
assert.equal(saved.length, 0, 'Aucune sauvegarde par image');
mix.saveSettings();
assert.equal(saved.length, 1);
assert.equal(saved[0][0], AUDIO_SETTINGS_KEY);
const restored = new AudioMix({ getItem: () => saved[0][1], setItem() {} });
assert.equal(restored.getSetting('effects'), 0.25);
assert.equal(restored.getVolume('effects'), 0.25, 'Le son restauré est appliqué dès le chargement');
for (const invalid of ['{broken', 'null', '{"version":99,"volumes":{"effects":0}}']) {
  assert.equal(new AudioMix({ getItem: () => invalid, setItem() {} }).getSetting('effects'), 1);
}
const partial = new AudioMix({ getItem: () => '{"version":1,"volumes":{"effects":-2,"music":0.6,"horror":"0.1","ambience":4}}', setItem() {} });
assert.equal(partial.getSetting('effects'), 1);
assert.equal(partial.getSetting('music'), 0.6);
assert.equal(partial.getSetting('horror'), 0.18);
assert.equal(partial.getSetting('ambience'), 1);
assert.doesNotThrow(() => { const blocked = new AudioMix({ getItem() { throw Error(); }, setItem() { throw Error(); } }); blocked.saveSettings(); });

// Le vrai panneau de Game sauvegarde à l'entrée utilisateur et transmet Effets aux pas.
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const elements = new Map();
class Element extends EventTarget { value = ''; }
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null,
  querySelector: selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  },
});
const { Game } = await import('../src/Game.ts');
const liveContext = new FakeContext();
const liveSteps = new FootstepAudio(liveContext, new Node());
const mixWrites = [];
const gameMix = new AudioMix({ getItem: () => saved[0][1], setItem: (key, value) => mixWrites.push([key, value]) });
const volumeSource = () => ({ isPlaying: false, setVolume() {}, setEffectsVolume() {}, pause() {} });
const game = Object.assign(Object.create(Game.prototype), {
  state: 'playing', audioMix: gameMix, footsteps: liveSteps,
  ambianceAudio: volumeSource(), musicAudio: volumeSource(), weapon: volumeSource(), player: volumeSource(),
  encounterBell: volumeSource(), zombies: [], renderer: { domElement: {} },
  horrorDirector: { setVolume() {}, suspend() {} }, stormController: { setAmbienceVolume() {}, suspend() {} },
});
game.setupAudioControls();
assert.equal(elements.get('#effects-volume').value, '0.25');
const input = elements.get('#effects-volume');
input.value = '0';
input.dispatchEvent(new Event('input'));
assert.equal(mixWrites.length, 1);
game.updateAudioMix(1.5);
assert.equal(liveContext.gains[0].gain.value, 0, 'Le vrai Game applique Effets aux pas');
assert.equal(mixWrites.length, 1, 'La mise à jour du vrai Game ne sauvegarde pas');
game.disposed = true;
input.value = '0.5';
input.dispatchEvent(new Event('input'));
assert.equal(mixWrites.length, 1, 'Un panneau appartenant à un Game détruit ne sauvegarde plus');
assert.doesNotThrow(() => game.syncAmbientAudio());
Object.defineProperty(window, 'localStorage', { get() { throw Error('blocked'); } });
assert.doesNotThrow(() => new AudioMix().saveSettings(), 'Même le getter localStorage peut être refusé');
console.log('PASS : pas selon distance réelle, marche/course 30–144 Hz, pause/mute/téléportation, ≤2 voix, synthèse bornée et paramètres persistants validés.');
