import * as THREE from 'three';
import { Door } from './Door.ts';
import { visualColors } from './VisualStyle.ts';
import {
  MANSION_BUDGET,
  MANSION_WALLS,
  MANSION_DOORS,
  MANSION_WAYPOINTS,
  MANSION_RAMPS,
  getMansionFloorHeight,
} from './MansionConfig.ts';

export class Level {
  private scene: THREE.Scene;

  // Collisions physiques du joueur et du zombie.
  private colliders: THREE.Box3[] = [];

  // Objets 3D qui bloquent les tirs.
  private solidMeshes: THREE.Mesh[] = [];
  private doors: Door[] = [];
  private candles: { light: THREE.PointLight; baseIntensity: number; phase: number }[] = [];
  private candleTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createEnvironment();
  }

  private createEnvironment(): void {
    const textureLoader = new THREE.TextureLoader();

    // 1. Textures et sols : Rez-de-chaussée (Y=0) et plateau surélevé (+2.4m) sur socle plein
    const floorTexture = textureLoader.load('/assets/textures/wood_floor_v2.png');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(24, 20);
    floorTexture.magFilter = THREE.NearestFilter;
    floorTexture.minFilter = THREE.NearestMipmapNearestFilter;
    floorTexture.colorSpace = THREE.SRGBColorSpace;

    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.75,
      metalness: 0.0,
    });

    // 1A. Sol du rez-de-chaussée (Z in [-7, 20], profondeur 27m)
    const groundFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(MANSION_BUDGET.bounds.width, 27),
      floorMaterial
    );
    groundFloor.position.set(0, 0, 6.5);
    groundFloor.rotation.x = -Math.PI / 2;
    groundFloor.receiveShadow = true;
    this.scene.add(groundFloor);

    // 1B. Sol du plateau surélevé Nord (+2.4m, Z in [-20, -7], profondeur 13m)
    const raisedFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(MANSION_BUDGET.bounds.width, 13),
      floorMaterial
    );
    raisedFloor.position.set(0, 2.4, -13.5);
    raisedFloor.rotation.x = -Math.PI / 2;
    raisedFloor.receiveShadow = true;
    this.scene.add(raisedFloor);

    // 1C. Socle plein sous le plateau nord (volume occultant pour bloquer tirs et raycasts sous les pièces hautes)
    // Note : visible = false et hauteur limitée à 2.38m (top à 2.38m, sous les 2.40m du plancher)
    // pour éliminer tout conflit de profondeur (Z-fighting) avec le parquet de raisedFloor.
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(MANSION_BUDGET.bounds.width, 2.38, 13)
    );
    plinth.position.set(0, 1.19, -13.5);
    plinth.visible = false;
    this.solidMeshes.push(plinth);

    // 1D. Marches d'escaliers visibles (Ouest et Est)
    const stepMaterial = new THREE.MeshStandardMaterial({
      color: visualColors.wood,
      roughness: 0.8,
    });
    for (const ramp of MANSION_RAMPS) {
      const stairCenterX = (ramp.minX + ramp.maxX) / 2;
      const stairWidth = ramp.maxX - ramp.minX;
      for (let i = 0; i < 12; i++) {
        const stepZ = -1.0 - (i + 0.5) * 0.5; // Z = -1.25 à -6.75
        const stepY = (i + 0.5) * 0.2;        // Y = 0.1 à 2.3
        const stepMesh = new THREE.Mesh(
          new THREE.BoxGeometry(stairWidth, 0.2, 0.5),
          stepMaterial
        );
        stepMesh.position.set(stairCenterX, stepY, stepZ);
        stepMesh.castShadow = true;
        stepMesh.receiveShadow = true;
        this.scene.add(stepMesh);
        this.solidMeshes.push(stepMesh);
      }
    }

    // 2. Texture murale du manoir : lambris de chêne et papier damassé rouge
    const wallBaseTexture = textureLoader.load('/assets/textures/mansion_wall_v2.png');
    wallBaseTexture.wrapS = THREE.RepeatWrapping;
    wallBaseTexture.wrapT = THREE.ClampToEdgeWrapping;
    wallBaseTexture.magFilter = THREE.NearestFilter;
    wallBaseTexture.minFilter = THREE.NearestMipmapNearestFilter;
    wallBaseTexture.colorSpace = THREE.SRGBColorSpace;

    const createWallMaterial = (length: number): THREE.MeshStandardMaterial => {
      const tex = wallBaseTexture.clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(Math.max(1, Math.round(length / 2)), 1);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestMipmapNearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.88,
        metalness: 0.0,
      });
    };

    const obstacleMaterial = new THREE.MeshStandardMaterial({
      color: visualColors.wood,
      roughness: 0.9,
    });

    const ironMaterial = new THREE.MeshStandardMaterial({
      color: visualColors.iron,
      roughness: 0.75,
      metalness: 0.4,
    });

    // 3. Construction physique des murs et obstacles à partir de MansionConfig
    for (const wall of MANSION_WALLS) {
      let mat: THREE.Material;
      if (wall.materialType === 'obstacle') {
        mat = obstacleMaterial;
      } else if (wall.materialType === 'metal') {
        mat = ironMaterial;
      } else {
        mat = createWallMaterial(Math.max(wall.width, wall.depth));
      }
      this.createSolidBox(wall.x, wall.y, wall.z, wall.width, wall.height, wall.depth, mat);
    }

    // 4. Portes et grilles de circulation à partir de MansionConfig
    for (const spec of MANSION_DOORS) {
      const door = new Door(this.scene, spec);
      if (spec.type === 'permanent_limit') {
        door.lock();
      }
      this.doors.push(door);
      this.solidMeshes.push(...door.getSolidMeshes());
    }

    // 5. Repère visuel de la porte de sortie condamnée (Nord, surélevé à +2.4m)
    const exitMarker = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 3.2),
      new THREE.MeshStandardMaterial({
        color: visualColors.wood,
        roughness: 0.9,
      })
    );
    exitMarker.position.set(0, 4.0, -19.45);
    this.scene.add(exitMarker);

    // 6. Tableaux d'art baroque victorien sur les murs d'enceinte
    const portraitTexture = textureLoader.load('/assets/textures/portrait_v2.png');
    portraitTexture.magFilter = THREE.NearestFilter;
    portraitTexture.minFilter = THREE.NearestMipmapNearestFilter;
    portraitTexture.colorSpace = THREE.SRGBColorSpace;

    const portraitMaterial = new THREE.MeshStandardMaterial({
      map: portraitTexture,
      roughness: 0.9,
      metalness: 0.0,
    });

    const addPainting = (x: number, y: number, z: number, rotY: number) => {
      const painting = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.8),
        portraitMaterial
      );
      painting.position.set(x, y, z);
      painting.rotation.y = rotY;
      painting.receiveShadow = true;
      this.scene.add(painting);
    };

    // Tableaux dans le Vestibule Sud
    addPainting(14, 2.3, 19.48, Math.PI);
    addPainting(2, 2.3, 19.48, Math.PI);

    // Tableaux dans le Grand Salon
    addPainting(-14, 2.3, 19.48, Math.PI);
    addPainting(-23.48, 2.3, 13, Math.PI / 2);

    // Tableaux dans la Galerie Ouest
    addPainting(-23.48, 2.3, 0, Math.PI / 2);

    // Tableaux dans le Grand Hall Nord
    addPainting(23.48, 2.3, 0, -Math.PI / 2);

    // Tableaux dans la Grande Bibliothèque (+2.4m)
    addPainting(-23.48, 4.7, -14, Math.PI / 2);
    addPainting(-14, 4.7, -19.48, 0);

    // Tableaux dans l'Atelier d'Art (+2.4m)
    addPainting(23.48, 4.7, -14, -Math.PI / 2);
    addPainting(14, 4.7, -19.48, 0);

    // 7. Ambiance lumineuse d'horreur victorienne
    // Lumière d'ambiance tamisée
    this.scene.add(new THREE.AmbientLight(0x687285, 0.22));

    // Lumière 1 avec ombre : Clair de lune directionnel couvrant l'enveloppe 48 x 40m
    const moonLight = new THREE.DirectionalLight(0x6a8eb8, 0.95);
    moonLight.position.set(-8, 18, -22);
    moonLight.target.position.set(0, 0, 0);
    this.scene.add(moonLight.target);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 1;
    moonLight.shadow.camera.far = 60;
    moonLight.shadow.camera.left = -26;
    moonLight.shadow.camera.right = 26;
    moonLight.shadow.camera.top = 22;
    moonLight.shadow.camera.bottom = -22;
    moonLight.shadow.bias = -0.001;
    this.scene.add(moonLight);

    // Lumière 2 avec ombre : Grand lustre central du Grand Hall (Palier 2)
    const chandelierHall = new THREE.PointLight(0xffaa44, 3.2, 18, 1.4);
    chandelierHall.position.set(8, 3.2, 0);
    chandelierHall.castShadow = true;
    chandelierHall.shadow.mapSize.width = 512;
    chandelierHall.shadow.mapSize.height = 512;
    chandelierHall.shadow.bias = -0.002;
    chandelierHall.shadow.camera.near = 0.3;
    chandelierHall.shadow.camera.far = 18;
    this.scene.add(chandelierHall);
    this.candles.push({ light: chandelierHall, baseIntensity: 3.2, phase: 4.3 });

    // Bougies d'ambiance fixes douces sans ombres (très légères en calcul GPU)
    const addSoftCandle = (x: number, y: number, z: number, intensity: number, radius: number, phase: number) => {
      const candle = new THREE.PointLight(0xff9d3b, intensity, radius, 1.5);
      candle.position.set(x, y, z);
      this.scene.add(candle);
      this.candles.push({ light: candle, baseIntensity: intensity, phase });
    };

    addSoftCandle(8, 2.6, 13, 2.4, 12, 0.0);   // Vestibule
    addSoftCandle(-14, 2.6, 13, 2.4, 12, 1.5); // Grand Salon
    addSoftCandle(-13, 2.6, 0, 2.4, 12, 3.9);  // Galerie Ouest
    addSoftCandle(13, 2.6, -2, 2.5, 13, 2.7);  // Grand Hall
    addSoftCandle(-13, 5.0, -14, 2.5, 14, 2.7);// Grande Bibliothèque (+2.4m)
    addSoftCandle(12, 5.0, -14, 2.4, 13, 5.1); // Atelier d'Art (+2.4m)

    // Brume atmosphérique victorienne
    this.scene.fog = new THREE.FogExp2(0x1a1e24, 0.022);
  }

  private createSolidBox(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    material: THREE.Material
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);

    // Collision du joueur et des ennemis.
    this.colliders.push(new THREE.Box3().setFromObject(mesh));

    // Collision des projectiles.
    this.solidMeshes.push(mesh);
  }

  public update(delta: number): void {
    this.candleTimer += delta;
    for (const candle of this.candles) {
      const flicker =
        Math.sin(this.candleTimer * 12 + candle.phase) * 0.08 +
        Math.sin(this.candleTimer * 23 + candle.phase * 2) * 0.05 +
        Math.cos(this.candleTimer * 37 + candle.phase) * 0.03;
      candle.light.intensity = candle.baseIntensity * (1 + flicker);
    }
  }

  public getLightingAt(position: THREE.Vector3): { brightness: number; warmth: number } {
    let warmIntensity = 0;
    for (const candle of this.candles) {
      const dx = position.x - candle.light.position.x;
      const dy = position.y - candle.light.position.y;
      const dz = position.z - candle.light.position.z;
      const dist = Math.hypot(dx, dy, dz);
      const radius = candle.light.distance || 12;
      if (dist < radius) {
        const falloff = Math.max(0, 1 - dist / radius);
        warmIntensity += candle.light.intensity * falloff * falloff;
      }
    }

    // Zone éclairée par le clair de lune (grand hall nord, z < -8)
    const moonFactor = position.z < -8 ? Math.min(1, (-8 - position.z) / 6) * 0.45 : 0.05;

    // Luminosité perçue totale : base tamisée rehaussée près des bougies et de la lune
    const baseBrightness = 0.45;
    const brightness = THREE.MathUtils.clamp(baseBrightness + warmIntensity * 0.22 + moonFactor, 0.40, 1.35);

    // Teinte : plus chaude (sepia doré) près des bougies, plus froide dans l'ombre et sous la lune
    const warmth = THREE.MathUtils.clamp(warmIntensity * 0.25 - moonFactor * 0.2, 0.0, 0.45);

    return { brightness, warmth };
  }

  public getFloorHeightAt(x: number, z: number): number {
    return getMansionFloorHeight(x, z);
  }

  public isInExitZone(position: THREE.Vector3): boolean {
    return Math.abs(position.x) <= 2.5 && position.z <= -18.0 && position.z >= -19.8 && position.y >= 3.0;
  }

  public getDoors(): Door[] {
    return this.doors;
  }

  public getSolidMeshes(): THREE.Mesh[] {
    return this.solidMeshes;
  }

  public hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.001) return true;

    const dir = new THREE.Vector3(dx / dist, dy / dist, dz / dist);
    const ray = new THREE.Raycaster(new THREE.Vector3(from.x, from.y, from.z), dir, 0.1, dist);
    for (const mesh of this.solidMeshes) mesh.updateWorldMatrix(true, false);
    const hits = ray.intersectObjects(this.solidMeshes, false);
    return hits.length === 0;
  }

  public findNextWaypoint(start: THREE.Vector3, rawTarget: THREE.Vector3, radius: number): THREE.Vector3 | null {
    const target = this.getReachableTarget(start, rawTarget, radius);

    // Si la cible d'approche est en vue directe dégagée
    if (this.isPathClear(start, target, radius)) {
      return target;
    }

    const nodes = [
      start,
      target,
      ...MANSION_WAYPOINTS.map((w) => new THREE.Vector3(w.x, w.y, w.z)),
    ];
    const distances = nodes.map(() => Infinity);
    const previous = nodes.map(() => -1);
    const visited = nodes.map(() => false);
    distances[0] = 0;

    // Recherche du trajet le plus court parmi les segments praticables (Dijkstra 3D)
    for (let count = 0; count < nodes.length; count++) {
      let current = -1;
      for (let i = 0; i < nodes.length; i++) {
        if (!visited[i] && (current === -1 || distances[i] < distances[current])) current = i;
      }
      if (current === -1 || !Number.isFinite(distances[current]) || current === 1) break;
      visited[current] = true;
      for (let i = 1; i < nodes.length; i++) {
        if (visited[i] || i === current) continue;
        const length = Math.hypot(
          nodes[i].x - nodes[current].x,
          nodes[i].y - nodes[current].y,
          nodes[i].z - nodes[current].z
        );
        const candidate = distances[current] + length;
        if (candidate < distances[i] && this.isPathClear(nodes[current], nodes[i], radius)) {
          distances[i] = candidate;
          previous[i] = current;
        }
      }
    }
    if (!Number.isFinite(distances[1])) return null;
    let next = 1;
    while (previous[next] > 0) next = previous[next];
    return nodes[next];
  }

  public getReachableTarget(start: THREE.Vector3, target: THREE.Vector3, radius: number): THREE.Vector3 {
    if (!this.isColliding(target.x, target.z, radius)) {
      return target;
    }
    // Si la cible touche un mur pour le gabarit du zombie,
    // trouver un point d'approche praticable le long du vecteur vers le départ
    const dir = new THREE.Vector3(start.x - target.x, 0, start.z - target.z);
    const len = dir.length();
    if (len > 0.001) {
      dir.divideScalar(len);
      for (const offset of [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0, 1.3]) {
        const candidate = new THREE.Vector3(target.x + dir.x * offset, target.y, target.z + dir.z * offset);
        if (!this.isColliding(candidate.x, candidate.z, radius)) {
          return candidate;
        }
      }
    }
    // Secours radial : tester les décalages cardinaux vers l'intérieur
    const signX = target.x > 0 ? -1 : 1;
    const signZ = target.z > 0 ? -1 : 1;
    for (const offset of [0.15, 0.3, 0.45, 0.6]) {
      const candX = new THREE.Vector3(target.x + signX * offset, target.y, target.z);
      if (!this.isColliding(candX.x, candX.z, radius)) return candX;
      const candZ = new THREE.Vector3(target.x, target.y, target.z + signZ * offset);
      if (!this.isColliding(candZ.x, candZ.z, radius)) return candZ;
    }
    return target;
  }

  private isPathClear(start: THREE.Vector3, end: THREE.Vector3, radius: number): boolean {
    const distance = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
    const steps = Math.max(1, Math.ceil(distance / 0.1));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.isColliding(start.x + (end.x - start.x) * t, start.z + (end.z - start.z) * t, radius)) return false;
    }
    return true;
  }

  public isColliding(
    x: number,
    z: number,
    radius: number
  ): boolean {
    for (const box of this.colliders) {
      const closestX = THREE.MathUtils.clamp(
        x,
        box.min.x,
        box.max.x
      );

      const closestZ = THREE.MathUtils.clamp(
        z,
        box.min.z,
        box.max.z
      );

      const distanceX = x - closestX;
      const distanceZ = z - closestZ;

      if (
        distanceX * distanceX + distanceZ * distanceZ <
        radius * radius
      ) {
        return true;
      }
    }

    // Portes mobiles avec gestion de l'angle et anti-pincement
    for (const door of this.doors) {
      if (door.isColliding(x, z, radius)) {
        return true;
      }
    }

    return false;
  }
}
