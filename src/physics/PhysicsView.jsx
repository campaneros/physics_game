import { useState } from 'react';
import { Game as G, Processes as PR, UI, tr } from '../engine.js';
import { useSnapshot, useTab } from '../store.js';
import { Panel } from '../ds/primitives.jsx';
import { TargetList } from './TargetList.jsx';
import { TargetPanel } from './TargetPanel.jsx';

const INITIAL_SEL = { strategy: 'bump', blind: true, valid: true, cuts: {}, lastCut: null };

function Finale({ s }) {
  const st = G.stats(s);
  return (
    <Panel>
      <h2>{tr('finale.title')}</h2>
      <p>{tr('finale.text', { years: st.years.toFixed(1), pub: st.published, scooped: st.scooped, limits: st.limits })}</p>
    </Panel>
  );
}

function PhysicsBody({ view, setView, sel, setSel, showDone, setShowDone, showLocked, setShowLocked }) {
  const s = useSnapshot();
  const curId = view && PR.BY_ID.has(view) ? view : s.program;
  const p = curId ? PR.BY_ID.get(curId) : null;
  // toccare un bersaglio lo mostra; entra da solo nella presa dati solo se non ce n'è nessuno (poi si usa Aggiungi/Togli)
  const pick = (id) => { setView(id); if (!G.programsOf(s).length) UI.update((st) => G.select(st, id)); };
  return (
    <>
      <TargetList s={s} curId={curId} onPick={pick} showDone={showDone} showLocked={showLocked} onToggleDone={() => setShowDone(!showDone)} onToggleLocked={() => setShowLocked(!showLocked)} />
      {!p && <p className="muted">{tr('physics.pick')}</p>}
      {G.isComplete(s) && <Finale s={s} />}
      {p && <TargetPanel s={s} p={p} sel={sel} onSel={setSel} />}
    </>
  );
}

// La scheda si monta solo quando è visibile: così i calcoli dell'istogramma non girano a ogni tick sulle altre schede.
export function PhysicsView() {
  const tab = useTab();
  // le scelte dell'utente vivono qui: sopravvivono al cambio scheda
  const [view, setView] = useState(null);
  const [sel, setSel] = useState(INITIAL_SEL);
  const [showDone, setShowDone] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  return (
    <div id="physics-host">
      {tab === 'physics' && <PhysicsBody view={view} setView={setView} sel={sel} setSel={setSel} showDone={showDone} setShowDone={setShowDone} showLocked={showLocked} setShowLocked={setShowLocked} />}
    </div>
  );
}
