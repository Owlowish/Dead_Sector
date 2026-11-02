import fs from 'node:fs';
import path from 'node:path';

const filesToDelete = [
  // 1. Anciens sons remplacés par les versions *-soft.wav
  'public/assets/sounds/ambiance.wav',
  'public/assets/sounds/empty.wav',
  'public/assets/sounds/impact-metal.wav',
  'public/assets/sounds/impact-zombie.wav',
  'public/assets/sounds/shot.wav',
  'public/assets/sounds/zombie-groan.wav',

  // 2. Anciennes textures remplacées ou inutilisées
  'public/assets/textures/carpet.png',
  'public/assets/textures/carpet_v2.png',
  'public/assets/textures/floor.png',
  'public/assets/textures/mansion_wall.png',
  'public/assets/textures/portrait.png',
  'public/assets/textures/wood_floor.png',

  // 3. Anciens sprites d'armes et itérations intermédiaires
  'public/assets/weapons/revolver_idle.png',
  'public/assets/weapons/pistol_sheet.png',
  'public/assets/weapons/pistol_frame_0.png',
  'public/assets/weapons/pistol_frame_1.png',
  'public/assets/weapons/pistol_frame_2.png',
  'public/assets/weapons/pistol_frame_3.png',
  'public/assets/weapons/pistol_reload_0.png',
  'public/assets/weapons/pistol_reload_1.png',
  'public/assets/weapons/pistol_reload_2.png',
  'public/assets/weapons/pistol_reload_3.png',
  'public/assets/weapons/pistol_reload_4.png',
  'public/assets/weapons/pistol_reload_5.png',
  'public/assets/weapons/pistol_reload_6.png',
  'public/assets/weapons/pistol_reload_7.png',
  'public/assets/weapons/modern_hip.png',
  'public/assets/weapons/modern_hip_aligned.png',
  'public/assets/weapons/modern_hip_backup.png',
  'public/assets/weapons/modern_hip_test.png',
  'public/assets/weapons/modern_hip_v2.png',
  'public/assets/weapons/modern_hip_v3.png',
  'public/assets/weapons/modern_hip_v4.png',
  'public/assets/weapons/modern_hip_cs.png',

  // 4. Anciennes versions de zombies
  'public/assets/zombies/zombie_walk.png',
  'public/assets/zombies/zombie_hurt.png',
  'public/assets/zombies/zombie_corpse.png',

  // 5. Fichiers templates d'initialisation Vite
  'src/assets/hero.png',
  'src/assets/typescript.svg',
  'src/assets/vite.svg',
  'public/icons.svg',
];

console.log('=== NETTOYAGE DES ASSETS OBSOLÈTES ===\n');

let totalFreedBytes = 0;
let deletedCount = 0;

for (const relPath of filesToDelete) {
  const fullPath = path.resolve(relPath);
  if (fs.existsSync(fullPath)) {
    const size = fs.statSync(fullPath).size;
    fs.unlinkSync(fullPath);
    totalFreedBytes += size;
    deletedCount++;
    console.log(`- Supprimé : ${relPath} (${(size / 1024).toFixed(1)} Ko)`);
  } else {
    console.log(`- Introuvable / déjà supprimé : ${relPath}`);
  }
}

// Supprimer le dossier src/assets s'il est vide
const srcAssetsDir = path.resolve('src/assets');
if (fs.existsSync(srcAssetsDir) && fs.readdirSync(srcAssetsDir).length === 0) {
  fs.rmdirSync(srcAssetsDir);
  console.log('- Dossier supprimé : src/assets (vide)');
}

// Nettoyer les caches volumineux de profils Chrome dans tmp/
const tmpDir = path.resolve('tmp');
if (fs.existsSync(tmpDir)) {
  for (const entry of fs.readdirSync(tmpDir)) {
    const p = path.join(tmpDir, entry);
    if (fs.statSync(p).isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
      console.log(`- Nettoyé cache temporaire : tmp/${entry}`);
    }
  }
}

console.log(`\nBilan : ${deletedCount} fichiers supprimés.`);
console.log(`Espace disque récupéré (assets directs) : ${(totalFreedBytes / (1024 * 1024)).toFixed(2)} Mo`);
