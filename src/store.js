// Ponte React ↔ motore. Lo stato resta in ui.js; qui solo sottoscrizioni con selettori che restituiscono valori primitivi.
import { useSyncExternalStore } from 'react';
import { UI } from './engine.js';

/** @template T @param {(s: object) => T} select valore primitivo derivato dallo stato di gioco */
export const useGame = (select) => useSyncExternalStore(UI.subscribe, () => select(UI.get()));
export const useTab = () => useSyncExternalStore(UI.subscribe, UI.getTab);
export const useBanner = () => useSyncExternalStore(UI.subscribe, UI.getBanner);
