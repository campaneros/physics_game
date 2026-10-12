import { Physics as PH, Processes as PR, tr } from '../engine.js';
import { Icon } from '../ds/icons.jsx';
import { Pips } from '../ds/primitives.jsx';

// "Detector: cosa aiuta questa misura": un livello in più migliora efficienza e risoluzione.
export function DetectorMatrix({ s, p, e }) {
  const rows = Object.keys(PH.relevant(p));
  return (
    <div className="detbox">
      <h3>{tr('physics.detector')}</h3>
      {rows.map((k) => {
        const need = p.need[k] || 0;
        const role = need ? tr(s.det[k] >= need ? 'physics.role.ok' : 'physics.role.need', { n: need }) : tr('physics.role.help');
        return (
          <div className="req-row" key={k}>
            <Icon name={k} size={20} />
            <strong>{tr(`sub.${k}`)}</strong>
            <Pips value={s.det[k]} max={PR.DETECTOR.maxLevel} need={need} />
            <small className="muted">{role}</small>
          </div>
        );
      })}
      {e.ok && <small className="muted">{tr('physics.deteff', { eff: Math.round(e.d.eff * 100), res: (e.d.res * 100).toFixed(1), xs: e.xs.toFixed(2) })}</small>}
    </div>
  );
}
