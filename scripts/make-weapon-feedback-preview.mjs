import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createWeaponMechanicalSamples, WEAPON_MECHANICAL_BASE_GAIN } from '../src/WeaponMechanicalAudio.ts';
import { pistolReloadSoundEvents, shotgunPumpSoundEvents } from '../src/WeaponSoundEvents.ts';
import { shotgunReload } from '../src/ShotgunAnimation.ts';

const source = readFileSync('index.html', 'utf8');
const start = source.indexOf('<div class="weapon-view"');
if (start < 0) throw Error('Présentation des armes introuvable');
const tags = /<\/?div\b[^>]*>/g;
tags.lastIndex = start;
let depth = 0, end = -1, match;
while ((match = tags.exec(source))) {
  depth += match[0].startsWith('</') ? -1 : 1;
  if (depth === 0) { end = tags.lastIndex; break; }
}
if (end < 0) throw Error('Présentation des armes non fermée');
const markup = source.slice(start, end);
mkdirSync('tmp/weapon-feedback-preview', { recursive: true });
writeFileSync('tmp/weapon-feedback-preview/index.html', `<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DEAD SECTOR · Sons et mouvement des armes</title><link rel="stylesheet" href="/src/style.css">
<style>
body{margin:0;background:#20252b;color:#d4c6a5;font:14px monospace;overflow:auto}
header{padding:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:relative;z-index:20;background:#171b20}
button,select{font:inherit;padding:8px;background:#303232;color:inherit;border:1px solid #756347}label{display:flex;gap:6px;align-items:center}
#stage{position:relative;height:calc(100dvh - 155px);min-height:360px;overflow:hidden;background:repeating-linear-gradient(0deg,#30363d 0 47px,#3a424a 47px 48px)}
#stage .hud{position:absolute;inset:0;--aim:0}#target{position:absolute;left:50%;top:50%;color:#a2a6a8}footer{padding:10px;font-size:12px}
</style><header>
<button data-action="pistol">Recharger le pistolet</button><button data-action="shell">Insérer une cartouche</button><button data-action="pump">Cycle de pompe</button><button id="stop">Arrêter</button>
<label>Déplacement <select id="pace"><option value="0">Immobile</option><option value="5">Marche</option><option value="9">Course</option></select></label>
<label><input id="ads" type="checkbox"> Visée</label><label><input id="slow" type="checkbox"> Ralenti × 4</label><label>Effets <input id="volume" type="range" min="0" max="1" step=".01" value="1"></label>
</header><main id="stage"><div class="hud">${markup}</div><span id="target">+</span></main>
<footer><output id="phase">Repos</output> · Aperçu isolé : sprites, chronologies, sons et balancement partagés avec le jeu. Aucun contrôle du bureau.</footer>
<script type="module">
import { installWeaponArt, weaponArtCss } from '/src/WeaponPresentation.ts';
import { reloadPoses } from '/src/WeaponAnimation.ts';
import { shotgunPump, shotgunReload, getShotgunReloadPose, isShotgunPumpBack, isShotgunKick, shotgunKickAmount } from '/src/ShotgunAnimation.ts';
import { pistolReloadSoundEvents, shotgunPumpSoundEvents, crossedWeaponSoundEvents } from '/src/WeaponSoundEvents.ts';
import { WeaponMechanicalAudio } from '/src/WeaponMechanicalAudio.ts';
import { WeaponMotion } from '/src/WeaponMotion.ts';
void installWeaponArt();
const view=document.querySelector('.weapon-view'),hud=document.querySelector('.hud'),pistol=document.querySelector('#pistol-rig'),shotgun=document.querySelector('#shotgun-rig'),hip=document.querySelector('#weapon-hip-sprite');
const motion=new WeaponMotion(view),position={x:0,z:0};
const pace=document.querySelector('#pace'),ads=document.querySelector('#ads'),slow=document.querySelector('#slow'),volume=document.querySelector('#volume'),phase=document.querySelector('#phase');
const reloadDuration=reloadPoses.reduce((sum,pose)=>sum+pose.duration,0);
let context=null,audio=null,action=null,elapsed=0,last=0,shellCommitted=false,selected='pistol';
function select(id){selected=id;pistol.hidden=id!=='pistol';shotgun.hidden=id!=='shotgun';}
function stop(){action=null;elapsed=0;shellCommitted=false;audio?.suspend();motion.reset();render();}
function render(){
  const reloading=action==='pistol'||action==='shell';
  const aim=ads.checked&&!reloading?1:0;hud.style.setProperty('--aim',String(aim));
  let pose=null;
  if(action==='pistol'){let t=elapsed;for(const candidate of reloadPoses){if(t<candidate.duration){pose=candidate;break;}t-=candidate.duration;}}
  hip.style.setProperty('--hand-x',(pose?.x??0)+'%');hip.style.setProperty('--hand-y',(pose?.y??0)+'%');hip.style.setProperty('--hand-opacity',String(pose?.opacity??0));hip.style.setProperty('--magazine-opacity',String(pose?.magazine??0));
  shotgun.classList.toggle('is-reloading',action==='shell');
  const load=getShotgunReloadPose(action==='shell'?elapsed:0);
  for(const [key,value] of Object.entries({'x':load.x+'%','y':load.y+'%','shell-x':load.shellX+'%','shell-y':load.shellY+'%','shell-opacity':load.shell,'shell-hide':load.hide+'%'}))shotgun.style.setProperty('--load-'+key,String(value));
  const t=action==='pump'?elapsed:Infinity,back=isShotgunPumpBack(t),kick=isShotgunKick(t),power=shotgunKickAmount(t);
  shotgun.classList.toggle('is-kicking',kick);shotgun.style.setProperty('--shotgun-pump',back?'0%':'100%');shotgun.style.setProperty('--shotgun-kick-scale',String(1+power*.035));
  shotgun.style.setProperty('--shotgun-hip-image',weaponArtCss(kick?shotgunPump.hipKickAsset:back?shotgunPump.backAsset:shotgunPump.restAsset));
  view.style.setProperty('--recoil',power*12+'px');
  phase.value=pose?.phase??(action==='shell'?load.phase:action==='pump'?(back?'Pompe arrière':'Pompe avant / repos'):'Repos · '+selected);
  return {aim,reloading};
}
for(const button of document.querySelectorAll('[data-action]'))button.onclick=async()=>{
  if(!context){context=new AudioContext();audio=new WeaponMechanicalAudio(context,context.destination);}
  await context.resume();stop();audio.setVolume(Number(volume.value));action=button.dataset.action;select(action==='pistol'?'pistol':'shotgun');ads.checked=false;render();
};
document.querySelector('#stop').onclick=stop;volume.oninput=()=>audio?.setVolume(Number(volume.value));
window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',()=>{audio?.dispose();motion.dispose();void context?.close();});
select('pistol');render();
function tick(time){
 const delta=last?Math.min((time-last)/1000,.05):0;last=time;
 if(action){const previous=elapsed;elapsed+=delta*(slow.checked ? 0.25 : 1);const events=action==='pistol'?pistolReloadSoundEvents:action==='pump'?shotgunPumpSoundEvents:[];
  for(const event of crossedWeaponSoundEvents(events,previous,elapsed))audio?.play(event.sound);
  if(action==='shell'&&!shellCommitted&&previous<shotgunReload.commitAt&&elapsed>=shotgunReload.commitAt){shellCommitted=true;audio?.play('shell-insert');}
  const duration=action==='pistol'?reloadDuration:action==='shell'?shotgunReload.duration:.65;
  if(elapsed>=duration)action=null;
 }
 const state=render();position.x+=Number(pace.value)*delta;motion.update(delta,position,!document.hidden&&document.hasFocus(),state.aim,state.reloading);
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
</script></html>`);

// Séquence d'écoute au gain exact du jeu, sans normalisation du volume.
const rate = 48000, sequence = new Float32Array(rate * 5);
const events = [
  ...pistolReloadSoundEvents.map(event => ({ ...event, at: event.at + 0.2 })),
  { at: 2.1 + shotgunReload.commitAt, sound: 'shell-insert' },
  ...shotgunPumpSoundEvents.map(event => ({ ...event, at: event.at + 3.4 })),
];
for (const event of events) {
  const samples = createWeaponMechanicalSamples(event.sound, rate), first = Math.round(event.at * rate);
  for (let i = 0; i < samples.length; i++) sequence[first + i] += samples[i] * WEAPON_MECHANICAL_BASE_GAIN;
}
const wav = Buffer.alloc(44 + sequence.length * 2);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(sequence.length*2,40);
for(let i=0;i<sequence.length;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sequence[i]))*32767),44+i*2);
mkdirSync('docs/asset-packs/weapon-feedback-v1',{recursive:true});
writeFileSync('docs/asset-packs/weapon-feedback-v1/mechanics-preview.wav',wav);
console.log('Aperçu : /tmp/weapon-feedback-preview/index.html ; écoute : docs/asset-packs/weapon-feedback-v1/mechanics-preview.wav');
