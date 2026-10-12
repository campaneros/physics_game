import { Game as G, Physics as PH, Processes as PR, tr } from '../engine.js';
import { Meter, Panel } from '../ds/primitives.jsx';
import { outcome } from './TargetList.jsx';

// Riepilogo a colpo d'occhio: quanti bersagli sono stati scoperti/misurati, preceduti o chiusi con un limite, e cosa sta prendendo dati.
export function ProgressBar({ s }) {
  const total = PR.PROCESSES.length;
  const counts = { 'is-discovered': 0, 'is-scooped': 0, 'is-limit': 0 };
  let measured = 0;
  for (const p of PR.PROCESSES) {
    const d = s.done[p.id];
    if (!d) continue;
    const { cls } = outcome(p, d);
    if (cls === 'is-discovered' && p.kind === 'measure') measured++;
    else counts[cls]++;
  }
  const closed = Object.keys(s.done).length;
  const ids = G.programsOf(s);
  const names = ids.map((id) => tr(`proc.${id}`).split(' (')[0]).join(', ');
  return (
    <Panel tone="deep" className="progress">
      <div className="foot">
        <small>{tr('physics.progress', { d: counts['is-discovered'], m: measured, s: counts['is-scooped'], l: counts['is-limit'] })}</small>
        <b>{`${closed}/${total}`}</b>
      </div>
      <Meter value={closed / total} tone="green" label={`${closed}/${total}`} />
      <small className="muted">{ids.length ? tr('physics.active', { names, n: ids.length, max: PH.slots(s) }) : tr('physics.active.none', { max: PH.slots(s) })}</small>
    </Panel>
  );
}
