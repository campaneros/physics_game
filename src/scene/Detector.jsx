// Sezione del detector: quattro strati concentrici (tracciatore, ECAL, HCAL, muoni), tracce e rack di acquisizione.
import { memo } from 'react';
import { Processes as PR, tr } from '../engine.js';
import { Popups } from '../popups/api.js';
import { DetBackdrop, INK, Vignette, ink, wedge } from './art.jsx';
import { CX, Crane, DCY, Hit, LAYERS, Led } from './parts.jsx';

const LayerGhost = memo(function LayerGhost({ L }) {
  const mid = (L.ri + L.ro) / 2;
  return (
    <>
      <circle cx={CX} cy={DCY} r={mid} fill="#38bdf8" fillOpacity="0.05" stroke="#38bdf8" strokeOpacity="0.5" strokeWidth={L.ro - L.ri} strokeDasharray="4 6" opacity="0.35" />
      <circle cx={CX} cy={DCY} r={L.ro} fill="none" stroke="#7dd3fc" strokeWidth="1.4" strokeDasharray="3 4" />
    </>
  );
});

// Lo strato costruito: spicchi per i calorimetri e i muoni, anelli e raggi per il tracciatore.
const LayerSolid = memo(function LayerSolid({ L }) {
  let body;
  if (L.n) {
    body = Array.from({ length: L.n }, (_, i) => {
      const a0 = (i / L.n) * 2 * Math.PI + 0.012;
      const a1 = ((i + 1) / L.n) * 2 * Math.PI - 0.012;
      return <path key={i} d={wedge(CX, DCY, L.ri, L.ro, a0, a1)} fill={L.fills[i % L.fills.length]} {...ink(L.n > 30 ? 1 : 1.6)} />;
    });
  } else {
    body = (
      <>
        {[0, 1, 2, 3].map((k) => {
          const rr = L.ri + 4 + (k * (L.ro - L.ri - 8)) / 3;
          return (
            <g key={k}>
              <circle cx={CX} cy={DCY} r={rr} fill="none" stroke={INK} strokeWidth="5.5" />
              <circle cx={CX} cy={DCY} r={rr} fill="none" stroke="url(#trkG)" strokeWidth="3" />
            </g>
          );
        })}
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * 2 * Math.PI;
          return <path key={i} d={`M${CX + L.ri * Math.cos(a)} ${DCY + L.ri * Math.sin(a)}L${CX + L.ro * Math.cos(a)} ${DCY + L.ro * Math.sin(a)}`} stroke="#bde6ff" strokeWidth="0.9" opacity="0.5" />;
        })}
      </>
    );
  }
  return (
    <>
      {body}
      <circle cx={CX} cy={DCY} r={L.ro - 1.5} fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.28" pointerEvents="none" />
    </>
  );
});

const display = (on) => (on ? 'inline' : 'none');

function Layer({ L, lvl, building, need }) {
  const mid = (L.ri + L.ro) / 2;
  return (
    <>
      <Hit label={tr(`sub.${L.id}`)} className={building ? 'building' : undefined} onActivate={() => Popups.construction([L.id])}>
        <g display={display(lvl === 0)}><LayerGhost L={L} /></g>
        <g display={display(lvl > 0)} opacity={0.6 + 0.1 * lvl}><LayerSolid L={L} /></g>
        <circle cx={CX} cy={DCY} r={L.ro + 1} fill="none" stroke={L.color} strokeWidth="3" filter="url(#glow)" display={display(lvl >= 3)} pointerEvents="none" className="breathe" />
        {Array.from({ length: PR.DETECTOR.maxLevel }, (_, i) => {
          const a = (Math.PI / 180) * (30 + i * 9);
          return <circle key={i} cx={CX + mid * Math.cos(a)} cy={DCY + mid * Math.sin(a)} r="3.4" fill={i < lvl ? L.color : '#0b1220'} {...ink(1.4)} />;
        })}
      </Hit>
      <circle cx={CX} cy={DCY} r={L.ro + 5} fill="none" strokeWidth="2.6" strokeDasharray="2 5" strokeLinecap="round" display={display(!!need)} stroke={lvl >= need ? '#4ade80' : '#f87171'} pointerEvents="none" />
    </>
  );
}

// Tracce delle particelle che partono dal punto di collisione (visibili durante una corsa).
const Tracks = memo(function Tracks({ on }) {
  return (
    <g display={display(on)} pointerEvents="none">
      {Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * 2 * Math.PI + 0.3;
        const len = 70 + ((i * 37) % 80);
        const bend = (i % 2 ? 1 : -1) * (14 + (i % 4) * 5);
        const ex = CX + len * Math.cos(a);
        const ey = DCY + len * Math.sin(a);
        const mx = CX + (len / 2) * Math.cos(a) - bend * Math.sin(a);
        const my = DCY + (len / 2) * Math.sin(a) + bend * Math.cos(a);
        return (
          <g key={i} className="track" style={{ animationDelay: `${(i * 0.11).toFixed(2)}s` }}>
            <path d={`M${CX} ${DCY}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`} fill="none" stroke={i % 3 === 0 ? '#fb7185' : '#fde047'} strokeWidth="2.2" strokeLinecap="round" filter="url(#glow)" />
            <circle cx={ex} cy={ey} r="3" fill="#fff" />
          </g>
        );
      })}
    </g>
  );
});

export function Detector({ s, shown, running, building, program, onBack }) {
  return (
    <g display={display(shown)}>
      <DetBackdrop />
      {LAYERS.map((L) => (
        <Layer key={L.id} L={L} lvl={s.det[L.id]} need={program ? program.need[L.id] : 0} building={!!(s.shutdown && s.shutdown.items.includes(L.id))} />
      ))}
      <rect x="14" y={DCY - 4} width="332" height="8" fill="url(#tube)" {...ink(1.8)} pointerEvents="none" />
      <circle cx={CX} cy={DCY} r="28" fill="url(#ipGlow)" className="breathe" pointerEvents="none" />
      <circle cx={CX} cy={DCY} r="5" fill="#fff" pointerEvents="none" />
      <Tracks on={running} />
      <Hit label={tr('site.daq')} onActivate={() => Popups.construction(['daq'])}>
        <rect x="276" y="46" width="62" height="46" rx="8" fill="#1c2547" {...ink(2.4)} />
        <rect x="270" y="40" width="74" height="58" fill="transparent" />
        {[0, 1, 2, 3].map((i) => <Led key={i} cx={290 + i * 14} cy={69} r={4} on={i < s.det.daq} width={1.4} />)}
      </Hit>
      <Hit label={tr('det.back')} onActivate={onBack}>
        <circle cx="38" cy="52" r="22" fill="#1c2547" {...ink(2.6)} />
        <path d="M15 4l-8 8 8 8" transform="translate(26 40)" fill="none" stroke="#e6ebf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Hit>
      <g display={display(building)} pointerEvents="none"><Crane x={CX + 80} y={DCY - 130} /></g>
      <Vignette />
    </g>
  );
}
