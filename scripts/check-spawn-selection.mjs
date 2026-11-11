import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
const { Game } = await import('../src/Game.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const { Zombie } = await import('../src/Zombie.ts');
Zombie.warmup();

function fixture(prefer, unreachable = new Set()) {
  const paths = [], scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.7, 0); camera.updateMatrixWorld(true);
  const points = Array.from({ length: 20 }, (_, i) => ({ x: 0, z: i + 6 }));
  const level = {
    isColliding: () => false, getFloorHeightAt: () => 0, hasLineOfSight: () => false,
    findNextWaypoint(start) { paths.push(start.z); return unreachable.has(start.z) ? null : start; },
  };
  const config = { ...ENCOUNTER_CONFIGS[0], totalZombies: 20, maxActiveZombies: 8, soloOpening: false,
    maxAgile: 0, maxSpitter: 0, maxCrawler: 0, spawnPool: points, spawnGroups: undefined,
    sectorBounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
    spawnPreferences: prefer ? { standard: prefer } : undefined,
  };
  const g = Object.assign(Object.create(Game.prototype), { scene, level, player: { camera }, zombies: [],
    encounterConfigs: [config], currentTier: 1, spawnQueue: 20, killsThisTier: 0,
    lastSpawnQuadrant: -1, setupEnemyVoice() {}, updateBossDisplay() {},
  });
  return { g, paths, dispose: () => g.zombies.forEach(z => z.dispose(scene)) };
}
const originalRandom = Math.random;
try {
  // Les cinq meilleurs points VALIDES, y compris lorsque le meilleur est inaccessible.
  const f = fixture(undefined, new Set([6]));
  Math.random = () => 0.99;
  assert.equal(f.g.trySpawnZombie(), true);
  assert.equal(f.g.zombies[0].getPosition().z, 11);
  assert.deepEqual(f.paths, [6, 7, 8, 9, 10, 11], 'Pas de navigation sur les quatorze points inutiles');
  f.dispose();
  // Préférences inaccessibles : réutiliser les échecs connus et revenir aux points ordinaires.
  const p = fixture(point => point.z <= 8, new Set([6, 7, 8]));
  Math.random = () => 0;
  assert.equal(p.g.trySpawnZombie(), true);
  assert.equal(p.g.zombies[0].getPosition().z, 9);
  assert.deepEqual(p.paths, [6, 7, 8, 9, 10, 11, 12, 13], 'Échec de chemin mémorisé pendant cette sélection seulement');
  p.dispose();
  const blocked = fixture(undefined, new Set(Array.from({ length: 20 }, (_, i) => i + 6)));
  assert.equal(blocked.g.trySpawnZombie(), false, 'Aucune apparition sans chemin');
  assert.equal(blocked.g.zombies.length, 0);
} finally { Math.random = originalRandom; }
console.log('PASS : cinq meilleurs points accessibles, navigation bornée au nécessaire, repli de préférence et absence de chemin.');
