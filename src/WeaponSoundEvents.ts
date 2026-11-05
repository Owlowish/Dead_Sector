import { reloadPoses } from './WeaponAnimation.ts';
import { shotgunPump } from './ShotgunAnimation.ts';

export type WeaponMechanicalSoundId =
  | 'mag-out' | 'mag-in' | 'seat' | 'shell-insert' | 'pump-back' | 'pump-forward';

export interface WeaponSoundEvent {
  at: number;
  sound: WeaponMechanicalSoundId;
}

// Les phases visuelles restent la source des temps ; changer une durée déplace aussi son son.
const pistolPhaseSounds: Partial<Record<(typeof reloadPoses)[number]['phase'], WeaponMechanicalSoundId>> = {
  extract: 'mag-out', insert: 'mag-in', seat: 'seat',
};
let elapsed = 0;
export const pistolReloadSoundEvents: readonly WeaponSoundEvent[] = reloadPoses.flatMap(pose => {
  const sound = pistolPhaseSounds[pose.phase];
  const events = sound ? [{ at: elapsed, sound }] : [];
  elapsed += pose.duration;
  return events;
});

export const shotgunPumpSoundEvents: readonly WeaponSoundEvent[] = [
  { at: shotgunPump.backAt, sound: 'pump-back' },
  { at: shotgunPump.forwardAt, sound: 'pump-forward' },
];

/** Intervalle ouvert à gauche : une frontière franchie ne se répète pas à l'image suivante. */
export function crossedWeaponSoundEvents(events: readonly WeaponSoundEvent[], previous: number, next: number): readonly WeaponSoundEvent[] {
  if (!Number.isFinite(previous) || !Number.isFinite(next) || next <= previous) return [];
  return events.filter(event => previous < event.at && event.at <= next);
}
