// "Legends": pick one before you drop. Each has one active ability (key Q / touch button).
// Ability logic lives in royale.js (so every game mode can use it).
export const LEGENDS = [
  { id: 'vex', name: 'Vex', icon: '💨', ability: 'Phase Dash', desc: 'Burst forward in the direction you are looking.', cd: 8 },
  { id: 'scout', name: 'Scout', icon: '📡', ability: 'Sonar Ping', desc: 'Reveal loot chests and enemies through walls for 6 seconds.', cd: 20 },
  { id: 'bulwark', name: 'Bulwark', icon: '🛡️', ability: 'Aegis', desc: 'Instantly gain 25 shield.', cd: 25 },
];
export const legendById = (id) => LEGENDS.find((l) => l.id === id) || LEGENDS[0];
