import * as THREE from 'three';
import fs from 'fs';

// Read Level.ts to extract colliders and doors
const levelCode = fs.readFileSync('src/Level.ts', 'utf8');

// Build the exact Level environment as defined in Level.ts
const colliders = [];
function createSolidBox(x, y, z, width, height, depth, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));
  mesh.position.set(x, y, z);
  colliders.push({ name, box: new THREE.Box3().setFromObject(mesh) });
}

// 1. Quatre murs d'enceinte (24m)
createSolidBox(0, 2, -12, 24, 4, 1, 'Perimeter North');
createSolidBox(0, 2, 12, 24, 4, 1, 'Perimeter South');
createSolidBox(-12, 2, 0, 1, 4, 24, 'Perimeter West');
createSolidBox(12, 2, 0, 1, 4, 24, 'Perimeter East');

// 2. Murs latéraux du couloir central
createSolidBox(2.5, 2, 0, 1, 4, 8, 'Corridor East');
createSolidBox(-2.5, 2, 2.5, 1, 4, 3, 'Corridor West South');
createSolidBox(-2.5, 2, -2.5, 1, 4, 3, 'Corridor West North');

// 3. Murs séparateurs Est (10m - pleins)
createSolidBox(7, 2, 4, 10, 4, 1, 'Sep East z=4');
createSolidBox(7, 2, -4, 10, 4, 1, 'Sep East z=-4');

// 4. Murs séparateurs Ouest avec passages de 2.5m à x in [-7.5, -5.0]
createSolidBox(-9.75, 2, 4, 4.5, 4, 1, 'Sep West Outer z=4');
createSolidBox(-9.75, 2, -4, 4.5, 4, 1, 'Sep West Outer z=-4');
createSolidBox(-3.5, 2, 4, 3.0, 4, 1, 'Sep West Inner z=4');
createSolidBox(-3.5, 2, -4, 3.0, 4, 1, 'Sep West Inner z=-4');

// 5. Caisse dans la salle des machines
createSolidBox(-4, 1, -8, 2, 2, 2, 'Crate');

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function isColliding(x, z, radius) {
  for (const c of colliders) {
    const b = c.box;
    const cx = clamp(x, b.min.x, b.max.x);
    const cz = clamp(z, b.min.z, b.max.z);
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) {
      return { colliding: true, name: c.name };
    }
  }
  return { colliding: false };
}

// User path: (0,9) → (-6.25,9) → (-6.25,-6) → (0,-6) → (0,-9)
const bypassPath = [
  { x: 0, z: 9 },
  { x: -6.25, z: 9 },
  { x: -6.25, z: -6 },
  { x: 0, z: -6 },
  { x: 0, z: -9 },
];

console.log('=== AUDIT DÉFAUT 1 : CONTOURNEMENT PAR LA GALERIE OUEST ===');
for (const radius of [0.4]) { // Player radius = 0.4, Zombie radius = 0.4
  let clear = true;
  for (let i = 0; i < bypassPath.length - 1; i++) {
    const p1 = bypassPath[i];
    const p2 = bypassPath[i + 1];
    const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const steps = Math.ceil(dist / 0.05);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = p1.x + (p2.x - p1.x) * t;
      const z = p1.z + (p2.z - p1.z) * t;
      const hit = isColliding(x, z, radius);
      if (hit.colliding) {
        console.log(`Blocked at (${x.toFixed(2)}, ${z.toFixed(2)}) by ${hit.name}`);
        clear = false;
        break;
      }
    }
    if (!clear) break;
  }
  console.log(`Path (0,9) -> (-6.25,9) -> (-6.25,-6) -> (0,-6) -> (0,-9) with radius ${radius}:`);
  console.log(clear ? 'CONFIRMED: The entire bypass path is completely free of any collision!' : 'Path is blocked.');
}
