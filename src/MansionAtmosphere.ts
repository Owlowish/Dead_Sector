import * as THREE from 'three';

// Volumes étroits près de la lumière, loin des axes de combat et des escaliers.
export const mansionDustVolumes = [
  { roomId: 'vestibule', x: 8.5, y: 2.5, z: 18.0, width: 2.2, height: 1.6, depth: 1.5, color: 0x8d9dac },
  { roomId: 'salon', x: -11.1, y: 2.3, z: 13, width: 1.8, height: 1.5, depth: 3.4, color: 0xb49770 },
  { roomId: 'galerie', x: -21.7, y: 3, z: -3.4, width: 2, height: 1.8, depth: 2.6, color: 0x8194a7 },
  { roomId: 'grand_hall', x: 8.1, y: 3.7, z: 0, width: 2.6, height: 2, depth: 3, color: 0xa99877 },
  { roomId: 'bibliotheque', x: -21.5, y: 4.8, z: -10.5, width: 2.4, height: 1.8, depth: 2.5, color: 0x8e9caa },
  { roomId: 'atelier', x: 16.5, y: 4.7, z: -14, width: 2.4, height: 1.6, depth: 2.4, color: 0xa59a82 },
] as const;

export const mansionAtmosphereBudget = { pointsPerRoom: 24, maxDrawCalls: 6, textures: 0, lights: 0 } as const;

interface DustCloud {
  position: THREE.BufferAttribute;
  bases: Float32Array;
  phases: Float32Array;
}

/** Un nombre fixe de points ; pas de simulation physique ni de particules créées en boucle. */
export class MansionAtmosphere {
  private readonly group = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly clouds: DustCloud[] = [];
  private readonly material: THREE.PointsMaterial;
  private elapsed = 0;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'mansion-atmosphere';
    this.material = new THREE.PointsMaterial({
      size: 0.028, sizeAttenuation: true, transparent: true, opacity: 0.17,
      vertexColors: true, depthWrite: false, fog: true,
    });
    this.material.name = 'mansion-dust';
    let seed = 1273;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (const volume of mansionDustVolumes) {
      const count = mansionAtmosphereBudget.pointsPerRoom;
      const bases = new Float32Array(count * 3), phases = new Float32Array(count);
      const colors = new Float32Array(count * 3), color = new THREE.Color(volume.color);
      for (let i = 0; i < count; i++) {
        bases[i * 3] = (random() - 0.5) * volume.width;
        bases[i * 3 + 1] = (random() - 0.5) * volume.height;
        bases[i * 3 + 2] = (random() - 0.5) * volume.depth;
        phases[i] = random() * Math.PI * 2;
        const intensity = 0.48 + random() * 0.5;
        colors.set([color.r * intensity, color.g * intensity, color.b * intensity], i * 3);
      }
      const geometry = new THREE.BufferGeometry();
      const position = new THREE.BufferAttribute(bases.slice(), 3).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', position);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      // Les oscillations restent dans cette enveloppe : pas de recalcul des bornes à chaque image.
      geometry.boundingBox = new THREE.Box3(
        new THREE.Vector3(-volume.width / 2 - 0.12, -volume.height / 2 - 0.08, -volume.depth / 2 - 0.12),
        new THREE.Vector3(volume.width / 2 + 0.12, volume.height / 2 + 0.08, volume.depth / 2 + 0.12),
      );
      geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
      const points = new THREE.Points(geometry, this.material);
      points.name = `mansion-dust-${volume.roomId}`;
      points.position.set(volume.x, volume.y, volume.z);
      points.updateMatrix();
      points.matrixAutoUpdate = false;
      this.group.add(points);
      this.geometries.push(geometry);
      this.clouds.push({ position, bases, phases });
    }
    scene.add(this.group);
    this.updatePositions();
  }

  public update(delta: number): void {
    if (this.disposed || !Number.isFinite(delta) || delta <= 0) return;
    this.elapsed += Math.min(delta, 0.05);
    this.updatePositions();
  }

  private updatePositions(): void {
    for (const cloud of this.clouds) {
      const array = cloud.position.array;
      for (let i = 0; i < cloud.phases.length; i++) {
        const phase = cloud.phases[i];
        array[i * 3] = cloud.bases[i * 3] + Math.sin(this.elapsed * 0.11 + phase) * 0.12;
        array[i * 3 + 1] = cloud.bases[i * 3 + 1] + Math.sin(this.elapsed * 0.07 + phase * 2) * 0.08;
        array[i * 3 + 2] = cloud.bases[i * 3 + 2] + Math.cos(this.elapsed * 0.09 + phase) * 0.12;
      }
      cloud.position.needsUpdate = true;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    this.material.dispose();
  }
}
