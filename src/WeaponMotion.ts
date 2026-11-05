interface WeaponMotionPosition { x: number; z: number }

/** Balancement de présentation seulement : la caméra et le rayon de tir restent fixes. */
export class WeaponMotion {
  private readonly view: HTMLElement | null;
  private previousX = 0;
  private previousZ = 0;
  private hasPrevious = false;
  private phase = 0;
  private amplitudeX = 0;
  private amplitudeY = 0;
  private amplitudeRoll = 0;
  private renderedX = NaN;
  private renderedY = NaN;
  private renderedRoll = NaN;
  private disposed = false;

  constructor(view: HTMLElement | null) {
    this.view = view;
    this.render(0, 0, 0);
  }

  public update(delta: number, position: WeaponMotionPosition, active: boolean, aimAmount: number, reloading = false): void {
    if (this.disposed) return;
    if (!active || !Number.isFinite(delta) || delta <= 0 || delta > 0.15 || !Number.isFinite(position.x) || !Number.isFinite(position.z)) {
      this.reset();
      return;
    }
    if (!this.hasPrevious) {
      this.previousX = position.x;
      this.previousZ = position.z;
      this.hasPrevious = true;
      return;
    }
    const moved = Math.hypot(position.x - this.previousX, position.z - this.previousZ);
    this.previousX = position.x;
    this.previousZ = position.z;
    if (moved > 1.5) {
      this.reset();
      this.previousX = position.x;
      this.previousZ = position.z;
      this.hasPrevious = true;
      return;
    }

    // La position arrive après les collisions : pousser un mur ne fait pas avancer la phase.
    const speed = moved > 0.00001 ? moved / delta : 0;
    const running = Math.min(1, Math.max(0, (speed - 5) / 4));
    const moving = Math.min(1, speed / 5);
    if (moving > 0) this.phase = (this.phase + moved / (3.8 + running * 1.4) * Math.PI * 2) % (Math.PI * 2);

    // Amortir l'amplitude conserve la phase liée au trajet, à toute fréquence d'affichage.
    const blend = 1 - Math.exp(-12 * delta);
    this.amplitudeX += (moving * (4 + running * 2) - this.amplitudeX) * blend;
    this.amplitudeY += (moving * (3 + running * 2) - this.amplitudeY) * blend;
    this.amplitudeRoll += (moving * (0.3 + running * 0.15) - this.amplitudeRoll) * blend;
    const aim = Number.isFinite(aimAmount) ? Math.min(1, Math.max(0, aimAmount)) : 1;
    const strength = (1 - aim) ** 2 * (reloading ? 0.25 : 1);
    const lateral = Math.sin(this.phase);
    this.render(
      lateral * this.amplitudeX * strength,
      -Math.sin(this.phase * 2) * this.amplitudeY * strength,
      lateral * this.amplitudeRoll * strength,
    );
  }

  private render(x: number, y: number, roll: number): void {
    // Le millième suffit au CSS ; au repos, on cesse aussi de réécrire le style.
    x = Math.round(x * 1000) / 1000;
    y = Math.round(y * 1000) / 1000;
    roll = Math.round(roll * 1000) / 1000;
    if (x !== this.renderedX) this.view?.style.setProperty('--weapon-bob-x', `${x}px`);
    if (y !== this.renderedY) this.view?.style.setProperty('--weapon-bob-y', `${y}px`);
    if (roll !== this.renderedRoll) this.view?.style.setProperty('--weapon-bob-roll', `${roll}deg`);
    this.renderedX = x;
    this.renderedY = y;
    this.renderedRoll = roll;
  }

  public reset(): void {
    this.hasPrevious = false;
    this.phase = 0;
    this.amplitudeX = 0;
    this.amplitudeY = 0;
    this.amplitudeRoll = 0;
    this.render(0, 0, 0);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
  }
}
