import * as THREE from 'three';

export type ImpactSurface = 'wood' | 'stone' | 'metal';

function isImpactSurface(value: unknown): value is ImpactSurface {
  return value === 'wood' || value === 'stone' || value === 'metal';
}

export function setImpactSurface<T extends THREE.Material>(material: T, surface: ImpactSurface): T {
  material.userData.impactSurface = surface;
  return material;
}

export function getImpactSurface(hit: Pick<THREE.Intersection, 'object' | 'face'>): ImpactSurface {
  const mesh = hit.object as THREE.Mesh;
  // Une bibliothèque ou un battant peut porter plusieurs matériaux : lire celui de la face touchée.
  const material = Array.isArray(mesh.material)
    ? mesh.material[hit.face?.materialIndex ?? 0]
    : mesh.material;
  const surface = material?.userData.impactSurface;
  if (isImpactSurface(surface)) return surface;
  const fallback = hit.object.userData.impactSurface;
  return isImpactSurface(fallback) ? fallback : 'stone';
}
