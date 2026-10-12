import { useEffect, useLayoutEffect } from 'react';
import { Game, UI, tr } from '../engine.js';
import { useBanner, useGame, useTab } from '../store.js';
import { Icon } from '../ds/icons.jsx';

export const TABS = [
  { id: 'site', icon: 'ring' },
  { id: 'physics', icon: 'atom' },
  { id: 'play', icon: 'flask' },
  { id: 'budget', icon: 'coin' },
];

// Striscia degli avvisi: il testo cambia con un breve lampo per attirare l'occhio.
export function Ticker() {
  const text = useBanner();
  return <p id="banner" role="status" className="ticker"><span key={text} className="ticker__txt">{text}</span></p>;
}

export function TabBar() {
  const tab = useTab();
  return (
    <nav id="tabs" aria-label={tr('aria.sections')}>
      {TABS.map(({ id, icon }) => (
        <button key={id} type="button" data-view={id} aria-selected={tab === id} onClick={() => UI.showTab(id)}>
          <Icon name={icon} size={26} />
          <span>{tr(`tab.${id}`)}</span>
        </button>
      ))}
    </nav>
  );
}

// Le viste restano tutte nel DOM (come prima): i moduli vecchi vi si montano e conservano il proprio stato.
export function Viewport() {
  const tab = useTab();
  const budgetOpen = useGame(Game.unlockedBudget);
  useLayoutEffect(() => { UI.afterTab(tab); }, [tab]);
  useEffect(() => { document.documentElement.dataset.tab = tab; }, [tab]);
  return (
    <main>
      <section id="view-site" className="view" aria-label={tr('tab.site')} hidden={tab !== 'site'}><div id="site-host" /></section>
      <section id="view-physics" className="view" aria-label={tr('tab.physics')} hidden={tab !== 'physics'}><div id="physics-host" /></section>
      <section id="view-play" className="view" aria-label={tr('tab.play')} hidden={tab !== 'play'}><div id="play-host" /></section>
      <section id="view-budget" className="view" aria-label={tr('tab.budget')} hidden={tab !== 'budget'}>
        <p id="budget-lock" className="card" hidden={budgetOpen}>{tr('budget.note.locked')}</p>
        <div id="budget-host" hidden={!budgetOpen} />
      </section>
    </main>
  );
}

// Cornice dei popup: lo stato (hidden) e il contenuto restano gestiti da UI.showOverlay/closeOverlay.
export function OverlayFrame() {
  return <div id="overlay" hidden><div id="overlay-body" /></div>;
}
