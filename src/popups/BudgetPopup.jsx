import { useState } from 'react';
import { Game as G, UI, tr } from '../engine.js';
import { useSnapshot } from '../store.js';
import { Button, Chip, Range } from '../ds/primitives.jsx';
import { Icon } from '../ds/icons.jsx';
import { ChipI, Sheet } from './parts.jsx';

const fmt = UI.fmt;
const POOL_ICON = { ops: 'play', analysis: 'flask', rnd: 'wrench' };
const ALLOC_STEP = 5;
const ALLOC_MAX = 80;

// Sposta un cursore e ridistribuisce il resto tra gli altri due fondi, mantenendo somma 100 e il minimo.
function rebalance(alloc, key, value) {
  const v = Math.min(ALLOC_MAX, Math.max(G.MIN_ALLOC, Math.round(value / ALLOC_STEP) * ALLOC_STEP));
  const others = G.POOLS.filter((k) => k !== key);
  const rest = 100 - v;
  const w = alloc[others[0]] + alloc[others[1]];
  const first = Math.min(rest - G.MIN_ALLOC, Math.max(G.MIN_ALLOC, Math.round((rest * alloc[others[0]]) / w / ALLOC_STEP) * ALLOC_STEP));
  return { ...alloc, [key]: v, [others[0]]: first, [others[1]]: rest - first };
}

// Previsione a 5 anni: base + finanziamenti temporanei attivi.
function Forecast({ s }) {
  const fc = G.forecast(s, 5);
  const max = Math.max(...fc.map((f) => f.total), G.BASE_BUDGET);
  return (
    <div className="forecast">
      {fc.map((f) => (
        <div className="fc" key={f.year}>
          <div className="stack">
            <i className="boost" style={{ height: `${((f.total - f.base) / max) * 100}%` }} />
            <i className="base" style={{ height: `${(f.base / max) * 100}%` }} />
          </div>
          <small>{f.year}</small>
          <small className="muted">{fmt(f.total)}</small>
        </div>
      ))}
    </div>
  );
}

function PoolPicker({ label, current, onPick }) {
  return (
    <div className="chips">
      {G.POOLS.map((k) => <Chip key={k} pressed={current === k} aria-label={`${label} ${tr(`pool.${k}`)}`} onClick={() => onPick(k)}><Icon name={POOL_ICON[k]} size={18} /></Chip>)}
    </div>
  );
}

// Budget: conti, allocazione, previsione e trasferimenti tra fondi.
export function BudgetPopup() {
  const s = useSnapshot();
  const [from, setFrom] = useState('ops');
  const [to, setTo] = useState('analysis');
  return (
    <Sheet title={tr('pop.budget')} icon="coin">
      <div className="cards">
        <div className="foot">
          <ChipI icon="coin">{tr('pop.annual', { amount: fmt(G.annualBudget(s)) })}</ChipI>
          <ChipI icon="clock">{G.POOLS.map((k) => `${s.alloc[k]}%`).join(' · ')}</ChipI>
        </div>
        <small className="muted">{tr('pop.forecast')}</small>
        <Forecast s={s} />
        {G.POOLS.map((k) => (
          <div className="pool-row" key={k}>
            <div className="bg-head">
              <strong><Icon name={POOL_ICON[k]} size={18} /> {tr(`pool.${k}`)}</strong>
              <span>{`${fmt(s.pools[k])} · ${s.alloc[k]}%`}</span>
            </div>
            <Range min={G.MIN_ALLOC} max={ALLOC_MAX} step={ALLOC_STEP} value={s.alloc[k]} aria-label={tr(`pool.${k}`)} onChange={(v) => UI.update((st) => G.setAlloc(st, rebalance(st.alloc, k, v)))} />
          </div>
        ))}
        <small className="muted">{tr('pop.transfer')}</small>
        <div className="mv">
          <PoolPicker label={tr('pop.from')} current={from} onPick={setFrom} />
          <Icon name="play" size={18} />
          <PoolPicker label={tr('pop.to')} current={to} onPick={setTo} />
          <Button disabled={from === to} onClick={() => UI.update((st) => G.transfer(st, from, to, Math.floor(st.pools[from] * 0.5)))}>{tr('pop.move')}</Button>
        </div>
      </div>
    </Sheet>
  );
}
