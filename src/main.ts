import './style.css';
import { nextLoadingFrame, prepareInterfaceImages, StartupAssets, withStartupTimeout } from './StartupLoading.ts';

const screen = document.querySelector<HTMLElement>('#loading-screen')!;
const status = document.querySelector<HTMLElement>('#loading-status')!;
const progress = document.querySelector<HTMLProgressElement>('#loading-progress')!;
const notice = document.querySelector<HTMLElement>('#loading-notice')!;
const action = document.querySelector<HTMLButtonElement>('#loading-action')!;
let failed = false;

function failStartup(error: unknown): void {
  failed = true;
  console.error('Préparation du jeu impossible.', error);
  status.textContent = 'Le manoir n’a pas pu être chargé. Vérifiez votre connexion puis réessayez.';
  progress.hidden = true;
  screen.setAttribute('aria-busy', 'false');
  action.textContent = 'Réessayer';
  action.hidden = false;
  // Une page propre évite les listeners/caches d'une construction partielle.
  action.onclick = () => window.location.reload();
  action.focus();
}

function stage(message: string): void {
  status.textContent = message;
  progress.removeAttribute('value');
  action.hidden = true;
  screen.setAttribute('aria-busy', 'true');
}

async function boot(): Promise<void> {
  await nextLoadingFrame();
  // Le moteur et le constructeur ne bloquent pas la première peinture du chargement.
  const [{ Game, getStartupLoadingManager }, { installWeaponArt }, { axeAssets }] = await withStartupTimeout(
    Promise.all([import('./Game.ts'), import('./WeaponPresentation.ts'), import('./AxeAnimation.ts')]),
    'Démarrage du jeu',
  );
  stage('Chargement du manoir et des personnages…');
  await nextLoadingFrame();
  const assets = new StartupAssets(getStartupLoadingManager(), (loaded, total) => {
    if (failed) return;
    status.textContent = `Chargement des ressources · ${loaded} / ${total}`;
  });
  const game = new Game(true, true);
  const [missing] = await Promise.all([
    assets.wait(),
    installWeaponArt(),
    prepareInterfaceImages([...Object.values(axeAssets), '/assets/ui/gothic/heart-beat-v2.png']),
    withStartupTimeout(game.prepareAudio(), 'Préparation audio', 20000).then(unavailable => {
      if (!failed && unavailable.length) {
        notice.textContent = 'Certains sons sont indisponibles. Vous pouvez continuer à jouer.';
        notice.hidden = false;
      }
    }).catch(error => {
      if (failed) return;
      console.warn('Certains sons ne sont pas prêts.', error);
      notice.textContent = 'Certains sons sont indisponibles. Vous pouvez continuer à jouer.';
      notice.hidden = false;
    }),
  ]);
  if (missing.length) {
    notice.textContent = 'Certains sons sont indisponibles. Vous pouvez continuer à jouer.';
    notice.hidden = false;
  }
  stage('Préparation des premières apparitions…');
  await nextLoadingFrame();
  await withStartupTimeout(game.prepareGraphics((done, total) => {
    if (failed) return;
    progress.max = total;
    progress.value = done;
  }), 'Préparation graphique', 60000);
  status.textContent = 'Le manoir est prêt.';
  progress.max = 1;
  progress.value = 1;
  screen.setAttribute('aria-busy', 'false');
  action.hidden = false;
  action.focus();
  action.onclick = () => {
    try {
      stage('Préparation du son…');
      // Appelé dans le geste utilisateur, avant tout await. Le Pointer Lock reste au clic d'accueil.
      const activation = game.activateStartupAudio();
      void withStartupTimeout(activation, 'Activation du son', 8000).catch(error => {
        console.warn('Le jeu continue sans activation audio complète.', error);
      }).then(() => {
        game.finishStartup();
        game.start();
        screen.hidden = true;
        document.body.removeAttribute('data-loading');
        document.querySelector<HTMLButtonElement>('#title-play')?.focus();
      }).catch(failStartup);
    } catch (error) {
      failStartup(error);
    }
  };
}

void boot().catch(failStartup);
