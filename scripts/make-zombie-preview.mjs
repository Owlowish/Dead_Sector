import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zombieAnimation, attackFrame, atlasRegion } from '../src/ZombieAnimation.ts';

const paths = {
  idle: pathToFileURL(resolve('public/assets/zombies/zombie_idle.png')).href,
  walk: pathToFileURL(resolve('public/assets/zombies/zombie_walk_v2.png')).href,
  attack: pathToFileURL(resolve('public/assets/zombies/zombie_attack.png')).href,
};
function style(kind, frame) {
  const atlas = zombieAnimation[kind];
  const r = atlasRegion(frame, atlas);
  return `background-image:url('${paths[kind]}');background-size:${100 / r.repeatX}% ${100 / r.repeatY}%;background-position:${r.offsetX / (1 - r.repeatX) * 100}% ${(1 - r.offsetY - r.repeatY) / (1 - r.repeatY) * 100}%;`;
}
const cards = (kind, count) => Array.from({ length: count }, (_, frame) => `<article><header>${kind} ${frame + 1}</header><div class="sprite" style="${style(kind, frame)}"></div></article>`).join('');
mkdirSync('tmp/zombie-preview', { recursive: true });
writeFileSync('tmp/zombie-preview/index.html', `<!doctype html><meta charset="utf-8"><style>
body{background:#272c32;color:#dacaa9;font:16px monospace;margin:20px}h1{font-size:22px}
.grid{display:flex;gap:12px;flex-wrap:wrap}article{border:1px solid #6c6558;width:160px;background:linear-gradient(transparent 98%,#baab87 98.5%,transparent 99%)}
header{padding:5px;background:#15191d;font-size:13px}.sprite{width:160px;height:320px;background-repeat:no-repeat;image-rendering:pixelated}
.live{display:flex;gap:30px;align-items:start}button{font:inherit;padding:8px;margin-bottom:10px}
</style><h1>Zombie : même cadrage que dans le jeu</h1>
<section class="live"><article><header>Marche en boucle</header><div id="walk" class="sprite"></div></article>
<article><header id="phase">Attaque au repos</header><div id="attack" class="sprite"></div></article>
<div><button id="play">Une attaque (0,92 s)</button><p>Le coup intervient à 0,6 seconde.</p><label><input id="slow" type="checkbox">Lecture lente × 0,25</label></div></section>
<h2>Six poses de marche</h2><section class="grid">${cards('walk',6)}</section>
<h2>Quatre poses d'attaque</h2><section class="grid">${cards('attack',4)}</section>
<script>
const config=${JSON.stringify(zombieAnimation)};
const walkStyles=${JSON.stringify(Array.from({length:6},(_,i)=>style('walk',i)))};
const attackStyles=${JSON.stringify(Array.from({length:4},(_,i)=>style('attack',i)))};
const chooseFrame=${attackFrame.toString()};
const zombieAnimation=config;
let attackTime=null, walkTime=0, previous=performance.now();
const button=document.querySelector('#play');
const idleStyle=${JSON.stringify(`background-image:url('${paths.idle}');background-size:100% 100%;`)};
button.onclick=()=>{attackTime=0;button.disabled=true};
function tick(now){
 const dt=Math.min((now-previous)/1000,0.05)*(document.querySelector('#slow').checked?0.25:1);previous=now;
 walkTime+=dt;document.querySelector('#walk').style.cssText=walkStyles[Math.floor(walkTime/config.walk.frameDuration)%6];
 if(attackTime!==null){attackTime+=dt;document.querySelector('#attack').style.cssText=attackStyles[chooseFrame(attackTime)];document.querySelector('#phase').textContent=attackTime<config.windup?'Préparation':attackTime<config.windup+config.impactDuration?'Coup — dégâts':'Retour';
 if(attackTime>=config.windup+config.impactDuration+config.recoveryDuration){attackTime=null;button.disabled=false}}
 else {document.querySelector('#attack').style.cssText=idleStyle;document.querySelector('#phase').textContent='Repos'}
 requestAnimationFrame(tick);
}requestAnimationFrame(tick);
</script>`);
// Planche fixe pour vérifier les silhouettes sans dépendre du moment de capture.
const html = readFileSync('tmp/zombie-preview/index.html','utf8');
writeFileSync('tmp/zombie-preview/poses.html', html.replace(/<section class="live">[\s\S]*?<h2>/, '<h2>').replace(/<script>[\s\S]*?<\/script>/, ''));
console.log('Aperçu : tmp/zombie-preview/index.html ; planche : tmp/zombie-preview/poses.html');
