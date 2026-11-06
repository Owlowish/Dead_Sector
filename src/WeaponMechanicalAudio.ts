import type { WeaponMechanicalSoundId } from './WeaponSoundEvents.ts';

export const WEAPON_MECHANICAL_BASE_GAIN = 0.04;
export const WEAPON_MECHANICAL_DURATIONS = {
  'mag-out': 0.16,
  'mag-in': 0.14,
  seat: 0.085,
  'shell-insert': 0.11,
  'pump-back': 0.2,
  'pump-forward': 0.18,
  'axe-swing': 0.28,
} as const;

const timbres: Record<WeaponMechanicalSoundId, { seed: number; scrape: number; clickAt: number; body: number }> = {
  'mag-out': { seed: 137, scrape: 0.62, clickAt: 0.018, body: 300 },
  'mag-in': { seed: 293, scrape: 0.53, clickAt: 0.096, body: 350 },
  seat: { seed: 419, scrape: 0.16, clickAt: 0.012, body: 380 },
  'shell-insert': { seed: 643, scrape: 0.32, clickAt: 0.046, body: 270 },
  'pump-back': { seed: 827, scrape: 0.74, clickAt: 0.13, body: 240 },
  'pump-forward': { seed: 1019, scrape: 0.63, clickAt: 0.132, body: 320 },
  'axe-swing': { seed: 1237, scrape: 0.8, clickAt: 1, body: 120 },
};

/** Frottement filtré et contact amorti, sans oscillateur aigu ni impulsion abrupte. */
export function createWeaponMechanicalSamples(id: WeaponMechanicalSoundId, sampleRate: number): Float32Array {
  const duration = WEAPON_MECHANICAL_DURATIONS[id];
  const timbre = timbres[id];
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = timbre.seed;
  let low = 0;
  let smooth = 0;
  // Les filtres suivent le temps en secondes, y compris à 44,1 kHz.
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * 260 / sampleRate);
  const smoothAlpha = 1 - Math.exp(-2 * Math.PI * 2200 / sampleRate);
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0x80000000 - 1;
    low += (noise - low) * lowAlpha;
    smooth += (noise - smooth) * smoothAlpha;
    const t = i / sampleRate;
    const u = i / (samples.length - 1);
    const edge = Math.min(1, t / 0.005, (duration - t) / 0.012);
    const envelope = Math.sin(Math.PI * Math.max(0, edge) / 2) ** 2;
    const scrape = Math.sin(Math.PI * u) ** 1.2 * timbre.scrape;
    const contactTime = t - timbre.clickAt;
    const contact = contactTime <= 0 ? 0
      : (1 - Math.exp(-contactTime / 0.0025)) * Math.exp(-contactTime / 0.018);
    const friction = (smooth - low) * (scrape + contact * 0.75);
    const body = (low * 0.7 + Math.sin(2 * Math.PI * timbre.body * Math.max(0, contactTime)) * 0.07) * contact;
    samples[i] = Math.max(-0.65, Math.min(0.65, (friction + body) * envelope));
  }
  samples[0] = 0;
  samples[samples.length - 1] = 0;
  return samples;
}

interface MechanicalVoice { source: AudioBufferSourceNode }

/** Six buffers mono et quatre sources au plus, sur le contexte audio déjà possédé par le joueur. */
export class WeaponMechanicalAudio {
  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private buffers: Record<WeaponMechanicalSoundId, AudioBuffer> | null;
  private readonly voices: MechanicalVoice[] = [];
  private volume = 1;
  private disposed = false;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = WEAPON_MECHANICAL_BASE_GAIN;
    this.gain.connect(destination);
    this.buffers = Object.fromEntries(
      (Object.keys(WEAPON_MECHANICAL_DURATIONS) as WeaponMechanicalSoundId[]).map(id => {
        const samples = createWeaponMechanicalSamples(id, context.sampleRate);
        const buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.getChannelData(0).set(samples);
        return [id, buffer];
      })
    ) as Record<WeaponMechanicalSoundId, AudioBuffer>;
  }

  public setVolume(volume: number): void {
    if (this.disposed || !Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    this.gain.gain.setTargetAtTime(this.volume * WEAPON_MECHANICAL_BASE_GAIN, this.context.currentTime, 0.012);
    if (this.volume === 0) this.suspend();
  }

  public play(id: WeaponMechanicalSoundId): void {
    // Aucun son n'est mis en attente pendant une suspension ou avant le geste suivant.
    if (this.disposed || !this.buffers || this.volume === 0 || this.context.state !== 'running') return;
    if (this.voices.length >= 4) this.stopVoice(this.voices[0]);
    const source = this.context.createBufferSource();
    source.buffer = this.buffers[id];
    const voice = { source };
    source.connect(this.gain);
    source.onended = () => this.releaseVoice(voice);
    this.voices.push(voice);
    source.start();
  }

  private releaseVoice(voice: MechanicalVoice): void {
    const index = this.voices.indexOf(voice);
    if (index !== -1) this.voices.splice(index, 1);
    voice.source.onended = null;
    voice.source.disconnect();
    voice.source.buffer = null;
  }

  private stopVoice(voice: MechanicalVoice): void {
    voice.source.onended = null;
    voice.source.stop();
    this.releaseVoice(voice);
  }

  public suspend(): void {
    for (const voice of [...this.voices]) this.stopVoice(voice);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.suspend();
    this.gain.disconnect();
    this.buffers = null;
    this.disposed = true;
  }
}
