/**
 * DEAD SECTOR — Présentoir 3D in-world d'amélioration (Atelier F2).
 *
 * NOTE IMPORTANTE POUR LA DIRECTION ARTISTIQUE / PROTOTYPE :
 * Ce composant est un PROTOTYPE TECHNIQUE d'interaction sans menu.
 * Il manque actuellement un SPRITE / ICÔNE 2D pixel art dédié pour chaque offre
 * (par exemple : parchemin scellé, cartouchière illustrée, flacon d'élixir).
 * Actuellement représenté par un pupitre victorien en chêne avec stèle en pierre
 * et veilleuse douce. À habiller avec de vrais sprites lors de l'atelier visuel F3.
 */

import * as THREE from 'three';
import type { UpgradeSpec } from './UpgradeConfig.ts';

export class UpgradePedestal {
  private readonly group: THREE.Group;
  private readonly plaqueMesh: THREE.Mesh;
  private readonly beaconLight: THREE.PointLight;
  private readonly position: THREE.Vector3;

  private currentOffer: UpgradeSpec | null = null;
  private active = false;
  private chosen = false;
  private pulseTimer = 0;

  constructor(scene: THREE.Scene, x: number, z: number, floorY: number, _label = '') {
    this.position = new THREE.Vector3(x, floorY + 1.1, z);
    this.group = new THREE.Group();
    this.group.position.set(x, floorY, z);

    // 1. Socle / piédestal en chêne sombre patiné
    const pedestalGeo = new THREE.BoxGeometry(0.55, 0.9, 0.55);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x221810,
      roughness: 0.8,
      metalness: 0.1,
    });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalMesh.position.y = 0.45;
    pedestalMesh.castShadow = true;
    pedestalMesh.receiveShadow = true;
    this.group.add(pedestalMesh);

    // 2. Pupitre incliné avec plaque gravée
    const plaqueGeo = new THREE.BoxGeometry(0.48, 0.28, 0.08);
    const plaqueMat = new THREE.MeshStandardMaterial({
      color: 0x4a3e35, // Pierre taillée / laiton vieilli
      roughness: 0.5,
      metalness: 0.4,
    });
    this.plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    this.plaqueMesh.position.set(0, 0.98, 0.05);
    this.plaqueMesh.rotation.x = -Math.PI / 6; // Incliné vers le joueur
    this.plaqueMesh.castShadow = true;
    this.group.add(this.plaqueMesh);

    // 3. Veilleuse mystique au sommet (pulsation dorée)
    this.beaconLight = new THREE.PointLight(0xdfba73, 0, 3.5);
    this.beaconLight.position.set(0, 1.25, 0);
    this.group.add(this.beaconLight);

    scene.add(this.group);
  }

  public setOffer(offer: UpgradeSpec): void {
    this.currentOffer = offer;
    this.active = true;
    this.chosen = false;
    this.beaconLight.intensity = 0.5;
  }

  public close(): void {
    this.active = false;
    this.currentOffer = null;
    this.beaconLight.intensity = 0;
  }

  public isActive(): boolean {
    return this.active && !this.chosen && this.currentOffer !== null;
  }

  public getOffer(): UpgradeSpec | null {
    return this.currentOffer;
  }

  public canInteract(playerPos: THREE.Vector3, cameraDir: THREE.Vector3): boolean {
    if (!this.isActive()) return false;

    const dx = this.position.x - playerPos.x;
    const dy = this.position.y - playerPos.y;
    const dz = this.position.z - playerPos.z;
    const dist = Math.hypot(dx, dy, dz);

    if (dist > 2.8) return false;

    // Test de vue conique (le joueur regarde la stèle)
    const dirX = dx / dist;
    const dirY = dy / dist;
    const dirZ = dz / dist;
    const dot = dirX * cameraDir.x + dirY * cameraDir.y + dirZ * cameraDir.z;

    return dot > 0.65;
  }

  public choose(): UpgradeSpec | null {
    if (!this.isActive() || !this.currentOffer) return null;

    const chosenOffer = this.currentOffer;
    this.chosen = true;
    this.active = false;
    this.beaconLight.intensity = 0;

    // Son de validation d'offrande
    const chime = new Audio('/assets/sounds/empty-soft.wav');
    chime.volume = 0.5;
    void chime.play().catch(() => {});

    return chosenOffer;
  }

  public update(delta: number): void {
    if (!this.active || this.chosen) {
      if (this.beaconLight.intensity > 0) this.beaconLight.intensity = 0;
      return;
    }

    this.pulseTimer += delta * 2.5;
    const pulse = 0.5 + 0.5 * Math.sin(this.pulseTimer);
    this.beaconLight.intensity = 0.3 + pulse * 0.6;
  }

  public getPrompt(): { text: string; color: string } {
    if (!this.currentOffer) return { text: '', color: '' };
    return {
      text: `[E] CHOISIR : ${this.currentOffer.name.toUpperCase()} · ${this.currentOffer.shortDesc}`,
      color: 'var(--gold, #dfba73)',
    };
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
  }
}
