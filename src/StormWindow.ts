import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StormWindowSpec } from './MansionConfig.ts';
import { getMansionFloorHeight } from './MansionConfig.ts';

export interface StormWindowVisuals {
  glass: THREE.MeshBasicMaterial;
  projections: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; position: THREE.Vector3 }[];
  bolts: { mesh: THREE.Mesh; position: THREE.Vector3 }[];
  disposeDrapery(): void;
}

/** Plis en relief et embrasses du seul salon de musique, dans le repère local de sa baie. */
function musicDrapery(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'music-room-curtains';
  const clothParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 12; row++) {
      const t = row / 12, y = 1.02 - t * 2.40;
      const inside = 0.75 + 0.25 * Math.sin(t * Math.PI);
      for (let col = 0; col <= 18; col++) {
        const u = col / 18, fold = Math.cos(u * Math.PI * 10);
        positions.push(side * (inside + (1.23 - inside) * u), y, -0.115 - fold * 0.032);
        const shade = 0.72 + 0.28 * (fold + 1) / 2;
        const color = new THREE.Color(0x641e2d).multiplyScalar(shade);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let row = 0; row < 12; row++) for (let col = 0; col < 18; col++) {
      const a = row * 19 + col, b = a + 19;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const cloth = new THREE.BufferGeometry();
    cloth.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    cloth.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    cloth.setIndex(indices); cloth.computeVertexNormals(); clothParts.push(cloth);
    const cord = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.98, -0.21, -0.16),
      new THREE.Vector3(side * 1.08, -0.26, -0.20),
      new THREE.Vector3(side * 1.23, -0.18, -0.16),
    ]);
    goldParts.push(new THREE.TubeGeometry(cord, 10, 0.013, 5, false));
    const tassel = new THREE.CylinderGeometry(0.018, 0.038, 0.16, 6);
    tassel.translate(side * 1.05, -0.36, -0.20); goldParts.push(tassel);
  }
  // Lambrequin froncé et galon courbe : laisse la partie centrale de la vitre lisible.
  const swagPositions: number[] = [], swagColors: number[] = [], swagIndices: number[] = [];
  const edge: THREE.Vector3[] = [];
  for (let i = 0; i <= 32; i++) {
    const x = -1.22 + i / 32 * 2.44;
    const bottom = 0.72 + 0.21 * (x / 1.22) ** 2;
    const fold = Math.cos(i / 32 * Math.PI * 16);
    for (const y of [1.02, bottom]) {
      swagPositions.push(x, y, -0.17 - fold * 0.018);
      const color = new THREE.Color(0x6b2232).multiplyScalar(0.8 + fold * 0.12);
      swagColors.push(color.r, color.g, color.b);
    }
    edge.push(new THREE.Vector3(x, bottom, -0.205));
    if (i < 32) { const a = i * 2; swagIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const swag = new THREE.BufferGeometry();
  swag.setAttribute('position', new THREE.Float32BufferAttribute(swagPositions, 3));
  swag.setAttribute('color', new THREE.Float32BufferAttribute(swagColors, 3));
  swag.setIndex(swagIndices); swag.computeVertexNormals(); clothParts.push(swag);
  goldParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 32, 0.012, 5, false));
  const rod = new THREE.CylinderGeometry(0.023, 0.023, 2.55, 8);
  rod.rotateZ(Math.PI / 2); rod.translate(0, 1.035, -0.12); goldParts.push(rod);
  for (const [parts, material] of [
    [clothParts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })],
    [goldParts, new THREE.MeshStandardMaterial({ color: 0xa88a4e, roughness: 0.64, metalness: 0.32 })],
  ] as const) {
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) throw new Error('Fusion des rideaux du salon de musique impossible');
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true; group.add(mesh);
  }
  return group;
}

function pointedArch(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-1, -1);
  shape.lineTo(1, -1);
  shape.lineTo(1, 0.38);
  shape.quadraticCurveTo(0.92, 0.73, 0, 1);
  shape.quadraticCurveTo(-0.92, 0.73, -1, 0.38);
  shape.closePath();
  return shape;
}

function windowShadowTexture(): THREE.DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const bar = x % 21 < 3 || y % 22 < 3;
      pixels[offset] = 157;
      pixels[offset + 1] = 190;
      pixels[offset + 2] = 228;
      pixels[offset + 3] = bar ? 0 : 138;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Un paysage peint derrière des remplages 3D ; les murs restent fermés. */
export function createStormWindowVisuals(scene: THREE.Scene, specs: readonly StormWindowSpec[]): StormWindowVisuals {
  const exterior = new THREE.TextureLoader().load('/assets/textures/mansion/storm-exterior-v1.png');
  exterior.colorSpace = THREE.SRGBColorSpace;
  exterior.magFilter = THREE.NearestFilter;
  exterior.minFilter = THREE.NearestMipmapNearestFilter;
  const glass = new THREE.MeshBasicMaterial({ map: exterior, color: 0x98a8bd, side: THREE.DoubleSide });
  const wood = new THREE.MeshStandardMaterial({ color: 0x241d1b, roughness: 0.83, side: THREE.DoubleSide });
  const velvet = new THREE.MeshBasicMaterial({ color: 0x321720, side: THREE.DoubleSide });
  const shape = pointedArch();
  const pane = new THREE.ShapeGeometry(shape, 18);
  const vertices = pane.getAttribute('position');
  const uv = pane.getAttribute('uv');
  for (let i = 0; i < vertices.count; i++) uv.setXY(i, (vertices.getX(i) + 1) / 2, (vertices.getY(i) + 1) / 2);
  uv.needsUpdate = true;
  const outline = shape.getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, -0.035));
  const archTrim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 48, 0.065, 6, true);
  const barGeometry = new THREE.BoxGeometry(1, 1, 0.065);
  const roseGeometry = new THREE.TorusGeometry(0.13, 0.025, 6, 12);
  const shadowMap = windowShadowTexture();
  const projections: StormWindowVisuals['projections'] = [];
  const bolts: StormWindowVisuals['bolts'] = [];
  const draperies: THREE.Group[] = [];

  for (const [index, spec] of specs.entries()) {
    const group = new THREE.Group();
    group.name = 'storm-window';
    group.position.set(spec.x, spec.y, spec.z);
    group.rotation.y = spec.rotationY;
    group.scale.set(spec.width / 2, spec.height / 2, 1);

    const skyGeometry = pane.clone();
    if (index % 2 === 1) {
      const skyUV = skyGeometry.getAttribute('uv');
      for (let i = 0; i < skyUV.count; i++) skyUV.setX(i, 1 - skyUV.getX(i));
      skyUV.needsUpdate = true;
    }
    const sky = new THREE.Mesh(skyGeometry, glass);
    sky.position.z = 0.004;
    group.add(sky);
    group.add(new THREE.Mesh(archTrim, wood));

    const bars = [
      [-0.47, -0.34, 0.045, 1.32], [0, -0.31, 0.05, 1.38], [0.47, -0.34, 0.045, 1.32],
      [0, -0.60, 1.95, 0.05], [0, -0.15, 1.95, 0.045],
    ];
    const mullions = new THREE.InstancedMesh(barGeometry, wood, bars.length);
    const dummy = new THREE.Object3D();
    bars.forEach(([x, y, width, height], i) => {
      dummy.position.set(x!, y!, -0.048);
      dummy.scale.set(width!, height!, 1);
      dummy.updateMatrix();
      mullions.setMatrixAt(i, dummy.matrix);
    });
    mullions.instanceMatrix.needsUpdate = true;
    group.add(mullions);

    const roses = new THREE.InstancedMesh(roseGeometry, wood, 3);
    [-0.42, 0, 0.42].forEach((x, i) => {
      dummy.position.set(x, 0.59, -0.055);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      roses.setMatrixAt(i, dummy.matrix);
    });
    roses.instanceMatrix.needsUpdate = true;
    group.add(roses);

    const lightningPath = new THREE.CurvePath<THREE.Vector3>();
    const sign = index % 2 === 0 ? 1 : -1;
    const lightningPoints = [[0.18, 0.88], [0.04, 0.58], [0.22, 0.37], [-0.06, 0.12], [0.02, -0.12], [-0.13, -0.42]];
    for (let i = 1; i < lightningPoints.length; i++) {
      const [ax, ay] = lightningPoints[i - 1]!;
      const [bx, by] = lightningPoints[i]!;
      lightningPath.add(new THREE.LineCurve3(new THREE.Vector3(ax! * sign, ay!, -0.09), new THREE.Vector3(bx! * sign, by!, -0.09)));
    }
    const bolt = new THREE.Mesh(new THREE.TubeGeometry(lightningPath, 24, 0.013, 4, false), new THREE.MeshBasicMaterial({ color: 0xdcefff, toneMapped: false }));
    bolt.visible = false;
    group.add(bolt);

    if (spec.drapery === 'music') {
      const drapery = musicDrapery();
      group.add(drapery); draperies.push(drapery);
    } else for (const side of [-1, 1]) {
      const curtain = new THREE.Shape();
      curtain.moveTo(side * 1.18, 0.85);
      curtain.lineTo(side * 0.88, 0.85);
      curtain.lineTo(side * 0.82, 0.25);
      curtain.lineTo(side * 0.94, -0.12);
      curtain.lineTo(side * 0.82, -0.7);
      curtain.lineTo(side * 1.10, -1.04);
      curtain.lineTo(side * 1.24, -1.04);
      curtain.closePath();
      const cloth = new THREE.Mesh(new THREE.ShapeGeometry(curtain), velvet);
      cloth.position.z = -0.075;
      group.add(cloth);
    }
    scene.add(group);

    const floorY = getMansionFloorHeight(spec.x, spec.z) + 0.025;
    const material = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.width * 1.4, spec.height * 1.3), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(spec.x, floorY, spec.z);
    mesh.position.add(new THREE.Vector3(0, 0, -2.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotationY));
    mesh.rotation.z = -spec.rotationY;
    mesh.name = 'storm-window-floor-light';
    scene.add(mesh);
    const position = new THREE.Vector3(spec.x, spec.y, spec.z).add(new THREE.Vector3(0, 0, -0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotationY));
    projections.push({ mesh, material, position });
    bolts.push({ mesh: bolt, position });
  }
  let draperyDisposed = false;
  return { glass, projections, bolts, disposeDrapery() {
    if (draperyDisposed) return;
    draperyDisposed = true;
    for (const group of draperies) {
      group.removeFromParent();
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      });
    }
  } };
}
