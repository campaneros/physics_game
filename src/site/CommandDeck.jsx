import { Game, Processes, Popups, UI, tr } from '../engine.js';
import { useGame } from '../store.js';
import { Card } from '../ds/primitives.jsx';
import { Icon } from '../ds/icons.jsx';

const FAN = [-7, -2.5, 2.5, 7]; // inclinazione delle carte a ventaglio

const programOf = (s) => (s.program ? Processes.BY_ID.get(s.program) : null);
const buildBadge = (s) => (s.built ? String(Object.values(s.projects).filter((q) => q.state === 'ready').length || s.shutdowns) : '+');

// Mano di 4 carte sotto la scena: costruisci, progetti, budget, corsa. Il badge è il numero che serve a colpo d'occhio.
export function CommandDeck() {
  const build = useGame(buildBadge);
  const proj = useGame((s) => `${Object.keys(s.projects).length}/${Game.MAX_PROJECTS}`);
  const budget = useGame((s) => UI.fmt(Game.annualBudget(s)));
  const budgetWarn = useGame((s) => s.pools.ops < Game.runCost(s, 1));
  const run = useGame((s) => (s.run ? '▶' : UI.fmt(Game.runCost(s, 1))));
  const runWarn = useGame((s) => { const p = programOf(s); return !s.run && !(p && Game.canRun(s, p.id)); });

  const cards = [
    { kind: 'c-build', art: 'wrench', key: 'act.build', badge: build, onClick: () => Popups.construction() },
    { kind: 'c-proj', art: 'bolt', key: 'act.projects', badge: proj, onClick: () => Popups.projects() },
    { kind: 'c-budget', art: 'coin', key: 'act.budget', badge: budget, warn: budgetWarn, onClick: () => Popups.budget() },
    { kind: 'c-run', art: 'play', key: 'act.run', badge: run, warn: runWarn, onClick: () => Popups.run() },
  ];
  return (
    <div className="hand">
      {cards.map((c, i) => (
        <Card
          key={c.kind}
          className={`cardbtn ${c.kind}${c.warn ? ' warn' : ''}`}
          rarity={c.warn ? 'epic' : 'rare'}
          title={tr(c.key)}
          titleClass="ctitle"
          art={<Icon name={c.art} size={44} />}
          cost={c.badge}
          aria-label={tr(c.key)}
          onClick={c.onClick}
          style={{ '--rot': `${FAN[i]}deg`, '--lift': `${Math.abs(FAN[i]) * 1.4}px` }}
        />
      ))}
    </div>
  );
}
