const tracks = {
  menu: { file: '01_menu.ogg', loop: true },
  pause: { file: '02_pause.ogg', loop: true },
  main: { file: '03_principale.ogg', loop: true },
  boss1: { file: '04_boss_phase1_v2.ogg', loop: true },
  transformation: { file: '05_boss_transformation_v2.ogg', loop: false },
  boss2: { file: '06_boss_phase2_v2.ogg', loop: true },
  defeat: { file: '07_defaite.ogg', loop: false },
  victory: { file: '08_victoire.ogg', loop: false },
} as const;

export type MusicTrack = keyof typeof tracks;

interface TrackPlayback {
  buffer?: AudioBuffer;
  offset: number;
}

function fadeBossLoopEdges(buffer: AudioBuffer): void {
  // Les fichiers V2 ont un saut de signal au raccord. Un fondu de 5 ms
  // à chaque bord le lisse sans déplacer le tempo ni rallonger la boucle.
  const frames = Math.min(Math.round(buffer.sampleRate * 0.005), Math.floor(buffer.length / 2));
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let frame = 0; frame < frames; frame++) {
      const gain = (1 - Math.cos(Math.PI * frame / frames)) / 2;
      samples[frame] *= gain;
      samples[samples.length - 1 - frame] *= gain;
    }
  }
}

/** Une seule piste audible, avec reprise à la position quittée. */
export class Music {
  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private readonly requests = new AbortController();
  private readonly playback = new Map<MusicTrack, TrackPlayback>();
  private track: MusicTrack | null = null;
  private audible = false;
  private source: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private volume = 0;
  private mainPresence = 1;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(destination);
  }

  public preload(...ids: MusicTrack[]): void {
    for (const id of ids) {
      if (this.requests.signal.aborted || this.playback.has(id)) continue;
      const playback: TrackPlayback = { offset: 0 };
      this.playback.set(id, playback);
      void this.load(id, playback);
    }
  }

  private async load(id: MusicTrack, playback: TrackPlayback): Promise<void> {
    try {
      const response = await fetch(`/assets/music/${tracks[id].file}`, { signal: this.requests.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      if (this.requests.signal.aborted) return;
      if (id === 'boss1' || id === 'boss2') fadeBossLoopEdges(buffer);
      playback.buffer = buffer;
      if (this.track === id) this.play();
    } catch (error) {
      this.playback.delete(id);
      if (!this.requests.signal.aborted) console.warn('Chargement musique impossible', tracks[id].file, error);
    }
  }

  public select(id: MusicTrack, audible: boolean): void {
    if (this.track === id && this.audible === audible) return;
    this.pause();
    this.track = id;
    this.audible = audible;
    this.updateGain();
    this.preload(id);
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
    if (!this.audible || !this.track || this.source) return;
    const playback = this.playback.get(this.track);
    if (!playback?.buffer || playback.offset >= playback.buffer.duration) return;
    const source = this.context.createBufferSource();
    source.buffer = playback.buffer;
    source.loop = tracks[this.track].loop;
    source.onended = () => {
      source.disconnect();
      this.source = null;
      playback.offset = playback.buffer!.duration;
    };
    source.connect(this.gain);
    this.startedAt = this.context.currentTime;
    source.start(this.startedAt, playback.offset);
    this.source = source;
  }

  private pause(): void {
    const source = this.source;
    if (!source) return;
    const playback = this.playback.get(this.track!)!;
    const position = playback.offset + this.context.currentTime - this.startedAt;
    const duration = playback.buffer!.duration;
    playback.offset = source.loop ? position % duration : Math.min(position, duration);
    source.onended = null;
    source.stop();
    source.disconnect();
    this.source = null;
  }

  public rewind(...ids: MusicTrack[]): void {
    if (this.track && ids.includes(this.track)) {
      this.pause();
      this.track = null;
    }
    for (const id of ids) {
      const playback = this.playback.get(id);
      if (playback) playback.offset = 0;
    }
  }

  public dispose(): void {
    this.pause();
    this.requests.abort();
    this.gain.disconnect();
    this.playback.clear();
  }
}
