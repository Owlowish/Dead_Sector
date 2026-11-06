import * as THREE from 'three';
import { crawlerSprite } from './CrawlerAnimation.ts';
import { portraitSprite } from './PortraitAnimation.ts';

interface AlphaMask {
  width: number;
  height: number;
  pixels: Uint8Array;
}

// Les textures des ennemis sont partagées : un seul masque suffit pour chaque image.
const masks = new WeakMap<THREE.Texture, AlphaMask>();

export function prepareSpriteHitMask(texture: THREE.Texture): void {
  if (masks.has(texture) || typeof document === 'undefined') return;
  const image = texture.image as HTMLImageElement | undefined;
  if (!image?.width || !image.height) return;
  // Plafonner la résolution du masque alpha à 512px pour diviser par 4 à 8 le temps de calcul JS
  const maxDim = 512;
  const scale = image.width > maxDim ? maxDim / image.width : 1;
  const targetW = Math.max(1, Math.round(image.width * scale));
  const targetH = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0, targetW, targetH);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i * 4 + 3];
  masks.set(texture, { width: canvas.width, height: canvas.height, pixels });
}

export function isOpaqueSpriteHit(mesh: THREE.Mesh, uv: THREE.Vector2 | undefined): boolean {
  if (!uv || Array.isArray(mesh.material)) return true;
  const material = mesh.material as THREE.MeshStandardMaterial;
  const texture = material.map;
  const mask = texture && masks.get(texture);
  // En l'absence de masque, conserver le comportement historique plutôt que rendre la cible invulnérable.
  if (!texture || !mask) return true;
  const mapped = texture.transformUv(uv.clone());
  const x = Math.min(mask.width - 1, Math.max(0, Math.floor(mapped.x * mask.width)));
  const y = Math.min(mask.height - 1, Math.max(0, Math.floor(mapped.y * mask.height)));
  return mask.pixels[y * mask.width + x] / 255 >= material.alphaTest;
}

// Rectangles conservateurs mesurés sur les atlas : seuls les visages comptent.
// Les mains levées et la gorge du Cracheur sont volontairement hors de ces zones.
const heads: Record<string, Array<[number, number, number, number]>> = {
  'zombie_idle.png': [[105, 8, 199, 112]],
  'zombie_walk_v2.png': [0, 1, 2, 3, 4, 5].map((i) => {
    const x = (i % 3) * 362;
    const y = Math.floor(i / 3) * 724;
    return [x + 125, y + 25, x + 300, y + 200];
  }),
  'zombie_attack.png': [0, 1, 2, 3].map((i) => [i * 443.5 + 155, 85, i * 443.5 + 365, 285]),
  'zombie_hurt_v2.png': [[155, 83, 390, 320], [905, 115, 1130, 365]],
  'idle.png': [[490, 55, 770, 390]],
  'run.png': [0, 1, 2, 3, 4, 5].map((i) => {
    const x = (i % 3) * 362;
    const y = Math.floor(i / 3) * 724;
    return [x + 170, y + 70, x + 315, y + 245];
  }),
  'attack.png': [0, 1, 2, 3].map((i) => [i * 443.5 + 165, 80, i * 443.5 + 350, 300]),
  'hurt.png': [[260, 30, 530, 350], [760, 80, 1060, 400]],
};

// Dimensions de référence historiques sur lesquelles les rectangles 'heads' ont été mesurés.
const refDimensions: Record<string, [number, number]> = {
  'zombie_idle.png': [230, 403],
  'zombie_walk_v2.png': [1086, 1448],
  'zombie_attack.png': [1774, 887],
  'zombie_hurt_v2.png': [1254, 1254],
  'idle.png': [1086, 1448],
  'run.png': [1086, 1448],
  'attack.png': [1774, 887],
  'hurt.png': [1254, 1254],
};

export function isHeadSpriteHit(mesh: THREE.Mesh, uv: THREE.Vector2 | undefined): boolean {
  if (!uv || Array.isArray(mesh.material)) return false;
  const texture = (mesh.material as THREE.MeshStandardMaterial).map;
  const image = texture?.image as HTMLImageElement | undefined;
  if (!texture || !image?.width || !image.height) return false;
  const path = image.src || '';
  const name = path.substring(path.lastIndexOf('/') + 1);
  const isSpitter = path.includes('/spitter/');
  const isCrawler = path.includes('/crawler/');
  const isPortrait = path.includes('/portrait/');
  const regions = isPortrait ? portraitSprite.heads[name] : isSpitter
    ? [[400, 50, 630, 265] as [number, number, number, number]]
    : isCrawler
    ? crawlerSprite.heads[name]
    : heads[name];
  if (!regions) return false;
  const refWidth = isPortrait ? portraitSprite.width : isSpitter ? 1024 : isCrawler ? crawlerSprite.width : (refDimensions[name]?.[0] ?? image.width);
  const refHeight = isPortrait ? portraitSprite.height : isSpitter ? 1536 : isCrawler ? crawlerSprite.height : (refDimensions[name]?.[1] ?? image.height);
  const scaleX = image.width / refWidth;
  const scaleY = image.height / refHeight;
  const point = texture.transformUv(uv.clone());
  const x = point.x * image.width;
  const y = point.y * image.height;
  return regions.some(([left, top, right, bottom]) =>
    x >= left * scaleX && x <= right * scaleX && y >= top * scaleY && y <= bottom * scaleY
  );
}
