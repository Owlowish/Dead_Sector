import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mansionBoxGeometry, mansionMaterial } from './MansionMaterials.ts';
import { setImpactSurface } from './ImpactSurface.ts';

type Point = readonly [number, number, number];
interface Batch { material: THREE.Material; solid: boolean; parts: THREE.BufferGeometry[] }

/** Autel de la Galerie : volumes solides distincts des effets, aucun éclairage supplémentaire. */
export class DemonicAltar {
  private readonly group = new THREE.Group();
  private readonly solids: THREE.Mesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly crystals: THREE.Group[] = [];
  private readonly flamePositions: THREE.Vector3[] = [];
  private readonly flames: THREE.InstancedMesh;
  private readonly embers: THREE.InstancedMesh;
  private readonly wisps: THREE.Mesh;
  private readonly glow: THREE.MeshBasicMaterial;
  private readonly flameMaterial: THREE.MeshBasicMaterial;
  private readonly wispMaterial: THREE.MeshBasicMaterial;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private time = 0;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'demonic-altar';
    this.group.position.set(-18, 0, 0);
    const own = <T extends THREE.Material>(material: T, name: string): T => {
      material.name = `altar-${name}`;
      this.materials.push(material);
      return material;
    };
    const stone = own(mansionMaterial('stone').clone(), 'stone');
    stone.color.setHex(0xaca39b);
    stone.vertexColors = true;
    stone.roughness = 0.96;
    const obsidian = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0x68616c, vertexColors: true, roughness: 0.78, metalness: 0.12,
      emissive: 0x261114, emissiveIntensity: 0.24,
    }), 'stone'), 'obsidian');
    const iron = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0x66503d, vertexColors: true, roughness: 0.72, metalness: 0.5,
    }), 'metal'), 'iron');
    const wax = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0xdfc69b, vertexColors: true, roughness: 0.95,
      emissive: 0x65300e, emissiveIntensity: 0.12,
    }), 'stone'), 'wax');
    const blood = own(new THREE.MeshStandardMaterial({
      color: 0x560b11, vertexColors: true, roughness: 0.62, metalness: 0.05,
    }), 'blood');
    const cloth = own(new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide,
    }), 'banners');
    this.glow = own(new THREE.MeshBasicMaterial({ color: 0xdb291d, vertexColors: true }), 'runes');
    this.flameMaterial = own(new THREE.MeshBasicMaterial({ color: 0xffc16a }), 'flames');
    this.wispMaterial = own(new THREE.MeshBasicMaterial({
      color: 0xa90d16, transparent: true, opacity: 0.28, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true,
    }), 'wisps');

    const batches: Batch[] = [];
    const batch = (material: THREE.Material, solid = false): Batch => {
      const result = { material, solid, parts: [] as THREE.BufferGeometry[] };
      batches.push(result);
      return result;
    };
    const stones = batch(stone, true), dark = batch(obsidian, true), metal = batch(iron, true);
    const candles = batch(wax, true), stains = batch(blood), banners = batch(cloth), runes = batch(this.glow);
    const tint = (geometry: THREE.BufferGeometry, color = 0xffffff) => {
      // Primitives mélangées : un format non indexé commun, sans groupes de matériaux.
      if (geometry.index) {
        const original = geometry;
        geometry = original.toNonIndexed();
        original.dispose();
      }
      geometry.clearGroups();
      const count = geometry.getAttribute('position').count;
      if (!geometry.hasAttribute('uv')) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      const colors = new Float32Array(count * 3), value = new THREE.Color(color);
      for (let i = 0; i < count; i++) value.toArray(colors, i * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geometry;
    };
    const box = (target: Batch, size: Point, center: Point, color = 0xffffff) => {
      const geometry = mansionBoxGeometry(...size, 1.5);
      geometry.translate(...center);
      target.parts.push(tint(geometry, color));
    };
    const cylinder = (target: Batch, top: number, bottom: number, height: number, center: Point, color = 0xffffff) => {
      const geometry = new THREE.CylinderGeometry(top, bottom, height, 8);
      geometry.translate(...center);
      target.parts.push(tint(geometry, color));
    };
    const line = (target: Batch, points: readonly Point[], radius: number, color = 0xffffff) => {
      for (let i = 1; i < points.length; i++) {
        const a = new THREE.Vector3(...points[i - 1]), b = new THREE.Vector3(...points[i]);
        const direction = b.clone().sub(a);
        const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 4);
        geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
        geometry.translate(...a.add(b).multiplyScalar(0.5).toArray());
        target.parts.push(tint(geometry, color));
      }
    };
    // Un même sceau pentagonal pour la façade, les côtés et les bannières.
    const seal = (target: Batch, center: Point, radius: number, rotationY = 0, color = 0xffffff) => {
      const transform = (x: number, y: number): Point => [center[0] + x * Math.cos(rotationY), center[1] + y, center[2] - x * Math.sin(rotationY)];
      const circle: Point[] = [];
      for (let i = 0; i <= 32; i++) {
        const angle = i * Math.PI / 16;
        circle.push(transform(Math.sin(angle) * radius, Math.cos(angle) * radius));
      }
      line(target, circle, radius * 0.032, color);
      const star: Point[] = [];
      for (let i = 0; i <= 5; i++) {
        const angle = Math.PI + i * Math.PI * 4 / 5;
        star.push(transform(Math.sin(angle) * radius * 0.94, Math.cos(angle) * radius * 0.94));
      }
      line(target, star, radius * 0.036, color);
      line(target, [transform(0, -radius * 0.35), transform(0, -radius * 1.36)], radius * 0.02, color);
      for (const side of [-1, 1]) line(target, [transform(side * radius * 0.60, radius * 0.66), transform(side * radius * 1.12, radius * 1.12)], radius * 0.021, color);
    };

    // Masse pleine dans l'emprise tactique de 2,8 × 1,8 m ; joints et blocs de tailles décalées.
    box(stones, [2.8, 0.16, 1.8], [0, 0.08, 0], 0xb8ada1);
    box(dark, [2.62, 1.0, 1.62], [0, 0.66, 0], 0x605851);
    for (let row = 0; row < 3; row++) {
      const widths = row === 1 ? [0.38, 0.9, 0.9, 0.38] : [0.64, 0.64, 0.64, 0.64];
      let left = -1.31;
      for (let i = 0; i < widths.length; i++) {
        const width = widths[i];
        for (const side of [-1, 1]) box(stones, [width - 0.018, 0.304, 0.11],
          [left + width / 2, 0.33 + row * 0.321, side * 0.813], (row + i) % 3 === 0 ? 0xaaa09b : 0xd0c2af);
        left += width + 0.012;
      }
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) box(stones, [0.11, 0.304, 0.52],
        [side * 1.285, 0.33 + row * 0.321, (i - 1) * 0.536], i % 2 ? 0xaaa09b : 0xc3b6a4);
    }
    box(stones, [2.8, 0.14, 1.8], [0, 1.23, 0], 0xd4c4af);
    box(dark, [1.08, 0.94, 0.035], [0, 0.68, 0.881], 0x5e514f);
    seal(runes, [0, 0.72, 0.906], 0.38);
    seal(runes, [1.35, 0.72, 0], 0.30, Math.PI / 2, 0xb8493c);
    cylinder(stones, 0.53, 0.62, 0.15, [0, 1.375, 0], 0xb6a395);
    cylinder(dark, 0.48, 0.51, 0.055, [0, 1.478, 0], 0x5a3232);
    const ring = new THREE.TorusGeometry(0.46, 0.013, 4, 32);
    ring.rotateX(Math.PI / 2); ring.translate(0, 1.509, 0); runes.parts.push(tint(ring));

    // Coulures fixes en relief, terminées avant le sol ; petites flaques irrégulières sans collision.
    for (const [x, length, width] of [[-1.03, 0.72, 0.08], [-0.78, 0.43, 0.045], [0.68, 1.01, 0.10], [0.94, 0.62, 0.055], [0.27, 0.20, 0.04]]) {
      box(stains, [width * 1.8, 0.012, 0.45], [x, 1.306, 0.67], 0xc13a31);
      box(stains, [width, length, 0.013], [x, 1.30 - length / 2, 0.907], 0xb92925);
      cylinder(stains, width * 0.42, width * 0.2, width * 1.25, [x, 1.30 - length, 0.907], 0xb92925);
    }
    for (const [x, z, radius] of [[0.8, 1.0, 0.7], [-1.0, 0.94, 0.43], [0.3, -0.45, 0.65], [1.3, -0.6, 0.5]]) {
      const shape = new THREE.Shape();
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8, r = radius * (0.75 + Math.sin(i * 7.1) * 0.20);
        const px = Math.cos(angle) * r, py = Math.sin(angle) * r * 0.64;
        if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
      }
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI / 2); geometry.translate(x, 0.012, z);
      stains.parts.push(tint(geometry));
    }

    const candle = (x: number, base: number, z: number, height: number, radius = 0.058) => {
      cylinder(candles, radius * 0.93, radius, height, [x, base + height / 2, z]);
      cylinder(candles, radius * 1.15, radius, 0.035, [x, base + height - 0.025, z], 0xe0b879);
      for (let i = 0; i < 2; i++) {
        const angle = i * 2.5 + x * 8;
        cylinder(candles, 0.014, 0.011, height * 0.40, [x + Math.sin(angle) * radius * 0.9, base + height * 0.71, z + Math.cos(angle) * radius * 0.9]);
      }
      this.flamePositions.push(new THREE.Vector3(x, base + height + 0.065, z));
    };
    for (const side of [-1, 1]) {
      // Chandeliers sur la table, jamais dans les itinéraires autour de l'autel.
      cylinder(metal, 0.16, 0.20, 0.07, [side * 1.04, 1.335, -0.36]);
      cylinder(metal, 0.035, 0.07, 0.40, [side * 1.04, 1.55, -0.36]);
      line(metal, [[side * 1.04 - 0.22, 1.78, -0.36], [side * 1.04, 1.65, -0.36], [side * 1.04 + 0.22, 1.78, -0.36]], 0.025);
      for (const dx of [-0.22, 0, 0.22]) {
        const y = dx === 0 ? 1.86 : 1.78;
        cylinder(metal, 0.10, 0.065, 0.045, [side * 1.04 + dx, y, -0.36]);
        candle(side * 1.04 + dx, y + 0.0225, -0.36, dx === 0 ? 0.29 : 0.20, 0.047);
      }
      candle(side * 0.96, 1.30, 0.53, 0.33);
      candle(side * 1.16, 1.30, 0.59, 0.21, 0.064);
      candle(side * 1.21, 0.16, 0.68, 0.31, 0.065);
      candle(side * 1.01, 0.16, 0.69, 0.19);
    }

    // Deux bannières étroites entre les fenêtres et le portrait du mur ouest.
    for (const side of [-1, 1]) {
      const centerZ = side * 1.57;
      const shape = new THREE.Shape();
      shape.moveTo(-0.40, 1.30); shape.lineTo(0.40, 1.30); shape.lineTo(0.40, -0.84);
      shape.lineTo(0.20, -0.67); shape.lineTo(0.10, -1.25); shape.lineTo(-0.03, -0.94);
      shape.lineTo(-0.21, -1.38); shape.lineTo(-0.29, -0.90); shape.lineTo(-0.40, -1.02); shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.cos(positions.getX(i) * 22) * 0.035);
      geometry.computeVertexNormals(); geometry.rotateY(Math.PI / 2); geometry.translate(-5.27, 3.25, centerZ);
      banners.parts.push(tint(geometry, 0x66131d));
      line(metal, [[-5.20, 4.59, centerZ - 0.49], [-5.20, 4.59, centerZ + 0.49]], 0.033);
      seal(banners, [-5.18, 3.50, centerZ], 0.27, Math.PI / 2, 0xdcaa81);
    }

    for (const [index, item] of batches.entries()) this.addBatch(item, `altar-static-${index}`);

    // Cristaux facettés, fissures sur les vraies faces : pas d'anneau opaque autour du joueur.
    for (let index = 0; index < 2; index++) {
      const crystal = new THREE.Group();
      crystal.name = `altar-crystal-${index}`;
      crystal.position.y = index === 0 ? 2.15 : 3.29;
      const radius = index === 0 ? 0.68 : 0.39;
      const height = index === 0 ? 0.65 : 0.48;
      const shell = new THREE.OctahedronGeometry(1, 0);
      shell.scale(radius, height, radius);
      const positions = shell.getAttribute('position'), colors = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) new THREE.Color([0xa49b9d, 0x7a6876, 0x51424c, 0xb7a6a7][Math.floor(i / 3) % 4]).toArray(colors, i * 3);
      shell.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mesh = this.addMesh(shell, obsidian, `altar-crystal-solid-${index}`, crystal);
      this.solids.push(mesh);
      const cracks: Batch = { material: this.glow, solid: false, parts: [] };
      const pole = height + 0.008, edge = radius + 0.008;
      for (let side = 0; side < 4; side++) {
        const angle = side * Math.PI / 2;
        const x = Math.cos(angle) * edge, z = Math.sin(angle) * edge;
        line(cracks, [[0, -pole, 0], [x * 0.51, -pole * 0.49, z * 0.51], [x, 0, z], [x * 0.43, pole * 0.57, z * 0.43], [0, pole, 0]], 0.012);
        const next = angle + Math.PI / 2;
        line(cracks, [[x, 0, z], [Math.cos(next) * edge, 0, Math.sin(next) * edge]], 0.009, 0xa63c30);
        // Fractures ramifiées à l'intérieur des triangles, au-delà de la seule arête.
        const at = (a: number, b: number, y: number): Point => [
          (Math.cos(angle) * a + Math.cos(next) * b) * edge,
          y * pole,
          (Math.sin(angle) * a + Math.sin(next) * b) * edge,
        ];
        line(cracks, [at(0, 0, 1), at(0.22, 0.37, 0.41), at(0.44, 0.31, 0.25), at(0.58, 0.42, 0), at(0.20, 0.31, -0.49), at(0, 0, -1)], 0.012);
        line(cracks, [at(0.44, 0.31, 0.25), at(0.17, 0.67, 0.16), at(0.10, 0.90, 0)], 0.007, 0xb95e3a);
      }
      this.addBatch(cracks, `altar-crystal-cracks-${index}`, crystal);
      this.crystals.push(crystal); this.group.add(crystal);
    }

    // Volutes ajourées en deux rubans fins, doux et bornés, partagés avec l'aperçu via Level.update.
    const wispParts: THREE.BufferGeometry[] = [];
    for (let strand = 0; strand < 2; strand++) {
      const vertices: number[] = [];
      const point = (t: number, offset: number) => {
        const angle = t * Math.PI * 4.5 + strand * Math.PI;
        const radius = 0.48 + Math.sin(t * Math.PI) * 0.28;
        return [Math.cos(angle) * radius, 1.48 + t * 2.90 + offset, Math.sin(angle) * radius];
      };
      for (let i = 0; i < 80; i++) {
        const a = i / 80, b = (i + 1) / 80, wa = Math.sin(a * Math.PI) * 0.025, wb = Math.sin(b * Math.PI) * 0.025;
        vertices.push(...point(a, -wa), ...point(b, -wb), ...point(a, wa), ...point(b, -wb), ...point(b, wb), ...point(a, wa));
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      wispParts.push(geometry);
    }
    const wispGeometry = mergeGeometries(wispParts)!;
    wispParts.forEach(part => part.dispose());
    this.wisps = this.addMesh(wispGeometry, this.wispMaterial, 'altar-wisps');
    this.wisps.renderOrder = 1;
    const flameGeometry = new THREE.OctahedronGeometry(1, 0);
    this.geometries.push(flameGeometry);
    this.flames = new THREE.InstancedMesh(flameGeometry, this.flameMaterial, this.flamePositions.length);
    this.flames.name = 'altar-flames'; this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.flames.frustumCulled = false;
    this.group.add(this.flames);
    const emberGeometry = new THREE.OctahedronGeometry(0.016, 0);
    this.geometries.push(emberGeometry);
    this.embers = new THREE.InstancedMesh(emberGeometry, this.glow, 24);
    this.embers.name = 'altar-embers'; this.embers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.embers.frustumCulled = false;
    this.group.add(this.embers);
    scene.add(this.group);
    this.update(0);
  }

  private addMesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string, parent = this.group): THREE.Mesh {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private addBatch(batch: Batch, name: string, parent = this.group): void {
    const geometry = mergeGeometries(batch.parts);
    batch.parts.forEach(part => part.dispose());
    if (!geometry) throw new Error(`Fusion impossible : ${name}`);
    const mesh = this.addMesh(geometry, batch.material, name, parent);
    if (batch.solid) this.solids.push(mesh);
  }

  public getShotBlockers(): readonly THREE.Mesh[] { return this.solids; }

  public update(delta: number): void {
    if (this.disposed) return;
    this.time += Math.max(0, delta);
    const t = this.time;
    for (const [index, crystal] of this.crystals.entries()) {
      crystal.position.y = (index === 0 ? 2.15 : 3.29) + Math.sin(t * 0.9 + index * 1.6) * 0.04;
      crystal.rotation.y = t * (index === 0 ? 0.10 : -0.14) + Math.PI / 4;
    }
    this.glow.color.setHex(0xdb291d).multiplyScalar(0.90 + Math.sin(t * 1.8) * 0.10);
    this.wisps.rotation.y = t * 0.19;
    this.wispMaterial.opacity = 0.25 + Math.sin(t * 1.2) * 0.045;
    for (const [index, position] of this.flamePositions.entries()) {
      const flicker = 1 + Math.sin(t * 8 + index * 2.8) * 0.12 + Math.sin(t * 13 + index) * 0.06;
      this.scale.set(0.029, 0.081 * flicker, 0.029);
      this.matrix.compose(position, this.rotation, this.scale); this.flames.setMatrixAt(index, this.matrix);
    }
    this.flames.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < this.embers.count; index++) {
      const progress = (index / this.embers.count + t * 0.085) % 1;
      const angle = index * 2.4 + t * 0.40;
      const radius = 0.30 + Math.sin(index * 7.2) * 0.13 + progress * 0.48;
      this.position.set(Math.cos(angle) * radius, 1.45 + progress * 2.85, Math.sin(angle) * radius);
      this.scale.setScalar(Math.sin(progress * Math.PI) * (0.5 + (index % 3) * 0.3));
      this.matrix.compose(this.position, this.rotation, this.scale); this.embers.setMatrixAt(index, this.matrix);
    }
    this.embers.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.flames.dispose(); this.embers.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
