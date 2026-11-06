import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PortraitParticles } from '../src/PortraitParticles.ts';
import { GuardianProjectile } from '../src/GuardianProjectile.ts';
import { guardianConfig } from '../src/FinaleConfig.ts';
import { portraitProjectileAnimation } from '../src/PortraitProjectileAnimation.ts';

THREE.TextureLoader.prototype.load = url => new THREE.Texture({ src: url });

const origin = new THREE.Vector3(0, 0, 0);
const forward = new THREE.Vector3(0, 0, 1);
const camera = new THREE.PerspectiveCamera();
const matrix = new THREE.Matrix4();
function positions(mesh) {
  const result = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    if (new THREE.Vector3().setFromMatrixScale(matrix).length() < 0.1) continue;
    result.push(new THREE.Vector3().setFromMatrixPosition(matrix));
  }
  return result;
}

const scene = new THREE.Scene();
const particles = new PortraitParticles(scene, () => 0.5);
const mesh = scene.getObjectByName('portrait-paint-fragments');
assert.ok(mesh instanceof THREE.InstancedMesh);
assert.equal(scene.children.length, 1, 'Un seul objet rendu pour tout le pool');
assert.equal(mesh.castShadow, false);
assert.equal(mesh.receiveShadow, false);
assert.equal(mesh.frustumCulled, false, 'Les émissions restent visibles dans tout le manoir');
assert.equal(mesh.material.depthWrite, false);
assert.equal(mesh.material.transparent, true, 'Les fragments passent après le décor opaque');
assert.equal(mesh.material.opacity, 1, 'Chaque fragment reste opaque, sans voile global');
assert.equal(mesh.material.depthTest, true, 'Les murs continuent de masquer les fragments');
assert.equal(mesh.renderOrder, 3);
assert.ok(mesh.instanceColor, 'Couleurs instanciées préchauffées avant la première émission');
const allocations = [mesh.geometry, mesh.material, mesh.instanceMatrix, mesh.instanceColor];
for (let i = 0; i < 20; i++) particles.transformation(origin, 'burst');
assert.equal(particles.getStats().active, particles.getStats().capacity, 'La saturation ne dépasse jamais la capacité fixe');
assert.ok(particles.getStats().dropped > 0, 'Le surplus est abandonné sans agrandir les buffers');
assert.equal(particles.getStats().drawCalls, 1);
assert.deepEqual([mesh.geometry, mesh.material, mesh.instanceMatrix, mesh.instanceColor], allocations);
const paused = Array.from(mesh.instanceMatrix.array);
particles.update(0, camera);
assert.deepEqual(Array.from(mesh.instanceMatrix.array), paused, 'La pause fige exactement les particules');
particles.update(2, camera);
assert.equal(particles.getStats().active, 0, 'La vie courte borne la persistance après un long pas');
assert.equal(particles.getStats().drawCalls, 0);
assert.equal(mesh.visible, false);

camera.rotation.y = Math.PI / 2;
camera.updateMatrixWorld(true);
particles.update(0.01, camera);
const floorOrigin = new THREE.Vector3(10, 2.4, -3);
particles.transformation(floorOrigin, 'burst');
assert.equal(particles.getStats().active, 72);
const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
for (const point of positions(mesh)) {
  const lateral = Math.abs(point.clone().sub(floorOrigin).dot(right));
  assert.ok(lateral >= 0.5, 'La gerbe encadre le personnage même avec une caméra tournée');
  assert.ok(point.y >= floorOrigin.y + 0.9 && point.y <= floorOrigin.y + 1.8,
    'Les émissions restent à hauteur du cadre sous le masque');
}
let longCanvasStrips = 0;
for (let i = 0; i < mesh.count; i++) {
  mesh.getMatrixAt(i, matrix);
  const size = new THREE.Vector3().setFromMatrixScale(matrix);
  if (size.y >= 0.18 && size.x >= 0.03) longCanvasStrips++;
}
assert.ok(longCanvasStrips >= 30, 'La transformation détache de vrais lambeaux de toile lisibles');
particles.update(0.2, camera);
assert.equal(particles.getStats().active, 72, 'La gerbe est encore entière au moment utile pour sa lecture');
for (const point of positions(mesh)) {
  assert.ok(Math.abs(point.clone().sub(floorOrigin).dot(right)) > 0.8, 'À0,2s les lambeaux ont quitté le centre du visage');
}
const beforeClear = particles.getStats().emitted;
particles.clear();
assert.equal(particles.getStats().active, 0);
assert.equal(particles.getStats().emitted, beforeClear, 'Le nettoyage ne produit aucun nouvel effet');
assert.equal(mesh.visible, false);

particles.transformation(floorOrigin, 'gather');
const suspended = positions(mesh);
particles.update(0.55, camera);
assert.equal(particles.getStats().active, 18, 'La mise en tension reste visible avant la rupture');
positions(mesh).forEach((point, index) => {
  assert.ok(Math.abs(point.y - suspended[index].y) < 0.1, 'Les fragments de tension flottent au lieu de tomber en confettis');
});
particles.update(0.3, camera);
assert.equal(particles.getStats().active, 0, 'La tension ne persiste pas au-delà de la transformation');
particles.clear();

camera.rotation.set(0, 0, 0);
camera.updateMatrixWorld(true);
particles.update(0.01, camera);
particles.trail(new THREE.Vector3(1, 1, -3), new THREE.Vector3(1, 0, 0));
mesh.getMatrixAt(0, matrix);
const streakSize = new THREE.Vector3().setFromMatrixScale(matrix);
assert.ok(streakSize.x <= 0.035 && streakSize.y <= 0.065,
  'Les écailles restent compactes au lieu de relier visuellement les lames');
const longAxis = new THREE.Vector3().setFromMatrixColumn(matrix, 1).normalize();
assert.ok(Math.abs(longAxis.x) > 0.98, 'La traînée suit le mouvement projeté à l’écran');
particles.clear();

for (const [point, normal, outside] of [
  [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), p => p.z < 0],
  [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), p => p.y > 0],
  [new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0), p => p.y < 2],
]) {
  particles.impact(point, normal);
  particles.update(0.12, camera);
  assert.ok(positions(mesh).every(outside), 'Les éclats de contact restent du côté libre du mur/sol/plafond');
  particles.clear();
}

const disposed = [0, 0, 0, 0, 0];
mesh.geometry.addEventListener('dispose', () => disposed[0]++);
mesh.material.addEventListener('dispose', () => disposed[1]++);
mesh.addEventListener('dispose', () => disposed[2]++);
mesh.instanceMatrix.addEventListener('dispose', () => disposed[3]++);
mesh.instanceColor.addEventListener('dispose', () => disposed[4]++);
particles.dispose();
particles.dispose();
particles.trail(origin, forward);
particles.impact(origin);
particles.prepare(origin, forward, 'tear');
particles.transformation(origin, 'gather');
particles.update(0.1, camera);
assert.deepEqual(disposed, [1, 1, 1, 1, 1], 'Géométrie, matériau, objet et buffers instanciés libérés une seule fois');
assert.equal(scene.children.length, 0);
assert.equal(particles.getStats().active, 0, 'Aucune émission possible après destruction');

function fxRecorder() {
  const trail = [], impact = [], order = [];
  return { trail, impact, order, fx: {
    trail(point, direction) { trail.push({ point: point.clone(), direction: direction.clone() }); },
    impact(point, normal) { impact.push({ point: point.clone(), normal: normal?.clone() }); order.push('impact'); },
  } };
}
function flight(steps) {
  const scene = new THREE.Scene(), events = fxRecorder();
  const shot = new GuardianProjectile(scene, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 1.7, 20), events.fx);
  for (const delta of steps) assert.equal(shot.update(delta, scene, { getSolidMeshes: () => [] }, new THREE.Vector3(99, 99, 99), () => assert.fail('Joueur éloigné')), true);
  const pausedTrail = events.trail.length;
  shot.update(0, scene, { getSolidMeshes: () => [] }, new THREE.Vector3(99, 99, 99), () => {});
  assert.equal(events.trail.length, pausedTrail, 'Aucune traînée émise en pause');
  shot.dispose(scene);
  assert.equal(events.impact.length, 0, 'Disposer un projectile en vol ne crée pas un impact');
  assert.equal(scene.children.length, 0);
  return events;
}
const single = flight([0.25]);
const split = flight(Array.from({ length: 50 }, () => 0.005));
const spacing = portraitProjectileAnimation.trail.spacing;
assert.equal(single.trail.length, Math.floor(guardianConfig.projectileSpeed * 0.25 / spacing));
assert.equal(single.trail.length, split.trail.length, 'La densité dépend du trajet et non du nombre d’images');
single.trail.forEach((event, i) => {
  assert.ok(event.point.distanceTo(split.trail[i].point) < 1e-8, 'Mêmes marques spatiales pour un pas grand ou fin');
  assert.ok(Math.abs(event.point.z - (i + 1) * spacing) < 1e-8);
});

const shortTailScene = new THREE.Scene();
const shortTail = new PortraitParticles(shortTailScene, () => 1);
const shortTailMesh = shortTailScene.getObjectByName('portrait-paint-fragments');
const shortTailShot = new GuardianProjectile(shortTailScene, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 1.7, 20), shortTail);
for (let i = 0; i < 100; i++) {
  shortTailShot.update(0.01, shortTailScene, { getSolidMeshes: () => [] }, new THREE.Vector3(99, 99, 99), () => assert.fail('Joueur éloigné'));
  shortTail.update(0.01, camera);
  assert.ok(shortTail.getStats().active <= 2, 'Une lame ne laisse que deux écailles au maximum');
  for (const point of positions(shortTailMesh)) assert.ok(point.distanceTo(shortTailShot.getPosition()) < 1.4,
    'La traînée reste dans les 1,4 m derrière la lame au lieu de barrer toute la trajectoire');
}
shortTailShot.dispose(shortTailScene);
shortTail.update(0.08, camera);
assert.equal(shortTail.getStats().active, 0, 'La traînée disparaît en moins de 80 ms après le passage');
shortTail.dispose();

const wallScene = new THREE.Scene();
const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
wall.position.set(0, 1.7, 2);
wall.rotation.y = Math.PI * 1.25;
wallScene.add(wall);
const wallEvents = fxRecorder();
const wallShot = new GuardianProjectile(wallScene, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 1.7, 10), wallEvents.fx);
assert.equal(wallShot.update(1, wallScene, { getSolidMeshes: () => [wall] }, new THREE.Vector3(0, 1.7, 8), () => assert.fail('Le mur protège le joueur')), false);
assert.equal(wallEvents.impact.length, 1);
assert.ok(wallEvents.impact[0].point.distanceTo(new THREE.Vector3(0, 1.7, 2)) < 1e-7, 'Impact au vrai point de contact, sans dépassement du grand pas');
assert.ok(wallEvents.impact[0].normal.distanceTo(new THREE.Vector3(-Math.SQRT1_2, 0, -Math.SQRT1_2)) < 1e-7,
  'La normale suit la rotation réelle du mur');
assert.ok(wallEvents.trail.every(event => event.point.z < 2), 'Aucune traînée au-delà du couvert');
wallShot.dispose(wallScene);
wallShot.update(1, wallScene, { getSolidMeshes: () => [wall] }, origin, () => assert.fail('Dégât tardif'));
assert.equal(wallEvents.impact.length, 1, 'Aucun second impact au nettoyage');
wall.geometry.dispose(); wall.material.dispose(); wallScene.remove(wall);

const playerScene = new THREE.Scene(), playerEvents = fxRecorder();
const playerShot = new GuardianProjectile(playerScene, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 1.7, 8), playerEvents.fx);
assert.equal(playerShot.update(1, playerScene, { getSolidMeshes: () => [] }, new THREE.Vector3(0, 1.7, 2), () => playerEvents.order.push('damage')), false);
assert.deepEqual(playerEvents.order, ['impact', 'damage'], 'L’effet précède les dégâts qui peuvent vider la scène');
assert.ok(Math.abs(playerEvents.impact[0].point.z - 1.52) < 1e-8, 'Contact exact du volume joueur');

const defeatScene = new THREE.Scene();
const defeatParticles = new PortraitParticles(defeatScene, () => 0.5);
const defeatShot = new GuardianProjectile(defeatScene, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 1.7, 8), defeatParticles);
defeatShot.update(1, defeatScene, { getSolidMeshes: () => [] }, new THREE.Vector3(0, 1.7, 2), () => {
  defeatShot.dispose(defeatScene);
  defeatParticles.clear();
});
assert.equal(defeatParticles.getStats().active, 0, 'Une défaite qui nettoie la scène dans onHit ne réintroduit aucun effet');
assert.equal(defeatScene.children.length, 1, 'Le projectile reste retiré malgré le nettoyage réentrant');
defeatParticles.dispose();
assert.equal(defeatScene.children.length, 0);

const expiryScene = new THREE.Scene(), expiryEvents = fxRecorder();
const expiryShot = new GuardianProjectile(expiryScene, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 1.7, 80), expiryEvents.fx);
assert.equal(expiryShot.update(10, expiryScene, { getSolidMeshes: () => [] }, new THREE.Vector3(99, 99, 99), () => {}), false);
assert.equal(expiryEvents.impact.length, 0, 'L’expiration ne simule pas de collision');
assert.ok(expiryEvents.trail.at(-1).point.z <= guardianConfig.projectileSpeed * guardianConfig.projectileLifetime,
  'La dernière traînée respecte la durée de vie malgré un grand pas');
assert.equal(expiryScene.children.length, 0);
GuardianProjectile.disposeSharedResources();

console.log('Portrait FX : pool borné, buffers stables, pause, appuis hors masque, normales, nettoyage, cadence spatiale et contacts uniques : OK.');
