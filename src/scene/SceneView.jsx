// Scena interattiva: sito (campo, edifici, tunnel sotterraneo) e, toccando il punto di collisione, sezione del detector.
import { useState } from 'react';
import { Game as G, Processes as PR, UI, tr } from '../engine.js';
import { Popups } from '../popups/api.js';
import { useSnapshot } from '../store.js';
import { ControlRoom, DataCenter, GROUND, H, INK, Skyland, Underground, SceneDefs, Vignette, W, ink } from './art.jsx';
import { Detector } from './Detector.jsx';
import { Beams, Ring } from './Ring.jsx';
import { CX, CY, Crane, Dust, Hit, Led, ringRadius } from './parts.jsx';

const display = (on) => (on ? 'inline' : 'none');
const BAR_W = 316;

// Area in costruzione prima dell'acceleratore: tocca il "+" per aprire il cantiere.
function Plot({ building }) {
  return (
    <Hit label={tr('site.plot')} onActivate={() => Popups.construction()}>
      <rect x="56" y="240" width="248" height="246" rx="18" fill="#2a1b10" opacity="0.55" />
      <rect x="56" y="240" width="248" height="246" rx="18" fill="none" stroke="#fcd34d" strokeWidth="3.5" strokeDasharray="12 8" className="marchant" />
      <g className="pulse2" display={display(!building)}>
        <circle cx={CX} cy={CY} r="34" fill="#1c2a52" {...ink(3)} />
        <g transform={`translate(${CX - 24} ${CY - 24}) scale(2)`}><path d="M12 4v16M4 12h16" fill="none" stroke="#e6ebf5" strokeWidth="3" strokeLinecap="round" /></g>
      </g>
      <rect x="56" y="240" width="248" height="246" fill="transparent" />
    </Hit>
  );
}

const Dirt = () => (
  <g pointerEvents="none">
    <path d={`M${CX - 70} 420C${CX - 40} 376 ${CX + 40} 376 ${CX + 70} 420z`} fill="#8a6b4a" {...ink(2.5)} />
    <path d={`M${CX - 40} 420C${CX - 20} 398 ${CX + 20} 398 ${CX + 40} 420z`} fill="#b08d62" opacity="0.6" />
    <path d={`M${CX + 80} 440l8-18l8 18zM${CX - 100} 448l8-18l8 18z`} fill="#f97316" {...ink(2)} />
  </g>
);

export function SceneView() {
  const s = useSnapshot();
  const [view, setView] = useState('site');
  const program = s.program ? PR.BY_ID.get(s.program) : null;
  const running = !!(s.run && s.program && G.canRun(s, s.program));
  const building = !!s.shutdown;
  const ipY = CY - ringRadius(s.energyLvl);
  const prog = s.shutdown ? (s.t - s.shutdown.start) / (s.shutdown.until - s.shutdown.start) : s.run ? (s.t - s.run.start) / (s.run.end - s.run.start) : 0;
  const craneAt = s.built ? [CX - 56, ipY + 58] : [CX - 40, CY + 40];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="scene" role="group" aria-label={tr('tab.site')}>
      <SceneDefs />
      <g display={display(view === 'site')}>
        <Skyland />
        <Underground />
        <g display={display(!s.built)}><Plot building={building} /></g>
        <g display={display(building && !s.built)}><Dirt /></g>
        {s.built && (
          <Ring energyLvl={s.energyLvl} lumiLvl={s.lumiLvl} collider={s.collider} muon={s.det.muon} hcal={s.det.hcal} ecal={s.det.ecal} tracker={s.det.tracker} onProjects={() => Popups.projects()} onDetector={() => setView('det')} />
        )}
        <g display={display(s.built && running)}><Beams energyLvl={s.energyLvl} /></g>
        <g display={display(building && view === 'site')} pointerEvents="none"><Crane x={craneAt[0]} y={craneAt[1]} /><Dust x={CX + 30} y={CY + 52} /></g>
        <Hit label={tr('site.control')} onActivate={() => UI.showTab('physics')}><ControlRoom /></Hit>
        <Hit label={tr('site.daq')} onActivate={() => Popups.construction(['daq'])}>
          <DataCenter />
          {[0, 1, 2, 3].map((i) => <Led key={i} cx={284 + i * 16} cy={158} r={4.5} on={i < s.det.daq} width={1.6} />)}
        </Hit>
        <rect x="20" y={GROUND + 16} width="320" height="10" rx="5" fill="#10172e" {...ink(2)} />
        <rect x="22" y={GROUND + 18} width={Math.max(0, Math.min(1, prog)) * BAR_W} height="6" rx="3" fill={s.shutdown ? '#f59e0b' : '#4ade80'} />
        <Vignette />
      </g>
      <Detector s={s} shown={view === 'det'} running={running} building={building} program={program} onBack={() => setView('site')} />
    </svg>
  );
}
