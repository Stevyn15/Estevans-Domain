import { Game } from './game.js';
import { initUI } from './ui.js';
import { initEasterEggs } from './easter.js';

const game = new Game(document.getElementById('c'));
window.__game = game;           // handy for debugging in the console
initUI(game);
initEasterEggs(game);
