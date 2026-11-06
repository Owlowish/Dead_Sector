import * as THREE from 'three';

export interface EnemyShotImpact {
  /** Direction mondiale du tir, du joueur vers la cible. */
  direction: THREE.Vector3;
  power: number;
}

type ImpactLevel = {
  isColliding(x: number, z: number, radius: number): boolean;
  getFloorHeightAt?(x: number, z: number): number;
};
type ImpactGeometry = { source: THREE.BufferGeometry; mesh: THREE.BufferGeometry; rest: Float32Array };

/** Qualité de la détonation reçue : indépendante des dégâts et du bonus tête. */
export function shotgunImpactPower(pellets: number, distance: number): number {
  const proximity = THREE.MathUtils.clamp(1 - Math.max(0, distance - 3) / 10, 0.1, 1);
  return THREE.MathUtils.clamp(pellets / 8, 0, 1) * proximity;
}

/** Poussée bornée et accent corporel sur les vraies poses, sans déplacer leur ancrage. */
export class EnemyImpact {
  private age = Infinity;
  private power = 0;
  private distance = 0;
  private fatal = false;
  private visualScale = 1;
  private readonly direction = new THREE.Vector3();
  private readonly localDirection = new THREE.Vector3();
  private readonly inverseRotation = new THREE.Quaternion();
  private readonly geometries = new Map<THREE.BufferGeometry, ImpactGeometry>();
  private readonly sources = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  private readonly meshes = new Set<THREE.Mesh>();

  start(impact?: EnemyShotImpact, resistance = 1, fatal = false, visualScale = 1): void {
    if (!impact || !Number.isFinite(impact.power) || impact.power <= 0
      || ![impact.direction.x, impact.direction.y, impact.direction.z].every(Number.isFinite)) return;
    this.age = 0;
    this.power = THREE.MathUtils.clamp(impact.power, 0, 1);
    this.fatal = fatal;
    this.visualScale = visualScale;
    this.direction.copy(impact.direction).setY(0);
    if (this.direction.lengthSq() > 0.000001) this.direction.normalize();
    this.distance = 0.72 * this.power * resistance * (fatal ? 1.15 : 1);
  }

  /** Intégration analytique, identique à 30/144 Hz ; collisions par sous-pas de 4 cm. */
  update(delta: number, position: THREE.Vector3, level: ImpactLevel | undefined, radius: number, groundOffset: number): void {
    if (!Number.isFinite(delta) || delta <= 0 || this.age === Infinity) return;
    const duration = this.fatal ? 0.34 : 0.26;
    const before = Math.min(1, this.age / duration);
    this.age = Math.min(this.fatal ? 0.44 : 0.34, this.age + delta);
    const after = Math.min(1, this.age / duration);
    const travel = this.distance * ((1 - before) ** 3 - (1 - after) ** 3);
    if (!level || travel <= 0 || this.direction.lengthSq() === 0) return;
    const steps = Math.max(1, Math.ceil(travel / 0.04));
    const dx = this.direction.x * travel / steps;
    const dz = this.direction.z * travel / steps;
    const floor = (x: number, z: number) => level.getFloorHeightAt?.(x, z) ?? position.y - groundOffset;
    for (let i = 0; i < steps; i++) {
      const floorY = floor(position.x, position.z);
      const x = position.x + dx;
      if (!level.isColliding(x, position.z, radius) && Math.abs(floor(x, position.z) - floorY) <= 0.12) position.x = x;
      const z = position.z + dz;
      if (!level.isColliding(position.x, z, radius) && Math.abs(floor(position.x, z) - floor(position.x, position.z)) <= 0.12) position.z = z;
    }
    position.y = floor(position.x, position.z) + groundOffset;
  }

  /** Les UV et les raycasts utilisent les mêmes sommets, propres à chaque instance. */
  apply(mesh: THREE.Mesh, localGroundY: number): void {
    const source = this.sources.get(mesh.geometry) ?? mesh.geometry;
    const duration = this.fatal ? 0.44 : 0.34;
    if (this.age >= duration) {
      mesh.geometry = source;
      return;
    }
    let geometry = this.geometries.get(source);
    if (!geometry) {
      const subdivided = subdivideSprite(source);
      geometry = { source, mesh: subdivided, rest: new Float32Array(subdivided.getAttribute('position').array) };
      this.geometries.set(source, geometry);
      this.sources.set(subdivided, source);
    }
    this.meshes.add(mesh);
    mesh.geometry = geometry.mesh;
    this.inverseRotation.copy(mesh.quaternion).invert();
    this.localDirection.copy(this.direction).applyQuaternion(this.inverseRotation);
    const positions = geometry.mesh.getAttribute('position');
    let height = 0.1;
    for (let i = 0; i < positions.count; i++) height = Math.max(height, geometry.rest[i * 3 + 1] - localGroundY);
    const envelope = (time: number) => {
      const t = THREE.MathUtils.clamp(time / duration, 0, 1);
      return Math.sin(Math.PI * Math.min(1, t / 0.26) / 2) * (1 - t) ** 1.5;
    };
    for (let i = 0; i < positions.count; i++) {
      const x = geometry.rest[i * 3], y = geometry.rest[i * 3 + 1], z = geometry.rest[i * 3 + 2];
      const weight = THREE.MathUtils.clamp((y - localGroundY) / height, 0, 1);
      // Les épaules partent d'abord, la tête suit 25 ms plus tard. Pieds immobiles.
      const lag = weight > 0.72 ? 0.025 : 0;
      const bend = envelope(Math.max(0, this.age - lag)) * this.power * this.visualScale;
      const lean = height * 0.16 * weight * weight * bend;
      positions.setXYZ(i, x + this.localDirection.x * lean,
        y - height * 0.035 * weight * bend, z + this.localDirection.z * lean);
    }
    positions.needsUpdate = true;
    geometry.mesh.computeVertexNormals();
    geometry.mesh.computeBoundingSphere();
    geometry.mesh.computeBoundingBox();
  }

  clear(): void {
    this.age = Infinity;
    this.distance = 0;
    for (const mesh of this.meshes) mesh.geometry = this.sources.get(mesh.geometry) ?? mesh.geometry;
  }

  dispose(): void {
    this.clear();
    for (const geometry of this.geometries.values()) geometry.mesh.dispose();
    this.geometries.clear();
    this.sources.clear();
    this.meshes.clear();
  }
}

/** Deux subdivisions conservent exactement contours/UV, y compris les poses découpées. */
function subdivideSprite(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const positions = source.getAttribute('position');
  const uvs = source.getAttribute('uv');
  const index = source.getIndex();
  const resultPositions: number[] = [], resultUvs: number[] = [];
  const vertex = (i: number) => [positions.getX(i), positions.getY(i), positions.getZ(i), uvs.getX(i), uvs.getY(i)];
  const midpoint = (a: number[], b: number[]) => a.map((value, i) => (value + b[i]) / 2);
  const triangle = (a: number[], b: number[], c: number[], depth: number): void => {
    if (depth > 0) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      triangle(a, ab, ca, depth - 1); triangle(ab, b, bc, depth - 1);
      triangle(ca, bc, c, depth - 1); triangle(ab, bc, ca, depth - 1);
    } else for (const v of [a, b, c]) {
      resultPositions.push(v[0], v[1], v[2]); resultUvs.push(v[3], v[4]);
    }
  };
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    triangle(vertex(index ? index.getX(i) : i), vertex(index ? index.getX(i + 1) : i + 1), vertex(index ? index.getX(i + 2) : i + 2), 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(resultPositions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(resultUvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
