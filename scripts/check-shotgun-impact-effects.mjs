import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HitEffects } from '../src/HitEffects.ts';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
const effects = new HitEffects(scene);
const target = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), new THREE.MeshBasicMaterial());
scene.add(target);
const impact = {
  kind: 'zombie', object: target,
  point: new THREE.Vector3(0, 1.2, -3),
  normal: new THREE.Vector3(0, 0, 1),
  direction: new THREE.Vector3(0, 0, -1),
};
const random = Math.random;
Math.random = () => 0.5;
const capture = () => effects.particles.map(({ mesh, velocity, age, lifetime }) => ({
  position: mesh.position.toArray(), rotation: mesh.quaternion.toArray(),
  scale: mesh.scale.toArray(), opacity: mesh.material.opacity,
  velocity: velocity.toArray(), age, lifetime,
}));

try {
  effects.emit({ ...impact, weaponId: 'pistol' });
  assert.equal(effects.particles.length, 9, 'Profil pistolet conservé');
  assert.equal(effects.marks.length, 0, 'Pas de trace persistante sur une cible');
  effects.clear();

  effects.emit({ ...impact, weaponId: 'shotgun', power: 0.1 });
  const weakCount = effects.particles.length;
  const weakSpeed = effects.particles.reduce((total, p) => total + p.velocity.length(), 0) / weakCount;
  effects.clear();
  effects.emit({ ...impact, weaponId: 'shotgun', power: 1 });
  assert(effects.particles.length > weakCount, 'Touche pleine plus dense qu’un plomb périphérique');
  const strongSpeed = effects.particles.reduce((total, p) => total + p.velocity.length(), 0) / effects.particles.length;
  assert(strongSpeed > weakSpeed, 'Touche pleine plus énergique');
  const travelling = effects.particles.filter(p => p.velocity.dot(impact.direction) > 0);
  const returning = effects.particles.filter(p => p.velocity.dot(impact.direction) < 0);
  assert(travelling.length > returning.length && returning.length > 0,
    'Gerbe principalement dans le sens du tir, avec éclats visibles devant le sprite');
  assert(effects.particles.some(p => p.velocity.x < 0) && effects.particles.some(p => p.velocity.x > 0),
    'Éclats distribués des deux côtés de la silhouette');
  assert(effects.particles.every(p => p.lifetime < 0.4 && p.mesh.scale.y < 0.2),
    'Effet bref et petits fragments, sans voile plein écran');
  const bloodColors = new Set(effects.particles.map(p => p.mesh.material.color.getHex()));

  effects.update(0.05, camera);
  const paused = capture();
  camera.rotation.set(0.1, 0.3, 0.2);
  effects.update(0, camera);
  assert.deepEqual(capture(), paused, 'Pause : position, orientation, opacité et vitesse figées');
  effects.update(-1, camera);
  effects.update(NaN, camera);
  assert.deepEqual(capture(), paused, 'Delta invalide sans mutation');
  effects.update(0.4, camera);
  assert.equal(effects.particles.length, 0, 'Expiration complète');

  target.userData.impactMaterial = 'portrait';
  effects.emit({ ...impact, weaponId: 'shotgun', power: 1 });
  const paintColors = new Set(effects.particles.map(p => p.mesh.material.color.getHex()));
  assert(paintColors.has(0xd4c6a5) && paintColors.has(0xb69a60), 'Toile ivoire et laiton du Maître du Portrait');
  assert([...paintColors].every(color => !bloodColors.has(color)), 'Palette du boss distincte du sang');
  assert(effects.particles.some(p => p.mesh.scale.y > p.mesh.scale.x * 2), 'Fragments de toile allongés');

  effects.clear();
  const rotatedDirection = new THREE.Vector3(1, 0, 0);
  effects.emit({ ...impact, direction: rotatedDirection, weaponId: 'shotgun', power: 1 });
  assert(effects.particles.filter(p => p.velocity.x > 0).length > effects.particles.length / 2,
    'La gerbe suit un tir latéral, pas un axe monde fixe');

  for (let i = 0; i < 20; i++) effects.emit({ ...impact, weaponId: 'shotgun', power: 1 });
  assert.equal(effects.particles.length, 64, 'Budget global borné en tirs soutenus');
  assert.equal(effects.marks.length, 0, 'Aucune trace sang/toile persistante');
  let freedMaterials = 0;
  const count = effects.particles.length;
  for (const p of effects.particles) p.mesh.material.addEventListener('dispose', () => freedMaterials++);
  effects.dispose();
  assert.equal(freedMaterials, count, 'Chaque matériau actif est libéré');
  assert.equal(scene.children.length, 1, 'Le nettoyage retire les fragments et conserve le décor');
} finally {
  Math.random = random;
}
console.log('OK : gerbe fusil graduée/directionnelle, sang et toile, pause, budget et nettoyage.');
