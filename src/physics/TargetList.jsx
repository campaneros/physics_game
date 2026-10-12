import { Game as G, Processes as PR, tr } from '../engine.js';
import { Icon } from '../ds/icons.jsx';

function stateKey(s, p) {
  const d = s.done[p.id];
  if (d) return d.limit ? 'state.limit' : d.scooped ? 'state.scooped' : 'state.done';
  if (!G.isAvail(s, p.id)) return 'state.locked';
  const j = s.jobs[p.id];
  if (j) return j.state === 'confirm' ? 'state.confirm' : 'state.analysis';
  return G.programsOf(s).includes(p.id) ? 'state.running' : 'state.available';
}

function Target({ s, p, selected, onPick }) {
  const locked = !G.isAvail(s, p.id) && !(p.id in s.done);
  return (
    <button type="button" className={`target${selected ? ' sel' : ''}`} disabled={locked} onClick={() => onPick(p.id)}>
      <strong>{tr(`proc.${p.id}`)}</strong>
      <span className="tag">{locked && <Icon name="lock" size={12} />}{tr(stateKey(s, p))}</span>
    </button>
  );
}

// Bersagli di misura: disponibili sempre in vista; completati e bloccati si aprono a richiesta.
export function TargetList({ s, curId, onPick, showDone, showLocked, onToggleDone, onToggleLocked }) {
  const groups = { active: [], done: [], locked: [] };
  for (const p of PR.PROCESSES) groups[p.id in s.done ? 'done' : G.isAvail(s, p.id) ? 'active' : 'locked'].push(p);
  const list = (items, cls) => <div className={cls}>{items.map((p) => <Target key={p.id} s={s} p={p} selected={p.id === curId} onPick={onPick} />)}</div>;
  const fold = (open, text, onClick) => <button type="button" className="fold" onClick={onClick}>{`${open ? '▾' : '▸'} ${text}`}</button>;
  return (
    <>
      {groups.active.length > 0 && list(groups.active, 'targets')}
      {groups.done.length > 0 && fold(showDone, tr('physics.done.count', { n: groups.done.length, total: PR.PROCESSES.length }), onToggleDone)}
      {showDone && groups.done.length > 0 && list(groups.done, 'targets wrap')}
      {groups.locked.length > 0 && fold(showLocked, tr('physics.locked.count', { n: groups.locked.length }), onToggleLocked)}
      {showLocked && groups.locked.length > 0 && list(groups.locked, 'targets wrap')}
    </>
  );
}
