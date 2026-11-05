import * as THREE from 'three';
import { MANSION_WALL_STYLE } from './MansionWallGeometry.ts';

let sharedMaterial: THREE.MeshStandardMaterial | null = null;

export function mansionWallMaterial(): THREE.MeshStandardMaterial {
  if (sharedMaterial) return sharedMaterial;
  const map = new THREE.TextureLoader().load(MANSION_WALL_STYLE.atlasUrl);
  map.name = 'mansion-wall-bands-v1';
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestMipmapNearestFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  sharedMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.88, metalness: 0 });
  sharedMaterial.name = 'mansion-wall-bands';
  return sharedMaterial;
}
