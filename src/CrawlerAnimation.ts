/**
 * DEAD SECTOR — Configuration et chronologie des animations du Rampeur (The Crawler).
 * Partagé entre le jeu réel (CrawlerZombie.ts) et l'aperçu de validation (make-crawler-preview.mjs).
 */

// Le canevas est carré : une seule taille conserve les proportions du dessin.
const spriteSize = 1.6;

export const crawlerConfig = {
  speed: 3.5,
  health: 40,
  collisionRadius: 0.45,
  attackRange: 1.1,
  attackDamage: 12,
  attackCooldown: 1.1,
  attackWindup: 0.18,
  attackRecovery: 0.25,
  hurtDuration: 0.18,
  width: spriteSize,
  height: spriteSize,
} as const;

export const crawlerAnimation = {
  crawlPoseDuration: 0.20,
  attackDuration: 0.35,
  hurtDuration: 0.18,
  deathDuration: 0.45,
  poses: ['idle', 'crawl-a', 'crawl-b', 'attack', 'hurt', 'death'] as const,
};

export type CrawlerPose = (typeof crawlerAnimation.poses)[number];

// Coordonnées des nouvelles images exportées, origine en haut à gauche.
export const crawlerSprite = {
  width: 512,
  height: 512,
  groundY: 504,
  heads: {
    'idle.png': [[230, 278, 284, 370]],
    'crawl-a.png': [[230, 280, 284, 372]],
    'crawl-b.png': [[230, 282, 284, 374]],
    'attack.png': [[230, 290, 286, 382]],
    'hurt.png': [[230, 272, 288, 364]],
    'death.png': [],
  } as Record<string, [number, number, number, number][]>,
} as const;

// Le sol passe par les appuis dessinés, pas par le bord transparent du PNG.
export const crawlerGroundOffsetY = crawlerConfig.height * (crawlerSprite.groundY / crawlerSprite.height - 0.5);
