import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';
const m=JSON.parse(readFileSync('docs/asset-packs/pompe-agile.manifest.json','utf8'));
for(const [name,a] of Object.entries(m.assets)){const im=readSpritePng(a.file);assert.equal(im.width,a.width,name);assert.equal(im.height,a.height,name);assert(alphaBounds(im),name+' contient un sprite');assert(im.data[3]===0,name+' coin transparent');}
let count=0;
function visit(value){if(!value||typeof value!=='object')return;if(value.asset&&value.rect){const a=m.assets[value.asset],r=value.rect;assert(a,value.asset);assert(r.x>=0&&r.y>=0&&r.width>0&&r.height>0);assert(r.x+r.width<=a.width&&r.y+r.height<=a.height,value.asset+' région dans PNG');if(value.clipPolygon)for(const [x,y]of value.clipPolygon)assert(x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height,'masque dans sa région');count++;}for(const v of Object.values(value))if(typeof v==='object')visit(v);}
visit(m.shotgun);visit(m.agile);
assert.equal(m.agile.animations.run.frames.length,6);assert.equal(m.agile.animations.attack.frames.length,4);assert.equal(m.agile.animations.hurt.frames.length,2);assert.equal(m.agile.animations.death.frames.length,4);assert(m.agile.animations.death.keepLastFrameAsVerticalBillboard);
for(const mode of ['hip','ads']){const cycle=m.shotgun.fire[mode],duration=cycle.frames.reduce((s,f)=>s+f.duration,0);for(const e of cycle.events)assert(e.at>=0&&e.at<duration);assert.equal(cycle.events.filter(e=>e.type==='eject_spent_shell_once').length,1);assert.equal(cycle.frames.at(-1).asset,m.shotgun.ready[mode].asset);}
assert.equal(m.shotgun.reload.asset,null);assert.equal(m.shotgun.reload.status,'missing_art_tool_rejected');assert(!existsSync('public/assets/weapons/shotgun/reload.png'),'Ne pas déclarer de fausse planche de rechargement');
console.log('OK : 16 PNG RGBA, alpha, dimensions, '+count+' régions/masques valides, poses et événements cohérents.');console.log('INCOMPLET connu : planche de rechargement absente, refus imagegen enregistré. Aucun test de gameplay nouveau.');
