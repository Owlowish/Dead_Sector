// Logique réelle de Weapon et graphe WebAudio simulé, sans navigateur ni écoute artistique.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { WeaponMechanicalAudio, WEAPON_MECHANICAL_BASE_GAIN, WEAPON_MECHANICAL_SOUND_IDS, WEAPON_MECHANICAL_TRIMS } from '../src/WeaponMechanicalAudio.ts';
import { crossedWeaponSoundEvents, pistolReloadSoundEvents, shotgunPumpSoundEvents } from '../src/WeaponSoundEvents.ts';
import { reloadPoses } from '../src/WeaponAnimation.ts';
import { shotgunPump, shotgunReload } from '../src/ShotgunAnimation.ts';

class Param {
  value = 1;
  setTargetAtTime(value) { this.value = value; }
}
class Node {
  disconnected = false;
  connections = [];
  connect(destination) { this.connections.push(destination); }
  disconnect() { this.disconnected = true; }
}
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
class FakeContext extends EventTarget {
  async decodeAudioData() { return { duration: 0.1 }; }
  sampleRate = 48000;
  currentTime = 0;
  state = 'running';
  buffers = [];
  sources = [];
  gains = [];
  starts = [];
  createGain() {
    const node = Object.assign(new Node(), { gain: new Param() });
    this.gains.push(node);
    return node;
  }
  createBuffer(channels, size, sampleRate) {
    assert.equal(channels, 1);
    const samples = new Float32Array(size);
    const buffer = { duration: size / sampleRate, getChannelData: () => samples };
    this.buffers.push(buffer);
    return buffer;
  }
  createBufferSource() {
    const source = Object.assign(new Node(), { buffer: null, onended: null, stopped: false, endAt: Infinity });
    source.start = () => {
      source.endAt = this.currentTime + source.buffer.duration;
      this.starts.push({ source, buffer: source.buffer });
    };
    source.stop = () => { assert.equal(source.stopped, false); source.stopped = true; source.onended?.(); };
    this.sources.push(source);
    return source;
  }
  advance(delta) {
    this.currentTime += delta;
    for (const source of this.sources) if (!source.stopped && source.endAt <= this.currentTime) {
      source.stopped = true;
      source.onended?.();
    }
  }
  setState(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}
class Element extends EventTarget {
  properties = new Map();
  style = { setProperty: (key, value) => this.properties.set(key, value) };
  classList = { toggle() {}, add() {}, remove() {} };
}
// Sources réelles : chaque buffer simulé porte la durée du WAV correspondant.
function readWav(id) {
  const wav = fs.readFileSync(`assets-src/sounds/${id}.wav`);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  let offset = 12; const format = {};
  while (offset < wav.length) {
    const chunk = wav.toString('ascii', offset, offset + 4), size = wav.readUInt32LE(offset + 4);
    if (chunk === 'fmt ') Object.assign(format, { channels: wav.readUInt16LE(offset + 10), rate: wav.readUInt32LE(offset + 12), bits: wav.readUInt16LE(offset + 22) });
    if (chunk === 'data') {
      const samples = new Float32Array(size / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = wav.readInt16LE(offset + 8 + i * 2) / 32768;
      return { ...format, samples };
    }
    offset += 8 + size + (size % 2);
  }
  throw Error(`Pas de données PCM : ${id}`);
}
const sources = Object.fromEntries(WEAPON_MECHANICAL_SOUND_IDS.map(id => [id, readWav(id)]));
const mechanicalId = url => WEAPON_MECHANICAL_SOUND_IDS.find(id => url.endsWith(`/${id}.ogg`));
const { installMockAudio } = await import('./mock-audio-manager.mjs');
const { played: pooledSounds, requested } = installMockAudio({
  duration: url => { const id = mechanicalId(url); return id ? sources[id].samples.length / sources[id].rate : 1; },
});
// Une régression qui créerait un second contexte échoue immédiatement.
globalThis.AudioContext = class { constructor() { throw Error('Utiliser le contexte existant'); } };
const { Weapon } = await import('../src/Weapon.ts');

function fixture({ setup = true, volume = 1 } = {}) {
  const canvas = new Element();
  const hud = new Element();
  globalThis.window = new EventTarget();
  let focus = true;
  globalThis.document = Object.assign(new EventTarget(), {
    pointerLockElement: canvas, hidden: false, hasFocus: () => focus,
    querySelector: () => hud, querySelectorAll: () => [new Element()],
  });
  let active = true;
  const context = new FakeContext();
  const destination = new Node();
  const weapon = new Weapon(new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100), canvas, [], [], () => {}, () => active, () => {});
  weapon.unlockWeapon('pistol');
  weapon.setEffectsVolume(volume);
  const attach = () => weapon.setupMechanicalAudio(context, destination);
  if (setup) attach();
  const names = () => context.starts.map(start => mechanicalId(start.buffer.url));
  return {
    canvas, context, destination, weapon, names, attach,
    setActive: value => { active = value; }, setFocus: value => { focus = value; },
    step(delta) { context.advance(delta); weapon.update(delta); },
    fire() { weapon.lastShot = -Infinity; weapon.shoot(); },
    shotgun() { weapon.unlockWeapon('shotgun'); },
  };
}
function through(f, seconds, delta) {
  let elapsed = 0;
  while (elapsed < seconds) {
    const step = Math.min(delta, seconds - elapsed);
    f.step(step); elapsed += step;
  }
}
const pistolSounds = ['mag-out', 'mag-in', 'seat'];
const pumpSounds = ['pump-back', 'pump-forward'];
const duration = reloadPoses.reduce((sum, pose) => sum + pose.duration, 0);

// Le contrat audio suit les données que consomment les animations, sans horloge parallèle.
let phaseStart = 0;
for (const pose of reloadPoses) {
  if (['extract', 'insert', 'seat'].includes(pose.phase)) {
    const id = { extract: 'mag-out', insert: 'mag-in', seat: 'seat' }[pose.phase];
    assert.equal(pistolReloadSoundEvents.find(event => event.sound === id).at, phaseStart);
  }
  phaseStart += pose.duration;
}
assert.deepEqual(shotgunPumpSoundEvents.map(event => event.at), [shotgunPump.backAt, shotgunPump.forwardAt]);
for (const events of [pistolReloadSoundEvents, shotgunPumpSoundEvents]) {
  const boundary = events[0].at;
  assert.deepEqual(crossedWeaponSoundEvents(events, 0, boundary), [events[0]]);
  assert.deepEqual(crossedWeaponSoundEvents(events, boundary, boundary), []);
  assert.deepEqual(crossedWeaponSoundEvents(events, boundary, boundary + 0.00001), []);
  assert.deepEqual(crossedWeaponSoundEvents(events, 0, Infinity), []);
}

for (const delta of [1 / 30, 1 / 144, 0.073, duration + 0.1]) {
  const f = fixture();
  f.weapon.magazineAmmo = 2; f.weapon.reserveAmmo = 20;
  assert(f.weapon.reload());
  through(f, duration + 0.02, delta);
  assert.deepEqual(f.names(), pistolSounds, `Trois événements uniques au pas ${delta}`);
  assert.equal(f.weapon.getAmmo(), 15);
  assert.equal(f.weapon.getReserveAmmo(), 7);
  assert.equal(f.weapon.getIsReloading(), false);
  f.step(1);
  assert.deepEqual(f.names(), pistolSounds, 'Aucun rejeu après la fin');
  f.weapon.dispose();
}

for (const delta of [1 / 30, 1 / 144, 0.073, 0.8]) {
  const f = fixture(); f.shotgun(); f.fire();
  through(f, 0.8, delta);
  assert.deepEqual(f.names(), pumpSounds);
  assert.equal(f.weapon.getAmmo(), 4);
  f.step(2);
  assert.deepEqual(f.names(), pumpSounds);
  assert.equal(f.weapon.recoilDuration, 2, 'Réglage utilisateur conservé');
  f.weapon.dispose();
}

for (const delta of [1 / 30, 1 / 144, 0.073, 6]) {
  const f = fixture(); f.shotgun();
  f.weapon.magazineAmmo = 0; f.weapon.reserveAmmo = 8;
  const emptyPlays = pooledSounds.filter(src => src.includes('/empty-soft')).length;
  assert(f.weapon.reload());
  through(f, 5 * shotgunReload.duration + 0.02, delta);
  assert.deepEqual(f.names(), Array(5).fill('shell-insert'), 'Un son par cartouche réellement engagée');
  assert.equal(f.weapon.getAmmo(), 5); assert.equal(f.weapon.getReserveAmmo(), 3);
  assert.equal(pooledSounds.filter(src => src.includes('/empty-soft')).length, emptyPlays, 'Le clic vide n’est plus utilisé pour insérer');
  assert.equal(f.weapon.getIsReloading(), false);
  assert(f.weapon.mechanicalAudio.voices.length <= 4);
  f.weapon.dispose();
}

// L'annulation avant/après le commit préserve les munitions et ne programme pas la pompe.
{
  const f = fixture(); f.shotgun(); f.weapon.magazineAmmo = 1;
  f.weapon.reload(); f.step(shotgunReload.commitAt - 0.001); f.weapon.cancelReload();
  assert.deepEqual(f.names(), []); assert.equal(f.weapon.getAmmo(), 1);
  f.weapon.reload(); f.step(shotgunReload.commitAt);
  assert.deepEqual(f.names(), ['shell-insert']); assert.equal(f.weapon.getAmmo(), 2);
  f.weapon.cancelReload(); f.step(1);
  assert.equal(f.weapon.getAmmo(), 2); assert.deepEqual(f.names(), ['shell-insert']);
  f.weapon.reload(); f.step(0.1); f.fire(); f.step(0.8);
  assert.equal(f.weapon.getIsReloading(), false); assert.equal(f.weapon.getAmmo(), 1);
  assert.deepEqual(f.names(), ['shell-insert', ...pumpSounds], 'Le tir qui interrompt le rechargement possède son propre cycle');
  f.weapon.dispose();
}

const interruptions = {
  pause: f => f.setActive(false),
  blur: () => window.dispatchEvent(new Event('blur')),
  pointerlock: () => { document.pointerLockElement = null; document.dispatchEvent(new Event('pointerlockchange')); },
  hidden: () => { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); },
  focus: f => f.setFocus(false),
  suspended: f => f.context.setState('suspended'),
  reset: f => f.weapon.suspendMechanicalAudio(),
  cancel: f => f.weapon.cancelReload(),
  reload: f => f.weapon.reload(),
  switch: f => f.weapon.switchWeapon('pistol'),
};
for (const [reason, interrupt] of Object.entries(interruptions)) {
  const f = fixture(); f.shotgun(); f.fire(); f.step(0.16);
  assert.deepEqual(f.names(), ['pump-back']);
  interrupt(f); f.step(0.01);
  assert.equal(f.weapon.mechanicalAudio.voices.length, 0, `Voix coupées : ${reason}`);
  // Reprendre ne rattrape aucune phase du tir interrompu.
  f.setActive(true); f.setFocus(true); document.hidden = false; document.pointerLockElement = f.canvas;
  f.context.setState('running'); f.step(0.25);
  assert.deepEqual(f.names(), ['pump-back'], `Aucun retour de pompe retardé : ${reason}`);
  f.weapon.dispose();
}

for (const [reason, interrupt] of Object.entries(interruptions).filter(([name]) => !['switch', 'reload'].includes(name))) {
  const f = fixture(); f.weapon.reload(); f.step(0.4);
  assert.deepEqual(f.names(), ['mag-out']);
  interrupt(f); f.step(0.01);
  f.setActive(true); f.setFocus(true); document.hidden = false; document.pointerLockElement = f.canvas;
  f.context.setState('running'); f.step(2);
  assert.deepEqual(f.names(), ['mag-out'], `Aucun reste du chargeur après interruption : ${reason}`);
  f.weapon.dispose();
}

// Initialisation tardive et réglage Effets conservent les niveaux, sans rattrapage.
{
  const f = fixture({ setup: false, volume: 0.25 });
  f.weapon.reload(); f.step(0.7); f.attach(); f.attach();
  assert.equal(requested.filter(mechanicalId).length, 7, 'Un chargement Ogg par prise malgré plusieurs setup, souffle de hache compris');
  assert.equal(f.context.gains[0].gain.value, WEAPON_MECHANICAL_BASE_GAIN * 0.25);
  f.step(1);
  assert.deepEqual(f.names(), ['mag-in', 'seat'], 'Pas de restitution du mag-out passé avant setup');
  f.weapon.magazineAmmo = 4; f.weapon.setEffectsVolume(0); f.weapon.reload(); f.step(2);
  assert.deepEqual(f.names(), ['mag-in', 'seat']);
  assert.equal(f.weapon.mechanicalAudio.gain.gain.value, 0);
  f.weapon.setEffectsVolume(1); f.step(1);
  assert.deepEqual(f.names(), ['mag-in', 'seat'], 'Démuter ne rejoue pas les événements passés');
  f.weapon.dispose();
}

// Budget, callbacks de fin retardés et libération de toutes les ressources possédées.
{
  const context = new FakeContext(); const destination = new Node();
  const audio = new WeaponMechanicalAudio(context, destination);
  assert.equal(context.gains[0].connections[0], destination);
  for (let i = 0; i < 20; i++) audio.play('pump-back');
  assert.equal(audio.voices.length, 4);
  assert.equal(context.sources.filter(source => !source.stopped).length, 4);
  assert(context.sources.slice(0, 16).every(source => source.stopped && source.disconnected && source.buffer === null));
  const pending = [...audio.voices];
  const staleCallbacks = pending.map(voice => voice.source.onended);
  audio.setVolume(0); assert.equal(audio.voices.length, 0);
  audio.play('seat'); assert.equal(context.starts.length, 20);
  audio.setVolume(1); context.state = 'suspended'; audio.play('seat'); assert.equal(context.starts.length, 20);
  context.state = 'running'; audio.play('seat');
  for (const callback of staleCallbacks) callback();
  assert.equal(audio.voices.length, 1, 'Une ancienne fin ne libère pas une nouvelle voix');
  audio.dispose(); audio.dispose(); audio.play('seat');
  assert.equal(audio.voices.length, 0); assert.equal(audio.disposed, true);
  assert(context.gains[0].disconnected);
  assert(pending.every(voice => voice.source.stopped && voice.source.disconnected && voice.source.buffer === null));
}
{
  const f = fixture(); f.shotgun(); f.fire(); f.step(0.16);
  const context = f.context; const count = context.starts.length;
  f.weapon.dispose(); f.weapon.dispose();
  const event = new Event('mousedown'); Object.defineProperty(event, 'button', { value: 0 });
  f.canvas.dispatchEvent(event); f.weapon.update(2); f.weapon.setupMechanicalAudio(context, f.destination);
  assert.equal(context.starts.length, count); assert.equal(f.weapon.reload(), false);
  assert.equal(f.weapon.mechanicalAudio, null); assert.equal(f.weapon.removeInputListeners.length, 0);
  assert(context.sources.every(source => source.stopped && source.disconnected));
}

// Sources WAV fournies et Ogg servis : niveau borné au plafond de l'ancienne synthèse après atténuation.
const stats = [];
for (const id of WEAPON_MECHANICAL_SOUND_IDS) {
  const { channels, rate, bits, samples } = sources[id];
  assert.deepEqual([channels, rate, bits], [1, 44100, 16], `${id} : mono 16 bits 44,1 kHz`);
  const ogg = fs.readFileSync(`public/assets/sounds/${id}.ogg`);
  assert.equal(ogg.toString('ascii', 0, 4), 'OggS', `${id}.ogg servi`);
  let peak = 0; let energy = 0;
  for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  const rms = Math.sqrt(energy / samples.length);
  const trim = WEAPON_MECHANICAL_TRIMS[id];
  assert(trim > 0 && trim <= 1, 'Atténuation seulement');
  assert(peak < 0.72 && rms > 0.04 && rms * trim <= 0.116, 'Sources sans écrêtage, audibles et sous le plafond RMS');
  stats.push({ id, seconds: Number((samples.length / rate).toFixed(3)), peak: Number(peak.toFixed(4)), rms: Number(rms.toFixed(4)), trim });
}
assert.equal(WEAPON_MECHANICAL_BASE_GAIN, 0.14);
console.table(stats);
console.log('PASS : événements réels uniques 30/144 Hz, gros deltas, stocks/commit exacts, interruptions sans reprise, Effets/init tardive, sept prises WAV/Ogg bornées et quatre voix maximum. Aucune écoute ni validation artistique effectuée.');
