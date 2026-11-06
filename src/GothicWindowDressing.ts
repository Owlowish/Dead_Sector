import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StormWindowSpec } from './MansionConfig.ts';
import { mansionMaterial } from './MansionMaterials.ts';

type Point = readonly [number, number, number];

/** Habillage normalisé de la baie : les surfaces tournées vers la pièce sont à Z négatif. */
export function createGothicWindowDressing(spec: StormWindowSpec, index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'gothic-window-dressing';
  const stone = mansionMaterial('stone').clone();
  stone.name = 'gothic-window-stone';
  stone.color.setHex(0xc8b9b0);
  stone.vertexColors = true;
  stone.roughness = 0.96;
  const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  cloth.name = 'gothic-window-velvet';
  const brass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.36 });
  brass.name = 'gothic-window-brass';
  const wax = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 });
  wax.name = 'gothic-window-wax';
  const flame = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  flame.name = 'gothic-window-flame';
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(
    [stone, cloth, brass, wax, flame].map(material => [material, []]),
  );

  const add = (material: THREE.Material, source: THREE.BufferGeometry, color: number,
    position: Point = [0, 0, 0], rotation: Point = [0, 0, 0]) => {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    geometry.clearGroups();
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
    const points = geometry.getAttribute('position');
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(points.count * 2), 2));
    if (material === stone) {
      const uv = geometry.getAttribute('uv');
      const normals = geometry.getAttribute('normal');
      for (let i = 0; i < points.count; i++) {
        const front = Math.abs(normals.getZ(i)) > 0.5;
        uv.setXY(i, front ? points.getX(i) * spec.width / 4 : points.getZ(i) / 2,
          points.getY(i) * spec.height / 4);
      }
    }
    const colors = new Float32Array(points.count * 3);
    const tint = new THREE.Color(color);
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    batches.get(material)!.push(geometry);
  };
  const box = (material: THREE.Material, size: Point, position: Point, color: number) =>
    add(material, new THREE.BoxGeometry(...size), color, position);
  const cylinder = (material: THREE.Material, radiusTop: number, radiusBottom: number, height: number,
    position: Point, color: number, rotation: Point = [0, 0, 0]) =>
    add(material, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 7), color, position, rotation);

  // Joints ouverts entre les voussoirs et arêtes biseautées, sans texture supplémentaire.
  const shades = [0xf0e1d5, 0xc8c2be, 0xe4d1c4, 0xd0c1bc];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const low = -1.03 + i * 1.42 / 7;
      box(stone, [0.15, 1.42 / 7 - 0.011, 0.17], [side * 1.065, low + 1.42 / 14, -0.087], shades[(i + index) % shades.length]!);
      box(stone, [0.026, 1.42 / 7 - 0.018, 0.035], [side * 0.994, low + 1.42 / 14, -0.19], 0xe4d8ca);
    }
    const curve = new THREE.QuadraticBezierCurve(new THREE.Vector2(side, 0.38),
      new THREE.Vector2(side * 0.92, 0.73), new THREE.Vector2(0, 1));
    const outer = (t: number): THREE.Vector2 => {
      const point = curve.getPoint(t), tangent = curve.getTangent(t);
      const normal = new THREE.Vector2(side * Math.abs(tangent.y), Math.abs(tangent.x)).normalize();
      point.addScaledVector(normal, 0.135);
      // La grande baie du salon atteint déjà presque le plafond de quatre mètres.
      point.y = Math.min(point.y, spec.drapery === 'music' ? 1.045 : 1.10);
      return point;
    };
    for (let i = 0; i < 8; i++) {
      const start = i / 8 + 0.005, end = (i + 1) / 8 - 0.005;
      const a = curve.getPoint(start), b = curve.getPoint(end), c = outer(end), d = outer(start);
      const shape = new THREE.Shape([a, b, c, d]);
      const block = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: true,
        bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 1, steps: 1 });
      add(stone, block, shades[(i + index + 1) % shades.length]!, [0, 0, -0.16]);
    }
    box(stone, [0.11, 0.14, 0.20], [side * 0.97, -1.19, -0.065], 0xbcb0a9);
    box(stone, [0.19, 0.045, 0.24], [side * 0.97, -1.105, -0.09], 0xd3c5bb);
  }
  box(stone, [2.35, 0.095, 0.32], [0, -1.06, -0.08], 0xe5d5c5);
  box(stone, [2.20, 0.035, 0.24], [0, -1.12, -0.045], 0xc5b6ad);

  const curtainGroup = new THREE.Group();
  curtainGroup.name = spec.drapery === 'music' ? 'music-room-curtains' : 'gothic-window-curtains';
  group.add(curtainGroup);
  // Les déchirures sont géométriques : le verre reste visible entre les pans de tissu.
  const clothParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const rows = 10, columns = 12;
    const positions: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
    const base = new THREE.Color(spec.drapery === 'music' ? 0x722332 : 0x5c1b2b);
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const rag = row > 2 ? Math.sin(row * 2.2 + index * 0.7 + side) * 0.035 : 0;
      const notch = row === (side < 0 ? 4 : 5) ? 0.09 : row === 7 ? 0.15 : row === 9 ? 0.13 : 0;
      const inside = 0.83 + Math.sin(t * Math.PI) * 0.20 + rag + notch;
      for (let col = 0; col <= columns; col++) {
        const u = col / columns, fold = Math.cos(u * Math.PI * 10 + index * 0.35);
        const hem = row === rows ? (col % 3 === 0 ? 0.11 : col % 3 === 1 ? 0.035 : 0) : 0;
        positions.push(side * (inside + (1.29 - inside) * u), 1.0 - 2.14 * t + hem, -0.23 - fold * 0.034);
        uv.push(u, t);
        const shade = 0.59 + 0.41 * (fold + 1) / 2;
        base.clone().multiplyScalar(shade).toArray(colors, colors.length);
      }
    }
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col, b = a + columns + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    clothParts.push(geometry.toNonIndexed()); geometry.dispose();
    const tie = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.02, -0.10, -0.29), new THREE.Vector3(side * 1.15, -0.16, -0.32),
      new THREE.Vector3(side * 1.29, -0.08, -0.28),
    ]);
    add(brass, new THREE.TubeGeometry(tie, 6, 0.011, 4, false), 0xb39051);
    cylinder(brass, 0.012, 0.029, 0.13, [side * 1.13, -0.235, -0.32], 0x9b773e);
    for (const x of [0.89, 1.04, 1.19]) {
      add(brass, new THREE.TorusGeometry(0.022, 0.006, 4, 7), 0xa78b53,
        [side * x, 1.009, -0.24]);
    }
  }
  const curtainGeometry = mergeGeometries(clothParts);
  for (const part of clothParts) part.dispose();
  if (!curtainGeometry) throw new Error('Fusion des pans de rideaux gothiques impossible');
  const curtainMesh = new THREE.Mesh(curtainGeometry, cloth);
  curtainMesh.name = 'gothic-window-velvet'; curtainMesh.receiveShadow = true;
  curtainGroup.add(curtainMesh);
  for (const side of [-1, 1]) {
    cylinder(brass, 0.019, 0.019, 0.65, [side * 1.12, 1.03, -0.23], 0x95713a, [0, 0, Math.PI / 2]);
    const finial = new THREE.IcosahedronGeometry(0.037, 0);
    finial.scale(1, 0.50, 1);
    add(brass, finial, 0xb49353, [side * 1.42, 1.03, -0.23]);
    const innerFinial = new THREE.IcosahedronGeometry(0.025, 0);
    innerFinial.scale(1, 0.50, 1);
    add(brass, innerFinial, 0xae8d4e, [side * 0.795, 1.03, -0.23]);
  }

  for (const [candle, x] of [-0.81, -0.65, 0.85].entries()) {
    const height = [0.30, 0.17, 0.20][candle]!;
    const radius = candle === 0 ? 0.035 : 0.027;
    const bottom = -1.01;
    cylinder(wax, radius * 0.94, radius, height, [x, bottom + height / 2, -0.22], 0xd5b676);
    cylinder(wax, radius * 1.3, radius * 1.5, 0.01, [x, bottom - 0.003, -0.22], 0xc9a970);
    for (let drip = 0; drip < 3; drip++) {
      const angle = drip * 2.3 + index;
      const drop = new THREE.SphereGeometry(radius * 0.25, 5, 4);
      drop.scale(1, 2.0 + drip * 0.4, 1);
      add(wax, drop, 0xe0c88a, [x + Math.sin(angle) * radius, bottom + height - 0.024 - drip * 0.025,
        -0.22 - Math.cos(angle) * radius]);
    }
    cylinder(brass, 0.003, 0.003, 0.025, [x, bottom + height + 0.008, -0.22], 0x211b1a);
    const fire = new THREE.IcosahedronGeometry(0.028, 0);
    fire.scale(0.65, 1.6, 0.60);
    add(flame, fire, 0xe8a443, [x, bottom + height + 0.052, -0.22]);
    const core = new THREE.IcosahedronGeometry(0.014, 0);
    core.scale(0.7, 1.7, 0.55);
    add(flame, core, 0xffdf90, [x, bottom + height + 0.038, -0.24]);
  }

  // Cinq matières propres ; leurs textures de pierre restent empruntées au cache du manoir.
  for (const [material, parts] of batches) {
    if (parts.length === 0) continue;
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) throw new Error(`Fusion de ${material.name} impossible`);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = material.name;
    mesh.receiveShadow = material !== flame;
    group.add(mesh);
  }
  return group;
}
