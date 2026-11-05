import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MANSION_ROOMS, getMansionFloorHeight } from './MansionConfig.ts';
import { visualColors } from './VisualStyle.ts';

export const dressingAtlas = {
  url: '/assets/decor/mansion-details-v1.png',
  size: 1024,
  cellWidth: 256,
  cellHeight: 512,
  cells: { clock: 0, mirror: 1, tapestry: 2, curios: 3, tools: 4 },
} as const;

export interface DressingPlacement {
  roomId: string;
  asset: keyof typeof dressingAtlas.cells;
  x: number;
  z: number;
  centerY: number; // Hauteur au-dessus du sol local, y compris sur le demi-niveau.
  width: number;
  rotationY: number;
}

// Les faces sont à 9,5 cm du mur ; le relief discret reste derrière, hors des ouvertures.
export const mansionDressingPlacements: readonly DressingPlacement[] = [
  { roomId: 'vestibule', asset: 'clock', x: 12, z: 19.405, centerY: 2.06, width: 0.86, rotationY: Math.PI },
  { roomId: 'vestibule', asset: 'mirror', x: 23.405, z: 11, centerY: 2.15, width: 0.95, rotationY: -Math.PI / 2 },
  { roomId: 'vestibule', asset: 'tapestry', x: 18.5, z: 19.405, centerY: 2.4, width: 1.15, rotationY: Math.PI },

  { roomId: 'salon', asset: 'mirror', x: -18.5, z: 19.405, centerY: 2.15, width: 0.95, rotationY: Math.PI },
  { roomId: 'salon', asset: 'tapestry', x: -23.405, z: 9, centerY: 2.4, width: 1.15, rotationY: Math.PI / 2 },

  { roomId: 'galerie', asset: 'tapestry', x: -7, z: 5.405, centerY: 2.3, width: 1, rotationY: Math.PI },

  { roomId: 'grand_hall', asset: 'tapestry', x: 23.405, z: -4.4, centerY: 2.4, width: 1.1, rotationY: -Math.PI / 2 },
  { roomId: 'grand_hall', asset: 'tapestry', x: 23.405, z: 3.1, centerY: 2.45, width: 1.2, rotationY: -Math.PI / 2 },

  { roomId: 'bibliotheque', asset: 'curios', x: -8, z: -19.405, centerY: 2.2, width: 0.92, rotationY: 0 },
  { roomId: 'bibliotheque', asset: 'curios', x: -3.595, z: -18, centerY: 2.2, width: 0.92, rotationY: -Math.PI / 2 },

  { roomId: 'atelier', asset: 'tools', x: 12, z: -19.405, centerY: 2.4, width: 1.1, rotationY: 0 },
  { roomId: 'atelier', asset: 'tools', x: 23.405, z: -17.5, centerY: 2.15, width: 0.9, rotationY: -Math.PI / 2 },
];

export interface DressingReliefPart {
  placementIndex: number;
  center: readonly [number, number, number];
  size: readonly [number, number, number];
  rotationY: number;
  color: number;
}

// Seul le corps plein a une épaisseur : les volutes ajourées gardent la découpe de l'image.
export const dressingReliefParts: readonly DressingReliefPart[] = mansionDressingPlacements.flatMap((item, placementIndex) => {
  if (item.asset !== 'clock' && item.asset !== 'mirror' && item.asset !== 'curios') return [];
  const height = item.width * 2;
  const body = item.asset === 'curios'
    ? { width: 0.72, height: 0.47, centerY: 0.505, top: 0.255, bottom: 0.765 }
    : { width: 0.66, height: 0.57, centerY: 0.51, top: 0.215, bottom: 0.805 };
  const floor = getMansionFloorHeight(item.x, item.z);
  const normalX = Math.sin(item.rotationY), normalZ = Math.cos(item.rotationY);
  const part = (relativeY: number, width: number, relativeHeight: number, color: number): DressingReliefPart => ({
    placementIndex,
    center: [item.x - normalX * 0.037, floor + item.centerY + (0.5 - relativeY) * height, item.z - normalZ * 0.037],
    size: [item.width * width, height * relativeHeight, 0.07],
    rotationY: item.rotationY,
    color,
  });
  return [
    part(body.centerY, body.width, body.height, visualColors.wood),
    part(body.top, 0.81, 0.035, 0x493025),
    part(body.bottom, 0.78, 0.035, 0x493025),
  ];
});

/** Habillage statique : atlas et reliefs fusionnés par pièce, sans collision ajoutée. */
export class MansionDressing {
  private readonly group = new THREE.Group();
  private readonly texture: THREE.Texture;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly reliefMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  private readonly geometries: THREE.BufferGeometry[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'mansion-dressing';
    this.texture = new THREE.TextureLoader().load(dressingAtlas.url);
    this.texture.name = 'mansion-dressing-atlas';
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.material = new THREE.MeshStandardMaterial({
      map: this.texture, alphaTest: 0.5, roughness: 1, metalness: 0,
    });
    this.material.name = 'mansion-dressing-cutout';
    this.reliefMaterial.name = 'mansion-dressing-relief-matte';

    for (const room of MANSION_ROOMS) {
      const placements = mansionDressingPlacements.filter(item => item.roomId === room.id);
      if (placements.length === 0) continue;
      const parts = placements.map(item => this.createPlane(item));
      const geometry = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      if (!geometry) throw new Error(`Fusion du décor impossible : ${room.id}`);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `mansion-dressing-${room.id}`;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);

      const reliefParts = dressingReliefParts.filter(part => mansionDressingPlacements[part.placementIndex].roomId === room.id)
        .map(part => this.createRelief(part));
      if (reliefParts.length === 0) continue;
      const relief = mergeGeometries(reliefParts);
      for (const part of reliefParts) part.dispose();
      if (!relief) throw new Error(`Fusion du relief impossible : ${room.id}`);
      relief.computeBoundingBox();
      relief.computeBoundingSphere();
      this.geometries.push(relief);
      const reliefMesh = new THREE.Mesh(relief, this.reliefMaterial);
      reliefMesh.name = `mansion-dressing-relief-${room.id}`;
      reliefMesh.receiveShadow = true;
      reliefMesh.matrixAutoUpdate = false;
      this.group.add(reliefMesh);
    }
    scene.add(this.group);
  }

  private createRelief(part: DressingReliefPart): THREE.BoxGeometry {
    const geometry = new THREE.BoxGeometry(...part.size);
    geometry.clearGroups();
    geometry.rotateY(part.rotationY);
    geometry.translate(...part.center);
    const color = new THREE.Color(part.color);
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  private createPlane(item: DressingPlacement): THREE.PlaneGeometry {
    const geometry = new THREE.PlaneGeometry(item.width, item.width * dressingAtlas.cellHeight / dressingAtlas.cellWidth);
    const cell = dressingAtlas.cells[item.asset];
    const left = (cell % 4) * dressingAtlas.cellWidth;
    const top = Math.floor(cell / 4) * dressingAtlas.cellHeight;
    const uv = geometry.getAttribute('uv');
    // V part du bas dans Three.js ; les rectangles de notre fiche partent du haut de l'image.
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i,
        (left + 0.5 + uv.getX(i) * (dressingAtlas.cellWidth - 1)) / dressingAtlas.size,
        1 - (top + 0.5 + (1 - uv.getY(i)) * (dressingAtlas.cellHeight - 1)) / dressingAtlas.size,
      );
    }
    geometry.rotateY(item.rotationY);
    geometry.translate(item.x, getMansionFloorHeight(item.x, item.z) + item.centerY, item.z);
    return geometry;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    this.material.dispose();
    this.reliefMaterial.dispose();
    this.texture.dispose();
  }
}
