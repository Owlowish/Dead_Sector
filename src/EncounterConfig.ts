/**
 * DEAD SECTOR — Configuration centralisée des rencontres (Paliers de combat).
 * Découple la progression des rencontres de l'ouverture des secteurs du manoir.
 * Version F1 : 4 rencontres (Paliers 1 à 3 d'ouverture progressive + Palier 4 en manoir complet ouvert).
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
  /** Quota d'ennemis agiles (Coureurs) sur l'ensemble de la rencontre */
  maxAgile: number;
  /** Plafond d'agiles simultanément vivants dans l'arène */
  maxSimultaneousAgile: number;
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
 * Cachettes réparties dans l'ensemble du manoir pour le Palier 4 (Manoir Ouvert).
 * Couvre le Secteur 1 (Salon, Galerie, Vestibule), le Secteur 2 (Grand Hall) et le Secteur 3 (Bibliothèque, Atelier).
 */
const ENCOUNTER_4_SPAWN_POOL: Point2D[] = [
  // Secteur 1 : Grand Salon (masqué derrière la cheminée et le refend)
  { x: -20, z: 13 },
  { x: -14, z: 9 },
  { x: -14, z: 17 },
  // Secteur 1 : Galerie Ouest
  { x: -18, z: 3 },
  { x: -8, z: 0 },
  // Secteur 1 : Angles Vestibule
  { x: 16, z: 9 },
  // Secteur 2 : Grand Hall Nord (angles et colonnade)
  { x: 17, z: 0 },
  { x: 17, z: -4 },
  { x: 9, z: -3 },
  { x: 0, z: -4 },
  // Secteur 3 : Grande Bibliothèque haute (+2,4 m)
  { x: -19, z: -14 },
  { x: -13, z: -18 },
  // Secteur 3 : Atelier d'Art haut (+2,4 m)
  { x: 18, z: -14 },
  { x: 12, z: -18 },
];

export const ENCOUNTER_CONFIGS: EncounterSpec[] = [
  // RENCONTRE 1 : Apprendre le tir, le rechargement et la boucle du Secteur 1
  {
    tierNumber: 1,
    name: 'Incursion Initiale',
    sectorName: 'VESTIBULE, SALON & GALERIE',
    totalZombies: 4,
    maxAgile: 0,
    maxSimultaneousAgile: 0,
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
    maxAgile: 2,
    maxSimultaneousAgile: 1,
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
    maxAgile: 3,
    maxSimultaneousAgile: 2,
    unlockSectorTier: null, // Manoir entièrement accessible
    activationType: 'wing_gate',
    explorationPrompt: 'MANOIR TOTALEMENT SÉCURISÉ · ACTIVEZ LE CARILLON DU GRAND HALL',
    sectorBounds: MANSION_SPAWNS[2].sectorBounds,
    spawnPool: MANSION_SPAWNS[2].pool,
  },
  // RENCONTRE 4 (Validation F1) : Réutilisation du manoir ouvert sans nouvelle aile
  {
    tierNumber: 4,
    name: 'Patrouille Combinée',
    sectorName: 'MANOIR OUVERT (TOUS SECTEURS)',
    totalZombies: 4,
    maxAgile: 2,
    maxSimultaneousAgile: 2,
    unlockSectorTier: null, // Pas de nouveau secteur, l'enceinte entière est libre
    activationType: 'arena_signal',
    explorationPrompt: 'TENTATIVE COMPLÉTÉE · PROTOTYPE DE COMBAT PURGÉ',
    sectorBounds: { minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 },
    spawnPool: ENCOUNTER_4_SPAWN_POOL,
  },
];
