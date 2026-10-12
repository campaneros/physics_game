// Accesso al motore di gioco, caricato come script classici prima del bundle. Nessuna logica qui.
export const { Game, Physics, Processes, Core, Budget, I18n } = window;
export { UI } from './runtime.js';
export const tr = I18n.t;
