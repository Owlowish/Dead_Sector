import * as THREE from 'three';
import type { Level } from './Level.ts';

export class SpitProjectile {
  private readonly mesh: THREE.Mesh;
  private readonly direction: THREE.Vector3;
  private readonly ray = new THREE.Raycaster();
  private age = 0;
  private disposed = false;
  private readonly speed = 6.5;
  private readonly radius = 0.18;

  constructor(scene: THREE.Scene, origin: THREE.Vector3, target: THREE.Vector3) {
    const geometry = new THREE.SphereGeometry(this.radius, 8, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0x75ff28 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(origin);
    this.direction = target.sub(origin).normalize();
    scene.add(this.mesh);
  }

  update(delta: number, scene: THREE.Scene, level: Level, player: THREE.Vector3, onHit: (damage: number) => void): boolean {
    if (this.disposed) return false;
    this.age += delta;
    const step = this.speed * Math.max(0, delta);
    this.ray.set(this.mesh.position, this.direction);
    this.ray.far = step;
    for (const blocker of level.getSolidMeshes()) blocker.updateWorldMatrix(true, false);
    const wallHit = this.ray.intersectObjects(level.getSolidMeshes(), false)[0];
    const toPlayer = player.clone().sub(this.mesh.position);
    const projectedDistance = THREE.MathUtils.clamp(toPlayer.dot(this.direction), 0, step);
    const closestPoint = this.mesh.position.clone().addScaledVector(this.direction, projectedDistance);
    const perpendicularDistance = closestPoint.distanceTo(player);
    const hitRadius = this.radius + 0.3;
    let playerHitDistance = Number.POSITIVE_INFINITY;
    if (perpendicularDistance <= hitRadius) {
      const halfChord = Math.sqrt(Math.max(0, hitRadius * hitRadius - perpendicularDistance * perpendicularDistance));
      playerHitDistance = Math.max(0, projectedDistance - halfChord);
    }
    const wallDistance = wallHit?.distance ?? Number.POSITIVE_INFINITY;
    if (playerHitDistance <= step && playerHitDistance < wallDistance) {
      this.mesh.position.addScaledVector(this.direction, playerHitDistance);
      onHit(12);
      return this.destroy(scene);
    }
    if (wallHit) return this.destroy(scene);
    this.mesh.position.addScaledVector(this.direction, step);
    if (this.age >= 5 || this.mesh.position.y < -2 || this.mesh.position.y > 8) return this.destroy(scene);
    return true;
  }

  dispose(scene: THREE.Scene): void { this.destroy(scene); }

  private destroy(scene: THREE.Scene): false {
    if (!this.disposed) {
      this.disposed = true;
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    return false;
  }
}
