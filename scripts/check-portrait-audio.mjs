import assert from 'node:assert/strict';
import { createPortraitSamples, PortraitAudio, PORTRAIT_AUDIO_DURATIONS, PORTRAIT_AUDIO_BASE_GAIN } from '../src/PortraitAudio.ts';

for (const sampleRate of [44100, 48000]) {
  const stages = {};
  for (const stage of ['gather', 'burst']) {
    const samples = createPortraitSamples(stage, sampleRate);
    assert.equal(samples.length, Math.ceil(sampleRate * PORTRAIT_AUDIO_DURATIONS[stage]));
    assert.equal(samples[0], 0); assert.equal(samples.at(-1), 0);
    assert.ok(samples.every(Number.isFinite));
    assert.ok(samples.every(v => Math.abs(v) <= 0.75));
    const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
    assert.ok(rms > 0.015 && rms < 0.3, 'Signal réel et niveau borné avant le gain discret');
    const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    assert.ok(Math.abs(mean) < 0.01, 'Pas de décalage continu marqué');
    assert.deepEqual(samples, createPortraitSamples(stage, sampleRate), 'Synthèse originale reproductible');
    stages[stage] = samples;
  }
  assert.notEqual(stages.gather.length, stages.burst.length, 'Deux soutiens distincts');
}

class Param {
  value = 0;
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
}
class Node {
  connections = new Set();
  connect(destination) { this.connections.add(destination); }
  disconnect() { this.connections.clear(); }
}
class Source extends Node {
  onended = null; buffer = null; started = 0; stopped = 0;
  start() { this.started++; }
  stop() { this.stopped++; }
}
function fixture() {
  const sources = [], gains = [], panners = [];
  let buffers = 0;
  const context = {
    sampleRate: 48000, currentTime: 10, state: 'running',
    createBuffer(_channels, length) { buffers++; const data = new Float32Array(length); return { getChannelData: () => data }; },
    createBufferSource() { const source = new Source(); sources.push(source); return source; },
    createGain() { const gain = Object.assign(new Node(), { gain: new Param() }); gains.push(gain); return gain; },
    createPanner() { const panner = Object.assign(new Node(), { positionX: new Param(), positionY: new Param(), positionZ: new Param() }); panners.push(panner); return panner; },
  };
  const input = new Node(), listener = { context, getInput: () => input };
  return { context, listener, sources, gains, panners, buffers: () => buffers };
}
const f = fixture();
const audio = new PortraitAudio(f.listener);
const other = new PortraitAudio(f.listener);
assert.equal(f.buffers(), 2, 'Buffers préparés une seule fois sur un même contexte');
const separate = fixture(); new PortraitAudio(separate.listener).dispose();
assert.equal(separate.buffers(), 2, 'Un autre contexte possède ses propres buffers');
assert.equal(f.sources.length, 0, 'Le constructeur ne lance rien');
const position = { x: 4, y: 1.4, z: -8 };
f.context.state = 'suspended'; audio.play('gather', position);
assert.equal(f.sources.length, 0, 'Aucun son différé avant le geste/reprise du contexte');
f.context.state = 'running'; audio.play('gather', position);
assert.equal(f.sources.length, 1); assert.equal(f.sources[0].started, 1);
assert.equal(f.panners[0].positionX.value, position.x); assert.equal(f.panners[0].positionZ.value, position.z);
audio.play('burst', position);
assert.equal(f.sources.length, 2); assert.equal(f.sources[0].stopped, 1);
assert.equal(f.sources[0].connections.size, 0); assert.equal(f.sources[0].buffer, null);
assert.equal(f.sources.filter(s => s.started && !s.stopped).length, 1, 'Une seule source à la fois');
const ended = f.sources[1]; ended.onended();
assert.equal(ended.connections.size, 0); assert.equal(ended.buffer, null);
audio.stop(); assert.equal(ended.stopped, 0, 'Stop après fin naturelle sans arrêter deux fois');
audio.setVolume(9); assert.equal(f.gains[0].gain.value, PORTRAIT_AUDIO_BASE_GAIN);
audio.play('gather', position); audio.setVolume(-1);
assert.equal(f.sources[2].stopped, 1); assert.equal(f.gains[0].gain.value, 0);
audio.play('burst', position); assert.equal(f.sources.length, 3, 'Silence au volume nul');
audio.setVolume(NaN); assert.equal(f.gains[0].gain.value, 0);
audio.setVolume(0.5); audio.play('burst', { x: NaN, y: 0, z: 0 });
assert.equal(f.sources.length, 3, 'Position invalide refusée');
audio.play('burst', position); audio.stop(); audio.stop();
assert.equal(f.sources[3].stopped, 1);
audio.play('gather', position); audio.dispose(); audio.dispose();
assert.equal(f.sources[4].stopped, 1);
assert.equal(f.panners[0].connections.size, 0); assert.equal(f.gains[0].connections.size, 0);
audio.play('gather', position); assert.equal(f.sources.length, 5, 'Aucune reprise après destruction');
other.dispose();
console.log('Portrait audio : synthèse bornée/reproductible, cache par contexte, voix unique, suspension, volume et nettoyage OK. Écoute non vérifiée.');
