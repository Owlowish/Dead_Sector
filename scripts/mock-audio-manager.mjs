// Contexte Web Audio simulé pour les contrôles Node : l'AudioManager réel, ses réserves et ses sons spatiaux.
import * as THREE from 'three';
import { AudioManager } from '../src/AudioManager.ts';

export function installMockAudio({ duration = () => 1 } = {}) {
  const played = [];
  const sources = [];
  const param = (value = 1) => ({
    value,
    setTargetAtTime(next) { this.value = next; },
    setValueAtTime(next) { this.value = next; },
    linearRampToValueAtTime(next) { this.value = next; },
  });
  const node = (extra = {}) => ({ connected: true, connect() { this.connected = true; }, disconnect() { this.connected = false; }, ...extra });
  const context = {
    currentTime: 0,
    state: 'running',
    createGain: () => node({ gain: param() }),
    createPanner: () => node(Object.fromEntries(['positionX', 'positionY', 'positionZ', 'orientationX', 'orientationY', 'orientationZ'].map((key) => [key, param(0)]))),
    createBufferSource: () => {
      const source = node({
        buffer: null, detune: param(0), playbackRate: param(1), stopped: false,
        start() { played.push(this.buffer.url); },
        stop() { this.stopped = true; },
      });
      sources.push(source);
      return source;
    },
  };
  const listener = { context, getInput: () => node(), removeFromParent() {} };
  const requested = [];
  THREE.AudioLoader.prototype.load = function (url, onLoad) {
    requested.push(url);
    onLoad({ url, duration: duration(url) });
  };
  const manager = AudioManager.install(listener);
  manager.preloadPools();
  return { manager, played, sources, requested, context, listener };
}
