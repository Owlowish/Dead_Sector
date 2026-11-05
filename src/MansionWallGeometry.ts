import * as THREE from 'three';
import { getMansionFloorHeight, MANSION_ELEVATION, type BoxCollider } from './MansionConfig.ts';

export const MANSION_WALL_STYLE = {
  atlasUrl: '/assets/textures/mansion/wall-bands-v1.png',
  tileSize: 2.1,
  wainscotHeight: 1.05,
  // Centres des texels utiles ; les quatre rangées de garde restent hors des UV.
  paperMinV: 260.5 / 512,
  paperMaxV: 507.5 / 512,
  woodMinV: 4.5 / 512,
  woodMaxV: 251.5 / 512,
} as const;

const EPSILON = 1e-6;

export function mansionWallGeometry(wall: BoxCollider): THREE.BufferGeometry {
  const source = new THREE.BoxGeometry(wall.width, wall.height, wall.depth);
  const sourcePosition = source.getAttribute('position');
  const sourceNormal = source.getAttribute('normal');
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const { tileSize, wainscotHeight, paperMinV, paperMaxV, woodMinV, woodMaxV } = MANSION_WALL_STYLE;

  const addQuad = (points: THREE.Vector3[], normal: THREE.Vector3, faceUvs: number[][]): void => {
    const first = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      positions.push(points[i].x, points[i].y, points[i].z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(faceUvs[i][0], faceUvs[i][1]);
    }
    indices.push(first, first + 2, first + 1, first + 2, first + 3, first + 1);
  };

  // Ordre et sens des faces de BoxGeometry : +X, -X, +Y, -Y, +Z, -Z.
  for (let face = 0; face < 6; face++) {
    const offset = face * 4;
    const a = new THREE.Vector3().fromBufferAttribute(sourcePosition, offset);
    const b = new THREE.Vector3().fromBufferAttribute(sourcePosition, offset + 1);
    const normal = new THREE.Vector3().fromBufferAttribute(sourceNormal, offset);

    if (normal.y !== 0) {
      const points = Array.from({ length: 4 }, (_, i) => new THREE.Vector3().fromBufferAttribute(sourcePosition, offset + i));
      // Les chants horizontaux sont en bois, sans étirer un motif de papier sur le dessus.
      const v = woodMinV + (woodMaxV - woodMinV) * 0.05;
      addQuad(points, normal, points.map(point => [(point.x + wall.x) / tileSize, v]));
      continue;
    }

    const horizontalCuts = [0, 1];
    if (a.z !== b.z) {
      const step = (MANSION_ELEVATION.plateauZThreshold - wall.z - a.z) / (b.z - a.z);
      if (step > EPSILON && step < 1 - EPSILON) horizontalCuts.push(step);
    }
    horizontalCuts.sort((x, y) => x - y);

    for (let segment = 0; segment < horizontalCuts.length - 1; segment++) {
      const left = horizontalCuts[segment], right = horizontalCuts[segment + 1];
      const middle = a.clone().lerp(b, (left + right) / 2);
      const floorY = getMansionFloorHeight(middle.x + wall.x, middle.z + wall.z);
      const woodTop = floorY + wainscotHeight;
      const bottom = wall.y - wall.height / 2, top = wall.y + wall.height / 2;
      const heights = [bottom, top];
      for (const height of [floorY, woodTop]) {
        if (height > bottom + EPSILON && height < top - EPSILON) heights.push(height);
      }
      for (let height = woodTop + tileSize; height < top - EPSILON; height += tileSize) {
        if (height > bottom + EPSILON) heights.push(height);
      }
      heights.sort((x, y) => x - y);

      for (let band = 0; band < heights.length - 1; band++) {
        const low = heights[band], high = heights[band + 1];
        const isWood = (low + high) / 2 < woodTop;
        const paperBase = woodTop + Math.floor(((low + high) / 2 - woodTop) / tileSize) * tileSize;
        const points = [[left, high], [right, high], [left, low], [right, low]].map(([along, height]) => {
          const point = a.clone().lerp(b, along);
          point.y = height - wall.y;
          return point;
        });
        const faceUvs = points.map(point => {
          const worldY = point.y + wall.y;
          // La phase dépend du monde, pas de la longueur de chaque bloc de mur.
          const u = (normal.z !== 0 ? normal.z * (point.x + wall.x) : -normal.x * (point.z + wall.z)) / tileSize;
          const phase = THREE.MathUtils.clamp(isWood ? (worldY - floorY) / wainscotHeight : (worldY - paperBase) / tileSize, 0, 1);
          const minV = isWood ? woodMinV : paperMinV, maxV = isWood ? woodMaxV : paperMaxV;
          return [u, minV + phase * (maxV - minV)];
        });
        addQuad(points, normal, faceUvs);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = 'mansion-wall-bands';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  source.dispose();
  return geometry;
}
