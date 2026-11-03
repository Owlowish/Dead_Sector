/**
 * DEAD SECTOR — Diagnostics locaux de combat par palier (Tâche 0).
 * Enregistre pour chaque palier le rythme, les entités, les ressources et les dégâts,
 * sans télémétrie externe ni modification de l'interface utilisateur en jeu.
 */

export interface TierDiagnosticRecord {
  tierNumber: number;
  durationSeconds: number;
  firstContactDelaySeconds: number | null;
  maxSimultaneousThreats: number;
  spawnedByType: {
    standard: number;
    agile: number;
    spitter: number;
  };
  damageTaken: number;
  medkitsCollected: number;
  ammoBoxesCollected: number;
  shotsFired: number;
  revivalsCount: {
    standard: number;
    agile: number;
  };
}

export class TierDiagnosticsTracker {
  private records: TierDiagnosticRecord[] = [];
  private currentRecord: TierDiagnosticRecord | null = null;
  private tierStartTime = 0;
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

  public startTier(tierNumber: number): void {
    if (!this.enabled) return;
    if (this.currentRecord) {
      this.endTier();
    }
    this.tierStartTime = typeof performance !== 'undefined' ? performance.now() : 0;
    this.currentRecord = {
      tierNumber,
      durationSeconds: 0,
      firstContactDelaySeconds: null,
      maxSimultaneousThreats: 0,
      spawnedByType: {
        standard: 0,
        agile: 0,
        spitter: 0,
      },
      damageTaken: 0,
      medkitsCollected: 0,
      ammoBoxesCollected: 0,
      shotsFired: 0,
      revivalsCount: {
        standard: 0,
        agile: 0,
      },
    };
  }

  public recordSpawn(kind: 'standard' | 'agile' | 'spitter', activeThreats: number): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.spawnedByType[kind]++;
    if (activeThreats > this.currentRecord.maxSimultaneousThreats) {
      this.currentRecord.maxSimultaneousThreats = activeThreats;
    }
  }

  public recordShot(): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.shotsFired++;
  }

  public recordDamageTaken(amount: number): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.damageTaken += amount;
    this.markFirstContact();
  }

  public recordDamageDealt(): void {
    if (!this.enabled || !this.currentRecord) return;
    this.markFirstContact();
  }

  private markFirstContact(): void {
    if (!this.currentRecord || this.currentRecord.firstContactDelaySeconds !== null) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    this.currentRecord.firstContactDelaySeconds = Number(((now - this.tierStartTime) / 1000).toFixed(2));
  }

  public recordMedkit(): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.medkitsCollected++;
  }

  public recordAmmoBox(): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.ammoBoxesCollected++;
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

  public endTier(): void {
    if (!this.enabled || !this.currentRecord) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    this.currentRecord.durationSeconds = Number(((now - this.tierStartTime) / 1000).toFixed(2));
    this.records.push({ ...this.currentRecord });
    this.currentRecord = null;
  }

  public getRecords(): TierDiagnosticRecord[] {
    return [...this.records];
  }

  public getCurrentRecord(): TierDiagnosticRecord | null {
    if (!this.currentRecord) return null;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    return {
      ...this.currentRecord,
      durationSeconds: Number(((now - this.tierStartTime) / 1000).toFixed(2)),
    };
  }

  public clear(): void {
    this.records = [];
    this.currentRecord = null;
    this.tierStartTime = 0;
  }
}
