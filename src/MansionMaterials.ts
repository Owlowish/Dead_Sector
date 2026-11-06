import * as THREE from 'three';
import { setImpactSurface } from './ImpactSurface.ts';

export const mansionSurfaceAssets = {
  wood: 'wood-structure-v1.png', stone: 'stone-ashlar-v1.png',
  door: 'door-panel-v1.png', ceiling: 'ceiling-coffer-v1.png',
  brick: 'hearth-brick-v1.png', carpet: 'carpet-damask-v1.png',
  books: 'bookshelf-front-v1.png', workbench: 'workbench-front-v1.png',
} as const;
export type MansionSurface = keyof typeof mansionSurfaceAssets;

const textures = new Map<MansionSurface, THREE.Texture>();
const materials = new Map<string, THREE.MeshStandardMaterial>();
const salonTextures = new Map<'wall' | 'wood', THREE.Texture>();
const salonMaterials = new Map<string, THREE.MeshStandardMaterial>();

// Réduit seulement les variations de quelques texels, une fois au chargement.
// Dimensions, UV, palette moyenne et filtrage rétro restent ceux de la source.
export function softenMansionTextureDetail(texture: THREE.Texture): void {
  if (typeof document === 'undefined') return;
  const image = texture.image as HTMLImageElement;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return;
  const coarse = document.createElement('canvas');
  coarse.width = Math.max(1, Math.ceil(width / 4));
  coarse.height = Math.max(1, Math.ceil(height / 4));
  const coarseContext = coarse.getContext('2d');
  if (!coarseContext) return;
  coarseContext.imageSmoothingEnabled = true;
  coarseContext.imageSmoothingQuality = 'high';
  coarseContext.drawImage(image, 0, 0, coarse.width, coarse.height);
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  const context = result.getContext('2d');
  if (!context) return;
  context.drawImage(image, 0, 0);
  context.globalAlpha = 0.3;
  context.imageSmoothingEnabled = false;
  context.drawImage(coarse, 0, 0, width, height);
  texture.image = result;
  texture.needsUpdate = true;
}

export function salonMaterial(kind: 'wall' | 'wood', original: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const key = `${kind}:${original.map!.repeat.x}:${original.map!.repeat.y}`;
  const cached = salonMaterials.get(key);
  if (cached) return cached;
  let texture = salonTextures.get(kind);
  if (!texture) {
    texture = new THREE.TextureLoader().load(`/assets/textures/mansion/salon-${kind}-v1.png`, softenMansionTextureDetail);
    texture.name = `salon-${kind}`;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = kind === 'wall' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    salonTextures.set(kind, texture);
  }
  const map = texture.clone();
  map.repeat.copy(original.map!.repeat);
  const material = original.clone();
  material.map = map;
  material.name = `salon-${kind}`;
  material.userData.salonOriginalMap = original.map;
  salonMaterials.set(key, material);
  return material;
}

// Matériaux et transformations UV partagés entre les pièces et les portes.
export function mansionMaterial(surface: MansionSurface, repeatX = 1, repeatY = 1): THREE.MeshStandardMaterial {
  const key = `${surface}:${repeatX}:${repeatY}`;
  const cached = materials.get(key);
  if (cached) return cached;
  let base = textures.get(surface);
  if (!base) {
    const soften = surface === 'wood' || surface === 'door' || surface === 'ceiling'
      || surface === 'carpet' || surface === 'workbench';
    base = new THREE.TextureLoader().load(`/assets/textures/mansion/${mansionSurfaceAssets[surface]}`,
      soften ? softenMansionTextureDetail : undefined);
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
  setImpactSurface(material, surface === 'stone' || surface === 'brick' ? 'stone' : 'wood');
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
