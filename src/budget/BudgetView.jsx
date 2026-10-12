import { useState } from 'react';
import { Game, UI, tr } from '../engine.js';
import { useGame } from '../store.js';
import { Panel } from '../ds/primitives.jsx';
import { BudgetGame } from './BudgetGame.jsx';

// Si parte dallo scenario del giorno; "nuovo scenario" ne estrae uno libero. Il premio passa da UI.claimReward.
export function BudgetView() {
  const open = useGame(Game.unlockedBudget);
  const [round, setRound] = useState({ n: 0, seed: UI.utcDay(), label: tr('mode.daily') });
  const next = () => setRound({ n: round.n + 1, seed: UI.randomSeed(), label: tr('mode.freescenario') });
  return (
    <>
      {!open && <Panel id="budget-lock">{tr('budget.note.locked')}</Panel>}
      <div id="budget-host">
        {open && <BudgetGame key={round.n} seed={round.seed} label={round.label} onNew={next} onPublish={(resId, pts) => UI.claimReward('budget', pts, round.seed)} />}
      </div>
    </>
  );
}
