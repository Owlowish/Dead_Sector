import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { portraitSprite } from '../src/PortraitAnimation.ts';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
class Element extends EventTarget {
  style = { setProperty() {} };
  classList = { toggle() {}, add() {}, remove() {} };
}
const canvas = new Element();
const element = new Element();
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: canvas, hidden: false, hasFocus: () => true,
  querySelector: () => element, querySelectorAll: () => [element],
});
globalThis.Audio = class { volume = 1; currentTime = 0; play() { return Promise.resolve(); } };
THREE.TextureLoader.prototype.load = url => new THREE.Texture({ width: portraitSprite.width, height: portraitSprite.height, src: url });
const { Game } = await import('../src/Game.ts');
const { GuardianZombie } = await import('../src/GuardianZombie.ts');
const { Zombie, disposeAllZombieResources } = await import('../src/Zombie.ts');
const { Weapon } = await import('../src/Weapon.ts');

const scene = new THREE.Scene();
const level = {
  getFloorHeightAt: () => 0, getSolidMeshes: () => [], isColliding: () => false,
  hasLineOfSight: () => true, findNextWaypoint: (_from, to) => to,
};
const game = Object.create(Game.prototype);
Object.assign(game, { zombies: [], checkTierCompletion() {}, updateObjectiveDisplay() {}, onZombieKilled() {} });
const camera = new THREE.PerspectiveCamera(75);
const weapon = new Weapon(camera, canvas, [], [], (target, damage, shot) => game.handleWeaponHit(target, damage, shot), () => true, () => {});
weapon.unlockWeapon('shotgun');

function bossAtState(exposed) {
  const boss = new GuardianZombie(scene, level, 0, 0);
  if (exposed) {
    const player = new THREE.Vector3(0, 1.7, 8);
    for (let t = 0; t < 5 && !boss.isMaskExposed(); t += 0.01) boss.update(0.01, player, [], () => {}, () => {});
  }
  assert.equal(boss.isMaskExposed(), exposed);
  return boss;
}
function shoot(boss, weaponId, headCount) {
  // Isoler le calcul tête/corps ; check-portrait-endurance exerce le budget réel sans forçage.
  boss.damageAllowance = 240;
  game.zombies = [boss];
  weapon.unlockWeapon(weaponId);
  weapon.lastShot = -Infinity;
  weapon.getActiveWeapon().magazine = weaponId === 'pistol' ? 10 : 5;
  weapon.shotAnimationTime = Infinity;
  weapon.setTargets([boss.getMesh()]);
  const path = boss.getMesh().material.map.image.src;
  const name = path.split('/').at(-1);
  const [left, top, right, bottom] = portraitSprite.heads[name][0];
  const head = new THREE.Vector2((left + right) / 2 / portraitSprite.width, 1 - (top + bottom) / 2 / portraitSprite.height);
  let pellet = 0;
  weapon.raycaster.intersectObjects = () => [{
    object: boss.getMesh(), uv: pellet++ < headCount ? head : new THREE.Vector2(0.5, 0.12),
    point: new THREE.Vector3(0, 1.4, -4), distance: 4, face: { normal: new THREE.Vector3(0, 0, 1) },
  }];
  const before = boss.getHealth();
  weapon.shoot();
  return before - boss.getHealth();
}

for (const exposed of [false, true]) {
  for (const [weaponId, headCount, expected] of [
    ['pistol', 1, exposed ? 80 : 40], ['pistol', 0, 28],
    ['shotgun', 0, 104], ['shotgun', 8, exposed ? 192 : 96],
    ['shotgun', 3, exposed ? 137 : 101],
  ]) {
    const boss = bossAtState(exposed);
    assert.equal(shoot(boss, weaponId, headCount), expected, `${weaponId}, ${headCount} têtes, masque ${exposed ? 'exposé' : 'protégé'}`);
    assert.equal(boss.getMesh().getObjectByName('portrait-mask-guard'), undefined,
      'Aucune ferrure 3D ne recouvre le visage, masque protégé ou exposé');
    boss.dispose(scene);
  }
}

const ordinary = new Zombie(scene, level, 0, 0);
game.zombies = [ordinary];
let normalDamage = 0;
ordinary.takeDamage = amount => { normalDamage = amount; };
game.handleWeaponHit(ordinary.getMesh(), 80, { headHits: 1, bodyHits: 0, headDamage: 80, weaponId: 'pistol', impactForce: 28 });
assert.equal(normalDamage, 80, 'Le masque du boss ne modifie pas les dégâts des ennemis ordinaires');
ordinary.dispose(scene);
weapon.dispose();
GuardianZombie.disposeSharedResources();
disposeAllZombieResources();
console.log('Masque : vrais tirs Weapon → Game → boss, tête/corps et plombs mixtes, récupération et absence d’overlay sur le visage : OK.');
