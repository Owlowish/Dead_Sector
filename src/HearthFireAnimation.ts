const frames = 8;
const fps = 10;

// Contrat commun au jeu et à l'aperçu : cellules lues de gauche à droite, puis de haut en bas.
export const hearthFireAnimation = {
  url: '/assets/effects/hearth-fire-v1.png',
  atlasWidth: 512,
  atlasHeight: 256,
  columns: 4,
  rows: 2,
  frameWidth: 128,
  frameHeight: 128,
  frames,
  fps,
  duration: frames / fps,
} as const;

export function getHearthFireFrame(elapsed: number): number {
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  // Tolérance minuscule pour les additions de delta proches d'une frontière de cellule.
  return Math.floor(((elapsed % hearthFireAnimation.duration) + 1e-9) * hearthFireAnimation.fps)
    % hearthFireAnimation.frames;
}
