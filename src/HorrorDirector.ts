import * as THREE from 'three';

export interface HorrorSourcePoint {
  x: number;
  y: number;
  z: number;
}

export interface HorrorAudioSource {
  readonly isPlaying: boolean;
  readonly position: THREE.Vector3;
  setVolume(volume: number): void;
  play(): void;
  stop(): void;
  disconnect(): void;
  removeFromParent?(): void;
}

export class HorrorDirector {
  private source: HorrorAudioSource | null = null;
  private volume = 0.18;
  private waitRemaining: number;
  private retryRemaining = 0;
  private resumeSilence = 0;
  private consumed = false;
  private wasEligible = false;
  private hasStartedEligibility = false;
  private disposed = false;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.waitRemaining = this.nextWait();
  }

  private nextWait(): number {
    return 18 + this.random() * 12;
  }

  public setSource(source: HorrorAudioSource): void {
    if (this.disposed) {
      source.disconnect();
      source.removeFromParent?.();
      return;
    }
    this.source?.stop();
    this.source?.disconnect();
    this.source?.removeFromParent?.();
    this.source = source;
    source.setVolume(this.volume);
  }

  public setVolume(volume: number): void {
    this.volume = THREE.MathUtils.clamp(volume, 0, 1);
    this.source?.setVolume(this.volume);
    if (this.volume === 0) this.stopSource();
  }

  public getVolume(): number {
    return this.volume;
  }

  public resetRespite(): void {
    this.stopSource();
    this.consumed = false;
    this.waitRemaining = this.nextWait();
    this.retryRemaining = 0;
    this.resumeSilence = 0;
    this.wasEligible = false;
    this.hasStartedEligibility = false;
  }

  public update(
    delta: number,
    eligible: boolean,
    playerPosition: THREE.Vector3,
    viewDirection: THREE.Vector3,
    points: readonly HorrorSourcePoint[],
  ): void {
    if (this.disposed) return;

    if (!eligible) {
      this.stopSource();
      this.wasEligible = false;
      return;
    }

    if (!this.wasEligible) {
      if (this.hasStartedEligibility) this.resumeSilence = 4;
      this.wasEligible = true;
      this.hasStartedEligibility = true;
    }

    const elapsed = Math.max(0, Math.min(delta, 0.05));
    if (this.resumeSilence > 0) {
      this.resumeSilence = Math.max(0, this.resumeSilence - elapsed);
      return;
    }
    if (this.consumed || this.volume === 0 || !this.source || this.source.isPlaying) return;

    this.waitRemaining -= elapsed;
    if (this.waitRemaining > 0) return;
    this.retryRemaining -= elapsed;
    if (this.retryRemaining > 0) return;

    const point = this.choosePoint(playerPosition, viewDirection, points);
    if (!point) {
      this.retryRemaining = 0.5;
      return;
    }

    this.source.position.set(point.x, point.y, point.z);
    this.source.play();
    this.consumed = true;
  }

  public suspend(): void {
    this.stopSource();
    this.wasEligible = false;
  }

  private choosePoint(
    playerPosition: THREE.Vector3,
    viewDirection: THREE.Vector3,
    points: readonly HorrorSourcePoint[],
  ): HorrorSourcePoint | null {
    const direction = viewDirection.clone().normalize();
    const candidates = points.filter((point) => {
      const offset = new THREE.Vector3(point.x, point.y, point.z).sub(playerPosition);
      const distance = offset.length();
      return distance >= 6 && distance <= 16 && offset.normalize().dot(direction) < 0.5;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(this.random() * candidates.length)] ?? null;
  }

  private stopSource(): void {
    if (this.source?.isPlaying) this.source.stop();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSource();
    this.source?.disconnect();
    this.source?.removeFromParent?.();
    this.source = null;
  }
}
