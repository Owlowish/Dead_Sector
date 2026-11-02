import * as THREE from 'three';
import type { Weapon } from './Weapon';
import { createPickupSprite } from './PickupSprite.ts';

export class ShotgunPickup {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private x: number;
  private z: number;
  private baseY: number;
  private consumed = false;
  private floatTimer = 0;
  private readonly pickupRadius = 1.6;

  constructor(scene: THREE.Scene, x = 0, z = 0, baseY = 0.5) {
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.baseY = baseY;

    this.group = new THREE.Group();
    this.group.position.set(this.x, this.baseY, this.z);

    // Sprite de profil du fusil à pompe (largeur 1.2m)
    const sprite = createPickupSprite('/assets/weapons/shotgun/pickup.png', 1.1);
    this.group.add(sprite);

    this.scene.add(this.group);
  }

  public update(delta: number, viewerPosition: THREE.Vector3): void {
    if (this.consumed) return;

    this.floatTimer += delta * 2.2;
    // Orientation billboard face au joueur
    this.group.rotation.y = Math.atan2(viewerPosition.x - this.x, viewerPosition.z - this.z);
    this.group.position.y = this.baseY + Math.sin(this.floatTimer) * 0.04;
  }

  public canInteract(playerPosition: THREE.Vector3, cameraDirection: THREE.Vector3): boolean {
    if (this.consumed) return false;
    const dx = this.x - playerPosition.x;
    const dy = Math.abs(this.baseY - playerPosition.y);
    const dz = this.z - playerPosition.z;
    const hDist = Math.hypot(dx, dz);
    if (hDist > 2.5 || dy > 2.5) return false;

    const dirX = dx / (hDist || 1);
    const dirZ = dz / (hDist || 1);
    const dot = dirX * cameraDirection.x + dirZ * cameraDirection.z;
    return dot > 0.65;
  }

  public tryPickup(playerPosition: THREE.Vector3, weapon: Weapon): boolean {
    if (this.consumed) return false;

    const dx = playerPosition.x - this.x;
    const dy = Math.abs(playerPosition.y - this.baseY);
    const dz = playerPosition.z - this.z;
    const hDist = Math.hypot(dx, dz);

    if (hDist <= this.pickupRadius && dy <= 2.2) {
      return this.collect(weapon);
    }
    return false;
  }

  public collect(weapon: Weapon): boolean {
    if (this.consumed) return false;
    this.consumed = true;
    this.scene.remove(this.group);
    weapon.unlockWeapon('shotgun');
    weapon.addAmmo(10, 'shotgun');

    const clickSound = new Audio('/assets/sounds/empty-soft.wav');
    clickSound.volume = 0.6;
    void clickSound.play().catch(() => {});

    return true;
  }

  public respawn(): void {
    if (!this.consumed) return;
    this.consumed = false;
    this.scene.add(this.group);
  }

  public isConsumed(): boolean {
    return this.consumed;
  }
}
