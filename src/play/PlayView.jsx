import { useEffect, useRef } from 'react';
import { Minigame, UI, tr } from '../engine.js';
import { useTab } from '../store.js';

// Sfida "La forma nascosta": il minigioco (canvas e puntatore) resta nel suo modulo, qui solo il ciclo di vita.
// Parte da una partita libera; la sfida del giorno (stesso seed per tutti) è un'alternativa.
export function PlayView() {
  const tab = useTab();
  const host = useRef(null);
  const game = useRef(null);

  useEffect(() => {
    if (tab !== 'play' || game.current) return;
    const mount = (seed, label) => {
      if (game.current) game.current.destroy();
      const daily = seed === UI.utcDay();
      game.current = Minigame.create(host.current, {
        seed, label, shareLabel: tr('share.btn'),
        onNew: () => mount(UI.randomSeed(), tr('mode.free')),
        onAlt: daily ? () => mount(UI.randomSeed(), tr('mode.free')) : () => mount(UI.utcDay(), tr('mode.daily')),
        altLabel: daily ? tr('mode.free') : tr('mode.daily'),
        onFinish: (r) => UI.claimReward('shape', r.score, seed),
      });
    };
    mount(UI.randomSeed(), tr('mode.free'));
  }, [tab]);
  useEffect(() => () => { if (game.current) game.current.destroy(); }, []);

  return <div id="play-host" ref={host} />;
}
