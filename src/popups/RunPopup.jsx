import { useState } from 'react';
import { Game as G, Physics as PH, Processes as PR, UI, tr } from '../engine.js';
import { useSnapshot } from '../store.js';
import { Button, Meter } from '../ds/primitives.jsx';
import { Icon } from '../ds/icons.jsx';
import { Popups } from './api.js';
import { ChipI, Sheet } from './parts.jsx';

const fmt = UI.fmt;
const BAR_SCALE = 1.5; // la barra va oltre l'obiettivo (1.0) fino a 1.5

const Need = ({ ok, children }) => <div className="req-row"><Icon name={ok ? 'check' : 'cross'} size={20} /><span>{children}</span></div>;

// Requisiti mancanti per la prima misura in presa dati: da qui si va a costruire o a sviluppare il pezzo che manca.
function Missing({ s, p }) {
  const lacking = Object.keys(p.need).filter((k) => s.det[k] < p.need[k]);
  const direct = lacking.filter((k) => s.det[k] === 0);
  const go = () => {
    UI.closeOverlay();
    if (!s.built || direct.length) Popups.construction(direct);
    else if (lacking.length) { const k = lacking[0]; if (s.projects[`det:${k}`]) Popups.projects(); else Popups.projectStart('det', k); }
    else Popups.projectStart('energy', null);
  };
  return (
    <>
      <h3>{tr(`proc.${p.id}`)}</h3>
      <div className="cards">
        <Need ok={s.built}>{tr('pop.accelerator')}</Need>
        <Need ok={G.energyOk(s, p.id)}>{`${fmt(PH.energy(s))} / ${fmt(p.thr[s.collider])} GeV`}</Need>
        {Object.entries(p.need).map(([k, lvl]) => <Need key={k} ok={s.det[k] >= lvl}>{`${tr(`sub.${k}`)} ${s.det[k]}/${lvl}`}</Need>)}
      </div>
      <Button variant="primary" onClick={go}>{tr('act.build')}</Button>
    </>
  );
}

// Una corsa prende dati per tutte le misure attive che il detector può fare (adroni: più misure insieme).
function Duration({ s, ids, live }) {
  const [years, setYears] = useState(G.runCost(s, 2) <= s.pools.ops ? 2 : 1); // si propone la durata che puoi permetterti
  const cost = G.runCost(s, years);
  const metric = (p, L) => {
    const e = PH.evaluate(s, p, G.cfgOf(s, p.id), L, PH.SYST_VALID);
    return p.kind === 'measure' ? Math.min(BAR_SCALE, p.goal / (e.sigma || 1e9)) : Math.min(BAR_SCALE, e.z / PH.Z_DISCOVERY);
  };
  return (
    <>
      <small className="muted">{tr('pop.parallel', { n: live.length, max: PH.slots(s) })}</small>
      <div className="pair three">
        {G.RUN_YEARS.map((y) => {
          const c = G.runCost(s, y);
          return (
            <button type="button" key={y} className="tile col" aria-pressed={y === years} onClick={() => setYears(y)}>
              <strong>{`${y} ${tr('unit.year')}`}</strong>
              <ChipI icon="coin" bad={c > s.pools.ops}>{fmt(c)}</ChipI>
              <ChipI icon="clock">{`${UI.fmtYears(y)}′`}</ChipI>
            </button>
          );
        })}
      </div>
      <div className="cards">
        {ids.map((id) => {
          const p = PR.BY_ID.get(id);
          const ok = live.includes(id);
          const L = ok ? G.dataOf(s, id) : 0;
          return (
            <div key={id}>
              <div className="req-row"><Icon name={ok ? 'check' : 'cross'} size={18} /><strong>{tr(`proc.${id}`)}</strong></div>
              {ok && <Meter value={metric(p, L) / BAR_SCALE} next={metric(p, L + PH.lumiRate(s) * years) / BAR_SCALE} mark={1 / BAR_SCALE} label={tr(`proc.${id}`)} />}
            </div>
          );
        })}
      </div>
      <div className="foot">
        <ChipI icon="coin" bad={cost > s.pools.ops}>{`${fmt(cost)} / ${fmt(s.pools.ops)}`}</ChipI>
        <Button variant="primary" disabled={cost > s.pools.ops} onClick={() => { UI.update((st) => G.startRun(st, years)); UI.closeOverlay(); }}>{tr('pop.start')}</Button>
      </div>
    </>
  );
}

export function RunPopup() {
  const s = useSnapshot();
  const ids = G.programsOf(s);
  const live = ids.filter((id) => G.canRun(s, id));
  let body;
  if (!ids.length) {
    body = (
      <>
        <p>{tr('pop.notarget')}</p>
        <Button variant="primary" onClick={() => { UI.closeOverlay(); UI.showTab('physics'); }}>{tr('pop.gotophysics')}</Button>
      </>
    );
  } else if (s.run) {
    body = <><ChipI icon="play">{tr('pop.running')}</ChipI><Meter value={(s.t - s.run.start) / (s.run.end - s.run.start)} label={tr('pop.running')} /></>;
  } else if (!live.length) body = <Missing s={s} p={PR.BY_ID.get(ids[0])} />;
  else body = <Duration s={s} ids={ids} live={live} />;
  return <Sheet title={tr('pop.run')} icon="play">{body}</Sheet>;
}
