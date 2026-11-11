import type { LoadingManager } from 'three';

/** Uniquement pendant le démarrage : suit aussi le décodage AudioLoader de Three. */
export class StartupAssets {
  private readonly pending = new Map<string, number>();
  private readonly failures = new Set<string>();
  private readonly restore: () => void;
  private loaded = 0;
  private total = 0;

  constructor(manager: LoadingManager, progress: (loaded: number, total: number) => void) {
    const start = manager.itemStart, end = manager.itemEnd, error = manager.itemError;
    manager.itemStart = (url) => {
      this.pending.set(url, (this.pending.get(url) ?? 0) + 1);
      this.total++;
      start.call(manager, url);
      progress(this.loaded, this.total);
    };
    manager.itemEnd = (url) => {
      const count = this.pending.get(url) ?? 0;
      if (count > 1) this.pending.set(url, count - 1);
      else this.pending.delete(url);
      this.loaded++;
      end.call(manager, url);
      progress(this.loaded, this.total);
    };
    manager.itemError = (url) => {
      this.failures.add(url);
      error.call(manager, url);
    };
    this.restore = () => {
      manager.itemStart = start;
      manager.itemEnd = end;
      manager.itemError = error;
    };
  }

  async wait(timeoutMs = 30000): Promise<string[]> {
    const deadline = performance.now() + timeoutMs;
    try {
      while (this.pending.size && performance.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const missing = [...new Set([...this.failures, ...this.pending.keys()])];
      // L'absence d'une image rend les collisions/télégraphies trompeuses ; un son reste facultatif.
      const critical = missing.filter(url => !/\/assets\/(sounds|music)\//.test(url));
      if (critical.length) throw new Error(`Ressources visuelles indisponibles : ${critical.join(', ')}`);
      return missing;
    } finally {
      this.restore();
    }
  }
}

export async function nextLoadingFrame(): Promise<void> {
  // Deux RAF garantissent que le message a été peint avant le prochain lot synchrone.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function withStartupTimeout<T>(work: Promise<T>, label: string, timeoutMs = 30000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} : délai dépassé`)), timeoutMs);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Les images DOM ne passent pas par LoadingManager. Aucun canvas ni bitmap dérivé ici. */
export async function prepareInterfaceImages(paths: readonly string[]): Promise<void> {
  await Promise.all(paths.map(path => withStartupTimeout(new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      void image.decode().then(() => resolve(), reject);
    };
    image.onerror = () => reject(new Error(`Image indisponible : ${path}`));
    image.src = path;
  }), path)));
}
