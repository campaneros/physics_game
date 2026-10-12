import { useState } from 'react';
import { Game as G, Processes as PR, UI, tr } from '../engine.js';
import { useSnapshot } from '../store.js';
import { Button, Meter, Pips } from '../ds/primitives.jsx';
import { Icon } from '../ds/icons.jsx';
import { Popups } from './api.js';
import { ChipI, GainLine, Side, Sheet, Tile } from './parts.jsx';

const COLLIDER_STATS = { pp: { reach: 5, clean: 2, rate: 5, multi: 4 }, ee: { reach: 3, clean: 5, rate: 2, multi: 1 } };
const fmt = UI.fmt;
const MAX = PR.DETECTOR.maxLevel;

function ColliderChoice({ s, c, selected, onPick }) {
  const cost = PR.COLLIDERS[c].cost;
  return (
    <button type="button" className="tile col" aria-pressed={selected} aria-label={`${tr(`collider.${c}`)}: ${tr(`collider.${c}.desc`)}`} onClick={() => onPick(c)}>
      <Icon name="ring" size={30} />
      <strong>{tr(`collider.${c}`)}</strong>
      <ChipI icon="coin" bad={cost > s.pools.rnd}>{cost}</ChipI>
      {Object.entries(COLLIDER_STATS[c]).map(([k, v]) => <span className="stat-row" key={k}><small>{tr(`stat.${k}`)}</small><Pips value={v} max={5} /></span>)}
    </button>
  );
}

function SubsystemTile({ s, k, picked, onToggle }) {
  const lvl = s.det[k];
  const name = tr(`sub.${k}`);
  if (lvl >= MAX) return <Tile icon={k} name={name} sub={<Pips value={lvl} max={MAX} />} disabled />;
  const pj = s.projects[`det:${k}`];
  const ready = lvl === 0 || (pj && pj.state === 'ready');
  if (!ready) {
    return (
      <Tile
        icon={k}
        name={name}
        sub={<><Pips value={lvl} max={MAX} need={lvl + 1} />{pj ? <Meter value={pj.spent / pj.cost} /> : <GainLine s={s} k={k} />}</>}
        side={<Side><Icon name={pj ? 'clock' : 'lock'} size={22} /></Side>}
        disabled={!!pj}
        onClick={() => { if (!pj) Popups.projectStart('det', k); }}
      />
    );
  }
  const plan = G.shutdownPlan(s, [k]);
  return (
    <Tile
      icon={k}
      name={name}
      sub={<><Pips value={lvl} max={MAX} need={lvl + 1} /><GainLine s={s} k={k} /></>}
      side={<Side><ChipI icon="coin" bad={plan.cost > s.pools.rnd}>{fmt(plan.cost)}</ChipI>{plan.instant ? <ChipI icon="bolt">{tr('pop.instant')}</ChipI> : <ChipI icon="clock">{plan.years.toFixed(1)}</ChipI>}</Side>}
      selected={picked.includes(k)}
      disabled={!!s.shutdown}
      onClick={() => onToggle(k)}
    />
  );
}

// Cantiere: costruzione iniziale e installazione dei progetti pronti, tutto in un solo Long Shutdown.
export function Construction({ pre = [] }) {
  const s = useSnapshot();
  const [picked, setPicked] = useState(pre);
  const [collider, setCollider] = useState('pp');
  const toggle = (k) => setPicked(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k]);
  const items = [...(s.built ? [] : ['accelerator']), ...picked];
  const pl = G.shutdownPlan(s, items, collider);
  const short = pl.ok && pl.cost > s.pools.rnd;
  const pj = s.projects.collider;
  const to = s.collider === 'pp' ? 'ee' : 'pp';
  const switchPlan = s.built && pj && pj.state === 'ready' ? G.shutdownPlan(s, ['collider']) : null;
  const start = () => { UI.update((st) => G.startShutdown(st, items, collider)); UI.closeOverlay(); };
  return (
    <Sheet title={tr('pop.build')} icon="wrench">
      <div className="cards">
        {!s.built && (
          <>
            <p className="muted">{tr('pop.choose')}</p>
            <div className="pair">{['pp', 'ee'].map((c) => <ColliderChoice key={c} s={s} c={c} selected={collider === c} onPick={setCollider} />)}</div>
          </>
        )}
        {PR.DETECTOR.subsystems.map((k) => <SubsystemTile key={k} s={s} k={k} picked={picked} onToggle={toggle} />)}
        {switchPlan && (
          <Tile
            icon="ring"
            name={tr('pop.switch', { name: tr(`collider.${to}`) })}
            side={<Side><ChipI icon="coin" bad={switchPlan.cost > s.pools.rnd}>{fmt(switchPlan.cost)}</ChipI><ChipI icon="clock">{switchPlan.years.toFixed(1)}</ChipI></Side>}
            selected={picked.includes('collider')}
            disabled={!!s.shutdown}
            onClick={() => toggle('collider')}
          />
        )}
      </div>
      <div className="foot">
        {short && <small className="warn-text">{tr('pop.short')}</small>}
        <Side>
          <ChipI icon="coin" bad={short}>{`${pl.ok ? fmt(pl.cost) : 0} / ${fmt(s.pools.rnd)}`}</ChipI>
          {pl.ok && (pl.instant ? <ChipI icon="bolt">{tr('pop.instant')}</ChipI> : <ChipI icon="clock">{`${pl.years.toFixed(1)} · ${UI.fmtYears(pl.years)}′`}</ChipI>)}
        </Side>
        <Button variant="primary" disabled={!pl.ok || pl.cost > s.pools.rnd || !!s.shutdown} onClick={start}>{tr('pop.start')}</Button>
      </div>
    </Sheet>
  );
}
