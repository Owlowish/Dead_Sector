import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const manifest=JSON.parse(readFileSync('docs/asset-packs/pompe-agile.manifest.json','utf8'));
const images=Object.fromEntries(Object.entries(manifest.assets).map(([name,a])=>[name,pathToFileURL(resolve(a.file)).href]));
images.original=pathToFileURL(resolve('public/assets/zombies/zombie_idle.png')).href;
const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><title>DEAD SECTOR — Pompe et Coureur : assets</title><style>
body{margin:24px;background:#1d2023;color:#d4c6a5;font:15px/1.5 monospace;max-width:1180px}h1{font-size:23px}h2{font-size:19px;margin-top:30px}h3{font-size:15px}.row{display:flex;gap:18px;flex-wrap:wrap;align-items:start}canvas{background:#29292b;border-bottom:1px solid #b69a60;image-rendering:pixelated;max-width:100%;height:auto}button,select{font:inherit;padding:8px 12px;background:#36383a;color:#d4c6a5;border:1px solid #8c7853;margin:6px 5px 6px 0;cursor:pointer}button:disabled{opacity:.45;cursor:default}label{margin-right:12px}.notice{padding:12px;border-left:3px solid #b85b4a;background:#342727;max-width:1000px}.ok{color:#a7b09a}.muted{color:#a4a9ae}.stat{min-height:24px}details{margin-top:24px}img{image-rendering:pixelated;object-fit:contain}article{max-width:560px}.props{display:flex;gap:12px;align-items:center;flex-wrap:wrap}small{font-size:12px}.badge{color:#dfba73}
</style><h1>DEAD SECTOR — Fusil à pompe & Coureur</h1>
<p>Pack artistique préparé, sans intégration au gameplay. Les cycles utilisent le manifeste livré ; cet aperçu ne valide ni dégâts, ni munitions, ni navigation.</p>
<p class="notice"><strong>Ressource manquante :</strong> planche d'insertion des cartouches, refusée deux fois par l'outil d'images. Aucun rechargement complet n'est simulé ici. Les poses ADS/pompe sont des dessins 2D à valider artistiquement.</p>
<h2>Fusil — une séquence, une éjection</h2><div class="row"><article><h3>Hanche</h3><canvas id="hip" width="400" height="400"></canvas></article><article><h3>ADS</h3><canvas id="ads" width="400" height="400"></canvas></article></div>
<button id="fire">Un cycle de tir/pompe</button><button id="weapon-reset">Repos</button><label><input type="checkbox" id="slow"> Lecture lente ×4</label><label><input type="checkbox" id="anchors"> Ancrages</label>
<p class="stat" id="weapon-status">Repos</p><div class="props" id="props"></div>
<h2>Coureur — silhouette et animations</h2><p>Zombie initial à gauche, nouveau type à droite. Même appui au sol ; course sur place, déplacement à ajouter par le code.</p>
<canvas id="zombie" width="700" height="300"></canvas><div><button data-zombie="idle">Repos</button><button data-zombie="run">Course</button><button data-zombie="attack">Une attaque</button><button data-zombie="hurt">Une blessure</button><button data-zombie="death">Une mort</button></div>
<p class="stat" id="zombie-status">Repos</p><p class="muted">La dernière pose morte reste dans un billboard vertical. Le gilet ocre, les cheveux et la posture basse complètent la différence de vitesse.</p>
<details id="all-assets"><summary>Inventaire des 16 PNG, avec essais et références</summary><div id="gallery"></div></details><p id="status">Chargement des images…</p>
<script>
const M=${JSON.stringify(manifest)}, sources=${JSON.stringify(images)}, loaded={};
let ready=false, previous=performance.now(), manual=false;
let shotTime=null,ejections=0,zombieKind='idle',zombieTime=0,meleeEvents=0;
const canvases={hip:document.querySelector('#hip'),ads:document.querySelector('#ads'),zombie:document.querySelector('#zombie')};
function frameAt(sequence,time){let left=time;for(let i=0;i<sequence.frames.length;i++){if(left<sequence.frames[i].duration)return sequence.frames[i];left-=sequence.frames[i].duration;}return sequence.frames.at(-1);}
function total(sequence){return sequence.frames.reduce((s,f)=>s+f.duration,0);}
function sprite(ctx,f,x,y,w,h){const r=f.rect;ctx.drawImage(loaded[f.asset],r.x,r.y,r.width,r.height,x,y,w,h);}
function renderWeapon(mode){const c=canvases[mode],ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#29292b';ctx.fillRect(0,0,c.width,c.height);const cycle=M.shotgun.fire[mode],f=shotTime===null?M.shotgun.ready[mode]:frameAt(cycle,shotTime);const scale=c.width/f.rect.width,kick=f.kick??0;sprite(ctx,f,0,kick,c.width,c.height);
 if(f.flash!==undefined&&f.flash!==null&&shotTime!==null&&shotTime<.07){const flash=M.shotgun.muzzleFlash[f.flash],size=mode==='hip'?110:95,px=f.anchors.muzzle[0]*scale,py=f.anchors.muzzle[1]*scale+kick;sprite(ctx,flash,px-size/2,py-size*.55,size,size);}
 if(shotTime!==null&&shotTime>=.19&&shotTime<.7){const dt=shotTime-.19,shell=M.shotgun.spentShells[Math.floor(dt*24)%4],x=f.anchors.ejection[0]*scale+dt*260,y=f.anchors.ejection[1]*scale-dt*120+dt*dt*120;ctx.save();ctx.translate(x,y);ctx.rotate(dt*13);sprite(ctx,shell,-11,-6,22,12);ctx.restore();}
 if(document.querySelector('#anchors').checked){ctx.strokeStyle='#dfba73';const p=f.anchors.muzzle;ctx.beginPath();ctx.moveTo(p[0]*scale-7,p[1]*scale+kick);ctx.lineTo(p[0]*scale+7,p[1]*scale+kick);ctx.moveTo(p[0]*scale,p[1]*scale+kick-7);ctx.lineTo(p[0]*scale,p[1]*scale+kick+7);ctx.stroke();}
}
function drawActor(ctx,f,ppu,rootX,groundY,pixelsPerWorld){const r=f.rect,s=pixelsPerWorld/ppu,dx=rootX+(r.x-f.anchor[0])*s,dy=groundY+(r.y-f.anchor[1])*s;ctx.save();if(f.clipPolygon){ctx.beginPath();f.clipPolygon.forEach(([x,y],i)=>{const px=rootX+(x-f.anchor[0])*s,py=groundY+(y-f.anchor[1])*s;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();ctx.clip();}sprite(ctx,f,dx,dy,r.width*s,r.height*s);ctx.restore();}
function renderZombie(){const ctx=canvases.zombie.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,700,300);ctx.fillStyle='#29292b';ctx.fillRect(0,0,700,300);ctx.strokeStyle='#726247';ctx.beginPath();ctx.moveTo(20,265);ctx.lineTo(680,265);ctx.stroke();ctx.fillStyle='#d4c6a5';ctx.font='14px monospace';ctx.fillText('Initial',130,290);ctx.fillText('Coureur',430,290);ctx.drawImage(loaded.original,120,65,100,200);
 const a=M.agile.animations[zombieKind],t=a.loop?zombieTime%total(a):Math.min(zombieTime,total(a)),f=frameAt(a,t);drawActor(ctx,f,a.pixelsPerUnit,475,265,100);document.querySelector('#zombie-status').textContent=zombieKind+' · '+Math.min(zombieTime,total(a)).toFixed(2)+' s · coups visuels : '+meleeEvents;
}
function render(){if(!ready)return;renderWeapon('hip');renderWeapon('ads');renderZombie();document.querySelector('#weapon-status').textContent=(shotTime===null?'Repos':shotTime.toFixed(2)+' s')+' · éjection : '+ejections;}
function tick(dt){if(shotTime!==null){const old=shotTime;shotTime+=dt;if(old<.19&&shotTime>=.19)ejections++;if(shotTime>total(M.shotgun.fire.hip)+.2){shotTime=null;document.querySelector('#fire').disabled=false;}}
 const old=zombieTime;zombieTime+=dt;if(zombieKind==='attack'&&old<.45&&zombieTime>=.45)meleeEvents++;render();}
function select(kind){zombieKind=kind;zombieTime=0;meleeEvents=0;}
document.querySelector('#fire').onclick=()=>{manual=false;if(shotTime!==null)return;shotTime=0;ejections=0;document.querySelector('#fire').disabled=true;render();};
document.querySelector('#weapon-reset').onclick=()=>{shotTime=null;ejections=0;document.querySelector('#fire').disabled=false;render();};
document.querySelector('#anchors').onchange=render;
document.querySelectorAll('[data-zombie]').forEach(button=>button.onclick=()=>{manual=false;select(button.dataset.zombie);render();});
window.packPreview={freeze(){manual=true;render();},shot(t){manual=true;shotTime=t;ejections=t>=.19?1:0;render();},zombie(kind,t){manual=true;select(kind);zombieTime=t;meleeEvents=kind==='attack'&&t>=.45?1:0;render();},state(){return {shotTime,ejections,zombieKind,zombieTime,meleeEvents};}};
Promise.all(Object.entries(sources).map(([key,url])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{loaded[key]=im;resolve()};im.onerror=()=>reject(Error(key));im.src=url;}))).then(()=>{ready=true;window.previewReady=true;render();document.querySelector('#status').textContent='Images chargées ; aperçu prêt. Rechargement : manquant.';for(const key of ['liveShell','ammoPickup','weaponPickup']){const f=M.shotgun[key],canvas=document.createElement('canvas');canvas.width=key==='weaponPickup'?180:80;canvas.height=80;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;const aspect=f.rect.width/f.rect.height,w=Math.min(canvas.width,80*aspect),h=w/aspect;sprite(ctx,f,(canvas.width-w)/2,(80-h)/2,w,h);document.querySelector('#props').appendChild(canvas);}for(const [name,a] of Object.entries(M.assets)){const article=document.createElement('article');article.innerHTML='<h3>'+name+'</h3><small>'+a.status+' · '+a.width+'×'+a.height+'</small><br>';const im=new Image();im.src=sources[name];im.width=240;im.height=180;article.appendChild(im);document.querySelector('#gallery').appendChild(article);}}).catch(error=>{window.previewError=String(error);document.querySelector('#status').textContent=String(error)});
function loop(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(!manual)tick(dt*(document.querySelector('#slow').checked?.25:1));requestAnimationFrame(loop);}requestAnimationFrame(loop);
</script></html>`;
mkdirSync('tmp/shotgun-agile-preview',{recursive:true});writeFileSync('tmp/shotgun-agile-preview/index.html',html);
console.log(resolve('tmp/shotgun-agile-preview/index.html'));
