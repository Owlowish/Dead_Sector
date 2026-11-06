import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HearthFire } from './HearthFire.ts';
import { mansionBoxGeometry, mansionMaterial } from './MansionMaterials.ts';
import { setImpactSurface } from './ImpactSurface.ts';
import { isOpaqueSpriteHit, prepareSpriteHitMask } from './SpriteHitMask.ts';
import { visualColors } from './VisualStyle.ts';

interface FireplaceSpec {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

/** Habillage du volume tactique existant : façade vers +X, intérieur réellement creux. */
export class SalonFireplace {
  private readonly group = new THREE.Group();
  private readonly blockers: THREE.Mesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly reliefTexture: THREE.Texture;
  private readonly fire: HearthFire;
  private disposed = false;

  constructor(scene: THREE.Scene, spec: FireplaceSpec) {
    const floor = spec.y - spec.height / 2;
    this.group.name = 'salon-fireplace';
    this.group.position.set(spec.x + spec.width / 2, floor, spec.z);
    this.group.rotation.y = Math.PI / 2;
    this.group.scale.set(spec.depth / 4, spec.height / 3, spec.width / 2.4);
    this.group.updateMatrix();
    this.group.matrixAutoUpdate = false;

    const stone = mansionMaterial('stone').clone();
    stone.name = 'salon-fireplace-stone';
    stone.color.setHex(0xa69c8e);
    stone.vertexColors = true;
    stone.roughness = 0.96;
    const brick = mansionMaterial('brick').clone();
    brick.name = 'salon-fireplace-brick';
    brick.color.setHex(0x797064);
    brick.vertexColors = true;
    const iron = setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0x24201a, roughness: 0.83, metalness: 0.45, vertexColors: true,
    }), 'metal');
    const wood = setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0x302018, roughness: 1, vertexColors: true,
    }), 'wood');
    const ember = setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0x5d2710, emissive: visualColors.ember, emissiveIntensity: 1.15,
      roughness: 1, vertexColors: true,
    }), 'stone');
    this.materials.push(stone, brick, iron, wood, ember);

    const stoneParts: THREE.BufferGeometry[] = [];
    const brickParts: THREE.BufferGeometry[] = [];
    const ironParts: THREE.BufferGeometry[] = [];
    const logParts: THREE.BufferGeometry[] = [];
    const emberParts: THREE.BufferGeometry[] = [];
    const tint = (geometry: THREE.BufferGeometry, color = 0xffffff) => {
      const count = geometry.getAttribute('position').count;
      const rgb = new THREE.Color(color);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) rgb.toArray(colors, i * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geometry;
    };
    const box = (parts: THREE.BufferGeometry[], width: number, height: number, depth: number,
      x: number, y: number, z: number, color = 0xffffff) => {
      const geometry = mansionBoxGeometry(width, height, depth, 1.25);
      geometry.translate(x, y, z);
      parts.push(tint(geometry, color));
    };
    const cylinder = (parts: THREE.BufferGeometry[], radiusTop: number, radiusBottom: number,
      height: number, x: number, y: number, z: number, color = 0xffffff, horizontal = false, angle = 0) => {
      const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8);
      if (horizontal) geometry.rotateZ(Math.PI / 2);
      geometry.rotateY(angle);
      geometry.translate(x, y, z);
      parts.push(tint(geometry, color));
    };
    const extrude = (parts: THREE.BufferGeometry[], shape: THREE.Shape,
      depth: number, x: number, y: number, z: number, color = 0xffffff) => {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
      geometry.clearGroups();
      // La densité de la pierre reste comparable à celle des blocs adjacents.
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.25, uv.getY(i) / 1.25);
      geometry.translate(x, y, z);
      parts.push(tint(geometry, color));
    };

    // Socle, masse arrière et retours : pas de bloc plein devant le foyer.
    box(stoneParts, 4, 0.16, 2.4, 0, 0.08, -1.2, 0xc2b6a2);
    box(stoneParts, 4, 2.59, 0.32, 0, 1.455, -2.24, 0x9f9588);
    for (const side of [-1, 1]) {
      box(stoneParts, 0.64, 2.59, 2.08, side * 1.68, 1.455, -1.04, 0xbab1a3);
      box(stoneParts, 0.72, 0.28, 0.80, side * 1.64, 0.30, -0.40, 0xc6bba9);
      box(stoneParts, 0.59, 1.69, 0.14, side * 1.64, 1.285, -0.07, 0xc4baab);
      box(stoneParts, 0.69, 0.14, 0.30, side * 1.64, 2.20, -0.15, 0xd5c7b0);
      box(stoneParts, 0.72, 0.14, 0.36, side * 1.64, 2.34, -0.18, 0xb8aa96);
      // Cannelures verticales et pied chanfreiné des pilastres.
      for (const dx of [-0.16, 0, 0.16]) {
        box(stoneParts, 0.045, 1.15, 0.025, side * 1.64 + dx, 1.08, 0.006, 0x8b8174);
      }
      box(brickParts, 0.045, 1.97, 1.62, side * 1.337, 1.175, -1.25, 0x867461);
    }
    box(brickParts, 2.68, 2.18, 0.045, 0, 1.25, -2.055, 0xb8a18a);
    box(brickParts, 2.68, 0.09, 1.98, 0, 0.205, -1.12, 0x78614e);

    // Arche surbaissée à joints ouverts, avec une vraie sous-face en pierre.
    const spring = 1.69, innerRadius = 1.32, outerRadius = 1.58;
    for (let i = 0; i < 11; i++) {
      const a = i * Math.PI / 11 + 0.009;
      const b = (i + 1) * Math.PI / 11 - 0.009;
      const shape = new THREE.Shape();
      shape.moveTo(innerRadius * Math.cos(a), spring + 0.48 * Math.sin(a));
      for (let j = 1; j <= 3; j++) {
        const angle = a + (b - a) * j / 3;
        shape.lineTo(innerRadius * Math.cos(angle), spring + 0.48 * Math.sin(angle));
      }
      for (let j = 3; j >= 0; j--) {
        const angle = a + (b - a) * j / 3;
        shape.lineTo(outerRadius * Math.cos(angle), spring + 0.70 * Math.sin(angle));
      }
      shape.closePath();
      extrude(stoneParts, shape, 0.45, 0, 0, -0.45, i % 3 === 0 ? 0xc9bca6 : 0xb3a594);
    }
    const spandrel = new THREE.Shape();
    spandrel.moveTo(-outerRadius, 2.64);
    spandrel.lineTo(outerRadius, 2.64);
    for (let i = 0; i <= 22; i++) {
      const angle = i * Math.PI / 22;
      spandrel.lineTo(outerRadius * Math.cos(angle), spring + 0.70 * Math.sin(angle));
    }
    spandrel.closePath();
    extrude(stoneParts, spandrel, 0.30, 0, 0, -0.36, 0xaba092);

    // Frise et corniche étagées : sommet exactement conservé pour les accessoires.
    box(stoneParts, 3.87, 0.27, 0.46, 0, 2.605, -0.23, 0xa99c88);
    box(stoneParts, 3.94, 0.075, 0.52, 0, 2.768, -0.26, 0xd3c3a9);
    box(stoneParts, 4, 0.14, 2.4, 0, 2.875, -1.2, 0xc0b19a);
    box(stoneParts, 4, 0.06, 2.4, 0, 2.975, -1.2, 0xd0c2aa);
    // Denticules sous le débord du manteau.
    for (let i = -9; i <= 9; i++) box(stoneParts, 0.085, 0.085, 0.10, i * 0.195, 2.745, -0.03, 0xa79a87);

    // Grille noire, barreaux fins et fleurons ; ajours réels devant les flammes.
    for (const y of [0.34, 0.61]) box(ironParts, 2.53, 0.045, 0.055, 0, y, -0.17);
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 0.295;
      cylinder(ironParts, 0.019, 0.026, 0.65, x, 0.535, -0.17);
      cylinder(ironParts, 0.048, 0.060, 0.055, x, 0.235, -0.17, 0xb7a185);
      const fleur = new THREE.Shape();
      fleur.moveTo(0, 0.22);
      fleur.lineTo(0.047, 0.13);
      fleur.lineTo(0.025, 0.07);
      fleur.lineTo(0.095, 0.14);
      fleur.lineTo(0.10, 0.065);
      fleur.lineTo(0.025, 0.025);
      fleur.lineTo(0.025, 0);
      fleur.lineTo(-0.025, 0);
      fleur.lineTo(-0.025, 0.025);
      fleur.lineTo(-0.10, 0.065);
      fleur.lineTo(-0.095, 0.14);
      fleur.lineTo(-0.025, 0.07);
      fleur.lineTo(-0.047, 0.13);
      fleur.closePath();
      extrude(ironParts, fleur, 0.038, x, 0.845, -0.189, 0xb0a08a);
    }
    for (const side of [-1, 1]) {
      box(ironParts, 0.075, 0.07, 0.64, side * 1.18, 0.235, -0.43);
      cylinder(ironParts, 0.032, 0.05, 0.75, side * 1.28, 0.61, -0.20);
      const finial = new THREE.OctahedronGeometry(0.072, 0);
      finial.scale(0.8, 1.3, 0.8);
      finial.translate(side * 1.28, 1.025, -0.20);
      ironParts.push(tint(finial, 0xbda886));
    }

    // Bûches indépendantes, écorce charbonnée et braises inégales : pas de dalle rouge.
    for (const [length, radius, x, y, z, angle] of [
      [1.72, 0.13, -0.12, 0.39, -0.62, -0.12],
      [1.85, 0.12, 0.10, 0.37, -1.02, 0.13],
      [1.32, 0.11, -0.03, 0.54, -0.81, 0.30],
    ]) {
      cylinder(logParts, radius * 0.88, radius, length, x, y, z, 0xc1a68c, true, angle);
      for (const offset of [-0.28, 0.12, 0.38]) {
        const bark = mansionBoxGeometry(0.10, radius * 1.65, radius * 1.55);
        bark.translate(offset * length, 0, 0);
        bark.rotateY(angle);
        bark.translate(x, y, z);
        logParts.push(tint(bark, 0x6d5a4b));
      }
    }
    for (let i = 0; i < 25; i++) {
      const x = (i % 7 - 3) * 0.27 + Math.sin(i * 2.4) * 0.075;
      const z = -0.53 - Math.floor(i / 7) * 0.19;
      const coal = new THREE.DodecahedronGeometry(0.09 + (i % 3) * 0.012, 0);
      coal.scale(1.1, 0.48, 0.8);
      coal.rotateY(i * 1.7);
      coal.translate(x, 0.262 + (i % 2) * 0.012, z);
      emberParts.push(tint(coal, i % 4 === 0 ? 0xf6af54 : 0xb64e1c));
    }

    const merge = (name: string, parts: THREE.BufferGeometry[], material: THREE.Material) => {
      const normalized = parts.map(part => {
        const result = part.index ? part.toNonIndexed() : part;
        if (result !== part) part.dispose();
        result.clearGroups();
        return result;
      });
      const geometry = mergeGeometries(normalized);
      for (const part of normalized) part.dispose();
      if (!geometry) throw new Error(`Fusion de la cheminée impossible : ${name}`);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.geometries.push(geometry);
      this.blockers.push(mesh);
      return mesh;
    };
    merge('salon-fireplace-stone', stoneParts, stone);
    merge('salon-fireplace-brick', brickParts, brick);
    merge('salon-fireplace-iron', ironParts, iron);
    merge('salon-fireplace-logs', logParts, wood);
    merge('salon-fireplace-embers', emberParts, ember);

    // Reliefs éclairés comme la pierre ; les pixels transparents ne masquent pas le support.
    const reliefMeshes: THREE.Mesh[] = [];
    let reliefLoaded = false;
    this.reliefTexture = new THREE.TextureLoader().load('/assets/textures/mansion/hearth-reliefs-v1.png', texture => {
      if (this.disposed) return;
      prepareSpriteHitMask(texture);
      reliefLoaded = true;
      for (const mesh of reliefMeshes) mesh.visible = true;
    });
    this.reliefTexture.name = 'salon-fireplace-reliefs-atlas';
    this.reliefTexture.colorSpace = THREE.SRGBColorSpace;
    this.reliefTexture.magFilter = THREE.NearestFilter;
    this.reliefTexture.minFilter = THREE.NearestFilter;
    this.reliefTexture.generateMipmaps = false;
    const reliefMaterial = setImpactSurface(new THREE.MeshStandardMaterial({
      map: this.reliefTexture, alphaTest: 0.4, roughness: 0.92,
      color: 0xc1b4a1,
    }), 'stone');
    reliefMaterial.name = 'salon-fireplace-reliefs';
    const clockMaterial = setImpactSurface(reliefMaterial.clone(), 'metal');
    clockMaterial.name = 'salon-fireplace-clock';
    clockMaterial.color.setHex(0xc4af88);
    clockMaterial.metalness = 0.25;
    this.materials.push(reliefMaterial, clockMaterial);
    const relief = (width: number, height: number, x: number, y: number, z: number,
      left: number, top: number, cellWidth: number, cellHeight: number) => {
      const geometry = new THREE.PlaneGeometry(width, height);
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) {
        // Coordonnées du contrat source 1024 ; un pixel source vaut un demi-texel export 512.
        uv.setXY(i,
          (left + 1 + uv.getX(i) * (cellWidth - 2)) / 1024,
          1 - (top + 1 + (1 - uv.getY(i)) * (cellHeight - 2)) / 1024);
      }
      geometry.translate(x, y, z);
      return geometry;
    };
    reliefMeshes.push(merge('salon-fireplace-reliefs', [
      relief(2.12, 1.06, 0, 2.47, 0.016, 0, 0, 1024, 512),
      relief(0.58, 0.58, -1.64, 1.83, 0.026, 0, 512, 512, 512),
      relief(0.58, 0.58, 1.64, 1.83, 0.026, 0, 512, 512, 512),
    ], reliefMaterial));
    // Décalée des livres ; les 42 pixels transparents sous le socle ne le font pas flotter.
    const clockCenterY = 3.275 - 42 / 256 * 0.54;
    reliefMeshes.push(merge('salon-fireplace-clock', [relief(0.54, 0.54, 0.66, clockCenterY, -0.40, 512, 512, 512, 512)], clockMaterial));
    for (const mesh of reliefMeshes) {
      mesh.visible = reliefLoaded;
      mesh.raycast = (raycaster, intersections) => {
        if (!mesh.visible || this.disposed) return;
        const candidates: THREE.Intersection[] = [];
        THREE.Mesh.prototype.raycast.call(mesh, raycaster, candidates);
        for (const hit of candidates) {
          if (isOpaqueSpriteHit(mesh, hit.uv)) intersections.push(hit);
        }
      };
    }

    scene.add(this.group);
    const rootY = floor + 0.23 * spec.height / 3;
    const fireHeight = 1.90 * spec.height / 3;
    this.fire = new HearthFire(scene, new THREE.Vector3(
      spec.x + spec.width / 2 - 0.85 * spec.width / 2.4,
      rootY + (114.5 / 128 - 0.5) * fireHeight,
      spec.z,
    ), 2.35 * spec.depth / 4, fireHeight);
    this.group.updateMatrixWorld(true);
  }

  public getShotBlockers(): THREE.Mesh[] { return this.blockers; }

  public update(delta: number): void {
    if (!this.disposed) this.fire.update(delta);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.fire.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.reliefTexture.dispose();
  }
}
