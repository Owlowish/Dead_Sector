import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';
import { axeAttack, axeAssets, axeFrameGeometry, axeGripPivots, axeMotionKeys, sampleAxePose } from '../src/AxeAnimation.ts';
let bytes=0;
for (const [frame, asset] of Object.entries(axeAssets)) {
  const image = readSpritePng('public'+asset);
  assert.equal(image.width,384); assert.equal(image.height,axeFrameGeometry[frame].height);
  const size=readFileSync('public'+asset).length; bytes+=size;
  assert(size<150000, frame+': budget disque');
  assert(alphaBounds(image), frame+': silhouette présente');
  let transparent=0, opaque=0;
  for(let i=3;i<image.data.length;i+=4){
    assert(image.data[i]===0 || image.data[i]===255,frame+': alpha binaire');
    if(image.data[i])opaque++;else transparent++;
  }
  assert(transparent>10000 && opaque>5000,frame+': détourage');
  const [x,y]=axeGripPivots[frame];
  assert(x>40 && x<65 && y>20 && y<90,frame+': pivot dans les prises');
  if(frame==='idle') {
    let left=image.width, right=-1;
    for(let row=20;row<120;row++)for(let column=0;column<image.width;column++) {
      if(!image.data[(row*image.width+column)*4+3])continue;
      left=Math.min(left,column);right=Math.max(right,column);
    }
    assert(right-left+1<=65,'repos : tête étroite et redressée, sans large silhouette latérale');
  }
}
assert(bytes<600000,'budget total');
assert.equal(sampleAxePose(axeAttack.windup).frame,'overhead');
assert.equal(sampleAxePose(axeAttack.impactTime).frame,'impact');
assert.deepEqual(sampleAxePose(.62),sampleAxePose(.659),'hitstop stable pendant 40 ms');
assert(sampleAxePose(.72).y<sampleAxePose(.62).y,'petit retour après impact');
assert.deepEqual(sampleAxePose(Infinity),sampleAxePose(axeAttack.duration),'retour exact au repos');
// Inspecter le bas du canevas transformé : les manches doivent rejoindre le bord.
for(let time=0;time<axeAttack.duration;time+=.001){
  const pose=sampleAxePose(time), geometry=axeFrameGeometry[pose.frame];
  const scale=pose.scale*axeFrameGeometry.idle.span/geometry.span;
  const handY=118-90+axeFrameGeometry.idle.grip[1]/384*90+pose.y;
  const bottom=handY+(geometry.height-geometry.grip[1])/384*90*scale;
  assert(bottom>=100,`${time}: avant-bras coupés au bas du viewport paysage`);
  for(const value of [pose.x,pose.y,pose.scale])assert(Number.isFinite(value));
  if(pose.frame==='overhead')assert(handY-geometry.grip[1]/384*90*scale<=0,'manche armé toujours prolongé hors champ');
}
for(let i=1;i<axeMotionKeys.length;i++) {
  const before=axeMotionKeys[i-1],after=axeMotionKeys[i];
  if(before.time!==after.time)continue;
  // Les positions et écarts projetés ne doivent pas sauter au changement d'image.
  assert.equal(before.x,after.x);assert.equal(before.y,after.y);assert.equal(before.scale,after.scale);
}
console.log('Hache : cinq sprites, alpha/budgets, pivots, couverture des manches, hitstop et récupération OK ('+bytes+' octets).');
