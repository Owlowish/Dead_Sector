import { mkdirSync, writeFileSync } from 'node:fs';
import { readSpritePng } from './sprite-png-info.mjs';
import { hearthFireAnimation as animation } from '../src/HearthFireAnimation.ts';

// Export de consultation uniquement : le jeu conserve le PNG RGBA et sa palette complète.
const atlas = readSpritePng('public' + animation.url);
if (atlas.width !== animation.atlasWidth || atlas.height !== animation.atlasHeight) throw Error('Dimensions de l’atlas incorrectes');
const bytes = [], byte = (...values) => bytes.push(...values), word = value => byte(value & 255, value >> 8);
const ascii = text => { for (const character of text) byte(character.charCodeAt(0)); };
ascii('GIF89a'); word(animation.frameWidth); word(animation.frameHeight); byte(0xf7, 0, 0);
// Palette RGB332 ; l'index zéro est réservé à la transparence du GIF.
for (let i = 0; i < 256; i++) byte(Math.round((i >> 5) * 255 / 7), Math.round(((i >> 2) & 7) * 255 / 7), (i & 3) * 85);
byte(0x21, 0xff, 11); ascii('NETSCAPE2.0'); byte(3, 1, 0, 0, 0);
for (let frame = 0; frame < animation.frames; frame++) {
  byte(0x21, 0xf9, 4, 9); word(Math.round(100 / animation.fps)); byte(0, 0);
  byte(0x2c); word(0); word(0); word(animation.frameWidth); word(animation.frameHeight); byte(0, 8);
  const data = []; let bits = 0, bitCount = 0;
  const code = value => {
    bits |= value << bitCount; bitCount += 9;
    while (bitCount >= 8) { data.push(bits & 255); bits >>>= 8; bitCount -= 8; }
  };
  code(256);
  let literals = 0;
  const left = frame % animation.columns * animation.frameWidth;
  const top = Math.floor(frame / animation.columns) * animation.frameHeight;
  for (let y = 0; y < animation.frameHeight; y++) for (let x = 0; x < animation.frameWidth; x++) {
    const i = ((top + y) * atlas.width + left + x) * 4;
    const color = (atlas.data[i] & 224) | ((atlas.data[i + 1] & 224) >> 3) | (atlas.data[i + 2] >> 6);
    code(atlas.data[i + 3] < 128 ? 0 : Math.max(1, color));
    // Des remises à zéro courtes gardent tous les codes sur neuf bits, sans dictionnaire volumineux.
    if (++literals === 200) { code(256); literals = 0; }
  }
  code(257); if (bitCount) data.push(bits & 255);
  for (let start = 0; start < data.length; start += 255) {
    const block = data.slice(start, start + 255); byte(block.length, ...block);
  }
  byte(0);
}
byte(0x3b);
mkdirSync('docs/asset-packs/hearth-fire-v1', { recursive: true });
writeFileSync('docs/asset-packs/hearth-fire-v1/preview.gif', Buffer.from(bytes));
console.log(`GIF d’aperçu : ${animation.frames} poses, ${animation.fps} images/s, ${bytes.length} octets.`);
