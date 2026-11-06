export interface RoomComposition {
  roomId: string;
  focus: { label: string; x: number; z: number; y?: number };
  secondary: string;
  // Segment mural volontairement sans tableau ni panneau rapporté ; low/high suivent l'autre axe.
  calmWall: { axis: 'x' | 'z'; plane: number; low: number; high: number };
}

export interface ComposedPortrait {
  id: string;
  roomId: string;
  x: number;
  z: number;
  centerY: number; // Hauteur relative au sol local, comme les panneaux de MansionDressing.
  rotationY: number;
  width: number;
  height: number;
}

/** Chaque pièce conserve un repère principal, un groupe secondaire et un vrai repos mural. */
export const roomCompositions: readonly RoomComposition[] = [
  {
    roomId: 'vestibule',
    focus: { label: 'Piano à queue et fenêtre d’orage', x: 10.5, z: 11.5, y: 1.15 },
    secondary: 'Rideaux bordeaux, lustre de laiton et portrait près de la fenêtre ; pendule au sud et console fleurie en retrait.',
    calmWall: { axis: 'z', plane: 6.5, low: 17.8, high: 21.5 },
  },
  {
    roomId: 'salon',
    focus: { label: 'Cheminée et feu', x: -14, z: 13, y: 1.5 },
    secondary: 'Miroir au sud et tapisserie près du passage vers la Galerie ; le foyer reste dominant.',
    calmWall: { axis: 'x', plane: -3.5, low: 11.65, high: 14.35 },
  },
  {
    roomId: 'galerie',
    focus: { label: 'Autel démoniaque et cristaux suspendus', x: -18, z: 0, y: 2.2 },
    secondary: 'Pierre maculée, sceau rouge, bougies et volutes discrètes ; deux bannières entre les fenêtres et les portraits.',
    calmWall: { axis: 'x', plane: -3.5, low: 1.6, high: 4.8 },
  },
  {
    roomId: 'grand_hall',
    focus: { label: 'Lustre et piliers', x: 8, z: 0, y: 3.2 },
    secondary: 'Deux tapisseries décalées sur le mur est et un portrait isolé au sud.',
    calmWall: { axis: 'z', plane: 5.5, low: 6, high: 15.5 },
  },
  {
    roomId: 'bibliotheque',
    focus: { label: 'Rayonnages et livres', x: -13, z: -14, y: 2 },
    secondary: 'Deux vitrines de curiosités autour de l’allée est, sans répétition des portraits.',
    calmWall: { axis: 'x', plane: -23.5, low: -15.8, high: -12.2 },
  },
  {
    roomId: 'atelier',
    focus: { label: 'Établi et outils', x: 12, z: -14, y: 1 },
    secondary: 'Panneau d’outils dans l’axe de l’établi et petit panneau sur le retour est.',
    calmWall: { axis: 'x', plane: 23.5, low: -15.6, high: -11.2 },
  },
];

export const composedPortraits: readonly ComposedPortrait[] = [
  { id: 'entrance-portrait', roomId: 'vestibule', x: 15.5, z: 6.595, centerY: 2.05, rotationY: 0, width: 1.125, height: 1.5 },
  { id: 'salon-portrait', roomId: 'salon', x: -23.405, z: 13, centerY: 2.08, rotationY: Math.PI / 2, width: 1.125, height: 1.5 },
  { id: 'gallery-west-portrait', roomId: 'galerie', x: -23.405, z: 0, centerY: 2.15, rotationY: Math.PI / 2, width: 1.125, height: 1.5 },
  { id: 'gallery-south-left', roomId: 'galerie', x: -20.8, z: 5.405, centerY: 2.15, rotationY: Math.PI, width: 1.125, height: 1.5 },
  { id: 'gallery-south-right', roomId: 'galerie', x: -16.6, z: 5.405, centerY: 2.15, rotationY: Math.PI, width: 1.125, height: 1.5 },
  { id: 'hall-portrait', roomId: 'grand_hall', x: 18, z: 5.405, centerY: 2.15, rotationY: Math.PI, width: 1.125, height: 1.5 },
];
