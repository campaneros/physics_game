import { useEffect, useRef } from 'react';
import { Game as G, UI, tr } from '../engine.js';
import { Button, Meter, Panel } from '../ds/primitives.jsx';

// Cursore non controllato: segue lo stato solo quando non è trascinato (altrimenti il pollice "salta").
function Slider({ max, value, onInput, inputRef }) {
  const dragging = useRef(false);
  useEffect(() => { if (!dragging.current && inputRef.current) inputRef.current.value = String(value); }, [value, inputRef]);
  return (
    <input
      ref={inputRef}
      type="range"
      min="0"
      max={max}
      step="5"
      defaultValue={value}
      onInput={onInput}
      onPointerDown={() => { dragging.current = true; }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    />
  );
}

const pct = (v) => `${Math.round(v * 100)}%`;

function MeterRow({ label, cls, value }) {
  return (
    <div className="meter">
      <small>{label}</small>
      <Meter className={cls} tone={cls === 'm-bkg' ? 'red' : cls === 'm-bw' ? 'gold' : cls === 'm-sig' ? 'green' : 'cyan'} value={value} label={label} />
      <small className="muted">{pct(value)}</small>
    </div>
  );
}

// Trigger e soglia di selezione, con i misuratori di cosa si conserva.
export function TriggerControls({ s, p, cfg, e }) {
  const trigRef = useRef(null);
  const cutRef = useRef(null);
  const send = () => UI.update((st) => G.setCfg(st, p.id, { trig: Number(trigRef.current.value) / 100, cut: Number(cutRef.current.value) / 100 }));
  const pur = e.ok ? e.Snom / (e.Snom + e.B || 1) : 0;
  return (
    <Panel>
      <h3>{tr('physics.trigger.title')}</h3>
      <small>{tr('physics.trig', { v: cfg.trig.toFixed(2) })}</small>
      <Slider max={90} value={Math.round(cfg.trig * 100)} onInput={send} inputRef={trigRef} />
      <small className="muted">{tr('physics.trig.desc')}</small>
      <small>{tr('physics.cut', { v: cfg.cut.toFixed(2) })}</small>
      <Slider max={120} value={Math.round(cfg.cut * 100)} onInput={send} inputRef={cutRef} />
      <small className="muted">{tr('physics.cut.desc')}</small>
      <MeterRow label={tr('physics.m.sig')} cls="m-sig" value={e.ok ? e.sigEff : 0} />
      <MeterRow label={tr('physics.m.bkg')} cls="m-bkg" value={e.ok ? e.bkgEff : 0} />
      <MeterRow label={tr('physics.m.pur')} cls="m-pur" value={pur} />
      <MeterRow label={tr('physics.m.bw')} cls="m-bw" value={e.ok ? e.tg.loss : 0} />
      {e.ok && <small className="muted">{tr(e.tg.shared ? 'physics.trigshared' : 'physics.trigload', { kept: Math.round(e.tg.loss * 100), rate: UI.fmt(e.tg.total), bw: UI.fmt(e.tg.bandwidth) })}</small>}
      {p.tier === 0 && <Button onClick={() => UI.update((st) => G.autotuneCfg(st, p.id))}>{tr('physics.tune')}</Button>}
    </Panel>
  );
}
