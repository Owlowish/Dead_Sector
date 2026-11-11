// Dérivés préparés à l'export ; cadrages, cellules et découpes CSS restent identiques.
export function weaponArtCss(asset: string): string {
  const name = asset.split('/').pop()!.replace('.png', '');
  const base = asset.slice(0, asset.indexOf('weapons/'));
  return `var(--weapon-art-${name}, url("${base}weapons/retro/${name}.png"))`;
}

export function weaponAmbientBrightness(environmentBrightness: number): number {
  return Math.max(0.18, Math.min(0.65, 0.12 + environmentBrightness * 0.42));
}

/** Attend le décodage des dérivés sans canvas, URL Blob ni traitement au resize.
 * Fonction autonome : les aperçus hors jeu la sérialisent avec toString(). */
export async function installWeaponArt(assetBase = '/assets/'): Promise<void> {
  const names = [
    'pistol_actions_v3', 'modern_ads', 'hip-rest-v2', 'hip-back-v2',
    'hip-kick-v2', 'ads_pump_v2', 'ads-kick-v2', 'reload_draft', 'live_shell', 'flash',
  ];
  await Promise.all(names.map(name => new Promise<void>((resolve, reject) => {
    const url = `${assetBase}weapons/retro/${name}.png`;
    document.documentElement.style.setProperty(`--weapon-art-${name}`, `url("${url}")`);
    const image = new Image();
    const timeout = setTimeout(() => finish(new Error(`Délai de chargement de l'arme dépassé : ${url}`)), 30000);
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error); else resolve();
    };
    image.onload = () => {
      if (typeof image.decode === 'function') {
        void image.decode().then(() => finish(), () => finish(new Error(`Décodage de l'arme impossible : ${url}`)));
      } else finish();
    };
    image.onerror = () => finish(new Error(`Image d'arme indisponible : ${url}`));
    image.src = url;
  })));
}
