import { Game } from './game.js';
import { initUI } from './ui.js';
import { initEasterEggs } from './easter.js';

const game = new Game(document.getElementById('c'));
// Debug handle for tests and the console. Only exposed on localhost or when a test sets window.__DEBUG__ —
// never in store builds (scripts/release-check.mjs verifies this gate is present).
if (window.__DEBUG__ || location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.__game = game;
initUI(game);
initEasterEggs(game);
