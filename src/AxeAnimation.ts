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
// Prises relevées sur les pixels : même centre et même écart projetés au raccord.
// Le manche armé dispose de 192 px supplémentaires au-dessus de l'ancien canevas.
export const axeFrameGeometry = {
  idle: { height: 384, grip: [210.5, 255], span: 90.67 },
  lift: { height: 384, grip: [211, 236], span: 104 },
  overhead: { height: 576, grip: [204, 350], span: 91 },
  chop: { height: 384, grip: [207.5, 268.5], span: 86.98 },
  impact: { height: 384, grip: [205, 318.5], span: 59.54 },
} as const;
function gripPivot(frame: AxeFrame): readonly [number, number] {
  const value = axeFrameGeometry[frame];
  return [value.grip[0] / 384 * 100, value.grip[1] / value.height * 100];
}
export const axeGripPivots: Record<AxeFrame, readonly [number, number]> = {
  idle: gripPivot('idle'), lift: gripPivot('lift'), overhead: gripPivot('overhead'),
  chop: gripPivot('chop'), impact: gripPivot('impact'),
};
// x/y : déplacement commun du centre des prises depuis le repos, en vh.
// scale : écart entre les mains relatif au repos, indépendant du cadrage du sprite.
export interface AxePose { x: number; y: number; scale: number; phase: string; frame: AxeFrame }
interface AxeKey extends AxePose { time: number }
export const axeMotionKeys: readonly AxeKey[] = [
  { time: 0, x: 0, y: 0, scale: 1, frame: 'idle', phase: 'préparation' },
  { time: 0.12, x: -3, y: -2, scale: 1, frame: 'idle', phase: 'préparation' },
  { time: 0.12, x: -3, y: -2, scale: 1, frame: 'lift', phase: 'levée' },
  { time: 0.28, x: -12, y: -25, scale: 1.5, frame: 'lift', phase: 'levée' },
  { time: 0.28, x: -12, y: -25, scale: 1.5, frame: 'overhead', phase: 'levée' },
  { time: axeAttack.windup, x: -19, y: -53, scale: 1.5, frame: 'overhead', phase: 'armée' },
  { time: 0.525, x: -19, y: -20.5, scale: 1.2, frame: 'overhead', phase: 'frappe' },
  { time: 0.525, x: -19, y: -20.5, scale: 1.2, frame: 'chop', phase: 'frappe' },
  { time: 0.58, x: -19, y: -4, scale: 0.75, frame: 'chop', phase: 'frappe' },
  { time: 0.58, x: -19, y: -4, scale: 0.75, frame: 'impact', phase: 'frappe' },
  { time: axeAttack.impactTime, x: -19, y: -1, scale: 0.65, frame: 'impact', phase: 'impact' },
  { time: 0.66, x: -19, y: -1, scale: 0.65, frame: 'impact', phase: 'retour du choc' },
  { time: 0.72, x: -19, y: -3, scale: 0.67, frame: 'impact', phase: 'récupération' },
  { time: 0.92, x: -15, y: -4, scale: 0.75, frame: 'impact', phase: 'récupération' },
  { time: 0.92, x: -15, y: -4, scale: 0.75, frame: 'chop', phase: 'récupération' },
  { time: 1.10, x: -7, y: -4, scale: 1, frame: 'chop', phase: 'récupération' },
  { time: 1.10, x: -7, y: -4, scale: 1, frame: 'lift', phase: 'récupération' },
  { time: 1.30, x: -2, y: -1, scale: 1, frame: 'lift', phase: 'récupération' },
  { time: 1.30, x: -2, y: -1, scale: 1, frame: 'idle', phase: 'récupération' },
  { time: axeAttack.duration, x: 0, y: 0, scale: 1, frame: 'idle', phase: 'repos' },
];
const rest: AxePose = { x: 0, y: 0, scale: 1, phase: 'repos', frame: 'idle' };
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
      frame: previous.frame, phase: previous.phase,
    };
  }
  return { ...rest };
}
