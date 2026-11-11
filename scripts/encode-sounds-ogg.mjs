// Encode les sources WAV de assets-src/sounds en Ogg Vorbis servis depuis public/assets/sounds.
// Prérequis : oggenc (vorbis-tools). Usage : node scripts/encode-sounds-ogg.mjs [--force]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const source = path.resolve('assets-src/sounds');
const target = path.resolve('public/assets/sounds');
const force = process.argv.includes('--force');
// Non chargée par le jeu : source conservée pour provenance, aucune version servie.
const unused = new Set(['combat-music']);
mkdirSync(target, { recursive: true });

let encoded = 0;
for (const file of readdirSync(source).filter((name) => name.endsWith('.wav')).sort()) {
  const id = file.slice(0, -4);
  if (unused.has(id)) continue;
  const input = path.join(source, file);
  const output = path.join(target, `${id}.ogg`);
  let upToDate = false;
  try { upToDate = statSync(output).mtimeMs >= statSync(input).mtimeMs; } catch { /* Absent. */ }
  if (upToDate && !force) continue;
  // Qualité 5 (~160 kb/s stéréo, moins en mono) : transitoires des tirs préservés.
  execFileSync('oggenc', ['--quiet', '-q', '5', '-o', output, input]);
  encoded++;
}
console.log(`${encoded} fichier(s) Ogg Vorbis écrit(s) dans public/assets/sounds`);
