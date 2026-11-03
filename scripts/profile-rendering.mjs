// Diagnostic isolé : aucune écriture dans le jeu, aucun accès au profil Chrome personnel.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const label = process.argv[2] ?? 'current';
const traceToggle = process.argv.includes('--trace-toggle');
assert.match(label, /^[a-z0-9-]+$/i);
const dir = 'tmp/render-profile';
mkdirSync(dir, { recursive: true });
const html = readFileSync('index.html', 'utf8').replace('<script type="module" src="/src/main.ts"></script>', `<script type="module">
import '/src/style.css';
import { Game } from '/src/Game.ts';
import { installWeaponArt } from '/src/WeaponPresentation.ts';
const glCalls={compile:0,link:0};
for(const [name,key] of [['compileShader','compile'],['linkProgram','link']]){
 const original=WebGL2RenderingContext.prototype[name];
 WebGL2RenderingContext.prototype[name]=function(...args){glCalls[key]++;return original.apply(this,args);};
}
const game=new Game(),renderer=game.renderer,frames=[];
const draw=renderer.render.bind(renderer);let phase='loading',last=performance.now();
renderer.render=function(...args){const start=performance.now(),compile=glCalls.compile,link=glCalls.link;draw(...args);frames.push({phase,dt:start-last,cpu:performance.now()-start,compile:glCalls.compile-compile,link:glCalls.link-link,calls:renderer.info.render.calls,programs:renderer.info.programs.length});last=start;};
const next=()=>new Promise(r=>requestAnimationFrame(r));
const sample=async(name,count=90,action)=>{phase=name;const start=frames.length;action?.();for(let i=0;i<count;i++)await next();return frames.slice(start);};
window.__renderProfile={game,renderer,glCalls,frames,sample};
game.start();await installWeaponArt();window.__renderProfile.ready=true;
</script>`);
writeFileSync(`${dir}/index.html`, html);
const port=9355, pause=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
 '--headless=new','--no-first-run','--no-default-browser-check',
 '--disable-background-timer-throttling','--disable-renderer-backgrounding',
 `--remote-debugging-port=${port}`,`--user-data-dir=${resolve(dir, 'chrome-'+label)}`,'about:blank'
],{windowsHide:true,stdio:'ignore'});
let ws, finishTrace;const report={label,exceptions:[],missing:[],warnings:[],phases:{}};
try{
 let target;
 for(let i=0;i<80;i++){try{target=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(target)break;}catch{}await pause(250);}
 assert.ok(target,'Chrome headless accessible');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}
  if(m.method==='Runtime.exceptionThrown')report.exceptions.push(m.params.exceptionDetails);
  if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&!m.params.response.url.endsWith('/favicon.ico'))report.missing.push(m.params.response.url);
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='warning')report.warnings.push(m.params.args.map(a=>a.value??a.description).join(' '));
  if(m.method==='Tracing.tracingComplete')finishTrace?.(m.params.stream);
 };
 const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173/tmp/render-profile/index.html'});
 let ready=false;
 for(let i=0;i<100;i++){ready=await evaluate(`!!window.__renderProfile?.ready`);if(ready)break;await pause(250);}
 assert.ok(ready,JSON.stringify(report));
 // Attendre les cartes des matériaux et les premiers rendus avant le scénario de lampe.
 for(let i=0;i<100;i++){if(await evaluate(`(()=>{let ready=true;__renderProfile.game.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.map)ready=ready&&!!m.map.image?.complete;});return ready;})()`))break;await pause(250);}
 await evaluate(`__renderProfile.sample('warmup',120)`);
 report.renderer=await evaluate(`(()=>{const gl=__renderProfile.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};})()`);
 const summarize=rows=>{
  const summary={count:rows.length,compile:0,link:0,programsFirst:rows[0]?.programs,programsLast:rows.at(-1)?.programs};
  for(const key of ['dt','cpu','calls']){const vals=rows.map(r=>r[key]).sort((a,b)=>a-b);summary[key]={median:vals[Math.floor(vals.length*.5)],p95:vals[Math.floor(vals.length*.95)],max:vals.at(-1)};}
  for(const r of rows){summary.compile+=r.compile;summary.link+=r.link;}
  summary.firstFrames=rows.slice(0,3);
  summary.slowestFrames=rows.map((r,index)=>({...r,index})).sort((a,b)=>b.cpu-a.cpu).slice(0,3);
  return summary;
 };
 const measure=async(name,action='',count=90)=>{const rows=await evaluate(`__renderProfile.sample(${JSON.stringify(name)},${count},()=>{${action}})`);report.phases[name]=summarize(rows);};
 await measure('torch-on');
 if(traceToggle)await send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,v8,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream'});
 await measure('first-off','__renderProfile.game.player.toggleFlashlight();');
 if(traceToggle){
  const completed=new Promise(r=>{finishTrace=r;});await send('Tracing.end');const handle=await completed;
  let data='';while(true){const chunk=await send('IO.read',{handle});data+=chunk.base64Encoded?Buffer.from(chunk.data,'base64').toString():chunk.data;if(chunk.eof)break;}
  await send('IO.close',{handle});writeFileSync(`${dir}/${label}-trace.json`,data);
 }
 await measure('first-on','__renderProfile.game.player.toggleFlashlight();');
 await measure('warm-off','__renderProfile.game.player.toggleFlashlight();');
 await measure('warm-on','__renderProfile.game.player.toggleFlashlight();');
 // Comparaison de coût en vue fixe ; garder les ombres déjà calculées, sans changer l'image.
 await measure('cached-shadows','__renderProfile.renderer.shadowMap.autoUpdate=false;');
 await measure('live-shadows','__renderProfile.renderer.shadowMap.autoUpdate=true;');
 await evaluate(`(()=>{const p=__renderProfile;p.game.startTier(4);Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>p.renderer.domElement});document.dispatchEvent(new Event('pointerlockchange'));p.game.player.takeDamage=()=>{};})()`);
 await measure('combat-warmup','',180);
 await measure('combat','',180);
 report.game=await evaluate(`__renderProfile.game.getPerformanceReport()`);
 // Estimation RGBA8 + mipmaps, pas une lecture de mémoire VRAM du pilote.
 report.textureEstimate=await evaluate(`(()=>{const sources=new Map();__renderProfile.game.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])for(const key of ['map','emissiveMap']){const t=m?.[key],i=t?.image;if(i?.width)sources.set(t.source.uuid,{name:t.name,width:i.width,height:i.height,estimatedRGBA8Bytes:i.width*i.height*4*(t.generateMipmaps?4/3:1)});}});return [...sources.values()];})()`);
 assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.missing,[]);
 writeFileSync(`${dir}/${label}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({label,renderer:report.renderer,phases:Object.fromEntries(Object.entries(report.phases).map(([k,v])=>[k,{...v,firstFrames:undefined,slowestFrames:undefined}])),game:report.game,warnings:report.warnings.length},null,2));
 void send('Browser.close');await pause(200);
}finally{ws?.close();chrome.kill();}
