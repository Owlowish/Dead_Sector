import { AudioManager } from './AudioManager.ts';
import type { WeaponMechanicalSoundId } from './WeaponSoundEvents.ts';

export const WEAPON_MECHANICAL_BASE_GAIN = 0.04;
export const WEAPON_MECHANICAL_SOUND_IDS: readonly WeaponMechanicalSoundId[] = [
  'mag-out', 'mag-in', 'seat', 'shell-insert', 'pump-back', 'pump-forward', 'axe-swing',
];

/**
 * Atténuation par fichier : les sources de `assets-src/sounds/` (crête −3 dBFS) ne dépassent pas
 * le plafond RMS de 0,115 (−18,8 dBFS) qui bornait l'ancienne synthèse. Aucun son n'est amplifié.
 */
export const WEAPON_MECHANICAL_TRIMS: Readonly<Record<WeaponMechanicalSoundId, number>> = {
  'mag-out': 1,
  'mag-in': 1,
  seat: 1,
  'shell-insert': 0.64,
  'pump-back': 0.75,
  'pump-forward': 1,
  'axe-swing': 0.71,
};

type BufferSource = (id: WeaponMechanicalSoundId) => AudioBuffer | null;

interface MechanicalVoice { source: AudioBufferSourceNode; trim: GainNode }

/**
 * Sept prises de maniement chargées par l'AudioManager (Ogg servis) et quatre sources au plus,
 * sur le contexte audio déjà possédé par le joueur. Un son absent ou en chargement est ignoré.
 */
export class WeaponMechanicalAudio {
  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private readonly getBuffer: BufferSource;
  private readonly voices: MechanicalVoice[] = [];
  private volume = 1;
  private disposed = false;

  constructor(context: AudioContext, destination: AudioNode, getBuffer?: BufferSource) {
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = WEAPON_MECHANICAL_BASE_GAIN;
    this.gain.connect(destination);
    if (getBuffer) {
      this.getBuffer = getBuffer;
    } else {
      // Lecture paresseuse : après un `AudioManager.clear()`, les buffers rechargés sont repris.
      this.getBuffer = (id) => AudioManager.peek()?.getBuffer(id) ?? null;
      for (const id of WEAPON_MECHANICAL_SOUND_IDS) void AudioManager.peek()?.load(id);
    }
  }

  public setVolume(volume: number): void {
    if (this.disposed || !Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    this.gain.gain.setTargetAtTime(this.volume * WEAPON_MECHANICAL_BASE_GAIN, this.context.currentTime, 0.012);
    if (this.volume === 0) this.suspend();
  }

  public play(id: WeaponMechanicalSoundId): void {
    // Aucun son n'est mis en attente pendant une suspension ou avant le geste suivant.
    if (this.disposed || this.volume === 0 || this.context.state !== 'running') return;
    const buffer = this.getBuffer(id);
    if (!buffer) return;
    if (this.voices.length >= 4) this.stopVoice(this.voices[0]!);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const trim = this.context.createGain();
    trim.gain.value = WEAPON_MECHANICAL_TRIMS[id];
    source.connect(trim);
    trim.connect(this.gain);
    const voice = { source, trim };
    source.onended = () => this.releaseVoice(voice);
    this.voices.push(voice);
    source.start();
  }

  private releaseVoice(voice: MechanicalVoice): void {
    const index = this.voices.indexOf(voice);
    if (index !== -1) this.voices.splice(index, 1);
    voice.source.onended = null;
    voice.source.disconnect();
    voice.trim.disconnect();
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
    this.disposed = true;
  }
}
