// Vetrina del design system: apri index.html#ds. Serve a controllare a colpo d'occhio tutti i componenti.
import { Defs, Backdrop } from './Defs.jsx';
import { ICON_NAMES, Icon } from './icons.jsx';
import { Badge, Button, Card, Check, IconButton, MapNode, Meter, Panel, Pips, Relic, Tip } from './primitives.jsx';

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
        <Panel title="Cards and rarity" tone="deep">
          <div className="gallery__row gallery__row--cards">
            <Card title="Common" art="wrench" cost="1" rarity="common">Common card text.</Card>
            <Card title="Uncommon" art="bolt" cost="2" rarity="uncommon" badge="0/3">Blue frame.</Card>
            <Card title="Rare" art="coin" cost="1.0K" rarity="rare" selected>Selected.</Card>
            <Card title="Epic" art="atom" cost="5" rarity="epic" locked>Locked.</Card>
          </div>
        </Panel>
        <Panel title="Relics, pips, meters" tone="deep">
          <div className="gallery__row">
            <Relic icon="tracker" label="Tracker" level={3} />
            <Relic icon="ecal" label="ECAL" level={1} />
            <Relic icon="muon" label="Muons" locked />
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
