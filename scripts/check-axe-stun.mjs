import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const originalLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};

const { Zombie, disposeAllZombieResources } = await import('../src/Zombie.ts');
const { SpitterZombie } = await import('../src/SpitterZombie.ts');
const { CrawlerZombie } = await import('../src/CrawlerZombie.ts');
const { GuardianZombie } = await import('../src/GuardianZombie.ts');
const scene = new THREE.Scene();
const actors = [];
const level = {
  getFloorHeightAt: () => 0, getCeilingHeightAt: () => 4,
  getSolidMeshes: () => [], isColliding: () => false,
  findNextWaypoint: (_from, target) => target.clone(), hasLineOfSight: () => true,
};
const close = new THREE.Vector3(0, 1.7, 0.8);
const far = new THREE.Vector3(0, 1.7, 16);
const context = { isFlashlightOn: false, cameraDirection: new THREE.Vector3(0, 0, 1) };
function actor(kind, ceiling = false) {
  const value = kind === 'spitter' ? new SpitterZombie(scene, level, 0, 0)
    : kind === 'crawler' ? new CrawlerZombie(scene, level, 0, 0, ceiling)
    : kind === 'guardian' ? new GuardianZombie(scene, level, 0, 0)
    : new Zombie(scene, level, 0, 0, kind, () => 1);
  actors.push(value);
  return value;
}
function step(value, delta, target, attack = () => {}) {
  if (value instanceof CrawlerZombie) value.update(delta, target, [], attack, context);
  else value.update(delta, target, [], attack);
}
function run(value, seconds, target, attack, hz = 100) {
  for (let time = 0; time < seconds - 1e-9; time += 1 / hz) {
    step(value, Math.min(1 / hz, seconds - time), target, attack);
  }
}

try {
  // Les quatre familles restent immobiles ; une autre blessure ne raccourcit pas le stun.
  for (const kind of ['standard', 'agile', 'spitter', 'crawler']) {
    const value = actor(kind);
    value.alert(far);
    value.stun(0.85);
    const position = value.getPosition().clone();
    run(value, 0.3, far, () => assert.fail(`${kind} : attaque pendant le stun`));
    value.takeDamage(1);
    for (let pause = 0; pause < 50; pause++) step(value, 0, far);
    run(value, 0.53, far, () => assert.fail(`${kind} : stun raccourci par une blessure ou une pause`));
    assert.ok(value.getPosition().equals(position), `${kind} : aucune poursuite/séparation pendant 0,83 s`);
    assert.ok(value.isAlive(), `${kind} : le stun ne tue pas`);
    run(value, 0.7, far);
    assert.ok(value.getPosition().distanceTo(position) > 0.01, `${kind} : reprise autonome après le stun`);
  }

  // Une préparation presque terminée est annulée, puis recommence en entier.
  for (const kind of ['standard', 'agile', 'crawler']) {
    const value = actor(kind);
    let attacks = 0;
    const hit = () => attacks++;
    step(value, 0.01, close, hit);
    assert.equal(value instanceof CrawlerZombie ? value.getPose() : value.getState(), kind === 'crawler' ? 'attack' : 'ATTACK');
    run(value, 0.2, close, hit);
    value.stun(0.85);
    run(value, 0.85, close, hit);
    assert.equal(attacks, 0, `${kind} : aucune attaque tardive issue du geste annulé`);
    run(value, 0.12, close, hit);
    assert.equal(attacks, 0, `${kind} : préparation fraîche après le stun`);
    run(value, 0.8, close, hit);
    assert.ok(attacks > 0, `${kind} : l'attaque reprend normalement`);
  }

  // Un crachat verrouillé est supprimé, sans libération retardée à la fin du stun.
  const spitter = actor('spitter');
  const ranged = new THREE.Vector3(0, 1.7, 6);
  let spits = 0;
  run(spitter, 2.1, ranged, () => spits++);
  assert.equal(spitter.getPose(), 'windup');
  spitter.stun(0.85);
  run(spitter, 0.85, ranged, () => spits++);
  assert.equal(spits, 0);
  run(spitter, 0.5, ranged, () => spits++);
  assert.equal(spits, 0, 'Le Cracheur doit de nouveau annoncer toute sa préparation');
  run(spitter, 0.7, ranged, () => spits++);
  assert.equal(spits, 1, 'Un seul nouveau projectile après reprise');

  // La gravité continue mais la saisie d'atterrissage est annulée pendant le stun.
  const dropping = actor('crawler', true);
  dropping.takeDamage(1);
  dropping.stun(0.85);
  let landingHits = 0;
  run(dropping, 0.5, close, () => landingHits++);
  assert.equal(dropping.isDroppingState(), false, 'La créature étourdie tombe toujours au sol');
  assert.equal(landingHits, 0, 'Pas de saisie immédiate pendant un atterrissage étourdi');
  assert.equal(dropping.getPose(), 'hurt');

  // Le boss conserve strictement sa chronologie et son attaque annoncée.
  const boss = actor('guardian'), control = actor('guardian');
  let bossHits = 0, controlHits = 0;
  step(boss, 0.01, close, () => bossHits++);
  step(control, 0.01, close, () => controlHits++);
  assert.equal(boss.getState(), 'ATTACK');
  const health = boss.getHealth();
  boss.stun(0.85);
  run(boss, 1.8, close, () => bossHits++);
  run(control, 1.8, close, () => controlHits++);
  assert.equal(bossHits, controlHits);
  assert.ok(bossHits > 0, 'Le Maître reste dangereux après la tentative de stun');
  assert.equal(boss.getState(), control.getState());
  assert.equal(boss.getHealth(), health, 'Le stun seul ne remplace pas les dégâts');
  assert.equal(boss.getAttackKind(), control.getAttackKind());

  // Appels invalides et stun d'un cadavre : aucun nouvel état vivant.
  const dead = actor('standard');
  for (const duration of [0, -1, NaN, Infinity]) dead.stun(duration);
  step(dead, 0.01, close);
  assert.equal(dead.getState(), 'ATTACK', 'Les durées invalides sont ignorées');
  dead.takeDamage(1000, true);
  dead.stun(0.85);
  assert.equal(dead.isThreat(), false);
  assert.equal(dead.getMesh().visible, false);
  console.log('PASS hache : immobilisation, pause, blessures, annulation/reprise des attaques et crachat, chute et résistance du Maître.');
} finally {
  for (const value of actors) value.dispose(scene);
  CrawlerZombie.disposeSharedResources();
  GuardianZombie.disposeSharedResources();
  disposeAllZombieResources();
  THREE.TextureLoader.prototype.load = originalLoad;
}
