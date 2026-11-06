import { mkdirSync, writeFileSync } from 'node:fs';

const directory = 'tmp/window-preview';
mkdirSync(directory, { recursive: true });
writeFileSync(directory + '/index.html', `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DEAD SECTOR · Fenêtres gothiques</title><link rel="icon" href="/favicon.svg">
<style>
body{margin:0;overflow:hidden;background:#10131a;color:#ded1bd;font:13px monospace}
canvas{display:block;width:100vw;height:100vh;image-rendering:pixelated}
.preview-tools{position:fixed;z-index:10;top:16px;left:16px;right:16px;width:fit-content;max-width:calc(100vw - 32px);box-sizing:border-box;padding:12px 15px;background:#100f10e8;border-left:3px solid #923d42}
strong{display:block;margin-bottom:8px}nav,.controls{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
button{padding:7px 9px;border:1px solid #76615a;background:#252021;color:#ded1bd;font:inherit;cursor:pointer}
button[aria-pressed="true"]{background:#482d31;border-color:#ba7478}button:focus-visible{outline:2px solid #eee6d5;outline-offset:2px}
p{margin:10px 0 0;max-width:850px;line-height:1.45;font-size:11px}#stats{color:#b5aba0}
[hidden]{display:none!important}
</style></head><body>
<aside class="preview-tools">
  <strong>FENÊTRES GOTHIQUES · NIVEAU RÉEL</strong>
  <nav id="windows" aria-label="Choisir une fenêtre"></nav>
  <nav aria-label="Choisir une vue"><button data-view="face">Face</button><button data-view="close">Proche</button><button data-view="oblique">Oblique</button><button data-view="start">Vue initiale</button></nav>
  <div class="controls"><button id="flash" aria-pressed="false">Éclair éteint</button><button id="lamp" aria-pressed="true">Lampe allumée</button><button id="pause" aria-pressed="false">Pause</button><button id="step">Pas d’image</button><button id="slow" aria-pressed="false">Ralenti ×0,25</button><button id="hide">Masquer les outils · H</button></div>
  <p id="description"></p><p id="stats">Chargement des textures…</p>
  <p>Scène sans combat ni déplacement. L’éclair maintenu utilise la lumière et les projections du niveau ; pluie et gouttes passent par son animation réelle. H réaffiche les outils.</p>
</aside>
<script type="module">
import * as THREE from 'three';
import { Level } from '/src/Level.ts';
import { MANSION_STORM_WINDOWS, MANSION_ROOMS, PLAYER_START_POSITION } from '/src/MansionConfig.ts';

const scene = new THREE.Scene(); scene.background = new THREE.Color(0x10131a);
const renderer = new THREE.WebGLRenderer({ antialias:false });
renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.append(renderer.domElement);
const failures = [];
THREE.DefaultLoadingManager.onError = url => failures.push(url);
THREE.DefaultLoadingManager.onLoad = () => { document.body.dataset.previewReady = 'true'; };
const level = new Level(scene);
const windowGroups = scene.getObjectsByProperty('name', 'storm-window');
const variantNames = { classic:'Classique', damaged:'Vitre endommagée', stained:'Vitrail', occult:'Marquage occulte' };
const variantName = index => variantNames[windowGroups[index]?.userData.variant] ?? 'Fenêtre';
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .1, 100); scene.add(camera);
const lamp = new THREE.SpotLight(0xfffaec, 22, 28, Math.PI / 5.2, .5, 1.8);
const lampTarget = new THREE.Object3D(); lamp.position.set(.2, -.15, -.1); lampTarget.position.set(.2, -.15, -5);
camera.add(lamp, lampTarget); lamp.target = lampTarget;
const windowPositions = level.getStormWindowPositions();
let selectedWindow = 0, viewName = 'start', flashing = false, paused = false, slow = false;

function roomName(spec) {
  return MANSION_ROOMS.find(room => spec.x >= room.bounds.minX && spec.x <= room.bounds.maxX
    && spec.z >= room.bounds.minZ && spec.z <= room.bounds.maxZ)?.name ?? 'Manoir';
}
function setFlash(enabled) {
  flashing = enabled;
  for (const light of level.getStormLights()) {
    light.position.copy(windowPositions[selectedWindow]); light.intensity = flashing ? 18 : 0;
  }
  const button = document.querySelector('#flash');
  button.setAttribute('aria-pressed', String(flashing)); button.textContent = flashing ? 'Éclair allumé' : 'Éclair éteint';
  level.update(0, 0);
}
function move() {
  const spec = MANSION_STORM_WINDOWS[selectedWindow];
  if (viewName === 'start') {
    camera.position.set(PLAYER_START_POSITION.x, PLAYER_START_POSITION.y, PLAYER_START_POSITION.z);
    camera.rotation.set(0, 0, 0, 'YXZ');
  } else {
    const center = new THREE.Vector3(spec.x, spec.y, spec.z);
    const inward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotationY);
    const approach = center.clone().add(inward);
    const eyeHeight = level.getFloorHeightAt(approach.x, approach.z) + 1.7;
    const distance = viewName === 'close' ? Math.max(1.5, spec.width * .55)
      : viewName === 'oblique' ? 2.8 : Math.max(3.3, spec.height);
    const sideways = viewName === 'oblique' ? spec.width * .72 : 0;
    const offset = new THREE.Vector3(sideways, 0, -distance)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotationY);
    camera.position.copy(center).add(offset); camera.position.y = eyeHeight;
    camera.lookAt(center);
  }
  for (const button of document.querySelectorAll('[data-window]')) button.setAttribute('aria-pressed', String(Number(button.dataset.window) === selectedWindow));
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === viewName));
  document.querySelector('#description').textContent = viewName === 'start'
    ? 'Vue initiale du jeu · caméra et hauteur de départ réelles · ' + variantName(selectedWindow)
    : 'Fenêtre ' + selectedWindow + ' · ' + roomName(spec) + ' · ' + variantName(selectedWindow) + ' · ' + spec.width + ' × ' + spec.height + ' m';
  document.body.dataset.window = String(selectedWindow); document.body.dataset.view = viewName;
  document.body.dataset.variant = windowGroups[selectedWindow]?.userData.variant ?? '';
  setFlash(false);
}
for (const [index, spec] of MANSION_STORM_WINDOWS.entries()) {
  const button = document.createElement('button'); button.dataset.window = String(index);
  button.textContent = index + ' · ' + roomName(spec) + ' · ' + variantName(index);
  button.addEventListener('click', () => { selectedWindow = index; if (viewName === 'start') viewName = 'face'; move(); });
  document.querySelector('#windows').append(button);
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
  viewName = button.dataset.view; if (viewName === 'start') selectedWindow = 0; move();
});
document.querySelector('#flash').addEventListener('click', () => setFlash(!flashing));
document.querySelector('#lamp').addEventListener('click', event => {
  lamp.intensity = lamp.intensity ? 0 : 22;
  event.currentTarget.setAttribute('aria-pressed', String(lamp.intensity > 0));
  event.currentTarget.textContent = lamp.intensity ? 'Lampe allumée' : 'Lampe éteinte';
});
function setPaused(value) {
  paused = value;
  const button = document.querySelector('#pause');
  button.setAttribute('aria-pressed', String(paused)); button.textContent = paused ? 'Reprendre' : 'Pause';
}
document.querySelector('#pause').addEventListener('click', () => setPaused(!paused));
document.querySelector('#step').addEventListener('click', () => {
  setPaused(true);
  const delta = (1 / 60) * (slow ? .25 : 1); level.update(delta, delta);
});
document.querySelector('#slow').addEventListener('click', event => {
  slow = !slow; event.currentTarget.setAttribute('aria-pressed', String(slow));
  event.currentTarget.textContent = slow ? 'Vitesse ×1' : 'Ralenti ×0,25';
});
document.querySelector('#hide').addEventListener('click', () => { document.querySelector('.preview-tools').hidden = true; });
document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'h' && !event.repeat) {
    const tools = document.querySelector('.preview-tools'); tools.hidden = !tools.hidden;
  }
});
function resize() {
  renderer.setSize(Math.max(320, Math.floor(innerWidth / 3)), Math.max(240, Math.floor(innerHeight / 3)), false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize(); move();
let previous = null, statsAt = 0;
renderer.setAnimationLoop(now => {
  const raw = previous === null ? 0 : Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now;
  const delta = paused || document.hidden ? 0 : raw * (slow ? .25 : 1);
  level.update(delta, delta); renderer.render(scene, camera);
  if (now - statsAt > 250) {
    statsAt = now;
    document.querySelector('#stats').textContent = renderer.domElement.width + '×' + renderer.domElement.height
      + ' · ' + renderer.info.render.calls + ' appels · ' + renderer.info.render.triangles + ' triangles · ' + renderer.info.render.lines + ' segments de traits'
      + ' · ' + renderer.info.memory.textures + ' textures' + (failures.length ? ' · fichiers absents : ' + failures.length : '')
      + (paused ? ' · pause' : slow ? ' · vitesse ×0,25' : ' · vitesse ×1');
  }
});
window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null); window.removeEventListener('resize', resize);
  for (const light of level.getStormLights()) light.intensity = 0;
  level.disposeDecor(); renderer.dispose();
}, { once:true });
</script></body></html>`);
console.log('Aperçu : /' + directory + '/index.html sur Vite · six fenêtres du vrai Level, sans combat.');
