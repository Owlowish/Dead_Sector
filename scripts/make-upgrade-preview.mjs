import { mkdirSync, writeFileSync } from 'node:fs';
import { UPGRADE_CONFIGS } from '../src/UpgradeConfig.ts';

mkdirSync('tmp/upgrade-preview', { recursive: true });
writeFileSync('tmp/upgrade-preview/index.html', `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Bonus — revue artistique</title>
<style>body{margin:24px;background:#191b20;color:#d4c6a5;font:16px system-ui}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.item{background:#292a2c;border:1px solid #5b503e;padding:16px}img{image-rendering:pixelated;object-fit:contain}iframe{border:1px solid #5b503e;width:960px;height:720px;max-width:100%}.row{display:flex;align-items:end;gap:8px}a{color:#d9b46e}</style>
<h1>Quatre bonus — cuir, métal et laiton patiné</h1><p>Sources générées sans retouche ; tailles d’affichage 48, 72 et 96 px. Les effets du catalogue restent indépendants de ces images.</p>
<div class="grid">${UPGRADE_CONFIGS.map(offer=>`<section class="item"><h2>${offer.name}</h2><div class="row">${[48,72,96].map(size=>`<img src="/${offer.spriteAssetId}" width="${size}" height="${size}" alt="${offer.name}">`).join('')}</div><p>${offer.shortDesc}</p></section>`).join('')}</div>
<p>Aperçu isolé : les vraies stèles et le vrai Level, affichés en 320 × 240 puis agrandis. Les quatre offres côte à côte servent uniquement à la revue ; le jeu en propose toujours au maximum deux.</p>
<iframe title="Stèles dans le Grand Salon" src="scene.html"></iframe>
<p><a href="/tmp/weapon-preview/index.html">Pistolet : couches et rechargement</a> · <a href="/tmp/shotgun-preview/index.html">Fusil : recul, pompe, ADS et insertion</a></p></html>`);
writeFileSync('tmp/upgrade-preview/scene.html', `<!doctype html><html lang="fr"><meta charset="utf-8"><style>body{margin:0;background:#10131a}canvas{width:960px;height:720px;display:block;image-rendering:pixelated}</style><script type="module">
import * as THREE from 'three';
import { Level } from '/src/Level.ts';
import { UpgradePedestal } from '/src/UpgradePedestal.ts';
import { UPGRADE_CONFIGS } from '/src/UpgradeConfig.ts';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x10131a);
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(320,240,false);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const level=new Level(scene), camera=new THREE.PerspectiveCamera(75,4/3,0.1,100);camera.position.set(-7,1.7,11.3);camera.lookAt(-7,1.2,8.5);
const pedestals=UPGRADE_CONFIGS.map((offer,i)=>{const x=-9.1+i*1.4,p=new UpgradePedestal(scene,x,8.5,level.getFloorHeightAt(x,8.5));p.setOffer(offer);return p;});
window.__upgradePreview={pedestals,scene,camera};
renderer.setAnimationLoop(()=>{for(const p of pedestals)p.update(0,camera.position);renderer.render(scene,camera);});
</script></html>`);
console.log('Aperçu : http://127.0.0.1:5173/tmp/upgrade-preview/index.html');
