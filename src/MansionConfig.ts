/**
 * DEAD SECTOR — Architecture globale et source unique de vérité du manoir ($48 \times 40$ m).
 * Version Option 1 : Demi-niveau à +2,4 m avec 2 escaliers statiques et plateau surélevé sur socle plein.
 * Centralise les dimensions, pièces, rampes, murs, portes, waypoints de navigation, apparitions et ressources.
 */

export interface BoxCollider {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  materialType?: 'wall' | 'obstacle' | 'metal';
  surface?: 'wood' | 'stone' | 'books' | 'workbench';
}

export interface DoorSpec {
  id: string;
  x: number;
  y?: number;
  z: number;
  passageWidth: number;
  name: string;
  type: 'interior' | 'sector_access' | 'permanent_limit';
  unlockAfterTier: number;
  axis?: 'X' | 'Z';
}

export interface RoomSpec {
  id: string;
  name: string;
  tier: number;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface RampSpec {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  startZ: number;
  endZ: number;
  startY: number;
  endY: number;
}

export interface Point2D {
  x: number;
  z: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface SpawnPoolConfig {
  tierNumber: number;
  totalZombies: number;
  sectorBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  pool: Point2D[];
}

export interface PickupSpec {
  type: 'medkit' | 'ammo';
  x: number;
  z: number;
  value: number;
  weaponType?: 'pistol' | 'shotgun';
}

export interface HorrorPointSpec extends Point2D {
  roomId: string;
  requiredOpenDoorId?: string;
}

// 1. Budget formel et limites documentées du manoir
export const MANSION_BUDGET = {
  bounds: {
    minX: -24,
    maxX: 24,
    minZ: -20,
    maxZ: 20,
    width: 48,
    depth: 40,
  },
  maxRooms: 8,
  currentRooms: 6, // 1A. Vestibule, 1B. Grand Salon, 1C. Galerie Ouest, 2. Grand Hall Nord, 3A. Grande Bibliothèque, 3B. Atelier d'Art
  maxSimultaneousZombies: 4,
  maxShadowCastingLights: 2, // 1 clair de lune directionnel + 1 lustre Grand Hall
  maxPointLights: 6,
} as const;

// Emplacements stables dans des pièces réellement praticables, jamais choisis dans les murs.
export const MANSION_HORROR_POINTS: HorrorPointSpec[] = [
  { roomId: 'vestibule', x: 16, z: 11 },
  { roomId: 'salon', x: -7, z: 14 },
  { roomId: 'grand_hall', x: 9, z: 1, requiredOpenDoorId: 'door_grand_hall' },
  { roomId: 'bibliotheque', x: -18, z: -13, requiredOpenDoorId: 'door_library_stair' },
  { roomId: 'atelier', x: 18, z: -13, requiredOpenDoorId: 'door_workshop_stair' },
];

// 2. Moteur de hauteur du manoir demi-niveau (0 m et +2,4 m)
export const MANSION_ELEVATION = {
  groundHeight: 0.0,
  plateauHeight: 2.4,
  plateauZThreshold: -7.0,
} as const;

export const MANSION_RAMPS: RampSpec[] = [
  // Escalier Ouest : Galerie (Z = -1, Y = 0) -> Bibliothèque (Z = -7, Y = 2.4)
  {
    id: 'stair_west',
    minX: -14.0,
    maxX: -10.5,
    minZ: -7.0,
    maxZ: -1.0,
    startZ: -1.0,
    endZ: -7.0,
    startY: 0.0,
    endY: 2.4,
  },
  // Escalier Est : Grand Hall (Z = -1, Y = 0) -> Atelier (Z = -7, Y = 2.4)
  {
    id: 'stair_east',
    minX: 10.5,
    maxX: 14.0,
    minZ: -7.0,
    maxZ: -1.0,
    startZ: -1.0,
    endZ: -7.0,
    startY: 0.0,
    endY: 2.4,
  },
];

/**
 * Calcule l'altitude exacte du sol en n'importe quelle coordonnée (x, z) du manoir en O(1).
 */
export function getMansionFloorHeight(x: number, z: number): number {
  if (z <= MANSION_ELEVATION.plateauZThreshold) {
    return MANSION_ELEVATION.plateauHeight;
  }
  for (const ramp of MANSION_RAMPS) {
    if (x >= ramp.minX && x <= ramp.maxX && z >= ramp.minZ && z <= ramp.maxZ) {
      const t = (z - ramp.startZ) / (ramp.endZ - ramp.startZ);
      const clampedT = Math.max(0, Math.min(1, t));
      return ramp.startY + (ramp.endY - ramp.startY) * clampedT;
    }
  }
  return MANSION_ELEVATION.groundHeight;
}

// 3. Pièces du manoir selon Option 1 (Demi-niveau)
export const MANSION_ROOMS: RoomSpec[] = [
  // SECTEUR 1 : Rez-de-chaussée Sud & Ouest (Palier 1, Y = 0)
  {
    id: 'vestibule',
    name: "Vestibule d'Entrée",
    tier: 1,
    bounds: { minX: -2.5, maxX: 23.5, minZ: 6.5, maxZ: 19.5 },
  },
  {
    id: 'salon',
    name: 'Grand Salon des Réceptions',
    tier: 1,
    bounds: { minX: -23.5, maxX: -3.5, minZ: 6.5, maxZ: 19.5 },
  },
  {
    id: 'galerie',
    name: 'Galerie Ouest',
    tier: 1,
    bounds: { minX: -23.5, maxX: -3.5, minZ: -6.5, maxZ: 5.5 },
  },
  // SECTEUR 2 : Grand Hall Nord (Palier 2, Y = 0)
  {
    id: 'grand_hall',
    name: 'Grand Hall Nord',
    tier: 2,
    bounds: { minX: -2.5, maxX: 23.5, minZ: -6.5, maxZ: 5.5 },
  },
  // SECTEUR 3 : Plateau Surélevé Nord (+2.4 m, Palier 3)
  {
    id: 'bibliotheque',
    name: 'Grande Bibliothèque',
    tier: 3,
    bounds: { minX: -23.5, maxX: -3.5, minZ: -19.5, maxZ: -7.5 },
  },
  {
    id: 'atelier',
    name: "Atelier d'Art",
    tier: 3,
    bounds: { minX: -2.5, maxX: 23.5, minZ: -19.5, maxZ: -7.5 },
  },
];

// Position initiale du joueur : fond du Vestibule Sud face au Nord
export const PLAYER_START_POSITION: Point3D = {
  x: 8.0,
  y: 1.7,
  z: 16.0,
};

// 4. Murs solides du manoir (Enceinte, soutènement, cloisons et garde-corps)
export const MANSION_WALLS: BoxCollider[] = [
  // --- Murs périphériques extérieurs (48 x 40m, épaisseur 1m, hauteur adaptée à l'élévation) ---
  { x: 0, y: 3.2, z: -20, width: 48, height: 6.4, depth: 1, materialType: 'wall' },  // Mur Nord
  { x: 0, y: 2.0, z: 20, width: 48, height: 4.0, depth: 1, materialType: 'wall' },   // Mur Sud
  { x: -24, y: 3.2, z: 0, width: 1, height: 6.4, depth: 40, materialType: 'wall' },  // Mur Ouest
  { x: 24, y: 3.2, z: 0, width: 1, height: 6.4, depth: 40, materialType: 'wall' },   // Mur Est

  // --- Ligne de démarcation Z = 6 (entre Secteur 1 et Secteur 2) ---
  // Ouvertures : Arche Salon <-> Galerie (x in [-13.75, -10.25], larg 3.5m) et Porte Grand Hall (x in [-1.75, 1.75], larg 3.5m)
  { x: -18.875, y: 2, z: 6, width: 10.25, height: 4, depth: 1, materialType: 'wall' },
  { x: -6.0, y: 2, z: 6, width: 8.5, height: 4, depth: 1, materialType: 'wall' },
  { x: 12.875, y: 2, z: 6, width: 22.25, height: 4, depth: 1, materialType: 'wall' },

  // --- Ligne de démarcation Z = -7 (Mur de soutènement et garde-corps de surplomb du plateau à +2.4m) ---
  // Ouvertures : Escalier Ouest (x in [-14.0, -10.5], larg 3.5m) et Escalier Est (x in [10.5, 14.0], larg 3.5m)
  { x: -19.0, y: 1.7, z: -7, width: 10.0, height: 3.4, depth: 1, materialType: 'wall', surface: 'wood' }, // Flanc Ouest
  { x: 0.0, y: 1.7, z: -7, width: 21.0, height: 3.4, depth: 1, materialType: 'wall', surface: 'wood' },   // Balustrade centrale de surplomb
  { x: 19.0, y: 1.7, z: -7, width: 10.0, height: 3.4, depth: 1, materialType: 'wall', surface: 'wood' },  // Flanc Est

  // --- Garde-corps latéraux des escaliers (empèchent de tomber sur les côtés entre Z = -1 et Z = -7) ---
  { x: -14.25, y: 1.7, z: -4.0, width: 0.5, height: 3.4, depth: 6.0, materialType: 'wall', surface: 'wood' }, // Escalier Ouest extérieur
  { x: -10.25, y: 1.7, z: -4.0, width: 0.5, height: 3.4, depth: 6.0, materialType: 'wall', surface: 'wood' }, // Escalier Ouest intérieur
  { x: 10.25, y: 1.7, z: -4.0, width: 0.5, height: 3.4, depth: 6.0, materialType: 'wall', surface: 'wood' },  // Escalier Est intérieur
  { x: 14.25, y: 1.7, z: -4.0, width: 0.5, height: 3.4, depth: 6.0, materialType: 'wall', surface: 'wood' },  // Escalier Est extérieur

  // --- Colonne vertébrale centrale X = -3 (séparation Est/Ouest) ---
  // Secteur 1 : Arches Vestibule <-> Salon à z = 9.5m (z in [7.75, 11.25]) et z = 16.5m (z in [14.75, 18.25])
  { x: -3, y: 2, z: 6.875, width: 1, height: 4, depth: 1.75, materialType: 'wall' },
  { x: -3, y: 2, z: 13.0, width: 1, height: 4, depth: 3.5, materialType: 'wall' },
  { x: -3, y: 2, z: 19.125, width: 1, height: 4, depth: 1.75, materialType: 'wall' },

  // Secteur 2 : Galerie <-> Grand Hall, ouverture pour grille de retour à z = -1.0m (z in [-3.0, 1.0])
  { x: -3, y: 2, z: 3.5, width: 1, height: 4, depth: 5.0, materialType: 'wall' },
  { x: -3, y: 2, z: -5.0, width: 1, height: 4, depth: 4.0, materialType: 'wall' },

  // Secteur 3 : Grande arcade Bibliothèque <-> Atelier à +2.4m, ouverte à z = -14m (z in [-16.0, -12.0], larg 4.0m)
  { x: -3, y: 4.4, z: -9.5, width: 1, height: 4, depth: 5.0, materialType: 'wall' },
  { x: -3, y: 4.4, z: -18.0, width: 1, height: 4, depth: 4.0, materialType: 'wall' },

  // --- Mobilier solide et obstacles tactiques (dégagement >= 3.5m tout autour) ---
  // 1B. Grand Salon : Cheminée monumentale en pierre
  { x: -14, y: 1.5, z: 13, width: 2.4, height: 3.0, depth: 4.0, materialType: 'obstacle' },

  // 1C. Galerie Ouest : Piédestal de sculpture adossé au mur ouest
  { x: -18, y: 1.2, z: 0.0, width: 2.4, height: 2.4, depth: 2.4, materialType: 'obstacle', surface: 'stone' },

  // 2. Grand Hall Nord : Deux colonnes monumentales bordant l'allée centrale (dégagement complet devant l'escalier Est)
  { x: 5.0, y: 2.0, z: -2.5, width: 1.4, height: 4.0, depth: 1.4, materialType: 'obstacle', surface: 'stone' },
  { x: 5.0, y: 2.0, z: 2.5, width: 1.4, height: 4.0, depth: 1.4, materialType: 'obstacle', surface: 'stone' },

  // 3A. Grande Bibliothèque (+2.4m) : Deux rangées de rayonnages hauts
  { x: -13, y: 4.2, z: -12.0, width: 7.0, height: 3.6, depth: 1.2, materialType: 'obstacle', surface: 'books' },
  { x: -13, y: 4.2, z: -16.0, width: 7.0, height: 3.6, depth: 1.2, materialType: 'obstacle', surface: 'books' },

  // 3B. Atelier d'Art (+2.4m) : Établi et générateur industriel
  { x: 12, y: 3.6, z: -14.0, width: 3.2, height: 2.4, depth: 3.2, materialType: 'obstacle', surface: 'workbench' },
];

// 5. Portes de progression et accès du manoir demi-niveau
export const MANSION_DOORS: DoorSpec[] = [
  // Progression Palier 1 -> 2 : Accès principal du Grand Hall Nord
  {
    id: 'door_grand_hall',
    x: 0,
    z: 6,
    passageWidth: 3.5,
    name: 'Grand Hall Nord',
    type: 'sector_access',
    unlockAfterTier: 1,
    axis: 'X',
  },
  // Raccourci secondaire de retour : Grille Galerie <-> Grand Hall
  {
    id: 'shortcut_hall_galerie',
    x: -3,
    z: -1,
    passageWidth: 3.5,
    name: 'Grille de la Galerie',
    type: 'sector_access',
    unlockAfterTier: 1,
    axis: 'Z',
  },
  // Progression Palier 2 -> 3 : Escalier Ouest vers la Grande Bibliothèque (+2.4m)
  {
    id: 'door_library_stair',
    x: -12.25,
    z: -1.0,
    passageWidth: 3.5,
    name: 'Escalier de la Bibliothèque',
    type: 'sector_access',
    unlockAfterTier: 2,
    axis: 'X',
  },
  // Raccourci secondaire Palier 2 -> 3 : Escalier Est vers l'Atelier (+2.4m)
  {
    id: 'door_workshop_stair',
    x: 12.25,
    z: -1.0,
    passageWidth: 3.5,
    name: "Escalier de l'Atelier",
    type: 'sector_access',
    unlockAfterTier: 2,
    axis: 'X',
  },
  // Limite permanente : Porte monumentale de sortie du manoir (condamnée définitivement)
  {
    id: 'door_mansion_exit',
    x: 0,
    y: 2.4,
    z: -19.5,
    passageWidth: 3.5,
    name: 'Sortie du Manoir',
    type: 'permanent_limit',
    unlockAfterTier: Infinity,
    axis: 'X',
  },
];

// 6. Graphe de navigation 3D (Tous les nœuds sont physiquement praticables pour un rayon de 0.40m)
export const MANSION_WAYPOINTS: Point3D[] = [
  // --- Secteur 1 : Vestibule d'Entrée (Y = 1.0) ---
  { x: 8, y: 1.0, z: 16 },    // Zone départ
  { x: 0, y: 1.0, z: 16 },
  { x: 16, y: 1.0, z: 16 },
  { x: 8, y: 1.0, z: 11 },    // Centre Vestibule
  { x: 0, y: 1.0, z: 9.5 },   // Abords arcade nord
  { x: 0, y: 1.0, z: 7.5 },   // Abords porte Grand Hall (z=6)
  { x: 16, y: 1.0, z: 10 },

  // --- Secteur 1 : Grand Salon (Y = 1.0) ---
  { x: -8, y: 1.0, z: 16.5 }, // Abords arcade sud
  { x: -14, y: 1.0, z: 17 },  // Sud cheminée
  { x: -20, y: 1.0, z: 13 },  // Ouest cheminée
  { x: -8, y: 1.0, z: 13 },   // Est cheminée
  { x: -14, y: 1.0, z: 9 },   // Nord cheminée
  { x: -8, y: 1.0, z: 9.5 },  // Abords arcade nord
  { x: -12, y: 1.0, z: 7.5 }, // Abords passage Galerie (z=6)

  // --- Arches de liaison Secteur 1 (Y = 1.0) ---
  { x: -3, y: 1.0, z: 16.5 }, // Arcade Sud
  { x: -3, y: 1.0, z: 9.5 },  // Arcade Nord

  // --- Passage Salon <-> Galerie (Y = 1.0) ---
  { x: -12, y: 1.0, z: 6.0 },

  // --- Secteur 1 : Galerie Ouest (Y = 1.0) ---
  { x: -12, y: 1.0, z: 3.0 },
  { x: -18, y: 1.0, z: 2.0 },  // Nord piédestal
  { x: -18, y: 1.0, z: -2.0 }, // Sud piédestal
  { x: -12.25, y: 1.0, z: 0.5 },// Abords pied escalier ouest
  { x: -5.5, y: 1.0, z: -1.0 },// Abords grille Grand Hall

  // --- Secteur 2 : Grand Hall Nord (Y = 1.0) ---
  { x: 0, y: 1.0, z: 4.5 },   // Entrée depuis porte Grand Hall
  { x: 0, y: 1.0, z: 0.0 },   // Allée centrale (emplacement fusil à pompe)
  { x: 9, y: 1.0, z: 2.5 },
  { x: 17, y: 1.0, z: 0.0 },  // Flanc Est
  { x: 9, y: 1.0, z: -3.0 },
  { x: 0, y: 1.0, z: -2.5 },
  { x: -0.5, y: 1.0, z: -1.0 },

  // --- Point de passage central Grand Hall (Y = 1.0) ---
  { x: 0, y: 1.0, z: -1.0 },

  // --- Escalier Ouest (Galerie -> Bibliothèque) ---
  { x: -12.25, y: 1.6, z: -2.5 }, // Entrée escalier (au-delà de la porte)
  { x: -12.25, y: 2.2, z: -4.5 }, // Mi-pente (Y = 1.4)
  { x: -12.25, y: 3.4, z: -6.5 }, // Sommet de l'escalier (Y = 2.2)

  // --- Escalier Est (Grand Hall -> Atelier) ---
  { x: 12.25, y: 1.6, z: -2.5 },  // Entrée escalier (au-delà de la porte)
  { x: 12.25, y: 2.2, z: -4.5 },  // Mi-pente (Y = 1.4)
  { x: 12.25, y: 3.4, z: -6.5 },  // Sommet de l'escalier (Y = 2.2)

  // --- Secteur 3 : Grande Bibliothèque (+2.4m, Y = 3.4) ---
  { x: -12.25, y: 3.4, z: -9.5 }, // Débouché escalier ouest
  { x: -19, y: 3.4, z: -14 },     // Allée Ouest
  { x: -7, y: 3.4, z: -14 },      // Allée centrale
  { x: -13, y: 3.4, z: -18 },     // Fond bibliothèque

  // --- Secteur 3 : Atelier d'Art (+2.4m, Y = 3.4) ---
  { x: 12.25, y: 3.4, z: -9.5 },  // Débouché escalier est
  { x: 6, y: 3.4, z: -14 },       // Allée Ouest
  { x: 18, y: 3.4, z: -14 },      // Flanc Est
  { x: 12, y: 3.4, z: -18 },      // Fond atelier

  // --- Grande arcade centrale Secteur 3 (+2.4m, Y = 3.4) ---
  { x: -3, y: 3.4, z: -14 },
];

// 7. Catalogue des apparitions masquées par palier
export const MANSION_SPAWNS: SpawnPoolConfig[] = [
  {
    tierNumber: 1,
    totalZombies: 4,
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -6.5, maxZ: 19.5 },
    pool: [
      // Cachettes dans le Grand Salon (masquées par le mur de refend X = -3, dist > 18m)
      { x: -20, z: 13 },
      { x: -14, z: 9 },
      { x: -8, z: 9 },
      { x: -14, z: 17 },
      // Galerie Ouest (contournement)
      { x: -18, z: 3 },
      { x: -8, z: 0 },
      // Angles Nord du Vestibule (dist > 9m, face au joueur)
      { x: 16, z: 9 },
      { x: 0, z: 8 },
      { x: 8, z: 8 },
    ],
  },
  {
    tierNumber: 2,
    totalZombies: 5,
    sectorBounds: { minX: -2.5, maxX: 23.5, minZ: -6.5, maxZ: 5.5 },
    pool: [
      // Grand Hall Nord (angles et colonnade)
      { x: 17, z: 0 },
      { x: 17, z: -4 },
      { x: 9, z: -3 },
      { x: 0, z: -4 },
      { x: 9, z: 4 },
      { x: 17, z: 4 },
    ],
  },
  {
    tierNumber: 3,
    totalZombies: 6,
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: -7.5 },
    pool: [
      // Grande Bibliothèque surélevée (derrière les rayonnages)
      { x: -19, z: -14 },
      { x: -13, z: -18 },
      { x: -7, z: -14 },
      // Atelier d'Art surélevé (derrière les établis)
      { x: 18, z: -14 },
      { x: 12, z: -18 },
      { x: 6, z: -14 },
    ],
  },
];

// 8. Ressources de survie (Trousses de soin et caisses de munitions)
// Offrandes du premier palier : accessibles depuis le Grand Salon après l'ouverture P1.
export const MANSION_UPGRADE_PEDESTALS: Point2D[] = [
  { x: -7, z: 8.5 },
  { x: -7, z: 17 },
];

export const MANSION_PICKUPS: PickupSpec[] = [
  // Soins (+30 PV)
  { type: 'medkit', x: 18, z: 16, value: 30 },   // Vestibule Sud (Y = 0)
  { type: 'medkit', x: 18, z: -3, value: 30 },   // Grand Hall Nord (Y = 0)
  { type: 'medkit', x: -19, z: -15, value: 30 }, // Grande Bibliothèque (Y = 2.4)

  // Munitions 9mm (+8 balles de réserve)
  { type: 'ammo', x: 0, z: 11, value: 8, weaponType: 'pistol' },       // Vestibule Sud
  { type: 'ammo', x: -19, z: 9, value: 8, weaponType: 'pistol' },      // Grand Salon
  { type: 'ammo', x: -18, z: 1, value: 8, weaponType: 'pistol' },      // Galerie Ouest
  { type: 'ammo', x: 16, z: 2, value: 8, weaponType: 'pistol' },       // Grand Hall Nord

  // Cartouches calibre 12 (+6 cartouches de fusil à pompe)
  { type: 'ammo', x: -14, z: -14, value: 6, weaponType: 'shotgun' },   // Bibliothèque (Palier 3)
  { type: 'ammo', x: 14, z: -14, value: 6, weaponType: 'shotgun' },    // Atelier (Palier 3)
];
