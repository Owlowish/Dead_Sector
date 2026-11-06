import * as THREE from 'three';
import { getImpactSurface, type ImpactSurface } from './ImpactSurface.ts';

export type ShotImpact = {
  kind: 'zombie' | 'surface';
  object: THREE.Object3D;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  direction: THREE.Vector3;
  surface?: ImpactSurface;
  weaponId?: 'axe' | 'pistol' | 'shotgun';
  /** Qualité du choc reçu par cette cible, après cumul des plombs : 0 à 1. */
  power?: number;
};

type Particle = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; velocity: THREE.Vector3; age: number; lifetime: number; angle: number; spin: number };
type Mark = { mesh: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>; age: number };

export class HitEffects {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private marks: Mark[] = [];
  private readonly pixelGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly markGeometry: THREE.ShapeGeometry;
  private readonly maxParticles = 64;
  private readonly maxMarks = 24;
  private readonly markLifetime = 5;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Contour en marches d'escalier, partagé par toutes les petites traces.
    const shape = new THREE.Shape();
    const points = [[-0.5, -0.15], [-0.3, -0.15], [-0.3, -0.4], [0, -0.4], [0, -0.5], [0.3, -0.5], [0.3, -0.2], [0.5, -0.2], [0.5, 0.15], [0.25, 0.15], [0.25, 0.4], [-0.1, 0.4], [-0.1, 0.25], [-0.5, 0.25]];
    points.forEach(([x, y], index) => index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
    shape.closePath();
    this.markGeometry = new THREE.ShapeGeometry(shape);
  }

  public emit(impact: ShotImpact): void {
    const blood = impact.kind === 'zombie';
    const shotgun = blood && impact.weaponId === 'shotgun';
    const portrait = blood && impact.object.userData.impactMaterial === 'portrait';
    const power = Number.isFinite(impact.power) ? THREE.MathUtils.clamp(impact.power!, 0, 1) : 0;
    const surface = impact.surface ?? getImpactSurface({ object: impact.object });
    const colors = portrait ? [0x712731, 0xd4c6a5, 0xb69a60, 0x9b8261]
      : blood ? shotgun ? [0x641d20, 0xa84435, 0x4d161a, 0xc05a46] : [0x8f2925, 0xb84938, 0x641d20]
      : surface === 'wood' ? [0xa58b67, 0x66503b, 0xc0aa87]
      : surface === 'metal' ? [0xe4cc87, 0xcda35b, 0x899593]
      : [0x99958a, 0x686961, 0xb8b1a0];
    const direction = impact.direction.clone();
    if (direction.lengthSq() < 0.001) direction.copy(impact.normal).negate();
    if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    const count = shotgun ? 10 + Math.round(power * 16) : blood ? 9 : 6;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) this.removeParticle(this.particles.shift()!);
      const material = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length], transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
      });
      const mesh = new THREE.Mesh(this.pixelGeometry, material);
      mesh.position.copy(impact.point).addScaledVector(impact.normal, 0.02);
      mesh.scale.setScalar((blood ? 0.035 : 0.025) + Math.random() * 0.035);
      if (!blood && surface !== 'stone') mesh.scale.x *= surface === 'wood' ? 0.55 : 0.3;
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5)
        .addScaledVector(impact.normal, 0.8).multiplyScalar(blood ? 1.5 : 1);
      if (!blood && surface === 'metal') velocity.multiplyScalar(1.7);
      let lifetime = (!blood && surface === 'metal' ? 0.12 : 0.22) + Math.random() * 0.16;
      if (shotgun) {
        const coarse = i % 3 === 0;
        const returning = i % 3 === 0;
        const speed = (0.8 + power * 1.5) * (0.7 + Math.random() * 0.3);
        // La majorité accompagne le tir ; quelques éclats reviennent devant le
        // sprite, de part et d'autre du point visé, pour lire le choc de face.
        const side = (i % 2 === 0 ? -1 : 1) * (0.6 + Math.random() * 0.65);
        mesh.position.addScaledVector(right, Math.sign(side) * (0.02 + power * 0.06));
        velocity.copy(direction).multiplyScalar(speed * (returning ? -0.65 : 1))
          .addScaledVector(right, side * speed)
          .addScaledVector(up, (Math.random() - 0.3) * speed * 0.55);
        velocity.y += 0.3 + Math.random() * 0.45;
        const size = (coarse ? 0.05 : 0.022) + power * 0.03 + Math.random() * 0.015;
        mesh.scale.set(size * (portrait ? 0.65 : 0.75), size * (coarse ? portrait ? 2.2 : 1.45 : 1), 1);
        lifetime = 0.18 + Math.random() * 0.13 + (coarse ? 0.04 : 0);
      }
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, age: 0, lifetime,
        angle: shotgun ? Math.random() * Math.PI : 0,
        spin: shotgun ? (Math.random() - 0.5) * (portrait ? 9 : 5) : 0,
      });
    }
    if (blood) return;

    if (this.marks.length >= this.maxMarks) this.removeMark(this.marks.shift()!);
    const mesh = new THREE.Mesh(this.markGeometry, new THREE.MeshBasicMaterial({
      color: surface === 'wood' ? 0x211510 : surface === 'metal' ? 0x20282a : 0x34332e,
      transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    mesh.scale.setScalar(0.1 + Math.random() * 0.04);
    mesh.position.copy(impact.point).addScaledVector(impact.normal, 0.006);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), impact.normal);
    mesh.rotateZ(Math.floor(Math.random() * 4) * Math.PI / 2);
    this.scene.add(mesh);
    // Préserve la pose mondiale puis suit le battant si la porte bouge.
    impact.object.attach(mesh);
    this.marks.push({ mesh, age: 0 });
  }

  public update(delta: number, camera: THREE.Camera): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const orientation = camera.getWorldQuaternion(new THREE.Quaternion());
    this.particles = this.particles.filter((particle) => {
      particle.age += delta;
      if (particle.age >= particle.lifetime) {
        this.removeParticle(particle);
        return false;
      }
      particle.velocity.y -= 3 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.quaternion.copy(orientation);
      particle.mesh.rotateZ(particle.angle + particle.spin * particle.age);
      particle.mesh.material.opacity = 1 - particle.age / particle.lifetime;
      return true;
    });
    this.marks = this.marks.filter((mark) => {
      mark.age += delta;
      if (mark.age >= this.markLifetime) {
        this.removeMark(mark);
        return false;
      }
      mark.mesh.material.opacity = 0.9 * Math.min(1, this.markLifetime - mark.age);
      return true;
    });
  }

  private removeParticle(particle: Particle): void {
    particle.mesh.removeFromParent();
    particle.mesh.material.dispose();
  }

  private removeMark(mark: Mark): void {
    mark.mesh.removeFromParent();
    mark.mesh.material.dispose();
  }

  public clear(): void {
    this.particles.forEach((particle) => this.removeParticle(particle));
    this.marks.forEach((mark) => this.removeMark(mark));
    this.particles = [];
    this.marks = [];
  }

  public dispose(): void {
    this.clear();
    this.pixelGeometry.dispose();
    this.markGeometry.dispose();
  }
}
