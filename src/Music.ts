const tracks = {
  menu: { file: '01_menu.ogg', loop: true },
  pause: { file: '02_pause.ogg', loop: true },
  main: { file: '03_principale.ogg', loop: true },
  boss1: { file: '04_boss_phase1_stream.ogg', loop: true },
  transformation: { file: '05_boss_transformation_v2.ogg', loop: false },
  boss2: { file: '06_boss_phase2_stream.ogg', loop: true },
  defeat: { file: '07_defaite.ogg', loop: false },
  victory: { file: '08_victoire.ogg', loop: false },
} as const;

export type MusicTrack = keyof typeof tracks;
interface TrackPlayback {
  media: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gate: GainNode;
  ready: Promise<void>;
  cancelReady: () => void;
  unlocked: boolean;
}

/** Décodage progressif natif : aucun morceau long conservé en AudioBuffer JS. */
export class Music {
  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private readonly playback = new Map<MusicTrack, TrackPlayback>();
  private readonly unavailable = new Set<MusicTrack>();
  public get unavailableTracks(): readonly MusicTrack[] { return [...this.unavailable]; }
  private track: MusicTrack | null = null;
  private audible = false;
  private volume = 0;
  private mainPresence = 1;
  private disposed = false;
  private activated = false;
  private activation: Promise<void> | null = null;
  private readonly onContextState = (): void => {
    if (this.context.state === 'running') this.play();
    else this.pause();
  };

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(destination);
    context.addEventListener('statechange', this.onContextState);
  }

  public get ready(): Promise<void> { return Promise.all([...this.playback.values()].map(p => p.ready)).then(() => {}); }

  public preload(...ids: MusicTrack[]): Promise<void> {
    if (this.disposed) return Promise.resolve();
    for (const id of ids) {
      if (this.playback.has(id)) continue;
      const media = new Audio();
      media.preload = 'auto';
      media.loop = tracks[id].loop;
      const source = this.context.createMediaElementSource(media);
      const gate = this.context.createGain();
      gate.gain.value = 0;
      source.connect(gate); gate.connect(this.gain);
      let cancelReady = () => {};
      const ready = new Promise<void>(resolve => {
        let timer: ReturnType<typeof setTimeout>;
        const finish = () => {
          clearTimeout(timer);
          media.removeEventListener('canplay', finish);
          media.removeEventListener('error', failed);
          resolve();
        };
        const failed = () => { this.unavailable.add(id); console.warn('Musique indisponible', tracks[id].file); finish(); };
        cancelReady = finish;
        media.addEventListener('canplay', finish, { once: true });
        media.addEventListener('error', failed, { once: true });
        timer = setTimeout(failed, 15000);
      });
      this.playback.set(id, { media, source, gate, ready, cancelReady, unlocked: false });
      media.src = `/assets/music/${tracks[id].file}`;
      media.load();
    }
    return Promise.all(ids.map(id => this.playback.get(id)!.ready)).then(() => {});
  }

  /** Appel direct depuis un clic, derrière le chargement ; les gates restent muettes. */
  public activate(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.activation) return this.activation;
    void this.preload(...Object.keys(tracks) as MusicTrack[]);
    const preparations = [...this.playback.values()].filter(p => !p.unlocked).map(playback => {
      const { media, gate } = playback;
      gate.gain.value = 0;
      // Avant tout await : chaque lecteur bénéficie du geste utilisateur.
      const started = media.play().then(() => true, () => false);
      return new Promise<void>(resolve => {
        let complete = false;
        const finish = (success: boolean) => {
          if (complete) return;
          complete = true;
          clearTimeout(timer);
          playback.unlocked = success;
          if (success) for (const [id, entry] of this.playback) if (entry === playback) this.unavailable.delete(id);
          media.pause();
          if (!this.disposed) media.currentTime = 0;
          resolve();
        };
        const timer = setTimeout(() => finish(false), 2000);
        void started.then(finish);
      });
    });
    this.activation = Promise.all(preparations).then(() => {
      if (this.disposed) return;
      this.activated = true;
      // Un refus ou un périphérique tardif peut être retenté au prochain geste.
      if ([...this.playback.values()].some(p => !p.unlocked)) this.activation = null;
      this.play();
    });
    return this.activation;
  }

  public select(id: MusicTrack, audible: boolean): void {
    if (this.disposed) return;
    if (this.track === id && this.audible === audible) return;
    this.pause();
    this.track = id;
    this.audible = audible;
    this.updateGain();
    void this.preload(id);
    this.play();
  }

  public setVolume(volume: number, mainPresence: number): void {
    this.volume = volume;
    this.mainPresence = mainPresence;
    this.updateGain();
  }

  private updateGain(): void {
    const presence = this.track === 'main' ? this.mainPresence : 1;
    this.gain.gain.setTargetAtTime(0.3 * this.volume * presence, this.context.currentTime, 0.02);
  }

  private play(): void {
    if (this.disposed || !this.activated || !this.audible || !this.track || this.context.state !== 'running') return;
    const playback = this.playback.get(this.track);
    if (!playback || playback.media.ended || !playback.media.paused) return;
    playback.gate.gain.value = 1;
    void playback.media.play().then(() => { playback.unlocked = true; }).catch(error => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn('Lecture musique indisponible', error);
    });
  }

  private pause(): void {
    if (!this.track) return;
    const playback = this.playback.get(this.track);
    playback?.media.pause();
    if (playback) playback.gate.gain.value = 0;
  }

  public rewind(...ids: MusicTrack[]): void {
    if (this.track && ids.includes(this.track)) { this.pause(); this.track = null; }
    for (const id of ids) {
      const playback = this.playback.get(id);
      if (playback) playback.media.currentTime = 0;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.context.removeEventListener('statechange', this.onContextState);
    for (const { media, source, gate, cancelReady } of this.playback.values()) {
      cancelReady(); media.pause(); media.removeAttribute('src'); media.load();
      source.disconnect(); gate.disconnect();
    }
    this.playback.clear(); this.gain.disconnect();
  }
}
