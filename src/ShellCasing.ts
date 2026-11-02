import * as THREE from 'three';
import { visualColors } from './VisualStyle';

export type CasingType = '9mm' | '12gauge';

export class ShellCasing {
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private velocity: THREE.Vector3;
  private spinAxis: THREE.Vector3;
  private spinSpeed: number;
  private lifetime: number;
  private isResting = false;
  private readonly floorY = 0.02;

  constructor(scene: THREE.Scene, camera: THREE.Camera, aimAmount = 0, type: CasingType = '9mm') {
    this.scene = scene;
    this.lifetime = 3.5;

    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    if (type === '12gauge') {
      // Cartouche de calibre 12 rouge avec culot laiton
      geometry = new THREE.CylinderGeometry(0.018, 0.018, 0.065, 8);
      material = new THREE.MeshStandardMaterial({
        color: 0x991b1b, // Rouge carmin profond
        roughness: 0.5,
        metalness: 0.2,
      });
    } else {
      // Douille 9mm en laiton
      geometry = new THREE.CylinderGeometry(0.014, 0.014, 0.045, 8);
      material = new THREE.MeshStandardMaterial({
        color: visualColors.brass,
        metalness: 0.85,
        roughness: 0.3,
      });
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;

    // Repère local de la caméra
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();

    camera.getWorldDirection(forward);
    up.set(0, 1, 0);
    right.crossVectors(forward, up).normalize();
    up.crossVectors(right, forward).normalize();

    // Position d'éjection (chambre d'éjection à droite)
    const rightOffset = aimAmount > 0.5 ? 0.14 : 0.24;
    const downOffset = aimAmount > 0.5 ? 0.08 : 0.14;
    const forwardOffset = 0.38;

    this.mesh.position
      .copy(camera.position)
      .addScaledVector(right, rightOffset)
      .addScaledVector(up, -downOffset)
      .addScaledVector(forward, forwardOffset);

    // Vitesse initiale balistique : éjection vers la droite, le haut et l'arrière
    const speedRight = type === '12gauge' ? 2.2 + Math.random() * 0.6 : 1.8 + Math.random() * 0.8;
    const speedUp = 1.4 + Math.random() * 0.6;
    const speedForward = -0.4 + (Math.random() - 0.5) * 0.4;

    this.velocity = new THREE.Vector3()
      .addScaledVector(right, speedRight)
      .addScaledVector(up, speedUp)
      .addScaledVector(forward, speedForward);

    this.spinAxis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();

    this.spinSpeed = 15 + Math.random() * 15;

    this.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    this.scene.add(this.mesh);
  }

  public update(delta: number): boolean {
    if (this.isResting) {
      this.lifetime -= delta;
      if (this.lifetime <= 0) {
        this.dispose();
        return false;
      }
      return true;
    }

    // Gravité
    this.velocity.y -= 9.81 * delta;

    this.mesh.position.addScaledVector(this.velocity, delta);
    this.mesh.rotateOnAxis(this.spinAxis, this.spinSpeed * delta);

    // Collision avec le sol
    if (this.mesh.position.y <= this.floorY) {
      this.mesh.position.y = this.floorY;

      // Rebond
      if (this.velocity.y < -1.0) {
        this.velocity.y = -this.velocity.y * 0.35;
        this.velocity.x *= 0.6;
        this.velocity.z *= 0.6;
        this.spinSpeed *= 0.5;
      } else {
        // Stabilisation au sol
        this.isResting = true;
        this.velocity.set(0, 0, 0);
        this.mesh.rotation.x = Math.PI / 2;
      }
    }

    this.lifetime -= delta;
    if (this.lifetime <= 0) {
      this.dispose();
      return false;
    }

    return true;
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((mat) => mat.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}
