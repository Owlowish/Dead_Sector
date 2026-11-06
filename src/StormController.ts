import * as THREE from 'three';

export interface StormAudioSource {
  readonly isPlaying: boolean;
  readonly position: THREE.Vector3;
  setVolume(volume: number): void;
  play(): void;
  pause(): void;
  stop(): void;
  disconnect(): void;
  removeFromParent(): void;
}

/** Orchestre une ambiance continue et des éclairs rares sans modifier la simulation du jeu. */
export class StormController {
  private rain: StormAudioSource | null = null;
  private thunder: StormAudioSource | null = null;
  private wait: number;
  private flashRemaining = 0;
  private thunderDelay = -1;
  private selectedWindowIndex = -1;
  private suspended = true;
  private disposed = false;
  private ambienceVolume = 1;
  private readonly lights: readonly THREE.PointLight[];
  private readonly random: () => number;
  private readonly audioReady: () => boolean;

  constructor(lights: readonly THREE.PointLight[], random: () => number = Math.random, audioReady: () => boolean = () => true) {
    this.lights = lights;
    this.random = random;
    this.audioReady = audioReady;
    this.wait = this.nextWait();
  }

  private nextWait(): number {
    return 12 + this.random() * 15;
  }

  public setRain(source: StormAudioSource): void {
    this.rain?.disconnect();
    this.rain?.removeFromParent();
    this.rain = source;
    source.setVolume(0.12 * this.ambienceVolume);
    if (!this.suspended && this.audioReady() && !source.isPlaying) source.play();
  }

  public setThunder(source: StormAudioSource): void {
    this.thunder?.disconnect();
    this.thunder?.removeFromParent();
    this.thunder = source;
    source.setVolume(0.32 * this.ambienceVolume);
  }

  public setAmbienceVolume(volume: number): void {
    this.ambienceVolume = THREE.MathUtils.clamp(volume, 0, 1);
    this.rain?.setVolume(0.12 * this.ambienceVolume);
    this.thunder?.setVolume(0.32 * this.ambienceVolume);
  }

  public update(delta: number, active: boolean, playerPosition: THREE.Vector3, positions: readonly THREE.Vector3[]): void {
    if (this.disposed) return;
    if (!active) {
      this.suspend();
      return;
    }
    if (this.suspended) {
      this.suspended = false;
    }
    if (!this.audioReady()) return;
    if (positions.length > 0 && this.rain) {
      const nearest = positions.reduce((best, point) =>
        point.distanceToSquared(playerPosition) < best.distanceToSquared(playerPosition) ? point : best,
      );
      this.rain.position.copy(nearest);
    }
    if (this.rain && !this.rain.isPlaying) this.rain.play();

    const elapsed = Math.min(Math.max(delta, 0), 0.05);
    if (this.flashRemaining > 0) {
      this.flashRemaining = Math.max(0, this.flashRemaining - elapsed);
      const age = 0.28 - this.flashRemaining;
      const pulse = age < 0.12 ? 1 - age / 0.12 : age > 0.17 && age < 0.25 ? 1 - (age - 0.17) / 0.08 : 0;
      for (const light of this.lights) light.intensity = Math.max(0, pulse) * 18;
      if (this.flashRemaining === 0) this.thunderDelay = 0.72;
      return;
    }
    for (const light of this.lights) light.intensity = 0;

    if (this.thunderDelay >= 0) {
      this.thunderDelay -= elapsed;
      if (this.thunderDelay <= 0) {
        if (this.thunder && !this.thunder.isPlaying) this.thunder.play();
        this.thunderDelay = -1;
      }
      return;
    }

    this.wait -= elapsed;
    if (this.wait > 0 || positions.length === 0) return;
    this.selectedWindowIndex = Math.floor(this.random() * positions.length);
    const position = positions[this.selectedWindowIndex];
    if (position) {
      for (const light of this.lights) light.position.copy(position);
      if (this.thunder) this.thunder.position.copy(position);
      this.flashRemaining = 0.28;
      this.wait = this.nextWait();
    }
  }

  public suspend(): void {
    this.suspended = true;
    if (this.rain?.isPlaying) this.rain.pause();
    if (this.thunder?.isPlaying) this.thunder.stop();
    this.flashRemaining = 0;
    this.thunderDelay = -1;
    for (const light of this.lights) light.intensity = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.suspend();
    for (const source of [this.rain, this.thunder]) {
      source?.disconnect();
      source?.removeFromParent();
    }
    this.rain = null;
    this.thunder = null;
  }

  public resetForNewRun(): void {
    this.suspend();
    this.wait = this.nextWait();
    this.selectedWindowIndex = -1;
  }
}
