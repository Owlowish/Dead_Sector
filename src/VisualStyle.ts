// Palette des objets 3D ; les équivalents du HUD sont dans :root du CSS.
export const visualColors = {
  ivory: 0xd4c6a5,
  brass: 0xb69a60,
  wood: 0x684532,
  iron: 0x343a3b,
  olive: 0x515546,
  blood: 0xb85b4a,
  warning: 0xe1b66b,
  stone: 0x48423c,
  hearthDark: 0x141210,
  ember: 0x9e3215,
  carpet: 0x4d161a,
  carpetGold: 0x9a7d3b,
} as const;

// Salle témoin : chaleur près de l'âtre, fenêtre froide et repère discret au passage.
export const salonLighting = {
  hearthPosition: { x: -12.4, y: 2.6, z: 13 },
  hearthIntensity: 3.4,
  hearthRadius: 10.5,
  hearthDecay: 1.2,
  fills: [
    { name: 'salon-window-fill', x: -8.5, y: 2.3, z: 18.2, color: 0x819fbd, intensity: 1.4, radius: 10, decay: 1, warm: false },
    { name: 'salon-passage-fill', x: -12, y: 2.6, z: 7.4, color: 0xe6bc81, intensity: 1.3, radius: 7, decay: 1, warm: true },
  ],
} as const;
