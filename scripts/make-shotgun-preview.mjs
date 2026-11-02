import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { shotgunPump, isShotgunPumpBack, isShotgunKick, shotgunKickAmount, shotgunReload, getShotgunReloadPose } from '../src/ShotgunAnimation.ts';

const source = readFileSync('index.html', 'utf8');
const rig = source.slice(source.indexOf('<div id="shotgun-rig"'), source.indexOf('</div>\n      </div>', source.indexOf('<div id="shotgun-rig"')) + 6).replace(' hidden', '');
const assets = pathToFileURL(resolve('public/assets')).href + '/';
const css = readFileSync('src/style.css', 'utf8').replaceAll('/assets/', assets);
const timing = Object.fromEntries(Object.entries(shotgunPump).map(([key,value]) => [key, typeof value === 'string' ? value.replace('/assets/', assets) : value]));
mkdirSync('tmp/shotgun-preview', { recursive: true });
writeFileSync('tmp/shotgun-preview/standalone.html', `<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fusil — recul et pompe</title><style>${css}
body{margin:0;background:#353a40;color:#eee;font:16px system-ui;overflow:auto}
header{padding:12px;position:relative;z-index:10;background:#202428;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
button{font:inherit;padding:8px}#stage{position:relative;height:calc(100vh - 110px);overflow:hidden;background:repeating-linear-gradient(0deg,#353a40 0 49px,#424850 49px 50px)}
#stage{--aim:0;--recoil:0px;--kick-angle:0deg}
#stage::after{content:'+';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#ddd}
</style><header><button id="play">Un cycle</button><button id="slow">Un cycle ralenti × 4</button><label><input id="ads" type="checkbox"> ADS</label><label><input id="loading" type="checkbox"> Insertion d’une cartouche</label><span id="phase" aria-live="polite">Repos</span></header>
<div id="stage">${rig}</div>
<script>
const timing=${JSON.stringify(timing)};
const shotgunPump=timing;
const isPumpBack=${isShotgunPumpBack.toString()};
const isKick=${isShotgunKick.toString()};
const impulse=${shotgunKickAmount.toString()};
const shotgunReload=${JSON.stringify(shotgunReload)};
const reloadPose=${getShotgunReloadPose.toString()};
const rig=document.getElementById('shotgun-rig');
const phase=document.getElementById('phase');
const images=[timing.restAsset,timing.backAsset,timing.hipKickAsset,timing.adsKickAsset,'${assets}weapons/shotgun/ads_pump_v2.png'].map(src=>{const img=new Image();img.src=src;return img;});
const buttons=[document.getElementById('play'),document.getElementById('slow')];
const ads=document.getElementById('ads');
const loading=document.getElementById('loading');
loading.onchange=()=>{if(loading.checked){ads.checked=false;ads.onchange();}show(loading.checked?0:Infinity);};
ads.checked=new URLSearchParams(location.search).get('aim')==='1';
ads.onchange=()=>document.getElementById('stage').style.setProperty('--aim',ads.checked?'1':'0');ads.onchange();
function show(t){
 const reloading=loading.checked&&t<shotgunReload.duration;
 rig.classList.toggle('is-reloading',reloading);
 if(reloading){
  const pose=reloadPose(t);
  rig.classList.remove('is-kicking');rig.style.setProperty('--recoil','0px');rig.style.setProperty('--shotgun-kick-scale','1');
  const values={'x':pose.x+'%','y':pose.y+'%','shell-x':pose.shellX+'%','shell-y':pose.shellY+'%','shell-opacity':pose.shell,'shell-hide':pose.hide+'%'};
  for(const [key,value] of Object.entries(values))rig.style.setProperty('--load-'+key,value);
  phase.textContent=pose.phase;return;
 }
 const back=isPumpBack(t);
 const kick=isKick(t),power=impulse(t);
 rig.classList.toggle('is-kicking',kick);
 rig.style.setProperty('--shotgun-pump',back?'0%':'100%');
 rig.style.setProperty('--shotgun-kick-scale',1+power*0.035);
 rig.style.setProperty('--recoil',(power*12)+'px');
 rig.style.setProperty('--shotgun-hip-image','url("'+(kick?timing.hipKickAsset:back?timing.backAsset:timing.restAsset)+'")');
 phase.textContent=kick?'Choc du tir':back?(t<timing.ejectAt?'Pompe arrière':'Pompe arrière — éjection passée'):'Repos';
}
function play(speed){
 buttons.forEach(b=>b.disabled=true);
 const start=performance.now();
 function tick(now){const t=(now-start)/1000*speed;show(t);if(t<0.65)requestAnimationFrame(tick);else buttons.forEach(b=>b.disabled=false);}
 requestAnimationFrame(tick);
}
buttons[0].onclick=()=>play(1);buttons[1].onclick=()=>play(0.25);
const pose=new URLSearchParams(location.search).get('pose');show(pose==='back'?0.2:pose==='kick'?0.03:Infinity);
</script></html>`);
console.log(resolve('tmp/shotgun-preview/standalone.html'));
