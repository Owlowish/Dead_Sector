import type { Weapon } from './Weapon.ts';
import { getHeartFrame, heartAnimation } from './HeartAnimation.ts';

const motionStorageKey = 'dead-sector-hud-motion-v1';

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
  attack: 'sweep' | 'throw' | null;
  recovering?: boolean;
}
interface PickupNotice {
  kind: GainKind | 'weapon';
  amount: number;
  remaining: number;
  element: HTMLElement;
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
  private readonly pistolSlot = document.querySelector<HTMLElement>('[data-hud-slot="pistol"]');
  private readonly shotgunSlot = document.querySelector<HTMLElement>('[data-hud-slot="shotgun"]');
  private readonly objective = document.querySelector<HTMLElement>('#objective');
  private readonly phase = document.querySelector<HTMLElement>('[data-hud-phase]');
  private readonly sector = document.querySelector<HTMLElement>('[data-hud-sector]');
  private readonly progress = document.querySelector<HTMLElement>('[data-hud-progress]');
  private readonly respiteBar = document.querySelector<HTMLElement>('[data-hud-respite-bar]');
  private readonly announcement = document.querySelector<HTMLElement>('[data-hud-announcement]');
  private readonly boss = document.querySelector<HTMLElement>('[data-hud-boss]');
  private readonly bossBar = document.querySelector<HTMLElement>('[data-hud-boss-bar]');
  private readonly bossPhase = document.querySelector<HTMLElement>('[data-hud-boss-phase]');
  private readonly bossAttack = document.querySelector<HTMLElement>('[data-hud-boss-attack]');
  private announcementRemaining = 0;
  private sectorRemaining = 0;
  private progressionKey = '';
  private combatSector = false;
  private heartElapsed = 0;
  private heartFrame = -1;
  private healthAlive = true;
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
    }
    this.healthBar?.style.setProperty('--fill', `${ratio * 100}%`);
    this.healthBar?.setAttribute('aria-valuenow', String(health));
    this.healthBar?.setAttribute('aria-valuemax', String(max));
  }

  public setFlashlight(enabled: boolean): void {
    write(this.lampState, enabled ? 'ALLUMÉE' : 'ÉTEINTE');
    this.flashlight?.classList.toggle('off', !enabled);
  }

  public setAmmo(state: ReturnType<Weapon['getAmmoState']>, shotgunUnlocked: boolean): void {
    write(this.weaponName, state.weaponName);
    write(this.magazine, String(state.magazine));
    write(this.capacity, String(state.capacity));
    write(this.reserve, String(state.reserve));
    write(this.ammoState, state.isReloading ? 'RECHARGEMENT…'
      : state.magazine === 0 ? (state.reserve > 0 ? '[R] RECHARGER' : 'MUNITIONS ÉPUISÉES')
      : state.reserve === 0 ? 'RÉSERVE ÉPUISÉE' : '');
    this.ammo?.classList.toggle('is-empty', state.magazine === 0);
    this.ammo?.classList.toggle('is-reloading', state.isReloading);
    this.pistolSlot?.classList.toggle('is-active', state.weaponId === 'pistol');
    this.shotgunSlot?.classList.toggle('is-active', state.weaponId === 'shotgun');
    if (this.shotgunSlot) this.shotgunSlot.hidden = !shotgunUnlocked;
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
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
    let phase = `PALIER ${state.tier} / ${state.total}`;
    let sector = state.sector;
    let progress = `${state.remaining} ${state.remaining === 1 ? 'MENACE' : 'MENACES'}`;
    if (state.phase === 'respite') {
      phase = `ACCALMIE · ${state.tier} / ${state.total}`;
      sector = 'PALIER PURGÉ';
      progress = `PROCHAIN COMBAT DANS ${Math.ceil(Math.max(0, state.respiteSeconds))} S`;
    } else if (state.phase === 'won') {
      phase = 'TENTATIVE SURVÉCUE';
      sector = 'LE MANOIR EST PURGÉ';
      progress = '[B] CONSULTER LE BILAN';
    } else if (state.phase === 'lost') {
      phase = 'TENTATIVE INTERROMPUE';
      progress = '[B] CONSULTER LE BILAN';
    } else if (state.phase === 'terminal') {
      phase = 'MANOIR EXPLORABLE';
      progress = 'EXPLORATION LIBRE';
    }
    write(this.phase, phase);
    write(this.sector, sector);
    if (this.sector) this.sector.hidden = this.combatSector && this.sectorRemaining <= 0;
    write(this.progress, progress);
    if (this.respiteBar) {
      this.respiteBar.hidden = state.phase !== 'respite';
      if (state.phase === 'respite') {
        this.respiteBar.style.setProperty('--fill', `${Math.max(0, Math.min(1, state.respiteSeconds / 10)) * 100}%`);
      }
    }
  }

  public setBoss(state: HudBoss | null): void {
    if (this.boss) this.boss.hidden = !state;
    if (!state) return;
    const ratio = Math.max(0, Math.min(1, state.health / Math.max(1, state.maxHealth)));
    this.bossBar?.style.setProperty('--fill', `${ratio * 100}%`);
    this.bossBar?.setAttribute('aria-valuenow', String(state.health));
    this.bossBar?.setAttribute('aria-valuemax', String(state.maxHealth));
    write(this.bossPhase, state.phase === 2 ? 'II · DÉCHAÎNÉ' : 'I · LE GARDIEN');
    write(this.bossAttack, state.recovering ? 'RÉCUPÉRATION · TIREZ OU RECHARGEZ'
      : state.attack === 'sweep' ? 'BALAYAGE · ÉCARTEZ-VOUS'
      : state.attack === 'throw' ? 'JET DE CLÉS · DÉCALEZ-VOUS' : 'GARDEZ UNE ISSUE');
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

  public notifyWeapon(): void {
    this.addNotice('weapon', 0);
  }

  private addNotice(kind: PickupNotice['kind'], amount: number): void {
    if (!this.notifications) return;
    let notice = this.notices.find((entry) => entry.kind === kind);
    if (!notice) {
      if (this.notices.length === 2) this.notices.shift()?.element.remove();
      const element = document.createElement('div');
      element.className = 'hud-notification';
      element.dataset.kind = kind === 'health' ? 'health' : kind === 'weapon' ? 'weapon' : 'ammo';
      notice = { kind, amount: 0, remaining: 2.2, element };
      this.notices.push(notice);
      this.notifications.appendChild(element);
    }
    notice.amount += amount;
    notice.remaining = 2.2;
    write(notice.element, kind === 'weapon' ? 'FUSIL À POMPE ACQUIS · [2]'
      : `+${notice.amount} ${kind === 'health' ? 'PV' : kind === 'shotgun' ? 'CARTOUCHES · CAL. 12' : 'MUNITIONS · 9 MM'}`);
  }

  public update(delta: number, controlActive: boolean): void {
    if (controlActive) {
      const elapsed = Math.max(0, delta);
      if (this.healthAlive && !this.reducedMotion) {
        this.heartElapsed = (this.heartElapsed + elapsed) % heartAnimation.cycleSeconds;
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
  }

  public clear(): void {
    this.setBoss(null);
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
