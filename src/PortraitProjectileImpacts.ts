import * as THREE from 'three';
import { portraitProjectileAnimation, portraitImpactFrame } from './PortraitProjectileAnimation.ts';
import { getPortraitProjectileResources, disposePortraitProjectileResources } from './PortraitProjectileResources.ts';

/** Dix éclatements cosmétiques au maximum ; meshes et atlas préparés une seule fois. */
export class PortraitProjectileImpacts {
  private readonly scene: THREE.Scene;
  private readonly art = getPortraitProjectileResources().impact;
  private readonly slots: Array<{ mesh: THREE.Mesh; active: boolean; age: number }>;
  private readonly rotation = new THREE.Quaternion();
  private readonly cameraPosition = new THREE.Vector3();
  private cursor = 0;
  private spawned = 0;
  private reused = 0;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.slots = Array.from({ length: portraitProjectileAnimation.impact.capacity }, () => {
      const mesh = new THREE.Mesh(this.art.geometries[0], this.art.material);
      mesh.name = 'portrait-paint-impact';
      mesh.visible = false; mesh.castShadow = false; mesh.receiveShadow = false;
      scene.add(mesh);
      return { mesh, active: false, age: 0 };
    });
  }

  static warmup(): void { getPortraitProjectileResources(); }
  static disposeSharedResources(): void { disposePortraitProjectileResources(); }

  impact(position: THREE.Vector3, normal?: THREE.Vector3): void {
    if (this.disposed || ![position.x, position.y, position.z].every(Number.isFinite)) return;
    let index = this.slots.findIndex(slot => !slot.active);
    if (index < 0) { index = this.cursor; this.reused++; }
    this.cursor = (index + 1) % this.slots.length;
    const slot = this.slots[index];
    slot.active = true; slot.age = 0;
    slot.mesh.position.copy(position);
    if (normal && [normal.x, normal.y, normal.z].every(Number.isFinite) && normal.lengthSq() > 0.001)
      slot.mesh.position.addScaledVector(normal, 0.035 / normal.length());
    slot.mesh.geometry = this.art.geometries[0];
    slot.mesh.quaternion.copy(this.rotation);
    slot.mesh.scale.setScalar(1);
    slot.mesh.visible = true;
    this.spawned++;
  }

  update(delta: number, camera: THREE.Camera): void {
    if (this.disposed || delta <= 0 || !Number.isFinite(delta)) return;
    camera.getWorldQuaternion(this.rotation);
    camera.getWorldPosition(this.cameraPosition);
    const duration = portraitProjectileAnimation.impact.frames * portraitProjectileAnimation.impact.frameDuration;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += delta;
      if (slot.age >= duration) { slot.active = false; slot.mesh.visible = false; continue; }
      slot.mesh.geometry = this.art.geometries[portraitImpactFrame(slot.age)];
      slot.mesh.quaternion.copy(this.rotation);
      // Un impact sur le joueur continue son cycle sans recouvrir la vue.
      const distance = slot.mesh.position.distanceTo(this.cameraPosition);
      slot.mesh.visible = distance >= 0.7;
      slot.mesh.scale.setScalar(Math.min(1, distance / 1.4));
    }
  }

  clear(): void {
    for (const slot of this.slots) { slot.active = false; slot.age = 0; slot.mesh.visible = false; }
    this.cursor = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    for (const slot of this.slots) this.scene.remove(slot.mesh);
    this.disposed = true;
  }

  getStats(): { active: number; capacity: number; drawCalls: number; spawned: number; reused: number; disposed: boolean } {
    const active = this.slots.filter(slot => slot.active).length;
    return { active, capacity: this.slots.length, drawCalls: this.slots.filter(slot => slot.mesh.visible).length,
      spawned: this.spawned, reused: this.reused, disposed: this.disposed };
  }
}
