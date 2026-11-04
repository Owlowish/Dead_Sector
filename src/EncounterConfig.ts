/**
 * DEAD SECTOR — Configuration centralisée des rencontres (Paliers de combat).
 * Découple la progression des rencontres de l'ouverture des secteurs du manoir.
 * Version F4 : Progression complète de 7 rencontres (Paliers 1 à 3 d'ouverture + Paliers 4 à 7 en manoir ouvert multidirectionnel).
 */

import type { Point2D } from './MansionConfig.ts';
import { MANSION_SPAWNS } from './MansionConfig.ts';

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
}

/**
 * Pool étendu de points d'apparition candidats dans l'ensemble du manoir ouvert (Paliers 4 à 7).
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

export const ENCOUNTER_CONFIGS: EncounterSpec[] = [
  // RENCONTRE 1 : Apprendre le tir, le rechargement et la boucle du Secteur 1
  {
    tierNumber: 1,
    name: 'Incursion Initiale',
    sectorName: 'VESTIBULE, SALON & GALERIE',
    totalZombies: 4,
    maxActiveZombies: 3,
    maxAgile: 0,
    maxSimultaneousAgile: 0,
    maxSpitter: 0,
    maxSimultaneousSpitter: 0,
    openingSpawns: 1,
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
    maxActiveZombies: 4,
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
  // RENCONTRE 3 : Apprentissage de la verticalité (+2,4 m) et défense des escaliers
  {
    tierNumber: 3,
    name: 'Hauteurs Gothiques',
    sectorName: 'BIBLIOTHÈQUE & ATELIER (+2,4M)',
    totalZombies: 6,
    maxActiveZombies: 4,
    maxAgile: 3,
    maxSimultaneousAgile: 2,
    maxSpitter: 1,
    maxSimultaneousSpitter: 1,
    openingSpawns: 1,
    unlockSectorTier: null, // Manoir entièrement accessible
    activationType: 'wing_gate',
    explorationPrompt: 'MANOIR TOTALEMENT SÉCURISÉ · ACTIVEZ LE CARILLON DU GRAND HALL',
    sectorBounds: MANSION_SPAWNS[2].sectorBounds,
    spawnPool: MANSION_SPAWNS[2].pool,
  },
  // RENCONTRE 4 : Réutilisation du manoir ouvert et attaques multi-ailes (Apparition du Rampeur)
  {
    tierNumber: 4,
    name: 'Patrouille Combinée',
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 8,
    maxActiveZombies: 5,
    maxAgile: 4,
    maxSimultaneousAgile: 2,
    maxSpitter: 1,
    maxSimultaneousSpitter: 1,
    maxCrawler: 2,
    maxSimultaneousCrawler: 2,
    openingSpawns: 3,
    unlockSectorTier: null, // Pas de nouveau secteur, l'enceinte entière est libre
    activationType: 'arena_signal',
    explorationPrompt: 'PALIER 4 PURGÉ · ACCALMIE · ACTIVEZ LE CARILLON POUR LE PALIER 5',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
  },
  // RENCONTRE 5 : Alterner précision et mobilité face aux mélanges lents/agiles/rampeurs
  {
    tierNumber: 5,
    name: 'Pression & Mobilité',
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 10,
    maxActiveZombies: 6,
    maxAgile: 5,
    maxSimultaneousAgile: 2,
    maxSpitter: 2,
    maxSimultaneousSpitter: 1,
    maxCrawler: 2,
    maxSimultaneousCrawler: 2,
    openingSpawns: 4,
    unlockSectorTier: null,
    activationType: 'arena_signal',
    explorationPrompt: 'PALIER 5 PURGÉ · ACCALMIE · ACTIVEZ LE CARILLON POUR LE PALIER 6',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
  },
  // RENCONTRE 6 : Anticiper les renforts échelonnés et préserver ses munitions
  {
    tierNumber: 6,
    name: 'Embuscade Échelonnée',
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 12,
    maxActiveZombies: 7,
    maxAgile: 6,
    maxSimultaneousAgile: 4,
    maxSpitter: 3,
    maxSimultaneousSpitter: 3,
    maxCrawler: 2,
    maxSimultaneousCrawler: 2,
    openingSpawns: 5,
    unlockSectorTier: null,
    activationType: 'arena_signal',
    explorationPrompt: 'PALIER 6 PURGÉ · ACCALMIE · ACTIVEZ LE CARILLON POUR LE PALIER 7',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
  },
  // RENCONTRE 7 : Maîtriser les itinéraires et l'espace avant l'épreuve finale
  {
    tierNumber: 7,
    name: "L'Épreuve d'Avant-Garde",
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 14,
    maxActiveZombies: 8,
    maxAgile: 7,
    maxSimultaneousAgile: 4,
    maxSpitter: 3,
    maxSimultaneousSpitter: 3,
    maxCrawler: 2,
    maxSimultaneousCrawler: 2,
    openingSpawns: 6,
    unlockSectorTier: null,
    activationType: 'arena_signal',
    explorationPrompt: 'TENTATIVE COMPLÉTÉE · 7 PALIERS PURGÉS · MANOIR MAÎTRISÉ',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: MANSION_OPEN_SPAWN_POOL,
  },
];
