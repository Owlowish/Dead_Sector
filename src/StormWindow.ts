import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StormWindowSpec } from './MansionConfig.ts';
import { getMansionFloorHeight } from './MansionConfig.ts';
import { createGothicWindowDressing } from './GothicWindowDressing.ts';
import { createWindowRain } from './WindowRain.ts';

export interface StormWindowVisuals {
  panes: { material: THREE.MeshBasicMaterial; position: THREE.Vector3 }[];
  projections: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; position: THREE.Vector3 }[];
  bolts: { mesh: THREE.Mesh; position: THREE.Vector3 }[];
  update(delta: number): void;
  dispose(): void;
}

function pointedArch(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-1, -1); shape.lineTo(1, -1); shape.lineTo(1, 0.38);
  shape.quadraticCurveTo(0.92, 0.73, 0, 1);
  shape.quadraticCurveTo(-0.92, 0.73, -1, 0.38);
  shape.closePath();
  return shape;
}

function tube(points: THREE.Vector3[], radius: number, closed = false): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(path, Math.max(12, points.length), radius, 4, closed);
}

/** Les trois ovales rejoignent les meneaux ; un seul lot de ferronnerie par baie. */
function ironwork(shape: THREE.Shape): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const outline = shape.getPoints(24).slice(0, -1).map(p => new THREE.Vector3(p.x, p.y, -0.07));
  parts.push(tube(outline, 0.032, true));
  for (const [x, top] of [[-0.48, 0.3], [0, 0.43], [0.48, 0.3]]) {
    const bar = new THREE.BoxGeometry(0.033, top + 1, 0.065);
    bar.translate(x!, (top! - 1) / 2, -0.062); parts.push(bar);
  }
  for (const y of [-0.62, -0.13, 0.29]) {
    const bar = new THREE.BoxGeometry(1.94, 0.034, 0.07);
    bar.translate(0, y, -0.065); parts.push(bar);
  }
  for (const [x, y, rx, ry] of [[-0.43, 0.52, 0.205, 0.235], [0, 0.65, 0.205, 0.23], [0.43, 0.52, 0.205, 0.235]]) {
    const points = Array.from({ length: 24 }, (_, i) => {
      const angle = i / 24 * Math.PI * 2;
      return new THREE.Vector3(x! + Math.cos(angle) * rx!, y! + Math.sin(angle) * ry!, -0.073);
    });
    parts.push(tube(points, 0.021, true));
  }
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('Fusion des ferronneries de fenêtre impossible');
  return geometry;
}

function windowShadowTexture(): THREE.DataTexture {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = (y * size + x) * 4;
    const bar = x % 21 < 3 || y % 22 < 3;
    pixels[offset] = 157; pixels[offset + 1] = 190; pixels[offset + 2] = 228;
    pixels[offset + 3] = bar ? 0 : 138;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

/** Variantes décoratives fixes : ni vitre destructible, ni lumière de combat supplémentaire. */
function glassVariation(variant: string, spec: StormWindowSpec): THREE.Object3D | null {
  if (variant === 'stained') {
    const parts: THREE.BufferGeometry[] = [];
    const patch = (shape: THREE.Shape, color: number): void => {
      const source = new THREE.ShapeGeometry(shape, 12);
      const geometry = source.toNonIndexed(); source.dispose();
      const points = geometry.getAttribute('position');
      const colors = new Float32Array(points.count * 3), tint = new THREE.Color(color);
      for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(geometry);
    };
    const palette = [0x69364f, 0x293e67, 0x793d45, 0x345465];
    const rows = [-0.98, -0.62, -0.13, 0.29], columns = [-0.97, -0.48, 0, 0.48, 0.97];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const a = columns[col]! + 0.018, b = columns[col + 1]! - 0.018;
      const low = rows[row]! + 0.018, high = rows[row + 1]! - 0.018;
      const shape = new THREE.Shape(); shape.moveTo(a, low); shape.lineTo(b, low);
      shape.lineTo(b, high); shape.lineTo(a, high); shape.closePath();
      patch(shape, palette[(row + col) % palette.length]!);
    }
    for (const [x, y] of [[-0.43, 0.52], [0, 0.65], [0.43, 0.52]]) {
      const shape = new THREE.Shape(); shape.absellipse(x!, y!, 0.18, 0.20, 0, Math.PI * 2, false, 0);
      patch(shape, x === 0 ? 0x8a3949 : 0x4b365d);
    }
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) throw new Error('Fusion du vitrail impossible');
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true,
      transparent: true, opacity: 0.44, depthWrite: false, side: THREE.DoubleSide }));
    mesh.name = 'storm-window-stained-glass'; mesh.position.z = -0.021;
    return mesh;
  }
  if (variant !== 'damaged' && variant !== 'occult') return null;
  const points: number[] = [];
  const verticalScale = variant === 'occult' ? spec.width / spec.height : 1;
  const segment = (ax: number, ay: number, bx: number, by: number): void => {
    points.push(ax, ay * verticalScale, -0.023, bx, by * verticalScale, -0.023);
  };
  if (variant === 'damaged') {
    const paths = [
      [[0.47, -0.32], [0.38, -0.02], [0.46, 0.14], [0.29, 0.31]],
      [[0.47, -0.32], [0.68, -0.15], [0.74, 0.02], [0.95, 0.19]],
      [[0.47, -0.32], [0.76, -0.44], [0.88, -0.72], [0.97, -0.91]],
      [[0.47, -0.32], [0.31, -0.51], [0.42, -0.76], [0.29, -0.97]],
      [[0.47, -0.32], [0.16, -0.27], [0.01, -0.43], [-0.29, -0.40], [-0.42, -0.55]],
      [[0.38, -0.02], [0.18, 0.05], [0.02, 0.22]],
      [[0.76, -0.44], [0.89, -0.32], [0.95, -0.35]],
      [[0.31, -0.51], [0.16, -0.60], [0.09, -0.79]],
    ];
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!, b = path[i]!; segment(a[0]!, a[1]!, b[0]!, b[1]!);
    }
  } else {
    for (let i = 0; i < 40; i++) {
      const a = i * Math.PI / 20, b = (i + 1) * Math.PI / 20;
      segment(Math.sin(a) * 0.33, Math.cos(a) * 0.33 - 0.03, Math.sin(b) * 0.33, Math.cos(b) * 0.33 - 0.03);
    }
    const star = Array.from({ length: 5 }, (_, i) => {
      const angle = i / 5 * Math.PI * 2; return [Math.sin(angle) * 0.30, Math.cos(angle) * 0.30 - 0.03];
    });
    for (let i = 0; i < 5; i++) {
      const a = star[i]!, b = star[(i + 2) % 5]!; segment(a[0]!, a[1]!, b[0]!, b[1]!);
    }
    for (const x of [-0.55, 0.56]) segment(x, 0.14, x + 0.03, -0.48);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: variant === 'damaged' ? 0x8c9aaa : 0x9e3d46,
    transparent: true, opacity: variant === 'damaged' ? 0.56 : 0.82, depthWrite: false,
  }));
  lines.name = variant === 'damaged' ? 'storm-window-cracks' : 'storm-window-occult-etching';
  return lines;
}

/** Six paysages peints habillés de pierre/fer/tissu 3D ; enveloppe physique inchangée. */
export function createStormWindowVisuals(scene: THREE.Scene, specs: readonly StormWindowSpec[]): StormWindowVisuals {
  const exterior = new THREE.TextureLoader().load('/assets/textures/mansion/storm-exterior-v1.png');
  exterior.colorSpace = THREE.SRGBColorSpace;
  exterior.magFilter = THREE.NearestFilter; exterior.minFilter = THREE.NearestMipmapNearestFilter;
  const metal = new THREE.MeshStandardMaterial({ color: 0x33353b, roughness: 0.72, metalness: 0.38,
    emissive: 0x0c1521, emissiveIntensity: 0.18 });
  const rainMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const shape = pointedArch();
  const pane = new THREE.ShapeGeometry(shape, 18);
  const vertices = pane.getAttribute('position'), uv = pane.getAttribute('uv');
  for (let i = 0; i < vertices.count; i++) uv.setXY(i, (vertices.getX(i) + 1) / 2, (vertices.getY(i) + 1) / 2);
  uv.needsUpdate = true;
  const ironGeometry = ironwork(shape), shadowMap = windowShadowTexture();
  const projections: StormWindowVisuals['projections'] = [], bolts: StormWindowVisuals['bolts'] = [];
  const panes: StormWindowVisuals['panes'] = [];
  const roots: THREE.Object3D[] = [];
  const rain: ReturnType<typeof createWindowRain>[] = [];

  for (const [index, spec] of specs.entries()) {
    const variant = index === 2 ? 'damaged' : index === 4 ? 'stained' : index === 5 ? 'occult' : 'classic';
    const group = new THREE.Group(); group.name = 'storm-window'; group.userData.variant = variant;
    group.position.set(spec.x, spec.y, spec.z); group.rotation.y = spec.rotationY;
    group.scale.set(spec.width / 2, spec.height / 2, 1);
    const skyGeometry = pane.clone();
    const skyUV = skyGeometry.getAttribute('uv');
    const aspect = spec.width / spec.height;
    const cropX = Math.min(1, aspect / (2 / 3)), cropY = Math.min(1, (2 / 3) / aspect);
    for (let i = 0; i < skyUV.count; i++) {
      const x = (1 - cropX) / 2 + skyUV.getX(i) * cropX;
      // Recadrage au pied de l'image : horizon conservé, lune et pluie sans étirement.
      skyUV.setXY(i, index % 2 === 1 ? 1 - x : x, skyUV.getY(i) * cropY);
    }
    skyUV.needsUpdate = true;
    const glass = new THREE.MeshBasicMaterial({ map: exterior, color: 0x98a8bd, side: THREE.DoubleSide });
    const sky = new THREE.Mesh(skyGeometry, glass); sky.name = 'storm-window-glass'; sky.position.z = 0.004;
    const frame = new THREE.Mesh(ironGeometry, metal); frame.name = 'storm-window-ironwork';
    group.add(sky, frame, createGothicWindowDressing(spec, index));
    const variation = glassVariation(variant, spec);
    if (variation) group.add(variation);
    const drops = createWindowRain(index, spec, shape, rainMaterial); drops.update(0); rain.push(drops); group.add(drops.mesh);

    const lightningPath = new THREE.CurvePath<THREE.Vector3>();
    const sign = index % 2 === 0 ? 1 : -1;
    const points = [[0.18, 0.88], [0.04, 0.58], [0.22, 0.37], [-0.06, 0.12], [0.02, -0.12], [-0.13, -0.42]];
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]!, [bx, by] = points[i]!;
      // La foudre est derrière les montants, pas peinte par-dessus leur surface.
      lightningPath.add(new THREE.LineCurve3(new THREE.Vector3(ax! * sign, ay!, -0.006), new THREE.Vector3(bx! * sign, by!, -0.006)));
    }
    const bolt = new THREE.Mesh(new THREE.TubeGeometry(lightningPath, 24, 0.010, 4, false),
      new THREE.MeshBasicMaterial({ color: 0xdcefff, toneMapped: false }));
    bolt.name = 'storm-window-lightning'; bolt.visible = false; group.add(bolt);
    scene.add(group); roots.push(group);

    const material = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.width * 1.4, spec.height * 1.3), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(spec.x, getMansionFloorHeight(spec.x, spec.z) + 0.025, spec.z);
    mesh.position.add(new THREE.Vector3(0, 0, -2.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotationY));
    mesh.rotation.z = -spec.rotationY; mesh.name = 'storm-window-floor-light';
    scene.add(mesh); roots.push(mesh);
    const position = new THREE.Vector3(spec.x, spec.y, spec.z)
      .add(new THREE.Vector3(0, 0, -0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotationY));
    panes.push({ material: glass, position });
    projections.push({ mesh, material, position }); bolts.push({ mesh: bolt, position });
  }
  pane.dispose();
  let elapsed = 0, disposed = false;
  return { panes, projections, bolts,
    update(delta) {
      if (disposed || delta <= 0) return;
      elapsed += Math.min(delta, 0.05);
      for (const drops of rain) drops.update(elapsed);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      for (const root of roots) {
        root.removeFromParent(); root.traverse(object => {
          if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        });
      }
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      // La pierre du cache MansionMaterials appartient au niveau, pas aux fenêtres.
      exterior.dispose(); shadowMap.dispose();
    },
  };
}
