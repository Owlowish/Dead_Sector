import type { Weapon } from './Weapon.ts';

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
  private announcementRemaining = 0;
  private readonly prompt = document.querySelector<HTMLElement>('#prompt');
  private readonly promptKey = document.querySelector<HTMLElement>('[data-hud-prompt-key]');
  private readonly promptAction = document.querySelector<HTMLElement>('[data-hud-prompt-action]');
  private readonly promptObject = document.querySelector<HTMLElement>('[data-hud-prompt-object]');
  private readonly notifications = document.querySelector<HTMLElement>('#hud-notifications');
  private notices: PickupNotice[] = [];

  public setHealth(health: number, max: number): void {
    const ratio = Math.max(0, Math.min(1, health / Math.max(1, max)));
    write(this.healthValue, String(health));
    write(this.healthMax, String(max));
    write(this.healthState, health <= 0 ? 'HORS COMBAT' : ratio <= 0.25 ? 'ÉTAT CRITIQUE' : 'VITALITÉ');
    this.health?.classList.toggle('is-critical', ratio <= 0.25);
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

  public setProgression(state: HudProgression): void {
    if (this.objective) this.objective.dataset.phase = state.phase;
    let phase = `PALIER ${state.tier} / ${state.total}`;
    let sector = state.sector;
    let progress = `${state.remaining} ${state.remaining === 1 ? 'MENACE RESTANTE' : 'MENACES RESTANTES'}`;
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
    write(this.progress, progress);
    if (this.respiteBar) {
      this.respiteBar.hidden = state.phase !== 'respite';
      if (state.phase === 'respite') {
        this.respiteBar.style.setProperty('--fill', `${Math.max(0, Math.min(1, state.respiteSeconds / 10)) * 100}%`);
      }
    }
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
      for (const notice of this.notices) notice.remaining -= delta;
      this.notices = this.notices.filter((notice) => {
        if (notice.remaining > 0) return true;
        notice.element.remove();
        return false;
      });
      this.announcementRemaining = Math.max(0, this.announcementRemaining - delta);
    }
    if (this.notifications) this.notifications.hidden = !controlActive || this.notices.length === 0;
    if (this.announcement) this.announcement.hidden = !controlActive || this.announcementRemaining <= 0;
  }

  public clear(): void {
    for (const notice of this.notices) notice.element.remove();
    this.notices = [];
    this.announcementRemaining = 0;
    this.setPrompt(null);
    this.update(0, false);
  }
}
