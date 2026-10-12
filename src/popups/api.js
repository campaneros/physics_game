// Popup del gioco. Le funzioni sono chiamate anche dai moduli vecchi tramite window.Popups (vedi main.jsx).
import { createElement } from 'react';
import { Game as G, Processes as PR, UI, tr } from '../engine.js';
import { Minigame } from '../minigame/Minigame.jsx';
import { openModal } from './modal.js';
import { BudgetPopup } from './BudgetPopup.jsx';
import { Construction } from './Construction.jsx';
import { Help, News } from './NewsHelp.jsx';
import { ProjectStart, Projects } from './Projects.jsx';
import { RunPopup } from './RunPopup.jsx';

const show = (component, props) => openModal(createElement(component, props));

export const Popups = {
  construction: (pre = []) => show(Construction, { pre }),
  projects: () => show(Projects),
  projectStart: (kind, target) => show(ProjectStart, { kind, target }),
  budget: () => show(BudgetPopup),
  run: () => show(RunPopup),
  news: (id) => show(News, { id }),
  help: () => show(Help),
  // conferma della scoperta: il minigioco si apre in un popup e il punteggio decide l'esito
  confirm: (id) => {
    const tier = PR.TIERS[PR.BY_ID.get(id).tier];
    openModal(createElement(Minigame, {
      seed: UI.randomSeed(), pool: tier.pool, maxLaunches: tier.maxLaunches,
      label: tr('overlay.confirm', { name: tr(`proc.${id}`) }),
      onCancel: () => UI.closeOverlay(),
      onClose: (r) => { UI.closeOverlay(); UI.update((st) => G.confirmDiscovery(st, id, r.score)); },
    }));
  },
};
