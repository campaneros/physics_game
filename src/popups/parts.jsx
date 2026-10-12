// Pezzi comuni dei popup: intestazione, tessere, chip con icona, riga dei vantaggi di un potenziamento.
import { Physics as PH, Processes as PR, UI, tr } from '../engine.js';
import { Icon } from '../ds/icons.jsx';

export const projectName = (key) => (key.startsWith('det:') ? tr(`sub.${key.slice(4)}`) : tr(`proj.name.${key}`));
export const projectIcon = (key) => (key.startsWith('det:') ? key.slice(4) : key === 'energy' ? 'bolt' : key === 'lumi' ? 'sun' : 'ring');
export const shortName = (id) => tr(`proc.${id}`).split(' (')[0];
const namesList = (names) => `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`;

export function Sheet({ title, icon, children }) {
  return (
    <div className="sheet">
      <div className="sheet-head">
        <h2><Icon name={icon} size={24} /> {title}</h2>
        <button type="button" className="x ds-ibtn" aria-label={tr('pop.close')} onClick={() => UI.closeOverlay()}><Icon name="close" size={20} /></button>
      </div>
      {children}
    </div>
  );
}

// Voce di elenco/scelta: icona, nome, dettaglio e, a destra, costi o stato.
export function Tile({ icon, name, sub, side, selected, disabled, onClick, className = '' }) {
  return (
    <button type="button" className={`tile ${className}`.trim()} aria-pressed={selected} aria-label={name} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={28} />
      <span className="grow"><strong>{name}</strong>{sub}</span>
      {side}
    </button>
  );
}

export const Side = ({ children }) => <span className="side">{children}</span>;

export function ChipI({ icon, bad, children }) {
  return <span className={`chip-i${bad ? ' bad' : ''}`}><Icon name={icon} size={16} />{children}</span>;
}

const GainRow = ({ icon, text }) => <small className="gain-i"><Icon name={icon} size={14} /> {text}</small>;

// Cosa ottieni da un livello in più di un sottosistema: bersagli che sblocca, miglioramento di risoluzione ed efficienza.
export function GainLine({ s, k }) {
  const g = PH.upgradeSummary(s, k);
  const rows = [];
  if (k === 'daq') rows.push(['bolt', tr('gain.daq', { bw: g.bw, slot: g.slot ? tr('gain.slot') : '' })]);
  if (g.unlocks.length) rows.push(['lock', tr('gain.unlocks', { names: namesList(g.unlocks.map(shortName)) })]);
  if (g.n) rows.push(['check', tr('gain.better', { n: g.n, res: Math.round(g.res * 100), eff: Math.round(g.eff * 100) })]);
  if (!rows.length) rows.push(['clock', tr('gain.none')]);
  return <span className="gain">{rows.map(([icon, text]) => <GainRow key={text} icon={icon} text={text} />)}</span>;
}

// Cosa ottieni da un progetto: bersagli sbloccati o miglioramenti (stesso linguaggio di GainLine).
export function ProjectGain({ s, kind, target }) {
  if (kind === 'det') return <GainLine s={s} k={target} />;
  const rows = [];
  if (kind === 'lumi') rows.push(['sun', tr('gain.lumi', { x: PH.LUMI_GROWTH })]);
  if (kind === 'energy') {
    const next = PR.COLLIDERS[s.collider].energies[s.energyLvl + 1];
    const opened = PR.PROCESSES.filter((q) => !(q.id in s.done) && q.thr[s.collider] > PH.energy(s) && q.thr[s.collider] <= next).map((q) => shortName(q.id));
    rows.push(['bolt', tr('gain.energy')]);
    if (opened.length) rows.push(['lock', tr('gain.unlocks', { names: namesList(opened) })]);
  }
  return <span className="gain">{rows.map(([icon, text]) => <GainRow key={text} icon={icon} text={text} />)}</span>;
}
