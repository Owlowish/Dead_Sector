import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const { Game } = await import('../src/Game.ts');
const { Player } = await import('../src/Player.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');
const { PLAYER_START_POSITION } = await import('../src/MansionConfig.ts');

// Exercer les vraies méthodes sans construire le moteur WebGL/audio dans Node.
const player = Object.create(Player.prototype);
Object.assign(player, {
  keys: new Set(['KeyW']), health: 0, maxHealth: 120,
  camera: new THREE.PerspectiveCamera(58), level: { getFloorHeightAt: () => 0 },
  eyeHeight: 1.7, normalFov: 75, aimedFov: 58,
  yaw: 1, pitch: 1, recoilPitch: 1, recoilYaw: 1, recoilRoll: 1,
});
player.resetForDebug();
assert.equal(player.getHealth(),120);
assert.deepEqual(player.camera.position.toArray(),[PLAYER_START_POSITION.x,1.7,PLAYER_START_POSITION.z]);
assert.equal(player.keys.size,0);
assert.equal(player.camera.fov,75);
assert.equal(player.yaw,0);

const game = Object.create(Game.prototype);
let disposedEnemies=0, disposedProjectiles=0, disposedDrops=0, disposedShells=0, clearedEffects=0, respawns=0;
const enemies=()=>[{dispose(){disposedEnemies++;}}];
Object.assign(game, {
  scene:new THREE.Scene(), player,
  level:{getDoors:()=>[]}, encounterConfigs:ENCOUNTER_CONFIGS,
  zombies:enemies(), spitProjectiles:[{dispose(){disposedProjectiles++;}}],
  ammoDrops:[{dispose(){disposedDrops++;}}], shellCasings:[{dispose(){disposedShells++;}}],
  hitEffects:{clear(){clearedEffects++;}},
  weapon:{cancelReload(){},setTargets(targets){assert.equal(targets.length,0);}},
  tierDiagnostics:{startTier(){}},
  gameOverDisplay:{hidden:false}, victoryDisplay:{hidden:false}, damageOverlay:{style:{opacity:'1'}},
  state:'lost', currentTier:7, pendingTierStart:7, respiteTimer:9, tierCrawlerSpawned:2,
  debugMenuOpen:true, disposed:false,
  respawnPickups(){respawns++;},updateObjectiveDisplay(){},updateHealthDisplay(){},updateAmmoDisplay(){},
  setDebugMenuOpen(open){this.debugMenuOpen=open;},
});
for(const tier of [4,7,1,4]){
  game.pendingTierStart=7;game.respiteTimer=9;game.tierCrawlerSpawned=2;
  game.jumpToDebugTier(tier);
  assert.equal(game.currentTier,tier);
  assert.equal(game.spawnQueue,ENCOUNTER_CONFIGS[tier-1].totalZombies);
  assert.equal(game.tierCrawlerSpawned,0,'le quota de Rampeuses doit repartir à zéro à chaque saut');
  assert.equal(game.pendingTierStart,0,'aucun ancien palier ne doit repartir après le saut');
  assert.equal(game.respiteTimer,0);
  assert.equal(game.state,'playing');
  assert.equal(game.debugMenuOpen,false);
  assert.equal(game.gameOverDisplay.hidden,true);
  assert.equal(game.victoryDisplay.hidden,true);
}
assert.equal(disposedEnemies,1);assert.equal(disposedProjectiles,1);
assert.equal(disposedDrops,1);assert.equal(disposedShells,1);
assert.equal(clearedEffects,4);assert.equal(respawns,4);
for(const tier of [0,8,1.5,NaN]){game.jumpToDebugTier(tier);assert.equal(game.currentTier,4);}
assert.equal(respawns,4,'une entrée invalide ne doit rien réinitialiser');
game.debugMenuOpen=true;assert.equal(game.isSimulationActive(),false);
game.debugMenuOpen=false;assert.equal(game.isSimulationActive(),true);
console.log('Debug : sauts répétés, quotas/file/accalmie réinitialisés, nettoyage, joueur restauré et pause : OK');
