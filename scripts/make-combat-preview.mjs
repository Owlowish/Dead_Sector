import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zombieAnimation } from '../src/ZombieAnimation.ts';
import { spreadRadiusPixels, hipSpreadDegrees } from '../src/WeaponSpread.ts';

const directory = resolve('tmp/combat-preview');
await mkdir(directory, { recursive: true });
const asset = path => pathToFileURL(resolve('public/assets', path)).href;
const css = await readFile('src/style.css', 'utf8');
const atlas = zombieAnimation.hurt;
const frameHeight = 260;
const atlasHeight = frameHeight / atlas.cropHeight;
const frameWidth = frameHeight / 2;
const hurtStyle = `width:${frameWidth}px;height:${frameHeight}px;background-image:url('${asset('zombies/zombie_hurt_v2.png')}');background-size:${frameWidth * atlas.columns}px ${atlasHeight}px;background-position-y:-${atlasHeight * atlas.cropTop}px;`;
const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>DEAD SECTOR — Combat : aperçu isolé</title>
<style>${css}
body{overflow:auto;background:#191a1b;color:#d4c6a5;font:16px monospace;padding:30px;box-sizing:border-box}h1{font-size:23px}h2{font-size:17px}section{border:1px solid #726247;padding:16px;margin:18px 0}img,.pose{image-rendering:pixelated}.row{display:flex;align-items:end;gap:34px}.card{text-align:center}.pose{background-repeat:no-repeat;display:inline-block}button{padding:10px;color:#d4c6a5;background:#303030;border:1px solid #b69a60;cursor:pointer}p{max-width:1000px;line-height:1.5}.sample{display:inline-block;position:relative;width:360px;height:160px;background:#30251d}.sample .crosshair{--aim:0}.status{color:#a7b09a}label{display:block;margin:14px 0}
</style><h1>DEAD SECTOR — Lisibilité et réaction</h1>
<p>Aperçu isolé : ce document vérifie le cadrage et les phases. Il ne remplace pas l'éclairage et le combat du jeu.</p>
<section><h2>Ramassages — sprites à 64 et 40 pixels</h2><div class="row">
${['pickups/medkit.png','pickups/ammo.png'].map(path => `<div class="card"><img width="64" height="64" src="${asset(path)}"><img width="40" height="40" src="${asset(path)}"><p>${path}</p></div>`).join('')}
</div></section>
<section><h2>Blessure — deux poses, ${zombieAnimation.hurtDuration} seconde</h2><div class="row">
<div class="card"><img width="130" height="260" src="${asset('zombies/zombie_idle.png')}"><p>Repos</p></div>
<div class="card"><div class="pose" style="${hurtStyle}background-position-x:0px"></div><p>Recul</p></div>
<div class="card"><div class="pose" style="${hurtStyle}background-position-x:-${frameWidth}px"></div><p>Retour</p></div>
<div class="card"><div id="cycle" class="pose" style="${hurtStyle}"></div><p id="phase">Repos</p></div>
</div><button id="play">Une blessure</button><label><input type="checkbox" id="slow"> Lecture lente ×4</label></section>
<section><h2>Viseur — projection à une hauteur de 900 pixels</h2><p>Hanche : demi-angle ${hipSpreadDegrees}°, rayon ${spreadRadiusPixels(0,75,900).toFixed(1)} px. ADS : dispersion nulle. Les branches disparaissent progressivement en ADS.</p>
<div class="sample"><div class="crosshair" style="--spread-radius:${spreadRadiusPixels(0,75,900)}px"><span class="crosshair-top"></span><span class="crosshair-right"></span><span class="crosshair-bottom"></span><span class="crosshair-left"></span></div></div>
</section><p class="status" id="status">Chargement…</p>
<script>
const cycle=document.querySelector('#cycle');const phase=document.querySelector('#phase');const duration=${zombieAnimation.hurtDuration};let start=null;
function idle(){cycle.style.backgroundImage="url('${asset('zombies/zombie_idle.png')}')";cycle.style.backgroundSize='130px 260px';cycle.style.backgroundPosition='0 0';phase.textContent='Repos';}
idle();document.querySelector('#play').onclick=()=>{if(start!==null)return;start=performance.now();const factor=document.querySelector('#slow').checked?4:1;
function frame(now){const t=(now-start)/1000/factor;if(t>=duration){start=null;idle();return;}const index=t<duration/2?0:1;cycle.style.backgroundImage="url('${asset('zombies/zombie_hurt_v2.png')}')";cycle.style.backgroundSize='${frameWidth * atlas.columns}px ${atlasHeight}px';cycle.style.backgroundPosition=(-index*${frameWidth})+'px -${atlasHeight * atlas.cropTop}px';phase.textContent=index?'Retour':'Recul';requestAnimationFrame(frame);}requestAnimationFrame(frame);};
Promise.all([...document.images].map(img=>img.decode())).then(()=>document.querySelector('#status').textContent='Images chargées — aperçu prêt.').catch(error=>document.querySelector('#status').textContent='Erreur : '+error);
</script></html>`;
await writeFile(resolve(directory, 'index.html'), html);
console.log(resolve(directory, 'index.html'));
