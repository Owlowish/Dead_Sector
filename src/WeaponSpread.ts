import * as THREE from 'three';

// Pistolet : demi-angle 2° à la hanche, 0° en visée ADS
export const pistolHipSpreadDegrees = 2;
export const pistolAdsSpreadDegrees = 0;

// Fusil à pompe : demi-angle 5° à la hanche, 3° en visée ADS (cône resserré mais toujours dispersé)
export const shotgunHipSpreadDegrees = 5;
export const shotgunAdsSpreadDegrees = 3;

export function spreadAngle(
  aimAmount: number,
  hipDegrees = pistolHipSpreadDegrees,
  adsDegrees = pistolAdsSpreadDegrees
): number {
  const t = THREE.MathUtils.clamp(aimAmount, 0, 1);
  const currentDeg = hipDegrees * (1 - t) + adsDegrees * t;
  return THREE.MathUtils.degToRad(currentDeg);
}

export function sampleShotDirection(
  aimAmount: number,
  random = Math.random,
  hipDegrees = pistolHipSpreadDegrees,
  adsDegrees = pistolAdsSpreadDegrees
): THREE.Vector3 {
  const angle = spreadAngle(aimAmount, hipDegrees, adsDegrees);
  if (angle === 0) return new THREE.Vector3(0, 0, -1);

  // Échantillonnage uniforme en angle solide : pas d'accumulation artificielle au centre.
  const cosTheta = 1 - random() * (1 - Math.cos(angle));
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = random() * Math.PI * 2;
  return new THREE.Vector3(sinTheta * Math.cos(phi), sinTheta * Math.sin(phi), -cosTheta);
}

export function spreadRadiusPixels(
  aimAmount: number,
  verticalFov: number,
  viewportHeight: number,
  hipDegrees = pistolHipSpreadDegrees,
  adsDegrees = pistolAdsSpreadDegrees
): number {
  const angle = spreadAngle(aimAmount, hipDegrees, adsDegrees);
  return (Math.tan(angle) / Math.tan(THREE.MathUtils.degToRad(verticalFov) / 2)) * (viewportHeight / 2);
}
