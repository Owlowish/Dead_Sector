/** Les effets courts partagent leur décodage, jamais un lecteur HTML au premier tir. */
const decoded = new WeakMap<AudioContext, Map<string, Promise<AudioBuffer | null>>>();

function load(context: AudioContext, url: string): Promise<AudioBuffer | null> {
  let cache = decoded.get(context);
  if (!cache) { cache = new Map(); decoded.set(context, cache); }
  let pending = cache.get(url);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await context.decodeAudioData(await response.arrayBuffer());
      } catch (error) {
        cache!.delete(url);
        console.warn('Effet sonore indisponible', url, error);
        return null;
      }
    })();
    cache.set(url, pending);
  }
  return pending;
}

interface Voice { source: AudioBufferSourceNode; gain: GainNode; url: string }

export class BufferedSoundBank {
  public readonly ready: Promise<void>;
  private readonly unavailable: string[] = [];
  public get unavailableUrls(): readonly string[] { return this.unavailable; }
  private readonly context: AudioContext;
  private readonly output: GainNode;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly voices: Voice[] = [];
  private readonly limit: number;
  private volume = 1;
  private disposed = false;

  constructor(context: AudioContext, destination: AudioNode, urls: readonly string[], limit: number) {
    this.context = context;
    this.output = context.createGain();
    this.output.connect(destination);
    this.limit = Math.max(1, limit);
    this.ready = Promise.all([...new Set(urls)].map(async url => {
      const buffer = await load(context, url);
      if (buffer && !this.disposed) this.buffers.set(url, buffer);
      else if (!buffer && !this.disposed) this.unavailable.push(url);
    })).then(() => {});
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume) || this.disposed) return;
    this.volume = Math.max(0, Math.min(1, volume));
    this.output.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.015);
    if (this.volume === 0) this.stop();
  }

  play(url: string, volume: number): void {
    const buffer = this.buffers.get(url);
    if (!buffer || this.disposed || this.volume === 0 || this.context.state !== 'running') return;
    // Une variante redéclenchée remplace sa voix, comme l'ancien currentTime = 0.
    for (const voice of [...this.voices]) if (voice.url === url) this.release(voice, true);
    if (this.voices.length >= this.limit) this.release(this.voices[0]!, true);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain); gain.connect(this.output);
    const voice = { source, gain, url };
    this.voices.push(voice);
    source.onended = () => this.release(voice, false);
    source.start();
  }

  private release(voice: Voice, stop: boolean): void {
    const index = this.voices.indexOf(voice);
    if (index === -1) return;
    this.voices.splice(index, 1);
    voice.source.onended = null;
    if (stop) voice.source.stop();
    voice.source.disconnect(); voice.source.buffer = null;
    voice.gain.disconnect();
  }

  stop(): void { for (const voice of [...this.voices]) this.release(voice, true); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop(); this.output.disconnect(); this.buffers.clear();
  }
}
