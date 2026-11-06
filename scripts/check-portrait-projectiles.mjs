import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';
import { portraitProjectileAnimation as animation, portraitFlightFrame, portraitImpactFrame } from '../src/PortraitProjectileAnimation.ts';
import { getPortraitProjectileResources } from '../src/PortraitProjectileResources.ts';
import { GuardianProjectile } from '../src/GuardianProjectile.ts';
import { PortraitProjectileImpacts } from '../src/PortraitProjectileImpacts.ts';

for (const [kind, config] of Object.entries({ flight: animation.flight, impact: animation.impact })) {
  const image = readSpritePng('public' + config.url);
  assert.equal(image.width, config.columns * config.cellWidth);
  assert.equal(image.height, config.rows * config.cellHeight);
  for (let frame = 0; frame < config.frames; frame++) {
    const x = frame % config.columns * config.cellWidth;
    const y = Math.floor(frame / config.columns) * config.cellHeight;
    const bounds = alphaBounds(image, { x, y, width: config.cellWidth, height: config.cellHeight });
    assert.ok(bounds, `${kind}${frame} : cellule non vide`);
    assert.ok(bounds.x > x && bounds.y > y && bounds.x + bounds.width < x + config.cellWidth
      && bounds.y + bounds.height < y + config.cellHeight, 'Marges sans découpe ni fuite entre cellules');
    const at = ((y + config.anchorY) * image.width + x + config.anchorX) * 4;
    assert.ok(image.data[at + 3] >= 102, `${kind}${frame} : ancrage sur un pixel réel`);
    if (kind === 'flight') assert.ok(image.data[at] > 170 && image.data[at + 1] > 140, 'Noyau ivoire stable et lisible');
    for (const [px, py] of [[x, y], [x + config.cellWidth - 1, y + config.cellHeight - 1]])
      assert.equal(image.data[(py * image.width + px) * 4 + 3], 0, 'Vrai alpha aux coins');
  }
}
assert.equal(portraitFlightFrame(0), 0);
assert.equal(portraitFlightFrame(0.055), 1);
assert.equal(portraitFlightFrame(0.33), 0);
assert.equal(portraitImpactFrame(0.27), 3);

const originalLoad = THREE.TextureLoader.prototype.load;
const loads = [];
THREE.TextureLoader.prototype.load = function (url) {
  loads.push(url);
  const config = url === animation.flight.url ? animation.flight : animation.impact;
  return new THREE.Texture({ width: config.columns * config.cellWidth, height: config.rows * config.cellHeight, src: url });
};
try {
  GuardianProjectile.warmup(); PortraitProjectileImpacts.warmup();
  assert.equal(loads.length, 2, 'Deux atlas chargés une seule fois');
  const resources = getPortraitProjectileResources();
  for (const [kind, atlas] of Object.entries(resources)) {
    const config = animation[kind];
    assert.equal(atlas.texture.offset.x, 0); assert.equal(atlas.texture.offset.y, 0);
    assert.equal(atlas.texture.magFilter, THREE.NearestFilter);
    assert.equal(atlas.material.forceSinglePass, true, 'Un seul passage par lame/impact transparent à deux faces');
    assert.equal(atlas.material.depthWrite, false);
    for (let frame = 0; frame < atlas.geometries.length; frame++) {
      const mesh = new THREE.Mesh(atlas.geometries[frame], atlas.material);
      mesh.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, 'Le noyau/contact est dans le plan réel');
      const uv = atlas.texture.transformUv(hit.uv.clone());
      const pixelX = uv.x * config.columns * config.cellWidth;
      const pixelY = uv.y * config.rows * config.cellHeight;
      assert.ok(Math.abs(pixelX - (frame % config.columns * config.cellWidth + config.anchorX)) < 0.0001,
        'UV et origine physique partagent le même noyau horizontal');
      assert.ok(Math.abs(pixelY - (Math.floor(frame / config.columns) * config.cellHeight + config.anchorY)) < 0.0001,
        'UV haut/bas et origine physique partagent le même ancrage vertical');
      assert.ok(atlas.geometries[frame].boundingSphere.radius > 0, 'Frustum conforme à la géométrie décalée');
    }
  }

  const scene = new THREE.Scene();
  const origin = new THREE.Vector3(0, 1.7, 0), target = new THREE.Vector3(0, 1.7, 30);
  const viewer = new THREE.Vector3(5, 1.7, -2), noWalls = { getSolidMeshes: () => [] };
  const projectile = new GuardianProjectile(scene, origin, target);
  const object = scene.children[0], sprite = object.children[0];
  const firstGeometry = sprite.geometry;
  projectile.update(0, scene, noWalls, viewer, () => assert.fail('Dégât pendant pause'));
  assert.ok(projectile.getPosition().equals(origin)); assert.equal(sprite.geometry, firstGeometry);
  projectile.update(0.06, scene, noWalls, viewer, () => assert.fail('Joueur hors axe'));
  assert.ok(Math.abs(projectile.getPosition().z - 0.96) < 1e-8, 'Noyau physique à16m/s, sans offset du dessin');
  assert.equal(sprite.geometry, resources.flight.geometries[1]);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion);
  assert.ok(normal.dot(viewer.clone().sub(object.position).normalize()) > 0.9999, 'Sprite lisible même depuis un angle oblique');
  const other = new GuardianProjectile(scene, new THREE.Vector3(1, 1.7, 0), target);
  other.update(0.12, scene, noWalls, viewer, () => {});
  assert.equal(sprite.geometry, resources.flight.geometries[1], 'Autre animation sans mutation des UV partagés');
  assert.equal(resources.flight.texture.offset.x, 0); assert.equal(resources.flight.texture.offset.y, 0);
  projectile.dispose(scene); projectile.dispose(scene); other.dispose(scene);
  assert.equal(scene.children.length, 0);

  function shot({ wallZ, delta = 0.5, player = new THREE.Vector3(0, 1.7, 6) } = {}) {
    const scene = new THREE.Scene(), trails = [], impacts = [], hits = [];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 0.2));
    wall.position.set(0, 1.7, wallZ ?? 3);
    const shot = new GuardianProjectile(scene, origin, target, {
      trail(position) { trails.push(position.clone()); }, impact(position) { impacts.push(position.clone()); },
    });
    const alive = shot.update(delta, scene, { getSolidMeshes: () => wallZ === undefined ? [] : [wall] }, player, damage => hits.push(damage));
    const end = shot.getPosition().clone();
    shot.dispose(scene);
    assert.equal(shot.update(1, scene, noWalls, target, () => assert.fail('Dégât après destruction')), false);
    assert.equal(scene.children.length, 0);
    wall.geometry.dispose(); wall.material.dispose();
    return { alive, trails, impacts, hits, end };
  }
  const blocked = shot({ wallZ: 3 });
  assert.deepEqual(blocked.hits, []); assert.equal(blocked.impacts.length, 1);
  assert.ok(blocked.impacts[0].z < 3 && blocked.trails.every(p => p.z <= blocked.impacts[0].z), 'Impact/traînée arrêtés au premier obstacle');
  assert.deepEqual(shot().hits, [18], 'Dégâts inchangés, collision par segment balayé');
  assert.deepEqual(shot({ player: new THREE.Vector3(2, 1.7, 6) }).hits, [], 'Esquive latérale réelle');
  const expired = shot({ delta: 100, player: new THREE.Vector3(0, 1.7, 50) });
  assert.deepEqual(expired.hits, []); assert.equal(expired.alive, false);
  assert.ok(Math.abs(expired.end.z - 48) < 1e-8, 'Un grand delta ne dépasse jamais les3secondes de vie');

  const poolScene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const pool = new PortraitProjectileImpacts(poolScene);
  assert.equal(poolScene.children.length, 10, 'Pool fixe préparé au constructeur');
  const meshes = [...poolScene.children], positions = [];
  for (let i = 0; i < 25; i++) { const pos = new THREE.Vector3(i, 0, 0); positions.push(pos); pool.impact(pos, new THREE.Vector3(0, 0, 1)); }
  assert.equal(pool.getStats().active, 10); assert.equal(pool.getStats().reused, 15);
  assert.ok(pool.getStats().drawCalls <= 10); assert.equal(poolScene.children.length, 10);
  const before = meshes.map(mesh => mesh.geometry);
  pool.update(0, camera);
  assert.deepEqual(meshes.map(mesh => mesh.geometry), before, 'Pause des impacts et pas de reset de chronologie');
  pool.update(0.08, camera);
  assert.ok(meshes.every(mesh => mesh.geometry === resources.impact.geometries[1]));
  pool.update(0.3, camera); assert.equal(pool.getStats().active, 0);
  const resourceCount = poolScene.children.length;
  const closePosition = new THREE.Vector3(0, 0, 0);
  camera.position.set(0, 0, 0.5);
  pool.impact(closePosition);
  assert.equal(meshes[0].scale.x, 1, 'Chaque nouvel impact réinitialise son échelle');
  pool.update(0.01, camera);
  assert.equal(pool.getStats().active, 1, 'Impact trop proche encore vivant dans le pool');
  assert.equal(pool.getStats().drawCalls, 0, 'Impact à moins de0,7m masqué sans couvrir la vue');
  assert.equal(meshes[0].visible, false);
  camera.position.z = 1;
  pool.update(0.01, camera);
  assert.equal(meshes[0].visible, true);
  assert.ok(Math.abs(meshes[0].scale.x - 1 / 1.4) < 1e-8, 'Impact proche réduit selon la distance');
  camera.position.z = 3;
  pool.update(0.01, camera);
  assert.equal(meshes[0].scale.x, 1, 'Impact distant à la taille normale');
  pool.update(0.3, camera);
  assert.equal(pool.getStats().active, 0, 'La chronologie continue et expire même après masquage proche');
  assert.equal(poolScene.children.length, resourceCount, 'Masquage/échelle sans allocation de meshes supplémentaires');
  pool.impact(origin); pool.clear(); assert.equal(pool.getStats().active, 0);
  pool.dispose(); pool.dispose(); pool.impact(origin); pool.update(1, camera);
  assert.equal(poolScene.children.length, 0); assert.equal(pool.getStats().active, 0);
  assert.equal(loads.length, 2, 'Les vols et25impacts ne chargent aucun atlas supplémentaire');

  const disposed = [];
  for (const atlas of Object.values(resources)) for (const resource of [atlas.texture, atlas.material, ...atlas.geometries])
    resource.addEventListener('dispose', () => disposed.push(resource));
  GuardianProjectile.disposeSharedResources(); PortraitProjectileImpacts.disposeSharedResources();
  assert.equal(disposed.length, 14, 'Deux textures/deux matériaux/dix géométries libérés exactement une fois');
} finally { THREE.TextureLoader.prototype.load = originalLoad; }
console.log('Projectiles Portrait : fichiers/alpha, noyau/UV, animations indépendantes, collision/couvert, durée/pause, pool10 et nettoyage OK. Combat non validé par ce script.');
