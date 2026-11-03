import * as THREE from 'three';
import type { Weapon, WeaponId } from './Weapon';
import { createPickupSprite } from './PickupSprite.ts';

export class AmmoBox {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private x: number;
  private z: number;
  private baseY: number;
  private ammoCount: number;
  private weaponType: WeaponId;
  private consumed = false;
  private floatTimer = 0;
  private readonly pickupRadius = 1.2;

  constructor(
    scene: THREE.Scene,
    x: number,
    z: number,
    ammoCount = 8,
    weaponType: WeaponId = 'pistol',
    floorY = 0
  ) {
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.baseY = floorY + 0.3;
    this.ammoCount = ammoCount;
    this.weaponType = weaponType;

    this.group = new THREE.Group();
    this.group.position.set(this.x, this.baseY, this.z);

    const texturePath =
      weaponType === 'shotgun'
        ? '/assets/weapons/shotgun/ammo_pickup.png'
        : '/assets/pickups/ammo.png';

    this.group.add(createPickupSprite(texturePath, 0.6));
    this.scene.add(this.group);
  }

  public update(delta: number, viewerPosition: THREE.Vector3): void {
    if (this.consumed) return;

    this.floatTimer += delta * 2;
    this.group.rotation.y = Math.atan2(viewerPosition.x - this.x, viewerPosition.z - this.z);
    this.group.position.y = this.baseY + Math.sin(this.floatTimer) * 0.04;
  }

  public tryPickup(playerPosition: THREE.Vector3, weapon: Weapon): boolean {
    if (this.consumed) return false;

    const dx = playerPosition.x - this.x;
    const dz = playerPosition.z - this.z;
    const hDist = Math.hypot(dx, dz);

    const playerFloorY = playerPosition.y < 2.5 ? 0.0 : 2.4;
    const itemFloorY = this.baseY >= 2.0 ? 2.4 : 0.0;

    if (hDist <= this.pickupRadius && Math.abs(playerFloorY - itemFloorY) < 1.0) {
      const added = weapon.addAmmo(this.ammoCount, this.weaponType);
      if (added) {
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
    if (!this.consumed) return;
    this.consumed = false;
    this.scene.add(this.group);
  }
}
