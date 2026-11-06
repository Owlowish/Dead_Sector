import { axeAsset, axeAssets, axeFrameGeometry, axeGripPivots, sampleAxePose, type AxeFrame } from './AxeAnimation.ts';

/** Présentation seule : Weapon possède le temps actif et l'unique événement d'impact. */
export class AxeView {
  private rig: HTMLElement | null = null;
  private sprite: HTMLElement | null = null;
  private lastTransform = '';
  private lastFrame: AxeFrame = 'idle';
  private disposed = false;

  constructor(container: HTMLElement | null) {
    // Les harnais logiques utilisent parfois un DOM minimal sans création de nœuds.
    if (!container || typeof document === 'undefined' || typeof document.createElement !== 'function'
      || typeof container.appendChild !== 'function') return;
    const rig = document.createElement('div');
    rig.id = 'axe-rig';
    rig.setAttribute('aria-hidden', 'true');
    rig.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    rig.hidden = true;
    const sprite = document.createElement('div');
    sprite.className = 'axe-sprite';
    sprite.style.cssText = `position:absolute;left:calc(50% + 15vh);bottom:-18vh;width:min(90vh,120vw);aspect-ratio:1;`
      + `background:url("${axeAsset}") center/contain no-repeat;image-rendering:pixelated;`
      + 'transform:translate(-50%,0);transform-origin:55% 66%;pointer-events:none;';
    rig.appendChild(sprite);
    container.appendChild(rig);
    this.rig = rig;
    this.sprite = sprite;
    if (typeof Image !== 'undefined') for (const asset of Object.values(axeAssets)) new Image().src = asset;
  }

  public setVisible(visible: boolean): void {
    if (this.disposed || !this.rig) return;
    this.rig.hidden = !visible;
  }

  public update(elapsed: number): void {
    if (this.disposed || !this.sprite) return;
    const pose = sampleAxePose(elapsed);
    const geometry = axeFrameGeometry[pose.frame];
    const idle = axeFrameGeometry.idle;
    if (pose.frame !== this.lastFrame) {
      this.sprite.style.backgroundImage = `url("${axeAssets[pose.frame]}")`;
      const pivot = axeGripPivots[pose.frame];
      this.sprite.style.transformOrigin = `${pivot[0]}% ${pivot[1]}%`;
      this.sprite.style.aspectRatio = `384 / ${geometry.height}`;
      this.lastFrame = pose.frame;
    }
    // Référentiel commun des mains, y compris pour le canevas armé plus haut.
    const dx = (idle.grip[0] - geometry.grip[0]) / 384;
    const dy = (geometry.height - 384 + idle.grip[1] - geometry.grip[1]) / 384;
    const scale = pose.scale * idle.span / geometry.span;
    const transform = `translate(calc(-50% + ${pose.x.toFixed(3)}vh + min(90vh,120vw) * ${dx}),calc(${pose.y.toFixed(3)}vh + min(90vh,120vw) * ${dy})) scale(${scale.toFixed(4)})`;
    if (transform !== this.lastTransform) {
      this.sprite.style.transform = transform;
      this.lastTransform = transform;
    }
    this.rig?.setAttribute('data-axe-phase', pose.phase);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.rig?.remove();
    this.rig = null;
    this.sprite = null;
    this.disposed = true;
  }
}
