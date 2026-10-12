import { Game as G, Minigame, Physics as PH, Processes as PR, UI, Popups, tr } from '../engine.js';
import { Icon } from '../ds/icons.jsx';
import { Button, Chip, Meter, Panel } from '../ds/primitives.jsx';

const STRATS = Object.keys(PH.STRATEGIES);

// Scelta di strategia, tagli e opzioni; l'analisi parte solo con dati, fondi e (oltre il tutorial) almeno un taglio.
export function AnalysisCard({ s, p, e, L, sel, onSel }) {
  const id = p.id;
  const opts = { blind: sel.blind, valid: sel.valid };
  const guided = p.tier === 0;
  const chosen = guided ? PH.goodCuts(p) : sel.cuts[id] || [];
  const pl = PH.plan(sel.strategy, opts, p);
  const cost = G.analysisCost(s, p, sel.strategy, opts);
  const ready = L > 0 && e.ok;
  const toggleCut = (c) => {
    const cur = sel.cuts[id] || [];
    const next = cur.includes(c) ? cur.filter((x) => x !== c) : cur.length < PR.MAX_CUTS ? [...cur, c] : cur;
    onSel({ ...sel, lastCut: c, cuts: { ...sel.cuts, [id]: next } });
  };
  return (
    <Panel>
      <div className="foot">
        <h3>{tr('an.title')}</h3>
        <button type="button" className="fund-chip" aria-label={tr('an.fund')} onClick={() => Popups.budget()}><Icon name="flask" size={16} /><b>{UI.fmt(s.pools.analysis)}</b></button>
      </div>
      <small className="muted">{tr('an.explain')}</small>
      {guided && <small className="tutorial">{tr('an.tutorial')}</small>}
      <div className="chips">
        {STRATS.map((st) => <Chip key={st} pressed={st === sel.strategy} onClick={() => onSel({ ...sel, strategy: st })}>{tr(`an.strategy.${st}`)}</Chip>)}
      </div>
      <small className="muted">{tr(`an.strategy.${sel.strategy}.desc`)}</small>
      <h3>{tr('an.cuts.title')}</h3>
      <small className="muted">{tr(`menu.hint.${p.menu}`)}</small>
      <div className="chips">
        {PR.CUTS.map((c) => (
          <Chip key={c} pressed={chosen.includes(c)} disabled={guided || (!chosen.includes(c) && chosen.length >= PR.MAX_CUTS)} onClick={() => toggleCut(c)}>{tr(`cut.${c}`)}</Chip>
        ))}
      </div>
      <small className="muted">{sel.lastCut ? `${tr(`cut.${sel.lastCut}`)}: ${tr(`cut.${sel.lastCut}.desc`)}` : tr('an.cuts.pick', { n: PR.MAX_CUTS, k: chosen.length })}</small>
      <div className="opts">
        <Chip pressed={sel.blind} onClick={() => onSel({ ...sel, blind: !sel.blind })}>{tr('an.opt.blind')}</Chip>
        <Chip pressed={sel.valid} onClick={() => onSel({ ...sel, valid: !sel.valid })}>{tr('an.opt.valid')}</Chip>
      </div>
      <small className="muted">
        {ready ? `${tr('an.estimate', { min: UI.fmtYears(pl.years), risk: Math.round(pl.prob * 100) })} · ${tr('an.cost', { cost: UI.fmt(cost), have: UI.fmt(s.pools.analysis) })}` : tr('an.nodata')}
      </small>
      <Button
        variant="primary"
        disabled={!ready || s.pools.analysis < cost || (!guided && chosen.length === 0)}
        onClick={() => UI.update((st) => G.startAnalysis(st, id, sel.strategy, opts, sel.cuts[id] || []))}
      >
        {tr('an.start')}
      </Button>
    </Panel>
  );
}

// Conferma della scoperta: il minigioco si apre in un popup.
function openConfirm(id) {
  const p = PR.BY_ID.get(id);
  const tier = PR.TIERS[p.tier];
  UI.showOverlay((body) => {
    const game = Minigame.create(body, {
      seed: UI.randomSeed(), pool: tier.pool, maxLaunches: tier.maxLaunches,
      label: tr('overlay.confirm', { name: tr(`proc.${id}`) }),
      onCancel: () => UI.closeOverlay(),
      onClose: (r) => { UI.closeOverlay(); UI.update((st) => G.confirmDiscovery(st, id, r.score)); },
    });
    return () => game.destroy();
  });
}

export function JobCard({ s, id, j }) {
  const running = j.state === 'run';
  return (
    <Panel>
      <p>{running ? tr('an.running', { strategy: tr(`an.strategy.${j.strategy}`) }) : tr('an.confirm.hint')}</p>
      {running && <Meter value={(s.t - j.start) / (j.end - j.start)} label={tr('an.title')} />}
      <small className="muted">{tr('an.rounds', { n: j.rounds })}</small>
      {!running && <Button variant="primary" onClick={() => openConfirm(id)}>{tr('an.confirm')}</Button>}
    </Panel>
  );
}

export function DoneCard({ p, d }) {
  const main = d.limit ? tr('done.limit') : p.kind === 'measure' ? tr('done.measure', { p: Math.round(d.sigma * 100) }) : tr('done.discovery', { z: d.z.toFixed(1) });
  const reward = d.rep ? ` ${tr('done.reward', { rep: d.rep.toFixed(1), pct: Math.round(d.boost * 100), years: d.years })}` : '';
  return <Panel><p>{`${d.scooped ? `${main} ${tr('done.scooped')}` : main}${reward}`}</p></Panel>;
}
