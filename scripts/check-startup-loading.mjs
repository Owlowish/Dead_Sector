import assert from 'node:assert/strict';
import { LoadingManager } from 'three';
import { StartupAssets, withStartupTimeout } from '../src/StartupLoading.ts';

function fixture() {
  const manager = new LoadingManager();
  const originals = [manager.itemStart, manager.itemEnd, manager.itemError];
  const progress = [], callbacks = [];
  manager.onStart = url => callbacks.push(['start', url]);
  manager.onProgress = url => callbacks.push(['end', url]);
  manager.onError = url => callbacks.push(['error', url]);
  const startup = new StartupAssets(manager, (loaded, total) => progress.push({ loaded, total }));
  const restored = () => {
    assert.deepEqual([manager.itemStart, manager.itemEnd, manager.itemError], originals,
      'Les méthodes originales sont restaurées à la fin, même après erreur');
  };
  return { manager, startup, progress, callbacks, restored };
}

// Un fichier reçu ne signifie pas que le son est décodé. Les URLs répétées
// représentent également plusieurs demandes indépendantes encore en vol.
{
  const f = fixture();
  const sound = '/assets/sounds/test.wav', image = '/assets/zombies/test.png';
  f.manager.itemStart(sound);
  f.manager.itemStart(image); f.manager.itemStart(image);
  let ready = false;
  const waiting = f.startup.wait(1000).then(result => { ready = true; return result; });
  f.manager.itemStart(`${sound}#decode`);
  f.manager.itemEnd(sound); f.manager.itemEnd(image);
  await new Promise(resolve => setTimeout(resolve, 65));
  assert.equal(ready, false, 'Attend encore image répétée et décodage');
  f.manager.itemEnd(image);
  await new Promise(resolve => setTimeout(resolve, 65));
  assert.equal(ready, false, 'Attend encore le décodage après réception des fichiers');
  f.manager.itemEnd(`${sound}#decode`);
  assert.deepEqual(await waiting, []);
  assert.deepEqual(f.progress.at(-1), { loaded: 4, total: 4 });
  assert.equal(f.callbacks.filter(([kind]) => kind === 'end').length, 4);
  f.restored();
}

for (const failureMode of ['error', 'timeout']) {
  const critical = fixture();
  critical.manager.itemStart('/assets/zombies/portrait/idle.png');
  if (failureMode === 'error') {
    critical.manager.itemError('/assets/zombies/portrait/idle.png');
    critical.manager.itemEnd('/assets/zombies/portrait/idle.png');
  }
  await assert.rejects(critical.startup.wait(0), /Ressources visuelles indisponibles.*portrait/);
  critical.restored();

  const optional = fixture();
  const url = 'https://example.test/assets/sounds/voice.wav#decode';
  optional.manager.itemStart(url);
  if (failureMode === 'error') {
    optional.manager.itemError(url); optional.manager.itemEnd(url);
  }
  assert.deepEqual(await optional.startup.wait(0), [url], 'Son facultatif signalé sans bloquer le jeu');
  optional.restored();
  // Une fin tardive passe dans les callbacks normaux, pas dans le compteur de chargement clos.
  const count = optional.progress.length;
  optional.manager.itemStart('/assets/late.png'); optional.manager.itemEnd('/assets/late.png');
  assert.equal(optional.progress.length, count);
}

{
  const empty = fixture();
  assert.deepEqual(await empty.startup.wait(0), []);
  empty.restored();
  const retry = new StartupAssets(empty.manager, () => {});
  empty.manager.itemStart('/assets/retry.png'); empty.manager.itemEnd('/assets/retry.png');
  assert.deepEqual(await retry.wait(), [], 'Une nouvelle observation peut réutiliser le manager restauré');
  empty.restored();
}

assert.equal(await withStartupTimeout(Promise.resolve('prêt'), 'ressource', 100), 'prêt');
const error = new Error('indisponible');
await assert.rejects(withStartupTimeout(Promise.reject(error), 'ressource', 100), value => value === error);
await assert.rejects(withStartupTimeout(new Promise(() => {}), 'ressource bloquée', 5), /ressource bloquée : délai dépassé/);
console.log('PASS : réception/décodage distincts, URLs répétées, image critique, son optionnel, timeouts, callbacks et reprise du LoadingManager.');
