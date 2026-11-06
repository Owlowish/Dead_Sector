import * as THREE from 'three';
import type { FirearmId, Weapon } from './Weapon.ts';
import { createPickupSprite } from './PickupSprite.ts';

/** Récompense d'arme, posée près du joueur une fois son palier purgé. */
export class FirearmPickup {
  private readonly scene: THREE.Scene;
  private readonly weaponId: FirearmId;
  private readonly group = new THREE.Group();
  private x: number;
  private z: number;
  private baseY: number;
  private consumed = false;
  private active = true;
  private floatTimer = 0;
  private readonly pickupRadius = 1.6;

  constructor(scene: THREE.Scene, weaponId: FirearmId, x: number, z: number, baseY: number) {
    this.scene = scene;
    this.weaponId = weaponId;
    this.x = x;
    this.z = z;
    this.baseY = baseY;
    this.group.position.set(x, baseY, z);
    if (weaponId === 'shotgun') {
      this.group.add(createPickupSprite('/assets/weapons/shotgun/pickup.png', 1.1));
    } else {
      // Profil lisible en volume, sans atlas FPS détourné ni nouvelle texture.
      const iron = new THREE.MeshStandardMaterial({ color: 0x777b7a, roughness: 0.9 });
      const grip = new THREE.MeshStandardMaterial({ color: 0x343537, roughness: 1 });
      const addBox = (width: number, height: number, depth: number, px: number, py: number,
        material: THREE.Material, rotation = 0): void => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        mesh.position.set(px, py, 0);
        mesh.rotation.z = rotation;
        mesh.receiveShadow = true;
        this.group.add(mesh);
      };
      addBox(0.68, 0.15, 0.13, 0.04, 0.15, iron);
      addBox(0.30, 0.07, 0.09, 0.23, 0.06, iron);
      addBox(0.17, 0.32, 0.13, -0.17, -0.06, grip, -0.2);
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 4, 8), iron);
      guard.position.set(0.0, -0.025, 0);
      this.group.add(guard);
    }
    scene.add(this.group);
  }

  public activateAt(x: number, z: number, baseY: number): void {
    if (this.consumed) return;
    this.x = x;
    this.z = z;
    this.baseY = baseY;
    this.floatTimer = 0;
    this.active = true;
    this.group.position.set(x, baseY, z);
    this.scene.add(this.group);
  }

  public update(delta: number, viewerPosition: THREE.Vector3): void {
    if (!this.active || this.consumed) return;
    this.floatTimer += delta * 2.2;
    this.group.rotation.y = Math.atan2(viewerPosition.x - this.x, viewerPosition.z - this.z);
    this.group.position.y = this.baseY + Math.sin(this.floatTimer) * 0.04;
  }

  public canInteract(playerPosition: THREE.Vector3, cameraDirection: THREE.Vector3): boolean {
    if (!this.active || this.consumed || !this.sameFloor(playerPosition)) return false;
    const dx = this.x - playerPosition.x;
    const dz = this.z - playerPosition.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 2.5) return false;
    return (dx * cameraDirection.x + dz * cameraDirection.z) / (distance || 1) > 0.65;
  }

  public tryPickup(playerPosition: THREE.Vector3, weapon: Weapon): boolean {
    if (!this.active || this.consumed || !this.sameFloor(playerPosition)) return false;
    return Math.hypot(playerPosition.x - this.x, playerPosition.z - this.z) <= this.pickupRadius
      ? this.collect(weapon) : false;
  }

  private sameFloor(playerPosition: THREE.Vector3): boolean {
    return Math.abs((playerPosition.y - 1.7) - (this.baseY - 0.4)) < 0.8;
  }

  public collect(weapon: Weapon): boolean {
    if (!this.active || this.consumed) return false;
    this.consumed = true;
    this.active = false;
    this.scene.remove(this.group);
    weapon.unlockWeapon(this.weaponId);
    if (this.weaponId === 'shotgun') weapon.addAmmo(10, 'shotgun');
    return true;
  }

  public resetForNewRun(): void {
    this.consumed = false;
    this.active = false;
    this.floatTimer = 0;
    this.scene.remove(this.group);
  }

  /** Réarmement explicite réservé aux aperçus et anciens contrôles d'objets. */
  public respawn(): void {
    this.consumed = false;
    this.active = true;
    this.scene.add(this.group);
  }

  public isConsumed(): boolean { return this.consumed; }
  public isActive(): boolean { return this.active && !this.consumed; }

  public dispose(): void {
    this.scene.remove(this.group);
    const materials = new Set<THREE.Material>();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    for (const material of materials) material.dispose();
  }
}
