import * as THREE from 'three';
import type { Level } from './Level.ts';
import { guardianConfig } from './FinaleConfig.ts';
import { visualColors } from './VisualStyle.ts';

/** Projectile engagé une seule fois : les déplacements du joueur ne le réorientent pas. */
export class GuardianProjectile {
  private readonly object: THREE.Group;
  private readonly direction: THREE.Vector3;
  private readonly ray = new THREE.Raycaster();
  private readonly playerSphere = new THREE.Sphere(new THREE.Vector3(), 0.48);
  private readonly intersection = new THREE.Vector3();
  private age = 0;
  private removed = false;

  constructor(scene: THREE.Scene, origin: THREE.Vector3, target: THREE.Vector3) {
    this.object = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: visualColors.ivory });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 4, 8), material);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.28, 0.055), material);
    shaft.position.y = -0.19;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.055), material);
    tooth.position.set(0.035, -0.3, 0);
    this.object.add(ring, shaft, tooth);
    this.object.position.copy(origin);
    this.direction = target.clone().sub(origin).normalize();
    this.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.direction);
    scene.add(this.object);
  }

  getPosition(): THREE.Vector3 { return this.object.position; }

  update(delta: number, scene: THREE.Scene, level: Level, player: THREE.Vector3, onHit: (damage: number) => void): boolean {
    if (this.removed) return false;
    if (delta <= 0) return true;
    const elapsed = Math.min(delta, guardianConfig.projectileLifetime - this.age);
    const step = guardianConfig.projectileSpeed * elapsed;
    this.age += elapsed;
    this.ray.set(this.object.position, this.direction);
    this.ray.far = step;
    const blockers = level.getSolidMeshes();
    for (const blocker of blockers) blocker.updateWorldMatrix(true, false);
    const wallDistance = this.ray.intersectObjects(blockers, false)[0]?.distance ?? Infinity;
    this.playerSphere.center.copy(player);
    const hit = this.ray.ray.intersectSphere(this.playerSphere, this.intersection);
    const hitDistance = this.playerSphere.containsPoint(this.object.position)
      ? 0 : hit ? this.object.position.distanceTo(hit) : Infinity;
    if (hitDistance <= step && hitDistance < wallDistance) {
      onHit(guardianConfig.projectileDamage);
      return this.destroy(scene);
    }
    if (wallDistance <= step) return this.destroy(scene);
    this.object.position.addScaledVector(this.direction, step);
    this.object.rotateY(elapsed * 9);
    if (this.age >= guardianConfig.projectileLifetime) return this.destroy(scene);
    return true;
  }

  dispose(scene: THREE.Scene): void { this.destroy(scene); }

  private destroy(scene: THREE.Scene): false {
    if (!this.removed) {
      this.removed = true;
      scene.remove(this.object);
      this.object.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      ((this.object.children[0] as THREE.Mesh).material as THREE.Material).dispose();
    }
    return false;
  }
}
