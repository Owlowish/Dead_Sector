import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PIANO_ROOM_LAYOUT } from './MansionConfig.ts';
import { mansionMaterial } from './MansionMaterials.ts';
import { setImpactSurface } from './ImpactSurface.ts';

type Triplet = readonly [number, number, number];

interface DecorBatch {
  material: THREE.Material;
  solid: boolean;
  parts: THREE.BufferGeometry[];
}

/** Décor fixe du salon de musique ; les volumes de déplacement restent dans MansionConfig. */
export class PianoRoomDecor {
  private readonly group = new THREE.Group();
  private readonly solids: THREE.Mesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'piano-room-decor';
    const layout = PIANO_ROOM_LAYOUT;
    const identity = new THREE.Matrix4();
    const frame = (x: number, y: number, z: number, rotationY = 0) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY), new THREE.Vector3(1, 1, 1));
    const pianoFrame = frame(layout.piano.x, 0, layout.piano.z, layout.piano.rotationY);
    const consoleFrame = frame(layout.console.x, 0, layout.console.z);
    const chandelierFrame = frame(layout.chandelier.x, layout.chandelier.y, layout.chandelier.z);
    const own = <T extends THREE.Material>(material: T, name: string): T => {
      material.name = `piano-room-${name}`;
      this.materials.push(material);
      return material;
    };
    const ebony = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0x242026, roughness: 0.46, metalness: 0.08,
    }), 'wood'), 'ebony');
    const wood = own(mansionMaterial('wood').clone(), 'wood');
    wood.color.setHex(0xc8aa76);
    wood.roughness = 0.82;
    const gold = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0xad8b49, roughness: 0.48, metalness: 0.65,
    }), 'metal'), 'brass');
    const strings = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0xa6a196, roughness: 0.56, metalness: 0.72,
    }), 'metal'), 'strings');
    const ivory = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0xd8ccac, roughness: 0.78,
    }), 'wood'), 'ivory');
    const black = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0x111315, roughness: 0.58,
    }), 'wood'), 'black');
    const cloth = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0x661c29, roughness: 1,
    }), 'wood'), 'velvet');
    const colored = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.91, vertexColors: true,
    }), 'wood'), 'accessories');
    const ceramic = own(setImpactSurface(new THREE.MeshStandardMaterial({
      color: 0xc1bda9, roughness: 0.52,
    }), 'stone'), 'porcelain');
    const flame = own(new THREE.MeshStandardMaterial({
      color: 0xffce7a, emissive: 0xffa133, emissiveIntensity: 1.55, roughness: 1,
    }), 'candle-flames');
    const carpet = mansionMaterial('carpet', 2, 2);
    const batches = new Map<string, DecorBatch>();

    const add = (material: THREE.Material, source: THREE.BufferGeometry, transform: THREE.Matrix4,
      solid = true, color = 0xffffff) => {
      let geometry = source;
      if (geometry.index) {
        geometry = source.toNonIndexed();
        source.dispose();
      }
      geometry.clearGroups();
      geometry.applyMatrix4(transform);
      const rgb = new THREE.Color(color);
      const colors = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) rgb.toArray(colors, i);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const key = `${material.name}${solid ? '' : '-decoration'}`;
      let batch = batches.get(key);
      if (!batch) {
        batch = { material, solid, parts: [] };
        batches.set(key, batch);
      }
      batch.parts.push(geometry);
    };
    const transform = (base: THREE.Matrix4, position: Triplet, rotation: Triplet = [0, 0, 0]) =>
      base.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
    const box = (material: THREE.Material, size: Triplet, position: Triplet,
      base = pianoFrame, rotation: Triplet = [0, 0, 0], solid = true, color = 0xffffff) =>
      add(material, new THREE.BoxGeometry(...size), transform(base, position, rotation), solid, color);
    const cylinder = (material: THREE.Material, top: number, bottom: number, height: number,
      position: Triplet, base = pianoFrame, rotation: Triplet = [0, 0, 0], solid = true, color = 0xffffff) =>
      add(material, new THREE.CylinderGeometry(top, bottom, height, 10), transform(base, position, rotation), solid, color);
    const rod = (material: THREE.Material, from: Triplet, to: Triplet, radius: number,
      base = pianoFrame, color = 0xffffff) => {
      const start = new THREE.Vector3(...from);
      const end = new THREE.Vector3(...to);
      const direction = end.clone().sub(start);
      const matrix = new THREE.Matrix4().compose(start.add(end).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
        new THREE.Vector3(1, 1, 1));
      add(material, new THREE.CylinderGeometry(radius, radius, direction.length(), 6), base.clone().multiply(matrix), true, color);
    };
    const lathe = (material: THREE.Material, points: readonly (readonly [number, number])[],
      position: Triplet, base = pianoFrame) =>
      add(material, new THREE.LatheGeometry(points.map(point => new THREE.Vector2(...point)), 10), transform(base, position));
    const torus = (material: THREE.Material, radius: number, tube: number, position: Triplet,
      base = pianoFrame, rotation: Triplet = [Math.PI / 2, 0, 0]) =>
      add(material, new THREE.TorusGeometry(radius, tube, 5, 16), transform(base, position, rotation));

    // Le contour dissymétrique, creux en haut, reste lisible depuis tous les accès.
    const outline = (sx = 1, sz = 1) => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.85 * sx, -1.02 * sz);
      shape.lineTo(0.85 * sx, -1.02 * sz);
      shape.lineTo(0.85 * sx, -0.52 * sz);
      shape.bezierCurveTo(0.83 * sx, -0.02 * sz, 0.35 * sx, 0.12 * sz, 0.32 * sx, 0.60 * sz);
      shape.bezierCurveTo(0.29 * sx, 1.03 * sz, 0.03 * sx, 1.40 * sz, -0.32 * sx, 1.40 * sz);
      shape.bezierCurveTo(-0.70 * sx, 1.40 * sz, -0.85 * sx, 1.04 * sz, -0.85 * sx, 0.64 * sz);
      shape.closePath();
      return shape;
    };
    const slab = (material: THREE.Material, shape: THREE.Shape, height: number, y: number,
      base = pianoFrame) => {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, y, 0);
      add(material, geometry, base);
    };
    const ring = (material: THREE.Material, height: number, y: number, inset: number) => {
      const shape = outline();
      shape.holes.push(new THREE.Path(outline(1 - inset, 1 - inset).getPoints(10)));
      slab(material, shape, height, y);
    };
    slab(ebony, outline(), 0.10, 0.97);
    slab(wood, outline(0.91, 0.93), 0.035, 1.075);
    ring(ebony, 0.235, 1.07, 0.065);
    ring(gold, 0.012, 1.302, 0.026);
    ring(gold, 0.014, 0.985, 0.022);

    // Cordes en éventail et traverse de la table d'harmonie, visibles sous le couvercle.
    for (let i = 0; i < 27; i++) {
      rod(strings, [-0.70 + i * 0.05, 1.135, 0.79], [-0.59 + i * 0.024, 1.135, -1.09 + i * 0.046], 0.0032);
    }
    rod(gold, [-0.70, 1.145, -0.68], [0.37, 1.145, 0.53], 0.022);
    for (let i = 0; i < 5; i++) cylinder(gold, 0.025, 0.025, 0.02, [-0.64 + i * 0.31, 1.15, 0.80]);

    // Couvercle fin articulé côté basses : pas de boîte opaque au-dessus du piano.
    const lidFrame = pianoFrame.clone().multiply(new THREE.Matrix4().makeTranslation(-0.85, 1.34, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(0.50)).multiply(new THREE.Matrix4().makeTranslation(0.85, 0, 0));
    slab(ebony, outline(), 0.045, 0, lidFrame);
    const lidInset = outline(0.94, 0.96);
    lidInset.holes.push(new THREE.Path(outline(0.91, 0.93).getPoints(10)));
    slab(gold, lidInset, 0.005, -0.006, lidFrame);
    rod(ebony, [0.58, 1.29, 0.40], [0.52, 2.085, 0.40], 0.021);
    for (const z of [-0.78, 0.15, 0.76]) cylinder(gold, 0.025, 0.025, 0.12, [-0.85, 1.34, z], pianoFrame, [Math.PI / 2, 0, 0]);

    // Clavier de quatre octaves : les touches noires sont des volumes séparés.
    const keyWidth = 1.48 / 28;
    for (let i = 0; i < 28; i++) {
      const x = -0.74 + keyWidth * (i + 0.5);
      box(ivory, [keyWidth - 0.0025, 0.055, 0.35], [x, 1.055, 1.22]);
      if ([0, 1, 3, 4, 5].includes(i % 7) && i < 27) {
        box(black, [keyWidth * 0.57, 0.062, 0.21], [x + keyWidth / 2, 1.107, 1.15]);
      }
    }
    box(ebony, [1.72, 0.105, 0.05], [0, 1.015, 1.41]);
    box(gold, [1.63, 0.012, 0.016], [0, 1.075, 1.44]);
    for (const x of [-0.805, 0.805]) box(ebony, [0.13, 0.15, 0.44], [x, 1.105, 1.19]);
    box(ebony, [1.52, 0.16, 0.065], [0, 1.205, 0.995]);
    cylinder(gold, 0.055, 0.055, 0.012, [0, 1.222, 1.033], pianoFrame, [Math.PI / 2, 0, 0]);

    // Pieds tournés, roulettes et lyre de pédales.
    const legProfile: readonly (readonly [number, number])[] = [
      [0.065, 0.12], [0.10, 0.17], [0.075, 0.23], [0.055, 0.35], [0.09, 0.40],
      [0.052, 0.48], [0.073, 0.69], [0.12, 0.86], [0.115, 0.97],
    ];
    for (const [x, z] of [[-0.69, 0.77], [0.69, 0.77], [-0.43, -1.06]]) {
      lathe(ebony, legProfile, [x, 0, z]);
      for (const y of [0.19, 0.40, 0.85]) cylinder(gold, 0.093, 0.093, 0.027, [x, y, z]);
      cylinder(gold, 0.060, 0.060, 0.075, [x, 0.07, z], pianoFrame, [0, 0, Math.PI / 2]);
      box(ebony, [0.04, 0.13, 0.06], [x, 0.13, z]);
    }
    for (const x of [-0.15, 0.15]) rod(ebony, [x, 0.97, 0.75], [x * 0.78, 0.22, 1.02], 0.03);
    box(ebony, [0.43, 0.07, 0.16], [0, 0.20, 1.025]);
    for (const x of [-0.11, 0, 0.11]) box(gold, [0.068, 0.035, 0.27], [x, 0.17, 1.14], pianoFrame, [-0.08, 0, 0]);

    // Partition ouverte ; portées et notes sont de petites formes, sans texture supplémentaire.
    box(ebony, [0.88, 0.49, 0.035], [0, 1.57, 1.09], pianoFrame, [-0.20, 0, 0]);
    box(gold, [0.92, 0.027, 0.075], [0, 1.34, 1.15]);
    for (const side of [-1, 1]) {
      const pageFrame = transform(pianoFrame, [side * 0.19, 1.58, 1.123], [-0.20, side * -0.065, 0]);
      box(ivory, [0.365, 0.42, 0.012], [0, 0, 0], pageFrame);
      for (let staff = 0; staff < 3; staff++) {
        const lineY = 0.125 - staff * 0.12;
        for (let line = 0; line < 5; line++) box(black, [0.295, 0.0028, 0.0015], [0, lineY - line * 0.012, 0.0075], pageFrame);
        for (let note = 0; note < 5; note++) {
          const x = -0.115 + note * 0.052;
          const y = lineY - ((note * 3 + staff + side + 1) % 5) * 0.012;
          cylinder(black, 0.008, 0.008, 0.002, [x, y, 0.009], pageFrame, [Math.PI / 2, 0, -0.2]);
          box(black, [0.0025, 0.035, 0.002], [x + 0.006, y + 0.017, 0.009], pageFrame);
        }
      }
    }

    // Banquette basse : capitons, passepoil et petits pieds tournés.
    const benchZ = layout.bench.localZ;
    box(ebony, [layout.bench.width, 0.11, layout.bench.depth], [0, 0.47, benchZ]);
    box(cloth, [layout.bench.width - 0.035, 0.14, layout.bench.depth - 0.025], [0, 0.585, benchZ]);
    for (const x of [-1, 1]) {
      box(gold, [0.013, 0.016, layout.bench.depth - 0.02], [x * (layout.bench.width / 2 - 0.015), 0.54, benchZ]);
      for (const z of [-1, 1]) {
        const position: Triplet = [x * (layout.bench.width / 2 - 0.10), 0, benchZ + z * (layout.bench.depth / 2 - 0.075)];
        lathe(ebony, [[0.034, 0.035], [0.055, 0.075], [0.030, 0.23], [0.06, 0.35], [0.045, 0.43]], position);
        cylinder(gold, 0.038, 0.045, 0.045, [position[0], 0.04, position[2]]);
      }
    }
    for (const z of [-0.12, 0.12]) for (const x of [-0.40, 0, 0.40]) {
      cylinder(gold, 0.013, 0.013, 0.006, [x, 0.658, benchZ + z]);
      box(ebony, [0.115, 0.0025, 0.004], [x, 0.656, benchZ + z], pianoFrame, [0, 0.35, 0]);
    }

    // Tapis indépendant des masques de tir et des collisions.
    const rug = layout.carpet;
    add(carpet, new THREE.PlaneGeometry(rug.width, rug.depth),
      transform(identity, [rug.x, 0.015, rug.z], [-Math.PI / 2, 0, 0]), false);
    for (const side of [-1, 1]) {
      box(gold, [0.035, 0.002, rug.depth - 0.12], [rug.x + side * (rug.width / 2 - 0.08), 0.019, rug.z], identity, [0, 0, 0], false);
      box(gold, [rug.width - 0.12, 0.002, 0.035], [rug.x, 0.019, rug.z + side * (rug.depth / 2 - 0.08)], identity, [0, 0, 0], false);
      for (let i = 0; i < 28; i++) {
        box(ivory, [0.012, 0.002, 0.085], [rug.x - rug.width / 2 + 0.13 + i * (rug.width - 0.26) / 27,
          0.012, rug.z + side * (rug.depth / 2 + 0.035)], identity, [0, 0, 0], false);
      }
    }

    // Console adossée au mur : un groupe secondaire, jamais au milieu de la circulation.
    const consoleWidth = layout.console.width;
    const consoleDepth = layout.console.depth;
    box(wood, [consoleWidth, 0.10, consoleDepth], [0, 0.97, 0], consoleFrame);
    box(gold, [consoleWidth + 0.035, 0.021, consoleDepth + 0.025], [0, 0.918, 0], consoleFrame);
    box(ebony, [consoleWidth - 0.12, 0.18, consoleDepth - 0.10], [0, 0.815, 0], consoleFrame);
    for (const side of [-1, 1]) {
      box(wood, [consoleWidth / 2 - 0.13, 0.12, 0.022], [side * consoleWidth / 4, 0.825, -consoleDepth / 2 + 0.037], consoleFrame);
      torus(gold, 0.040, 0.008, [side * consoleWidth / 4, 0.81, -consoleDepth / 2 + 0.014], consoleFrame, [0, 0, 0]);
      for (const z of [-1, 1]) {
        lathe(ebony, [[0.055, 0.03], [0.075, 0.08], [0.045, 0.25], [0.07, 0.52], [0.10, 0.74]],
          [side * (consoleWidth / 2 - 0.19), 0, z * (consoleDepth / 2 - 0.10)], consoleFrame);
      }
    }
    box(cloth, [0.52, 0.012, consoleDepth + 0.03], [0.18, 1.027, 0], consoleFrame);
    box(cloth, [0.52, 0.36, 0.018], [0.18, 0.85, -consoleDepth / 2 - 0.02], consoleFrame);
    box(gold, [0.53, 0.023, 0.025], [0.18, 0.665, -consoleDepth / 2 - 0.025], consoleFrame);

    // Livres fermés et vase de roses, en géométrie colorée peu dense.
    for (let i = 0; i < 3; i++) {
      const bookFrame = consoleFrame.clone().multiply(frame(0.88 - i * 0.035, 1.03 + i * 0.11, 0.04, (i - 1) * 0.10));
      box(ivory, [0.49 - i * 0.025, 0.07, 0.35], [0, 0.05, 0], bookFrame);
      for (const y of [0.01, 0.093]) box(colored, [0.53 - i * 0.025, 0.014, 0.38], [0, y, 0], bookFrame, [0, 0, 0], true, [0x502329, 0x3b4535, 0x5a422d][i]);
    }
    const vaseFrame = consoleFrame.clone().multiply(frame(-0.70, 1.03, 0.01));
    lathe(ceramic, [[0.10, 0], [0.12, 0.045], [0.085, 0.08], [0.19, 0.22], [0.185, 0.31],
      [0.11, 0.40], [0.10, 0.48], [0.14, 0.50]], [0, 0, 0], vaseFrame);
    for (const y of [0.05, 0.44, 0.49]) torus(gold, y < 0.1 ? 0.11 : 0.113, 0.009, [0, y, 0], vaseFrame);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      const radius = i === 0 ? 0 : 0.17;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 0.76 + (i % 3) * 0.07;
      rod(colored, [0, 0.43, 0], [x, y, z], 0.009, vaseFrame, 0x394832);
      const leaf = new THREE.OctahedronGeometry(0.08, 0);
      leaf.scale(1, 0.28, 0.55);
      add(colored, leaf, transform(vaseFrame, [x * 0.65 + 0.04, 0.61, z * 0.65], [0.1, angle, 0.3]), true, 0x46513a);
      for (let petal = 0; petal < 5; petal++) {
        const petalAngle = petal * Math.PI * 2 / 5;
        const geometry = new THREE.SphereGeometry(0.067, 5, 4);
        geometry.scale(1, 0.78, 0.85);
        add(colored, geometry, transform(vaseFrame,
          [x + Math.cos(petalAngle) * 0.035, y + (petal % 2) * 0.014, z + Math.sin(petalAngle) * 0.035]), true,
          [0x741e2d, 0x8a2738, 0x5b1827][(petal + i) % 3]);
      }
    }

    for (const x of [-1.15, 0.46]) {
      const candleFrame = consoleFrame.clone().multiply(frame(x, 1.03, -0.16));
      lathe(gold, [[0.085, 0], [0.095, 0.025], [0.055, 0.055], [0.025, 0.11],
        [0.025, 0.20], [0.055, 0.23], [0.075, 0.255]], [0, 0, 0], candleFrame);
      cylinder(ivory, 0.026, 0.030, 0.19, [0, 0.35, 0], candleFrame);
      add(flame, new THREE.ConeGeometry(0.022, 0.08, 5), transform(candleFrame, [0, 0.485, 0]), false);
    }

    // Lustre à six branches : toute sa partie basse reste au-dessus de 2,6 m.
    lathe(gold, [[0.025, -0.28], [0.07, -0.20], [0.04, -0.14], [0.14, -0.08],
      [0.16, 0.02], [0.09, 0.14], [0.055, 0.32], [0.08, 0.37]], [0, 0, 0], chandelierFrame);
    rod(gold, [0, 0.32, 0], [0, 0.94, 0], 0.016, chandelierFrame);
    cylinder(gold, 0.14, 0.08, 0.045, [0, 0.955, 0], chandelierFrame);
    torus(gold, 0.40, 0.013, [0, -0.015, 0], chandelierFrame);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x * 0.10, 0.06, z * 0.10),
        new THREE.Vector3(x * 0.36, -0.07, z * 0.36),
        new THREE.Vector3(x * 0.62, -0.015, z * 0.62),
        new THREE.Vector3(x * 0.70, 0.17, z * 0.70),
      ]);
      add(gold, new THREE.TubeGeometry(curve, 9, 0.022, 5, false), chandelierFrame);
      cylinder(gold, 0.105, 0.065, 0.038, [x * 0.70, 0.17, z * 0.70], chandelierFrame);
      cylinder(ivory, 0.032, 0.036, 0.19, [x * 0.70, 0.285, z * 0.70], chandelierFrame);
      add(flame, new THREE.ConeGeometry(0.026, 0.095, 5),
        transform(chandelierFrame, [x * 0.70, 0.427, z * 0.70]), false);
    }

    for (const [name, batch] of batches) {
      const geometry = mergeGeometries(batch.parts, false);
      for (const part of batch.parts) part.dispose();
      if (!geometry) throw new Error(`Fusion impossible du décor piano : ${name}`);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.name = name;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      if (batch.solid) this.solids.push(mesh);
    }
    scene.add(this.group);
  }

  public getSolidMeshes(): readonly THREE.Mesh[] {
    return this.solids;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    // Le clone de matériau bois garde sa texture commune ; seul le clone nous appartient.
    for (const material of this.materials) material.dispose();
  }
}
