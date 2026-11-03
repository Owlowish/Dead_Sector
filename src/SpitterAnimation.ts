/** Chronologie commune des poses du cracheur (jeu et aperçu). */
export const spitterAnimation = {
  walkPoseDuration: 0.5,
  windupDuration: 0.95,
  releaseDuration: 0.18,
  recoveryDuration: 0.65,
  attackCooldown: 2.4,
  deathFrameDuration: 0.24,
  poses: ['idle', 'walk-a', 'walk-b', 'windup', 'release', 'recovery', 'death'] as const,
};

export function spitterDeathFrame(elapsed: number): number {
  return Math.min(2, Math.floor(Math.max(0, elapsed) / spitterAnimation.deathFrameDuration));
}

export type SpitterPose = (typeof spitterAnimation.poses)[number];
