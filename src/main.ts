import './style.css';
import { AudioManager } from './AudioManager.ts';
import { Game } from './Game';
import { installWeaponArt } from './WeaponPresentation.ts';

// Gestionnaire audio unique créé avant la scène : le joueur, l'arme et les ennemis s'y adressent.
AudioManager.get();
void installWeaponArt();
const game = new Game(true);
game.start();

(window as unknown as { __DEAD_SECTOR_AUDIO?: () => unknown }).__DEAD_SECTOR_AUDIO = () => AudioManager.peek()?.getStats() ?? null;
