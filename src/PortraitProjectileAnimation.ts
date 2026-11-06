/** Atlas de lames de peinture : coordonnées des cellules en pixels, origine haut gauche. */
export const portraitProjectileAnimation = {
  trail: { spacing: 0.7, lifetime: 0.075 },
  flight: { url: '/assets/zombies/portrait-projectiles/flight.png', columns: 3, rows: 2,
    frames: 6, cellWidth: 256, cellHeight: 128, frameDuration: 0.055,
    width: 1, height: 0.5, anchorX: 192, anchorY: 64 },
  impact: { url: '/assets/zombies/portrait-projectiles/impact.png', columns: 2, rows: 2,
    frames: 4, cellWidth: 128, cellHeight: 128, frameDuration: 0.07,
    width: 0.85, height: 0.85, anchorX: 64, anchorY: 110, capacity: 10 },
} as const;

export function portraitFlightFrame(age: number): number {
  return Math.floor(Math.max(0, age) / portraitProjectileAnimation.flight.frameDuration)
    % portraitProjectileAnimation.flight.frames;
}

export function portraitImpactFrame(age: number): number {
  return Math.min(portraitProjectileAnimation.impact.frames - 1,
    Math.floor(Math.max(0, age) / portraitProjectileAnimation.impact.frameDuration));
}
