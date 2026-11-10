import type { Weapon, FirearmId } from './Weapon.ts';
import { getHeartFrame, heartAnimation } from './HeartAnimation.ts';

const motionStorageKey = 'dead-sector-hud-motion-v1';
const shotFeedbackSeconds = 0.3;

export interface HudProgression {
  phase: 'combat' | 'respite' | 'won' | 'lost' | 'terminal';
  tier: number;
  total: number;
  sector: string;
  remaining: number;
  respiteSeconds: number;
}

export interface HudPrompt {
  key?: string;
  action: string;
  object?: string;
  locked?: boolean;
}

type GainKind = 'health' | 'pistol' | 'shotgun';
export interface HudBoss {
  health: number;
  maxHealth: number;
  phase: 1 | 2;
  attack: 'sweep' | 'blades' | 'tear' | null;
  transforming?: boolean;
  comboTransition?: boolean;
  maskExposed?: boolean;
  openingReady?: boolean;
  openingCovered?: boolean;
  sweepThreat?: boolean;
  volleyIndex?: 1 | 2;
  frameResisting?: boolean;
}
interface PickupNotice {
  kind: GainKind | 'weapon';
  amount: number;
  remaining: number;
  element: HTMLElement;
  weaponId?: FirearmId;
}

function write(element: HTMLElement | null, value: string): void {
  if (element && element.textContent !== value) element.textContent = value;
}

/** Présentation seule : les valeurs et les transitions viennent de Game. */
export class GameHud {
  private readonly health = document.querySelector<HTMLElement>('#health');
  private readonly healthValue = document.querySelector<HTMLElement>('[data-hud-health-value]');
  private readonly healthMax = document.querySelector<HTMLElement>('[data-hud-health-max]');
  private readonly healthBar = document.querySelector<HTMLElement>('[data-hud-health-bar]');
  private readonly healthState = document.querySelector<HTMLElement>('[data-hud-health-state]');
  private readonly flashlight = document.querySelector<HTMLElement>('#flashlight-status');
  private readonly lampState = document.querySelector<HTMLElement>('[data-hud-lamp-state]');
  private readonly ammo = document.querySelector<HTMLElement>('#ammo');
  private readonly weaponName = document.querySelector<HTMLElement>('[data-hud-weapon-name]');
  private readonly magazine = document.querySelector<HTMLElement>('[data-hud-magazine]');
  private readonly capacity = document.querySelector<HTMLElement>('[data-hud-capacity]');
  private readonly reserve = document.querySelector<HTMLElement>('[data-hud-reserve]');
  private readonly ammoState = document.querySelector<HTMLElement>('[data-hud-ammo-state]');
  private readonly axeSlot = document.querySelector<HTMLElement>('[data-hud-slot="axe"]');
  private readonly pistolSlot = document.querySelector<HTMLElement>('[data-hud-slot="pistol"]');
  private readonly shotgunSlot = document.querySelector<HTMLElement>('[data-hud-slot="shotgun"]');
  private readonly objective = document.querySelector<HTMLElement>('#objective');
  private readonly phaseLabel = document.querySelector<HTMLElement>('[data-hud-phase-label]');
  private readonly tier = document.querySelector<HTMLElement>('[data-hud-tier]');
  private readonly tierTotal = document.querySelector<HTMLElement>('[data-hud-tier-total]');
  private readonly total = document.querySelector<HTMLElement>('[data-hud-total]');
  private readonly sector = document.querySelector<HTMLElement>('[data-hud-sector]');
  private readonly progressLabel = document.querySelector<HTMLElement>('[data-hud-progress-label]');
  private readonly remaining = document.querySelector<HTMLElement>('[data-hud-remaining]');
  private readonly respiteBar = document.querySelector<HTMLElement>('[data-hud-respite-bar]');
  private readonly announcement = document.querySelector<HTMLElement>('[data-hud-announcement]');
  private readonly boss = document.querySelector<HTMLElement>('[data-hud-boss]');
  private readonly bossBar = document.querySelector<HTMLElement>('[data-hud-boss-bar]');
  private readonly bossPhase = document.querySelector<HTMLElement>('[data-hud-boss-phase]');
  private readonly bossAttack = document.querySelector<HTMLElement>('[data-hud-boss-attack]');
  private readonly sweepWarning = document.querySelector<HTMLElement>('[data-hud-sweep-warning]');
  private sweepThreat = false;
  private announcementRemaining = 0;
  private sectorRemaining = 0;
  private progressionKey = '';
  private combatSector = false;
  private heartElapsed = 0;
  private heartFrame = -1;
  private healthAlive = true;
  private shotRemaining = 0;
  private ammoWeaponId: string | null = null;
  private ammoReloading = false;
  private reducedMotion = false;
  private motionOverride: boolean | null = null;
  private readonly motionInput = document.querySelector<HTMLInputElement>('#reduce-heart-motion');
  private readonly motionPreference = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  private readonly onMotionPreference = (): void => {
    if (this.motionOverride === null) this.setReducedMotion(this.motionPreference?.matches ?? false);
  };
  private readonly onMotionInput = (): void => {
    this.motionOverride = this.motionInput?.checked ?? false;
    this.setReducedMotion(this.motionOverride);
    try { window.localStorage?.setItem(motionStorageKey, this.motionOverride ? 'reduced' : 'full'); } catch { /* Stockage facultatif. */ }
  };
  private readonly prompt = document.querySelector<HTMLElement>('#prompt');
  private readonly promptKey = document.querySelector<HTMLElement>('[data-hud-prompt-key]');
  private readonly promptAction = document.querySelector<HTMLElement>('[data-hud-prompt-action]');
  private readonly promptObject = document.querySelector<HTMLElement>('[data-hud-prompt-object]');
  private readonly notifications = document.querySelector<HTMLElement>('#hud-notifications');
  private notices: PickupNotice[] = [];

  constructor() {
    try {
      const stored = window.localStorage?.getItem(motionStorageKey);
      if (stored === 'reduced' || stored === 'full') this.motionOverride = stored === 'reduced';
    } catch { /* Les préférences système restent applicables sans stockage. */ }
    this.setReducedMotion(this.motionOverride ?? this.motionPreference?.matches ?? false);
    this.resetShotFeedback();
    this.motionInput?.addEventListener('change', this.onMotionInput);
    this.motionPreference?.addEventListener('change', this.onMotionPreference);
  }

  public setHealth(health: number, max: number): void {
    const ratio = Math.max(0, Math.min(1, health / Math.max(1, max)));
    write(this.healthValue, String(health));
    write(this.healthMax, String(max));
    write(this.healthState, health <= 0 ? 'HORS COMBAT' : ratio <= 0.25 ? 'CRITIQUE' : '');
    this.health?.classList.toggle('is-critical', ratio <= 0.25);
    this.healthAlive = health > 0;
    this.health?.classList.toggle('is-dead', !this.healthAlive);
    if (!this.healthAlive) {
      this.heartElapsed = 0;
      this.renderHeart();
      this.resetShotFeedback();
    }
    this.healthBar?.style.setProperty('--fill', `${ratio * 100}%`);
    this.healthBar?.setAttribute('aria-valuenow', String(health));
    this.healthBar?.setAttribute('aria-valuemax', String(max));
  }

  public setFlashlight(enabled: boolean): void {
    write(this.lampState, enabled ? 'ALLUMÉE' : 'ÉTEINTE');
    this.flashlight?.classList.toggle('off', !enabled);
  }

  public setAmmo(state: ReturnType<Weapon['getAmmoState']>, shotgunUnlocked: boolean, pistolUnlocked = true): void {
    if (this.ammoWeaponId !== state.weaponId || state.isReloading) this.resetShotFeedback();
    this.ammoWeaponId = state.weaponId;
    this.ammoReloading = state.isReloading;
    write(this.weaponName, state.weaponName);
    write(this.magazine, String(state.magazine));
    write(this.capacity, String(state.capacity));
    write(this.reserve, String(state.reserve));
    const melee = state.weaponId === 'axe';
    write(this.ammoState, melee ? 'COUP LENT · ÉTOURDIT AU CONTACT' : state.isReloading ? 'RECHARGEMENT…'
      : state.magazine === 0 ? (state.reserve > 0 ? '[R] RECHARGER' : 'MUNITIONS ÉPUISÉES')
      : state.reserve === 0 ? 'RÉSERVE ÉPUISÉE' : '');
    this.ammo?.classList.toggle('is-empty', !melee && state.magazine === 0);
    this.ammo?.classList.toggle('is-reloading', state.isReloading);
    if (this.ammo) this.ammo.dataset.weapon = state.weaponId;
    this.axeSlot?.classList.toggle('is-active', melee);
    this.pistolSlot?.classList.toggle('is-active', state.weaponId === 'pistol');
    this.shotgunSlot?.classList.toggle('is-active', state.weaponId === 'shotgun');
    if (this.shotgunSlot) this.shotgunSlot.hidden = !shotgunUnlocked;
    if (this.pistolSlot) this.pistolSlot.hidden = !pistolUnlocked;
  }

  public notifyShot(): void {
    if (!this.healthAlive || this.ammoReloading || this.ammoWeaponId === 'axe') return;
    this.shotRemaining = shotFeedbackSeconds;
    this.renderShotFeedback();
  }

  private renderShotFeedback(): void {
    const flash = this.shotRemaining / shotFeedbackSeconds;
    this.ammo?.style.setProperty('--shot-progress', String(this.shotRemaining > 0 ? 1 - flash : 0));
    this.ammo?.style.setProperty('--shot-flash', String(flash));
  }

  private resetShotFeedback(): void {
    this.shotRemaining = 0;
    this.renderShotFeedback();
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.ammo?.classList.toggle('has-reduced-motion', reduced);
    if (this.motionInput) this.motionInput.checked = reduced;
    if (reduced) this.heartElapsed = 0;
    this.renderHeart();
  }

  private renderHeart(): void {
    const frame = this.reducedMotion || !this.healthAlive ? 0 : getHeartFrame(this.heartElapsed);
    if (frame === this.heartFrame) return;
    this.heartFrame = frame;
    this.health?.style.setProperty('--heart-frame', String(frame));
  }

  public setProgression(state: HudProgression): void {
    if (this.objective) this.objective.dataset.phase = state.phase;
    const key = `${state.phase}:${state.tier}:${state.sector}`;
    this.combatSector = state.phase === 'combat';
    if (key !== this.progressionKey) {
      this.progressionKey = key;
      this.sectorRemaining = this.combatSector ? 3 : 0;
    }
    let phase = 'PALIER';
    let sector = state.sector;
    let progress = state.remaining === 1 ? 'MENACE' : 'MENACES';
    let remaining = String(state.remaining);
    if (state.phase === 'respite') {
      phase = 'ACCALMIE';
      sector = 'PALIER PURGÉ';
      progress = 'PROCHAIN COMBAT DANS';
      remaining = `${Math.ceil(Math.max(0, state.respiteSeconds))} S`;
    } else if (state.phase === 'won') {
      phase = 'TENTATIVE SURVÉCUE';
      sector = 'LE MANOIR EST PURGÉ';
      progress = '[B]';
      remaining = 'CONSULTER LE BILAN';
    } else if (state.phase === 'lost') {
      phase = 'TENTATIVE INTERROMPUE';
      progress = '[B]';
      remaining = 'CONSULTER LE BILAN';
    } else if (state.phase === 'terminal') {
      phase = 'MANOIR EXPLORABLE';
      progress = '';
      remaining = 'EXPLORATION LIBRE';
    }
    write(this.phaseLabel, phase);
    write(this.tier, String(state.tier));
    write(this.total, String(state.total));
    const showTier = state.phase === 'combat' || state.phase === 'respite';
    if (this.tier) this.tier.hidden = !showTier;
    if (this.tierTotal) this.tierTotal.hidden = !showTier;
    write(this.sector, sector);
    if (this.sector) this.sector.hidden = this.combatSector && this.sectorRemaining <= 0;
    write(this.progressLabel, progress);
    write(this.remaining, remaining);
    if (this.respiteBar) {
      this.respiteBar.hidden = state.phase !== 'respite';
      if (state.phase === 'respite') {
        this.respiteBar.style.setProperty('--fill', `${Math.max(0, Math.min(1, state.respiteSeconds / 10)) * 100}%`);
      }
    }
  }

  public setBoss(state: HudBoss | null): void {
    if (this.boss) this.boss.hidden = !state;
    const openingReady = state?.openingReady === true;
    const clearOpening = openingReady && !state?.openingCovered;
    this.sweepThreat = state?.sweepThreat === true;
    if (!this.sweepThreat && this.sweepWarning) this.sweepWarning.hidden = true;
    this.bossAttack?.classList.toggle('guardian-opening', clearOpening);
    if (!state) return;
    const ratio = Math.max(0, Math.min(1, state.health / Math.max(1, state.maxHealth)));
    this.bossBar?.style.setProperty('--fill', `${ratio * 100}%`);
    this.bossBar?.setAttribute('aria-valuenow', String(state.health));
    this.bossBar?.setAttribute('aria-valuemax', String(state.maxHealth));
    const phaseLabel = state.phase === 2 ? 'II · HORS DU CADRE' : 'I · DANS LE CADRE';
    write(this.bossPhase, state.frameResisting && !openingReady ? `${phaseLabel} · LE CADRE ABSORBE LES COUPS` : phaseLabel);
    write(this.bossAttack, state.transforming ? 'LA TOILE SE DÉCHIRE'
      : state.comboTransition ? 'ENCHAÎNEMENT · RESTEZ MOBILE'
      : clearOpening ? 'MASQUE EXPOSÉ · TIREZ'
      : openingReady ? 'MASQUE EXPOSÉ'
      : state.maskExposed ? 'MASQUE EXPOSÉ · CADRE RÉSISTANT'
      : state.attack === 'sweep' ? 'BALAYAGE · ÉCARTEZ-VOUS'
      : state.attack === 'blades' ? `LAMES DE PEINTURE · SALVE ${state.volleyIndex ?? 1}/2 · DÉCALEZ-VOUS`
      : state.attack === 'tear' ? 'DÉCHIRURE · QUITTEZ LA TRACE'
      : state.maskExposed === false ? 'MASQUE PROTÉGÉ · GARDEZ UNE ISSUE' : 'GARDEZ UNE ISSUE');
  }

  public setPrompt(prompt: HudPrompt | null): void {
    if (!this.prompt) return;
    this.prompt.hidden = !prompt;
    if (!prompt) return;
    write(this.promptKey, prompt.key ?? '');
    if (this.promptKey) this.promptKey.hidden = !prompt.key;
    write(this.promptAction, prompt.action);
    write(this.promptObject, prompt.object ?? '');
    if (this.promptObject) this.promptObject.hidden = !prompt.object;
    this.prompt.classList.toggle('is-locked', Boolean(prompt.locked));
  }

  public announce(text: string, seconds = 3): void {
    write(this.announcement, text);
    this.announcementRemaining = seconds;
  }

  public notifyGain(kind: GainKind, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.addNotice(kind, amount);
  }

  public notifyWeapon(weaponId: FirearmId = 'shotgun'): void {
    this.addNotice('weapon', 0, weaponId);
  }

  private addNotice(kind: PickupNotice['kind'], amount: number, weaponId?: FirearmId): void {
    if (!this.notifications) return;
    let notice = this.notices.find((entry) => entry.kind === kind && entry.weaponId === weaponId);
    if (!notice) {
      if (this.notices.length === 2) this.notices.shift()?.element.remove();
      const element = document.createElement('div');
      element.className = 'hud-notification';
      element.dataset.kind = kind === 'health' ? 'health' : kind === 'weapon' ? 'weapon' : 'ammo';
      notice = { kind, amount: 0, remaining: 2.2, element, weaponId };
      this.notices.push(notice);
      this.notifications.appendChild(element);
    }
    notice.amount += amount;
    notice.remaining = 2.2;
    write(notice.element, kind === 'weapon' ? (weaponId === 'pistol' ? 'PISTOLET ACQUIS · [2]' : 'FUSIL À POMPE ACQUIS · [3]')
      : `+${notice.amount} ${kind === 'health' ? 'PV' : kind === 'shotgun' ? 'CARTOUCHES · CAL. 12' : 'MUNITIONS · 9 MM'}`);
  }

  public update(delta: number, controlActive: boolean): void {
    if (controlActive) {
      const elapsed = Math.max(0, delta);
      if (this.healthAlive && !this.reducedMotion) {
        this.heartElapsed = (this.heartElapsed + elapsed) % heartAnimation.cycleSeconds;
      }
      if (this.shotRemaining > 0) {
        this.shotRemaining = Math.max(0, this.shotRemaining - elapsed);
        this.renderShotFeedback();
      }
      this.sectorRemaining = Math.max(0, this.sectorRemaining - elapsed);
      for (const notice of this.notices) notice.remaining -= delta;
      this.notices = this.notices.filter((notice) => {
        if (notice.remaining > 0) return true;
        notice.element.remove();
        return false;
      });
      this.announcementRemaining = Math.max(0, this.announcementRemaining - delta);
    }
    this.renderHeart();
    if (this.sector) this.sector.hidden = this.combatSector && this.sectorRemaining <= 0;
    if (this.notifications) this.notifications.hidden = !controlActive || this.notices.length === 0;
    if (this.announcement) this.announcement.hidden = !controlActive || this.announcementRemaining <= 0;
    if (this.sweepWarning) this.sweepWarning.hidden = !controlActive || !this.sweepThreat;
  }

  public clear(): void {
    this.setBoss(null);
    this.resetShotFeedback();
    for (const notice of this.notices) notice.element.remove();
    this.notices = [];
    this.announcementRemaining = 0;
    this.heartElapsed = 0;
    this.progressionKey = '';
    this.sectorRemaining = 0;
    this.setPrompt(null);
    this.update(0, false);
  }

  public dispose(): void {
    this.clear();
    this.motionInput?.removeEventListener('change', this.onMotionInput);
    this.motionPreference?.removeEventListener('change', this.onMotionPreference);
  }
}
