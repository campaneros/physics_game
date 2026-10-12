import { useRef, useState } from 'react';
import { Game as G, UI, tr } from '../engine.js';
import { useSnapshot } from '../store.js';
import { Button } from '../ds/primitives.jsx';
import { ChipI, Side, Sheet, Tile, projectName } from './parts.jsx';

const fmt = UI.fmt;
const HELP_PAGES = 6;
const ARM_MS = 3000; // il secondo tocco su "azzera" deve arrivare entro questo tempo

// Notizia dai progetti: ritardo con scelta (paga o aspetta).
export function News({ id }) {
  const s = useSnapshot();
  const e = s.pending.find((x) => x.id === id);
  const resolve = (choice) => { UI.update((st) => G.resolveEvent(st, id, choice)); UI.closeOverlay(); };
  return (
    <Sheet title={tr('pop.news')} icon="clock">
      {!e ? <p className="muted">{tr('proj.none')}</p> : (
        <>
          <h3>{tr('evt.delay.title', { name: projectName(e.key) })}</h3>
          <div className="cards">
            <Tile icon="coin" name={tr('evt.delay.pay')} side={<Side><ChipI icon="coin" bad={e.pay > s.pools.rnd}>{fmt(e.pay)}</ChipI></Side>} disabled={e.pay > s.pools.rnd} onClick={() => resolve('pay')} />
            <Tile icon="clock" name={tr('evt.delay.wait', { stall: e.stall })} side={<Side><ChipI icon="clock">{e.stall.toFixed(1)}</ChipI></Side>} onClick={() => resolve('accept')} />
          </div>
        </>
      )}
    </Sheet>
  );
}

// Come si gioca. "Azzera progressi" chiede due tocchi ravvicinati.
export function Help() {
  const armedAt = useRef(0);
  const [armed, setArmed] = useState(false);
  const reset = () => {
    if (Date.now() - armedAt.current > ARM_MS) { armedAt.current = Date.now(); setArmed(true); return; }
    UI.resetGame();
  };
  return (
    <div className="sheet">
      <h2>{tr('help.title')}</h2>
      {Array.from({ length: HELP_PAGES }, (_, i) => <p key={i}>{tr(`help.p${i + 1}`)}</p>)}
      <div className="row">
        <Button onClick={() => UI.closeOverlay()}>{tr('help.close')}</Button>
        <Button variant="danger" onClick={reset}>{tr(armed ? 'help.reset.armed' : 'help.reset')}</Button>
      </div>
    </div>
  );
}
