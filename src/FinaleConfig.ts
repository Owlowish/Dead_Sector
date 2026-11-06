export const guardianConfig = {
  health: 800,
  speed: 2.6,
  scale: 1.05,
  radius: 0.4,
  attackRange: 2.4,
  attackDamage: 24,
  attackWindup: 1.1,
  attackRecovery: 1.6,
  throwRange: 18,
  throwLockBeforeRelease: 0.35,
  throwRecovery: 2,
  secondPhaseThrowRecovery: 1.6,
  projectileSpeed: 16,
  projectileDamage: 18,
  projectileLifetime: 3,
} as const;

// Le socle Zombie conserve l'échelle et la chute partagées avec le Gardien.
export const finalEliteConfig = guardianConfig;
