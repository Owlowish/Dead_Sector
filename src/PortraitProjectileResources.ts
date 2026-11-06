import * as THREE from 'three';
import { portraitProjectileAnimation } from './PortraitProjectileAnimation.ts';

interface AtlasResources {
  texture: THREE.Texture;
  material: THREE.MeshBasicMaterial;
  geometries: THREE.PlaneGeometry[];
}
interface ProjectileResources { flight: AtlasResources; impact: AtlasResources }
let shared: ProjectileResources | null = null;

/** Les UV sont portés par chaque géométrie ; aucun offset d'atlas partagé n'est muté. */
export function getPortraitProjectileResources(): ProjectileResources {
  if (shared) return shared;
  const loader = new THREE.TextureLoader();
  const make = (config: typeof portraitProjectileAnimation.flight | typeof portraitProjectileAnimation.impact): AtlasResources => {
    const texture = loader.load(config.url);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true,
      alphaTest: 0.35, side: THREE.DoubleSide, depthWrite: false });
    material.forceSinglePass = true;
    const geometries = Array.from({ length: config.frames }, (_, frame) => {
      const geometry = new THREE.PlaneGeometry(config.width, config.height);
      // Le noyau/contact dessiné devient exactement l'origine physique locale.
      geometry.translate(config.width * (0.5 - config.anchorX / config.cellWidth),
        config.height * (config.anchorY / config.cellHeight - 0.5), 0);
      const uv = geometry.attributes.uv;
      const column = frame % config.columns, row = Math.floor(frame / config.columns);
      for (let i = 0; i < uv.count; i++) uv.setXY(i,
        (column + uv.getX(i)) / config.columns,
        (config.rows - row - 1 + uv.getY(i)) / config.rows);
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      return geometry;
    });
    return { texture, material, geometries };
  };
  shared = { flight: make(portraitProjectileAnimation.flight), impact: make(portraitProjectileAnimation.impact) };
  return shared;
}

export function disposePortraitProjectileResources(): void {
  if (!shared) return;
  for (const atlas of [shared.flight, shared.impact]) {
    atlas.texture.dispose(); atlas.material.dispose();
    for (const geometry of atlas.geometries) geometry.dispose();
  }
  shared = null;
}
