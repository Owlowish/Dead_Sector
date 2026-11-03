// Traitement de rendu uniquement : les sources et leurs coordonnées de découpe restent intactes.
export function weaponArtCss(asset: string): string {
  const name = asset.split('/').pop()!.replace('.png', '');
  return `var(--weapon-art-${name}, url("${asset}"))`;
}

export function weaponAmbientBrightness(environmentBrightness: number): number {
  return Math.max(0.18, Math.min(0.65, 0.12 + environmentBrightness * 0.42));
}

export async function installWeaponArt(assetBase = '/assets/', pixelSize = 3): Promise<void> {
  const paths = [
    'weapons/pistol_actions_v3.png', 'weapons/modern_ads.png',
    'weapons/shotgun/hip-rest-v2.png', 'weapons/shotgun/hip-back-v2.png',
    'weapons/shotgun/hip-kick-v2.png', 'weapons/shotgun/ads_pump_v2.png',
    'weapons/shotgun/ads-kick-v2.png', 'weapons/shotgun/reload_draft.png',
    'weapons/shotgun/live_shell.png', 'weapons/shotgun/flash.png',
  ];
  const images = await Promise.all(paths.map(path => new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { console.warn('Image d’arme indisponible :', path); resolve(null); };
    image.src = assetBase + path;
  })));

  let renderVersion = 0;
  const urls = new Map<string, string>();
  async function render(): Promise<void> {
    const version = ++renderVersion;
    const width = window.innerWidth, height = window.innerHeight;
    const pistol = Math.min(0.54 * height, 0.74 * width);
    const hip = Math.min(0.80 * height, 1.35 * width);
    const ads = 1.16 * height;
    const loading = Math.min(0.72 * height, 0.92 * width);
    // Largeur réellement dessinée par le CSS ; les atlas gardent leurs colonnes entières.
    const displayWidths = [pistol * 3, 0.96 * height, hip, hip, hip, ads * 2,
      ads, loading, loading * 0.14 * 1.7, Math.max(hip * 0.19, ads * 0.26) * 2];
    const columns = [3, 1, 1, 1, 1, 2, 1, 1, 1, 2];
    await Promise.all(images.map(async (image, index) => {
      if (!image) return;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(columns[index], Math.ceil(displayWidths[index] / pixelSize / columns[index]) * columns[index]);
      canvas.height = Math.max(1, Math.round(canvas.width * image.naturalHeight / image.naturalWidth));
      const context = canvas.getContext('2d');
      if (!context) return;
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        // Équivalent d'un alphaTest : éliminer le voile rectangulaire des pixels presque transparents.
        for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] < 128 ? 0 : 255;
        context.putImageData(pixels, 0, 0);
        const name = paths[index].split('/').pop()!.replace('.png', '');
        // Une courte URL évite de reparcourir des chaînes base64 lors des animations CSS héritées.
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob || version !== renderVersion) return;
        const url = URL.createObjectURL(blob);
        const previous = urls.get(name);
        urls.set(name, url);
        document.documentElement.style.setProperty(`--weapon-art-${name}`, `url("${url}")`);
        if (previous) URL.revokeObjectURL(previous);
      } catch (error) {
        // Un aperçu ouvert en file:// peut interdire la lecture du canvas ; le CSS garde sa source.
        console.warn('Rendu rétro de l’arme indisponible :', paths[index], error);
      }
    }));
  }
  await render();
  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { void render(); }, 120);
  });
}
