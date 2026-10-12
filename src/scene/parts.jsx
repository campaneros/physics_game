// Pezzi interattivi e decorativi condivisi dalle due viste della scena.
import { memo } from 'react';
import { INK, ink } from './art.jsx';

export const CX = 180;
export const CY = 372; // centro dell'anello
export const DCY = 292; // centro della sezione del detector
export const ringRadius = (lvl) => 62 + 14 * lvl;

// dall'esterno verso l'interno
export const LAYERS = [
  { id: 'muon', ri: 118, ro: 146, n: 16, color: '#a78bfa', fills: ['url(#muonA)', 'url(#muonB)'] },
  { id: 'hcal', ri: 88, ro: 114, n: 24, color: '#fb923c', fills: ['url(#hcalG)'] },
  { id: 'ecal', ri: 64, ro: 86, n: 48, color: '#34d399', fills: ['url(#ecalG)'] },
  { id: 'tracker', ri: 30, ro: 62, n: 0, color: '#38bdf8', fills: [] },
];

// Gruppo SVG attivabile da tocco e da tastiera (Invio/Spazio).
export function Hit({ label, onActivate, className, children, ...rest }) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      className={`hit${className ? ` ${className}` : ''}`}
      onClick={onActivate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onActivate(); }}
      {...rest}
    >
      {children}
    </g>
  );
}

export const Crane = memo(function Crane({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="crane">
        <rect x="-3" y="-64" width="6" height="64" fill="#facc15" {...ink(2)} />
        <path d="M-3 -64H40" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path d="M-3 -64H40" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
        <path d="M34 -62V-32" stroke="#e2e8f0" strokeWidth="1.6" />
        <rect x="29" y="-32" width="10" height="10" fill="#f97316" {...ink(2)} />
        <rect x="-12" y="-5" width="24" height="6" rx="2" fill="#64748b" {...ink(2)} />
      </g>
    </g>
  );
});

export const Dust = memo(function Dust({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={i * 9 - 14} cy="0" r={4 + (i % 2) * 2} fill="#d6c3a0" className="dust" style={{ animationDelay: `${(i * 0.4).toFixed(1)}s` }} />)}
    </g>
  );
});

export const Led = ({ cx, cy, r, on, width }) => <circle cx={cx} cy={cy} r={r} fill={on ? '#4ade80' : '#334155'} {...ink(width)} />;

// Magnete dell'anello: corpo metallico scuro con striscia neon (blu per pp, verde per ee) e due ganasce ambra.
export const Magnet = memo(function Magnet({ x, y, deg, grad }) {
  const neon = grad === 'magBlue' ? '#38e1ff' : '#4dff9a';
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})`}>
      <rect x="-9" y="-6" width="18" height="12" rx="3" fill="url(#metalDark)" {...ink(1.6)} />
      <rect x="-7" y="-4.500" width="14" height="3" rx="1.500" fill={neon} opacity="0.9" />
      <rect x="-9" y="-6" width="3" height="12" rx="1.200" fill="#ffb347" opacity="0.85" />
      <rect x="6" y="-6" width="3" height="12" rx="1.200" fill="#ffb347" opacity="0.85" />
      <path d="M-4 2.500H4" stroke="#fff" strokeWidth="1" opacity="0.35" strokeLinecap="round" />
    </g>
  );
});
