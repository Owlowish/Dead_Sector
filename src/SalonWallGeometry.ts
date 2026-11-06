import * as THREE from 'three';
import type { BoxCollider } from './MansionConfig.ts';

// Les quatre faces intérieures du Salon. Les faces opposées restent celles des pièces voisines.
const borders = [
  { face: 0, axis: 'x', plane: -23.5, along: 'z', min: 6.5, max: 19.5 },
  { face: 1, axis: 'x', plane: -3.5, along: 'z', min: 6.5, max: 19.5 },
  { face: 4, axis: 'z', plane: 6.5, along: 'x', min: -23.5, max: -3.5 },
  { face: 5, axis: 'z', plane: 19.5, along: 'x', min: -23.5, max: -3.5 },
] as const;

export function salonWallGeometry(wall: BoxCollider): THREE.BufferGeometry | null {
  const source = new THREE.BoxGeometry(wall.width, wall.height, wall.depth);
  const position = source.getAttribute('position');
  const normal = source.getAttribute('normal');
  const uv = source.getAttribute('uv');
  const origin = new THREE.Vector3(wall.x, wall.y, wall.z);
  const selections = borders.filter(border => {
    const p = new THREE.Vector3().fromBufferAttribute(position, border.face * 4).add(origin);
    const q = new THREE.Vector3().fromBufferAttribute(position, border.face * 4 + 1).add(origin);
    return Math.abs(p[border.axis] - border.plane) < 1e-5
      && Math.max(p[border.along], q[border.along]) > border.min
      && Math.min(p[border.along], q[border.along]) < border.max;
  });
  if (!selections.length) { source.dispose(); return null; }

  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const indices: number[][] = [[], []];
  for (let face = 0; face < 6; face++) {
    const offset = face * 4;
    const a = new THREE.Vector3().fromBufferAttribute(position, offset);
    const b = new THREE.Vector3().fromBufferAttribute(position, offset + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, offset + 2);
    const n = new THREE.Vector3().fromBufferAttribute(normal, offset);
    const border = selections.find(selection => selection.face === face);
    const cuts = [0, 1];
    if (border) {
      for (const edge of [border.min, border.max]) {
        const t = (edge - origin[border.along] - a[border.along]) / (b[border.along] - a[border.along]);
        if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
      }
    }
    cuts.sort((x, y) => x - y);
    for (let segment = 0; segment < cuts.length - 1; segment++) {
      const start = cuts[segment], end = cuts[segment + 1];
      const center = a.clone().lerp(b, (start + end) / 2).add(origin);
      const selected = border && center[border.along] > border.min && center[border.along] < border.max;
      const first = positions.length / 3;
      // Interpolation dans le quad d'origine : le motif garde sa phase et son échelle.
      for (const [u, v] of [[start, 0], [end, 0], [start, 1], [end, 1]]) {
        const point = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
        positions.push(point.x, point.y, point.z);
        normals.push(n.x, n.y, n.z);
        uvs.push(
          uv.getX(offset) + (uv.getX(offset + 1) - uv.getX(offset)) * u + (uv.getX(offset + 2) - uv.getX(offset)) * v,
          uv.getY(offset) + (uv.getY(offset + 1) - uv.getY(offset)) * u + (uv.getY(offset + 2) - uv.getY(offset)) * v,
        );
      }
      indices[selected ? 1 : 0].push(first, first + 2, first + 1, first + 2, first + 3, first + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([...indices[0], ...indices[1]]);
  geometry.addGroup(0, indices[0].length, 0);
  geometry.addGroup(indices[0].length, indices[1].length, 1);
  source.dispose();
  return geometry;
}
