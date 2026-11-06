/**
 * DEAD SECTOR — Diagnostics locaux de combat par palier (Tâche 0).
 * Enregistre pour chaque palier le rythme, les entités, les ressources et les dégâts,
 * sans télémétrie externe ni modification de l'interface utilisateur en jeu.
 */

import type { AmmoStocks, WeaponId } from './Weapon.ts';

export interface WeaponDiagnosticStats {
  shotsFired: number;
  headHits: number;
  bodyHits: number;
  ammoGained: number;
}

export interface TierDiagnosticRecord {
  tierNumber: number;
  durationSeconds: number;
  firstContactDelaySeconds: number | null;
  maxSimultaneousThreats: number;
  spawnedByType: {
    standard: number;
    agile: number;
    spitter: number;
    crawler: number;
  };
  damageTaken: number;
  medkitsCollected: number;
  ammoBoxesCollected: number;
  shotsFired: number;
  headHits: number;
  bodyHits: number;
  ammoDropsCreated: number;
  weaponStats: Record<WeaponId, WeaponDiagnosticStats>;
  ammoAtStart: AmmoStocks | null;
  ammoAtEnd: AmmoStocks | null;
  healthRestored: number;
  revivalsCount: {
    standard: number;
    agile: number;
  };
}

export class TierDiagnosticsTracker {
  private records: TierDiagnosticRecord[] = [];
  private currentRecord: TierDiagnosticRecord | null = null;
  private elapsedSeconds = 0;
  private enabled = true;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public startTier(tierNumber: number, ammoStocks?: AmmoStocks): void {
    if (!this.enabled) return;
    if (this.currentRecord) {
      this.endTier();
    }
    this.elapsedSeconds = 0;
    this.currentRecord = {
      tierNumber,
      durationSeconds: 0,
      firstContactDelaySeconds: null,
      maxSimultaneousThreats: 0,
      spawnedByType: {
        standard: 0,
        agile: 0,
        spitter: 0,
        crawler: 0,
      },
      damageTaken: 0,
      medkitsCollected: 0,
      ammoBoxesCollected: 0,
      shotsFired: 0,
      headHits: 0,
      bodyHits: 0,
      ammoDropsCreated: 0,
      weaponStats: {
        pistol: { shotsFired: 0, headHits: 0, bodyHits: 0, ammoGained: 0 },
        shotgun: { shotsFired: 0, headHits: 0, bodyHits: 0, ammoGained: 0 },
      },
      ammoAtStart: ammoStocks ? structuredClone(ammoStocks) : null,
      ammoAtEnd: ammoStocks ? structuredClone(ammoStocks) : null,
      healthRestored: 0,
      revivalsCount: {
        standard: 0,
        agile: 0,
      },
    };
  }

  /** Appelé uniquement pendant le combat sous contrôle, avec le temps actif réel. */
  public advance(deltaSeconds: number): void {
    if (!this.enabled || !this.currentRecord || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.elapsedSeconds += deltaSeconds;
    this.currentRecord.durationSeconds = Number(this.elapsedSeconds.toFixed(2));
  }

  public recordAmmoStocks(ammoStocks: AmmoStocks): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.ammoAtEnd = structuredClone(ammoStocks);
  }

  public recordSpawn(kind: 'standard' | 'agile' | 'spitter' | 'crawler', activeThreats: number): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.spawnedByType[kind]++;
    if (activeThreats > this.currentRecord.maxSimultaneousThreats) {
      this.currentRecord.maxSimultaneousThreats = activeThreats;
    }
  }

  public recordShot(weaponId: WeaponId = 'pistol'): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.shotsFired++;
    this.currentRecord.weaponStats[weaponId].shotsFired++;
  }

  public recordHit(headHits: number, bodyHits: number, weaponId: WeaponId = 'pistol'): void {
    if (!this.enabled || !this.currentRecord) return;
    if (!Number.isFinite(headHits) || !Number.isFinite(bodyHits) || headHits < 0 || bodyHits < 0) return;
    this.currentRecord.headHits += headHits;
    this.currentRecord.bodyHits += bodyHits;
    this.currentRecord.weaponStats[weaponId].headHits += headHits;
    this.currentRecord.weaponStats[weaponId].bodyHits += bodyHits;
  }

  public recordAmmoDrop(): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.ammoDropsCreated++;
  }

  public recordDamageTaken(amount: number): void {
    if (!this.enabled || !this.currentRecord || !Number.isFinite(amount) || amount <= 0) return;
    this.currentRecord.damageTaken += amount;
    this.markFirstContact();
  }

  public recordDamageDealt(): void {
    if (!this.enabled || !this.currentRecord) return;
    this.markFirstContact();
  }

  private markFirstContact(): void {
    if (!this.currentRecord || this.currentRecord.firstContactDelaySeconds !== null) return;
    this.currentRecord.firstContactDelaySeconds = Number(this.elapsedSeconds.toFixed(2));
  }

  public recordMedkit(healthGained = 0): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.medkitsCollected++;
    if (Number.isFinite(healthGained) && healthGained > 0) this.currentRecord.healthRestored += healthGained;
  }

  public recordAmmoBox(weaponId?: WeaponId, ammoGained = 0): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.ammoBoxesCollected++;
    if (weaponId) this.recordAmmoGain(weaponId, ammoGained);
  }

  public recordAmmoGain(weaponId: WeaponId, ammoGained: number): void {
    if (!this.enabled || !this.currentRecord || !Number.isFinite(ammoGained) || ammoGained <= 0) return;
    this.currentRecord.weaponStats[weaponId].ammoGained += ammoGained;
  }

  public recordRevival(kind: 'standard' | 'agile'): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.revivalsCount[kind]++;
  }

  public updateActiveThreats(count: number): void {
    if (!this.enabled || !this.currentRecord) return;
    if (count > this.currentRecord.maxSimultaneousThreats) {
      this.currentRecord.maxSimultaneousThreats = count;
    }
  }

  public endTier(ammoStocks?: AmmoStocks): void {
    if (!this.enabled || !this.currentRecord) return;
    if (ammoStocks) this.recordAmmoStocks(ammoStocks);
    this.records.push(structuredClone(this.currentRecord));
    this.currentRecord = null;
  }

  public getRecords(): TierDiagnosticRecord[] {
    return structuredClone(this.records);
  }

  public getCurrentRecord(ammoStocks?: AmmoStocks): TierDiagnosticRecord | null {
    if (!this.currentRecord) return null;
    if (ammoStocks) this.recordAmmoStocks(ammoStocks);
    return structuredClone(this.currentRecord);
  }

  public clear(): void {
    this.records = [];
    this.currentRecord = null;
    this.elapsedSeconds = 0;
  }
}
