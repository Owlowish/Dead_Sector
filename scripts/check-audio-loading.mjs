import assert from 'node:assert/strict';
import { Music } from '../src/Music.ts';

class Node {
  gain = { value: 1, setTargetAtTime(value) { this.value = value; } };
  connections = []; disconnected = false;
  connect(node) { this.connections.push(node); }
  disconnect() { this.disconnected = true; }
}
class Context extends EventTarget {
  state = 'running'; currentTime = 0; decodes = 0; sources = []; mediaSources = [];
  createGain() { return new Node(); }
  async decodeAudioData(data) { this.decodes++; return { duration: 0.3, bytes: data.byteLength }; }
  createBufferSource() {
    const source = Object.assign(new Node(), { stopped: false, buffer: null,
      start() { assert(this.buffer); }, stop() { assert(!this.stopped); this.stopped = true; this.onended?.(); } });
    this.sources.push(source); return source;
  }
  createMediaElementSource(media) { const source = new Node(); source.media = media; this.mediaSources.push(source); return source; }
}
const context = new Context(), output = new Node();
const warn = console.warn;

let refuse = false, failMedia = false, pending = [];
globalThis.Audio = class extends EventTarget {
  src = ''; preload = ''; loop = false; paused = true; ended = false; currentTime = 0; starts = 0;
  load() { if (this.src) queueMicrotask(() => this.dispatchEvent(new Event(failMedia ? 'error' : 'canplay'))); }
  play() {
    this.starts++;
    if (refuse) return Promise.reject(new DOMException('Refused', 'NotAllowedError'));
    this.paused = false;
    return new Promise(resolve => pending.push(resolve));
  }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
};
const music = new Music(context, output);
await music.preload('menu', 'main', 'boss1');
music.setVolume(.5, 1); music.select('main', true);
assert.equal(music.playback.get('main').media.starts, 0, 'Rien ne joue avant le geste');
const activating = music.activate(); assert.equal(music.activate(), activating);
assert.equal(music.playback.size, 8);
assert([...music.playback.values()].every(p => p.gate.gain.value === 0), 'Préparation inaudible');
pending.splice(0).forEach(resolve => resolve()); await activating;
assert.equal(music.playback.get('main').gate.gain.value, 1);
assert.equal([...music.playback.values()].filter(p => !p.media.paused).length, 1);
pending.splice(0).forEach(resolve => resolve());
const main = music.playback.get('main').media;
main.currentTime = 23.25; music.select('pause', true);
assert.equal(main.paused, true); assert.equal(main.currentTime, 23.25);
music.select('main', true); assert.equal(main.currentTime, 23.25);
for (const state of ['suspended', 'interrupted']) {
  context.state = state; context.dispatchEvent(new Event('statechange'));
  assert.equal(main.paused, true, `${state} fige le lecteur natif sans dépendre du focus`);
  assert.equal(main.currentTime, 23.25);
  const starts = main.starts;
  context.state = 'running'; context.dispatchEvent(new Event('statechange'));
  assert.equal(main.paused, false); assert.equal(main.starts, starts + 1);
  assert.equal(main.currentTime, 23.25, 'La reprise du contexte conserve la position');
}

music.select('main', false); assert.equal(main.paused, true);
const inactiveStarts = main.starts;
context.state = 'suspended'; context.dispatchEvent(new Event('statechange'));
context.state = 'running'; context.dispatchEvent(new Event('statechange'));
assert.equal(main.paused, true); assert.equal(main.starts, inactiveStarts, 'Pas de reprise si le jeu avait coupé la musique');

music.rewind('main'); assert.equal(main.currentTime, 0);
music.select('victory', true); const victory = music.playback.get('victory').media;
assert.equal(victory.loop, false); victory.ended = true; victory.paused = true;
const victoryStarts = victory.starts; music.select('victory', false); music.select('victory', true);
assert.equal(victory.starts, victoryStarts, 'Pas de rejeu après fin naturelle');
assert.equal(context.decodes, 0, 'Aucune musique longue décodée en AudioBuffer');
music.dispose(); assert(context.mediaSources.every(s => s.disconnected && s.media.src === ''));
assert.equal(music.playback.size, 0);
refuse = true;
const denied = new Music(context, output); await denied.activate();
assert([...denied.playback.values()].every(p => !p.unlocked));
refuse = false;
const retry = denied.activate(); pending.splice(0).forEach(resolve => resolve()); await retry;
assert([...denied.playback.values()].every(p => p.unlocked), 'Un nouveau geste réessaie après refus');
assert([...denied.playback.values()].every(p => p.media.starts === 2));
denied.dispose();
failMedia = true; console.warn = () => {};
const missingMusic = new Music(context, output); await missingMusic.preload('defeat');
assert.deepEqual(missingMusic.unavailableTracks, ['defeat']); missingMusic.dispose();
failMedia = false; console.warn = warn;
console.log('PASS musique : streaming sans AudioBuffer, préparation silencieuse, reprise après pause/interruption, fin naturelle, refus et destruction. Effets couverts par check-audio-manager.');
