/**
 * DEAD SECTOR — Configuration centralisée des rencontres (Paliers de combat).
 * Découple la progression des rencontres de l'ouverture des secteurs du manoir.
 * Paliers 1 à 3 d'ouverture, 4 à 7 en manoir ouvert, puis rencontre finale.
 */

import type { Point2D } from './MansionConfig.ts';
import { MANSION_SPAWNS } from './MansionConfig.ts';
import type { ZombieKind } from './ZombieRemains.ts';

type SpawnPreferences = Partial<Record<ZombieKind, (point: Point2D, floor: number) => boolean>>;

export interface EncounterSpawnGroup {
  standard: number;
  /** Les escortes des Cracheurs sont comprises dans ce quota. */
  agile: number;
  spitter: number;
  crawler: number;
  /** Délai actif après élimination définitive du groupe, avant le suivant. */
  pauseAfterSeconds?: number;
  spawnPreferences?: SpawnPreferences;
}

export interface EncounterSpec {
  /** Numéro du palier / rencontre (1-indexé) */
  tierNumber: number;
  /** Nom descriptif de la rencontre */
  name: string;
  /** Secteur géographique principal du combat */
  sectorName: string;
  /** Nombre total d'ennemis à éliminer pour valider la rencontre */
  totalZombies: number;
  /** Menaces actives, y compris les Coureurs en relève, pour cette rencontre. */
  maxActiveZombies: number;
  /** Quota d'ennemis agiles (Coureurs) sur l'ensemble de la rencontre */
  maxAgile: number;
  /** Plafond d'agiles simultanément vivants dans l'arène */
  maxSimultaneousAgile: number;
  /** Cracheurs prévus dans la rencontre et plafond présents simultanément */
  maxSpitter: number;
  maxSimultaneousSpitter: number;
  /** Rampeurs (Crawlers) prévus dans la rencontre et plafond simultané */
  maxCrawler?: number;
  maxSimultaneousCrawler?: number;
  /** Nombre d'ennemis envoyés lors de la salve d'ouverture initiale */
  openingSpawns?: number;
  openingLead?: ZombieKind;
  /** Maintient la première menace seule jusqu'à son élimination définitive. */
  soloOpening?: boolean;
  /** Éliminations définitives requises avant d'introduire un type. */
  spawnUnlocks?: { agile?: number; spitter?: number; crawler?: number };
  /** Groupes successifs ; leur somme respecte les quotas totaux du palier. */
  spawnGroups?: EncounterSpawnGroup[];
  /** Rencontre de clôture, duel sans renfort contre le Maître du Portrait. */
  finalEncounter?: boolean;
  /** Secteur déverrouillé à l'issue de cette rencontre (null si le manoir est déjà complètement ouvert) */
  unlockSectorTier: number | null;
  /** Type de transition pour déclencher la rencontre après l'accalmie */
  activationType: 'auto_start' | 'wing_gate' | 'arena_signal';
  /** Texte d'orientation affiché sur le HUD pendant la phase d'exploration */
  explorationPrompt: string;
  /** Limites d'espace pour la sélection des apparitions */
  sectorBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  /** Pool de points d'apparition candidats */
  spawnPool: Point2D[];
  fallbackSpawnPool?: readonly Point2D[];
  spawnPreferences?: SpawnPreferences;
}

/**
 * Pool étendu de points d'apparition candidats dans l'ensemble du manoir ouvert (Paliers 4 à 8).
 * Couvre équitablement les 4 points cardinaux et les deux niveaux (+0m et +2.4m) :
 * - Sud / Sud-Ouest : Grand Salon (masqué par le refend et la cheminée)
 * - Sud-Est : Vestibule d'entrée
 * - Ouest : Galerie Ouest et abords escalier ouest
 * - Centre / Nord : Grand Hall Nord et colonnade
 * - Nord-Ouest (+2.4m) : Grande Bibliothèque haute
 * - Nord-Est (+2.4m) : Atelier d'Art haut
 */
export const MANSION_OPEN_SPAWN_POOL: Point2D[] = [
  // 1. Grand Salon (Sud-Ouest, Y = 0m)
  { x: -20, z: 13 },
  { x: -14, z: 9 },
  { x: -14, z: 17 },
  { x: -20, z: 17 },
  { x: -8, z: 13 },

  // 2. Vestibule d'Entrée (Sud-Est, Y = 0m)
  { x: 16, z: 9 },
  { x: 8, z: 16 },
  { x: 0, z: 16 },
  { x: 16, z: 16 },

  // 3. Galerie Ouest (Ouest, Y = 0m)
  { x: -18, z: 3 },
  { x: -8, z: 0 },
  { x: -18, z: -2 },
  { x: -12, z: 3 },

  // 4. Grand Hall Nord (Centre / Nord, Y = 0m)
  { x: 17, z: 0 },
  { x: 17, z: -4 },
  { x: 9, z: -3 },
  { x: 0, z: -4 },
  { x: 9, z: 2.5 },

  // 5. Grande Bibliothèque haute (+2.4m, Nord-Ouest)
  { x: -19, z: -14 },
  { x: -13, z: -18 },
  { x: -7, z: -14 },
  { x: -12.25, z: -9.5 },

  // 6. Atelier d'Art haut (+2.4m, Nord-Est)
  { x: 18, z: -14 },
  { x: 12, z: -18 },
  { x: 6, z: -14 },
  { x: 12.25, z: -9.5 },
];

/** Alias pour rétrocompatibilité F1 */
export const ENCOUNTER_4_SPAWN_POOL: Point2D[] = MANSION_OPEN_SPAWN_POOL;

const nearRamps = ({ x, z }: Point2D) => (Math.abs(x) === 12.25 && z === -9.5) || (x === 17 && z === -4);
const inHall = ({ x, z }: Point2D, floor: number) => floor < 1 && x >= 0 && z <= 4;
const inLowerWings = ({ x, z }: Point2D, floor: number) => floor < 1 && (x <= -8 || z >= 8);
const atUpperBack = ({ z }: Point2D, floor: number) => floor >= 2 && z <= -13;

export const ENCOUNTER_CONFIGS: EncounterSpec[] = [
  // RENCONTRE 1 : Apprendre la portée et l'engagement lent de la hache, puis obtenir le pistolet.
  {
    tierNumber: 1,
    name: 'Incursion Initiale',
    sectorName: 'MUSIQUE, SALON & GALERIE',
    totalZombies: 4,
    maxActiveZombies: 3,
    maxAgile: 0,
    maxSimultaneousAgile: 0,
    maxSpitter: 0,
    maxSimultaneousSpitter: 0,
    openingSpawns: 1,
    soloOpening: true,
    unlockSectorTier: 1, // Déverrouille la porte du Grand Hall Nord
    activationType: 'auto_start',
    explorationPrompt: 'PALIER 1 PURGÉ · OUVREZ LA PORTE DU GRAND HALL',
    sectorBounds: MANSION_SPAWNS[0].sectorBounds,
    spawnPool: MANSION_SPAWNS[0].pool,
  },
  // RENCONTRE 2 : Découverte du Grand Hall et lecture des premiers Coureurs agiles
  {
    tierNumber: 2,
    name: 'Assaut du Grand Hall',
    sectorName: 'GRAND HALL NORD',
    totalZombies: 5,
    maxActiveZombies: 3,
    maxAgile: 2,
    maxSimultaneousAgile: 1,
    maxSpitter: 0,
    maxSimultaneousSpitter: 0,
    openingSpawns: 1,
    unlockSectorTier: 2, // Déverrouille les escaliers de la Bibliothèque et de l'Atelier
    activationType: 'wing_gate',
    explorationPrompt: 'PALIER 2 PURGÉ · OUVREZ LA PORTE DE LA BIBLIOTHÈQUE',
    sectorBounds: MANSION_SPAWNS[1].sectorBounds,
    spawnPool: MANSION_SPAWNS[1].pool,
  },
  // RENCONTRE 3 : Verticalité et Cracheur au pistolet ; la purge donne le fusil avant la Rampeuse.
  {
    tierNumber: 3,
    name: 'Hauteurs Gothiques',
    sectorName: 'BIBLIOTHÈQUE & ATELIER (+2,4M)',
    totalZombies: 6,
    maxActiveZombies: 4,
    maxAgile: 2,
    maxSimultaneousAgile: 2,
    maxSpitter: 1,
    maxSimultaneousSpitter: 1,
    openingSpawns: 1,
    spawnUnlocks: { agile: 2, spitter: 2 },
    unlockSectorTier: null, // Manoir entièrement accessible
    activationType: 'wing_gate',
    explorationPrompt: 'MANOIR OUVERT · PROCHAIN COMBAT APRÈS L’ACCALMIE',
    sectorBounds: MANSION_SPAWNS[2].sectorBounds,
    spawnPool: MANSION_SPAWNS[2].pool,
    fallbackSpawnPool: [
      { x: -12.25, z: -9.5 }, { x: 12.25, z: -9.5 },
      { x: -3, z: -14 }, { x: 3, z: -14 },
      { x: -18, z: -11 }, { x: 18, z: -11 },
      { x: -21, z: -18 }, { x: 21, z: -18 },
      { x: -21, z: -9.5 }, { x: 21, z: -9.5 },
    ],
  },
  // RENCONTRE 4 : Réutilisation du manoir ouvert et attaques multi-ailes (Apparition du Rampeur)
  {
    tierNumber: 4,
    name: 'Patrouille Combinée',
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 8,
    maxActiveZombies: 4,
    maxAgile: 3,
    maxSimultaneousAgile: 2,
    maxSpitter: 1,
    maxSimultaneousSpitter: 1,
    maxCrawler: 1,
    maxSimultaneousCrawler: 1,
    openingSpawns: 2,
    spawnUnlocks: { crawler: 2 },
    unlockSectorTier: null, // Pas de nouveau secteur, l'enceinte entière est libre
    activationType: 'arena_signal',
    explorationPrompt: 'PALIER 4 PURGÉ · PROCHAIN COMBAT APRÈS L’ACCALMIE',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
  },
  // RENCONTRE 5 : Alterner précision et mobilité face aux mélanges lents/agiles/rampeurs
  {
    tierNumber: 5,
    name: 'Pression & Mobilité',
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 10,
    maxActiveZombies: 5,
    maxAgile: 4,
    maxSimultaneousAgile: 2,
    maxSpitter: 2,
    maxSimultaneousSpitter: 1,
    maxCrawler: 1,
    maxSimultaneousCrawler: 1,
    openingSpawns: 3,
    openingLead: 'agile',
    unlockSectorTier: null,
    activationType: 'arena_signal',
    explorationPrompt: 'PALIER 5 PURGÉ · PROCHAIN COMBAT APRÈS L’ACCALMIE',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
    spawnPreferences: { spitter: nearRamps, agile: inLowerWings },
  },
  // RENCONTRE 6 : Anticiper les renforts échelonnés et préserver ses munitions
  {
    tierNumber: 6,
    name: 'Embuscade Échelonnée',
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 12,
    maxActiveZombies: 6,
    maxAgile: 4,
    maxSimultaneousAgile: 2,
    maxSpitter: 2,
    maxSimultaneousSpitter: 1,
    maxCrawler: 2,
    maxSimultaneousCrawler: 2,
    openingSpawns: 3,
    spawnGroups: [
      { standard: 3, agile: 2, spitter: 1, crawler: 0, pauseAfterSeconds: 3, spawnPreferences: { standard: inHall, spitter: inHall } },
      { standard: 1, agile: 2, spitter: 1, crawler: 2, spawnPreferences: { crawler: atUpperBack } },
    ],
    unlockSectorTier: null,
    activationType: 'arena_signal',
    explorationPrompt: 'PALIER 6 PURGÉ · PROCHAIN COMBAT APRÈS L’ACCALMIE',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
  },
  // RENCONTRE 7 : Maîtriser les itinéraires et l'espace avant l'épreuve finale
  {
    tierNumber: 7,
    name: "L'Épreuve d'Avant-Garde",
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 14,
    maxActiveZombies: 7,
    maxAgile: 5,
    maxSimultaneousAgile: 3,
    maxSpitter: 2,
    maxSimultaneousSpitter: 2,
    maxCrawler: 2,
    maxSimultaneousCrawler: 2,
    openingSpawns: 4,
    unlockSectorTier: null,
    activationType: 'arena_signal',
    explorationPrompt: 'PALIER 7 PURGÉ · PRÉPAREZ-VOUS À LA RENCONTRE FINALE',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
    spawnPreferences: { spitter: atUpperBack, agile: inLowerWings, crawler: inHall },
  },
  {
    tierNumber: 8,
    name: 'Le Maître du Portrait',
    sectorName: 'RENCONTRE FINALE · MANOIR OUVERT',
    finalEncounter: true,
    totalZombies: 1,
    maxActiveZombies: 1,
    maxAgile: 0,
    maxSimultaneousAgile: 0,
    maxSpitter: 0,
    maxSimultaneousSpitter: 0,
    maxCrawler: 0,
    maxSimultaneousCrawler: 0,
    openingSpawns: 1,
    unlockSectorTier: null,
    activationType: 'arena_signal',
    explorationPrompt: 'MANOIR LIBÉRÉ · TENTATIVE TERMINÉE',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
  },
];
