/** Chronologie commune au jeu et à l'aperçu ; Weapon conserve l'événement de dégâts. */
export const axeAttack = {
  windup: 0.48, impactTime: 0.62, duration: 1.45,
  range: 2.05, damage: 55, stunSeconds: 0.85,
} as const;
export const axeAssets = {
  idle: '/assets/weapons/axe/idle.png',
  lift: '/assets/weapons/axe/lift.png',
  overhead: '/assets/weapons/axe/overhead.png',
  chop: '/assets/weapons/axe/chop.png',
  impact: '/assets/weapons/axe/impact.png',
} as const;
export const axeAsset = axeAssets.idle;
export type AxeFrame = keyof typeof axeAssets;

// Repère de cadrage commun, indépendant des coordonnées de chaque sprite.
export const axeRigAnchor = { grip: [210.5, 255], span: 90.67 } as const;
const armedGrip = [204, 350] as const;
const armedFerrule = [207, 204] as const;
const armedReach = Math.hypot(armedFerrule[0] - armedGrip[0], armedFerrule[1] - armedGrip[1]);

// La direction et la longueur prise–fer sont mesurées sur chaque dessin.
// L'alignement du vecteur garde la ferrure à la même place aux raccords.
function frameGeometry(grip: readonly [number, number], ferrule: readonly [number, number], height = 384) {
  const dx = ferrule[0] - grip[0];
  const dy = grip[1] - ferrule[1];
  return { height, grip, ferrule, span: 91 * Math.hypot(dx, dy) / armedReach, bakedRoll: Math.atan2(dx, dy) * 180 / Math.PI };
}

export const axeFrameGeometry = {
  idle: frameGeometry([149, 282], [328, 202]),
  lift: frameGeometry([187, 234], [305.5, 100.5]),
  overhead: frameGeometry(armedGrip, armedFerrule, 576),
  chop: frameGeometry([204.5, 268.5], [198, 114]),
  impact: frameGeometry([199, 318.5], [184.5, 221.5]),
} as const;
function gripPivot(frame: AxeFrame): readonly [number, number] {
  const value = axeFrameGeometry[frame];
  return [value.grip[0] / 384 * 100, value.grip[1] / value.height * 100];
}
export const axeGripPivots: Record<AxeFrame, readonly [number, number]> = {
  idle: gripPivot('idle'), lift: gripPivot('lift'), overhead: gripPivot('overhead'),
  chop: gripPivot('chop'), impact: gripPivot('impact'),
};
// x/y : déplacement depuis le repère commun, en vh. Roll : angle du manche par rapport à la verticale.
export interface AxePose { x: number; y: number; scale: number; roll: number; phase: string; frame: AxeFrame }
interface AxeKey extends Omit<AxePose, 'roll'> { time: number; roll?: number }
const rest: AxePose = { x: 0, y: -1.5, scale: 0.93, roll: axeFrameGeometry.idle.bakedRoll, phase: 'repos', frame: 'idle' };
export const axeMotionKeys: readonly AxeKey[] = [
  { ...rest, time: 0, phase: 'préparation' },
  { time: 0.12, x: -7, y: 2, scale: 1.2, roll: 54, frame: 'idle', phase: 'préparation' },
  { time: 0.12, x: -7, y: 2, scale: 1.2, roll: 54, frame: 'lift', phase: 'levée' },
  { time: 0.28, x: -12, y: -17, scale: 1.5, roll: 30, frame: 'lift', phase: 'levée' },
  { time: 0.28, x: -12, y: -17, scale: 1.5, roll: 30, frame: 'overhead', phase: 'levée' },
  { time: axeAttack.windup, x: -19, y: -53, scale: 1.5, frame: 'overhead', phase: 'armée' },
  { time: 0.525, x: -19, y: -13, scale: 1.2, frame: 'overhead', phase: 'frappe' },
  { time: 0.525, x: -19, y: -13, scale: 1.2, frame: 'chop', phase: 'frappe' },
  { time: 0.58, x: -19, y: 3.5, scale: 0.75, frame: 'chop', phase: 'frappe' },
  { time: 0.58, x: -19, y: 3.5, scale: 0.75, frame: 'impact', phase: 'frappe' },
  { time: axeAttack.impactTime, x: -19, y: 4, scale: 0.65, frame: 'impact', phase: 'impact' },
  { time: 0.66, x: -19, y: 4, scale: 0.65, frame: 'impact', phase: 'retour du choc' },
  { time: 0.72, x: -19, y: 0, scale: 0.67, frame: 'impact', phase: 'récupération' },
  { time: 0.92, x: -15, y: 3.5, scale: 0.75, frame: 'impact', phase: 'récupération' },
  { time: 0.92, x: -15, y: 3.5, scale: 0.75, frame: 'chop', phase: 'récupération' },
  { time: 1.10, x: -7, y: -4, scale: 1, frame: 'chop', phase: 'récupération' },
  { time: 1.10, x: -7, y: -4, scale: 1, frame: 'overhead', phase: 'récupération' },
  { time: 1.19, x: -9, y: 0, scale: 1.2, roll: 30, frame: 'overhead', phase: 'récupération' },
  { time: 1.19, x: -9, y: 0, scale: 1.2, roll: 30, frame: 'lift', phase: 'récupération' },
  { time: 1.30, x: -7, y: 2, scale: 1.2, roll: 54, frame: 'lift', phase: 'récupération' },
  { time: 1.30, x: -7, y: 2, scale: 1.2, roll: 54, frame: 'idle', phase: 'récupération' },
  { ...rest, time: axeAttack.duration },
];
export function sampleAxePose(elapsed: number): AxePose {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= axeAttack.duration) return { ...rest };
  for (let i = 1; i < axeMotionKeys.length; i++) {
    const next = axeMotionKeys[i];
    if (elapsed >= next.time) continue;
    const previous = axeMotionKeys[i - 1];
    const t = (elapsed - previous.time) / (next.time - previous.time);
    const blend = elapsed >= axeAttack.windup && elapsed < axeAttack.impactTime
      ? t * t : t * t * (3 - 2 * t);
    return {
      x: previous.x + (next.x - previous.x) * blend,
      y: previous.y + (next.y - previous.y) * blend,
      scale: previous.scale + (next.scale - previous.scale) * blend,
      roll: (previous.roll ?? 0) + ((next.roll ?? 0) - (previous.roll ?? 0)) * blend,
      frame: previous.frame, phase: previous.phase,
    };
  }
  return { ...rest };
}
