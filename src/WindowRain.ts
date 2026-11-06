import * as THREE from 'three';
import type { StormWindowSpec } from './MansionConfig.ts';

const windCount = 48, streamCount = 16, beadCount = 20;

function fade(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/** Pluie au dehors, coulures et perles sur le verre ; un seul lot, sans allocation à l'image. */
export function createWindowRain(index: number, spec: StormWindowSpec, shape: THREE.Shape,
  material: THREE.LineBasicMaterial): { mesh: THREE.LineSegments; update(time: number): void } {
  const count = windCount + streamCount * 3 + beadCount;
  const coordinates = new Float32Array(count * 6), colors = new Float32Array(count * 8);
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(coordinates, 3).setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.BufferAttribute(colors, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position); geometry.setAttribute('color', color);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -0.016), 1.42);
  const mesh = new THREE.LineSegments(geometry, material); mesh.name = 'storm-window-rain';
  const tint = new THREE.Color(0x9eb5cf);

  // Limite dérivée de la vraie arche, préparée une fois ; couvre aussi les trois ovales du haut.
  const outline = shape.getPoints(32), ceiling = new Float32Array(129);
  for (let i = 0; i < ceiling.length; i++) {
    const x = -0.98 + i / (ceiling.length - 1) * 1.96;
    let top = -1;
    for (let p = 1; p < outline.length; p++) {
      const a = outline[p - 1]!, b = outline[p]!;
      if (Math.abs(b.x - a.x) < 1e-8 || x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) continue;
      top = Math.max(top, a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
    }
    ceiling[i] = top - 0.018;
  }
  const random = (n: number): number => {
    const value = Math.sin((n + index * 137 + 1) * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };
  const wind = Array.from({ length: windCount }, (_, i) => ({
    x: -1 + random(i * 7) * 2.25, phase: random(i * 7 + 1),
    speed: (2 + random(i * 7 + 2) * 2) * 2 / spec.height,
    length: (0.065 + random(i * 7 + 3) * 0.14) * 2 / spec.height,
    opacity: 0.10 + random(i * 7 + 4) * 0.16,
  }));
  const streams = Array.from({ length: streamCount }, (_, i) => ({
    x: -0.93 + random(701 + i * 7) * 1.86, phase: random(702 + i * 7),
    speed: (0.10 + random(703 + i * 7) * 0.18) * 2 / spec.height,
    length: (0.08 + random(704 + i * 7) * 0.16) * 2 / spec.height,
    bend: (0.003 + random(705 + i * 7) * 0.008) * 2 / spec.width,
    seed: random(706 + i * 7) * Math.PI * 2,
  }));
  const beads = Array.from({ length: beadCount }, (_, i) => ({
    x: -0.94 + random(1101 + i * 5) * 1.88, y: -0.92 + random(1102 + i * 5) * 1.88,
    phase: random(1103 + i * 5), speed: 0.024 + random(1104 + i * 5) * 0.024,
    length: (0.006 + random(1105 + i * 5) * 0.009) * 2 / spec.height,
  }));

  let cursor = 0;
  function vertex(x: number, y: number, alpha: number): void {
    const boundedX = Math.max(-0.98, Math.min(0.98, x));
    const column = (boundedX + 0.98) / 1.96 * (ceiling.length - 1);
    const low = Math.min(ceiling.length - 2, Math.floor(column)), part = column - low;
    const top = ceiling[low]! * (1 - part) + ceiling[low + 1]! * part;
    const visibility = fade((top - y) / 0.06) * fade((y + 0.98) / 0.07)
      * fade((0.98 - Math.abs(x)) / 0.06);
    const p = cursor * 3, c = cursor * 4;
    coordinates[p] = boundedX; coordinates[p + 1] = Math.max(-0.98, Math.min(top, y));
    coordinates[p + 2] = -0.016;
    colors[c] = tint.r; colors[c + 1] = tint.g; colors[c + 2] = tint.b;
    colors[c + 3] = Math.max(0, Math.min(1, alpha * visibility));
    cursor++;
  }

  return { mesh, update(time) {
    cursor = 0;
    const gust = 0.86 + Math.sin(time * 0.47 + index * 0.9) * 0.14;
    const slope = (0.19 + Math.sin(time * 0.31 + index) * 0.025) * spec.height / spec.width;
    for (const drop of wind) {
      const age = (drop.phase + time * drop.speed / 2.32) % 1;
      const y = 1.13 - age * 2.32;
      const x = drop.x - age * 0.32 * spec.height / spec.width;
      vertex(x, y, drop.opacity * gust);
      vertex(x + drop.length * slope, y + drop.length, 0);
    }
    for (const drop of streams) {
      const distance = time * drop.speed + Math.sin(time * 1.2 + drop.seed) * 0.013;
      const age = (drop.phase + distance / 2.24 + 1) % 1;
      const y = 1.12 - age * 2.24;
      const middleY = y + drop.length * 0.45, endY = y + drop.length;
      const x = drop.x + Math.sin(y * 9 + drop.seed) * drop.bend;
      const middleX = drop.x + Math.sin(middleY * 9 + drop.seed) * drop.bend;
      const endX = drop.x + Math.sin(endY * 9 + drop.seed) * drop.bend;
      vertex(x, y - 0.004, 0.20); vertex(x, y + 0.013, 0.38);
      vertex(x, y + 0.013, 0.25); vertex(middleX, middleY, 0.13);
      vertex(middleX, middleY, 0.13); vertex(endX, endY, 0);
    }
    for (const drop of beads) {
      const age = (drop.phase + time * drop.speed) % 1;
      const alpha = fade(age / 0.18) * fade((1 - age) / 0.25) * 0.20;
      const y = drop.y - age * 0.035;
      vertex(drop.x, y, alpha); vertex(drop.x, y + drop.length, alpha * 0.25);
    }
    position.needsUpdate = true; color.needsUpdate = true;
  } };
}
