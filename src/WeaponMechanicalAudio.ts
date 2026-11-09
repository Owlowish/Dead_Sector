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

type MechanicalEvent =
  | { kind: 'click' | 'thunk'; at: number; frequency: number; decay: number; gain: number }
  | { kind: 'scrape'; at: number; end: number; gain: number };

const gestures: Record<WeaponMechanicalSoundId, { seed: number; events: readonly MechanicalEvent[] }> = {
  // Bouton de retenue, sortie du chargeur et choc à la libération.
  'mag-out': { seed: 137, events: [
    { kind: 'click', at: 0.003, frequency: 2600, decay: 0.012, gain: 0.9 },
    { kind: 'scrape', at: 0.025, end: 0.112, gain: 0.5 },
    { kind: 'click', at: 0.118, frequency: 1800, decay: 0.01, gain: 0.5 },
    { kind: 'thunk', at: 0.12, frequency: 150, decay: 0.02, gain: 0.4 },
  ] },
  // Glissement du nouveau chargeur, butée et verrou.
  'mag-in': { seed: 293, events: [
    { kind: 'scrape', at: 0, end: 0.085, gain: 0.45 },
    { kind: 'thunk', at: 0.092, frequency: 180, decay: 0.03, gain: 0.8 },
    { kind: 'click', at: 0.094, frequency: 2200, decay: 0.012, gain: 1 },
    { kind: 'click', at: 0.112, frequency: 3100, decay: 0.008, gain: 0.4 },
  ] },
  seat: { seed: 419, events: [
    { kind: 'click', at: 0.006, frequency: 1500, decay: 0.02, gain: 1 },
    { kind: 'thunk', at: 0.008, frequency: 220, decay: 0.025, gain: 0.7 },
    { kind: 'click', at: 0.045, frequency: 3400, decay: 0.008, gain: 0.5 },
  ] },
  'shell-insert': { seed: 643, events: [
    { kind: 'click', at: 0.004, frequency: 2900, decay: 0.015, gain: 0.7 },
    { kind: 'scrape', at: 0.01, end: 0.04, gain: 0.25 },
    { kind: 'click', at: 0.05, frequency: 2000, decay: 0.02, gain: 0.9 },
    { kind: 'thunk', at: 0.052, frequency: 260, decay: 0.02, gain: 0.5 },
    { kind: 'click', at: 0.072, frequency: 3600, decay: 0.006, gain: 0.35 },
  ] },
  'pump-back': { seed: 827, events: [
    { kind: 'scrape', at: 0, end: 0.12, gain: 0.6 },
    { kind: 'click', at: 0.125, frequency: 1700, decay: 0.025, gain: 1 },
    { kind: 'thunk', at: 0.127, frequency: 200, decay: 0.04, gain: 0.6 },
  ] },
  'pump-forward': { seed: 1019, events: [
    { kind: 'scrape', at: 0, end: 0.115, gain: 0.55 },
    { kind: 'thunk', at: 0.125, frequency: 170, decay: 0.05, gain: 1 },
    { kind: 'click', at: 0.126, frequency: 1400, decay: 0.03, gain: 1 },
    { kind: 'click', at: 0.15, frequency: 3000, decay: 0.01, gain: 0.4 },
  ] },
  'axe-swing': { seed: 1237, events: [] },
};

function fitSamples(raw: Float32Array, samples: Float32Array, drive: number): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.tanh(raw[i] * drive);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const normalization = 0.62 / (peak || 1);
  let energy = 0;
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= normalization;
    energy += samples[i] * samples[i];
  }
  return Math.sqrt(energy / samples.length);
}

/** Les déclics, frottements et butées se succèdent à l'intérieur de chaque son. */
export function createWeaponMechanicalSamples(id: WeaponMechanicalSoundId, sampleRate: number): Float32Array {
  const duration = WEAPON_MECHANICAL_DURATIONS[id];
  const gesture = gestures[id];
  const raw = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = gesture.seed;
  let low = 0;
  let smooth = 0;
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * 500 / sampleRate);
  const smoothAlpha = 1 - Math.exp(-2 * Math.PI * 3000 / sampleRate);
  for (let i = 0; i < raw.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0x80000000 - 1;
    low += (noise - low) * lowAlpha;
    smooth += (noise - smooth) * smoothAlpha;
    const bright = noise - smooth;
    const mid = smooth - low;
    const time = i / sampleRate;
    let value = 0;
    if (id === 'axe-swing') {
      const progress = time / duration;
      value = (mid * 0.9 + bright * 0.3 + low * 0.3)
        * Math.sin(Math.PI * progress) ** 1.5 * (0.5 + 0.6 * progress);
    }
    for (const event of gesture.events) {
      const elapsed = time - event.at;
      if (elapsed < 0) continue;
      if (event.kind === 'scrape') {
        if (time > event.end) continue;
        const progress = elapsed / (event.end - event.at);
        value += event.gain * Math.sin(Math.PI * progress) ** 0.8 * (mid + bright * 0.5)
          * (0.6 + 0.4 * Math.sin(2 * Math.PI * 140 * time));
      } else if (event.kind === 'click') {
        const envelope = Math.exp(-elapsed / event.decay) * Math.min(1, elapsed / 0.0003);
        const ring = Math.sin(2 * Math.PI * event.frequency * elapsed) * 0.6
          + Math.sin(2 * Math.PI * event.frequency * 2.76 * elapsed) * 0.35
          + Math.sin(2 * Math.PI * event.frequency * 5.4 * elapsed) * 0.2;
        value += event.gain * envelope * (bright * 0.8 + ring);
      } else {
        const envelope = Math.exp(-elapsed / event.decay) * Math.min(1, elapsed / 0.0004);
        const body = Math.sin(2 * Math.PI * event.frequency * elapsed * (1 - 4 * elapsed));
        value += event.gain * envelope * (body + low * 0.6);
      }
    }
    const edge = Math.min(1, time / 0.0004, (duration - time) / 0.01);
    raw[i] = value * Math.max(0, edge);
  }
  const samples = new Float32Array(raw.length);
  // La saturation douce renforce les gestes courts tout en bornant leur crête.
  let drive = 1 / (raw.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0) || 1);
  let rms = fitSamples(raw, samples, drive);
  for (let attempt = 0; attempt < 8 && rms < 0.055; attempt++) {
    drive *= 1.6;
    rms = fitSamples(raw, samples, drive);
  }
  if (rms > 0.115) {
    const trim = 0.115 / rms;
    for (let i = 0; i < samples.length; i++) samples[i] *= trim;
  }
  samples[0] = 0;
  samples[samples.length - 1] = 0;
  return samples;
}

interface MechanicalVoice { source: AudioBufferSourceNode }

/** Sept buffers mono et quatre sources au plus, sur le contexte audio déjà possédé par le joueur. */
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
