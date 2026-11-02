/**
 * DEAD SECTOR — Dispositif d'activation volontaire des rencontres (Carillon d'arène).
 * Permet au joueur de déclencher les paliers suivants dans un manoir déjà ouvert,
 * sans rupture de contrôle (mouvement et souris conservés), avec interaction directe dans le monde [E].
 */

import * as THREE from 'three';

export class EncounterBell {
  private readonly group: THREE.Group;
  private readonly bellMesh: THREE.Mesh;
  private readonly beaconLight: THREE.PointLight;
  private active = false;
  private pulseTimer = 0;
  private readonly position: THREE.Vector3;

  constructor(scene: THREE.Scene, x: number, z: number, floorY: number) {
    this.position = new THREE.Vector3(x, floorY + 1.1, z);
    this.group = new THREE.Group();
    this.group.position.set(x, floorY, z);

    // 1. Piédestal victorien en chêne sombre
    const plinthGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.9, 12);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a10,
      roughness: 0.7,
      metalness: 0.1,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.y = 0.45;
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    this.group.add(plinthMesh);

    // 2. Carillon d'arène / Cloche d'alerte en laiton patiné
    const bellGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.3, 12);
    const bellMat = new THREE.MeshStandardMaterial({
      color: 0xc89b3c, // Laiton / or victorien
      roughness: 0.35,
      metalness: 0.8,
    });
    this.bellMesh = new THREE.Mesh(bellGeo, bellMat);
    this.bellMesh.position.y = 1.05;
    this.bellMesh.castShadow = true;
    this.group.add(this.bellMesh);

    // 3. Veilleuse discrète d'indication d'état
    this.beaconLight = new THREE.PointLight(0xdfba73, 0, 4.0);
    this.beaconLight.position.set(0, 1.25, 0);
    this.group.add(this.beaconLight);

    scene.add(this.group);
  }

  public setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.beaconLight.intensity = 0;
    }
  }

  public isActive(): boolean {
    return this.active;
  }

  public canInteract(playerPos: THREE.Vector3, cameraDir: THREE.Vector3): boolean {
    if (!this.active) return false;

    const dx = this.position.x - playerPos.x;
    const dy = this.position.y - playerPos.y;
    const dz = this.position.z - playerPos.z;
    const dist = Math.hypot(dx, dy, dz);

    if (dist > 2.8) return false;

    // Vérifier l'angle de visée vers le carillon
    const dirX = dx / dist;
    const dirY = dy / dist;
    const dirZ = dz / dist;
    const dot = dirX * cameraDir.x + dirY * cameraDir.y + dirZ * cameraDir.z;

    return dot > 0.65;
  }

  public trigger(): void {
    this.setActive(false);
    // Retour sonore immédiat de résonance métallique
    const bellSound = new Audio('/assets/sounds/empty-soft.wav');
    bellSound.volume = 0.6;
    void bellSound.play().catch(() => {});
  }

  public update(delta: number): void {
    if (!this.active) return;
    this.pulseTimer += delta * 3.0;
    // Lueur pulsée douce dorée pour attirer le regard sans agresser
    const glow = 0.5 + 0.5 * Math.sin(this.pulseTimer);
    this.beaconLight.intensity = 0.3 + glow * 0.7;
  }

  public getPrompt(): { text: string; color: string } {
    return {
      text: '[E] SONNER LE CARILLON · LANCER LA RENCONTRE',
      color: 'var(--gold, #dfba73)',
    };
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
  }
}
