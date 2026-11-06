import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};
class Element extends EventTarget {
  style = { setProperty() {} };
  classList = { toggle() {}, add() {}, remove() {} };
}
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null, querySelector: () => null, querySelectorAll: () => [],
});
globalThis.Audio = class { currentTime = 0; volume = 1; play() { return Promise.resolve(); } pause() {} };

const { Zombie, disposeAllZombieResources } = await import('../src/Zombie.ts');
const { CrawlerZombie } = await import('../src/CrawlerZombie.ts');
const { SpitterZombie } = await import('../src/SpitterZombie.ts');
const { GuardianZombie } = await import('../src/GuardianZombie.ts');
const { Weapon } = await import('../src/Weapon.ts');
const { Door } = await import('../src/Door.ts');
const viewer = new THREE.Vector3(0, 1.7, -100);
const direction = new THREE.Vector3(0, 0, 1);
const scene = new THREE.Scene();
const actors = [];
function fixture(kind = 'standard', overrides = {}, random = () => 1) {
  const level = {
    getFloorHeightAt: () => 0, getSolidMeshes: () => [], isColliding: () => false,
    findNextWaypoint: (_start, target) => target,
    hasLineOfSight: () => true,
    ...overrides,
  };
  const actor = kind === 'crawler' ? new CrawlerZombie(scene, level, 0, 0)
    : kind === 'spitter' ? new SpitterZombie(scene, level, 0, 0)
    : kind === 'guardian' ? new GuardianZombie(scene, level, 0, 0)
    : new Zombie(scene, level, 0, 0, kind, random);
  actors.push(actor);
  return { actor, level };
}
function shot(actor, damage = 13, power = 1, headHit = false, vector = direction) {
  actor.takeDamage(damage, headHit, power * 120, { direction: vector, power });
}
function step(actor, delta, target = viewer, onAttack = () => {}) {
  if (!actor.isAlive()) actor.updateDeath(delta, target);
  else if (actor instanceof CrawlerZombie) actor.update(delta, target, [], onAttack,
    { isFlashlightOn: false, cameraDirection: new THREE.Vector3(0, 0, 1) });
  else actor.update(delta, target, [], onAttack, () => {});
}
function run(actor, seconds, hz = 100, target = viewer, onAttack) {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 1 / hz) {
    step(actor, Math.min(1 / hz, seconds - elapsed), target, onAttack);
  }
}
function body(actor) { return actor.remains?.mesh ?? actor.getMesh(); }

// Le vrai hitscan fournit une seule impulsion par cible et détonation, à partir des plombs reçus.
function fireWeapon({ distance = 2, singlePellet = false, pistol = false, x = 0 } = {}) {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, .1, 100);
  camera.position.set(x, 1, 0);
  const target = new THREE.Mesh(new THREE.BoxGeometry(singlePellet ? .1 : 10, 4, .1), new THREE.MeshBasicMaterial());
  target.position.set(x, 1, -distance);
  const hits = [], impacts = [], canvas = new Element();
  const weapon = new Weapon(camera, canvas, [target], [], (mesh, damage, event) => hits.push({ mesh, damage, event }), () => true, () => {});
  weapon.setOnImpact(impact => impacts.push(impact));
  weapon.unlockWeapon(pistol ? 'pistol' : 'shotgun');
  const savedRandom = Math.random;
  let randomCall = 0;
  Math.random = () => singlePellet && randomCall++ >= 2 ? .999 : 0;
  try { weapon.shoot(); } finally { Math.random = savedRandom; }
  assert.equal(hits.length, 1, 'Une notification de dégâts par cible');
  assert.equal(impacts.length, 1, 'Une gerbe par cible, aucun effet multiplié par huit');
  const result = { ...hits[0], impact: impacts[0] };
  weapon.dispose(); target.geometry.dispose(); target.material.dispose();
  return result;
}
const near = fireWeapon(), far = fireWeapon({ distance: 14 }), partial = fireWeapon({ singlePellet: true });
assert.equal(near.damage, 104, 'Dégâts corps du fusil conservés');
assert.equal(near.event.bodyHits, 8);
assert.equal(partial.damage, 13);
assert.ok(near.event.impact && near.event.impact.power > partial.event.impact.power, 'Un plomb périphérique pousse moins qu’une touche complète');
assert.ok(near.event.impact.power > far.event.impact.power, 'La poussée diminue avec la distance');
assert.ok(near.event.impact.power > 0 && near.event.impact.power <= 1);
assert.ok(near.event.impact.direction.distanceTo(new THREE.Vector3(0, 0, -1)) < .001, 'Direction mondiale vers la cible');
assert.equal(near.impact.weaponId, 'shotgun');
assert.equal(near.impact.power, near.event.impact.power, 'Logique et gerbe partagent la même puissance');
const pistol = fireWeapon({ pistol: true });
assert.equal(pistol.damage, 28, 'Dégâts pistolet conservés');
assert.ok(!pistol.event.impact || pistol.event.impact.power === 0, 'Aucune nouvelle impulsion au pistolet');

// Chaque famille ordinaire recule à partir de sa vraie classe, sans déplacer le joueur.
for (const kind of ['standard', 'agile', 'spitter', 'crawler']) {
  const { actor } = fixture(kind);
  shot(actor);
  const initial = actor.getPosition().clone();
  step(actor, 0);
  assert.ok(actor.getPosition().equals(initial), `${kind} : pause sans mouvement`);
  run(actor, .14);
  assert.ok(actor.getPosition().z > .05, `${kind} : poussée visible vers l’arrière`);
  assert.ok(actor.getPosition().z < 1, `${kind} : poussée bornée`);
  assert.equal(actor.getPosition().x, 0, `${kind} : aucune dérive latérale inventée`);
  assert.ok(actor.isAlive(), `${kind} : l’impact non fatal ne tue pas artificiellement`);
}

const pistolTarget = fixture().actor, pistolPosition = pistolTarget.getPosition().clone();
pistolTarget.takeDamage(28);
run(pistolTarget, .14);
assert.ok(pistolTarget.getPosition().equals(pistolPosition), 'Blessure pistolet inchangée, aucun recul physique');

// L’accent corporel appartient à la cible touchée ; une instance partageant l’art reste intacte.
const bent = fixture().actor, untouched = fixture().actor;
const untouchedGeometry = untouched.getMesh().geometry;
const untouchedVertices = Array.from(untouchedGeometry.getAttribute('position').array);
shot(bent);step(bent, .06);
assert.notEqual(bent.getMesh().geometry, untouchedGeometry, 'La réaction ne déforme pas la géométrie partagée');
assert.deepEqual(Array.from(untouchedGeometry.getAttribute('position').array), untouchedVertices);
bent.getMesh().updateWorldMatrix(true, false);
const ray = new THREE.Raycaster(new THREE.Vector3(0, 1.5, -5), new THREE.Vector3(0, 0, 1));
const hit = ray.intersectObject(bent.getMesh())[0];
assert.ok(hit?.uv && Number.isFinite(hit.distance), 'Le corps déformé conserve une vraie surface de tir et ses UV');
const pausedVertices = Array.from(bent.getMesh().geometry.getAttribute('position').array);
step(bent, 0);
assert.deepEqual(Array.from(bent.getMesh().geometry.getAttribute('position').array), pausedVertices, 'Le corps ne poursuit pas son mouvement en pause');

// Le seuil déjà utilisé par le Cracheur reste actif après introduction du recul.
const spitter = fixture('spitter').actor, spitTarget = new THREE.Vector3(0, 1.7, -4);
run(spitter, 1.82, 100, spitTarget);
assert.equal(spitter.getPose(), 'windup');
spitter.takeDamage(52, false, 60, { direction, power: .5 });
assert.notEqual(spitter.getPose(), 'windup', 'Un gros impact annule toujours la préparation du crachat');

// Un mur mince ou une porte fermée arrête aussi un grand pas de simulation.
const walled = fixture('standard', { isColliding: (_x, z) => z >= .22 }).actor;
shot(walled);
step(walled, .2);
assert.ok(walled.getPosition().z >= 0 && walled.getPosition().z < .22, 'Pas de traversée de mur sous grand delta');
const door = new Door(scene, { x: 0, z: .9, passageWidth: 3, name: 'Test recul', type: 'interior' });
const doorTarget = fixture('standard', { isColliding: (x, z, radius) => door.isColliding(x, z, radius) }).actor;
shot(doorTarget);
run(doorTarget, .3);
assert.ok(doorTarget.getPosition().z < .5, 'Le battant fermé protège le passage');
door.rootGroup.removeFromParent();

// La poussée suit la pente, mais n’envoie pas un ennemi à travers un bord d’étage.
const ramp = fixture('standard', { getFloorHeightAt: (_x, z) => z * .5 }).actor;
shot(ramp);run(ramp, .14);
assert.ok(Math.abs(ramp.getPosition().y - (1 + ramp.getPosition().z * .5)) < 1e-6, 'Appui recalé sur la rampe');
const ledge = fixture('standard', { getFloorHeightAt: (_x, z) => z >= .2 ? -2.4 : 0 }).actor;
shot(ledge);run(ledge, .14);
assert.ok(ledge.getPosition().z < .2 && ledge.getPosition().y === 1, 'Une rupture de sol bloque la projection');

// La chute poursuit l’impulsion ; le cadavre et la relève partagent le nouveau point d’appui.
for (const kind of ['standard', 'agile', 'spitter', 'crawler']) {
  const { actor } = fixture(kind);
  shot(actor, 1000);
  assert.equal(actor.isAlive(), false);
  const corpse = body(actor), before = corpse.position.clone();
  step(actor, 0);
  assert.ok(corpse.position.equals(before), `${kind} : chute suspendue à delta nul`);
  run(actor, .14);
  assert.ok(corpse.position.z > before.z + .03, `${kind} : chute emportée par le coup fatal`);
  run(actor, 1);
  const settled = corpse.position.clone();
  run(actor, 1);
  assert.ok(corpse.position.distanceTo(settled) < 1e-6, `${kind} : cadavre immobilisé après la chute`);
}
for (const kind of ['standard', 'agile']) {
  const { actor } = fixture(kind, {}, () => 0);
  shot(actor, 1000);
  assert.equal(actor.isThreat(), true, 'La relève reste une menace');
  run(actor, .3);
  const displaced = body(actor).position.clone();
  for (let time = 0; !actor.isAlive() && time < 4; time += .01) step(actor, .01);
  assert.equal(actor.isAlive(), true);
  assert.ok(Math.abs(actor.getPosition().z - displaced.z) < .01, 'La relève ne revient pas à l’ancienne position');
  actor.takeDamage(1000);
  assert.equal(actor.isThreat(), false, 'Pas de seconde relève');
}

// Une attaque du boss poursuit sa préparation sous le fusil et frappe une seule fois.
const guardian = fixture('guardian').actor, bossTarget = new THREE.Vector3(0, 1.7, 2);
step(guardian, .01, bossTarget);
assert.equal(guardian.getState(), 'ATTACK');
const bossPosition = guardian.getPosition().clone();
shot(guardian, 13);
const bossHits = [];
run(guardian, 1.6, 100, bossTarget, damage => bossHits.push(damage));
assert.ok(guardian.getPosition().equals(bossPosition), 'Le boss résiste à la poussée physique');
assert.equal(bossHits.length, 1, 'Le fusil ne neutralise pas le geste engagé');

// Le déplacement d’une impulsion dépend du temps simulé, pas du nombre d’images.
const low = fixture().actor, high = fixture().actor;
shot(low);shot(high);
run(low, .14, 30);run(high, .14, 144);
assert.ok(low.getPosition().distanceTo(high.getPosition()) < .025, 'Même poussée à 30 et 144 Hz');

// La vraie orchestration Game conserve les quatre arguments, les diagnostics et le comptage.
const { Game } = await import('../src/Game.ts');
const routed = fixture().actor, routedImpact = { direction: direction.clone(), power: .8 };
const received = [], hitsRecorded = [], realDamage = routed.takeDamage.bind(routed);
routed.takeDamage = (...args) => { received.push(args);return realDamage(...args); };
let damageRecords = 0, completions = 0, displays = 0, deaths = 0;
const game = Object.assign(Object.create(Game.prototype), {
  zombies: [routed],
  tierDiagnostics: {
    recordHit: (...args) => hitsRecorded.push(args),
    recordDamageDealt: () => damageRecords++,
  },
  checkTierCompletion: () => completions++, updateObjectiveDisplay: () => displays++,
  onZombieKilled: () => deaths++,
});
game.handleWeaponHit(routed.getMesh(), 13, { headHits: 0, bodyHits: 1, impactForce: 15, weaponId: 'shotgun', impact: routedImpact });
assert.equal(received.length, 1, 'Game applique une seule blessure à la cible');
assert.deepEqual(received[0], [13, false, 15, routedImpact], 'Game transmet la puissance et la direction en quatrième argument');
step(routed, .06);
assert.ok(routed.getPosition().z > .05, 'Le chemin réel Game → ennemi produit le recul');
assert.deepEqual(hitsRecorded, [[0, 1, 'shotgun']]);
assert.deepEqual([damageRecords, completions, displays, deaths], [1, 1, 1, 0]);
game.handleWeaponHit(routed.getMesh(), 1000, { headHits: 0, bodyHits: 8, impactForce: 120, weaponId: 'shotgun', impact: routedImpact });
assert.equal(deaths, 1, 'Le tir fatal garde le comptage de mort unique');

for (const actor of actors) actor.dispose(scene);
disposeAllZombieResources();
console.log('PASS : vrai hitscan et routage Game, puissance plombs/distance, recul des quatre familles, pause, murs/porte, rampe/bord, chute/relève, résistance du boss et cadence 30/144 Hz.');
