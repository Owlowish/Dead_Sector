import * as THREE from 'three';
import type { Level } from './Level.ts';
import { guardianConfig } from './FinaleConfig.ts';
import { portraitFlightFrame, portraitProjectileAnimation } from './PortraitProjectileAnimation.ts';
import { getPortraitProjectileResources, disposePortraitProjectileResources } from './PortraitProjectileResources.ts';

export interface PortraitProjectileEffects {
  trail(position: THREE.Vector3, direction: THREE.Vector3): void;
  impact(position: THREE.Vector3, normal?: THREE.Vector3): void;
}

/** Lame de peinture engagée une seule fois ; le couvert arrête chaque lame de l'éventail. */
export class GuardianProjectile {
  private readonly object: THREE.Group;
  private readonly sprite: THREE.Mesh;
  private readonly art = getPortraitProjectileResources().flight;
  private readonly direction: THREE.Vector3;
  private readonly ray = new THREE.Raycaster();
  private readonly playerSphere = new THREE.Sphere(new THREE.Vector3(), 0.48);
  private readonly intersection = new THREE.Vector3();
  private readonly impactNormal = new THREE.Vector3();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly trailPoint = new THREE.Vector3();
  private readonly effects: PortraitProjectileEffects | undefined;
  private distanceToNextTrail: number = portraitProjectileAnimation.trail.spacing;
  private age = 0;
  private removed = false;

  constructor(scene: THREE.Scene, origin: THREE.Vector3, target: THREE.Vector3, effects?: PortraitProjectileEffects) {
    this.effects = effects;
    this.object = new THREE.Group();
    this.sprite = new THREE.Mesh(this.art.geometries[0], this.art.material);
    this.sprite.name = 'portrait-paint-blade';
    this.sprite.castShadow = false; this.sprite.receiveShadow = false;
    this.object.add(this.sprite);
    this.object.position.copy(origin);
    this.direction = target.clone().sub(origin).normalize();
    this.object.lookAt(target);
    scene.add(this.object);
  }

  getPosition(): THREE.Vector3 { return this.object.position; }
  static warmup(): void { getPortraitProjectileResources(); }
  static disposeSharedResources(): void { disposePortraitProjectileResources(); }

  update(delta: number, scene: THREE.Scene, level: Level, player: THREE.Vector3, onHit: (damage: number) => void): boolean {
    if (this.removed) return false;
    if (delta <= 0 || !Number.isFinite(delta)) return true;
    const elapsed = Math.min(delta, guardianConfig.projectileLifetime - this.age);
    const step = guardianConfig.projectileSpeed * elapsed;
    this.age += elapsed;
    this.ray.set(this.object.position, this.direction);
    this.ray.far = step;
    const blockers = level.getSolidMeshes();
    for (const blocker of blockers) blocker.updateWorldMatrix(true, false);
    const wallHit = this.ray.intersectObjects(blockers, false)[0];
    const wallDistance = wallHit?.distance ?? Infinity;
    this.playerSphere.center.copy(player);
    const hit = this.ray.ray.intersectSphere(this.playerSphere, this.intersection);
    const hitDistance = this.playerSphere.containsPoint(this.object.position)
      ? 0 : hit ? this.object.position.distanceTo(hit) : Infinity;
    if (hitDistance <= step && hitDistance < wallDistance) {
      this.emitTrail(hitDistance);
      this.object.position.addScaledVector(this.direction, hitDistance);
      this.impactNormal.copy(this.object.position).sub(player);
      if (this.impactNormal.lengthSq() < 0.001) this.impactNormal.copy(this.direction).negate();
      this.effects?.impact(this.object.position, this.impactNormal.normalize());
      onHit(guardianConfig.projectileDamage);
      return this.destroy(scene);
    }
    if (wallHit && wallDistance <= step) {
      this.emitTrail(wallDistance);
      this.object.position.copy(wallHit.point);
      if (wallHit.face) this.impactNormal.copy(wallHit.face.normal)
        .applyNormalMatrix(this.normalMatrix.getNormalMatrix(wallHit.object.matrixWorld));
      else this.impactNormal.copy(this.direction).negate();
      if (this.impactNormal.dot(this.direction) > 0) this.impactNormal.negate();
      this.effects?.impact(this.object.position, this.impactNormal);
      return this.destroy(scene);
    }
    this.emitTrail(step);
    this.object.position.addScaledVector(this.direction, step);
    this.object.lookAt(player);
    this.sprite.geometry = this.art.geometries[portraitFlightFrame(this.age)];
    this.sprite.rotation.z = Math.sin(this.age * 12) * 0.06;
    if (this.age >= guardianConfig.projectileLifetime) return this.destroy(scene);
    return true;
  }

  dispose(scene: THREE.Scene): void { this.destroy(scene); }

  private emitTrail(distance: number): void {
    if (!this.effects) return;
    let offset = this.distanceToNextTrail;
    while (offset <= distance + 1e-9) {
      this.trailPoint.copy(this.object.position).addScaledVector(this.direction, Math.min(offset, distance));
      this.effects.trail(this.trailPoint, this.direction);
      offset += portraitProjectileAnimation.trail.spacing;
    }
    this.distanceToNextTrail = offset - distance;
  }

  private destroy(scene: THREE.Scene): false {
    if (!this.removed) {
      this.removed = true;
      scene.remove(this.object);
    }
    return false;
  }
}
