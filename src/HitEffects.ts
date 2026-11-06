import * as THREE from 'three';
import { getImpactSurface, type ImpactSurface } from './ImpactSurface.ts';

export type ShotImpact = {
  kind: 'zombie' | 'surface';
  object: THREE.Object3D;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  direction: THREE.Vector3;
  surface?: ImpactSurface;
};

type Particle = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; velocity: THREE.Vector3; age: number; lifetime: number };
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
    const surface = impact.surface ?? getImpactSurface({ object: impact.object });
    const colors = blood ? [0x8f2925, 0xb84938, 0x641d20]
      : surface === 'wood' ? [0xa58b67, 0x66503b, 0xc0aa87]
      : surface === 'metal' ? [0xe4cc87, 0xcda35b, 0x899593]
      : [0x99958a, 0x686961, 0xb8b1a0];
    for (let i = 0; i < (blood ? 9 : 6); i++) {
      if (this.particles.length >= this.maxParticles) this.removeParticle(this.particles.shift()!);
      const material = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length], transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.pixelGeometry, material);
      mesh.position.copy(impact.point).addScaledVector(impact.normal, 0.02);
      mesh.scale.setScalar((blood ? 0.035 : 0.025) + Math.random() * 0.035);
      if (!blood && surface !== 'stone') mesh.scale.x *= surface === 'wood' ? 0.55 : 0.3;
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5)
        .addScaledVector(impact.normal, 0.8).multiplyScalar(blood ? 1.5 : 1);
      if (!blood && surface === 'metal') velocity.multiplyScalar(1.7);
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, age: 0, lifetime: (!blood && surface === 'metal' ? 0.12 : 0.22) + Math.random() * 0.16 });
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
