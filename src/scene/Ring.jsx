// Anello, pozzo, caverna e fasci del sito. Si ridisegna solo quando cambia una delle proprietà (livelli costruiti).
import { memo } from 'react';
import { tr } from '../engine.js';
import { GROUND, INK, ink } from './art.jsx';
import { CX, CY, Hit, LAYERS, Magnet, ringRadius } from './parts.jsx';

// Mini detector nella caverna: ogni strato compare in base al livello costruito.
const MiniDetector = ({ x, y, det }) => (
  <g pointerEvents="none">
    {[['muon', 23, 6], ['hcal', 17, 6], ['ecal', 11.5, 5], ['tracker', 6.5, 5]].map(([id, rr, w]) => {
      const lvl = det[id];
      const L = LAYERS.find((q) => q.id === id);
      return (
        <g key={id}>
          <circle cx={x} cy={y} r={rr} fill="none" stroke={lvl ? INK : '#3a4770'} strokeWidth={w + 2} opacity={lvl ? 1 : 0.5} />
          <circle cx={x} cy={y} r={rr} fill="none" stroke={lvl ? L.color : '#3a4770'} strokeWidth={w} opacity={lvl ? 0.55 + 0.15 * lvl : 0.5} strokeDasharray={lvl ? 'none' : '3 3'} />
        </g>
      );
    })}
    <circle cx={x} cy={y} r="2" fill="#fff" />
  </g>
);

const deg = (a) => (a * 180) / Math.PI;

function Tunnel({ rad, n, mag, lumiLvl, onProjects }) {
  const magnets = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI + Math.PI / n;
    return <Magnet key={i} x={CX + rad * Math.cos(a)} y={CY + rad * Math.sin(a)} deg={deg(a) + 90} grad={mag} />;
  });
  // cavità a radiofrequenza (dorate) sul lato opposto al punto di collisione
  const cavities = [-0.12, 0.12].map((da) => {
    const a = Math.PI / 2 + da * 3;
    return <g key={da} transform={`translate(${(CX + rad * Math.cos(a)).toFixed(1)} ${(CY + rad * Math.sin(a)).toFixed(1)}) rotate(${deg(a) + 90})`}><rect x="-7" y="-7" width="14" height="14" rx="3" fill="url(#gold)" {...ink(1.8)} /></g>;
  });
  // magneti di focalizzazione: più luminosità, più ne vedi accanto al punto di collisione
  const focus = [];
  for (let k = 0; k < lumiLvl; k++) {
    for (const sign of [-1, 1]) {
      const a = -Math.PI / 2 + sign * (0.2 + 0.1 * k);
      focus.push(<circle key={`${k}${sign}`} cx={CX + rad * Math.cos(a)} cy={CY + rad * Math.sin(a)} r="4.2" fill="#fef3c7" {...ink(1.6)} filter="url(#glow)" />);
    }
  }
  return (
    <Hit label={tr('site.ring')} onActivate={onProjects}>
      <circle cx={CX} cy={CY} r={rad} fill="none" stroke="#38e1ff" strokeOpacity="0.07" strokeWidth="34" />
      <circle cx={CX} cy={CY} r={rad} fill="none" stroke="#38e1ff" strokeOpacity="0.14" strokeWidth="27" />
      <circle cx={CX} cy={CY} r={rad} fill="none" stroke={INK} strokeWidth="22" />
      <circle cx={CX} cy={CY} r={rad} fill="none" stroke="url(#tube)" strokeWidth="16" />
      <circle cx={CX} cy={CY} r={rad - 3} fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.35" />
      <circle cx={CX} cy={CY} r={rad} fill="none" stroke="transparent" strokeWidth="40" />
      {magnets}{cavities}{focus}
    </Hit>
  );
}

export const Ring = memo(function Ring({ energyLvl, lumiLvl, collider, muon, hcal, ecal, tracker, onProjects, onDetector }) {
  const rad = ringRadius(energyLvl);
  const ipY = CY - rad;
  const det = { muon, hcal, ecal, tracker };
  return (
    <g>
      <Tunnel rad={rad} n={10 + 4 * energyLvl} mag={collider === 'pp' ? 'magBlue' : 'magGreen'} lumiLvl={lumiLvl} onProjects={onProjects} />
      <g>
        <rect x={CX - 6} y={GROUND} width="12" height={Math.max(0, ipY - GROUND)} fill="url(#steel)" {...ink(2.2)} />
        <rect x={CX - 5} y={GROUND + 14} width="10" height="12" fill="#facc15" {...ink(1.6)} className="lift" />
      </g>
      <g pointerEvents="none">
        <path d={`M${CX - 28} ${GROUND + 4}V${GROUND - 20}L${CX - 22} ${GROUND - 28}H${CX + 22}L${CX + 28} ${GROUND - 20}V${GROUND + 4}z`} fill="url(#metal)" {...ink(2)} />
        <path d={`M${CX - 22} ${GROUND - 28}L${CX - 16} ${GROUND - 38}H${CX + 16}L${CX + 22} ${GROUND - 28}z`} fill="url(#roof)" {...ink(1.8)} />
        {[0, 1, 2].map((i) => <path key={i} d={`M${CX - 28} ${GROUND - 14 + i * 7}H${CX + 28}`} stroke="#05070f" strokeWidth="0.8" opacity="0.6" />)}
        <rect x={CX - 18} y={GROUND - 22} width="36" height="3.600" rx="1.400" fill="url(#slit)" filter="url(#glow)" />
        <rect x={CX - 7} y={GROUND - 10} width="14" height="14" rx="2" fill="#0a1020" stroke="#05070f" strokeWidth="1.400" />
        <path d={`M${CX + 12} ${GROUND - 38}V${GROUND - 52}`} stroke="#9aa7c0" strokeWidth="1.600" /><circle cx={CX + 12} cy={GROUND - 53} r="2" fill="#ff3b4e" className="blink" />
      </g>
      <Hit label={tr('site.ip')} onActivate={onDetector}>
        <rect x={CX - 40} y={ipY - 32} width="80" height="64" rx="12" fill="#0f1630" {...ink(2.8)} />
        <rect x={CX - 36} y={ipY - 28} width="72" height="56" rx="9" fill="none" stroke="#33447e" strokeWidth="1.6" />
        <MiniDetector x={CX} y={ipY} det={det} />
        <rect x={CX - 44} y={ipY - 36} width="88" height="72" fill="transparent" />
      </Hit>
    </g>
  );
});

// Fasci che girano nell'anello e lampo al punto di collisione (solo durante una corsa).
export const Beams = memo(function Beams({ energyLvl }) {
  const rad = ringRadius(energyLvl);
  const ipY = CY - rad;
  const path = (sweep) => `M ${CX + rad} ${CY} A ${rad} ${rad} 0 1 ${sweep} ${CX - rad} ${CY} A ${rad} ${rad} 0 1 ${sweep} ${CX + rad} ${CY}`;
  return (
    <g pointerEvents="none">
      {[1, 0].map((sweep) => (
        <circle key={sweep} r="4.5" fill="#fff7d6" filter="url(#glow)"><animateMotion dur="2.2s" repeatCount="indefinite" path={path(sweep)} /></circle>
      ))}
      <circle cx={CX} cy={ipY} r="6" fill="url(#ipGlow)"><animate attributeName="r" values="8;26;8" dur="0.9s" repeatCount="indefinite" /></circle>
    </g>
  );
});
