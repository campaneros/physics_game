// Pittura statica della scena in SVG: atmosfera dark sci-fi (cielo viola-rosa, montagne a più piani con nebbia, bunker di ricerca,
// sottosuolo a strati con fessure, cristalli e torce). Nessuna logica di gioco: i componenti sono memoizzati e si montano una volta.
// Niente filtri di rumore (feTurbulence): le texture sono pattern statici, leggeri da ridisegnare su telefono.
import { memo } from 'react';

export const INK = '#05070f';
export const W = 360;
export const H = 540;
export const GROUND = 190;

export const ink = (w = 2.5) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round' });

const Lin = ({ id, stops, dir = 'v' }) => (
  <linearGradient id={id} x1="0" y1="0" x2={dir === 'v' ? 0 : 1} y2={dir === 'v' ? 1 : 0}>
    {stops.map(([o, c, a]) => <stop key={o} offset={o} stopColor={c} stopOpacity={a == null ? 1 : a} />)}
  </linearGradient>
);
const Rad = ({ id, stops, cx = 0.5, cy = 0.5, r = 0.5 }) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r}>
    {stops.map(([o, c, a]) => <stop key={o} offset={o} stopColor={c} stopOpacity={a == null ? 1 : a} />)}
  </radialGradient>
);

export const SceneDefs = memo(function SceneDefs() {
  return (
    <defs>
      {/* cielo: blu notte → viola cosmico → rosa/arancio all'orizzonte */}
      <Lin id="sky" stops={[[0, '#030617'], [0.22, '#0b1140'], [0.45, '#2b1470'], [0.68, '#7a2a95'], [0.85, '#d8407f'], [1, '#ff9a52']]} />
      <Rad id="sunGlow" stops={[[0, '#fff0c8', 1], [0.2, '#ffc27a', 0.75], [0.5, '#ff6f61', 0.32], [1, '#c02a8a', 0]]} />
      <Lin id="haze" stops={[[0, '#ff7a5c', 0], [0.7, '#ff8a5c', 0.35], [1, '#ffb070', 0.55]]} />
      <Lin id="fogFar" stops={[[0, '#7a3fa8', 0], [1, '#a04aa6', 0.6]]} />
      <Lin id="mtnFar" stops={[[0, '#7c58b8'], [1, '#a05aa8']]} />
      <Lin id="mtnMid" stops={[[0, '#3a2a86'], [1, '#2a1d63']]} />
      <Lin id="mtnNear" stops={[[0, '#1b1450'], [1, '#0d0a2c']]} />
      <Lin id="snow" stops={[[0, '#ffffff'], [1, '#cdbdf2']]} />
      <Lin id="terrain" stops={[[0, '#1d2f3f'], [1, '#0b121c']]} />
      {/* sottosuolo: marrone terroso → ardesia → antracite */}
      <Lin id="soil" stops={[[0, '#5a3d27'], [0.2, '#463125'], [0.5, '#2c2629'], [0.78, '#1a1d29'], [1, '#0b0e17']]} />
      <Lin id="strataA" stops={[[0, '#7a5638', 0.5], [1, '#4a3322', 0.2]]} />
      <Lin id="strataB" stops={[[0, '#1a1c28', 0.55], [1, '#2a2530', 0.15]]} />
      <Lin id="rock" stops={[[0, '#9a7a58'], [1, '#4a3a30']]} />
      <Lin id="rockCold" stops={[[0, '#7e8aa8'], [1, '#2c3348']]} />
      <Lin id="tube" stops={[[0, '#dbe5f2'], [0.45, '#8693a8'], [1, '#2f3a54']]} />
      <Lin id="magBlue" stops={[[0, '#9be4ff'], [0.5, '#2f84d8'], [1, '#12306a']]} />
      <Lin id="magGreen" stops={[[0, '#9bffc8'], [0.5, '#22a866'], [1, '#0c4a2e']]} />
      <Lin id="gold" stops={[[0, '#ffe9a0'], [1, '#b7791f']]} />
      <Lin id="metal" stops={[[0, '#8a97b0'], [0.35, '#4c586f'], [1, '#1f2638']]} />
      <Lin id="metalDark" stops={[[0, '#566178'], [1, '#161c2c']]} />
      <Lin id="wall" stops={[[0, '#9aa7c0'], [1, '#4d5872']]} />
      <Lin id="roof" stops={[[0, '#3a4660'], [1, '#161c2e']]} />
      <Lin id="steel" stops={[[0, '#667592'], [1, '#1c2438']]} />
      <Lin id="muonA" stops={[[0, '#c9b8ff'], [1, '#6a4fd1']]} />
      <Lin id="muonB" stops={[[0, '#8a96b3'], [1, '#38425e']]} />
      <Lin id="hcalG" stops={[[0, '#ffc888'], [1, '#c2570c']]} />
      <Lin id="ecalG" stops={[[0, '#9bf5cc'], [1, '#0f9460']]} />
      <Lin id="trkG" stops={[[0, '#8fe0ff'], [1, '#1e72c0']]} />
      <Rad id="cavern" stops={[[0, '#232c52'], [0.55, '#0f1530'], [1, '#03050c']]} cy={0.45} r={0.75} />
      {/* texture statiche */}
      <pattern id="plates" width="48" height="26" patternUnits="userSpaceOnUse">
        <path d="M0 .5H48M0 13.5H48M.5 0V13M24.5 13V26" stroke="#000" strokeWidth="1" fill="none" opacity="0.28" />
        <path d="M2 2.5H22M26 15.500H46" stroke="#fff" strokeWidth="0.8" opacity="0.06" />
      </pattern>
      <pattern id="speckle" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="6" cy="8" r="1.100" fill="#000" opacity="0.35" /><circle cx="27" cy="5" r="0.8" fill="#fff" opacity="0.1" />
        <circle cx="16" cy="22" r="1.300" fill="#000" opacity="0.28" /><circle cx="34" cy="28" r="0.9" fill="#fff" opacity="0.08" />
        <circle cx="9" cy="35" r="0.8" fill="#fff" opacity="0.1" /><circle cx="30" cy="16" r="1" fill="#000" opacity="0.3" />
      </pattern>
      <pattern id="blueprint" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M20 0H0V20" fill="none" stroke="#38e1ff" strokeWidth="0.6" opacity="0.22" />
      </pattern>
      {/* luci */}
      <Rad id="torchLight" stops={[[0, '#ffb86a', 0.7], [0.3, '#ff7a28', 0.34], [0.65, '#c2410c', 0.12], [1, '#7a2a08', 0]]} />
      <Rad id="torchCore" stops={[[0, '#fff0b0', 0.95], [0.5, '#ffb040', 0.4], [1, '#ff7a20', 0]]} />
      <Rad id="crysCyan" stops={[[0, '#a8f4ff', 0.9], [0.4, '#22d3ee', 0.35], [1, '#22d3ee', 0]]} />
      <Rad id="crysMagenta" stops={[[0, '#ffc2f5', 0.9], [0.4, '#e83fd0', 0.35], [1, '#e83fd0', 0]]} />
      <Rad id="crysGreen" stops={[[0, '#b6ffcf', 0.9], [0.4, '#22c55e', 0.35], [1, '#22c55e', 0]]} />
      <Rad id="ipGlow" stops={[[0, '#ffffff', 1], [0.3, '#fde68a', 0.7], [1, '#f59e0b', 0]]} />
      <Rad id="aura" stops={[[0, '#38e1ff', 0.7], [0.5, '#38e1ff', 0.22], [1, '#38e1ff', 0]]} />
      <Rad id="vig" stops={[[0.5, '#000', 0], [1, '#000', 0.7]]} r={0.78} />
      <Lin id="beam" stops={[[0, '#fde68a', 0], [0.5, '#fff7d6', 1], [1, '#fde68a', 0]]} dir="h" />
      <Lin id="cone" stops={[[0, '#c8e8ff', 0.5], [1, '#c8e8ff', 0]]} />
      <Lin id="slit" stops={[[0, '#c8fbff'], [1, '#22c3e6']]} />
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="holoGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
});

// --- superficie ---------------------------------------------------------------

const STARS = [[18, 14], [46, 40], [74, 20], [102, 58], [130, 12], [152, 34], [186, 18], [214, 46], [246, 14], [270, 34], [298, 20], [326, 52], [344, 12], [60, 76], [112, 84], [172, 70], [232, 76], [312, 82], [28, 96], [284, 98]];

const Pine = ({ x, y, k = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    <path d="M0 -34L9 -14H4L12 -2H-12L-4 -14H-9z" fill="#0c1a24" stroke="#1d4a5a" strokeWidth="1" strokeLinejoin="round" />
    <path d="M0 -34L3 -14M0 -34L-3 -14" stroke="#38e1ff" strokeWidth="0.7" opacity="0.35" />
  </g>
);

// Cielo, tre piani di montagne con nebbia d'aria e snow cap, terreno scuro con bordo neon.
export const Skyland = memo(function Skyland() {
  return (
    <g>
      <rect width={W} height={GROUND + 10} fill="url(#sky)" />
      {STARS.map(([x, y], i) => <circle key={x} cx={x} cy={y} r={i % 4 ? 0.9 : 1.6} fill={i % 3 ? '#fff' : '#bfe6ff'} className="twinkle" style={{ animationDelay: `${(i * 0.31).toFixed(2)}s` }} />)}
      <circle cx="256" cy="146" r="112" fill="url(#sunGlow)" />
      <circle cx="256" cy="146" r="19" fill="#fff4d0" />
      {/* sfondo: lontano, sbiadito dalla nebbia */}
      <path d="M0 150L34 108L50 124L88 78L124 126L152 108L200 150L238 120L274 142L318 96L360 140V196H0z" fill="url(#mtnFar)" />
      <path d="M80 86L88 78L97 90L90 86zM310 106L318 96L328 110L320 106z" fill="url(#snow)" opacity="0.85" />
      <rect y="92" width={W} height="104" fill="url(#fogFar)" />
      {/* piano medio */}
      <path d="M0 168L40 128L62 146L104 108L146 150L176 134L226 168L262 140L306 162L340 130L360 148V196H0z" fill="url(#mtnMid)" />
      <path d="M96 118L104 108L113 121L106 117zM332 138L340 130L349 143L342 139z" fill="url(#snow)" opacity="0.7" />
      <path d="M0 168L40 128L62 146L104 108L146 150L176 134L226 168L262 140L306 162L340 130L360 148" fill="none" stroke="#d86fd0" strokeWidth="1" opacity="0.4" />
      <rect y="140" width={W} height="56" fill="url(#haze)" />
      {/* primo piano: creste scure con luce di bordo */}
      <path d="M0 176C40 154 86 158 128 172C170 158 220 154 262 170C300 158 332 160 360 172V200H0z" fill="url(#mtnNear)" />
      <path d="M0 176C40 154 86 158 128 172C170 158 220 154 262 170C300 158 332 160 360 172" fill="none" stroke="#ff8ad0" strokeWidth="1.2" opacity="0.45" />
      <g className="drift"><path d="M40 62q14-9 30-3q10-7 26 1q-8 6-24 5q-14 7-32-3z" fill="#e69ad8" opacity="0.28" /></g>
      <g className="drift slow"><path d="M220 38q14-9 30-3q10-7 26 1q-8 6-24 5q-14 7-32-3z" fill="#ffb4a0" opacity="0.22" /></g>
      {/* terreno */}
      <path d={`M0 ${GROUND - 4}C60 ${GROUND - 10} 120 ${GROUND + 1} 190 ${GROUND - 5}C250 ${GROUND - 11} 310 ${GROUND} 360 ${GROUND - 6}V${GROUND + 10}H0z`} fill="url(#terrain)" />
      <path d={`M0 ${GROUND - 4}C60 ${GROUND - 10} 120 ${GROUND + 1} 190 ${GROUND - 5}C250 ${GROUND - 11} 310 ${GROUND} 360 ${GROUND - 6}`} fill="none" stroke="#38e1ff" strokeWidth="1.2" opacity="0.55" filter="url(#glow)" />
      <Pine x={112} y={GROUND + 2} k={0.9} /><Pine x={134} y={GROUND + 4} k={0.65} /><Pine x={218} y={GROUND + 2} k={0.8} /><Pine x={346} y={GROUND + 4} k={0.7} />
    </g>
  );
});

// --- sottosuolo ----------------------------------------------------------------

const ROCKS = [[34, 262, 13, 9], [320, 300, 15, 10], [52, 430, 11, 7], [300, 470, 14, 9], [24, 358, 9, 6], [338, 396, 10, 7], [90, 506, 13, 8]];
const SHARDS = [
  { x: 44, y: 484, k: 1, glow: 'crysCyan', fill: '#5fe9ff' },
  { x: 318, y: 500, k: 1.2, glow: 'crysMagenta', fill: '#ff6fe0' },
  { x: 200, y: 524, k: 0.8, glow: 'crysGreen', fill: '#4dff9a' },
  { x: 332, y: 262, k: 0.6, glow: 'crysCyan', fill: '#5fe9ff' },
  { x: 22, y: 330, k: 0.55, glow: 'crysMagenta', fill: '#ff6fe0' },
];
const FISSURES = [[0, 238, 130], [226, 246, 134], [0, 318, 90], [260, 330, 100], [30, 410, 120], [210, 428, 150], [0, 492, 110], [250, 512, 110]];

const Shard = ({ x, y, k, glow, fill }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`} pointerEvents="none">
    <circle r="34" cy="-12" fill={`url(#${glow})`} className="breathe" />
    <path d="M-11 0L-6-21L-1 0zM-2 0L4-31L11 0zM8 0L14-17L19 0z" fill={fill} fillOpacity="0.85" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.8" strokeLinejoin="round" />
    <path d="M4-31L7-12L2-2z" fill="#fff" opacity="0.55" />
  </g>
);

const Torch = ({ x, y }) => (
  <g pointerEvents="none">
    <circle cx={x} cy={y} r="120" fill="url(#torchLight)" className="flicker" />
    <circle cx={x} cy={y - 8} r="34" fill="url(#torchCore)" className="flicker" />
    <path d={`M${x - 5} ${y + 18}L${x - 2} ${y + 2}H${x + 2}L${x + 5} ${y + 18}z`} fill="url(#metalDark)" stroke="#05070f" strokeWidth="1.2" strokeLinejoin="round" />
    <path d={`M${x} ${y - 18}C${x + 9} ${y - 7} ${x + 7} ${y + 1} ${x} ${y + 3}C${x - 7} ${y + 1} ${x - 9} ${y - 7} ${x} ${y - 18}z`} fill="#ff8a1e" className="flicker" />
    <path d={`M${x} ${y - 11}C${x + 4} ${y - 5} ${x + 3} ${y} ${x} ${y + 1}C${x - 3} ${y} ${x - 4} ${y - 5} ${x} ${y - 11}z`} fill="#ffe27a" className="flicker" />
  </g>
);

// Sottosuolo a strati: gradiente terra → ardesia, bande ondulate, fessure, rocce angolari, cristalli e torce.
export const Underground = memo(function Underground() {
  const top = GROUND + 4;
  return (
    <g>
      <rect x="0" y={top} width={W} height={H - top} fill="url(#soil)" />
      {Array.from({ length: 7 }, (_, i) => {
        const y = GROUND + 36 + i * 50;
        return <path key={i} d={`M0 ${y}C70 ${y - 12} 140 ${y + 12} 220 ${y - 4}C280 ${y - 14} 330 ${y + 6} 360 ${y}V${y + 18}C320 ${y + 24} 270 ${y + 8} 210 ${y + 16}C140 ${y + 26} 70 ${y + 6} 0 ${y + 16}z`} fill={i % 2 ? 'url(#strataB)' : 'url(#strataA)'} />;
      })}
      {FISSURES.map(([x, y, len], i) => (
        <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M${x} ${y}l${len * 0.25} 5l${len * 0.2} -4l${len * 0.3} 6l${len * 0.25} -3`} stroke="#02030a" strokeWidth="2" opacity="0.7" />
          <path d={`M${x} ${y + 2.500}l${len * 0.25} 5l${len * 0.2} -4l${len * 0.3} 6l${len * 0.25} -3`} stroke="#c9a070" strokeWidth="0.7" opacity="0.14" />
        </g>
      ))}
      <rect x="0" y={top} width={W} height={H - top} fill="url(#speckle)" pointerEvents="none" />
      <rect x="0" y={top} width={W} height={H - top} fill="url(#plates)" opacity="0.7" pointerEvents="none" />
      {ROCKS.map(([x, y, rx, ry], i) => (
        <g key={`${x}${y}`} opacity="0.72">
          <path d={`M${x - rx} ${y + ry * 0.4}L${x - rx * 0.5} ${y - ry}L${x + rx * 0.6} ${y - ry * 0.8}L${x + rx} ${y + ry * 0.2}L${x + rx * 0.3} ${y + ry}z`} fill={i % 2 ? 'url(#rockCold)' : 'url(#rock)'} stroke="#05070f" strokeWidth="1.4" strokeLinejoin="round" />
          <path d={`M${x - rx * 0.5} ${y - ry}L${x + rx * 0.6} ${y - ry * 0.8}L${x + rx * 0.1} ${y - ry * 0.1}z`} fill="#fff" opacity="0.13" />
        </g>
      ))}
      <g transform="translate(316 238)" opacity="0.55"><path d="M0 0a10 10 0 1 1 7 9a6 6 0 1 1-5-6a3 3 0 1 1-2 3" fill="none" stroke="#d9c3a0" strokeWidth="2.600" strokeLinecap="round" /></g>
      {SHARDS.map((s) => <Shard key={`${s.x}${s.y}`} {...s} />)}
      <Torch x={30} y={230} />
      <Torch x={330} y={230} />
    </g>
  );
});

// --- edifici: moduli di ricerca corazzati ---------------------------------------

const Dish = ({ x, y, k = 1, rot = -25 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${k})`}>
    <path d="M-9 0A9 9 0 0 0 9 0z" fill="url(#metal)" stroke="#05070f" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M0 0V-9" stroke="#9aa7c0" strokeWidth="1.2" />
    <circle cx="0" cy="-10" r="1.6" fill="#38e1ff" />
  </g>
);

const Plating = ({ x, y, w, h, step = 8 }) => (
  <g pointerEvents="none">
    {Array.from({ length: Math.floor(h / step) }, (_, i) => <path key={i} d={`M${x} ${y + (i + 1) * step}H${x + w}`} stroke="#05070f" strokeWidth="0.9" opacity="0.6" />)}
    {Array.from({ length: Math.floor(h / step) }, (_, i) => <path key={`l${i}`} d={`M${x} ${y + (i + 1) * step + 1}H${x + w}`} stroke="#c8d6f0" strokeWidth="0.5" opacity="0.18" />)}
  </g>
);

const Slit = ({ x, y, w }) => <rect x={x} y={y} width={w} height="3.600" rx="1.400" fill="url(#slit)" filter="url(#glow)" />;

export const ControlRoom = memo(function ControlRoom() {
  return (
    <>
      <path d="M14 182V132L24 122H86L98 132V182z" fill="url(#metal)" stroke="#05070f" strokeWidth="2.200" strokeLinejoin="round" />
      <path d="M24 122L34 112H78L86 122z" fill="url(#roof)" stroke="#05070f" strokeWidth="2" strokeLinejoin="round" />
      <Plating x={14} y={126} w={84} h={52} />
      <Slit x={26} y={138} w={22} /><Slit x={26} y={150} w={34} /><Slit x={62} y={138} w={24} />
      <rect x="62" y="156" width="22" height="26" rx="2" fill="#0a1020" stroke="#05070f" strokeWidth="1.600" />
      <path d="M64 168H82" stroke="#38e1ff" strokeWidth="1.100" opacity="0.8" />
      <path d="M44 112V94" stroke="#9aa7c0" strokeWidth="2" />
      <Dish x={44} y={96} k={0.9} rot={-30} />
      <path d="M70 112V100" stroke="#9aa7c0" strokeWidth="1.600" /><circle cx="70" cy="98" r="2" fill="#ff3b4e" className="blink" />
      <rect x="8" y="90" width="96" height="92" fill="transparent" />
    </>
  );
});

export const DataCenter = memo(function DataCenter() {
  return (
    <>
      <path d="M264 180V138L272 130H340L348 138V180z" fill="url(#metal)" stroke="#05070f" strokeWidth="2.200" strokeLinejoin="round" />
      <path d="M270 130L276 118H336L342 130z" fill="url(#roof)" stroke="#05070f" strokeWidth="2" strokeLinejoin="round" />
      <Plating x={264} y={132} w={84} h={46} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${280 + i * 16} 118V108`} stroke="#566178" strokeWidth="3" />)}
      <path d="M296 118V96" stroke="#9aa7c0" strokeWidth="2" />
      <Dish x={296} y={98} k={1.1} rot={20} />
      <path d="M334 118V92" stroke="#9aa7c0" strokeWidth="1.600" /><circle cx="334" cy="90" r="2.200" fill="#ff3b4e" className="blink" />
      <rect x="276" y="140" width="60" height="4" rx="2" fill="url(#slit)" filter="url(#glow)" opacity="0.8" />
      <rect x="256" y="94" width="96" height="90" fill="transparent" />
    </>
  );
});

// Cunicolo del detector: sfondo della vista in sezione.
export const DetBackdrop = memo(function DetBackdrop() {
  return (
    <g>
      <rect width={W} height={H} fill="url(#cavern)" />
      <rect width={W} height={H} fill="url(#plates)" opacity="0.5" />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${40 + i * 56} 0L${20 + i * 56} 120L${60 + i * 56} 120z`} fill="url(#cone)" opacity="0.1" />)}
      <rect x="0" y="470" width={W} height="70" fill="#0d1226" stroke="#05070f" strokeWidth="2.400" />
      <path d="M0 470H360" stroke="#38e1ff" strokeWidth="1.400" opacity="0.6" filter="url(#glow)" />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 42 + 6} y="482" width="30" height="6" rx="2" fill="#1a2244" stroke="#38e1ff" strokeOpacity="0.2" strokeWidth="0.6" />)}
      <path d="M70 470L100 420H260L290 470z" fill="url(#steel)" stroke="#05070f" strokeWidth="3" strokeLinejoin="round" />
      <path d="M96 428H264" stroke="#9fb4de" strokeWidth="1.600" opacity="0.6" />
      <rect x="0" y="70" width="14" height="400" fill="url(#steel)" stroke="#05070f" strokeWidth="2.400" /><rect x="346" y="70" width="14" height="400" fill="url(#steel)" stroke="#05070f" strokeWidth="2.400" />
      <path d="M14 110C60 150 40 230 14 260M346 100C300 150 320 240 346 280" stroke="#ff4d5e" strokeWidth="2.600" fill="none" strokeLinecap="round" filter="url(#glow)" opacity="0.85" />
      <path d="M14 130C70 180 50 250 14 300M346 130C290 190 316 260 346 320" stroke="#38e1ff" strokeWidth="2.200" fill="none" strokeLinecap="round" filter="url(#glow)" opacity="0.85" />
    </g>
  );
});

// Spicchio di corona circolare tra due raggi e due angoli.
export const wedge = (cx, cy, ri, ro, a0, a1) => {
  const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  return `M${p(ri, a0)}L${p(ro, a0)}A${ro} ${ro} 0 0 1 ${p(ro, a1)}L${p(ri, a1)}A${ri} ${ri} 0 0 0 ${p(ri, a0)}z`;
};

export const Vignette = () => <rect width={W} height={H} fill="url(#vig)" pointerEvents="none" />;
