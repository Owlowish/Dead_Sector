import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WeaponMotion } from '../src/WeaponMotion.ts';

const properties = ['--weapon-bob-x', '--weapon-bob-y', '--weapon-bob-roll'];
function makeRig() {
  const values = new Map();
  let writes = 0;
  const view = { style: { setProperty(name, value) {
    assert.ok(properties.includes(name), 'Le helper ne modifie que ses trois variables de présentation');
    values.set(name, value);
    writes++;
  } } };
  const motion = new WeaponMotion(view);
  return { motion, read: () => properties.map(name => parseFloat(values.get(name))), writes: () => writes };
}
const near = (actual, expected, tolerance = 0.002) => actual.forEach((value, i) => {
  assert.ok(Math.abs(value - expected[i]) <= tolerance, `${actual} proche de ${expected} (écart ${tolerance})`);
});
const neutral = rig => assert.deepEqual(rig.read(), [0, 0, 0]);

function travel(fps, speed, seconds = 4, aim = 0, reloading = false, diagonal = false) {
  const rig = makeRig();
  const samples = [];
  const point = { x: 0, z: 0 };
  rig.motion.update(1 / fps, point, true, aim, reloading);
  for (let i = 1; i <= fps * seconds; i++) {
    point.x = i * speed / fps * (diagonal ? Math.SQRT1_2 : 1);
    point.z = diagonal ? point.x : 0;
    rig.motion.update(1 / fps, point, true, aim, reloading);
    samples.push(rig.read());
  }
  return { ...rig, samples, point };
}

for (const speed of [2.5, 5, 9, 20]) {
  const low = travel(30, speed);
  const high = travel(144, speed);
  near(low.read(), high.read());
  for (const values of [...low.samples, ...high.samples]) {
    assert.ok(values.every(Number.isFinite));
    assert.ok(Math.abs(values[0]) <= 6 && Math.abs(values[1]) <= 5 && Math.abs(values[2]) <= 0.45, 'Amplitude bornée : 6 px / 5 px / 0,45° maximum');
  }
  near(low.read(), travel(30, speed, 4, 0, false, true).read(), 0.001);
}
const walk = travel(144, 5, 8);
const run = travel(144, 9, 8);
const oscillations = samples => samples.reduce((count, sample, i) => count + (i > 0 && samples[i - 1][0] < 0 && sample[0] >= 0 ? 1 : 0), 0);
const peaks = samples => [0, 1, 2].map(axis => Math.max(...samples.map(sample => Math.abs(sample[axis]))));
assert.ok(oscillations(run.samples) > oscillations(walk.samples), 'La course accélère le balancement');
peaks(run.samples).forEach((peak, i) => assert.ok(peak > peaks(walk.samples)[i], 'La course augmente légèrement l’amplitude'));

const stationary = makeRig();
for (let i = 0; i < 240; i++) stationary.motion.update(1 / 60, { x: 2, z: -3 }, true, 0);
neutral(stationary);
assert.equal(stationary.writes(), 3, 'Aucun mouvement ni réécriture CSS au repos, y compris en poussant un mur');

const stopped = travel(60, 5, 0.5);
const beforeStop = stopped.read();
stopped.motion.update(1 / 60, stopped.point, true, 0);
const firstStop = stopped.read();
assert.ok(firstStop.some(value => value !== 0), 'L’arrêt ne saute pas directement au repos');
firstStop.forEach((value, i) => assert.ok(Math.abs(value) <= Math.abs(beforeStop[i]) + 0.001, 'La position revient au repos sans nouvelle oscillation'));
for (let i = 0; i < 90; i++) stopped.motion.update(1 / 60, stopped.point, true, 0);
neutral(stopped);
const stableWrites = stopped.writes();
for (let i = 0; i < 60; i++) stopped.motion.update(1 / 60, stopped.point, true, 0);
assert.equal(stopped.writes(), stableWrites, 'Le repos amorti finit sans écriture DOM permanente');

// Même trajet, états différents : le facteur ADS/rechargement agit seulement sur la présentation.
const normal = travel(60, 9, 2);
const halfAim = travel(60, 9, 2, 0.5);
const reload = travel(60, 9, 2, 0, true);
const aimed = travel(60, 9, 2, 1);
for (let i = 0; i < normal.samples.length; i++) {
  const quarter = normal.samples[i].map(value => value * 0.25);
  near(halfAim.samples[i], quarter, 0.001);
  near(reload.samples[i], quarter, 0.001);
  assert.deepEqual(aimed.samples[i], [0, 0, 0], 'La visée complète reste exactement stable');
}
normal.motion.update(1 / 60, { x: normal.point.x + 0.15, z: 0 }, true, 1);
neutral(normal);

const interrupted = travel(60, 5, 1);
interrupted.motion.update(1 / 60, { x: 80, z: -30 }, false, 0);
neutral(interrupted);
interrupted.motion.update(1 / 60, { x: -15, z: 6 }, true, 0);
neutral(interrupted);
interrupted.motion.update(1 / 60, { x: -14.9, z: 6 }, true, 0);
assert.ok(interrupted.read().some(value => value !== 0), 'La reprise démarre sur un nouveau trajet sans rattrapage');
interrupted.motion.update(1 / 60, { x: 120, z: 40 }, true, 0);
neutral(interrupted);
interrupted.motion.update(1 / 60, { x: 120.1, z: 40 }, true, 0);
const fresh = makeRig();
fresh.motion.update(1 / 60, { x: 120, z: 40 }, true, 0);
fresh.motion.update(1 / 60, { x: 120.1, z: 40 }, true, 0);
near(interrupted.read(), fresh.read());
interrupted.motion.reset();
neutral(interrupted);
interrupted.motion.update(1 / 60, { x: 0, z: 0 }, true, 0);
neutral(interrupted);

for (const delta of [0, -1, NaN, Infinity, 1]) {
  const invalid = travel(60, 5, 0.5);
  invalid.motion.update(delta, { x: 5, z: 0 }, true, 0);
  neutral(invalid);
}
for (const point of [{ x: NaN, z: 0 }, { x: 0, z: Infinity }]) {
  const invalid = travel(60, 5, 0.5);
  invalid.motion.update(1 / 60, point, true, 0);
  neutral(invalid);
}
const disposed = travel(60, 5, 0.5);
disposed.motion.dispose();
neutral(disposed);
const disposeWrites = disposed.writes();
disposed.motion.dispose();
disposed.motion.update(1 / 60, { x: 5, z: 0 }, true, 0);
assert.equal(disposed.writes(), disposeWrites, 'La destruction est idempotente et définitive');
assert.doesNotThrow(() => {
  const absent = new WeaponMotion(null);
  absent.update(1 / 60, { x: 0, z: 0 }, true, 0);
  absent.update(1 / 60, { x: 0.1, z: 0 }, true, 0);
  absent.dispose();
});

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const parentRule = css.match(/\.weapon-view\s*\{([^}]+)\}/)?.[1];
assert.ok(parentRule?.includes('translate(var(--weapon-bob-x, 0px), var(--weapon-bob-y, 0px)) rotate(var(--weapon-bob-roll, 0deg))'));
assert.match(parentRule, /transform-origin:\s*center bottom/);
assert.match(css, /\.weapon-hip\s*\{[^}]*transform:[^;]*var\(--recoil, 0px\)[^;]*var\(--kick-angle, 0deg\)/, 'Le recul enfant reste composé avec le mouvement du parent');
assert.match(css, /\.weapon-ads\s*\{[^}]*transform:\s*translate\(-50%, calc\(-43\.8% \+ var\(--recoil, 0px\)\)\)/, 'Le placement ADS historique reste conservé');

console.log('PASS : balancement par distance réelle, 30/144 Hz, amplitudes/cadence marche-course, arrêt amorti, mur, ADS stable, recharge, pause/téléportation et composition CSS.');
