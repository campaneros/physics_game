// Vetrina del design system: `npm run ds`. Serve a controllare a colpo d'occhio tutti i componenti.
import { Defs, Backdrop } from './Defs.jsx';
import { ICON_NAMES, Icon } from './icons.jsx';
import { ActionButton, Badge, Button, Check, IconButton, MapNode, Meter, Panel, Pips, Tip } from './primitives.jsx';

export function Gallery() {
  return (
    <>
      <Defs />
      <Backdrop />
      <main className="gallery">
        <Panel title="Buttons" tone="deep">
          <div className="gallery__row">
            <Button variant="primary" icon="play">Start data taking</Button>
            <Button>Secondary</Button>
            <Button variant="gold" icon="coin">Fund</Button>
            <Button variant="danger" icon="cross">Cancel</Button>
            <Button disabled>Disabled</Button>
            <IconButton icon="help" aria-label="Help" />
          </div>
        </Panel>
        <Panel title="Action buttons" tone="deep">
          <div className="gallery__row gallery__row--actions">
            <ActionButton tone="slate" icon="wrench" label="Build" badge="+" />
            <ActionButton tone="amber" icon="bolt" label="Projects" badge="0/3" />
            <ActionButton tone="green" icon="coin" label="Budget" badge="1.00K" />
            <ActionButton tone="red" icon="play" label="Run" badge="52" warn />
          </div>
        </Panel>
        <Panel title="Pips, badges, meters" tone="deep">
          <div className="gallery__row">
            <Pips value={3} max={4} />
            <Badge>1.00K</Badge><Badge tone="blue">3/5</Badge><Badge tone="green">ok</Badge><Badge tone="red">!</Badge>
            <Tip text="Pop-up hint"><Button>Hover me</Button></Tip>
          </div>
          <Meter value={0.72} label="Signal" />
          <Meter value={0.4} tone="red" label="Background" />
          <Meter value={0.9} tone="gold" label="Budget" />
        </Panel>
        <Panel title="Checklist and map" tone="deep">
          <ul className="gallery__list"><Check ok>Beam energy ≥ 2 GeV</Check><Check>Muon system level 2</Check></ul>
          <div className="gallery__row"><MapNode state="done" icon="check" label="Done" /><MapNode state="current" icon="atom" label="Current" /><MapNode state="next" icon="flask" label="Next" /><MapNode state="locked" label="Locked" /></div>
        </Panel>
        <Panel title="Icons" tone="deep">
          <div className="gallery__row">{ICON_NAMES.map((n) => <span key={n} className="gallery__icon" title={n}><Icon name={n} size={30} /></span>)}</div>
        </Panel>
      </main>
    </>
  );
}
