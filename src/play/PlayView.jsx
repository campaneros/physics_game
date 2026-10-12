import { useState } from 'react';
import { UI, tr } from '../engine.js';
import { Minigame } from '../minigame/Minigame.jsx';
import { useTab } from '../store.js';

const freeRound = (n) => ({ n, seed: UI.randomSeed(), label: tr('mode.free') });
const dailyRound = (n) => ({ n, seed: UI.utcDay(), label: tr('mode.daily') });

// Sfida "La forma nascosta": parte da una partita libera (forma casuale); la sfida del giorno (stesso seed per tutti) è un'alternativa.
// Il minigioco si monta alla prima visita, quando il suo contenitore ha una misura.
export function PlayView() {
  const tab = useTab();
  const [round, setRound] = useState(null);
  if (tab === 'play' && !round) setRound(freeRound(0));
  const daily = round && round.seed === UI.utcDay();
  return (
    <div id="play-host">
      {round && (
        <Minigame
          key={round.n}
          seed={round.seed}
          label={round.label}
          shareLabel={tr('share.btn')}
          onNew={() => setRound(freeRound(round.n + 1))}
          onAlt={() => setRound(daily ? freeRound(round.n + 1) : dailyRound(round.n + 1))}
          altLabel={daily ? tr('mode.free') : tr('mode.daily')}
          onFinish={(r) => UI.claimReward('shape', r.score, round.seed)}
        />
      )}
    </div>
  );
}
