import * as THREE from 'three';
import { portraitProjectileAnimation } from './PortraitProjectileAnimation.ts';

type PortraitParticleAttack = 'blades' | 'tear' | 'sweep';
type TransformationStage = 'gather' | 'burst';

interface Fragment {
  active: boolean;
  age: number;
  lifetime: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  width: number; height: number;
  angle: number; spin: number;
  gravity: number;
  aligned: boolean;
  dx: number; dy: number; dz: number;
}

/** Éclats de peinture/toile purement cosmétiques, avec une allocation GPU fixe. */
export class PortraitParticles {
  private readonly scene: THREE.Scene;
  private readonly random: () => number;
  private readonly capacity = 144;
  private readonly fragments: Fragment[];
  private readonly mesh: THREE.InstancedMesh;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly colors = [0x712731, 0xd4c6a5, 0xb69a60, 0x9b8261].map(value => new THREE.Color(value));
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly cameraRotation = new THREE.Quaternion();
  private readonly inverseCameraRotation = new THREE.Quaternion();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly projectedPosition = new THREE.Vector3();
  private readonly projectedDirection = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly spinRotation = new THREE.Quaternion();
  private readonly spinAxis = new THREE.Vector3(0, 0, 1);
  private readonly screenRight = new THREE.Vector3(1, 0, 0);
  private readonly surfaceNormal = new THREE.Vector3();
  private cursor = 0;
  private active = 0;
  private emitted = 0;
  private dropped = 0;
  private disposed = false;
  private projectionScaleX = 1;
  private projectionScaleY = 1;

  constructor(scene: THREE.Scene, random: () => number = Math.random) {
    this.scene = scene;
    this.random = random;
    this.fragments = Array.from({ length: this.capacity }, () => ({
      active: false, age: 0, lifetime: 0, x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0, width: 0, height: 0, angle: 0, spin: 0,
      gravity: 3.8, aligned: false, dx: 0, dy: 0, dz: 0,
    }));
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: false, forceSinglePass: true,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.name = 'portrait-paint-fragments';
    this.mesh.frustumCulled = false;
    // Après le décor opaque et les billboards, avec test de profondeur conservé.
    this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    // instanceColor existe dès le premier rendu, sans variante de shader tardive.
    for (let i = 0; i < this.capacity; i++) this.mesh.setColorAt(i, this.colors[0]);
    this.clear();
    scene.add(this.mesh);
  }

  trail(position: THREE.Vector3, direction: THREE.Vector3): void {
    if (this.disposed) return;
    // Une brève écaille sombre : l'ivoire reste réservé au noyau dangereux.
    const spread = this.random() - 0.5;
    this.spawn(position.x, position.y, position.z,
      -direction.x * 0.5 + spread * 0.25, 0.12 + this.random() * 0.18,
      -direction.z * 0.5 - spread * 0.25,
      0.018 + this.random() * 0.012, 0.035 + this.random() * 0.025,
      portraitProjectileAnimation.trail.lifetime * (0.6 + this.random() * 0.4), 0,
      (this.random() - 0.5) * 0.2, (this.random() - 0.5) * 0.8,
      1.4, direction);
  }

  impact(position: THREE.Vector3, normal?: THREE.Vector3): void {
    if (this.disposed) return;
    this.surfaceNormal.copy(normal ?? this.spinAxis);
    if (this.surfaceNormal.lengthSq() < 0.001) this.surfaceNormal.set(0, 1, 0);
    this.surfaceNormal.normalize();
    const n = this.surfaceNormal;
    for (let i = 0; i < 10; i++) {
      const speed = 0.7 + this.random() * 0.6;
      // La poussée reste dans l'hémisphère extérieur du premier obstacle touché.
      const tangentX = n.z * (this.random() - 0.5) * 0.7;
      const tangentZ = -n.x * (this.random() - 0.5) * 0.7;
      this.spawn(position.x + n.x * 0.025, position.y + n.y * 0.025, position.z + n.z * 0.025,
        n.x * speed + tangentX, n.y * speed + (n.y < -0.5 ? -0.2 : 0.6),
        n.z * speed + tangentZ,
        0.025 + this.random() * 0.035, 0.025 + this.random() * 0.04,
        0.15 + this.random() * 0.1, i % 4,
        this.random() * Math.PI, (this.random() - 0.5) * 9);
    }
  }

  /** origin désigne le sol sous le boss ; les éclats encadrent sa silhouette. */
  transformation(origin: THREE.Vector3, stage: TransformationStage): void {
    if (this.disposed) return;
    const burst = stage === 'burst';
    const count = burst ? 72 : 18;
    const right = this.screenRight;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const offset = 0.55 + this.random() * 0.45;
      const speed = burst ? 2 + this.random() * 1.5 : -0.2;
      const depth = (this.random() - 0.5) * 0.35;
      const color = Math.floor(i / 2) % 4;
      const cloth = color === 1 || color === 3;
      const width = cloth ? 0.035 + this.random() * 0.03 : 0.018 + this.random() * 0.02;
      const height = burst
        ? cloth ? 0.18 + this.random() * 0.12 : color === 2 ? 0.035 + this.random() * 0.04 : 0.09 + this.random() * 0.07
        : 0.07 + this.random() * 0.07;
      this.spawn(origin.x + right.x * side * offset + right.z * depth,
        origin.y + 0.9 + this.random() * 0.9,
        origin.z + right.z * side * offset - right.x * depth,
        right.x * side * speed + right.z * depth,
        burst ? 0.6 + this.random() * 0.8 : 0.12,
        right.z * side * speed - right.x * depth,
        width, height, burst ? 0.5 + this.random() * 0.3 : 0.65 + this.random() * 0.1,
        color, this.random() * Math.PI, (this.random() - 0.5) * (burst ? 6 : 1.5),
        burst ? 2.2 : 0.12);
    }
  }

  /** Petit effritement sur le bras, sans voiler le visage ni la zone de visée. */
  prepare(origin: THREE.Vector3, direction: THREE.Vector3, attack: PortraitParticleAttack): void {
    if (this.disposed) return;
    const right = this.screenRight;
    const height = attack === 'tear' ? 0.25 : attack === 'sweep' ? 0.7 : 1.05;
    for (let i = 0; i < 6; i++) {
      const offset = 0.55 + this.random() * 0.3;
      this.spawn(origin.x - right.x * offset + direction.x * 0.1,
        origin.y + height + this.random() * 0.18,
        origin.z - right.z * offset + direction.z * 0.1,
        -right.x * 0.18, 0.1 + this.random() * 0.2, -right.z * 0.18,
        0.018 + this.random() * 0.02, 0.035 + this.random() * 0.03,
        0.25 + this.random() * 0.15, i % 3,
        this.random() * Math.PI, (this.random() - 0.5) * 3);
    }
  }

  update(delta: number, camera: THREE.Camera): void {
    if (this.disposed || delta <= 0 || !Number.isFinite(delta)) return;
    camera.getWorldQuaternion(this.cameraRotation);
    this.inverseCameraRotation.copy(this.cameraRotation).invert();
    camera.getWorldPosition(this.cameraPosition);
    this.projectionScaleX = camera.projectionMatrix.elements[0];
    this.projectionScaleY = camera.projectionMatrix.elements[5];
    this.screenRight.set(1, 0, 0).applyQuaternion(this.cameraRotation);
    this.screenRight.y = 0;
    if (this.screenRight.lengthSq() < 0.001) this.screenRight.set(1, 0, 0);
    this.screenRight.normalize();
    for (let i = 0; i < this.capacity; i++) {
      const fragment = this.fragments[i];
      if (!fragment.active) continue;
      fragment.age += delta;
      if (fragment.age >= fragment.lifetime) {
        fragment.active = false;
        this.active--;
        this.matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.matrix);
        continue;
      }
      fragment.x += fragment.vx * delta;
      fragment.y += fragment.vy * delta - fragment.gravity * 0.5 * delta * delta;
      fragment.z += fragment.vz * delta;
      fragment.vy -= fragment.gravity * delta;
      fragment.angle += fragment.spin * delta;
      this.writeMatrix(i, fragment);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = this.active > 0;
  }

  clear(): void {
    if (this.disposed) return;
    for (let i = 0; i < this.capacity; i++) {
      this.fragments[i].active = false;
      this.matrix.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.active = 0;
    this.cursor = 0;
    this.mesh.visible = false;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  getStats(): { active: number; capacity: number; drawCalls: number; emitted: number; dropped: number; disposed: boolean } {
    return { active: this.active, capacity: this.capacity, drawCalls: this.active > 0 ? 1 : 0,
      emitted: this.emitted, dropped: this.dropped, disposed: this.disposed };
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number,
    width: number, height: number, lifetime: number, color: number, angle: number, spin: number,
    gravity = 3.8, alignedDirection?: THREE.Vector3): void {
    if (this.active === this.capacity) { this.dropped++; return; }
    for (let attempts = 0; attempts < this.capacity; attempts++) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const fragment = this.fragments[index];
      if (fragment.active) continue;
      fragment.active = true;
      fragment.age = 0; fragment.lifetime = lifetime;
      fragment.x = x; fragment.y = y; fragment.z = z;
      fragment.vx = vx; fragment.vy = vy; fragment.vz = vz;
      fragment.width = width; fragment.height = height;
      fragment.angle = angle; fragment.spin = spin;
      fragment.gravity = gravity;
      fragment.aligned = Boolean(alignedDirection);
      fragment.dx = alignedDirection?.x ?? 0;
      fragment.dy = alignedDirection?.y ?? 0;
      fragment.dz = alignedDirection?.z ?? 0;
      this.mesh.setColorAt(index, this.colors[color]);
      this.writeMatrix(index, fragment);
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor!.needsUpdate = true;
      this.active++;
      this.emitted++;
      this.mesh.visible = true;
      return;
    }
  }

  private writeMatrix(index: number, fragment: Fragment): void {
    const remaining = 1 - fragment.age / fragment.lifetime;
    const shrink = Math.min(1, remaining * 4);
    this.position.set(fragment.x, fragment.y, fragment.z);
    this.scale.set(fragment.width * shrink, fragment.height * shrink, 1);
    let angle = fragment.angle;
    if (fragment.aligned) {
      this.projectedPosition.copy(this.position).sub(this.cameraPosition).applyQuaternion(this.inverseCameraRotation);
      this.projectedDirection.set(fragment.dx, fragment.dy, fragment.dz).applyQuaternion(this.inverseCameraRotation);
      const p = this.projectedPosition, d = this.projectedDirection;
      // Dérivée de la projection perspective : une trajectoire vers la caméra
      // garde aussi une traînée radiale lisible sur les deux lames latérales.
      const sx = (d.x * -p.z + p.x * d.z) * this.projectionScaleX;
      const sy = (d.y * -p.z + p.y * d.z) * this.projectionScaleY;
      if (sx * sx + sy * sy > 0.000001) angle += Math.atan2(sy, sx) - Math.PI / 2;
    }
    this.spinRotation.setFromAxisAngle(this.spinAxis, angle);
    this.rotation.copy(this.cameraRotation).multiply(this.spinRotation);
    this.matrix.compose(this.position, this.rotation, this.scale);
    this.mesh.setMatrixAt(index, this.matrix);
  }
}
