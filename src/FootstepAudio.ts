import { MANSION_RAMPS } from './MansionConfig.ts';
import { MANSION_CARPETS } from './MansionFloorSurfaces.ts';

export type FootstepSurface = 'wood' | 'carpet' | 'stairs';
interface FootstepPosition { x: number; z: number }

export function getFootstepSurfaceAt(x: number, z: number): FootstepSurface {
  if (MANSION_RAMPS.some(ramp => x >= ramp.minX && x <= ramp.maxX && z >= ramp.minZ && z <= ramp.maxZ)) return 'stairs';
  if (MANSION_CARPETS.some(runner => Math.abs(x - runner.x) <= runner.width / 2 && Math.abs(z - runner.z) <= runner.depth / 2)) return 'carpet';
  return 'wood';
}

export const FOOTSTEP_DURATIONS = { wood: 0.16, carpet: 0.14, stairs: 0.18 } as const;
export const FOOTSTEP_BASE_GAIN = 0.06;

/** Synthèse locale d'appuis : talon sec (claquement aigu), corps sourd, léger frottement. Aucun téléchargement. */
export function createFootstepSamples(surface: FootstepSurface, sampleRate: number): Float32Array {
  const duration = FOOTSTEP_DURATIONS[surface];
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = surface === 'wood' ? 173 : surface === 'carpet' ? 479 : 829;
  let low = 0, high = 0;
  const frequency = surface === 'carpet' ? 82 : surface === 'stairs' ? 150 : 118;
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * (surface === 'carpet' ? 260 : 700) / sampleRate);
  const highAlpha = 1 - Math.exp(-2 * Math.PI * 1800 / sampleRate);
  const clickTau = surface === 'carpet' ? 0.012 : 0.0045;
  const clickGain = surface === 'carpet' ? 0.22 : surface === 'stairs' ? 0.62 : 0.55;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0x80000000 - 1;
    low += (noise - low) * lowAlpha;
    high += (noise - high) * highAlpha;
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.0008);
    const tail = Math.max(0, 1 - t / duration) ** 1.5;
    const body = Math.sin(2 * Math.PI * frequency * (t - 2.2 * t * t)) * Math.exp(-t * (surface === 'carpet' ? 34 : 26));
    const knock = low * Math.exp(-t * 55) * 0.9;
    const click = (noise - high) * Math.exp(-t / clickTau) * clickGain;
    const toe = t > 0.052 ? (noise - high) * Math.exp(-(t - 0.052) / 0.006) * clickGain * 0.35 : 0;
    samples[i] = (body * 0.75 + knock + click + toe) * attack * tail * 0.7;
  }
  samples[0] = 0;
  samples[samples.length - 1] = 0;
  return samples;
}

interface FootstepVoice {
  source: AudioBufferSourceNode;
  pan: StereoPannerNode;
}

export class FootstepAudio {
  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private buffers: Record<FootstepSurface, AudioBuffer> | null;
  private readonly voices: FootstepVoice[] = [];
  private previous: FootstepPosition | null = null;
  private distance = 0;
  private foot = 0;
  private volume = 1;
  private disposed = false;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = FOOTSTEP_BASE_GAIN;
    this.gain.connect(destination);
    const makeBuffer = (surface: FootstepSurface) => {
      const samples = createFootstepSamples(surface, context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      return buffer;
    };
    this.buffers = { wood: makeBuffer('wood'), carpet: makeBuffer('carpet'), stairs: makeBuffer('stairs') };
  }

  public setVolume(volume: number): void {
    if (this.disposed || !Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    this.gain.gain.setTargetAtTime(this.volume * FOOTSTEP_BASE_GAIN, this.context.currentTime, 0.012);
    if (this.volume === 0) this.reset();
  }

  public update(delta: number, position: FootstepPosition, active: boolean): void {
    if (this.disposed) return;
    if (!active || this.context.state !== 'running' || this.volume === 0 || !Number.isFinite(delta) || delta <= 0 || delta > 0.15 || !Number.isFinite(position.x) || !Number.isFinite(position.z)) {
      this.reset();
      return;
    }
    const previous = this.previous;
    this.previous = { x: position.x, z: position.z };
    if (!previous) return;
    const moved = Math.hypot(position.x - previous.x, position.z - previous.z);
    // Un saut debug ou une téléportation ne représente pas un appui du joueur.
    if (moved > Math.max(1.5, delta * 24)) { this.distance = 0; return; }
    if (moved < 0.0001) return;
    const speed = moved / delta;
    const stride = 1.9 + Math.min(1, Math.max(0, (speed - 5) / 4)) * 0.7;
    this.distance += moved;
    if (this.distance + 1e-9 < stride) return;
    this.distance = Math.max(0, this.distance - stride);
    this.play(getFootstepSurfaceAt(position.x, position.z));
  }

  private play(surface: FootstepSurface): void {
    if (this.voices.length === 2) this.stopVoice(this.voices[0]);
    const source = this.context.createBufferSource();
    const pan = this.context.createStereoPanner();
    source.buffer = this.buffers![surface];
    source.playbackRate.value = [0.98, 1.025, 1.01, 0.965][this.foot % 4];
    pan.pan.value = this.foot % 2 === 0 ? -0.12 : 0.12;
    this.foot++;
    const voice = { source, pan };
    source.connect(pan);
    pan.connect(this.gain);
    source.onended = () => this.releaseVoice(voice);
    this.voices.push(voice);
    source.start();
  }

  private releaseVoice(voice: FootstepVoice): void {
    const index = this.voices.indexOf(voice);
    if (index !== -1) this.voices.splice(index, 1);
    voice.source.onended = null;
    voice.source.disconnect();
    voice.source.buffer = null;
    voice.pan.disconnect();
  }

  private stopVoice(voice: FootstepVoice): void {
    voice.source.onended = null;
    voice.source.stop();
    this.releaseVoice(voice);
  }

  public reset(): void {
    this.previous = null;
    this.distance = 0;
    for (const voice of [...this.voices]) this.stopVoice(voice);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.gain.disconnect();
    this.buffers = null;
    this.disposed = true;
  }
}
