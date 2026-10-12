// Popup del gioco. Le funzioni sono chiamate anche dai moduli vecchi tramite window.Popups (vedi main.jsx).
import { createElement } from 'react';
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
};
