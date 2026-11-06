import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null, hidden: false, hasFocus: () => true,
  querySelector: () => null, querySelectorAll: () => [],
});
globalThis.Audio = class { volume = 1; currentTime = 0; play() { return Promise.resolve(); } pause() {} };
THREE.TextureLoader.prototype.load = url => new THREE.Texture({ width: 384, height: 384, src: url });
const { GuardianZombie } = await import('../src/GuardianZombie.ts');
const { Game } = await import('../src/Game.ts');
const { Weapon } = await import('../src/Weapon.ts');
const { portraitSprite } = await import('../src/PortraitAnimation.ts');
const { guardianConfig } = await import('../src/FinaleConfig.ts');
const { TierDiagnosticsTracker } = await import('../src/TierDiagnostics.ts');
const { disposeAllZombieResources } = await import('../src/Zombie.ts');

const near = new THREE.Vector3(0, 1.7, 8);
const far = new THREE.Vector3(0, 1.7, 1000);
const rate = guardianConfig.health / guardianConfig.minimumCombatDuration;
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label} : ${actual} / ${expected}`);
const fixtures = [];
function fixture() {
  const scene = new THREE.Scene();
  const level = { getFloorHeightAt: () => 0, getSolidMeshes: () => [], isColliding: () => false,
    hasLineOfSight: () => true, findNextWaypoint: (_from, to) => to };
  const cues = [], hits = [], blades = [];
  let elapsed = 0;
  const boss = new GuardianZombie(scene, level, 0, 0, { cue: event => cues.push({ ...event, time: elapsed }) });
  const result = { scene, boss, cues, hits, blades,
    step(delta, target = near) {
      if (Number.isFinite(delta) && delta > 0) elapsed += delta;
      boss.update(delta, target, [], damage => hits.push(damage), (...args) => blades.push(args));
    },
    run(seconds, target = near) {
      for (let t = 0; t < seconds - 1e-9; t += 0.01) this.step(Math.min(0.01, seconds - t), target);
    },
    get elapsed() { return elapsed; },
  };
  fixtures.push(result);
  return result;
}

// Les dommages, états et budgets ci-dessous viennent uniquement du vrai temps de simulation.
const adversarial = fixture();
adversarial.boss.takeDamage(1e9);
assert.equal(adversarial.boss.getHealth(), guardianConfig.health, 'Aucune vulnérabilité gratuite au spawn');
assert.equal(adversarial.boss.isFrameResisting(), true, 'Le cadre signale un impact absorbé');
for (const amount of [NaN, Infinity, -Infinity, 0, -2]) adversarial.boss.takeDamage(amount);
assert.equal(adversarial.boss.getHealth(), guardianConfig.health, 'Les dégâts invalides ne modifient pas la vie');
for (let frame = 0; frame < 11999; frame++) {
  adversarial.step(0.01);
  // Plusieurs impacts immédiats simulent un burst supérieur à toute arme disponible.
  adversarial.boss.takeDamage(1e9, true);
  adversarial.boss.takeDamage(1e9);
  assert.ok(guardianConfig.health - adversarial.boss.getHealth() <= rate * adversarial.elapsed + 1e-6,
    'Les dégâts cumulés ne dépassent jamais le temps actif disponible');
  assert.equal(adversarial.boss.isAlive(), true, 'Aucun burst ne tue avant 120 secondes');
}
close(adversarial.elapsed, 119.99, 'Durée au dernier instant avant deux minutes');
assert.ok(adversarial.boss.getHealth() > 0 && adversarial.boss.getHealth() < 1,
  'Le temps minimum résulte de la résistance progressive, sans plancher artificiel à 1 PV');
assert.equal(adversarial.boss.getPhase(), 2, 'La seconde forme apparaît réellement sous pression continue');
const transformations = adversarial.cues.filter(event => event.kind === 'transform-start');
assert.equal(transformations.length, 1, 'Une seule transformation');
assert.ok(transformations[0].time >= 60 - 1e-6, 'La première moitié de vie ne peut pas céder avant une minute');
assert.ok(adversarial.cues.some(event => event.phase === 2 && event.kind === 'release'), 'La phase II exécute ses attaques');
adversarial.step(0.02);
adversarial.boss.takeDamage(1e9);
assert.equal(adversarial.boss.isAlive(), false, 'La mort reste possible après deux minutes');
assert.equal(adversarial.boss.isThreat(), false);
const afterDeath = [adversarial.hits.length, adversarial.blades.length, adversarial.cues.length];
adversarial.boss.takeDamage(1e9);
adversarial.run(4);
assert.deepEqual([adversarial.hits.length, adversarial.blades.length, adversarial.cues.length], afterDeath,
  'Aucun projectile, dégât ou événement tardif après la mort');
adversarial.boss.dispose(adversarial.scene);
adversarial.boss.dispose(adversarial.scene);
assert.equal(adversarial.cues.filter(event => event.kind === 'cancel').length, 1, 'Mort et nettoyage annulent une seule fois');
assert.equal(adversarial.scene.children.length, 0, 'Le nettoyage libère aussi les marquages');

const waiting = fixture();
waiting.run(120, far);
const beforeBurst = waiting.boss.getHealth();
waiting.boss.takeDamage(1e9);
close(beforeBurst - waiting.boss.getHealth(), guardianConfig.damageReserve,
  'Deux minutes de fuite ne permettent de stocker qu’une petite ouverture');
const beforePause = waiting.boss.getHealth();
for (let frame = 0; frame < 1000; frame++) waiting.step(0);
for (const invalidDelta of [NaN, Infinity, -Infinity, -1]) waiting.step(invalidDelta);
waiting.boss.takeDamage(1e9);
assert.equal(waiting.boss.getHealth(), beforePause, 'La pause ne régénère aucune vulnérabilité');
assert.equal(waiting.boss.isFrameResisting(), true, 'Le retour de résistance est lui aussi figé pendant la pause');
waiting.run(0.4, far);
assert.equal(waiting.boss.isFrameResisting(), false, 'Le retour de résistance expire au temps actif');
waiting.run(20, far);
const beforeSecondBurst = waiting.boss.getHealth();
waiting.boss.takeDamage(1e9);
close(beforeSecondBurst - waiting.boss.getHealth(), guardianConfig.damageReserve, 'La réserve reste bornée au fil du duel');

const mixed = fixture();
mixed.run(6, far);
const game = Object.create(Game.prototype);
Object.assign(game, { zombies: [mixed.boss], onZombieKilled() { assert.fail('Le mélange d’impacts ne doit pas être fatal'); } });
function hit(damage, headHits, bodyHits, headDamage, weaponId) {
  const before = mixed.boss.getHealth();
  game.handleWeaponHit(mixed.boss.getMesh(), damage, { headHits, bodyHits, headDamage, weaponId, impactForce: 0 });
  return before - mixed.boss.getHealth();
}
close(hit(80, 1, 0, 80, 'pistol'), 40, 'Game conserve le demi-dégât de tête protégée');
close(hit(137, 3, 5, 72, 'shotgun'), 80, 'Les plombs mixtes partagent la réserve restante après protection du masque');
close(hit(28, 0, 1, 0, 'pistol'), 0, 'Un changement d’arme ne réinitialise pas la résistance');
mixed.run(1, far);
close(hit(55, 0, 1, 0, 'axe'), 20, 'La hache consomme le même budget que les armes à feu');

const firstContact = fixture();
const tracker = new TierDiagnosticsTracker();
tracker.startTier(8);
const trackedGame = Object.create(Game.prototype);
Object.assign(trackedGame, { zombies: [firstContact.boss], tierDiagnostics: tracker });
const bodyShot = { headHits: 0, bodyHits: 1, headDamage: 0, weaponId: 'pistol', impactForce: 0 };
trackedGame.handleWeaponHit(firstContact.boss.getMesh(), 28, bodyShot);
assert.equal(tracker.getCurrentRecord().firstContactDelaySeconds, null,
  'Un impact entièrement absorbé ne devient pas un premier dégât dans les diagnostics');
firstContact.run(1, far); tracker.advance(1);
trackedGame.handleWeaponHit(firstContact.boss.getMesh(), 28, bodyShot);
assert.equal(tracker.getCurrentRecord().firstContactDelaySeconds, 1, 'Le premier vrai dégât conserve son temps actif');

// Cadences et rechargements réels, contacts géométriques préparés et ravitaillement
// régulier : ces scénarios testent la durée logique, pas la précision d’un joueur.
const realPerformance = globalThis.performance;
const realLog = console.log;
const cadenceResults = [];
let virtualMilliseconds = 0;
globalThis.performance = { now: () => virtualMilliseconds };
try {
  console.log = () => {};
  for (const weaponId of ['axe', 'pistol', 'shotgun']) {
    const combat = fixture();
    const canvas = new EventTarget();
    document.pointerLockElement = canvas;
    const camera = new THREE.PerspectiveCamera(75);
    camera.position.set(0, 1.7, 1);
    let deaths = 0, shots = 0;
    const liveGame = Object.create(Game.prototype);
    Object.assign(liveGame, { zombies: [combat.boss], onZombieKilled() { deaths++; } });
    const weapon = new Weapon(camera, canvas, [combat.boss.getMesh()], [],
      (target, damage, shot) => liveGame.handleWeaponHit(target, damage, shot), () => true, () => {});
    if (weaponId !== 'axe') weapon.unlockWeapon(weaponId);
    weapon.setOnShoot(() => { shots++; });
    weapon.raycaster.intersectObjects = () => {
      const name = combat.boss.getMesh().material.map.image.src.split('/').at(-1);
      const head = portraitSprite.heads[name]?.[0];
      const uv = weaponId === 'shotgun' && head
        ? new THREE.Vector2((head[0] + head[2]) / 2 / portraitSprite.width, 1 - (head[1] + head[3]) / 2 / portraitSprite.height)
        : new THREE.Vector2(0.5, 0.12);
      return [{ object: combat.boss.getMesh(), uv, point: new THREE.Vector3(0, 1.4, 0),
        distance: 1, face: { normal: new THREE.Vector3(0, 0, 1) } }];
    };
    let nextSupply = guardianConfig.supplyInterval;
    virtualMilliseconds = 0;
    for (let frame = 0; frame < 40000 && combat.boss.isAlive(); frame++) {
      combat.step(0.01);
      virtualMilliseconds = combat.elapsed * 1000;
      if (combat.elapsed >= nextSupply) {
        weapon.addAmmo(guardianConfig.supplyPistolAmmo, 'pistol');
        weapon.addAmmo(guardianConfig.supplyShotgunAmmo, 'shotgun');
        nextSupply += guardianConfig.supplyInterval;
      }
      weapon.update(0.01);
      if (!combat.boss.isAlive()) break;
      if (weapon.getActiveWeaponId() !== 'axe' && weapon.getActiveWeapon().magazine === 0) weapon.reload();
      // Le fusil attend la fin de sa recharge pour ne pas annuler chaque cartouche engagée.
      if (!weapon.getIsReloading()) weapon.shoot();
      if (combat.elapsed < 120 - 1e-6) assert.equal(combat.boss.isAlive(), true, `${weaponId} : jamais de mort avant deux minutes`);
    }
    assert.equal(combat.boss.isAlive(), false, `${weaponId} : le duel reste terminable avec ravitaillement`);
    assert.equal(deaths, 1, `${weaponId} : Game ne comptabilise qu’une mort`);
    assert.ok(combat.elapsed >= 120 - 1e-6, `${weaponId} : borne de deux minutes conservée`);
    cadenceResults.push({ weapon: weaponId, activeSeconds: Number(combat.elapsed.toFixed(2)), shots });
    weapon.dispose();
  }
} finally {
  console.log = realLog;
  globalThis.performance = realPerformance;
  document.pointerLockElement = null;
}
console.log('Cadences Weapon et rechargements réels, contacts préparés :', JSON.stringify(cadenceResults));

for (const f of fixtures) { f.boss.dispose(f.scene); f.boss.dispose(f.scene); }
GuardianZombie.disposeSharedResources();
disposeAllZombieResources();
console.log('Portrait endurance : ≥120 s actives, rafales adversariales, phase II, réserve bornée, pause/deltas invalides, vrais Weapon → Game et nettoyage : OK. Aucun combat joué.');
