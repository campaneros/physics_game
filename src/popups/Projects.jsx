import { useState } from 'react';
import { Game as G, Physics as PH, Processes as PR, UI, tr } from '../engine.js';
import { useSnapshot } from '../store.js';
import { Button, Meter, Pips } from '../ds/primitives.jsx';
import { Icon } from '../ds/icons.jsx';
import { Popups } from './api.js';
import { ChipI, GainLine, ProjectGain, Side, Sheet, Tile, projectIcon, projectName } from './parts.jsx';

const fmt = UI.fmt;

function ProjectTile({ s, kind, target }) {
  const key = kind === 'det' ? `det:${target}` : kind;
  const pj = s.projects[key];
  const spec = G.projectSpec(s, kind, target);
  if (!pj && !spec) return null;
  let sub;
  if (pj) {
    sub = <><Meter value={pj.spent / pj.cost} /><small className="muted">{pj.state === 'ready' ? tr('proj.ready') : `${tr(`proj.${pj.risk}`)}${pj.fast ? ' ⚡' : ''}${pj.stall > s.t ? ' ⏸' : ''}`}</small></>;
  } else {
    const note = kind === 'energy' ? `${fmt(PH.energy(s))} → ${fmt(PR.COLLIDERS[s.collider].energies[s.energyLvl + 1])} GeV` : kind === 'lumi' ? `${fmt(PH.lumiRate(s))} → ${fmt(PH.lumiRate(s) * PH.LUMI_GROWTH)} fb⁻¹/${tr('unit.year')}` : '';
    sub = <>{kind === 'det' && <GainLine s={s} k={target} />}<small className="muted">{note}</small></>;
  }
  const cost = pj ? pj.cost : spec.cost;
  const years = pj ? pj.years : spec.years;
  const onClick = pj
    ? () => { if (pj.state === 'ready') { UI.closeOverlay(); Popups.construction(kind === 'det' ? [target] : kind === 'collider' ? ['collider'] : []); } }
    : () => Popups.projectStart(kind, target);
  return <Tile icon={projectIcon(key)} name={projectName(key)} sub={sub} side={<Side><ChipI icon="coin">{fmt(cost)}</ChipI><ChipI icon="clock">{years.toFixed(1)}</ChipI></Side>} selected={!!pj} disabled={!!pj && pj.state === 'dev'} onClick={onClick} />;
}

// Elenco dei progetti: quelli in corso con avanzamento, quelli avviabili con costo e tempo.
export function Projects() {
  const s = useSnapshot();
  const keys = [['energy', null], ['lumi', null], ...PR.DETECTOR.subsystems.filter((k) => s.det[k] >= 1).map((k) => ['det', k]), ['collider', null]];
  const tiles = keys.map(([kind, target]) => <ProjectTile key={`${kind}${target}`} s={s} kind={kind} target={target} />);
  const any = keys.some(([kind, target]) => { const key = kind === 'det' ? `det:${target}` : kind; return s.projects[key] || G.projectSpec(s, kind, target); });
  return (
    <Sheet title={tr('pop.projects')} icon="bolt">
      <div className="cards">{any ? tiles : <p className="muted">{tr('proj.none')}</p>}</div>
    </Sheet>
  );
}

function RiskChoice({ spec, r, fast, selected, onPick }) {
  const years = (spec.years * G.RISKS[r].years / (fast ? G.FAST.rate : 1)).toFixed(1);
  return (
    <button type="button" className="tile col" aria-pressed={selected} onClick={() => onPick(r)}>
      <strong>{tr(`proj.${r}`)}</strong>
      <ChipI icon="clock">{years}</ChipI>
      <Pips value={Math.round(G.RISKS[r].p * 10)} max={10} />
    </button>
  );
}

// Avvio di un progetto: via prudente o audace, corsia veloce.
export function ProjectStart({ kind, target }) {
  const s = useSnapshot();
  const [risk, setRisk] = useState('safe');
  const [fast, setFast] = useState(false);
  const key = kind === 'det' ? `det:${target}` : kind;
  const spec = G.projectSpec(s, kind, target);
  const cost = spec ? Math.ceil(spec.cost * (fast ? G.FAST.cost : 1)) : 0;
  const years = spec ? (spec.years * G.RISKS[risk].years) / (fast ? G.FAST.rate : 1) : 0;
  const full = Object.keys(s.projects).length >= G.MAX_PROJECTS;
  const poor = cost > s.pools.rnd;
  const begin = () => { UI.update((st) => G.startProject(st, kind, target, { risk, fast })); UI.closeOverlay(); };
  return (
    <Sheet title={projectName(key)} icon={projectIcon(key)}>
      <ProjectGain s={s} kind={kind} target={target} />
      {!spec ? <div className="pair"><p className="muted">{tr('proj.none')}</p></div> : (
        <>
          <div className="pair">{['safe', 'bold'].map((r) => <RiskChoice key={r} spec={spec} r={r} fast={fast} selected={risk === r} onPick={setRisk} />)}</div>
          <div className="cards">
            <button type="button" className="tile" aria-pressed={fast} onClick={() => setFast(!fast)}><Icon name="bolt" size={24} /><strong>{tr('proj.fast')}</strong></button>
            {full ? <small className="muted">{tr('proj.limit')}</small> : <small className={poor ? 'warn-text' : 'muted'}>{tr(poor ? 'proj.short' : 'proj.upfront')}</small>}
          </div>
          <div className="foot">
            <Side><ChipI icon="coin" bad={poor}>{`${fmt(cost)} / ${fmt(s.pools.rnd)}`}</ChipI><ChipI icon="clock">{years.toFixed(1)}</ChipI></Side>
            <Button variant="primary" disabled={full || poor} onClick={begin}>{tr('proj.begin')}</Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
