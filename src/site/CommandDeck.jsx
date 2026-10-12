import { Game, Processes, Popups, UI, tr } from '../engine.js';
import { useGame } from '../store.js';
import { ActionButton } from '../ds/primitives.jsx';

const programOf = (s) => (s.program ? Processes.BY_ID.get(s.program) : null);
const buildBadge = (s) => (s.built ? String(Object.values(s.projects).filter((q) => q.state === 'ready').length || s.shutdowns) : '+');

// Riga di 4 azioni sotto la scena: costruisci, progetti, budget, corsa.
export function CommandDeck() {
  const build = useGame(buildBadge);
  const proj = useGame((s) => `${Object.keys(s.projects).length}/${Game.MAX_PROJECTS}`);
  const budget = useGame((s) => UI.fmt(Game.annualBudget(s)));
  const budgetWarn = useGame((s) => s.pools.ops < Game.runCost(s, 1));
  const run = useGame((s) => (s.run ? '▶' : UI.fmt(Game.runCost(s, 1))));
  const runWarn = useGame((s) => { const p = programOf(s); return !s.run && !(p && Game.canRun(s, p.id)); });

  const actions = [
    { kind: 'c-build', tone: 'slate', icon: 'wrench', key: 'act.build', badge: build, onClick: () => Popups.construction() },
    { kind: 'c-proj', tone: 'amber', icon: 'bolt', key: 'act.projects', badge: proj, onClick: () => Popups.projects() },
    { kind: 'c-budget', tone: 'green', icon: 'coin', key: 'act.budget', badge: budget, warn: budgetWarn, onClick: () => Popups.budget() },
    { kind: 'c-run', tone: 'red', icon: 'play', key: 'act.run', badge: run, warn: runWarn, onClick: () => Popups.run() },
  ];
  return (
    <div className="deck">
      {actions.map((a) => (
        <ActionButton
          key={a.kind}
          className={`cardbtn ${a.kind}`}
          tone={a.tone}
          icon={a.icon}
          label={tr(a.key)}
          labelClass="ctitle"
          badge={a.badge}
          warn={a.warn}
          aria-label={tr(a.key)}
          onClick={a.onClick}
        />
      ))}
    </div>
  );
}
