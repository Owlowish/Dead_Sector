import type { Vector3 } from 'three';
import type { AudioManager } from './AudioManager.ts';

const gains = {
  'door-open': 0.27,
  'door-close': 0.27,
  'empty-soft': 0.4,
  'unlock-click': 0.5,
  'pickup-ammo': 0.28,
  'pickup-medkit': 0.3,
  'pickup-weapon': 0.32,
  'zombie-hurt': 0.23,
  'zombie-death': 0.3,
  'zombie-rise': 0.3,
  'spit-launch': 0.36,
  'spit-impact': 0.27,
  'portrait-blade-launch': 0.36,
  'portrait-blade-impact': 0.16,
  'player-hurt': 0.34,
  'player-hurt-2': 0.34,
  heartbeat: 0.15,
} as const;

type SoundId = keyof typeof gains;

/** Sons ponctuels du manoir, sur le contexte du jeu et le canal Effets ; buffers fournis par l'AudioManager. */
export class SoundEffects {
  private readonly audio: AudioManager;
  private readonly context: AudioContext;
  private readonly master: GainNode;
  private readonly voices = new Map<AudioBufferSourceNode, { gain: GainNode; panner?: PannerNode }>();
  private active = false;
  private disposed = false;
  private volume = 1;
  private heartbeat: AudioBufferSourceNode | null = null;
  private nextHurt: 'player-hurt' | 'player-hurt-2' = 'player-hurt';

  constructor(audio: AudioManager) {
    this.audio = audio;
    this.context = audio.context;
    this.master = this.context.createGain();
    this.master.connect(audio.listener.getInput());
    this.preload();
  }

  /** Demande les buffers au gestionnaire ; à rappeler après un `AudioManager.clear()`. */
  preload(): void {
    if (this.disposed) return;
    for (const id of Object.keys(gains) as SoundId[]) void this.audio.load(id);
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (!active) this.stop();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.015);
    if (volume === 0) this.stop();
  }

  play(id: Exclude<SoundId, 'heartbeat'>, position?: Vector3): void {
    this.start(id, position);
  }

  playPlayerHurt(): void {
    if (this.start(this.nextHurt)) {
      this.nextHurt = this.nextHurt === 'player-hurt' ? 'player-hurt-2' : 'player-hurt';
    }
  }

  setHeartbeat(enabled: boolean): void {
    if (enabled && !this.heartbeat) this.heartbeat = this.start('heartbeat');
    if (!enabled && this.heartbeat) this.release(this.heartbeat, true);
  }

  private start(id: SoundId, position?: Vector3): AudioBufferSourceNode | null {
    const buffer = this.audio.getBuffer(id);
    if (!buffer || !this.active || this.disposed || this.volume === 0
      || this.context.state !== 'running' || this.voices.size >= 12) return null;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = id === 'heartbeat';
    const gain = this.context.createGain();
    gain.gain.value = gains[id];
    source.connect(gain);
    const voice: { gain: GainNode; panner?: PannerNode } = { gain };
    if (position) {
      const panner = this.context.createPanner();
      panner.refDistance = 2.5;
      panner.rolloffFactor = 1.3;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      gain.connect(panner);
      voice.panner = panner;
    }
    (voice.panner ?? gain).connect(this.master);
    this.voices.set(source, voice);
    source.onended = () => this.release(source, false);
    source.start();
    return source;
  }

  private release(source: AudioBufferSourceNode, stop: boolean): void {
    const voice = this.voices.get(source);
    if (!voice) return;
    this.voices.delete(source);
    if (this.heartbeat === source) this.heartbeat = null;
    source.onended = null;
    if (stop) source.stop();
    source.disconnect();
    voice.gain.disconnect();
    voice.panner?.disconnect();
  }

  stop(): void {
    for (const source of this.voices.keys()) this.release(source, true);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.master.disconnect();
  }
}
