import * as THREE from 'three';
import { visualColors } from './VisualStyle.ts';
import { mansionMaterial, mansionBoxGeometry } from './MansionMaterials.ts';
import { setImpactSurface } from './ImpactSurface.ts';

export type DoorState = 'LOCKED' | 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING';
export type DoorType = 'interior' | 'sector_access' | 'permanent_limit';

export interface DoorConfig {
  id?: string;
  x: number;
  y?: number;
  z: number;
  passageWidth?: number;
  name: string;
  type: DoorType;
  unlockAfterTier?: number;
  axis?: 'X' | 'Z';
}

export class Door {
  private scene: THREE.Scene;
  private state: DoorState = 'CLOSED';
  private x: number;
  private y: number;
  private z: number;
  private openProgress = 0; // 0 = fermé, 1 = ouvert
  private readonly speed = 1.3; // Vitesse de rotation (rad/s)

  // Dimensions du passage et des battants
  private readonly passageWidth: number;
  private readonly leafWidth: number;
  private readonly leafHeight = 3.5;
  private readonly leafThickness = 0.12;
  private readonly name: string;
  private readonly id: string;
  private readonly type: DoorType;
  private readonly unlockAfterTier: number;
  private readonly axis: 'X' | 'Z';
  private collisionProgress = NaN;
  private collisionCos = 1;
  private collisionSin = 0;

  // Groupes pivots positionnés aux charnières
  private rootGroup: THREE.Group;
  private leftPivot: THREE.Group;
  private rightPivot: THREE.Group;

  // Meshes physiques des battants pour les tirs et la vue
  private leftMesh: THREE.Mesh;
  private rightMesh: THREE.Mesh;
  private frameMeshes: THREE.Mesh[] = [];
  private hardwareMeshes: THREE.Mesh[] = [];

  constructor(
    scene: THREE.Scene,
    configOrX: DoorConfig | number = 0,
    z = 4,
    passageWidth = 4.0,
    name = 'Porte',
    type: DoorType = 'interior',
    unlockAfterTier = 1
  ) {
    this.scene = scene;
    if (typeof configOrX === 'object') {
      this.x = configOrX.x;
      this.y = configOrX.y ?? 0;
      this.z = configOrX.z;
      this.passageWidth = configOrX.passageWidth ?? 4.0;
      this.name = configOrX.name;
      this.id = configOrX.id ?? configOrX.name;
      this.type = configOrX.type;
      this.unlockAfterTier = configOrX.unlockAfterTier ?? 1;
      this.axis = configOrX.axis ?? 'X';
    } else {
      this.x = configOrX;
      this.y = 0;
      this.z = z;
      this.passageWidth = passageWidth;
      this.name = name;
      this.id = name;
      this.type = type;
      this.unlockAfterTier = unlockAfterTier;
      this.axis = 'X';
    }
    this.leafWidth = (this.passageWidth - 0.12) / 2;

    const woodMaterial = mansionMaterial('wood');
    const panelMaterial = mansionMaterial('door');
    const leafMaterials = [woodMaterial, panelMaterial];

    const ironMaterial = new THREE.MeshStandardMaterial({
      color: visualColors.iron,
      roughness: 0.75,
      metalness: 0.4,
    });
    setImpactSurface(ironMaterial, 'metal');

    const brassMaterial = new THREE.MeshStandardMaterial({
      color: visualColors.brass,
      roughness: 0.6,
      metalness: 0.6,
    });
    setImpactSurface(brassMaterial, 'metal');

    // Groupe racine de la porte permettant l'orientation selon l'axe X ou Z
    this.rootGroup = new THREE.Group();
    this.rootGroup.position.set(this.x, this.y, this.z);
    if (this.axis === 'Z') {
      this.rootGroup.rotation.y = Math.PI / 2;
    }

    // 1. ENCADREMENT DE LA PORTE (Bâti en chêne sombre)
    const postGeo = new THREE.BoxGeometry(0.18, this.leafHeight + 0.1, 0.4);
    const leftPost = new THREE.Mesh(postGeo, woodMaterial);
    leftPost.position.set(-this.passageWidth / 2 - 0.09, (this.leafHeight + 0.1) / 2, 0);
    leftPost.castShadow = true;
    leftPost.receiveShadow = true;
    this.rootGroup.add(leftPost);
    this.frameMeshes.push(leftPost);

    const rightPost = new THREE.Mesh(postGeo, woodMaterial);
    rightPost.position.set(this.passageWidth / 2 + 0.09, (this.leafHeight + 0.1) / 2, 0);
    rightPost.castShadow = true;
    rightPost.receiveShadow = true;
    this.rootGroup.add(rightPost);
    this.frameMeshes.push(rightPost);

    const lintelGeo = new THREE.BoxGeometry(this.passageWidth + 0.4, 0.4, 0.45);
    const lintel = new THREE.Mesh(lintelGeo, woodMaterial);
    lintel.position.set(0, this.leafHeight + 0.2, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.rootGroup.add(lintel);
    this.frameMeshes.push(lintel);

    // 2. BATTANT GAUCHE (Charnière à gauche)
    this.leftPivot = new THREE.Group();
    this.leftPivot.position.set(-this.passageWidth / 2 + 0.03, 0, 0);

    const leafGeo = mansionBoxGeometry(this.leafWidth, this.leafHeight, this.leafThickness, 2, 'door');
    this.leftMesh = new THREE.Mesh(leafGeo, leafMaterials);
    // Décalage local : le bord gauche du battant coïncide avec l'axe de rotation du pivot
    this.leftMesh.position.set(this.leafWidth / 2, this.leafHeight / 2, 0);
    this.leftMesh.castShadow = true;
    this.leftMesh.receiveShadow = true;
    this.leftPivot.add(this.leftMesh);

    // Ferrures du battant gauche (pentures horizontales en fer forgé)
    for (const yOffset of [-1.1, 0, 1.1]) {
      const ironBand = new THREE.Mesh(
        new THREE.BoxGeometry(this.leafWidth * 0.9, 0.08, this.leafThickness + 0.02),
        ironMaterial
      );
      ironBand.position.set(0, yOffset, 0);
      ironBand.castShadow = true;
      this.leftMesh.add(ironBand);
      this.hardwareMeshes.push(ironBand);
    }
    // Poignée / anneau de tirage gauche
    const leftHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.25, this.leafThickness + 0.08),
      brassMaterial
    );
    leftHandle.position.set(this.leafWidth * 0.42, 0, 0);
    this.leftMesh.add(leftHandle);
    this.hardwareMeshes.push(leftHandle);

    this.rootGroup.add(this.leftPivot);

    // 3. BATTANT DROIT (Charnière à droite)
    this.rightPivot = new THREE.Group();
    this.rightPivot.position.set(this.passageWidth / 2 - 0.03, 0, 0);

    this.rightMesh = new THREE.Mesh(leafGeo, leafMaterials);
    // Décalage local : le bord droit du battant coïncide avec l'axe de rotation du pivot
    this.rightMesh.position.set(-this.leafWidth / 2, this.leafHeight / 2, 0);
    this.rightMesh.castShadow = true;
    this.rightMesh.receiveShadow = true;
    this.rightPivot.add(this.rightMesh);

    // Ferrures du battant droit
    for (const yOffset of [-1.1, 0, 1.1]) {
      const ironBand = new THREE.Mesh(
        new THREE.BoxGeometry(this.leafWidth * 0.9, 0.08, this.leafThickness + 0.02),
        ironMaterial
      );
      ironBand.position.set(0, yOffset, 0);
      ironBand.castShadow = true;
      this.rightMesh.add(ironBand);
      this.hardwareMeshes.push(ironBand);
    }
    // Poignée / serrure droite
    const rightLock = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.35, this.leafThickness + 0.06),
      brassMaterial
    );
    rightLock.position.set(-this.leafWidth * 0.42, 0, 0);
    this.rightMesh.add(rightLock);
    this.hardwareMeshes.push(rightLock);

    this.rootGroup.add(this.rightPivot);
    this.scene.add(this.rootGroup);
  }

  public getState(): DoorState {
    return this.state;
  }

  public isLocked(): boolean {
    return this.state === 'LOCKED';
  }

  public lock(): void {
    this.state = 'LOCKED';
    this.openProgress = 0;
    this.applyRotation();
  }

  public unlock(): void {
    if (this.state === 'LOCKED') {
      this.state = 'CLOSED';
    }
  }

  public resetForNewRun(): void {
    this.lock();
    if (this.type === 'interior') this.unlock();
  }

  public getName(): string {
    return this.name;
  }

  public getId(): string {
    return this.id;
  }

  public getType(): DoorType {
    return this.type;
  }

  public getUnlockAfterTier(): number {
    return this.unlockAfterTier;
  }

  public getAxis(): 'X' | 'Z' {
    return this.axis;
  }

  public getPrompt(): { text: string; color: string } {
    if (this.type === 'permanent_limit') {
      return { text: `[${this.name.toUpperCase()} — CONDAMNÉE]`, color: 'var(--blood)' };
    }
    if (this.state === 'LOCKED') {
      const tierMsg = this.unlockAfterTier < Infinity ? `APRÈS LE PALIER ${this.unlockAfterTier}` : 'CONDAMNÉ';
      return {
        text: `[AILE VERROUILLÉE — ACCESSIBLE ${tierMsg}] (${this.name.toUpperCase()})`,
        color: 'var(--blood)'
      };
    }
    if (this.state === 'OPEN') {
      return { text: `[E] FERMER — ${this.name.toUpperCase()}`, color: 'var(--ivory)' };
    }
    if (this.state === 'OPENING') {
      return { text: `[OUVERTURE EN COURS… — ${this.name.toUpperCase()}]`, color: 'var(--brass)' };
    }
    return { text: `[E] OUVRIR — ${this.name.toUpperCase()}`, color: 'var(--brass)' };
  }

  public getPosition(): { x: number; z: number } {
    return { x: this.x, z: this.z };
  }

  public isOpen(): boolean {
    return this.openProgress >= 0.85;
  }

  public getSolidMeshes(): THREE.Mesh[] {
    return [this.leftMesh, this.rightMesh, ...this.frameMeshes, ...this.hardwareMeshes];
  }

  public getMesh(): THREE.Mesh {
    return this.leftMesh;
  }

  /**
   * Collision 2D exacte par distance point-segment à chaque battant orienté.
   * Fonctionne à n'importe quel angle d'ouverture sans approximations cubiques.
   */
  public isColliding(x: number, z: number, radius: number): boolean {
    let qx = x - this.x;
    let qz = z - this.z;
    if (this.axis === 'Z') {
      const rx = qz;
      const rz = -qx;
      qx = rx;
      qz = rz;
    }

    // La navigation échantillonne beaucoup de points loin des portes. Ce volume
    // contient les deux battants sur tout leur débattement ET les montants.
    // Seuls les points proches passent ensuite au test exact point-segment.
    if (Math.abs(qx) > this.passageWidth / 2 + 0.18 + radius
      || qz > 0.2 + radius || qz < -this.leafWidth - 0.2 - radius) return false;

    if (this.collisionProgress !== this.openProgress) {
      this.collisionProgress = this.openProgress;
      const angle = this.openProgress * (Math.PI / 2);
      this.collisionCos = Math.cos(angle);
      this.collisionSin = Math.sin(angle);
    }

    // 1. Segment du battant gauche
    const hLx = -this.passageWidth / 2 + 0.03;
    const hLz = 0;
    const eLx = hLx + this.leafWidth * this.collisionCos;
    const eLz = hLz - this.leafWidth * this.collisionSin;

    if (this.distanceToSegment(qx, qz, hLx, hLz, eLx, eLz) < radius + this.leafThickness / 2) {
      return true;
    }

    // 2. Segment du battant droit
    const hRx = this.passageWidth / 2 - 0.03;
    const hRz = 0;
    const eRx = hRx - this.leafWidth * this.collisionCos;
    const eRz = hRz - this.leafWidth * this.collisionSin;

    if (this.distanceToSegment(qx, qz, hRx, hRz, eRx, eRz) < radius + this.leafThickness / 2) {
      return true;
    }

    // 3. Collision avec les montants de l'encadrement (fixes)
    const postHalfW = 0.09;
    const postHalfD = 0.2;
    for (const postX of [-this.passageWidth / 2 - 0.09, this.passageWidth / 2 + 0.09]) {
      const cx = THREE.MathUtils.clamp(qx, postX - postHalfW, postX + postHalfW);
      const cz = THREE.MathUtils.clamp(qz, -postHalfD, postHalfD);
      const dsq = (qx - cx) * (qx - cx) + (qz - cz) * (qz - cz);
      if (dsq < radius * radius) return true;
    }

    return false;
  }

  private distanceToSegment(
    px: number,
    pz: number,
    ax: number,
    az: number,
    bx: number,
    bz: number
  ): number {
    const vx = bx - ax;
    const vz = bz - az;
    const lenSq = vx * vx + vz * vz;
    if (lenSq < 0.0001) return Math.hypot(px - ax, pz - az);

    const t = THREE.MathUtils.clamp(((px - ax) * vx + (pz - az) * vz) / lenSq, 0, 1);
    const projX = ax + t * vx;
    const projZ = az + t * vz;
    return Math.hypot(px - projX, pz - projZ);
  }

  public canInteract(playerPosition: THREE.Vector3, cameraDirection: THREE.Vector3): boolean {
    const dx = this.x - playerPosition.x;
    const dy = (this.y + this.leafHeight / 2) - playerPosition.y;
    const dz = this.z - playerPosition.z;
    const distance = Math.hypot(dx, dy, dz);

    if (distance > 3.6) return false;

    // Vérifier que le joueur regarde globalement vers la zone de la porte
    const toDoorX = dx / Math.hypot(dx, dz);
    const toDoorZ = dz / Math.hypot(dx, dz);
    const dot = cameraDirection.x * toDoorX + cameraDirection.z * toDoorZ;
    return dot > 0.2;
  }

  public toggle(): boolean {
    if (this.state === 'LOCKED') {
      return false;
    }
    if (this.state === 'CLOSED' || this.state === 'CLOSING') {
      this.state = 'OPENING';
      return true;
    } else if (this.state === 'OPEN' || this.state === 'OPENING') {
      this.state = 'CLOSING';
      return true;
    }
    return false;
  }

  public update(delta: number, occupants?: Array<{ x: number; z: number; radius: number }>): void {
    if (this.state === 'OPENING') {
      this.openProgress = Math.min(1, this.openProgress + delta * this.speed);
      this.applyRotation();
      if (this.openProgress >= 1) {
        this.state = 'OPEN';
      }
    } else if (this.state === 'CLOSING') {
      // Sécurité anti-pincement : si un personnage est dans le passage ou heurte les battants, réouverture immédiate
      if (occupants) {
        for (const occ of occupants) {
          const inPassage = Math.abs(occ.x - this.x) < this.passageWidth / 2 + occ.radius &&
                            Math.abs(occ.z - this.z) < 0.4 + occ.radius;
          if (inPassage || this.isColliding(occ.x, occ.z, occ.radius + 0.1)) {
            this.state = 'OPENING';
            return;
          }
        }
      }
      this.openProgress = Math.max(0, this.openProgress - delta * this.speed);
      this.applyRotation();
      if (this.openProgress <= 0) {
        this.state = 'CLOSED';
      }
    }
  }

  private applyRotation(): void {
    // Les deux battants pivotent vers le vestibule (z > 4) de 0 à 90 degrés
    const angle = this.openProgress * (Math.PI / 2);
    this.leftPivot.rotation.y = angle;
    this.rightPivot.rotation.y = -angle;

    // Mise à jour des matrices monde pour les raycasts de tir et de vision
    this.leftPivot.updateWorldMatrix(true, true);
    this.rightPivot.updateWorldMatrix(true, true);
  }
}
