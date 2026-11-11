import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });

class Element extends EventTarget {
  properties = new Map();
  style = { setProperty: (key, value) => this.properties.set(key, value) };
  classes = new Set();
  classList = {
    toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
    add: (name) => this.classes.add(name), remove: (name) => this.classes.delete(name),
  };
}
const canvas = new Element();
const hud = new Element();
globalThis.window = Object.assign(new EventTarget(), { innerHeight: 900 });
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: canvas, hidden: false, hasFocus: () => true,
  querySelector: () => hud, querySelectorAll: () => [],
});
const sounds = [];
globalThis.Audio = class {
  volume = 1;
  currentTime = 0;
  paused = true;
  constructor(src) { this.src = src; }
  play() { this.paused = false; sounds.push(this.src); return Promise.resolve(); }
  pause() { this.paused = true; }
};
const { Weapon } = await import('../src/Weapon.ts');
const { axeAttack } = await import('../src/AxeAnimation.ts');
const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
camera.position.y = 1.7;
const hits = [], impacts = [], shots = [], casings = [];
const weapon = new Weapon(camera, canvas, [], [], (...args) => hits.push(args), () => true, () => {});
let soundStops = 0;
weapon.soundBank = { play(url) { sounds.push(url); }, stop() { soundStops++; }, setVolume() {}, dispose() {} };
weapon.setOnShoot((_, id) => shots.push(id));
weapon.setOnImpact(impact => impacts.push(impact));
weapon.setOnCasingEject((_, id) => casings.push(id));
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
function target(x = 0, z = -1.7) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2), material);
  mesh.position.set(x, 1, z);
  return mesh;
}
function mouse(button = 0) {
  const event = new Event('mousedown');
  Object.defineProperty(event, 'button', { value: button });
  canvas.dispatchEvent(event);
}
function key(code) {
  const event = new Event('keydown');
  Object.defineProperty(event, 'code', { value: code });
  window.dispatchEvent(event);
}
function reset(targets = [], blockers = []) {
  weapon.resetForNewRun(); hits.length = impacts.length = shots.length = casings.length = 0;
  sounds.length = 0;
  camera.position.set(0, 1.7, 0); camera.rotation.set(0, 0, 0);
  weapon.setTargets(targets); weapon.blockers = blockers;
  document.pointerLockElement = canvas; document.hidden = false;
}

assert.equal(weapon.getActiveWeaponId(), 'axe');
assert.equal(weapon.isWeaponUnlocked('pistol'), false);
assert.equal(weapon.isWeaponUnlocked('shotgun'), false);
assert.equal(weapon.reload(), false);
assert.equal(weapon.addAmmo(10), false);
mouse(2); weapon.update(0.2);
assert.equal(weapon.aimAmount, 0, 'La hache ne zoome pas');
key('Digit2'); assert.equal(weapon.getActiveWeaponId(), 'axe', 'Pistolet verrouillé');
const victim = target();
const inRange = () => hud.classes.has('axe-in-range');
reset([victim]);
weapon.update(0.016);
assert.equal(inRange(), true, 'Une cible exposée à portée modifie le réticule');
assert.equal(hits.length + impacts.length + shots.length + sounds.length, 0, 'Le repère ne déclenche aucun coup');
mouse();
assert.equal(inRange(), false, 'Le repère disparaît pendant le geste');
assert.equal(hits.length, 0, 'Pas de dégâts au clic');
assert.deepEqual(shots, ['axe']);
weapon.update(axeAttack.impactTime - 0.01);
assert.equal(hits.length, 0, 'Anticipation complète avant le contact');
assert.deepEqual(sounds, []);
weapon.update(0.02);
assert.equal(hits.length, 1);
assert.equal(hits[0][0], victim);
assert.equal(hits[0][1], 55);
assert.equal(hits[0][2].headHits, 0, 'Pas de bonus tête implicite');
assert.equal(hits[0][2].stunSeconds, 0.85);
assert.equal(weapon.muzzleLight.intensity, 0);
assert.equal(casings.length, 0);
assert.equal(weapon.getAmmo(), 0, 'Aucune fausse munition');
assert.deepEqual(sounds, ['/assets/sounds/axe-flesh.wav']);
window.dispatchEvent(new Event('blur'));
assert.ok(soundStops > 0, 'La perte de focus coupe les effets');
window.dispatchEvent(new Event('focus'));
assert.equal(sounds.length, 1, 'Le retour du focus ne relance pas le contact');
mouse(); assert.equal(shots.length, 1, 'Récupération obligatoire');
weapon.unlockWeapon('pistol');
assert.equal(weapon.getActiveWeaponId(), 'axe', 'Changer d’arme ne coupe pas la récupération');
weapon.update(axeAttack.duration);
assert.equal(hits.length, 1, 'Un seul événement de contact à grand delta');
assert.equal(inRange(), true, 'Le repère revient après récupération');
key('Digit2'); assert.equal(weapon.getActiveWeaponId(), 'pistol');
assert.equal(inRange(), false, 'Le changement d’arme enlève le repère');
weapon.unlockWeapon('shotgun'); key('Digit1'); assert.equal(weapon.getActiveWeaponId(), 'axe');
key('Numpad3'); assert.equal(weapon.getActiveWeaponId(), 'shotgun');
weapon.nextWeapon(); assert.equal(weapon.getActiveWeaponId(), 'axe');
weapon.prevWeapon(); assert.equal(weapon.getActiveWeaponId(), 'shotgun');
assert.equal(weapon.recoilDuration, 2, 'Recul des armes à feu conservé');

reset([victim]); mouse(); weapon.update(0.3);
document.pointerLockElement = null; weapon.update(3);
assert.equal(weapon.axeAttackTime, 0.3, 'Perte de capture : coup suspendu');
assert.equal(hits.length, 0);
document.pointerLockElement = canvas; document.hidden = true; weapon.update(3);
assert.equal(weapon.axeAttackTime, 0.3, 'Onglet masqué : coup suspendu');
document.hidden = false; weapon.update(0); assert.equal(hits.length, 0);
weapon.update(0.33); assert.equal(hits.length, 1, 'Reprise : contact unique');

reset([victim]); mouse(); weapon.update(0.3);
camera.position.z = 3; weapon.update(0.4);
assert.equal(hits.length, 0, 'Portée évaluée au contact, pas au départ');
reset([target(0, -3)]); weapon.update(0.016);
assert.equal(inRange(), false, 'Une cible visible hors de portée ne modifie pas le réticule');
mouse(); weapon.update(1);
assert.equal(hits.length, 0, 'Cible hors portée');
const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), material);
wall.position.set(0, 1.7, -0.7);
reset([victim], [wall]); weapon.update(0.016);
assert.equal(inRange(), false, 'Un mur masque aussi la cible pour le réticule');
mouse(); weapon.update(1);
assert.equal(hits.length, 0, 'Le mur arrête la hache');
assert.equal(impacts.length, 1);
assert.equal(impacts[0].kind, 'surface');
assert.deepEqual(sounds, ['/assets/sounds/impact-stone-soft.wav']);
const frame = target();
frame.userData.impactMaterial = 'portrait';
reset([frame]); mouse(); weapon.update(1);
assert.deepEqual(sounds, ['/assets/sounds/impact-wood-soft.wav']);
// Une cible visible à côté d'un jambage peut recevoir le coup ; le jambage
// continue d'occulter chacun de ses propres rayons.
const jamb = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 3), material);
jamb.position.set(0.11, 1.7, -1);
reset([victim], [jamb]); mouse(); weapon.update(1);
assert.equal(hits.length, 1, 'Un obstacle périphérique ne masque pas le rayon central clair');
reset([victim, target(0.5, -1.8)]); mouse(); weapon.update(1);
assert.equal(hits.length, 1, 'Une cible maximum par coup');
reset([victim]); mouse(); weapon.update(0.3); weapon.resetForNewRun();
weapon.setTargets([victim]); weapon.update(2);
assert.equal(hits.length, 0, 'Nouvelle tentative : aucun contact tardif');
reset([victim]); mouse(); weapon.update(0.3); weapon.cancelMeleeAttack(); weapon.update(2);
assert.equal(hits.length, 0, 'Transition/debug : aucun contact hérité');
assert.equal(inRange(), true);
document.pointerLockElement = null;
document.dispatchEvent(new Event('pointerlockchange'));
assert.equal(inRange(), false, 'Le repère se nettoie dès la perte de capture');
// Le vrai trajet Weapon → Game → Zombie applique dégâts et interruption ensemble.
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const { Game } = await import('../src/Game.ts');
const { Zombie, disposeAllZombieResources } = await import('../src/Zombie.ts');
const scene = new THREE.Scene();
const ordinary = new Zombie(scene, { getFloorHeightAt: () => 0 }, 0, -1.7, 'standard', () => 1);
const game = Object.create(Game.prototype);
let kills = 0;
Object.assign(game, { zombies: [ordinary], checkTierCompletion() {}, updateObjectiveDisplay() {}, onZombieKilled() { kills++; } });
weapon.onHit = (mesh, damage, shot) => game.handleWeaponHit(mesh, damage, shot);
reset([ordinary.getMesh()]);
mouse(); weapon.update(axeAttack.impactTime);
assert.equal(ordinary.health, 45);
assert.equal(ordinary.hurtRemaining, axeAttack.stunSeconds);
assert.equal(ordinary.attackWindupRemaining, 0);
assert.equal(kills, 0);
weapon.update(axeAttack.duration - axeAttack.impactTime);
mouse(); weapon.update(axeAttack.impactTime);
assert.equal(ordinary.isAlive(), false);
assert.equal(kills, 1, 'Deux coups tuent le standard et notifient une seule élimination');
ordinary.dispose(scene); disposeAllZombieResources();
weapon.dispose();
console.log('OK hache : départ/slots, contact différé unique, portée/décor, pause/focus, récupération et reset ; recul 2 s conservé.');
