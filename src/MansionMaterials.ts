import * as THREE from 'three';

export const mansionSurfaceAssets = {
  wood: 'wood-structure-v1.png', stone: 'stone-ashlar-v1.png',
  door: 'door-panel-v1.png', ceiling: 'ceiling-coffer-v1.png',
  brick: 'hearth-brick-v1.png', carpet: 'carpet-damask-v1.png',
  books: 'bookshelf-front-v1.png', workbench: 'workbench-front-v1.png',
} as const;
export type MansionSurface = keyof typeof mansionSurfaceAssets;

const textures = new Map<MansionSurface, THREE.Texture>();
const materials = new Map<string, THREE.MeshStandardMaterial>();

// Matériaux et transformations UV partagés entre les pièces et les portes.
export function mansionMaterial(surface: MansionSurface, repeatX = 1, repeatY = 1): THREE.MeshStandardMaterial {
  const key = `${surface}:${repeatX}:${repeatY}`;
  const cached = materials.get(key);
  if (cached) return cached;
  let base = textures.get(surface);
  if (!base) {
    base = new THREE.TextureLoader().load(`/assets/textures/mansion/${mansionSurfaceAssets[surface]}`);
    base.name = `mansion-${surface}`;
    base.wrapS = surface === 'door' || surface === 'workbench' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    base.wrapT = surface === 'door' || surface === 'workbench' || surface === 'books' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    base.magFilter = THREE.NearestFilter;
    base.minFilter = THREE.NearestMipmapNearestFilter;
    base.colorSpace = THREE.SRGBColorSpace;
    textures.set(surface, base);
  }
  const map = repeatX === 1 && repeatY === 1 ? base : base.clone();
  map.repeat.set(repeatX, repeatY);
  const material = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
  material.name = `mansion-${surface}`;
  materials.set(key, material);
  return material;
}

// Ordre BoxGeometry : +X, -X, +Y, -Y, +Z, -Z. La densité est portée par les UV,
// pour garder un seul rendu de matériau sur un bloc homogène.
export function mansionBoxGeometry(width: number, height: number, depth: number, tileSize = 2, facade?: 'books' | 'workbench' | 'door'): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.getAttribute('uv');
  const sizes = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
  for (let face = 0; face < 6; face++) {
    const isFacade = facade && (face === 4 || (face === 5 && facade !== 'workbench'));
    const repeatX = isFacade ? (facade === 'books' ? width / 1.75 : 1) : sizes[face][0] / tileSize;
    const repeatY = isFacade ? 1 : sizes[face][1] / tileSize;
    for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * repeatX, uv.getY(i) * repeatY);
  }
  geometry.clearGroups();
  if (facade) {
    geometry.addGroup(0, 24, 0);
    geometry.addGroup(24, facade === 'workbench' ? 6 : 12, 1);
    if (facade === 'workbench') geometry.addGroup(30, 6, 0);
  }
  return geometry;
}
