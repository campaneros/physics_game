import { useMemo, useState } from 'react';
import { Budget as B, tr } from '../engine.js';
import { Button, Meter, Panel, Range } from '../ds/primitives.jsx';

const sigma = (gev) => `±${(gev * 1000).toPrecision(3)} MeV`;
const ZERO = B.zero();

function Row({ item, value, done, onChange }) {
  const name = tr(`bg.item.${item.id}.name`);
  return (
    <div className="bg-row">
      <div className="bg-head"><strong>{name}</strong><span>{value}</span></div>
      <Range min={0} max={B.BUDGET} step={B.STEP} value={value} disabled={done} aria-label={name} onInput={(v) => onChange(item.id, v)} />
      <small className="muted">{tr(`bg.item.${item.id}.desc`)}</small>
    </div>
  );
}

function Result({ sc, alloc, pts, rewardText, onNew }) {
  const [shareLabel, setShareLabel] = useState(null);
  const m = B.measure(sc, alloc);
  const best = B.ITEMS.map((i) => `${tr(`bg.item.${i.id}.name`)} ${sc.optimum.alloc[i.id]}`).join(' · ');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sc.seed) ? ` ${sc.seed}` : '';
  const share = async () => {
    const text = tr('bg.share', { day, pts });
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setShareLabel(tr('share.done'));
    } catch (err) {
      setShareLabel(err && err.name === 'AbortError' ? null : tr('share.fail'));
    }
    setTimeout(() => setShareLabel(null), 1500);
  };
  return (
    <Panel tone="deep" className="bg-result">
      <p className="bg-score">{tr('bg.score', { p: sigma(m.total), pts })}</p>
      <p className="muted">{tr('bg.optimum', { o: sigma(sc.optimum.total), alloc: best })}</p>
      {rewardText && <p className="bg-reward">{rewardText}</p>}
      <div className="row">
        <Button onClick={share}>{shareLabel || tr('share.btn')}</Button>
        {onNew && <Button onClick={onNew}>{tr('bg.newscenario')}</Button>}
      </div>
    </Panel>
  );
}

// Modalità budget: distribuisci il budget tra le voci, simula e pubblica. Props: seed, label, onNew(), onPublish(resId, pts) → testo del premio.
export function BudgetGame({ seed, label, onNew, onPublish }) {
  const sc = useMemo(() => B.scenario(seed), [seed]);
  const [alloc, setAlloc] = useState(ZERO);
  const [log, setLog] = useState([]);
  const [published, setPublished] = useState(null);
  const done = published !== null;
  const left = B.BUDGET - B.spent(alloc);

  const change = (id, raw) => {
    if (done) return;
    const room = B.BUDGET - B.spent(alloc) + alloc[id];
    setAlloc({ ...alloc, [id]: Math.min(raw, room) });
  };
  const simulate = () => {
    if (done || log.length >= B.MAX_SIMS) return;
    const m = B.measure(sc, alloc);
    setLog([...log, tr('bg.logline', { s: sigma(m.stat), y: sigma(m.syst), t: sigma(m.total) })]);
  };
  const publish = () => {
    if (done) return;
    const pts = B.score(sc, alloc);
    setPublished({ pts, rewardText: (onPublish && onPublish(sc.resonance, pts)) || '' });
  };

  return (
    <div className="bg">
      <h2>{tr('bg.title', { res: tr(`res.${sc.resonance}`) })}</h2>
      <p className="muted">{tr('bg.intro', { label, budget: B.BUDGET, sims: B.MAX_SIMS })}</p>
      <Panel tone="deep">
        <p className="bg-remaining">{tr('bg.remaining', { left, total: B.BUDGET })}</p>
        <Meter value={left / B.BUDGET} tone="gold" label={tr('bg.remaining', { left, total: B.BUDGET })} />
      </Panel>
      {B.ITEMS.map((item) => <Row key={item.id} item={item} value={alloc[item.id]} done={done} onChange={change} />)}
      <div className="row">
        <Button disabled={done || log.length >= B.MAX_SIMS} onClick={simulate}>{tr('bg.sim', { n: B.MAX_SIMS - log.length })}</Button>
        <Button variant="primary" disabled={done} onClick={publish}>{tr('bg.publish')}</Button>
      </div>
      <ol className="bg-log">{log.map((line, i) => <li key={i}>{line}</li>)}</ol>
      {done && <Result sc={sc} alloc={alloc} pts={published.pts} rewardText={published.rewardText} onNew={onNew} />}
    </div>
  );
}
