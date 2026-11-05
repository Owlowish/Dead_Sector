export type AudioChannel = 'ambience' | 'effects' | 'music' | 'horror';

const defaultVolumes: Record<AudioChannel, number> = {
  ambience: 1,
  effects: 1,
  music: 0.4,
  horror: 0.18,
};

export const AUDIO_SETTINGS_KEY = 'dead-sector.audio.v1';
export interface AudioSettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): AudioSettingsStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage ?? null; }
  catch { return null; }
}

/** Réglages et fondus uniquement ; les classes du jeu possèdent leurs sources sonores. */
export class AudioMix {
  private readonly targets = { ...defaultVolumes };
  private readonly levels = { ...defaultVolumes };
  private musicPresence = 1;
  private readonly storage: AudioSettingsStorage | null;

  constructor(storage: AudioSettingsStorage | null = browserStorage()) {
    this.storage = storage;
    try {
      const saved: unknown = JSON.parse(storage?.getItem(AUDIO_SETTINGS_KEY) ?? 'null');
      if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== 1 || !('volumes' in saved)) return;
      const volumes = saved.volumes;
      if (!volumes || typeof volumes !== 'object') return;
      for (const channel of Object.keys(defaultVolumes) as AudioChannel[]) {
        const value = (volumes as Record<string, unknown>)[channel];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) {
          this.targets[channel] = value;
          this.levels[channel] = value;
        }
      }
    } catch { /* Un stockage indisponible ou ancien ne doit jamais empêcher de jouer. */ }
  }

  public saveSettings(): void {
    try { this.storage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ version: 1, volumes: this.targets })); }
    catch { /* Le mix reste utilisable si le navigateur refuse l'enregistrement. */ }
  }

  public setVolume(channel: AudioChannel, value: number): void {
    if (Number.isFinite(value)) this.targets[channel] = Math.max(0, Math.min(1, value));
  }

  public getSetting(channel: AudioChannel): number {
    return this.targets[channel];
  }

  public getVolume(channel: AudioChannel): number {
    return this.levels[channel];
  }

  public getMusicPresence(): number {
    return this.musicPresence;
  }

  public update(delta: number, inCombat: boolean): boolean {
    if (!Number.isFinite(delta) || delta <= 0) return false;
    // Un amorti exponentiel donne le même fondu quelle que soit la fréquence d'image.
    const blend = 1 - Math.exp(-8 * delta);
    let changed = false;
    for (const channel of Object.keys(this.levels) as AudioChannel[]) {
      const target = this.targets[channel];
      const previous = this.levels[channel];
      this.levels[channel] += (target - this.levels[channel]) * blend;
      if (Math.abs(target - this.levels[channel]) < 0.0001) this.levels[channel] = target;
      changed ||= this.levels[channel] !== previous;
    }
    const previousPresence = this.musicPresence;
    const presenceTarget = inCombat ? 1 : 1 / 3;
    this.musicPresence += (presenceTarget - this.musicPresence) * blend;
    if (Math.abs(presenceTarget - this.musicPresence) < 0.0001) this.musicPresence = presenceTarget;
    return changed || this.musicPresence !== previousPresence;
  }
}
