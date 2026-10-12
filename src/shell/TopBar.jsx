import { Game, Physics, UI, tr } from '../engine.js';
import { Popups } from '../popups/api.js';
import { useGame } from '../store.js';
import { Icon } from '../ds/icons.jsx';
import { IconButton } from '../ds/primitives.jsx';

const energyText = (s) => {
  const e = Physics.energy(s);
  return e >= 1000 ? `${(e / 1000).toFixed(1)} TeV` : `${UI.fmt(e)} GeV`;
};

// Un valore della barra: l'animazione "pop" riparte quando il testo cambia (key).
function Stat({ id, icon, label, value, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="hud-i" {...(onClick ? { type: 'button', id: 'hud-dev', onClick } : { role: 'group' })} aria-label={label}>
      <Icon name={icon} size={22} />
      <b id={id} key={value} className="ds-pop">{value}</b>
    </Tag>
  );
}

export function TopBar() {
  const funds = useGame((s) => UI.fmt(s.pools.rnd));
  const year = useGame((s) => s.t.toFixed(1));
  const energy = useGame(energyText);
  const rep = useGame((s) => Game.repTotal(s).toFixed(1));
  return (
    <header className="top">
      <div className="topbar">
        <IconButton id="help" icon="help" aria-label={tr('help.aria')} onClick={() => Popups.help()} />
        <div className="hud">
          <Stat id="hud-funds" icon="coin" label={tr('hud.funds')} value={funds} onClick={() => Popups.budget()} />
          <Stat id="hud-year" icon="clock" label={tr('hud.year')} value={year} />
          <Stat id="hud-energy" icon="bolt" label={tr('hud.energy')} value={energy} />
          <Stat id="hud-rep" icon="star" label={tr('hud.rep')} value={rep} />
        </div>
        <button id="lang" type="button" className="ds-ibtn ds-lang" onClick={UI.switchLang}>{tr('lang.switch')}</button>
      </div>
      <h1 className="sr">{tr('app.title')}</h1>
    </header>
  );
}
