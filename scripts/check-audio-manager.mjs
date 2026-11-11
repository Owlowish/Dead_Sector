// AudioManager réel sur contexte Web Audio simulé : réserves, sons spatiaux et libération. Aucune écoute.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { installMockAudio } from './mock-audio-manager.mjs';
import { AudioManager, AUDIO_POOLS, soundUrl } from '../src/AudioManager.ts';

const { manager, played, sources, requested, context, listener } = installMockAudio();
assert.equal(AudioManager.peek(), manager, 'Instance unique installée');
assert.equal(AudioManager.get(), manager, 'get() ne recrée pas le singleton');
assert.ok(requested.every((url) => url.endsWith('.ogg')), 'Seuls des Ogg sont demandés');
for (const pool of Object.values(AUDIO_POOLS)) {
  for (const clip of pool.clips) assert.ok(fs.existsSync(`public${soundUrl(clip)}`), `${clip}.ogg servi depuis public/`);
}
assert.equal(new Set(requested).size, requested.length, 'Chaque variante partagée est chargée une seule fois');

// Premier canal libre (!isPlaying), alternance des variantes, puis vol du plus ancien si tout est occupé.
const pistol = () => manager.pools.get('pistol').channels;
for (let shot = 0; shot < 4; shot++) assert.equal(manager.playPooled('pistol'), true);
assert.deepEqual(played, ['shot-soft', 'shot-soft-2', 'shot-soft-3', 'shot-soft'].map(soundUrl));
assert.equal(manager.getStats().pools.pistol.playing, 4, 'Quatre tirs superposés sur quatre canaux');
const second = pistol()[1];
second.source.onended();
assert.equal(second.isPlaying, false, 'Un canal terminé redevient libre');
manager.playPooled('pistol');
assert.equal(second.isPlaying, true, 'Le premier canal libre est réutilisé');
const oldest = pistol()[0];
const oldestSource = oldest.source;
manager.playPooled('pistol');
assert.equal(oldestSource.stopped, true, 'Réserve pleine : le plus ancien est coupé');
assert.equal(pistol()[3], oldest, 'Le canal volé passe en fin de file');
assert.equal(pistol().length, AUDIO_POOLS.pistol.size, 'Aucun canal créé au-delà de la réserve');
manager.stopEffects();
assert.equal(manager.getStats().pools.pistol.playing, 0);

// Volume Effets : réserves et voix spatiales à gain propre, pas les sons persistants réglés par leur propriétaire.
await manager.load('zombie-groan-soft');
await manager.load('rain-soft', 'persistent');
const enemy = new THREE.Group();
let voice = manager.createSpatial('zombie-groan-soft', { refDistance: 2.5, maxDistance: 16, gain: 0.3 }, enemy);
const rain = manager.createSpatial('rain-soft', { refDistance: 4, maxDistance: 24, loop: true, scope: 'persistent' }, new THREE.Group());
assert.ok(voice instanceof THREE.PositionalAudio && voice.parent === enemy, 'Voix liée au groupe de l’ennemi');
rain.setVolume(0.7);
manager.setEffectsVolume(0.5);
assert.equal(voice.getVolume(), 0.15);
assert.equal(rain.getVolume(), 0.7, 'La pluie reste sur Ambiance');
assert.equal(manager.playPooled('pistol') && pistol().every((channel) => channel.getVolume() === 0.25), true);
manager.setEffectsVolume(0);
assert.equal(manager.playPooled('pistol'), false, 'Effets coupés : aucune lecture');
manager.setEffectsVolume(1);

// La préparation se termine aussi avec les loaders synchrones des aperçus/tests.
await manager.ready;
assert.equal(manager.getStats().pending, 0);
const buffersBefore = manager.getStats().buffers;
const requestsBefore = requested.length;
const pooledBefore = pistol().slice();
manager.playPooled('pistol'); voice.play();
manager.clear({ keepBuffers: true });
assert.equal(manager.getStats().buffers, buffersBefore, 'Les buffers prêts sont conservés au redémarrage');
assert.deepEqual(pistol(), pooledBefore, 'Les mêmes canaux sont réutilisés, sans nouvelle construction');
assert.equal(voice.parent, null, 'Les voix de la tentative finie sont détachées');
assert.equal(rain.parent !== null, true);
assert.equal(manager.getStats().pools.pistol.playing, 0);
manager.preloadPools(); await manager.ready;
assert.equal(requested.length, requestsBefore, 'Aucune requête de son supplémentaire pour la tentative suivante');
assert.equal(manager.playPooled('pistol'), true, 'Premier tir prêt immédiatement après le redémarrage');
voice = manager.createSpatial('zombie-groan-soft', { refDistance: 2.5, maxDistance: 16, gain: 0.3 }, enemy);
manager.stopEffects();
const startsBeforeSuspension = played.length;
context.state = 'suspended';
assert.equal(manager.playPooled('pistol'), false, 'Contexte suspendu : aucun son mis en attente');
context.state = 'running';
assert.equal(played.length, startsBeforeSuspension, 'La reprise ne rejoue pas les gestes ignorés');

// clear() : défaite ou nouvelle tentative.
const pending = [];
THREE.AudioLoader.prototype.load = function (url, onLoad) { pending.push(() => onLoad({ url, duration: 1 })); };
const late = manager.load('crawler-hiss');
voice.play();
manager.clear();
assert.equal(voice.parent, null, 'Voix ennemie détachée');
assert.equal(voice.isPlaying, false);
assert.equal(rain.parent !== null, true, 'Décor persistant conservé pour l’accueil');
const stats = manager.getStats();
assert.deepEqual(stats.pools, {}, 'Canaux des réserves libérés');
assert.equal(stats.spatial, 1, 'Seul le décor persistant reste suivi');
assert.equal(stats.buffers, 1, 'Seul le buffer persistant reste décodé');
assert.equal(manager.getBuffer('shot-soft'), null);
pending.shift()();
assert.equal(await late, null, 'Un chargement lancé avant clear() ne repeuple pas le cache');
assert.equal(manager.getBuffer('crawler-hiss'), null);
assert.equal(manager.playPooled('pistol'), false, 'Rien ne joue avant le rechargement');

// Rechargement de la tentative suivante.
manager.preloadPools();
while (pending.length) pending.shift()();
await Promise.resolve();
assert.equal(manager.playPooled('pistol'), true, 'Réserves recréées après clear()');
assert.equal(played.at(-1), soundUrl('shot-soft'), 'Alternance repartie de la première prise');

// dispose() : tout est libéré et le singleton retiré.
const count = sources.length;
manager.dispose();
assert.equal(AudioManager.peek(), null);
assert.equal(rain.parent, null, 'Décor persistant libéré à la fermeture');
assert.equal(manager.getStats().buffers, 0);
assert.equal(manager.playPooled('pistol'), false);
assert.equal(sources.length, count, 'Aucune source créée après dispose()');
AudioManager.release(voice);

// Readiness : les demandes ajoutées pendant la première réception doivent être attendues aussi.
const events = new EventTarget();
context.addEventListener = events.addEventListener.bind(events);
context.removeEventListener = events.removeEventListener.bind(events);
const callbacks = new Map();
THREE.AudioLoader.prototype.load = function (url, success, progress, failure) { callbacks.set(url, { success, failure }); };
const nextManager = AudioManager.install(listener);
const firstRequest = nextManager.load('first');
assert.equal(nextManager.load('first'), firstRequest, 'Une seule promesse/décodage par fichier en vol');
let readyResolved = false;
const ready = nextManager.ready.then(() => { readyResolved = true; });
const secondRequest = nextManager.load('second');
callbacks.get(soundUrl('first')).success({ url: soundUrl('first'), duration: 1 });
await firstRequest; await Promise.resolve();
assert.equal(readyResolved, false, 'Le second décodage est encore attendu');
callbacks.get(soundUrl('second')).success({ url: soundUrl('second'), duration: 1 });
await secondRequest; await ready;
assert.equal(readyResolved, true);

// Une réponse d'avant clear() ne doit ni effacer ni remplir la nouvelle demande du même fichier.
const oldRequest = nextManager.load('race');
const oldCallback = callbacks.get(soundUrl('race')).success;
nextManager.clear();
assert.equal(await oldRequest, null);
const newRequest = nextManager.load('race');
oldCallback({ url: 'obsolete', duration: 1 });
assert.equal(nextManager.getStats().pending, 1);
assert.equal(nextManager.getBuffer('race'), null);
callbacks.get(soundUrl('race')).success({ url: 'current', duration: 1 });
assert.equal((await newRequest).url, 'current');

// Erreur de décodage et timeout restent facultatifs, bornés et récupérables au prochain chargement.
const bad = nextManager.load('bad');
callbacks.get(soundUrl('bad')).failure(new Error('décodage simulé'));
assert.equal(await bad, null);
assert.deepEqual(nextManager.unavailableIds, ['bad']);
const retry = nextManager.load('bad');
callbacks.get(soundUrl('bad')).success({ url: 'retry', duration: 1 });
await retry;
assert.deepEqual(nextManager.unavailableIds, []);
const setTimeoutOriginal = globalThis.setTimeout;
const timers = [];
let timeoutRequest;
try {
  globalThis.setTimeout = (callback, delay) => { timers.push({ callback, delay }); return 0; };
  timeoutRequest = nextManager.load('timeout');
} finally { globalThis.setTimeout = setTimeoutOriginal; }
assert.equal(timers[0].delay, 15000);
timers[0].callback();
assert.equal(await timeoutRequest, null);
await nextManager.ready;
callbacks.get(soundUrl('timeout')).success({ url: 'too-late', duration: 1 });
assert.equal(nextManager.getBuffer('timeout'), null, 'Un callback tardif ne rejoue ni ne repeuple un son périmé');
assert.deepEqual(nextManager.unavailableIds, ['timeout']);

// Suspension système : arrêter les sources en cours, pas seulement refuser les suivantes.
nextManager.preloadPools();
for (const [url, callback] of callbacks) callback.success({ url, duration: 1 });
await nextManager.ready;
assert.equal(nextManager.playPooled('pistol'), true);
context.state = 'suspended'; events.dispatchEvent(new Event('statechange'));
assert.equal(nextManager.getStats().pools.pistol.playing, 0);
context.state = 'running'; events.dispatchEvent(new Event('statechange'));
assert.equal(nextManager.getStats().pools.pistol.playing, 0);
nextManager.dispose();
console.log('PASS : singleton/Ogg, pools bornés, volumes, readiness, échec/timeout, reprise sans rechargement, requêtes périmées, suspension et dispose. Aucune écoute.');
