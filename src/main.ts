import './style.css';
import { Game } from './Game';
import { installWeaponArt } from './WeaponPresentation.ts';

void installWeaponArt();
const game = new Game();
game.start();
