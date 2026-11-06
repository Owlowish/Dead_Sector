import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('index.html', 'utf8');
const worldStart = source.indexOf('<div class="hud"');
const start = source.indexOf('<div id="objective"');
const end = source.indexOf('<div id="pause-message"');
if (worldStart < 0 || start <= worldStart || end <= start) throw new Error('Blocs HUD introuvables dans index.html');
mkdirSync('tmp/hud-preview', { recursive: true });
writeFileSync('tmp/hud-preview/index.html', `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>DEAD SECTOR · HUD V3</title><link rel="icon" href="/favicon.svg"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
${source.slice(worldStart, end)}
<aside class="preview-tools"><strong id="preview-title">HUD V3 · APERÇU ISOLÉ</strong><div class="preview-buttons">${['normal','vie partielle','critique','vide','épuisé','recharge','lampe éteinte','fusil','accalmie','boss','victoire','mort'].map(state => `<button data-state="${state}">${state}</button>`).join('')}<button id="preview-fire">Tirer · T</button><button id="preview-pause">Pause</button><button id="preview-ads" aria-pressed="false" hidden>ADS</button><button id="preview-poses-toggle" aria-pressed="true">Poses du cœur</button><button id="preview-hide">Masquer les outils · H</button></div><label><input id="reduce-heart-motion" type="checkbox"> Réduire les animations du HUD</label><label class="preview-speed">Animations HUD <select id="preview-hud-rate" aria-label="Vitesse des animations du HUD"><option value="1">Normale · 1×</option><option value="0.25">Ralenti · 0,25×</option></select></label><p id="preview-contract"></p><p>H : masquer / afficher les outils. T : animer un tir du HUD. Chaque scénario réinitialise ses valeurs ; accalmie relance dix secondes, suspendues en pause. Le ralenti ne change pas le décompte.</p><p><a id="preview-mode" href="?scene=1">Voir dans le manoir</a></p><p id="preview-scene-note" hidden>Départ réel · scène sans combat ni déplacement · arme au repos · ADS disponible.</p></aside>
<div class="preview-poses" aria-label="Quatre poses du cœur"></div>
<script type="module">
import '/src/style.css';
import { GameHud } from '/src/GameHud.ts';
import { heartAnimation } from '/src/HeartAnimation.ts';
import { ENCOUNTER_CONFIGS } from '/src/EncounterConfig.ts';
import { guardianConfig } from '/src/FinaleConfig.ts';
const hud = new GameHud();
const sceneMode = new URLSearchParams(location.search).get('scene') === '1';
const worldHud = document.querySelector('.hud');
const tools = document.querySelector('.preview-tools');
const poses = document.querySelector('.preview-poses');
worldHud.hidden = !sceneMode;
let paused = false, aiming = false, showPoses = !sceneMode, sceneView = null, hudRate = 1, last = performance.now();
poses.hidden = !showPoses;
document.querySelector('#preview-poses-toggle').setAttribute('aria-pressed', String(showPoses));
document.querySelector('#preview-ads').hidden = !sceneMode;
document.querySelector('#preview-scene-note').hidden = !sceneMode;
if (sceneMode) {
  document.querySelector('#preview-title').textContent = 'HUD V3 · MANOIR RÉEL';
  const link = document.querySelector('#preview-mode');
  link.href = location.pathname; link.textContent = 'Voir le HUD isolé';
}
const ammo = { weaponId:'pistol', weaponName:'PISTOLET 9MM', magazine:12, capacity:15, reserve:36, maxReserve:60, isReloading:false };
const progression = { phase:'combat', tier:1, total:ENCOUNTER_CONFIGS.length, sector:'VESTIBULE, SALON & GALERIE', remaining:4, respiteSeconds:10 };
let currentAmmo = {...ammo}, currentProgression = {...progression};
function setState(state) {
  document.body.dataset.previewState=state;
  hud.clear(); hud.setHealth(state==='mort'?0:state==='critique'?18:state==='vie partielle'?62:100,100); hud.setFlashlight(state!=='lampe éteinte');
  const shotgun=state==='fusil';
  currentAmmo=shotgun?{...ammo,weaponId:'shotgun',weaponName:'FUSIL À POMPE',magazine:6,capacity:8,reserve:19,maxReserve:32}
    :{...ammo,magazine:state==='vide'||state==='épuisé'?0:state==='critique'?2:12,reserve:state==='épuisé'?0:36,isReloading:state==='recharge'};
  hud.setAmmo(currentAmmo,shotgun);
  currentProgression={...progression,phase:state==='accalmie'?'respite':state==='victoire'?'won':state==='mort'?'lost':'combat',tier:state==='boss'?ENCOUNTER_CONFIGS.length:1,remaining:state==='boss'?1:state==='critique'?12:4};
  hud.setProgression(currentProgression);
  if(state==='boss') hud.setBoss({health:guardianConfig.health*.45,maxHealth:guardianConfig.health,phase:2,attack:'sweep',frameResisting:true});
  hud.setPrompt(null);
  hud.update(0,!paused);
  for(const button of document.querySelectorAll('[data-state]')) button.setAttribute('aria-pressed',String(button.dataset.state===state));
  updateFireButton();
  updateScenePresentation();
}
function canFire() {
  return !paused && !document.hidden && currentProgression.phase !== 'lost' && !currentAmmo.isReloading && currentAmmo.magazine > 0;
}
function updateFireButton() {
  document.querySelector('#preview-fire').disabled = !canFire();
}
function fireShot() {
  if (!canFire()) return false;
  currentAmmo = {...currentAmmo, magazine:currentAmmo.magazine - 1};
  hud.setAmmo(currentAmmo, currentAmmo.weaponId === 'shotgun');
  hud.notifyShot();
  updateFireButton();
  return true;
}
function setPaused(value) {
  paused = Boolean(value);
  document.querySelector('#preview-pause').textContent = paused ? 'Reprendre' : 'Pause';
  updateFireButton();
}
function setToolsVisible(visible) {
  tools.hidden = !visible;
  poses.hidden = !visible || !showPoses;
}
function setAim(value) {
  aiming = Boolean(value);
  document.querySelector('#preview-ads').setAttribute('aria-pressed', String(aiming));
  updateScenePresentation();
}
function updateScenePresentation() {
  if (!sceneView) return;
  const shotgun = document.body.dataset.previewState === 'fusil';
  document.querySelector('#pistol-rig').hidden = shotgun;
  document.querySelector('#shotgun-rig').hidden = !shotgun;
  worldHud.style.setProperty('--aim', aiming ? '1' : '0');
  sceneView.camera.fov = aiming ? 58 : 75;
  sceneView.camera.updateProjectionMatrix();
  worldHud.style.setProperty('--spread-radius', sceneView.spreadRadiusPixels(aiming ? 1 : 0, sceneView.camera.fov, innerHeight,
    shotgun ? sceneView.shotgunHipSpreadDegrees : sceneView.pistolHipSpreadDegrees,
    shotgun ? sceneView.shotgunAdsSpreadDegrees : sceneView.pistolAdsSpreadDegrees).toFixed(2) + 'px');
  sceneView.lamp.intensity = document.body.dataset.previewState === 'lampe éteinte' ? 0 : 22;
  updateWeaponLighting();
}
function updateWeaponLighting() {
  if (!sceneView) return;
  const light = sceneView.level.getLightingAt(sceneView.camera.position);
  const brightness = sceneView.weaponAmbientBrightness(light.brightness + (sceneView.lamp.intensity ? .08 : 0));
  const view = document.querySelector('.weapon-view');
  view.style.setProperty('--weapon-brightness', (brightness + light.stormFlash * .55).toFixed(2));
  view.style.setProperty('--weapon-warmth', (light.warmth * (1 - light.stormFlash)).toFixed(2));
}
async function createSceneView() {
  const [THREE, { Level }, { PLAYER_START_POSITION }, art, spread] = await Promise.all([
    import('three'), import('/src/Level.ts'), import('/src/MansionConfig.ts'),
    import('/src/WeaponPresentation.ts'), import('/src/WeaponSpread.ts'),
  ]);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x10131a);
  const renderer = new THREE.WebGLRenderer({ antialias:false });
  renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  document.body.append(renderer.domElement);
  const previousOnLoad = THREE.DefaultLoadingManager.onLoad;
  const texturesReady = new Promise(resolve => {
    THREE.DefaultLoadingManager.onLoad = () => { previousOnLoad?.(); resolve(); };
  });
  const level = new Level(scene);
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .1, 100);
  camera.position.set(PLAYER_START_POSITION.x, PLAYER_START_POSITION.y, PLAYER_START_POSITION.z);
  camera.rotation.order = 'YXZ'; scene.add(camera);
  const lamp = new THREE.SpotLight(0xfffaec, 22, 28, Math.PI / 5.2, .5, 1.8);
  const target = new THREE.Object3D(); lamp.position.set(.2, -.15, -.1); target.position.set(.2, -.15, -5);
  camera.add(lamp, target); lamp.target = target;
  sceneView = { scene, renderer, level, camera, lamp, weaponAmbientBrightness:art.weaponAmbientBrightness, ...spread };
  function resize() {
    renderer.setSize(Math.max(320, Math.floor(innerWidth / 3)), Math.max(240, Math.floor(innerHeight / 3)), false);
    camera.aspect = innerWidth / innerHeight; updateScenePresentation();
  }
  window.addEventListener('resize', resize); resize(); level.update(0);
  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', resize); level.disposeDecor(); renderer.dispose();
    THREE.DefaultLoadingManager.onLoad = previousOnLoad;
  }, { once:true });
  await Promise.all([texturesReady, art.installWeaponArt()]);
  updateScenePresentation(); renderer.render(scene, camera);
  return sceneView;
}
for(const button of document.querySelectorAll('[data-state]')) button.addEventListener('click',()=>setState(button.dataset.state));
document.querySelector('#preview-fire').addEventListener('click', fireShot);
document.querySelector('#preview-pause').addEventListener('click',()=>setPaused(!paused));
document.querySelector('#preview-hud-rate').addEventListener('change', event => { hudRate = Number(event.currentTarget.value); });
document.addEventListener('visibilitychange', updateFireButton);
document.querySelector('#preview-ads').addEventListener('click', () => setAim(!aiming));
document.querySelector('#preview-poses-toggle').addEventListener('click', event => {
  showPoses = !showPoses; poses.hidden = tools.hidden || !showPoses;
  event.currentTarget.setAttribute('aria-pressed', String(showPoses));
});
document.querySelector('#preview-hide').addEventListener('click', () => setToolsVisible(false));
document.addEventListener('keydown',event=>{
  if(event.repeat || event.ctrlKey || event.altKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
  if(event.key.toLowerCase()==='h')setToolsVisible(tools.hidden);
  if(event.key.toLowerCase()==='t')fireShot();
});
document.querySelector('#preview-contract').textContent=heartAnimation.frameCount+' poses de '+heartAnimation.frameSize+' px · cycle '+heartAnimation.cycleSeconds+' s · données partagées avec le jeu';
for(let frame=0;frame<heartAnimation.frameCount;frame++) {
  const item=document.createElement('div');item.className='preview-pose';item.style.setProperty('--heart-frame',String(frame));
  item.innerHTML='<span>'+frame+'</span>';document.querySelector('.preview-poses').append(item);
}
setState('normal');
const ready = sceneMode ? createSceneView() : Promise.resolve(null);
window.__hudPreview={hud,setState,setAim,setToolsVisible,fireShot,setPaused,ready,sceneMode,get sceneView(){return sceneView;},get ammo(){return {...currentAmmo};},get progression(){return {...currentProgression};},get paused(){return paused;},set paused(value){setPaused(value);}};
await ready; document.body.dataset.previewReady = 'true'; last = performance.now();
function animate(now) {
  const delta = Math.min(.05, Math.max(0, (now-last)/1000)); last = now;
  const active = !paused && !document.hidden;
  if (active && currentProgression.phase === 'respite' && currentProgression.respiteSeconds > 0) {
    currentProgression = {...currentProgression, respiteSeconds:Math.max(0, currentProgression.respiteSeconds-delta)};
    hud.setProgression(currentProgression);
  }
  hud.update(delta * hudRate, active);
  if (sceneView) {
    sceneView.level.update(active ? delta : 0, active ? delta : 0);
    updateWeaponLighting(); sceneView.renderer.render(sceneView.scene, sceneView.camera);
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
</script>
<style>body{background:#1a1714;color:#c7b895}.preview-tools{position:fixed;z-index:20;top:20px;right:20px;width:min(400px,40vw);padding:12px;background:#100f10e8;box-sizing:border-box;font:12px monospace}.preview-tools strong{display:block;margin-bottom:12px}.preview-buttons{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}.preview-tools button{background:#24201b;border:1px solid #6b5a3e;color:#c7b895;padding:6px;cursor:pointer}.preview-tools button[aria-pressed="true"]{border-color:#b47070;background:#3b2628}.preview-tools a{color:#ded1bd}.preview-tools p{line-height:1.5;max-width:340px}.preview-poses{position:absolute;z-index:10;left:50%;top:48%;transform:translate(-50%,-50%);display:flex;gap:10px}.preview-pose{width:128px;height:128px;background-image:url('/assets/ui/gothic/heart-beat-v2.png');background-size:400% 100%;background-position-x:calc(var(--heart-frame)*100%/3);image-rendering:pixelated;position:relative}.preview-pose span{position:absolute;bottom:-22px;left:50%;font:12px monospace}</style>
<style>.preview-tools>label{display:block;margin-top:10px}.preview-speed select{margin-left:8px}.preview-poses[hidden],.preview-tools[hidden],.preview-tools [hidden]{display:none}</style>
</body></html>`);
console.log('HUD V3 : /tmp/hud-preview/index.html ; ?scene=1 pour le vrai Level au départ avec arme DOM, lampe et ADS, sans combat.');
