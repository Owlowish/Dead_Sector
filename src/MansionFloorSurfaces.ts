import { PIANO_ROOM_LAYOUT } from './MansionConfig.ts';

// Rectangles au sol partagés par l'habillage et les pas : aucune collision ajoutée.
export const SALON_RUNNERS = [
  { width: 12, depth: 2.6, x: -10, z: 16.5 },
  { width: 2.4, depth: 9, x: -8.5, z: 13 },
  { width: 2.4, depth: 6, x: -12, z: 7.5 },
] as const;

export const MANSION_CARPETS = [...SALON_RUNNERS, PIANO_ROOM_LAYOUT.carpet] as const;
