import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MANSION_ROOMS, MANSION_WALLS, type RoomSpec } from './MansionConfig.ts';
import { visualColors } from './VisualStyle.ts';

export interface FurnishingPart {
  roomId: string;
  feature: string;
  supportIndex: number;
  shape: 'box' | 'cylinder' | 'octahedron';
  center: readonly [number, number, number];
  size: readonly [number, number, number];
  color: number;
  rotationY?: number;
}

export const furnishingBudget = { maxMeshes: 6, maxTriangles: 5000, newTextures: 0, newLights: 0 } as const;

const roomColors: Record<string, readonly [number, number]> = {
  vestibule: [visualColors.wood, visualColors.ivory],
  salon: [0x493025, visualColors.carpetGold],
  galerie: [visualColors.stone, 0x938778],
  grand_hall: [visualColors.stone, visualColors.brass],
  bibliotheque: [0x493025, 0x8e744a],
  atelier: [visualColors.wood, visualColors.olive],
};

function buildParts(): FurnishingPart[] {
  const result: FurnishingPart[] = [];
  const add = (roomId: string, feature: string, supportIndex: number, shape: FurnishingPart['shape'],
    center: FurnishingPart['center'], size: FurnishingPart['size'], color: number, rotationY = 0) => {
    result.push({ roomId, feature, supportIndex, shape, center, size, color, rotationY });
  };
  const box = (roomId: string, feature: string, supportIndex: number,
    center: FurnishingPart['center'], size: FurnishingPart['size'], color: number, rotationY = 0) =>
    add(roomId, feature, supportIndex, 'box', center, size, color, rotationY);

  // Les corniches suivent les segments réels, et s'arrêtent donc aux portes et aux escaliers.
  for (const room of MANSION_ROOMS) {
    const floor = room.id === 'bibliotheque' || room.id === 'atelier' ? 2.4 : 0;
    const ceiling = room.bounds.minZ > 6 ? 4 : 6.4;
    const [body, accent] = roomColors[room.id];
    const sides = [
      { axis: 'x', along: 'z', plane: room.bounds.minX, inward: 1, low: room.bounds.minZ, high: room.bounds.maxZ },
      { axis: 'x', along: 'z', plane: room.bounds.maxX, inward: -1, low: room.bounds.minZ, high: room.bounds.maxZ },
      { axis: 'z', along: 'x', plane: room.bounds.minZ, inward: 1, low: room.bounds.minX, high: room.bounds.maxX },
      { axis: 'z', along: 'x', plane: room.bounds.maxZ, inward: -1, low: room.bounds.minX, high: room.bounds.maxX },
    ] as const;
    for (const side of sides) {
      MANSION_WALLS.forEach((wall, supportIndex) => {
        if (wall.materialType !== 'wall') return;
        const thickness = side.axis === 'x' ? wall.width : wall.depth;
        const face = wall[side.axis] + side.inward * thickness / 2;
        if (Math.abs(face - side.plane) > 1e-5) return;
        const length = side.along === 'x' ? wall.width : wall.depth;
        const low = Math.max(side.low, wall[side.along] - length / 2) + 0.12;
        const high = Math.min(side.high, wall[side.along] + length / 2) - 0.12;
        const top = Math.min(ceiling, wall.y + wall.height / 2);
        if (high - low < 0.5 || top - 0.2 < floor + 2.5) return;
        const along = (low + high) / 2;
        const center = (inset: number, y: number): FurnishingPart['center'] => side.axis === 'x'
          ? [side.plane + side.inward * inset, y, along]
          : [along, y, side.plane + side.inward * inset];
        const size = (depth: number, height: number): FurnishingPart['size'] => side.axis === 'x'
          ? [depth, height, high - low] : [high - low, height, depth];
        box(room.id, 'cornice-body', supportIndex, center(0.075, top - 0.075), size(0.15, 0.12), body);
        box(room.id, 'cornice-accent', supportIndex, center(0.055, top - 0.16), size(0.11, 0.04), accent);
      });
    }
  }

  const outerEast = MANSION_WALLS.findIndex(wall => wall.x === 24 && wall.materialType === 'wall');
  // Ces consoles hautes apportent du relief sans empiéter sur les cadres ni sur le passage au sol.
  for (const z of [11.8, 17.7]) {
    box('vestibule', 'entrance-corbel', outerEast, [23.40, 3.50, z], [0.20, 0.60, 0.28], visualColors.ivory);
    box('vestibule', 'entrance-corbel-cap', outerEast, [23.34, 3.78, z], [0.32, 0.10, 0.42], visualColors.brass);
    add('vestibule', 'entrance-corbel-finial', outerEast, 'octahedron', [23.37, 3.14, z], [0.16, 0.18, 0.18], visualColors.brass);
  }

  const obstacle = (roomId: string, x: number, z: number) => {
    const index = MANSION_WALLS.findIndex(wall => wall.materialType === 'obstacle' && wall.x === x && wall.z === z);
    if (index < 0) throw new Error(`Support de décor absent : ${roomId}`);
    return { index, wall: MANSION_WALLS[index] };
  };
  const book = (roomId: string, support: number, x: number, y: number, z: number, width: number, color: number, angle = 0) => {
    box(roomId, 'book-pages', support, [x, y, z], [width - 0.03, 0.10, 0.30], visualColors.ivory, angle);
    for (const dy of [-0.06, 0.06]) box(roomId, 'book-cover', support, [x, y + dy, z], [width, 0.02, 0.34], color, angle);
  };
  const candle = (roomId: string, support: number, x: number, base: number, z: number, height: number) => {
    add(roomId, 'candlestick-base', support, 'cylinder', [x, base + 0.035, z], [0.20, 0.07, 0.20], visualColors.brass);
    add(roomId, 'candlestick-stem', support, 'cylinder', [x, base + 0.17, z], [0.065, 0.24, 0.065], visualColors.brass);
    add(roomId, 'candlestick-cup', support, 'cylinder', [x, base + 0.30, z], [0.14, 0.05, 0.14], visualColors.brass);
    add(roomId, 'unlit-candle', support, 'cylinder', [x, base + 0.325 + height / 2, z], [0.085, height, 0.085], visualColors.ivory);
    box(roomId, 'candle-wick', support, [x, base + 0.335 + height, z], [0.014, 0.025, 0.014], visualColors.iron);
  };

  const hearth = obstacle('salon', -14, 13);
  const mantleTop = hearth.wall.y + hearth.wall.height / 2 + 0.005;
  candle('salon', hearth.index, -13.45, mantleTop, 11.65, 0.24);
  candle('salon', hearth.index, -13.45, mantleTop, 14.35, 0.19);
  book('salon', hearth.index, -14.1, mantleTop + 0.07, 13.0, 0.62, visualColors.carpet, 0.08);
  book('salon', hearth.index, -14.13, mantleTop + 0.21, 13.0, 0.52, visualColors.olive, -0.12);

  const pedestal = obstacle('galerie', -18, 0);
  const bustBase = pedestal.wall.y + pedestal.wall.height / 2;
  add('galerie', 'bust-plinth', pedestal.index, 'cylinder', [-18, bustBase + 0.07, 0], [0.88, 0.14, 0.88], 0x80786c);
  add('galerie', 'bust-shoulders', pedestal.index, 'octahedron', [-18, bustBase + 0.43, 0], [0.65, 0.38, 0.34], 0x938778);
  add('galerie', 'bust-neck', pedestal.index, 'cylinder', [-18, bustBase + 0.68, 0], [0.20, 0.28, 0.20], 0x938778);
  add('galerie', 'bust-head', pedestal.index, 'octahedron', [-18, bustBase + 0.98, 0], [0.28, 0.37, 0.29], 0xa49a89);

  for (const z of [-2.5, 2.5]) {
    const column = obstacle('grand_hall', 5, z);
    const top = column.wall.y + column.wall.height / 2;
    box('grand_hall', 'pillar-capital-base', column.index, [5, top + 0.08, z], [1.53, 0.16, 1.53], 0x756c5e);
    box('grand_hall', 'pillar-capital-abacus', column.index, [5, top + 0.23, z], [1.80, 0.14, 1.80], visualColors.stone);
    box('grand_hall', 'pillar-capital-band', column.index, [5, top + 0.32, z], [1.66, 0.04, 1.66], visualColors.brass);
    for (const dx of [-0.57, 0.57]) for (const dz of [-0.57, 0.57]) {
      add('grand_hall', 'pillar-capital-boss', column.index, 'octahedron', [5 + dx, top + 0.42, z + dz], [0.13, 0.15, 0.13], visualColors.brass);
    }
  }

  for (const z of [-12, -16]) {
    const shelf = obstacle('bibliotheque', -13, z);
    const top = shelf.wall.y + shelf.wall.height / 2;
    box('bibliotheque', 'bookcase-crown', shelf.index, [-13, top + 0.07, z], [7.12, 0.14, 1.30], 0x493025);
    box('bibliotheque', 'bookcase-crown-band', shelf.index, [-13, top + 0.16, z], [7.02, 0.04, 1.24], 0x8e744a);
    for (const side of [-1, 1]) {
      box('bibliotheque', 'bookcase-upper-shelf', shelf.index, [-13, 5.48, z + side * 0.63], [6.88, 0.08, 0.12], 0x684532);
      for (const dx of [-3.35, -1.68, 0, 1.68, 3.35]) {
        box('bibliotheque', 'bookcase-upper-stile', shelf.index, [-13 + dx, 5.48, z + side * 0.63], [0.10, 1.06, 0.12], 0x493025);
      }
    }
  }

  const bench = obstacle('atelier', 12, -14);
  const benchTop = bench.wall.y + bench.wall.height / 2;
  for (const [dx, dz, color] of [[-0.28, 0.22, visualColors.olive], [0.28, -0.22, visualColors.iron]]) {
    const x = bench.wall.x + bench.wall.width * dx;
    const z = bench.wall.z + bench.wall.depth * dz;
    add('atelier', 'brush-pot', bench.index, 'cylinder', [x, benchTop + 0.18, z], [0.32, 0.36, 0.32], color);
    add('atelier', 'brush-pot-rim', bench.index, 'cylinder', [x, benchTop + 0.35, z], [0.36, 0.04, 0.36], visualColors.brass);
    for (const [dx, dz, length] of [[-0.07, -0.05, 0.48], [0.07, -0.03, 0.60], [0, 0.07, 0.52]]) {
      box('atelier', 'brush-handle', bench.index, [x + dx, benchTop + 0.26 + length / 2, z + dz], [0.025, length, 0.025], visualColors.wood);
      box('atelier', 'brush-bristle', bench.index, [x + dx, benchTop + 0.26 + length, z + dz], [0.045, 0.12, 0.035], visualColors.ivory);
    }
  }
  book('atelier', bench.index, bench.wall.x + bench.wall.width * 0.23, benchTop + 0.07, bench.wall.z + bench.wall.depth * 0.22, 0.65, visualColors.olive, -0.12);
  box('atelier', 'canvas-roll', bench.index, [bench.wall.x - bench.wall.width * 0.15, benchTop + 0.10, bench.wall.z - bench.wall.depth * 0.22], [0.85, 0.20, 0.18], visualColors.ivory, 0.07);
  return result;
}

export const mansionFurnishingParts: readonly FurnishingPart[] = buildParts();

function createPart(part: FurnishingPart): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  if (part.shape === 'cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  else if (part.shape === 'octahedron') geometry = new THREE.OctahedronGeometry(1, 0);
  else geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.scale(...part.size);
  geometry.rotateY(part.rotationY ?? 0);
  geometry.translate(...part.center);
  if (geometry.index) {
    const indexed = geometry;
    geometry = indexed.toNonIndexed();
    indexed.dispose();
  }
  geometry.deleteAttribute('uv');
  const color = new THREE.Color(part.color);
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Décor volumique fixe fusionné par pièce ; toutes les ressources de ce lot lui appartiennent. */
export class MansionFurnishings {
  private readonly group = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly shotBlockers: THREE.Mesh[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'mansion-furnishings';
    this.material.name = 'mansion-furnishings-matte';
    for (const room of MANSION_ROOMS) this.addRoom(room);
    scene.add(this.group);
  }

  private addRoom(room: RoomSpec): void {
    const parts = mansionFurnishingParts.filter(part => part.roomId === room.id).map(createPart);
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) throw new Error(`Fusion du mobilier impossible : ${room.id}`);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = `mansion-furnishings-${room.id}`;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    // Le socle bas laisse le buste exposé : sa surface réelle doit arrêter les tirs.
    if (room.id === 'galerie') this.shotBlockers.push(mesh);
  }

  public getShotBlockers(): readonly THREE.Mesh[] {
    return this.shotBlockers;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    this.material.dispose();
  }
}
