import * as THREE from 'three';
import { MANSION_STORM_WINDOWS } from './MansionConfig.ts';
import type { StormController } from './StormController.ts';
import type { Level } from './Level.ts';

/** Caméra de l'écran titre, indépendante de la position et des entrées du joueur. */
export class TitleScene {
  public readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly level: Level;
  private readonly storm: StormController;
  private readonly focus: THREE.Vector3;
  private readonly stormPositions: readonly THREE.Vector3[];
  private elapsed = 0;

  constructor(level: Level, storm: StormController) {
    this.level = level;
    this.storm = storm;
    const windowIndex = MANSION_STORM_WINDOWS.findIndex((spec) => spec.drapery === 'music');
    const { x, y, z } = MANSION_STORM_WINDOWS[windowIndex]!;
    this.focus = new THREE.Vector3(x, y + 0.06, z);
    this.stormPositions = [level.getStormWindowPositions()[windowIndex]!];
    this.storm.setTitleMode(true);
    this.resize(window.innerWidth, window.innerHeight);
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = THREE.MathUtils.lerp(69, 48, THREE.MathUtils.smoothstep(this.camera.aspect, 0.55, 1.6));
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }

  private placeCamera(): void {
    const time = this.reducedMotion.matches ? 0 : this.elapsed;
    const narrow = 1 - THREE.MathUtils.smoothstep(this.camera.aspect, 0.55, 1.4);
    this.camera.position.set(
      this.focus.x - 1.95 + narrow * 0.8 + 0.32 * Math.sin(time * 0.3),
      1.57 + 0.09 * Math.sin(time * 0.21),
      this.focus.z + 10.8 + narrow * 0.45 + 0.24 * Math.sin(time * 0.23),
    );
    this.camera.lookAt(this.focus);
  }

  public update(delta: number, visible: boolean): void {
    const animated = visible && !this.reducedMotion.matches;
    if (animated) this.elapsed += delta;
    this.placeCamera();
    this.storm.update(delta, animated, this.camera.position, this.stormPositions);
    this.level.update(0, animated ? delta : 0);
  }

  public dispose(): void {
    this.storm.setTitleMode(false);
    this.level.update(0, 0);
  }
}
