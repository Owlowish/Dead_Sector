import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { GuardianZombie } from '../src/GuardianZombie.ts';
import { GuardianProjectile } from '../src/GuardianProjectile.ts';
import { Zombie, disposeAllZombieResources } from '../src/Zombie.ts';
import { guardianConfig } from '../src/FinaleConfig.ts';
import { portraitAnimation, portraitConfig, portraitSprite, portraitGroundOffsetY } from '../src/PortraitAnimation.ts';
import { isHeadSpriteHit } from '../src/SpriteHitMask.ts';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';

THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture({ width: 512, height: 512, src: url });
  texture.userData.url = url;
  return texture;
};

const first = new THREE.Vector3(0, 1.7, 8);
const near = new THREE.Vector3(0, 1.7, 2);
const late = new THREE.Vector3(-4, 1.7, 8);
const fixtures = [];
function poseOf(boss) { return boss.getMesh().material.map.userData.url.split('/').at(-1); }
// Ces scénarios isolent les gestes. La durée sans état forcé est couverte par check-portrait-endurance.
function damageForState(boss, amount, headHit = false) {
  boss.damageAllowance = amount;
  boss.takeDamage(amount, headHit);
}
function fixture() {
  const scene = new THREE.Scene();
  const level = {
    blockers: [], blocked: false, highPlayer: false, ramp: false, collisionRule: null,
    getFloorHeightAt(_x, z) { return this.highPlayer && z > 1 ? 2.4 : this.ramp ? Math.max(0, z * 0.1) : 0; },
    getSolidMeshes() { return this.blockers; },
    isColliding(x, z) { return this.blocked || Boolean(this.collisionRule?.(x, z)); },
    findNextWaypoint(_start, target) { return this.blocked ? null : target; },
    hasLineOfSight(start, target) {
      const direction = target.clone().sub(start);
      const ray = new THREE.Raycaster(start, direction.clone().normalize(), 0, direction.length());
      for (const blocker of this.blockers) blocker.updateWorldMatrix(true, false);
      return ray.intersectObjects(this.blockers, false).length === 0;
    },
  };
  const events = [];
  let time = 0;
  const boss = new GuardianZombie(scene, level, 0, 0, { cue: event => events.push({ ...event, time }) });
  const hits = [];
  const throws = [];
  const f = { scene, level, boss, hits, throws, events,
    step(delta = 0.01, target = near) {
      time += delta;
      boss.update(delta, target, [], damage => hits.push(damage), (origin, locked) => throws.push({ origin, target: locked, time }));
    },
    run(seconds, target = near) {
      for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.01) this.step(Math.min(0.01, seconds - elapsed), target);
    },
    until(predicate, target = first, limit = 6) {
      for (let elapsed = 0; !predicate() && elapsed < limit; elapsed += 0.01) this.step(0.01, target);
      assert.ok(predicate(), 'La transition attendue doit arriver dans un temps borné');
    },
  };
  fixtures.push(f);
  return f;
}
function enterTransformation(f) {
  f.step(0.01, first);
  damageForState(f.boss, guardianConfig.health / 2 + 40);
  assert.equal(f.boss.getPhase(), 1, 'Le seuil ne coupe pas une attaque engagée');
  f.until(() => f.boss.getState() === 'RECOVER', first);
  f.run(1.8, first);
  assert.equal(f.boss.getPhase(), 1, 'La première récupération reste complète');
  f.until(() => f.boss.isTransforming(), first);
  assert.equal(f.boss.getPhase(), 2);
}
function startSweep(f) {
  enterTransformation(f);
  f.until(() => !f.boss.isTransforming(), near, 2);
  f.until(() => f.boss.getState() === 'ATTACK', near, 2);
  assert.equal(f.boss.getAttackKind(), 'sweep', 'Le balayage apparaît au contact en phase II');
}
function startPhase2Blades(f) {
  enterTransformation(f);
  f.until(() => !f.boss.isTransforming(), first, 2);
  f.until(() => f.boss.getState() === 'ATTACK', first, 2);
  assert.equal(f.boss.getAttackKind(), 'blades');
}

const tear = fixture();
assert.ok(tear.boss instanceof Zombie, 'Compatible avec les menaces et le nettoyage existants');
assert.equal(tear.boss.getHealth(), guardianConfig.health);
assert.equal(tear.boss.getPosition().y, portraitGroundOffsetY);
assert.equal(tear.boss.getMesh().geometry.parameters.width, portraitConfig.width);
assert.equal(tear.boss.getMesh().geometry.parameters.height, portraitConfig.height);
assert.equal(tear.boss.getMesh().scale.y, 1, 'La nouvelle taille ne réutilise pas l’échelle du zombie');
tear.step();
assert.equal(tear.boss.getAttackKind(), 'tear');
assert.equal(poseOf(tear.boss), 'tear-windup.png');
const held = tear.boss.getPosition().clone();
tear.run(0.7);
damageForState(tear.boss, 28);
assert.equal(tear.boss.getState(), 'ATTACK', 'Un tir ne neutralise pas la préparation');
tear.run(0.69);
assert.deepEqual(tear.hits, [], 'Aucun dégât avant les 1,4 s de marquage');
tear.run(0.02);
assert.deepEqual(tear.hits, [22]);
assert.equal(tear.boss.getState(), 'RECOVER');
assert.ok(tear.boss.getPosition().equals(held), 'Préparation et récupération restent immobiles');
tear.run(1.8);
assert.equal(tear.boss.getState(), 'RECOVER');
assert.deepEqual(tear.hits, [22], 'La bande ne frappe qu’une seule fois');

for (const distance of [2.5, 4, 6, 12]) {
  const middle = fixture();
  middle.step(0.01, new THREE.Vector3(0, 1.7, distance));
  assert.ok(['tear', 'blades'].includes(middle.boss.getAttackKind()), `Une attaque existe à ${distance} m sans balayage en phase I`);
}

const blocker = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2));
blocker.position.set(0, 1.5, 1);
for (const kind of ['tear', 'sweep']) {
  const start = () => {
    const f = fixture();
    if (kind === 'sweep') startSweep(f);
    else f.step();
    assert.equal(f.boss.getAttackKind(), kind);
    return f;
  };
  const windup = kind === 'tear' ? guardianConfig.tearWindup : guardianConfig.attackWindup;
  const dodge = start();
  const escaped = kind === 'tear' ? new THREE.Vector3(2, 1.7, 2) : new THREE.Vector3(0, 1.7, -2);
  dodge.run(windup + 0.02, escaped);
  assert.deepEqual(dodge.hits, [], `${kind} garde sa direction engagée : changer de côté évite l’impact`);
  assert.equal(dodge.boss.getState(), 'RECOVER');

  const wall = start();
  wall.level.blockers.push(blocker);
  wall.run(windup + 0.02);
  assert.deepEqual(wall.hits, [], `${kind} : un obstacle refermé pendant la préparation bloque le coup`);

  const collider = start();
  collider.level.collisionRule = (_x, z) => z > 0.8 && z < 1.2;
  collider.run(windup + 0.02);
  assert.deepEqual(collider.hits, [], `${kind} : le segment physique protège aussi derrière un ajour du décor`);

  const altitude = start();
  altitude.level.highPlayer = true;
  altitude.run(windup + 0.02, new THREE.Vector3(0, 4.1, 2));
  assert.deepEqual(altitude.hits, [], `${kind} ne traverse pas un changement d’étage`);
}

const phase2Sweep = fixture();
startSweep(phase2Sweep);
assert.equal(poseOf(phase2Sweep.boss), 'sweep-windup.png');
assert.equal(phase2Sweep.boss.isSweepThreat(near), true, 'Le danger est signalé dès l’anticipation');
assert.equal(phase2Sweep.boss.isSweepThreat(new THREE.Vector3(0, 1.7, -2)), false, 'Quitter le secteur éteint le danger');
const rim = phase2Sweep.boss.cue.group.children.at(-1);
assert.equal(rim.visible, true, 'Le liseré relevé précède l’impact');
assert.ok(rim.geometry.attributes.position.getY(0) > 1, 'Le liseré dépasse le sol');
const sweepHeld = phase2Sweep.boss.getPosition().clone();
phase2Sweep.run(guardianConfig.attackWindup - 0.01);
assert.deepEqual(phase2Sweep.hits, []);
phase2Sweep.run(0.02);
assert.deepEqual(phase2Sweep.hits, [24]);
assert.equal(phase2Sweep.boss.isSweepThreat(near), false, 'Le danger s’éteint dès le début de la récupération');
assert.equal(poseOf(phase2Sweep.boss), 'sweep-release.png');
phase2Sweep.run(0.5);
assert.deepEqual(phase2Sweep.hits, [24], 'Un balayage ne produit qu’un impact');
assert.ok(phase2Sweep.boss.getPosition().equals(sweepHeld), 'La récupération du balayage laisse une ouverture stable');

// Un mur derrière le joueur tronque le marquage sans supprimer la partie dangereuse.
// Vérifier les vrais triangles visibles, indépendamment de la fonction de dégâts.
function hasGroundMark(f, x, z) {
  const group = f.scene.children.find(object => object.isGroup);
  assert.ok(group, 'Le balayage instancie son marquage dans la scène');
  group.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0), 0, 4);
  return ray.intersectObjects(group.children.filter(object => object.visible), false).length > 0;
}
const wallBehindPlayer = fixture();
wallBehindPlayer.level.collisionRule = (_x, z) => z >= 2.15 && z <= 2.25;
startSweep(wallBehindPlayer);
assert.equal(hasGroundMark(wallBehindPlayer, 0, 2), true, 'Le joueur devant le mur voit encore la zone qui le menace');
assert.equal(hasGroundMark(wallBehindPlayer, 0, 2.3), false, 'Le marquage réel s’arrête avant l’autre côté du mur');
wallBehindPlayer.run(guardianConfig.attackWindup + 0.02);
assert.deepEqual(wallBehindPlayer.hits, [24], 'La portion signalée devant le mur frappe normalement');

const wallBeforePlayer = fixture();
wallBeforePlayer.level.collisionRule = (_x, z) => z >= 1.75 && z <= 1.85;
startSweep(wallBeforePlayer);
assert.equal(hasGroundMark(wallBeforePlayer, 0, 2), false, 'Un obstacle avant le joueur masque la vraie géométrie dangereuse');
assert.equal(wallBeforePlayer.boss.isSweepThreat(near), false, 'Un couvert éteint le danger rapproché');
wallBeforePlayer.run(guardianConfig.attackWindup + 0.02);
assert.deepEqual(wallBeforePlayer.hits, [], 'La zone non signalée derrière un obstacle ne frappe pas');

assert.equal(phase2Sweep.boss.isMaskVisibleFrom(near), true, 'Le masque dégagé offre une ligne de tir');
phase2Sweep.level.blockers.push(blocker);
assert.equal(phase2Sweep.boss.isMaskVisibleFrom(near), false, 'Le couvert masque la ligne de tir vers le masque');

const shot = fixture();
const locked = new THREE.Vector3(2, 1.7, 8);
shot.step(0.01, first);
assert.equal(shot.boss.getAttackKind(), 'blades');
shot.run(0.74, first);
shot.step(0.02, locked);
damageForState(shot.boss, guardianConfig.health / 2 + 40);
assert.equal(shot.boss.getPhase(), 1);
shot.run(0.36, late);
assert.equal(shot.throws.length, 3, 'Une attaque lance un éventail de trois lames');
assert.ok(shot.throws[1].target.equals(locked), 'La lame centrale garde la cible verrouillée avant le déplacement tardif');
const centerDirection = shot.throws[1].target.clone().sub(shot.throws[1].origin).setY(0).normalize();
for (const i of [0, 2]) {
  const direction = shot.throws[i].target.clone().sub(shot.throws[i].origin).setY(0).normalize();
  assert.ok(Math.abs(direction.angleTo(centerDirection) - guardianConfig.bladeSpread) < 1e-8, 'Les lames latérales encadrent la cible verrouillée');
  assert.ok(shot.throws[i].origin.equals(shot.throws[1].origin));
}
assert.ok(shot.throws[0].target.x < shot.throws[1].target.x && shot.throws[1].target.x < shot.throws[2].target.x, 'Les lames couvrent bien deux côtés distincts');
shot.run(1.8, late);
assert.equal(shot.throws.length, 6, 'Les deux salves précèdent la récupération');
assert.ok(shot.throws[4].target.equals(late), 'La seconde salve vise la nouvelle position, indépendamment du premier verrouillage');
assert.equal(shot.boss.isMaskExposed(), true);
assert.equal(shot.boss.getPhase(), 1);
shot.until(() => shot.boss.isTransforming(), late);
assert.equal(shot.boss.getHealth(), guardianConfig.health / 2 - 40, 'Les dégâts ayant franchi le seuil sont conservés');
damageForState(shot.boss, 28);
assert.equal(shot.boss.getHealth(), guardianConfig.health / 2 - 68, 'La transformation reste blessable quand le cadre dispose de vulnérabilité');
const transformPose = poseOf(shot.boss);
for (let i = 0; i < 100; i++) shot.step(0, near);
assert.equal(poseOf(shot.boss), transformPose, 'La pause suspend aussi la transformation');
assert.equal(shot.boss.isTransforming(), true);
shot.run(guardianConfig.transformationDuration - 0.02, late);
assert.equal(shot.boss.isTransforming(), true, 'La transformation garde ses 1,3 s annoncées');
assert.equal(shot.throws.length, 6);
shot.run(0.03, late);
assert.equal(shot.boss.isTransforming(), false);

for (const kind of ['blades', 'tear']) {
  const frozen = fixture();
  const target = kind === 'blades' ? first : near;
  const windup = kind === 'tear' ? guardianConfig.tearWindup : guardianConfig.attackWindup;
  frozen.step(0.01, target);
  frozen.run(0.5, target);
  for (let i = 0; i < 100; i++) frozen.step(0, late);
  assert.deepEqual(frozen.throws, [], `${kind} : delta nul ne consomme pas le signal`);
  assert.deepEqual(frozen.hits, []);
  frozen.run(windup - 0.49, target);
  assert.equal(kind === 'blades' ? frozen.throws.length : frozen.hits.length, kind === 'blades' ? 3 : 1);
}

for (const moment of ['blades', 'tear', 'transformation']) {
  const killed = fixture();
  if (moment === 'transformation') enterTransformation(killed);
  else killed.step(0.01, moment === 'blades' ? first : near);
  const emitted = killed.throws.length;
  damageForState(killed.boss, killed.boss.getHealth() + 50);
  assert.equal(killed.boss.getHealth(), 0, 'Aucun dégât fatal perdu au seuil');
  assert.equal(killed.boss.isThreat(), false);
  assert.equal(killed.boss.isTransforming(), false);
  assert.equal(poseOf(killed.boss), 'death.png', 'La mort garde le sprite propre au Maître');
  const visible = killed.scene.children.filter(object => object.visible);
  assert.equal(visible.length, 1, 'Aucun cadavre de zombie standard ni marquage visible restant');
  assert.equal(visible[0], killed.boss.getMesh());
  killed.run(4, first);
  for (let i = 0; i < 400; i++) killed.boss.updateDeath(0.01, late);
  assert.equal(killed.boss.isAlive(), false, 'Aucune relève');
  assert.equal(killed.throws.length, emitted, `Mort prioritaire pendant ${moment} : aucune lame tardive`);
  assert.deepEqual(killed.hits, [], 'Aucun dégât de sol après la mort');
  assert.equal(poseOf(killed.boss), 'death.png');
}

const route = fixture();
route.level.ramp = true;
route.level.blocked = true;
const far = new THREE.Vector3(0, 4, 25);
const before = route.boss.getPosition().clone();
route.run(1, far);
assert.ok(route.boss.getPosition().equals(before), 'Collision conservée');
route.level.blocked = false;
route.run(0.5, far);
assert.ok(route.boss.getPosition().z > before.z, 'Poursuite hors portée de lames');
assert.ok(Math.abs(route.boss.getPosition().y - portraitGroundOffsetY
  - route.level.getFloorHeightAt(route.boss.getPosition().x, route.boss.getPosition().z)) < 1e-9, 'Appui personnalisé conservé sur les rampes');
damageForState(route.boss, route.boss.getHealth());
const raisedGround = route.level.getFloorHeightAt(route.boss.getPosition().x, route.boss.getPosition().z);
route.boss.getMesh().updateMatrixWorld(true);
const localGround = (0.5 - portraitSprite.groundY / portraitSprite.height) * portraitConfig.height;
const ground = route.boss.getMesh().localToWorld(new THREE.Vector3(0, localGround, 0));
assert.ok(Math.abs(ground.y - raisedGround) < 1e-8, 'Le cadavre du Maître reste ancré sur le sol surélevé');

const advancing = fixture();
advancing.step(0.01, first);
advancing.until(() => advancing.boss.getState() === 'RECOVER', first);
const attackPosition = advancing.boss.getPosition().clone();
advancing.until(() => advancing.boss.getState() !== 'RECOVER', first);
advancing.until(() => advancing.boss.getState() === 'ATTACK', first, 2);
assert.ok(advancing.boss.getPosition().z > attackPosition.z, 'Entre deux attaques, le Maître avance réellement au lieu de rester une tourelle');
const newAttackPosition = advancing.boss.getPosition().clone();
advancing.run(0.3, late);
assert.ok(advancing.boss.getPosition().equals(newAttackPosition), 'La nouvelle préparation arrête la marche même quand le joueur change de côté');

const combo = fixture();
startPhase2Blades(combo);
const comboStart = combo.boss.getPosition().clone();
const firstVolleyCount = combo.throws.length;
combo.run(guardianConfig.attackWindup - 0.01, first);
assert.equal(combo.throws.length, firstVolleyCount, 'Le premier geste du combo garde sa préparation complète');
combo.until(() => combo.boss.isComboTransition(), first, 0.6);
assert.equal(combo.throws.length, firstVolleyCount + 10, 'Le combo attend les deux salves de cinq lames');
assert.equal(combo.boss.getState(), 'RECOVER');
combo.run(guardianConfig.comboTransition - 0.01, first);
assert.equal(combo.boss.isComboTransition(), true, 'Les 0,6 s entre gestes ne sont pas une vraie récupération');
assert.equal(combo.events.filter(e => e.phase === 2 && e.kind === 'prepare').length, 2);
combo.until(() => combo.boss.getState() === 'ATTACK', first, 0.05);
assert.equal(combo.boss.isComboTransition(), false);
assert.equal(combo.boss.getAttackKind(), 'tear');
assert.equal(combo.events.filter(e => e.phase === 2 && e.kind === 'prepare').length, 3, 'La déchirure est annoncée après les deux salves');
assert.ok(combo.boss.getPosition().equals(comboStart), 'Aucun déplacement pendant les deux gestes et leur transition');
combo.run(guardianConfig.tearWindup - 0.01, first);
assert.deepEqual(combo.hits, [], 'La seconde anticipation de 1,4 s reste complète');
combo.run(0.02, first);
assert.deepEqual(combo.hits, [22]);
assert.equal(combo.boss.isComboTransition(), false);
combo.run(1.5, first);
assert.equal(combo.boss.getState(), 'RECOVER', 'Après deux gestes, une vraie ouverture de 1,6 s est conservée');
assert.equal(combo.events.filter(e => e.phase === 2 && e.kind === 'release').length, 3, 'Deux salves puis une déchirure, sans troisième geste');
assert.deepEqual(combo.hits, [22]);

const comboWall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2));
comboWall.position.set(0, 1.5, 6);
for (const reason of ['cover', 'floor', 'near', 'far']) {
  const cancelled = fixture();
  startPhase2Blades(cancelled);
  cancelled.until(() => cancelled.boss.isComboTransition(), first, 2);
  let target = first;
  if (reason === 'cover') {
    cancelled.level.blockers.push(comboWall);
    cancelled.level.collisionRule = (_x, z) => z > 5.9 && z < 6.1;
  } else if (reason === 'floor') {
    cancelled.level.getFloorHeightAt = (_x, z) => z > 6 ? 2.4 : 0;
    target = new THREE.Vector3(0, 4.1, 8);
  } else if (reason === 'near') {
    target = cancelled.boss.getPosition().clone().add(new THREE.Vector3(0, 1.7 - portraitGroundOffsetY, 0.2));
  } else target = new THREE.Vector3(0, 1.7, 22);
  cancelled.until(() => !cancelled.boss.isComboTransition(), target, 0.7);
  assert.equal(cancelled.boss.getState(), 'RECOVER', `${reason} annule le second geste et laisse une récupération`);
  assert.equal(cancelled.events.filter(e => e.phase === 2 && e.kind === 'prepare').length, 2, `${reason} ne déclenche pas une attaque cachée ou à portée nulle`);
  cancelled.run(1.4, target);
  assert.deepEqual(cancelled.hits, []);
  assert.equal(cancelled.events.filter(e => e.phase === 2 && e.kind === 'release').length, 2);
}

const comboPause = fixture();
startPhase2Blades(comboPause);
comboPause.until(() => comboPause.boss.isComboTransition(), first, 2);
const beforeComboPause = comboPause.events.length;
for (let i = 0; i < 100; i++) comboPause.step(0, late);
assert.equal(comboPause.boss.isComboTransition(), true);
assert.equal(comboPause.events.length, beforeComboPause, 'La pause entre gestes ne produit aucun événement ni attaque');
comboPause.run(guardianConfig.comboTransition - 0.01, first);
assert.equal(comboPause.boss.isComboTransition(), true);
comboPause.until(() => comboPause.boss.getState() === 'ATTACK', first, 0.05);

for (const moment of ['transition', 'followup']) {
  const killedCombo = fixture();
  startPhase2Blades(killedCombo);
  killedCombo.until(() => killedCombo.boss.isComboTransition(), first, 2);
  if (moment === 'followup') {
    killedCombo.until(() => killedCombo.boss.getState() === 'ATTACK', first, 0.7);
    killedCombo.run(0.5, first);
  }
  damageForState(killedCombo.boss, killedCombo.boss.getHealth());
  const emittedBeforeDeath = killedCombo.events.length;
  killedCombo.run(5, first);
  assert.equal(killedCombo.events.length, emittedBeforeDeath, `Aucun événement tardif après mort pendant ${moment}`);
  assert.deepEqual(killedCombo.hits, []);
  assert.equal(killedCombo.boss.isComboTransition(), false);
  killedCombo.boss.dispose(killedCombo.scene);
  killedCombo.boss.dispose(killedCombo.scene);
  assert.equal(killedCombo.events.filter(e => e.kind === 'cancel').length, 1, 'Mort puis double nettoyage n’annulent la présentation qu’une fois');
}

const transformEvents = fixture();
enterTransformation(transformEvents);
assert.equal(transformEvents.events.filter(e => e.kind === 'transform-start').length, 1);
const beforeTransformPause = transformEvents.events.length;
for (let i = 0; i < 100; i++) transformEvents.step(0, first);
assert.equal(transformEvents.events.length, beforeTransformPause);
transformEvents.run(guardianConfig.transformationDuration * 0.54, first);
assert.equal(transformEvents.events.filter(e => e.kind === 'transform-burst').length, 0);
transformEvents.step(2, first);
assert.deepEqual(transformEvents.events.filter(e => e.kind.startsWith('transform-')).map(e => e.kind),
  ['transform-start', 'transform-burst', 'transform-end'], 'Même un grand delta franchit le burst à 55 % et la fin une seule fois');
for (const event of transformEvents.events) {
  assert.equal(event.position.y, 0, 'Chaque événement fournit une racine au sol');
  assert.equal(event.direction.y, 0, 'La direction de présentation reste horizontale');
  assert.ok(Math.abs(event.direction.length() - 1) < 1e-8);
}
const initialEventPosition = advancing.events.find(e => e.kind === 'prepare').position;
assert.equal(initialEventPosition.z, 0, 'Les vecteurs envoyés ne suivent pas les déplacements ultérieurs du billboard');

// Chaque forme possède deux volées annoncées, une visée distincte et une ouverture finale.
for (const phase of [1, 2]) {
  const volleys = fixture();
  if (phase === 2) startPhase2Blades(volleys);
  else volleys.step(0.01, first);
  const prefix = volleys.throws.length;
  const count = phase === 2 ? 5 : 3;
  const interval = phase === 2 ? 0.5 : 0.55;
  const spread = phase === 2 ? 0.5 : 0.28;
  const posePrefix = phase === 2 ? 'phase2-' : '';
  assert.equal(volleys.boss.getVolleyIndex(), 1);
  assert.equal(volleys.boss.isMaskExposed(), false);
  assert.equal(poseOf(volleys.boss), `${posePrefix}blades-windup.png`);
  volleys.run(0.7, first);
  assert.equal(poseOf(volleys.boss), `${posePrefix}blades-windup-b.png`, 'Le second dessin anticipe réellement le départ');
  volleys.run(0.39, first);
  assert.equal(volleys.throws.length, prefix);
  volleys.until(() => volleys.throws.length > prefix, first, 0.05);
  assert.equal(volleys.throws.length, prefix + count);
  assert.equal(volleys.boss.getVolleyIndex(), 2);
  assert.equal(volleys.boss.getState(), 'ATTACK', 'La première volée ne devient pas une récupération');
  assert.equal(volleys.boss.isMaskExposed(), false);
  assert.equal(volleys.boss.isComboTransition(), false, 'Le combo ne commence pas après la seule première volée');
  assert.equal(poseOf(volleys.boss), `${posePrefix}blades-release.png`);
  const firstCenter = volleys.throws[prefix + Math.floor(count / 2)];
  const center = firstCenter.target.clone().sub(firstCenter.origin).setY(0).normalize();
  for (const edge of [prefix, prefix + count - 1]) {
    const direction = volleys.throws[edge].target.clone().sub(volleys.throws[edge].origin).setY(0).normalize();
    assert.ok(Math.abs(direction.angleTo(center) - spread) < 1e-8);
  }
  if (phase === 2) assert.ok(2 * 5 * Math.sin((2 * spread / (count - 1)) / 2) > 0.96,
    'À cinq mètres, les directions de cinq lames laissent des intervalles plus larges que le volume joueur');

  const beforePause = volleys.events.length;
  for (let i = 0; i < 100; i++) volleys.step(0, late);
  assert.equal(volleys.events.length, beforePause, 'La pause entre volées n’avance ni annonce ni visée');
  volleys.run(interval - guardianConfig.throwLockBeforeRelease - 0.01, first);
  const secondAim = new THREE.Vector3(2, 1.7, 8);
  volleys.step(0.02, secondAim);
  volleys.until(() => volleys.throws.length === prefix + count * 2, late, interval);
  assert.ok(volleys.throws[prefix + count + Math.floor(count / 2)].target.equals(secondAim),
    'La seconde visée est nouvelle puis reste verrouillée pendant le déplacement tardif');
  const events = volleys.events.filter(e => e.phase === phase && ['prepare', 'release'].includes(e.kind));
  assert.deepEqual(events.map(e => [e.kind, e.volleyIndex]), [['prepare', 1], ['release', 1], ['prepare', 2], ['release', 2]]);
  const releases = events.filter(e => e.kind === 'release');
  assert.ok(Math.abs(releases[1].time - releases[0].time - interval) < 0.011, 'Les départs respectent la cadence de la forme');
  assert.equal(volleys.boss.isMaskExposed(), phase === 1);
  assert.equal(volleys.boss.isComboTransition(), phase === 2);
  volleys.run(0.11, late);
  assert.equal(poseOf(volleys.boss), `${posePrefix}blades-followthrough.png`, 'Le geste se termine par un dessin de suivi distinct');
  if (phase === 1) {
    volleys.run(0.15, late);
    assert.equal(poseOf(volleys.boss), 'recovery.png');
    assert.equal(volleys.boss.isMaskExposed(), true);
    assert.equal(volleys.boss.getMesh().getObjectByName('portrait-mask-guard'), undefined);
  }
}

for (const phase of [1, 2]) for (const invalid of ['cover', 'floor', 'near', 'death']) {
  const interrupted = fixture();
  if (phase === 2) startPhase2Blades(interrupted);
  else interrupted.step(0.01, first);
  const prefix = interrupted.throws.length;
  const count = phase === 2 ? 5 : 3;
  interrupted.until(() => interrupted.throws.length === prefix + count, first, 1.2);
  let target = first;
  if (invalid === 'cover') interrupted.level.blockers.push(comboWall);
  else if (invalid === 'floor') {
    interrupted.level.getFloorHeightAt = (_x, z) => z > 6 ? 2.4 : 0;
    target = new THREE.Vector3(0, 4.1, 8);
  } else if (invalid === 'near') target = interrupted.boss.getPosition().clone().add(new THREE.Vector3(0, 1.7 - portraitGroundOffsetY, 1));
  else damageForState(interrupted.boss, interrupted.boss.getHealth());
  interrupted.run(0.8, target);
  assert.equal(interrupted.throws.length, prefix + count, `${invalid} annule réellement les lames restantes`);
  assert.equal(interrupted.boss.isComboTransition(), false);
  assert.equal(interrupted.boss.isMaskExposed(), invalid !== 'death');
}

const protectedDamage = fixture();
protectedDamage.step(0.01, near);
assert.equal(protectedDamage.boss.isMaskExposed(), false);
damageForState(protectedDamage.boss, 40, true);
assert.equal(protectedDamage.boss.getHealth(), guardianConfig.health - 40, 'La classe ne divise pas à nouveau les dégâts tête déjà calculés par Game');
protectedDamage.until(() => protectedDamage.boss.getState() === 'RECOVER', near, 1.5);
assert.equal(protectedDamage.boss.isMaskExposed(), true);
damageForState(protectedDamage.boss, 80, true);
assert.equal(protectedDamage.boss.getHealth(), guardianConfig.health - 120);
assert.equal(protectedDamage.boss.getMesh().getObjectByName('portrait-mask-guard'), undefined);

const transformPoses = fixture();
enterTransformation(transformPoses);
assert.equal(poseOf(transformPoses.boss), 'transform-a.png');
assert.equal(transformPoses.boss.isMaskExposed(), false);
transformPoses.run(guardianConfig.transformationDuration / 3 + 0.01, first);
assert.equal(poseOf(transformPoses.boss), 'transform-b.png');
transformPoses.run(guardianConfig.transformationDuration / 3 + 0.01, first);
assert.equal(poseOf(transformPoses.boss), 'transform-c.png');
transformPoses.until(() => !transformPoses.boss.isTransforming(), first, 0.5);
assert.equal(poseOf(transformPoses.boss), 'phase2-idle.png', 'La nouvelle silhouette reste permanente après transformation');
assert.equal(transformPoses.boss.isMaskExposed(), false);

const rushIntoFirstVolley = fixture();
startPhase2Blades(rushIntoFirstVolley);
const beforeRush = rushIntoFirstVolley.throws.length;
const underBoss = rushIntoFirstVolley.boss.getPosition().clone().add(new THREE.Vector3(0, 1.7 - portraitGroundOffsetY, 0));
rushIntoFirstVolley.run(guardianConfig.attackWindup + 0.01, underBoss);
assert.equal(rushIntoFirstVolley.throws.length, beforeRush, 'Aucune première salve de cinq lames à bout portant si le joueur s’est rapproché');
assert.equal(rushIntoFirstVolley.boss.getAttackKind(), 'sweep');
assert.deepEqual(rushIntoFirstVolley.hits, [], 'Le nouveau balayage a sa propre anticipation, sans coup immédiat');
rushIntoFirstVolley.run(guardianConfig.attackWindup + 0.01, underBoss);
assert.deepEqual(rushIntoFirstVolley.hits, [24], 'Superposer exactement les racines ne neutralise pas le balayage annoncé');

// La poursuite gagne réellement en distance, tout en arrêtant un grand pas au contact.
for (const [phase, speed] of [[1, guardianConfig.speed], [2, guardianConfig.secondPhaseSpeed]]) {
  const pressure = fixture();
  if (phase === 2) {
    enterTransformation(pressure);
    pressure.until(() => !pressure.boss.isTransforming(), far, 2);
  }
  const start = pressure.boss.getPosition().clone();
  pressure.run(0.5, far);
  assert.ok(Math.abs(pressure.boss.getPosition().z - start.z - speed * 0.5) < 1e-6, 'La vitesse de poursuite correspond à la phase');
}
const contact = fixture();
contact.level.blockers.push(blocker);
const closeTarget = new THREE.Vector3(0, 1.7, 1.3);
contact.step(1, closeTarget);
assert.ok(Math.hypot(closeTarget.x - contact.boss.getPosition().x, closeTarget.z - contact.boss.getPosition().z)
  >= guardianConfig.approachStopDistance - 1e-8, 'Même un grand delta ne fait pas traverser le joueur pendant l’approche');
const underPlayer = fixture();
underPlayer.level.getFloorHeightAt = x => x > 0.2 ? 2.4 : 0;
underPlayer.level.findNextWaypoint = () => new THREE.Vector3(0, 0, 4);
const separatingFloor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 6, 3));
separatingFloor.position.set(0.25, 3, 0);
underPlayer.level.blockers.push(separatingFloor);
const upperPlayer = new THREE.Vector3(0.5, 4.1, 0);
underPlayer.boss.alert(upperPlayer);
underPlayer.step(0.05, upperPlayer);
assert.ok(underPlayer.boss.getPosition().z > 0, 'La proximité en XZ ne bloque pas la navigation vers un joueur à un autre étage');
separatingFloor.geometry.dispose(); separatingFloor.material.dispose();
const disposedAlive = fixture();
disposedAlive.step(0.01, first);
disposedAlive.boss.dispose(disposedAlive.scene);
disposedAlive.boss.dispose(disposedAlive.scene);
const eventsAtDispose = disposedAlive.events.length;
disposedAlive.run(5, first);
assert.equal(disposedAlive.events.filter(e => e.kind === 'cancel').length, 1);
assert.equal(disposedAlive.events.length, eventsAtDispose, 'Nettoyer un boss vivant annule aussi sa présentation une seule fois');
comboWall.geometry.dispose(); comboWall.material.dispose();

function projectileTest({ target, player, wallZ, delta = 0.5 }) {
  const scene = new THREE.Scene();
  const projectile = new GuardianProjectile(scene, new THREE.Vector3(0, 1.7, 0), target);
  const blockers = [];
  if (wallZ !== undefined) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2));
    wall.position.set(0, 1.7, wallZ);
    blockers.push(wall);
  }
  const hits = [];
  const alive = projectile.update(delta, scene, { getSolidMeshes: () => blockers }, player, (damage) => hits.push(damage));
  projectile.dispose(scene);
  assert.equal(scene.children.length, 0);
  for (const wall of blockers) { wall.geometry.dispose(); wall.material.dispose(); }
  return { hits, alive };
}
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(0, 1.7, 6) }).hits, [18], 'segment balayé sans traverser le joueur');
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(0, 1.7, 6), wallZ: 3 }).hits, [], 'premier obstacle avant joueur');
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(3, 1.7, 6) }).hits, [], 'esquive latérale');
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(0, 4.1, 6) }).hits, [], 'aucune extension verticale du volume');
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(0, 1.7, 49), delta: 10 }).hits, [], 'aucun trajet après trois secondes');
assert.equal(projectileTest({ target: first, player: first, delta: 0 }).alive, true, 'projectile suspendu hors simulation');

const sprintScene = new THREE.Scene();
const chaseKey = new GuardianProjectile(sprintScene, new THREE.Vector3(0, 1.7, 0), first);
const sprintHits = [];
for (let time = 0.01; time < 3; time += 0.01) {
  if (!chaseKey.update(0.01, sprintScene, { getSolidMeshes: () => [] },
    new THREE.Vector3(0, 1.7, 8 + 9 * time), (damage) => sprintHits.push(damage))) break;
}
assert.deepEqual(sprintHits, [18], 'le sprint arrière à 9 m/s ne suffit pas contre un jet aligné');
assert.equal(chaseKey.update(1, sprintScene, { getSolidMeshes: () => [] }, first, () => assert.fail('impact tardif')), false);
chaseKey.dispose(sprintScene);
assert.equal(sprintScene.children.length, 0);

const oldGeometry = route.boss.getMesh().geometry;
const oldTexture = route.boss.getMesh().material.map;
const oldDepth = route.boss.getMesh().customDepthMaterial;
const oldDistance = route.boss.getMesh().customDistanceMaterial;
const disposed = [0, 0, 0, 0];
for (const [i, resource] of [oldGeometry, oldTexture, oldDepth, oldDistance].entries()) resource.addEventListener('dispose', () => disposed[i]++);
for (const f of fixtures) {
  f.boss.dispose(f.scene);
  f.boss.dispose(f.scene);
  assert.equal(f.scene.children.length, 0, 'Nettoyage idempotent du boss et du marquage');
}
GuardianZombie.disposeSharedResources();
GuardianZombie.disposeSharedResources();
assert.deepEqual(disposed, [1, 1, 1, 1], 'Géométrie, texture et deux matériaux d’ombre libérés une seule fois');
GuardianZombie.warmup();
const recreated = fixture();
assert.notEqual(recreated.boss.getMesh().geometry, oldGeometry, 'Le cache graphique peut être recréé après destruction');
recreated.boss.dispose(recreated.scene);
GuardianZombie.disposeSharedResources();
blocker.geometry.dispose();
blocker.material.dispose();
disposeAllZombieResources();
console.log('Maître : éventail, déchirure, balayage phase II, transformation vulnérable, cible engagée, obstacles, étages, pause, décès et nettoyage : OK');

for (const pose of portraitAnimation.poses) {
  const file = `public/assets/zombies/portrait/${pose}.png`;
  assert.ok(existsSync(file), `Pose dédiée présente : ${pose}`);
  const png = readSpritePng(file);
  assert.deepEqual([png.width, png.height], [portraitSprite.width, portraitSprite.height]);
  const bounds = alphaBounds(png);
  assert.ok(bounds, `Silhouette visible : ${pose}`);
  assert.equal(bounds.y + bounds.height, portraitSprite.groundY, `Appui commun au jeu et à l’aperçu : ${pose}`);
  assert.ok(bounds.x > 0 && bounds.x + bounds.width < png.width, `Silhouette complète sans coupe latérale : ${pose}`);
  for (const pixel of [0, png.width - 1, png.width * (png.height - 1), png.width * png.height - 1]) assert.equal(png.data[pixel * 4 + 3], 0, 'Coins transparents');
  const regions = portraitSprite.heads[`${pose}.png`];
  assert.ok(Array.isArray(regions), `Zone de tête renseignée pour ${pose}`);
  assert.equal(regions.length, pose === 'death' ? 0 : 1, `Une tête vulnérable, sauf cadavre : ${pose}`);
  const map = new THREE.Texture({ width: png.width, height: png.height, src: `/assets/zombies/portrait/${pose}.png` });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ map }));
  for (const [left, top, right, bottom] of regions) {
    const x = (left + right) / 2, y = (top + bottom) / 2;
    assert.ok(png.data[(Math.floor(y) * png.width + Math.floor(x)) * 4 + 3] > 102, `Visage réellement visible : ${pose}`);
    assert.equal(isHeadSpriteHit(mesh, new THREE.Vector2(x / png.width, 1 - y / png.height)), true, `Le vrai routage de tir reconnaît la tête : ${pose}`);
  }
  assert.equal(isHeadSpriteHit(mesh, new THREE.Vector2(0.5, 0.12)), false, 'Les jambes ne comptent pas comme tête');
  mesh.geometry.dispose(); mesh.material.dispose(); map.dispose();
}
console.log('Maître : PNG, alpha, appuis, cadrage et zones de tête : OK. Contrôles logiques/fichiers ; aucun combat joué.');
