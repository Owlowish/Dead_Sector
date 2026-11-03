import * as THREE from 'three';
import type { StormWindowSpec } from './MansionConfig.ts';
import { getMansionFloorHeight } from './MansionConfig.ts';

export interface StormWindowVisuals {
  glass: THREE.MeshBasicMaterial;
  projections: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; position: THREE.Vector3 }[];
  bolts: { mesh: THREE.Mesh; position: THREE.Vector3 }[];
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

    for (const side of [-1, 1]) {
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
  return { glass, projections, bolts };
}
