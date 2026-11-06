import * as THREE from 'three';
import type { Player } from './Player';
import { createPickupSprite } from './PickupSprite.ts';

export class Medkit {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private x: number;
  private z: number;
  private baseY: number;
  private healAmount: number;
  private consumed = false;
  private disposed = false;
  private floatTimer = 0;
  private readonly pickupRadius = 1.2;

  constructor(
    scene: THREE.Scene,
    x: number,
    z: number,
    healAmount = 30,
    floorY = 0
  ) {
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.baseY = floorY + 0.35;
    this.healAmount = healAmount;

    this.group = new THREE.Group();
    this.group.position.set(this.x, this.baseY, this.z);

    this.group.add(createPickupSprite('/assets/pickups/medkit.png', 0.7));

    this.scene.add(this.group);
  }

  public update(delta: number, viewerPosition: THREE.Vector3): void {
    if (this.consumed) return;

    this.floatTimer += delta * 2;
    this.group.rotation.y = Math.atan2(viewerPosition.x - this.x, viewerPosition.z - this.z);
    // Légère pulsation verticale
    this.group.position.y = this.baseY + Math.sin(this.floatTimer) * 0.05;
  }

  public tryPickup(player: Player): boolean {
    if (this.consumed) return false;

    const dx = player.camera.position.x - this.x;
    const dz = player.camera.position.z - this.z;
    const hDist = Math.hypot(dx, dz);

    const playerFloorY = player.camera.position.y - 1.7;
    const itemFloorY = this.baseY - 0.35;

    if (hDist <= this.pickupRadius && Math.abs(playerFloorY - itemFloorY) < 0.8) {
      const healed = player.heal(this.healAmount);
      if (healed) {
        this.consumed = true;
        this.scene.remove(this.group);
        return true;
      }
    }

    return false;
  }

  public isConsumed(): boolean {
    return this.consumed;
  }

  public respawn(): void {
    if (this.disposed) return;
    if (this.consumed) {
      this.consumed = false;
      this.scene.add(this.group);
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.consumed = true;
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
  }
}
