import { Game as G, Physics as PH, UI, tr } from '../engine.js';
import { Popups } from '../popups/api.js';
import { Button, Check, Panel } from '../ds/primitives.jsx';
import { AnalysisCard, DoneCard, JobCard } from './Analysis.jsx';
import { DetectorMatrix } from './DetectorMatrix.jsx';
import { outcome } from './TargetList.jsx';
import { Histogram } from './Histogram.jsx';
import { TriggerControls } from './TriggerControls.jsx';

const fmt = UI.fmt;

function Requirements({ s, p }) {
  return (
    <ul className="req">
      <Check ok={G.energyOk(s, p.id)}>{tr('req.energy', { need: fmt(p.thr[s.collider]), now: fmt(PH.energy(s)) })}</Check>
      {Object.entries(p.need).map(([k, lvl]) => <Check key={k} ok={s.det[k] >= lvl}>{tr('req.sub', { name: tr(`sub.${k}`), need: lvl, now: s.det[k] })}</Check>)}
    </ul>
  );
}

// Aggiungi/togli il bersaglio dalla presa dati: i posti dipendono dal collider (adroni = più misure insieme).
function ProgramToggle({ s, id }) {
  const ids = G.programsOf(s);
  const inList = ids.includes(id);
  const maxSlots = PH.slots(s);
  const label = inList ? tr('physics.removeprog') : ids.length >= maxSlots ? tr('physics.full') : tr('physics.addprog');
  return (
    <>
      <Button variant={inList ? 'secondary' : 'primary'} disabled={!inList && ids.length >= maxSlots} onClick={() => UI.update((st) => G.toggleProgram(st, id))}>{label}</Button>
      <small className="muted">{tr(s.collider === 'pp' ? 'physics.slots.pp' : 'physics.slots.ee', { n: ids.length, max: maxSlots })}</small>
    </>
  );
}

// Esito in evidenza: chiaro a colpo d'occhio se il bersaglio è stato scoperto/misurato o no.
function StatusBanner({ s, p }) {
  const d = s.done[p.id];
  if (d) {
    const res = outcome(p, d);
    return <div className={`status ${res.cls}`} role="status">{tr(res.key)}</div>;
  }
  return <div className="status is-todo" role="status">{tr(p.kind === 'measure' ? 'status.todo.measure' : 'status.todo.discovery')}</div>;
}

function FasterCollider({ p }) {
  const c = PH.fasterCollider(p);
  if (!c || c === 'same') return null;
  return <p className="muted">{tr('physics.fastercol', { name: tr(`collider.${c}`) })}</p>;
}

export function TargetPanel({ s, p, sel, onSel }) {
  const id = p.id;
  const d = s.done[id];
  const j = s.jobs[id];
  const L = G.dataOf(s, id);
  const cfg = G.cfgOf(s, id);
  const e = PH.evaluate(s, p, cfg, L, sel.valid ? PH.SYST_VALID : 1);
  const avail = G.isAvail(s, id);
  const stat = [tr('physics.data', { L: fmt(L) })];
  if (d) stat.push(p.kind === 'measure' ? tr('physics.sigma', { p: Math.round(d.sigma * 100), g: Math.round(p.goal * 100) }) : tr('physics.z', { z: d.z.toFixed(1) }));
  const note = d ? '' : s.program !== id ? tr('physics.idle') : !G.canRun(s, id) ? tr('physics.nodata') : !s.run ? tr('physics.norun') : '';
  const f = G.rivalFraction(s, id);
  return (
    <Panel className="panel">
      <h2>{tr(`proc.${id}`)}</h2>
      <StatusBanner s={s} p={p} />
      <p className="muted">{tr(`kind.${p.kind}`)}</p>
      <p className="muted">{tr(`hint.${p.type}`)}</p>
      {!d && <FasterCollider p={p} />}
      <Requirements s={s} p={p} />
      {!d && <DetectorMatrix s={s} p={p} e={e} />}
      {!d && avail && <ProgramToggle s={s} id={id} />}
      <p className="stat">{stat.join(' · ')}</p>
      {note && <p className="muted">{note}</p>}
      {!d && avail && <p className="muted">{tr(f < 0.5 ? 'an.rival.low' : f < 0.85 ? 'an.rival.mid' : f < 1 ? 'an.rival.high' : 'an.rival.done')}</p>}
      {!d && avail && <Button variant="primary" icon="play" onClick={() => Popups.run()}>{tr('act.run')}</Button>}
      <Histogram s={s} p={p} d={d} cfg={cfg} L={L} />
      {!d && <TriggerControls s={s} p={p} cfg={cfg} e={e} />}
      {!d && !j && <AnalysisCard s={s} p={p} e={e} L={L} sel={sel} onSel={onSel} />}
      {j && <JobCard s={s} id={id} j={j} />}
      {d && <DoneCard p={p} d={d} />}
    </Panel>
  );
}
