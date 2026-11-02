import * as THREE from 'three';

// Repères en coordonnées de cellule, communs au jeu et à l'aperçu.
export const zombieAnimation = {
  walk: { columns: 3, rows: 2, frames: 6, frameDuration: 0.14, cropTop: 0, cropHeight: 0.96 },
  attack: { columns: 4, rows: 1, frames: 4, cropTop: 0.075, cropHeight: 0.86 },
  hurt: { columns: 2, rows: 1, frames: 2, cropTop: 0.025, cropHeight: 0.9 },
  hurtDuration: 0.2,
  windup: 0.6,
  impactDuration: 0.12,
  recoveryDuration: 0.20,
} as const;

// Régions mesurées dans la planche générée : ses rangées ne sont pas régulières.
// Une densité de pixels commune conserve la taille du corps pendant sa chute.
export const zombieDeathAnimation = {
  atlasWidth: 1254,
  atlasHeight: 1254,
  pixelsPerUnit: 313.5,
  frames: [
    { x: 0, y: 0, width: 627, height: 690, groundY: 670, duration: 0.12 },
    { x: 627, y: 0, width: 627, height: 690, groundY: 670, duration: 0.14 },
    { x: 0, y: 721, width: 627, height: 439, groundY: 1150, duration: 0.14 },
    { x: 627, y: 721, width: 627, height: 439, groundY: 1150, duration: 0.16 },
  ],
  floorHeight: 0.025,
} as const;

export const zombieDeathDuration = zombieDeathAnimation.frames.reduce((sum, pose) => sum + pose.duration, 0);

export function deathFrame(time: number): number {
  let elapsed = 0;
  for (let index = 0; index < zombieDeathAnimation.frames.length; index++) {
    elapsed += zombieDeathAnimation.frames[index].duration;
    if (time < elapsed) return index;
  }
  return zombieDeathAnimation.frames.length - 1;
}

export function attackFrame(time: number): number {
  if (time < zombieAnimation.windup * 0.4) return 0;
  if (time < zombieAnimation.windup) return 1;
  if (time < zombieAnimation.windup + zombieAnimation.impactDuration) return 2;
  return 3;
}

export function atlasRegion(frame: number, atlas: { columns: number; rows: number; cropTop: number; cropHeight: number }) {
  const column = frame % atlas.columns;
  const row = Math.floor(frame / atlas.columns);
  return {
    repeatX: 1 / atlas.columns,
    repeatY: atlas.cropHeight / atlas.rows,
    offsetX: column / atlas.columns,
    // Les cellules se lisent de haut en bas, les UV Three.js partent du bas.
    offsetY: 1 - (row + atlas.cropTop + atlas.cropHeight) / atlas.rows,
  };
}

export function createAtlasFrameGeometry(
  width: number,
  height: number,
  frame: number,
  atlas: { columns: number; rows: number; cropTop: number; cropHeight: number }
): THREE.PlaneGeometry {
  const geom = new THREE.PlaneGeometry(width, height);
  const region = atlasRegion(frame, atlas);
  const uv = geom.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(
      i,
      region.offsetX + u * region.repeatX,
      region.offsetY + v * region.repeatY
    );
  }
  return geom;
}
