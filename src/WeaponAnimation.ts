// Même chronologie pour le jeu et l'aperçu : une saisie, une extraction, une insertion.
export const reloadPoses = [
  { frame: 1, phase: 'approach', duration: 0.16, x: -12, y: 24, opacity: 1, magazine: 0 },
  { frame: 2, phase: 'grab', duration: 0.20, x: 12, y: 0, opacity: 1, magazine: 0 },
  { frame: 3, phase: 'extract', duration: 0.24, x: 8, y: 16, opacity: 1, magazine: 1 },
  { frame: 4, phase: 'exchange', duration: 0.18, x: -14, y: 46, opacity: 0, magazine: 0 },
  { frame: 5, phase: 'present', duration: 0.24, x: -8, y: 16, opacity: 1, magazine: 1 },
  { frame: 6, phase: 'insert', duration: 0.24, x: 12, y: 0, opacity: 1, magazine: 1 },
  { frame: 7, phase: 'seat', duration: 0.18, x: 12, y: 0, opacity: 1, magazine: 0 },
  { frame: 8, phase: 'withdraw', duration: 0.16, x: -10, y: 20, opacity: 1, magazine: 0 },
] as const;
