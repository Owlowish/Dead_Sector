// Repères communs au rendu de l'arme et à son aperçu isolé.
export const shotgunPump = {
  backAt: 0.15,
  ejectAt: 0.19,
  forwardAt: 0.35,
  restAsset: '/assets/weapons/shotgun/hip-rest-v2.png',
  backAsset: '/assets/weapons/shotgun/hip-back-v2.png',
  hipKickAsset: '/assets/weapons/shotgun/hip-kick-v2.png',
  adsKickAsset: '/assets/weapons/shotgun/ads-kick-v2.png',
  kickPoseUntil: 0.12,
} as const;

export function isShotgunKick(elapsed: number): boolean {
  return elapsed >= 0 && elapsed < shotgunPump.kickPoseUntil;
}

// Choc bref, puis récupération ; indépendant de la longue queue de recul réglée à 2 s.
export function shotgunKickAmount(elapsed: number): number {
  if (elapsed < 0 || elapsed >= 0.16) return 0;
  return elapsed < 0.025 ? elapsed / 0.025 : ((0.16 - elapsed) / 0.135) ** 2;
}

export function isShotgunPumpBack(elapsed: number): boolean {
  return elapsed >= shotgunPump.backAt && elapsed <= shotgunPump.forwardAt;
}

export const shotgunReload = {
  duration: 0.65,
  commitAt: 0.5,
  poses: [
    { until: 0.08, phase: 'Approche main vide', x: 17, y: 18, shellX: 43, shellY: 68, shell: 0, hide: 0 },
    { until: 0.22, phase: 'Présentation', x: 17, y: 2, shellX: 44, shellY: 68, shell: 1, hide: 0 },
    { until: 0.34, phase: 'Alignement', x: 22, y: -1, shellX: 49, shellY: 65, shell: 1, hide: 0 },
    { until: 0.5, phase: 'Insertion', x: 26, y: -4, shellX: 46, shellY: 62, shell: 1, hide: 55 },
    { until: 0.55, phase: 'Encliquetage', x: 26, y: -4, shellX: 46, shellY: 62, shell: 0, hide: 100 },
    { until: 0.65, phase: 'Retrait main vide', x: 17, y: 18, shellX: 43, shellY: 68, shell: 0, hide: 100 },
  ],
} as const;

export function getShotgunReloadPose(elapsed: number) {
  return shotgunReload.poses.find(pose => elapsed < pose.until)
    ?? shotgunReload.poses[shotgunReload.poses.length - 1];
}
