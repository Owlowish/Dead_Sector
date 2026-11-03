import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('tmp/spitter-preview', { recursive: true });
writeFileSync('tmp/spitter-preview/index.html', `<!doctype html><html lang="fr"><meta charset="utf-8">
<title>Cracheur — cycle isolé</title>
<style>
body{margin:0;background:#171316;color:#e3d7c6;font:16px system-ui;padding:20px}
button{padding:8px 16px;margin:0 8px 16px 0;background:#3c4634;color:white;border:1px solid #88916d;cursor:pointer}
.stages{display:flex;gap:24px;align-items:end}.stage{width:210px;height:260px;background:linear-gradient(#28232b 55%,#322822 55%);display:grid;place-items:end center;border:1px solid #665b54}
.stage img{object-fit:contain;object-position:center bottom;image-rendering:pixelated}.small img{height:80px}.large img{height:180px}
small{display:block;margin-top:12px;color:#bbb}
</style>
<h1>Cracheur — animations isolées</h1><p id="phase">repos</p><button id="play">Jouer un crachat</button><button id="walk">Jouer la marche</button><button id="die">Jouer la mort</button><button id="stop">Revenir au repos</button><button data-pose="windup">Préparation</button><button data-pose="release">Libération</button><button data-pose="recovery">Récupération</button><button data-pose="death-a">Choc</button><button data-pose="death">Affaissement</button><button data-pose="corpse">Cadavre</button>
<div class="stages"><div class="stage small"><img id="small" alt="Cracheur à 80 pixels"></div><div class="stage large"><img id="large" alt="Cracheur à 180 pixels"></div></div>
<small>La petite taille simule la lecture d'un ennemi éloigné ; comparer pieds, chaîne et boutons entre phases.</small>
<script type="module">
import { spitterAnimation } from '/src/SpitterAnimation.ts';
const phases=[['repos','idle',500],['préparation','windup',spitterAnimation.windupDuration*1000],['libération','release',spitterAnimation.releaseDuration*1000],['récupération','recovery',spitterAnimation.recoveryDuration*1000],['repos','idle',500]];
const walk=[['pas gauche','walk-a',spitterAnimation.walkPoseDuration*1000],['pas droit','walk-b',spitterAnimation.walkPoseDuration*1000],['pas gauche','walk-a',spitterAnimation.walkPoseDuration*1000],['pas droit','walk-b',spitterAnimation.walkPoseDuration*1000],['repos','idle',400]];
const dying=[['choc','death-a',spitterAnimation.deathFrameDuration*1000],['affaissement','death',spitterAnimation.deathFrameDuration*1000],['cadavre','corpse',1000]];
let timer;
function show(name,file){document.querySelector('#phase').textContent=name;for(const id of ['small','large'])document.getElementById(id).src='/assets/zombies/spitter/'+file+'.png';}
function stop(){clearTimeout(timer);show('repos','idle');}
function step(sequence,i){const [name,file,duration]=sequence[i];show(name,file);if(i+1<sequence.length)timer=setTimeout(()=>step(sequence,i+1),duration);}
document.querySelector('#play').onclick=()=>{clearTimeout(timer);step(phases,0)};
document.querySelector('#walk').onclick=()=>{clearTimeout(timer);step(walk,0)};
document.querySelector('#die').onclick=()=>{clearTimeout(timer);step(dying,0)};
document.querySelector('#stop').onclick=stop;
document.querySelectorAll('[data-pose]').forEach(button=>button.onclick=()=>{clearTimeout(timer);show(button.textContent.toLowerCase(),button.dataset.pose)});
const selected=new URLSearchParams(location.search).get('pose');
if(selected && ['idle','walk-a','walk-b','windup','release','recovery','death-a','death','corpse'].includes(selected))show(selected,selected);else stop();
</script>`);
console.log('Aperçu : http://localhost:5173/tmp/spitter-preview/index.html');
