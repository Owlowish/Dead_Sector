// Partagé par le HUD et son aperçu ; chaque pose est une cellule native de 32 px.
export const heartAnimation = {
  asset: '/assets/ui/gothic/heart-beat-v2.png',
  frameSize: 32,
  frameCount: 4,
  cycleSeconds: 1.4,
  poses: [
    { frame: 0, duration: 1.16 },
    { frame: 1, duration: 0.08 },
    { frame: 2, duration: 0.08 },
    { frame: 3, duration: 0.08 },
  ],
} as const;

export function getHeartFrame(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  let time = elapsedSeconds % heartAnimation.cycleSeconds;
  for (const pose of heartAnimation.poses) {
    if (time < pose.duration) return pose.frame;
    time -= pose.duration;
  }
  return 0;
}
