/**
 * Système de mesure et d'instrumentation des performances de DEAD SECTOR.
 * Mesure les temps réels entre images (raw delta), sépare la simulation,
 * et isole les périodes de combat actif des pauses ou changements d'onglets.
 */

export interface FrameMetrics {
  count: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  over33Ms: number;
  over50Ms: number;
}

export interface TransitionMetric {
  tier: number;
  durationMs: number;
  timestamp: number;
}

export interface DetailedPerfReport {
  fps: number;
  frameTimeMs: number;
  combatMetrics: FrameMetrics;
  overallMetrics: FrameMetrics;
  lastSpawnDurationMs: number;
  lastPathfindingDurationMs: number;
  lastTransition: TransitionMetric | null;
  transitionsHistory: TransitionMetric[];
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  shaders: number;
  jsHeapUsedMB: number | null;
  jsHeapTotalMB: number | null;
  internalResolution: string;
  viewportResolution: string;
  activeZombies: number;
  spawnQueue: number;
  state: string;
}

export class PerfTracker {
  private readonly maxFrames: number;
  // Fenêtre circulaire pour les frames en combat
  private combatFrames: Float32Array;
  private combatHead = 0;
  private combatCount = 0;

  // Fenêtre circulaire pour toutes les frames valides (hors tab switch)
  private allFrames: Float32Array;
  private allHead = 0;
  private allCount = 0;

  private lastSpawnDurationMs = 0;
  private lastPathfindingDurationMs = 0;
  private lastTransition: TransitionMetric | null = null;
  private transitionsHistory: TransitionMetric[] = [];

  constructor(windowSize = 300) {
    this.maxFrames = windowSize;
    this.combatFrames = new Float32Array(windowSize);
    this.allFrames = new Float32Array(windowSize);
  }

  public recordFrame(rawDeltaMs: number, isCombat: boolean, isTabSwitch: boolean): void {
    // Si la page était inactive ou l'écart est gigantesque (> 1000 ms), ne pas biaiser les percentiles
    if (isTabSwitch || rawDeltaMs > 1000) {
      return;
    }

    this.allFrames[this.allHead] = rawDeltaMs;
    this.allHead = (this.allHead + 1) % this.maxFrames;
    if (this.allCount < this.maxFrames) this.allCount++;

    if (isCombat) {
      this.combatFrames[this.combatHead] = rawDeltaMs;
      this.combatHead = (this.combatHead + 1) % this.maxFrames;
      if (this.combatCount < this.maxFrames) this.combatCount++;
    }
  }

  public recordSpawn(durationMs: number): void {
    this.lastSpawnDurationMs = durationMs;
  }

  public recordPathfinding(durationMs: number): void {
    this.lastPathfindingDurationMs = durationMs;
  }

  public recordTransition(tier: number, durationMs: number): void {
    const metric: TransitionMetric = {
      tier,
      durationMs,
      timestamp: performance.now(),
    };
    this.lastTransition = metric;
    this.transitionsHistory.push(metric);
    if (this.transitionsHistory.length > 20) {
      this.transitionsHistory.shift();
    }
  }

  public getLastSpawnDurationMs(): number {
    return this.lastSpawnDurationMs;
  }

  public getLastPathfindingDurationMs(): number {
    return this.lastPathfindingDurationMs;
  }

  public getLastTransition(): TransitionMetric | null {
    return this.lastTransition;
  }

  public getTransitionsHistory(): TransitionMetric[] {
    return this.transitionsHistory;
  }

  private computePercentiles(buffer: Float32Array, count: number): FrameMetrics {
    if (count === 0) {
      return {
        count: 0,
        medianMs: 0,
        p95Ms: 0,
        p99Ms: 0,
        maxMs: 0,
        over33Ms: 0,
        over50Ms: 0,
      };
    }

    const samples: number[] = new Array(count);
    let over33 = 0;
    let over50 = 0;
    let max = 0;

    for (let i = 0; i < count; i++) {
      const val = buffer[i];
      samples[i] = val;
      if (val > max) max = val;
      if (val > 33.33) over33++;
      if (val > 50.0) over50++;
    }

    samples.sort((a, b) => a - b);

    const median = samples[Math.floor(count * 0.5)];
    const p95 = samples[Math.min(count - 1, Math.floor(count * 0.95))];
    const p99 = samples[Math.min(count - 1, Math.floor(count * 0.99))];

    return {
      count,
      medianMs: Number(median.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      p99Ms: Number(p99.toFixed(2)),
      maxMs: Number(max.toFixed(2)),
      over33Ms: over33,
      over50Ms: over50,
    };
  }

  public getCombatMetrics(): FrameMetrics {
    return this.computePercentiles(this.combatFrames, this.combatCount);
  }

  public getOverallMetrics(): FrameMetrics {
    return this.computePercentiles(this.allFrames, this.allCount);
  }

  public reset(): void {
    this.combatHead = 0;
    this.combatCount = 0;
    this.allHead = 0;
    this.allCount = 0;
    this.lastSpawnDurationMs = 0;
    this.lastPathfindingDurationMs = 0;
  }
}
