// Générateur d'aperçu isolé pour la validation de perspective du rechargement du fusil à pompe
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = resolve('tmp/shotgun-reload-preview');
mkdirSync(directory, { recursive: true });

const hipUrl = pathToFileURL(resolve('public/assets/weapons/shotgun/hip_pump.png')).href;
const reloadUrl = pathToFileURL(resolve('public/assets/weapons/shotgun/reload_draft.png')).href;

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>DEAD SECTOR — Validation Perspective Rechargement Fusil</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #14171a;
      color: #d4c6a5;
      font-family: Consolas, monospace;
      line-height: 1.5;
    }
    h1 { font-size: 22px; color: #dfba73; margin-top: 0; }
    h2 { font-size: 16px; color: #c4b491; margin: 20px 0 10px; border-bottom: 1px solid #4a3e2e; padding-bottom: 4px; }
    .container { display: flex; gap: 24px; flex-wrap: wrap; }
    .viewport-box {
      position: relative;
      width: 640px;
      height: 480px;
      background: #1e2227 url('/assets/textures/wall.png') repeat;
      background-size: 128px;
      border: 2px solid #5a4b36;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    }
    .hud-overlay {
      position: absolute;
      top: 12px;
      left: 12px;
      font-size: 13px;
      color: #a7b09a;
      text-shadow: 1px 1px 2px #000;
      pointer-events: none;
      z-index: 10;
    }
    .grid-lines {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
      z-index: 5;
    }
    .layer {
      position: absolute;
      inset: 0;
      image-rendering: pixelated;
      pointer-events: none;
      transition: opacity 0.15s ease-out;
    }
    .layer-hip {
      background-image: url('${hipUrl}');
      background-size: 200% 100%;
      background-position: 100% 100%;
      background-repeat: no-repeat;
    }
    .layer-reload {
      background-image: url('${reloadUrl}');
      background-size: contain;
      background-position: right bottom;
      background-repeat: no-repeat;
    }
    .controls {
      flex: 1;
      min-width: 320px;
      background: #1b1e22;
      border: 1px solid #4a3e2e;
      padding: 18px;
      border-radius: 4px;
    }
    .btn-group { display: flex; gap: 8px; margin-bottom: 16px; }
    button {
      padding: 8px 14px;
      background: #2b2e34;
      color: #dfba73;
      border: 1px solid #8c7853;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      border-radius: 3px;
    }
    button.active {
      background: #8c7853;
      color: #14171a;
      font-weight: bold;
    }
    button:hover { background: #3e4249; }
    .slider-box { margin: 18px 0; }
    input[type=range] { width: 100%; accent-color: #dfba73; }
    .checklist {
      list-style: none;
      padding: 0;
      margin: 12px 0;
      font-size: 13px;
    }
    .checklist li {
      padding: 6px 10px;
      margin-bottom: 6px;
      background: #24272c;
      border-left: 4px solid #b85b4a;
    }
    .checklist li.warning { border-color: #d49b38; }
    .checklist li.info { border-color: #5c84a8; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      margin-right: 6px;
    }
    .badge-defect { background: #5a2727; color: #ff8b8b; }
    .badge-info { background: #273e5a; color: #8bbfff; }
  </style>
</head>
<body>

  <h1>DEAD SECTOR — Validation Perspective : Rechargement Fusil à Pompe</h1>
  <p>Outil d'inspection isolée comparant la pose de repos retenue (<code>hip_pump.png</code>) et le premier brouillon de rechargement (<code>reload-base-v1-draft.png</code>).</p>

  <div class="container">
    <div class="viewport-box">
      <div class="hud-overlay" id="hud-text">VUE : REPOS (HANCHE)</div>
      <div class="grid-lines" id="grid"></div>
      <div class="layer layer-hip" id="layer-hip" style="opacity: 1;"></div>
      <div class="layer layer-reload" id="layer-reload" style="opacity: 0;"></div>
    </div>

    <div class="controls">
      <h2>1. Modes de visualisation</h2>
      <div class="btn-group">
        <button id="btn-hip" class="active" onclick="setMode('hip')">Repos (Hanche)</button>
        <button id="btn-reload" onclick="setMode('reload')">Pose Rechargement</button>
        <button id="btn-blink" onclick="toggleBlink()">Bascule A/B (Clignotant)</button>
      </div>

      <div class="slider-box">
        <label for="slider"><strong>Superposition (Pelure d'oignon / Ghosting) :</strong> <span id="blend-val">0%</span></label>
        <input type="range" id="slider" min="0" max="100" value="0" oninput="onSlider(this.value)">
      </div>

      <label><input type="checkbox" id="chk-grid" checked onchange="document.querySelector('#grid').style.display = this.checked ? 'block' : 'none'"> Afficher la grille de repères</label>

      <h2>2. Audit critique des 3 points de perspective</h2>
      <ul class="checklist">
        <li class="warning">
          <span class="badge badge-defect">DÉFAUT 1</span> <strong>Orientation de la cartouche :</strong><br>
          La pointe sertie rouge doit pointer vers l'avant (vers le canon/magasin) et le culot laiton doré vers le pouce de l'opérateur.
        </li>
        <li class="warning">
          <span class="badge badge-defect">DÉFAUT 2</span> <strong>Position de présentation :</strong><br>
          La main gauche présente la cartouche trop en avant, sous le garde-main mobile, au lieu d'être immédiatement devant le pontet sous la carcasse.
        </li>
        <li class="info">
          <span class="badge badge-info">POINT DE PERSPECTIVE</span> <strong>Continuité de la crosse & main droite :</strong><br>
          Observez le saut entre les deux poses : la main droite reste bien ancrée sur la poignée pistolet avec les gants noirs, assurant un raccord crédible.
        </li>
      </ul>
    </div>
  </div>

  <script>
    const layerHip = document.querySelector('#layer-hip');
    const layerReload = document.querySelector('#layer-reload');
    const hudText = document.querySelector('#hud-text');
    const slider = document.querySelector('#slider');
    const blendVal = document.querySelector('#blend-val');
    const btnHip = document.querySelector('#btn-hip');
    const btnReload = document.querySelector('#btn-reload');
    const btnBlink = document.querySelector('#btn-blink');

    let blinkInterval = null;

    function setMode(mode) {
      stopBlink();
      btnHip.classList.toggle('active', mode === 'hip');
      btnReload.classList.toggle('active', mode === 'reload');

      if (mode === 'hip') {
        layerHip.style.opacity = 1;
        layerReload.style.opacity = 0;
        slider.value = 0;
        blendVal.textContent = '0% (Repos seul)';
        hudText.textContent = 'VUE : REPOS (HANCHE)';
      } else {
        layerHip.style.opacity = 0;
        layerReload.style.opacity = 1;
        slider.value = 100;
        blendVal.textContent = '100% (Rechargement seul)';
        hudText.textContent = 'VUE : POSE DE RECHARGEMENT (DRAFT)';
      }
    }

    function onSlider(val) {
      stopBlink();
      btnHip.classList.remove('active');
      btnReload.classList.remove('active');
      const ratio = val / 100;
      layerHip.style.opacity = (1 - ratio).toFixed(2);
      layerReload.style.opacity = ratio.toFixed(2);
      blendVal.textContent = val + '%';
      hudText.textContent = 'SUPERPOSITION : ' + (100 - val) + '% REPOS / ' + val + '% RECHARGEMENT';
    }

    function toggleBlink() {
      if (blinkInterval) {
        stopBlink();
      } else {
        btnBlink.classList.add('active');
        let isHip = false;
        blinkInterval = setInterval(() => {
          isHip = !isHip;
          setMode(isHip ? 'hip' : 'reload');
          btnBlink.classList.add('active');
        }, 600);
      }
    }

    function stopBlink() {
      if (blinkInterval) {
        clearInterval(blinkInterval);
        blinkInterval = null;
        btnBlink.classList.remove('active');
      }
    }
  </script>
</body>
</html>
`;

writeFileSync(resolve(directory, 'index.html'), html, 'utf8');
console.log('✓ Aperçu généré avec succès dans :', resolve(directory, 'index.html'));
