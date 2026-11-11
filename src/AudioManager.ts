import * as THREE from 'three';

/** Les scripts ne pointent que vers les Ogg Vorbis servis ; les WAV sources restent dans `assets-src/sounds`. */
export function soundUrl(id: string): string {
  return `/assets/sounds/${id}.ogg`;
}

interface PoolDefinition {
  /** Variantes jouées en alternance, indépendamment du canal choisi. */
  readonly clips: readonly string[];
  readonly gain: number;
  /** Nombre de canaux THREE.Audio réservés. */
  readonly size: number;
}

/** Sons répétitifs non spatialisés servis par une réserve de canaux. */
export const AUDIO_POOLS = {
  empty: { clips: ['empty-soft'], gain: 0.3, size: 2 },
  pistol: { clips: ['shot-soft', 'shot-soft-2', 'shot-soft-3'], gain: 0.5, size: 4 },
  shotgun: { clips: ['shotgun-shot', 'shotgun-shot-2'], gain: 0.42, size: 3 },
  metal: { clips: ['impact-metal-soft', 'impact-metal-soft-2', 'impact-metal-soft-3'], gain: 0.3, size: 3 },
  wood: { clips: ['impact-wood-soft', 'impact-wood-soft-2', 'impact-wood-soft-3'], gain: 0.3, size: 3 },
  stone: { clips: ['impact-stone-soft', 'impact-stone-soft-2', 'impact-stone-soft-3'], gain: 0.27, size: 3 },
  enemy: { clips: ['impact-zombie-soft', 'impact-zombie-soft-2', 'impact-zombie-soft-3'], gain: 0.35, size: 6 },
  axeFlesh: { clips: ['axe-flesh'], gain: 0.28, size: 2 },
  flashlight: { clips: ['flashlight-click'], gain: 0.35, size: 2 },
  bell: { clips: ['empty-soft'], gain: 0.6, size: 1 },
} as const satisfies Record<string, PoolDefinition>;

export type AudioPoolId = keyof typeof AUDIO_POOLS;

/**
 * `run` : voix libérées en fin de tentative ; buffers conservables pour une reprise sans chargement.
 * `persistent` : décor sonore du manoir partagé avec l'accueil, libéré seulement par `dispose()`.
 */
export type AudioScope = 'run' | 'persistent';

export interface SpatialOptions {
  readonly refDistance: number;
  readonly maxDistance: number;
  readonly rolloff?: number;
  readonly loop?: boolean;
  /** Gain propre ; s'il est fourni, le son suit aussi le canal Effets. Sinon son propriétaire règle le volume. */
  readonly gain?: number;
  readonly scope?: AudioScope;
}

interface Pool {
  readonly definition: PoolDefinition;
  readonly channels: THREE.Audio[];
  nextClip: number;
}

interface SpatialEntry {
  readonly gain?: number;
  readonly scope: AudioScope;
}

/**
 * Point d'entrée unique de l'audio fichier : écouteur partagé, cache de buffers,
 * réserves de canaux et sons spatiaux liés aux objets de la scène.
 * Les pas, le Portrait et la musique gardent leurs graphes
 * mais utilisent le même contexte.
 */
export class AudioManager {
  private static instance: AudioManager | null = null;

  /** Instance unique, créée au premier appel avec l'écouteur du jeu. */
  public static get(): AudioManager {
    AudioManager.instance ??= new AudioManager(new THREE.AudioListener());
    return AudioManager.instance;
  }

  /** Instance courante sans création : les entités restent muettes hors jeu (outils Node, aperçus). */
  public static peek(): AudioManager | null {
    return AudioManager.instance;
  }

  /** Remplace l'instance (écouteur simulé des contrôles, ou nouvelle partie après `dispose`). */
  public static install(listener: THREE.AudioListener): AudioManager {
    AudioManager.instance?.dispose();
    AudioManager.instance = new AudioManager(listener);
    return AudioManager.instance;
  }

  /** Détache et libère un son spatial, même si le gestionnaire a déjà été vidé. */
  public static release(audio: THREE.PositionalAudio | null): void {
    if (!audio) return;
    if (AudioManager.instance) AudioManager.instance.releaseSpatial(audio);
    else detach(audio);
  }

  public readonly listener: THREE.AudioListener;
  public readonly context: AudioContext;
  private readonly loader = new THREE.AudioLoader();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly pending = new Map<string, Promise<AudioBuffer | null>>();
  private readonly cancelLoads = new Map<string, () => void>();
  private readonly unavailable = new Set<string>();
  private readonly persistentIds = new Set<string>();
  private readonly pools = new Map<AudioPoolId, Pool>();
  private readonly spatial = new Map<THREE.PositionalAudio, SpatialEntry>();
  private effectsVolume = 1;
  /** Invalide les chargements en vol d'une partie libérée. */
  private generation = 0;
  private disposed = false;
  private readonly onContextStateChange = (): void => {
    if (this.context.state !== 'running') this.stopEffects();
  };

  private constructor(listener: THREE.AudioListener) {
    this.listener = listener;
    this.context = listener.context;
    this.context.addEventListener?.('statechange', this.onContextStateChange);
  }

  /** Inclut les demandes ajoutées par les propriétaires pendant le décodage courant. */
  public get ready(): Promise<void> { return this.waitForPending(); }
  public get unavailableIds(): readonly string[] { return [...this.unavailable]; }

  private async waitForPending(): Promise<void> {
    while (!this.disposed && this.pending.size > 0) await Promise.all([...this.pending.values()]);
  }

  public getBuffer(id: string): AudioBuffer | null {
    return this.buffers.get(id) ?? null;
  }

  /** Charge (une seule fois) le fichier Ogg d'un son ; résout `null` si l'échec ou un `clear()` l'a rendu inutile. */
  public load(id: string, scope: AudioScope = 'run'): Promise<AudioBuffer | null> {
    if (this.disposed) return Promise.resolve(null);
    if (scope === 'persistent') this.persistentIds.add(id);
    const cached = this.buffers.get(id);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.pending.get(id);
    if (inFlight) return inFlight;
    const generation = this.generation;
    let resolveRequest!: (buffer: AudioBuffer | null) => void;
    let finished = false;
    let timer: ReturnType<typeof setTimeout>;
    const request = new Promise<AudioBuffer | null>(resolve => { resolveRequest = resolve; });
    const finish = (buffer: AudioBuffer | null, error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const ownsRequest = this.pending.get(id) === request;
      if (ownsRequest) {
        this.pending.delete(id);
        this.cancelLoads.delete(id);
      }
      const stale = this.disposed || !ownsRequest || (generation !== this.generation && !this.persistentIds.has(id));
      if (!stale && buffer) {
        this.buffers.set(id, buffer);
        this.unavailable.delete(id);
      } else if (!stale) {
        this.unavailable.add(id);
        console.warn('Chargement audio impossible', id, error);
      }
      resolveRequest(stale ? null : buffer);
    };
    // Certains outils fournissent un loader synchrone : l'entrée doit exister avant son callback.
    this.pending.set(id, request);
    this.cancelLoads.set(id, () => finish(null));
    timer = setTimeout(() => finish(null, new Error('Délai de chargement/décodage audio dépassé')), 15000);
    try {
      this.loader.load(soundUrl(id), buffer => finish(buffer), undefined, error => finish(null, error));
    } catch (error) {
      finish(null, error);
    }
    return request;
  }

  /** Recrée les réserves et précharge leurs variantes ; appelé au démarrage et après chaque `clear()`. */
  public preloadPools(): void {
    if (this.disposed) return;
    for (const id of Object.keys(AUDIO_POOLS) as AudioPoolId[]) {
      const definition = AUDIO_POOLS[id];
      if (!this.pools.has(id)) {
        const channels = Array.from({ length: definition.size }, () => new THREE.Audio(this.listener));
        this.pools.set(id, { definition, channels, nextClip: 0 });
      }
      for (const clip of definition.clips) void this.load(clip);
    }
  }

  /** Joue la variante suivante sur le premier canal libre ; à défaut, coupe le plus ancien du même groupe. */
  public playPooled(id: AudioPoolId): boolean {
    const pool = this.pools.get(id);
    if (!pool || this.disposed || this.effectsVolume === 0 || this.context.state !== 'running') return false;
    const clip = pool.definition.clips[pool.nextClip]!;
    const buffer = this.buffers.get(clip);
    // Alterner indépendamment de la disponibilité des canaux et des tirages de dispersion.
    pool.nextClip = (pool.nextClip + 1) % pool.definition.clips.length;
    if (!buffer) return false;
    let channel = pool.channels.find((audio) => !audio.isPlaying);
    if (!channel) {
      channel = pool.channels.shift()!;
      pool.channels.push(channel);
      channel.stop();
    }
    channel.setBuffer(buffer);
    channel.setVolume(pool.definition.gain * this.effectsVolume);
    channel.play();
    return true;
  }

  public stopPool(id: AudioPoolId): void {
    for (const channel of this.pools.get(id)?.channels ?? []) {
      if (channel.isPlaying) channel.stop();
    }
  }

  /** Remet chaque alternance de variantes sur sa première prise (nouvelle tentative). */
  public resetPoolCycles(): void {
    for (const pool of this.pools.values()) pool.nextClip = 0;
  }

  /** Son non spatial bouclé ou ponctuel dont le propriétaire règle le volume (nappe d'ambiance). */
  public createAudio(id: string, loop = false): THREE.Audio | null {
    const buffer = this.buffers.get(id);
    if (!buffer || this.disposed) return null;
    const audio = new THREE.Audio(this.listener);
    audio.setBuffer(buffer);
    audio.setLoop(loop);
    return audio;
  }

  /**
   * Son 3D attaché à un objet (ennemi, fenêtre, point du décor) : il suit sa position
   * à chaque mise à jour des matrices du rendu. `null` tant que le buffer n'est pas chargé.
   */
  public createSpatial(id: string, options: SpatialOptions, parent?: THREE.Object3D): THREE.PositionalAudio | null {
    const buffer = this.buffers.get(id);
    if (!buffer || this.disposed) return null;
    const audio = new THREE.PositionalAudio(this.listener);
    audio.setBuffer(buffer);
    audio.setLoop(options.loop ?? false);
    audio.setRefDistance(options.refDistance);
    audio.setMaxDistance(options.maxDistance);
    if (options.rolloff !== undefined) audio.setRolloffFactor(options.rolloff);
    // Volume posé directement pour qu'une voix créée Effets coupés soit muette dès sa création.
    if (options.gain !== undefined) audio.gain.gain.value = options.gain * this.effectsVolume;
    this.spatial.set(audio, { gain: options.gain, scope: options.scope ?? 'run' });
    parent?.add(audio);
    return audio;
  }

  public releaseSpatial(audio: THREE.PositionalAudio): void {
    this.spatial.delete(audio);
    detach(audio);
  }

  public setEffectsVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.effectsVolume = THREE.MathUtils.clamp(volume, 0, 1);
    for (const pool of this.pools.values()) {
      for (const channel of pool.channels) channel.setVolume(pool.definition.gain * this.effectsVolume);
    }
    for (const [audio, entry] of this.spatial) {
      if (entry.gain !== undefined) audio.setVolume(entry.gain * this.effectsVolume);
    }
    if (this.effectsVolume === 0) this.stopEffects();
  }

  /** Coupe réserves et voix suivant Effets (perte de contrôle, focus, pause). */
  public stopEffects(): void {
    for (const id of this.pools.keys()) this.stopPool(id);
    for (const [audio, entry] of this.spatial) {
      if (entry.gain !== undefined && audio.isPlaying) audio.stop();
    }
  }

  /**
   * Fin de tentative : coupe les voix et peut conserver buffers/canaux pour la suivante.
   * Sans keepBuffers, libère également les réserves et décodages hors décor persistant.
   */
  public clear({ keepBuffers = false }: { keepBuffers?: boolean } = {}): void {
    if (!keepBuffers) this.generation++;
    for (const pool of this.pools.values()) {
      for (const channel of pool.channels) {
        if (channel.isPlaying) channel.stop();
        if (!keepBuffers) {
          channel.disconnect();
          channel.gain.disconnect();
        }
      }
    }
    if (!keepBuffers) this.pools.clear();
    else this.resetPoolCycles();
    for (const [audio, entry] of [...this.spatial]) {
      if (entry.scope === 'run') this.releaseSpatial(audio);
    }
    if (keepBuffers) return;
    for (const id of [...this.buffers.keys()]) {
      if (!this.persistentIds.has(id)) this.buffers.delete(id);
    }
    for (const id of [...this.pending.keys()]) {
      if (!this.persistentIds.has(id)) this.cancelLoads.get(id)?.();
    }
  }

  /** Fin du jeu : tout est libéré, y compris le décor persistant, et le singleton est retiré. */
  public dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.context.removeEventListener?.('statechange', this.onContextStateChange);
    for (const audio of [...this.spatial.keys()]) this.releaseSpatial(audio);
    this.buffers.clear();
    for (const cancel of [...this.cancelLoads.values()]) cancel();
    this.pending.clear();
    this.cancelLoads.clear();
    this.unavailable.clear();
    this.persistentIds.clear();
    this.listener.removeFromParent();
    if (AudioManager.instance === this) AudioManager.instance = null;
  }

  /** Diagnostic exposé par `main.ts`. */
  public getStats(): { buffers: number; pending: number; spatial: number; pools: Record<string, { size: number; playing: number }> } {
    const pools: Record<string, { size: number; playing: number }> = {};
    for (const [id, pool] of this.pools) {
      pools[id] = { size: pool.channels.length, playing: pool.channels.filter((audio) => audio.isPlaying).length };
    }
    return { buffers: this.buffers.size, pending: this.pending.size, spatial: this.spatial.size, pools };
  }
}

function detach(audio: THREE.PositionalAudio): void {
  try {
    if (audio.isPlaying) audio.stop();
    audio.disconnect();
  } catch { /* Source déjà arrêtée ou jamais connectée. */ }
  // Nœuds facultatifs : une voix peut être une source simulée ou déjà démontée.
  audio.panner?.disconnect();
  audio.gain?.disconnect();
  audio.removeFromParent();
}
