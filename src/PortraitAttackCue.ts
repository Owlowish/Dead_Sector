import * as THREE from 'three';
import type { Level } from './Level.ts';
import { visualColors } from './VisualStyle.ts';

/** Trace au sol construite sur les sols réels, arrêtée par le premier obstacle. */
export class PortraitAttackCue {
  readonly group = new THREE.Group();
  readonly length: number;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly ruptureMaterial: THREE.MeshBasicMaterial;
  private readonly stainMaterial: THREE.MeshBasicMaterial;
  private readonly rupture: THREE.Mesh;
  private readonly sweepRadii: number[] = [];
  private readonly origin: THREE.Vector3;
  private readonly direction: THREE.Vector3;

  constructor(level: Level, origin: THREE.Vector3, direction: THREE.Vector3, length: number, halfWidth: number, sweep = false) {
    this.origin = origin.clone();
    this.direction = direction.clone();
    this.material = new THREE.MeshBasicMaterial({
      color: visualColors.warning, transparent: true, opacity: 0.65,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const vertices: number[] = [];
    const raised: number[] = [];
    const stain: number[] = [];
    const floor = level.getFloorHeightAt(origin.x, origin.z);
    let reached = 0;
    const segments = sweep ? 20 : Math.ceil(length / 0.25);
    const point = (distance: number, side: number, angle: number): THREE.Vector3 => {
      const forward = direction.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const p = origin.clone().addScaledVector(forward, distance).addScaledVector(right, side);
      p.y = level.getFloorHeightAt(p.x, p.z) + 0.035;
      return p;
    };
    const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    if (sweep) {
      // Chaque secteur est masqué par les obstacles, sans disque traversant un mur.
      for (let i = 0; i < segments; i++) {
        const a = -1.35 + i / segments * 2.7;
        const b = -1.35 + (i + 1) / segments * 2.7;
        let reach = 0;
        for (let r = 0.1; r <= length + 0.001; r += 0.1) {
          if (!clearGroundSegment(level, origin, point(r, 0, (a + b) / 2), 0.05)) break;
          reach = Math.min(length, r);
        }
        this.sweepRadii.push(reach);
        if (reach <= 0.1) continue;
        triangle(point(0, 0, a), point(reach, 0, a), point(reach, 0, b));
        const lowA = point(reach, 0, a).add(new THREE.Vector3(0, 0.75, 0));
        const lowB = point(reach, 0, b).add(new THREE.Vector3(0, 0.75, 0));
        const highA = lowA.clone().add(new THREE.Vector3(0, 0.18, 0));
        const highB = lowB.clone().add(new THREE.Vector3(0, 0.18, 0));
        raised.push(...lowA.toArray(), ...lowB.toArray(), ...highB.toArray(),
          ...lowA.toArray(), ...highB.toArray(), ...highA.toArray());
      }
      reached = length;
    } else {
      for (let i = 0; i < segments; i++) {
        const start = i * length / segments;
        const end = (i + 1) * length / segments;
        const a = point(start, -halfWidth, 0);
        const b = point(start, halfWidth, 0);
        const c = point(end, -halfWidth, 0);
        const d = point(end, halfWidth, 0);
        if ([c, d, point(end, 0, 0)].some(p => Math.abs(p.y - 0.035 - floor) > 0.8
          || level.isColliding(p.x, p.z, 0.04))) break;
        stain.push(...a.toArray(), ...c.toArray(), ...d.toArray(), ...a.toArray(), ...d.toArray(), ...b.toArray());
        // Fissure continue et coups de brosse irréguliers ; la bande bordeaux
        // indique toute la largeur dangereuse sans dessiner des rails blancs.
        const wobbleA = Math.sin(i * 2.17) * 0.16;
        const wobbleB = Math.sin((i + 1) * 2.17) * 0.16;
        const crackA = point(start, wobbleA - 0.035, 0);
        const crackB = point(start, wobbleA + 0.035, 0);
        const crackC = point(end, wobbleB - 0.035, 0);
        const crackD = point(end, wobbleB + 0.035, 0);
        triangle(crackA, crackC, crackD); triangle(crackA, crackD, crackB);
        if (i % 3 === 0) triangle(a, c, point(end, -halfWidth + 0.1, 0));
        if (i % 4 === 1) triangle(b, point(start, halfWidth - 0.1, 0), d);
        if (i % 5 === 2) triangle(crackA, point(end, halfWidth * 0.7, 0), crackD);
        if (i % 2 === 0) {
          const left = point(start, -halfWidth * 0.7, 0);
          const right = point(end, halfWidth * 0.7, 0);
          const tip = point((start + end) / 2, i % 4 === 0 ? 0.12 : -0.12, 0);
          tip.y += i % 4 === 0 ? 0.38 : 0.2;
          raised.push(...left.toArray(), ...right.toArray(), ...tip.toArray());
        }
        reached = end;
      }
    }
    this.length = reached;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.renderOrder = 2;
    this.group.add(mesh);
    const stainGeometry = new THREE.BufferGeometry();
    stainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stain, 3));
    this.stainMaterial = new THREE.MeshBasicMaterial({ color: 0x60151c, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.group.add(new THREE.Mesh(stainGeometry, this.stainMaterial));
    const ruptureGeometry = new THREE.BufferGeometry();
    ruptureGeometry.setAttribute('position', new THREE.Float32BufferAttribute(raised, 3));
    this.ruptureMaterial = new THREE.MeshBasicMaterial({ color: sweep ? visualColors.ivory : 0x7d232a,
      side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false });
    this.rupture = new THREE.Mesh(ruptureGeometry, this.ruptureMaterial);
    this.rupture.visible = false;
    this.group.add(this.rupture);
  }

  update(progress: number, released: boolean): void {
    this.material.color.setHex(released ? visualColors.blood : visualColors.warning);
    this.material.opacity = released ? 0.85 : 0.45 + Math.min(1, progress) * 0.4;
    this.rupture.visible = released;
  }

  coversSweepTarget(target: THREE.Vector3): boolean {
    const offset = target.clone().sub(this.origin).setY(0);
    const angle = Math.atan2(offset.x * this.direction.z - offset.z * this.direction.x, offset.dot(this.direction));
    if (Math.abs(angle) > 1.35) return false;
    const index = Math.min(this.sweepRadii.length - 1, Math.floor((angle + 1.35) / 2.7 * this.sweepRadii.length));
    return offset.length() <= (this.sweepRadii[index] ?? 0);
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const child of this.group.children) (child as THREE.Mesh).geometry.dispose();
    this.material.dispose();
    this.ruptureMaterial.dispose();
    this.stainMaterial.dispose();
  }
}

export function clearGroundSegment(level: Level, start: THREE.Vector3, end: THREE.Vector3, radius = 0.05): boolean {
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const steps = Math.max(1, Math.ceil(distance / 0.1));
  const floor = level.getFloorHeightAt(start.x, start.z);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = start.x + (end.x - start.x) * t;
    const z = start.z + (end.z - start.z) * t;
    if (level.isColliding(x, z, radius) || Math.abs(level.getFloorHeightAt(x, z) - floor) > 0.8) return false;
  }
  return true;
}
