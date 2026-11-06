import * as THREE from 'three';
import { portraitAnimation, portraitConfig, type PortraitPose } from './PortraitAnimation.ts';
import { prepareSpriteHitMask } from './SpriteHitMask.ts';

interface PortraitResources {
  geometry: THREE.PlaneGeometry;
  textures: Record<PortraitPose, THREE.Texture>;
  depth: Record<PortraitPose, THREE.MeshDepthMaterial>;
  distance: Record<PortraitPose, THREE.MeshDistanceMaterial>;
}

let shared: PortraitResources | null = null;

export function getPortraitResources(): PortraitResources {
  if (shared) return shared;
  const loader = new THREE.TextureLoader();
  const textures = {} as PortraitResources['textures'];
  const depth = {} as PortraitResources['depth'];
  const distance = {} as PortraitResources['distance'];
  for (const pose of portraitAnimation.poses) {
    const map = loader.load(`/assets/zombies/portrait/${pose}.png`, prepareSpriteHitMask);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
    textures[pose] = map;
    depth[pose] = new THREE.MeshDepthMaterial({ map, alphaTest: 0.4, depthPacking: THREE.RGBADepthPacking });
    distance[pose] = new THREE.MeshDistanceMaterial({ map, alphaTest: 0.4 });
  }
  shared = { geometry: new THREE.PlaneGeometry(portraitConfig.width, portraitConfig.height), textures, depth, distance };
  return shared;
}

export function disposePortraitResources(): void {
  if (!shared) return;
  shared.geometry.dispose();
  for (const pose of portraitAnimation.poses) {
    shared.textures[pose].dispose();
    shared.depth[pose].dispose();
    shared.distance[pose].dispose();
  }
  shared = null;
}
