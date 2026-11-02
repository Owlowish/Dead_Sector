import * as THREE from 'three';

export interface SpriteFrame {
  rect: { x: number; y: number; width: number; height: number };
  anchor: [number, number];
  duration: number;
  floorHeight: number;
  clipPolygon?: [number, number][];
}

export const agileZombieConfig = {
  speed: 2.7,
  health: 80,
  collisionRadius: 0.4,
  attackRange: 1.4,
  attackDamage: 10,
  attackInterval: 1.0,
  attackWindup: 0.45,
  attackImpactDuration: 0.10,
  attackRecoveryDuration: 0.20,
  hurtDuration: 0.18,
  detectionRadius: 8,
  separationRadius: 0.85,
  separationStrength: 1.8,
} as const;

export const agileAtlasDimensions = {
  idle: { width: 948, height: 1660 },
  run: { width: 1086, height: 1448 },
  attack: { width: 1774, height: 887 },
  hurt: { width: 1254, height: 1254 },
  death: { width: 1254, height: 1254 },
} as const;

export const agileAnimationsData = {
  idle: {
    pixelsPerUnit: 862.22,
    loop: true,
    frames: [
      {
        rect: { x: 141, y: 48, width: 731, height: 1560 },
        anchor: [506.5, 1604] as [number, number],
        duration: 1.0,
        floorHeight: 0.025,
      },
    ],
  },
  run: {
    pixelsPerUnit: 341.67,
    loop: true,
    frames: [
      { rect: { x: 53, y: 74, width: 272, height: 623 }, anchor: [181, 693] as [number, number], duration: 0.09, floorHeight: 0.025 },
      { rect: { x: 371, y: 68, width: 325, height: 626 }, anchor: [543, 693] as [number, number], duration: 0.09, floorHeight: 0.025 },
      { rect: { x: 732, y: 64, width: 334, height: 617 }, anchor: [905, 693] as [number, number], duration: 0.09, floorHeight: 0.025 },
      { rect: { x: 42, y: 761, width: 317, height: 624 }, anchor: [181, 1383] as [number, number], duration: 0.09, floorHeight: 0.025 },
      { rect: { x: 401, y: 761, width: 280, height: 626 }, anchor: [543, 1383] as [number, number], duration: 0.09, floorHeight: 0.025 },
      { rect: { x: 740, y: 757, width: 326, height: 593 }, anchor: [905, 1383] as [number, number], duration: 0.09, floorHeight: 0.025 },
    ],
  },
  attack: {
    pixelsPerUnit: 395.0,
    loop: false,
    frames: [
      {
        rect: { x: 13, y: 125, width: 510, height: 719 },
        anchor: [268, 840] as [number, number],
        duration: 0.20,
        floorHeight: 0.025,
        clipPolygon: [
          [13, 125], [513, 125], [513, 470], [523, 470],
          [523, 650], [513, 650], [513, 844], [13, 844],
        ] as [number, number][],
      },
      {
        rect: { x: 513, y: 33, width: 447, height: 812 },
        anchor: [736.5, 841] as [number, number],
        duration: 0.25,
        floorHeight: 0.025,
        clipPolygon: [
          [513, 33], [960, 33], [960, 845], [513, 845],
          [513, 650], [523, 650], [523, 470], [513, 470],
        ] as [number, number][],
      },
      {
        rect: { x: 963, y: 153, width: 375, height: 696 },
        anchor: [1150.5, 845] as [number, number],
        duration: 0.10,
        floorHeight: 0.025,
      },
      {
        rect: { x: 1374, y: 121, width: 384, height: 723 },
        anchor: [1566, 840] as [number, number],
        duration: 0.20,
        floorHeight: 0.025,
      },
    ],
  },
  hurt: {
    pixelsPerUnit: 621.67,
    loop: false,
    frames: [
      { rect: { x: 146, y: 13, width: 480, height: 1196 }, anchor: [386, 1205] as [number, number], duration: 0.09, floorHeight: 0.025 },
      { rect: { x: 658, y: 82, width: 526, height: 1127 }, anchor: [921, 1205] as [number, number], duration: 0.09, floorHeight: 0.025 },
    ],
  },
  death: {
    pixelsPerUnit: 355.0,
    loop: false,
    frames: [
      { rect: { x: 162, y: 31, width: 406, height: 647 }, anchor: [365, 674] as [number, number], duration: 0.12, floorHeight: 0.025 },
      { rect: { x: 704, y: 158, width: 424, height: 515 }, anchor: [916, 669] as [number, number], duration: 0.14, floorHeight: 0.025 },
      { rect: { x: 25, y: 862, width: 573, height: 346 }, anchor: [311.5, 1204] as [number, number], duration: 0.14, floorHeight: 0.025 },
      { rect: { x: 608, y: 983, width: 641, height: 205 }, anchor: [928.5, 1184] as [number, number], duration: 0.16, floorHeight: 0.025 },
    ],
  },
};

export const agileDeathDuration = agileAnimationsData.death.frames.reduce((s, f) => s + f.duration, 0);

export function agileDeathFrameIndex(time: number): number {
  let elapsed = 0;
  for (let i = 0; i < agileAnimationsData.death.frames.length; i++) {
    elapsed += agileAnimationsData.death.frames[i].duration;
    if (time < elapsed) return i;
  }
  return agileAnimationsData.death.frames.length - 1;
}

export function agileAttackFrameIndex(time: number): number {
  let elapsed = 0;
  for (let i = 0; i < agileAnimationsData.attack.frames.length; i++) {
    elapsed += agileAnimationsData.attack.frames[i].duration;
    if (time < elapsed) return i;
  }
  return agileAnimationsData.attack.frames.length - 1;
}

export function buildFrameGeometry(
  frame: SpriteFrame,
  ppu: number,
  atlasW: number,
  atlasH: number
): THREE.BufferGeometry {
  const ax = frame.anchor[0];
  const ay = frame.anchor[1];

  if (frame.clipPolygon && frame.clipPolygon.length >= 3) {
    const shape = new THREE.Shape();
    frame.clipPolygon.forEach(([sx, sy], i) => {
      const lx = (sx - ax) / ppu;
      // Centre de simulation au niveau y=1 du monde, donc sol à y=-1 en coordonnées locales
      const ly = (ay - sy) / ppu + frame.floorHeight - 1;
      if (i === 0) shape.moveTo(lx, ly);
      else shape.lineTo(lx, ly);
    });

    const geom = new THREE.ShapeGeometry(shape);
    const pos = geom.getAttribute('position');
    const uvs = new Float32Array(pos.count * 2);

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const sx = lx * ppu + ax;
      const sy = ay - (ly + 1 - frame.floorHeight) * ppu;
      uvs[i * 2] = sx / atlasW;
      uvs[i * 2 + 1] = 1 - (sy / atlasH);
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geom;
  }

  // Rectangle simple sans polygone complexe (4 sommets, 2 triangles)
  const left = (frame.rect.x - ax) / ppu;
  const right = (frame.rect.x + frame.rect.width - ax) / ppu;
  const bottom = (ay - (frame.rect.y + frame.rect.height)) / ppu + frame.floorHeight - 1;
  const top = (ay - frame.rect.y) / ppu + frame.floorHeight - 1;

  const uLeft = frame.rect.x / atlasW;
  const uRight = (frame.rect.x + frame.rect.width) / atlasW;
  const vBottom = 1 - (frame.rect.y + frame.rect.height) / atlasH;
  const vTop = 1 - frame.rect.y / atlasH;

  const positions = new Float32Array([
    left, bottom, 0,
    right, bottom, 0,
    right, top, 0,
    left, top, 0,
  ]);

  const uvs = new Float32Array([
    uLeft, vBottom,
    uRight, vBottom,
    uRight, vTop,
    uLeft, vTop,
  ]);

  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();

  return geom;
}

function loadNearestPixelTexture(url: string): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface AgileSharedResources {
  users: number;
  textures: {
    idle: THREE.Texture;
    run: THREE.Texture;
    attack: THREE.Texture;
    hurt: THREE.Texture;
    death: THREE.Texture;
  };
  materials: {
    idle: THREE.MeshStandardMaterial;
    run: THREE.MeshStandardMaterial;
    attack: THREE.MeshStandardMaterial;
    hurt: THREE.MeshStandardMaterial;
    death: THREE.MeshStandardMaterial;
  };
  depthMaterials: {
    idle: THREE.MeshDepthMaterial;
    run: THREE.MeshDepthMaterial;
    attack: THREE.MeshDepthMaterial;
    hurt: THREE.MeshDepthMaterial;
    death: THREE.MeshDepthMaterial;
  };
  distanceMaterials: {
    idle: THREE.MeshDistanceMaterial;
    run: THREE.MeshDistanceMaterial;
    attack: THREE.MeshDistanceMaterial;
    hurt: THREE.MeshDistanceMaterial;
    death: THREE.MeshDistanceMaterial;
  };
  geometries: {
    idle: THREE.BufferGeometry[];
    run: THREE.BufferGeometry[];
    attack: THREE.BufferGeometry[];
    hurt: THREE.BufferGeometry[];
    death: THREE.BufferGeometry[];
  };
}

let agileSharedInstance: AgileSharedResources | null = null;

export function getAgileSharedResources(): AgileSharedResources {
  if (agileSharedInstance) {
    agileSharedInstance.users++;
    return agileSharedInstance;
  }

  const textures = {
    idle: loadNearestPixelTexture('/assets/zombies/agile/idle.png'),
    run: loadNearestPixelTexture('/assets/zombies/agile/run.png'),
    attack: loadNearestPixelTexture('/assets/zombies/agile/attack.png'),
    hurt: loadNearestPixelTexture('/assets/zombies/agile/hurt.png'),
    death: loadNearestPixelTexture('/assets/zombies/agile/death.png'),
  };

  const createMat = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
    });

  const materials = {
    idle: createMat(textures.idle),
    run: createMat(textures.run),
    attack: createMat(textures.attack),
    hurt: createMat(textures.hurt),
    death: createMat(textures.death),
  };

  const depthMaterials = {
    idle: new THREE.MeshDepthMaterial({ map: textures.idle, alphaTest: 0.4, depthPacking: THREE.RGBADepthPacking }),
    run: new THREE.MeshDepthMaterial({ map: textures.run, alphaTest: 0.4, depthPacking: THREE.RGBADepthPacking }),
    attack: new THREE.MeshDepthMaterial({ map: textures.attack, alphaTest: 0.4, depthPacking: THREE.RGBADepthPacking }),
    hurt: new THREE.MeshDepthMaterial({ map: textures.hurt, alphaTest: 0.4, depthPacking: THREE.RGBADepthPacking }),
    death: new THREE.MeshDepthMaterial({ map: textures.death, alphaTest: 0.4, depthPacking: THREE.RGBADepthPacking }),
  };

  const distanceMaterials = {
    idle: new THREE.MeshDistanceMaterial({ map: textures.idle, alphaTest: 0.4 }),
    run: new THREE.MeshDistanceMaterial({ map: textures.run, alphaTest: 0.4 }),
    attack: new THREE.MeshDistanceMaterial({ map: textures.attack, alphaTest: 0.4 }),
    hurt: new THREE.MeshDistanceMaterial({ map: textures.hurt, alphaTest: 0.4 }),
    death: new THREE.MeshDistanceMaterial({ map: textures.death, alphaTest: 0.4 }),
  };

  const buildGeoms = (
    anim: { pixelsPerUnit: number; frames: SpriteFrame[] },
    dims: { width: number; height: number }
  ) => anim.frames.map((f) => buildFrameGeometry(f, anim.pixelsPerUnit, dims.width, dims.height));

  const geometries = {
    idle: buildGeoms(agileAnimationsData.idle, agileAtlasDimensions.idle),
    run: buildGeoms(agileAnimationsData.run, agileAtlasDimensions.run),
    attack: buildGeoms(agileAnimationsData.attack, agileAtlasDimensions.attack),
    hurt: buildGeoms(agileAnimationsData.hurt, agileAtlasDimensions.hurt),
    death: buildGeoms(agileAnimationsData.death, agileAtlasDimensions.death),
  };

  agileSharedInstance = {
    users: 1,
    textures,
    materials,
    depthMaterials,
    distanceMaterials,
    geometries,
  };

  return agileSharedInstance;
}

export function releaseAgileSharedResources(): void {
  if (!agileSharedInstance) return;
  agileSharedInstance.users--;
  // Les textures et géométries de l'Agile sont conservées en cache entre les paliers
  // pour éliminer toute saccade lors de la transition vers le Palier 2 et 3.
}

export function disposeAgileSharedResources(): void {
  if (!agileSharedInstance) return;
  const res = agileSharedInstance;
  Object.values(res.textures).forEach((t) => t.dispose());
  Object.values(res.materials).forEach((m) => m.dispose());
  Object.values(res.depthMaterials).forEach((m) => m.dispose());
  Object.values(res.distanceMaterials).forEach((m) => m.dispose());
  Object.values(res.geometries).forEach((list) => list.forEach((g) => g.dispose()));
  agileSharedInstance = null;
}
