import { useLayoutEffect, useRef } from 'react';
import { Physics as PH, UI, tr } from '../engine.js';
import { drawHist } from './hist.js';

// Grafico delle osservazioni: dal vivo durante la presa dati, congelato (con segnale e picco) a scoperta fatta.
export function Histogram({ s, p, d, cfg, L }) {
  const ref = useRef(null);
  const frozen = !!(d && d.snap);
  const hidden = !!d && !frozen;
  useLayoutEffect(() => {
    if (hidden || !ref.current) return;
    if (frozen) drawHist(ref.current, PH.histogram(s, p, d.snap.cfg, d.snap.L), { signal: true, peak: true });
    else drawHist(ref.current, PH.histogram(s, p, cfg, L), { signal: false, peak: p.tier === 0 });
  });
  return (
    <>
      <small className="muted" hidden={hidden}>{frozen ? tr('hist.final', { L: UI.fmt(d.snap.L) }) : tr('hist.live')}</small>
      <canvas ref={ref} className="hist" width="480" height="220" hidden={hidden} />
      <div className="legend" hidden={hidden}>
        <span className="lg"><i className="sw sw-obs" />{tr('hist.obs')}</span>
        <span className="lg"><i className="sw sw-bkg" />{tr('hist.bkg')}</span>
        <span className="lg" hidden={!frozen}><i className="sw sw-sig" />{tr('hist.sig')}</span>
      </div>
    </>
  );
}
