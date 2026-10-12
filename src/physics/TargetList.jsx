import { Game as G, Physics as PH, Processes as PR, UI, tr } from '../engine.js';
import { Icon } from '../ds/icons.jsx';

// Esito di un bersaglio chiuso: scoperta/misura riuscita, preceduta da un rivale, oppure solo un limite di esclusione.
export function outcome(p, d) {
  if (d.limit) return { key: 'state.limit', cls: 'is-limit' };
  if (d.scooped) return { key: 'state.scooped', cls: 'is-scooped' };
  return { key: p.kind === 'measure' ? 'state.measured' : 'state.discovered', cls: 'is-discovered' };
}

function stateKey(s, p) {
  const d = s.done[p.id];
  if (d) return outcome(p, d).key;
  if (!G.isAvail(s, p.id)) return 'state.locked';
  const j = s.jobs[p.id];
  if (j) return j.state === 'confirm' ? 'state.confirm' : 'state.analysis';
  return G.programsOf(s).includes(p.id) ? 'state.running' : 'state.available';
}

const CHECK_ICON = { 'is-discovered': 'check', 'is-scooped': 'clock', 'is-limit': 'cross' };

function Target({ s, p, selected, onPick }) {
  const locked = !G.isAvail(s, p.id) && !(p.id in s.done);
  const d = s.done[p.id];
  const res = d ? outcome(p, d) : null;
  const running = G.programsOf(s).includes(p.id);
  const slots = PH.slots(s);
  const canToggle = slots > 1 && !d && !locked;
  const full = !running && G.programsOf(s).length >= slots;
  return (
    <div className="target-wrap">
      <button type="button" className={`target${selected ? ' sel' : ''}${res ? ` ${res.cls}` : ''}${running ? ' is-running' : ''}`} disabled={locked} onClick={() => onPick(p.id)}>
        <strong>{tr(`proc.${p.id}`)}</strong>
        <span className="tag">
          {locked && <Icon name="lock" size={12} />}
          {res && <Icon name={CHECK_ICON[res.cls]} size={13} />}
          {tr(stateKey(s, p))}
        </span>
      </button>
      {canToggle && (
        <button type="button" className="slot-toggle" aria-pressed={running} disabled={full} aria-label={tr(running ? 'physics.removeprog' : 'physics.addprog')} onClick={() => UI.update((st) => G.toggleProgram(st, p.id))}>
          <Icon name={running ? 'check' : 'plus'} size={16} />
        </button>
      )}
    </div>
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
