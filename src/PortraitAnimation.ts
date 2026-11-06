/** Poses et ancrages du Maître du Portrait ; utilisés par le jeu et son aperçu. */
export const portraitConfig = { width: 2.6, height: 2.6 } as const;

export const portraitAnimation = {
  walkPoseDuration: 0.24,
  poses: [
    'idle', 'walk-a', 'walk-b', 'blades-windup', 'blades-windup-b',
    'blades-release', 'blades-followthrough', 'tear-windup', 'tear-windup-b', 'tear-release', 'recovery',
    'phase2-idle', 'phase2-walk-a', 'phase2-walk-b', 'phase2-blades-windup', 'phase2-blades-windup-b',
    'phase2-blades-release', 'phase2-blades-followthrough', 'phase2-tear-windup', 'phase2-tear-windup-b',
    'phase2-tear-release', 'phase2-recovery', 'sweep-windup', 'sweep-release',
    'transform-a', 'transform-b', 'transform-c', 'death',
  ] as const,
};

export type PortraitPose = (typeof portraitAnimation.poses)[number];

export const portraitSprite = {
  width: 384,
  height: 384,
  groundY: 360,
  // Masque seul, hors perruque et mains ; pixels384, origine en haut à gauche.
  heads: {
    'idle.png': [[195, 104, 229, 151]],
    'walk-a.png': [[191, 109, 231, 152]],
    'walk-b.png': [[191, 96, 230, 141]],
    'blades-windup.png': [[185, 93, 228, 134]],
    'blades-windup-b.png': [[186, 92, 229, 134]],
    'blades-release.png': [[199, 93, 234, 139]],
    'blades-followthrough.png': [[212, 115, 249, 166]],
    'tear-windup.png': [[210, 123, 246, 171]],
    'tear-windup-b.png': [[213, 149, 249, 197]],
    'tear-release.png': [[214, 157, 248, 202]],
    'recovery.png': [[191, 144, 226, 191]],
    'phase2-idle.png': [[268, 115, 300, 157]],
    'phase2-walk-a.png': [[263, 143, 293, 186]],
    'phase2-walk-b.png': [[277, 122, 308, 162]],
    'phase2-blades-windup.png': [[262, 114, 293, 156]],
    'phase2-blades-windup-b.png': [[247, 106, 279, 139]],
    'phase2-blades-release.png': [[281, 128, 312, 172]],
    'phase2-blades-followthrough.png': [[281, 159, 310, 201]],
    'phase2-tear-windup.png': [[268, 159, 299, 200]],
    'phase2-tear-windup-b.png': [[264, 180, 292, 219]],
    'phase2-tear-release.png': [[271, 188, 304, 225]],
    'phase2-recovery.png': [[210, 153, 239, 197]],
    'sweep-windup.png': [[230, 123, 255, 163]],
    'sweep-release.png': [[293, 143, 320, 182]],
    'transform-a.png': [[219, 107, 251, 155]],
    'transform-b.png': [[238, 96, 271, 144]],
    'transform-c.png': [[270, 144, 301, 186]],
    'death.png': [],
  } as Record<string, [number, number, number, number][]>,
} as const;

export const portraitGroundOffsetY = portraitConfig.height * (portraitSprite.groundY / portraitSprite.height - 0.5);
