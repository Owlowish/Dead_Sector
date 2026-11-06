import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('index.html', 'utf8');
const start = source.indexOf('<div id="objective"');
const end = source.indexOf('<div id="pause-message"');
if (start < 0 || end <= start) throw new Error('Blocs HUD introuvables dans index.html');
mkdirSync('tmp/hud-preview', { recursive: true });
writeFileSync('tmp/hud-preview/index.html', `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>DEAD SECTOR · HUD V2</title><link rel="icon" href="/favicon.svg"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
${source.slice(start, end)}
<aside class="preview-tools"><strong>HUD V2 · APERÇU ISOLÉ</strong><div class="preview-buttons">${['normal','critique','vide','recharge','accalmie','victoire'].map(state => `<button data-state="${state}">${state}</button>`).join('')}<button id="preview-pause">Pause</button></div><label><input id="reduce-heart-motion" type="checkbox"> Réduire l’animation du cœur</label><p id="preview-contract"></p></aside>
<div class="preview-poses" aria-label="Quatre poses du cœur"></div>
<script type="module">
import '/src/style.css';
import { GameHud } from '/src/GameHud.ts';
import { heartAnimation } from '/src/HeartAnimation.ts';
const hud = new GameHud();
let paused = false, last = performance.now();
const ammo = { weaponId:'pistol', weaponName:'PISTOLET 9MM', magazine:10, capacity:15, reserve:30, maxReserve:60, isReloading:false };
const progression = { phase:'combat', tier:1, total:8, sector:'VESTIBULE, SALON & GALERIE', remaining:4, respiteSeconds:10 };
function setState(state) {
  hud.clear(); hud.setHealth(state==='critique'?18:100,100); hud.setFlashlight(true);
  hud.setAmmo({...ammo,magazine:state==='vide'?0:10,isReloading:state==='recharge'},false);
  hud.setProgression({...progression,phase:state==='accalmie'?'respite':state==='victoire'?'won':'combat'});
  hud.setPrompt(null);
}
for(const button of document.querySelectorAll('[data-state]')) button.addEventListener('click',()=>setState(button.dataset.state));
document.querySelector('#preview-pause').addEventListener('click',event=>{paused=!paused;event.target.textContent=paused?'Reprendre':'Pause';});
document.querySelector('#preview-contract').textContent=heartAnimation.frameCount+' poses de '+heartAnimation.frameSize+' px · cycle '+heartAnimation.cycleSeconds+' s · données partagées avec le jeu';
for(let frame=0;frame<heartAnimation.frameCount;frame++) {
  const item=document.createElement('div');item.className='preview-pose';item.style.setProperty('--heart-frame',String(frame));
  item.innerHTML='<span>'+frame+'</span>';document.querySelector('.preview-poses').append(item);
}
setState('normal');
window.__hudPreview={hud,setState,get paused(){return paused;},set paused(value){paused=value;}};
function animate(now){const delta=Math.min(.05,Math.max(0,(now-last)/1000));last=now;hud.update(delta,!paused&&!document.hidden);requestAnimationFrame(animate);}requestAnimationFrame(animate);
</script>
<style>body{background:#1a1714;color:#c7b895}.preview-tools{position:fixed;z-index:20;top:20px;right:20px;width:min(400px,40vw);font:12px monospace}.preview-tools strong{display:block;margin-bottom:12px}.preview-buttons{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}.preview-tools button{background:#24201b;border:1px solid #6b5a3e;color:#c7b895;padding:6px;cursor:pointer}.preview-tools p{line-height:1.5;max-width:340px}.preview-poses{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);display:flex;gap:10px}.preview-pose{width:128px;height:128px;background-image:url('/assets/ui/gothic/heart-beat-v2.png');background-size:400% 100%;background-position-x:calc(var(--heart-frame)*100%/3);image-rendering:pixelated;position:relative}.preview-pose span{position:absolute;bottom:-22px;left:50%;font:12px monospace}</style>
<style>.preview-poses[hidden],.preview-tools[hidden]{display:none}</style>
</body></html>`);
console.log('HUD V2 : /tmp/hud-preview/index.html (HTML, GameHud et HeartAnimation réels).');
