
import * as THREE from 'three';
import { Level } from './Level.ts';
import { PLAYER_START_POSITION } from './MansionConfig.ts';

export class Player {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly audioListener = new THREE.AudioListener();

  private level: Level;
  private canvas: HTMLCanvasElement;
  public readonly maxHealth = 100;
  private health = 100;
  private canPlay: () => boolean;
  private onInteract: (() => void) | null = null;
  private onFlashlightToggle: ((enabled: boolean) => void) | null = null;

  // Lampe torche victorienne à faisceau frontal directionnel
  private flashlight: THREE.SpotLight;
  private flashlightTarget: THREE.Object3D;
  private flashlightOn = true;

  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private recoilRoll = 0;

  private readonly mouseSensitivity = 0.002;
  private readonly normalFov = 75;
  private readonly aimedFov = 58;
  private aimAmount = 0;
  private readonly walkSpeed = 5;
  private readonly runSpeed = 9;
  private readonly radius = 0.35;
  private readonly eyeHeight = 1.7;

  private readonly direction = new THREE.Vector3();
  private readonly upAxis = new THREE.Vector3(0, 1, 0);

  constructor(
    level: Level,
    canvas: HTMLCanvasElement,
    canPlay: () => boolean
  ) {
    this.level = level;
    this.canvas = canvas;
    this.canPlay = canPlay;

    this.camera = new THREE.PerspectiveCamera(
      this.normalFov,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

    this.camera.position.set(
      PLAYER_START_POSITION.x,
      this.eyeHeight,
      PLAYER_START_POSITION.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.add(this.audioListener);

    // Initialisation du faisceau de la lampe torche (SpotLight attaché à la caméra)
    this.flashlight = new THREE.SpotLight(0xfffaec, 22, 28, Math.PI / 5.2, 0.5, 1.8);
    this.flashlight.position.set(0.2, -0.15, -0.1);
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0.2, -0.15, -5);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    this.camera.add(this.flashlight);

    this.setupControls();
  }

  private setupControls(): void {
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'KeyE' && this.canPlay() && document.pointerLockElement === this.canvas) {
        this.onInteract?.();
      }
      if (event.code === 'KeyF' && this.canPlay() && document.pointerLockElement === this.canvas) {
        this.toggleFlashlight();
      }
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    this.canvas.addEventListener('click', () => {
      if (this.canPlay()) this.canvas.requestPointerLock();
    });

    document.addEventListener('mousemove', (event) => {
      if (!this.canPlay() || document.pointerLockElement !== this.canvas) {
        return;
      }

      const sensitivity = this.mouseSensitivity * (1 - this.aimAmount * 0.25);
      this.yaw -= event.movementX * sensitivity;
      this.pitch -= event.movementY * sensitivity;

      this.pitch = THREE.MathUtils.clamp(
        this.pitch,
        -Math.PI / 2 + 0.01,
        Math.PI / 2 - 0.01
      );

      this.camera.rotation.y = this.yaw + this.recoilYaw;
      this.camera.rotation.x = this.pitch + this.recoilPitch;
      this.camera.rotation.z = this.recoilRoll;
    });
  }

  public setOnInteract(callback: () => void): void {
    this.onInteract = callback;
  }

  public toggleFlashlight(): boolean {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.visible = this.flashlightOn;
    this.onFlashlightToggle?.(this.flashlightOn);
    const clickSound = new Audio('/assets/sounds/empty-soft.wav');
    clickSound.volume = 0.35;
    void clickSound.play().catch(() => {});
    return this.flashlightOn;
  }

  public isFlashlightOn(): boolean {
    return this.flashlightOn;
  }

  public setOnFlashlightToggle(callback: (enabled: boolean) => void): void {
    this.onFlashlightToggle = callback;
  }

  public setAimAmount(amount: number): void {
    this.aimAmount = THREE.MathUtils.clamp(amount, 0, 1);
    this.camera.fov = THREE.MathUtils.lerp(this.normalFov, this.aimedFov, this.aimAmount);
    this.camera.updateProjectionMatrix();
  }

  public isAlive(): boolean {
    return this.health > 0;
  }

  public getHealth(): number {
    return this.health;
  }

  public takeDamage(amount: number): void {
    if (!this.isAlive()) return;
    this.health = Math.max(0, this.health - amount);
  }

  public applyRecoil(pitch = 0.045, yaw = 0.012, roll = 0.008): void {
    this.recoilPitch += pitch;
    this.recoilYaw += (Math.random() - 0.5) * yaw;
    this.recoilRoll += (Math.random() - 0.5) * roll;
  }

  public heal(amount: number): boolean {
    if (!this.isAlive() || this.health >= this.maxHealth) return false;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return true;
  }

  public update(delta: number): void {
    // Amortissement élastique continu du recul de caméra
    if (this.recoilPitch > 0.0001 || Math.abs(this.recoilYaw) > 0.0001 || Math.abs(this.recoilRoll) > 0.0001) {
      this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 18, delta);
      this.recoilYaw = THREE.MathUtils.damp(this.recoilYaw, 0, 18, delta);
      this.recoilRoll = THREE.MathUtils.damp(this.recoilRoll, 0, 18, delta);
    }
    this.camera.rotation.y = this.yaw + this.recoilYaw;
    this.camera.rotation.x = this.pitch + this.recoilPitch;
    this.camera.rotation.z = this.recoilRoll;

    const speed = (
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight')
    ) ? this.runSpeed : this.walkSpeed;

    this.direction.set(0, 0, 0);

    // Avancer : Z (AZERTY) ou W (QWERTY).
    if (this.keys.has('KeyW') || this.keys.has('KeyZ')) {
      this.direction.z -= 1;
    }

    // Reculer.
    if (this.keys.has('KeyS')) {
      this.direction.z += 1;
    }

    // Gauche : Q (AZERTY) ou A (QWERTY).
    if (this.keys.has('KeyA') || this.keys.has('KeyQ')) {
      this.direction.x -= 1;
    }

    // Droite.
    if (this.keys.has('KeyD')) {
      this.direction.x += 1;
    }

    if (this.direction.lengthSq() > 0) {
      // Normalisation : évite d'aller plus vite en diagonale.
      this.direction.normalize();

      // Oriente le déplacement selon le regard horizontal.
      this.direction.applyAxisAngle(this.upAxis, this.yaw);

      const dx = this.direction.x * speed * delta;
      const dz = this.direction.z * speed * delta;

      // Découpage du mouvement en petits pas.
      const distance = Math.hypot(dx, dz);
      const steps = Math.max(1, Math.ceil(distance / 0.1));

      for (let i = 0; i < steps; i++) {
        this.move(dx / steps, dz / steps);
      }
    }

    // Calcul de l'altitude du sol sous le joueur et amortissement continu de la caméra
    const floorY = typeof this.level.getFloorHeightAt === 'function'
      ? this.level.getFloorHeightAt(this.camera.position.x, this.camera.position.z)
      : 0;
    const targetY = floorY + this.eyeHeight;
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 20, delta);
  }

  private move(dx: number, dz: number): void {
    // Collision sur l'axe X.
    const nextX = this.camera.position.x + dx;

    if (!this.level.isColliding(
      nextX,
      this.camera.position.z,
      this.radius
    )) {
      this.camera.position.x = nextX;
    }

    // Collision sur l'axe Z.
    const nextZ = this.camera.position.z + dz;

    if (!this.level.isColliding(
      this.camera.position.x,
      nextZ,
      this.radius
    )) {
      this.camera.position.z = nextZ;
    }
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
