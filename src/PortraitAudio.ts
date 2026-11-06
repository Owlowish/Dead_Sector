import type { AudioListener, Vector3 } from 'three';

export type PortraitSoundStage = 'gather' | 'burst';
export const PORTRAIT_AUDIO_DURATIONS = { gather: 0.38, burst: 0.5 } as const;
export const PORTRAIT_AUDIO_BASE_GAIN = 0.18;

/** Bois sous tension puis cadre rompu/toile déchirée : bruit filtré original, sans fichier. */
export function createPortraitSamples(stage: PortraitSoundStage, sampleRate: number): Float32Array {
  const duration = PORTRAIT_AUDIO_DURATIONS[stage];
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = stage === 'gather' ? 3751 : 8219;
  let low = 0, high = 0;
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
  const highAlpha = 1 - Math.exp(-2 * Math.PI * 2400 / sampleRate);
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0x80000000 - 1;
    low += (noise - low) * lowAlpha;
    high += (noise - high) * highAlpha;
    const t = i / sampleRate, u = t / duration;
    const edges = Math.min(1, t / 0.006, (duration - t) / 0.025);
    const envelope = Math.sin(Math.PI * Math.max(0, edges) / 2) ** 2;
    const tension = Math.sin(Math.PI * u) ** 1.4 * (0.45 + 0.2 * Math.sin(t * 73));
    const snap = Math.exp(-Math.max(0, t - 0.012) * 55) * Math.min(1, t / 0.012);
    const tear = Math.exp(-t * 5) * (0.65 + 0.25 * Math.sin(t * 91));
    const body = Math.sin(2 * Math.PI * (115 * t - 38 * t * t));
    const value = stage === 'gather'
      ? ((high - low) * 0.7 + low * 0.65 + body * 0.05) * tension
      : (high - low) * (snap * 0.85 + tear * 0.5) + (low * 0.8 + body * 0.13) * snap;
    samples[i] = Math.max(-0.75, Math.min(0.75, value * envelope));
  }
  samples[0] = 0;
  samples[samples.length - 1] = 0;
  return samples;
}

const sharedBuffers = new WeakMap<AudioContext, Record<PortraitSoundStage, AudioBuffer>>();

/** Une voix spatiale au plus sur le contexte existant ; aucune lecture mise en attente. */
export class PortraitAudio {
  private readonly context: AudioContext;
  private readonly panner: PannerNode;
  private readonly gain: GainNode;
  private readonly buffers: Record<PortraitSoundStage, AudioBuffer>;
  private source: AudioBufferSourceNode | null = null;
  private volume = 1;
  private disposed = false;

  constructor(listener: AudioListener) {
    this.context = listener.context;
    this.panner = this.context.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 2.5;
    this.panner.rolloffFactor = 1.4;
    this.gain = this.context.createGain();
    this.gain.gain.value = PORTRAIT_AUDIO_BASE_GAIN;
    this.panner.connect(this.gain);
    this.gain.connect(listener.getInput());
    let buffers = sharedBuffers.get(this.context);
    if (!buffers) {
      buffers = Object.fromEntries((['gather', 'burst'] as const).map(stage => {
        const samples = createPortraitSamples(stage, this.context.sampleRate);
        const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
        buffer.getChannelData(0).set(samples);
        return [stage, buffer];
      })) as Record<PortraitSoundStage, AudioBuffer>;
      sharedBuffers.set(this.context, buffers);
    }
    this.buffers = buffers;
  }

  setVolume(volume: number): void {
    if (this.disposed || !Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    this.gain.gain.setTargetAtTime(this.volume * PORTRAIT_AUDIO_BASE_GAIN, this.context.currentTime, 0.012);
    if (this.volume === 0) this.stop();
  }

  play(stage: PortraitSoundStage, position: Vector3): void {
    if (this.disposed || this.volume === 0 || this.context.state !== 'running'
      || ![position.x, position.y, position.z].every(Number.isFinite)) return;
    this.stop();
    const now = this.context.currentTime;
    this.panner.positionX.setValueAtTime(position.x, now);
    this.panner.positionY.setValueAtTime(position.y, now);
    this.panner.positionZ.setValueAtTime(position.z, now);
    const source = this.context.createBufferSource();
    source.buffer = this.buffers[stage];
    source.connect(this.panner);
    source.onended = () => {
      if (this.source === source) this.source = null;
      source.onended = null;
      source.disconnect();
      source.buffer = null;
    };
    this.source = source;
    source.start();
  }

  stop(): void {
    const source = this.source;
    if (!source) return;
    this.source = null;
    source.onended = null;
    source.stop();
    source.disconnect();
    source.buffer = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.panner.disconnect();
    this.gain.disconnect();
    this.disposed = true;
  }
}
