// Glifi sci-fi minimali, riquadro 24×24: tratto neon sottile, riempimento traslucido, nessun contorno spesso.
// Il bagliore è dato da CSS (.ds-icon). Uso: <Icon name="coin" size={22} />.
const C = { cyan: '#38e1ff', amber: '#ffb347', green: '#4dff9a', red: '#ff4d5e', violet: '#b388ff', ice: '#e6f4ff', dim: '#6b7da3' };
const stroke = (c, w = 1.7) => ({ stroke: c, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' });
const Glyph = ({ d, c, w, fill = 0.16 }) => <path d={d} fill={c} fillOpacity={fill} {...stroke(c, w)} />;
const Line = ({ d, c = C.ice, w = 1.7 }) => <path d={d} fill="none" {...stroke(c, w)} />;
const Ring3 = ({ c }) => (
  <>
    <circle cx="12" cy="12" r="8.5" fill={c} fillOpacity="0.08" stroke={c} strokeWidth="2.6" strokeDasharray="11 3.6" strokeLinecap="round" />
    <circle cx="12" cy="12" r="4.2" fill="none" stroke={c} strokeOpacity="0.55" strokeWidth="1.2" />
    <circle cx="12" cy="12" r="1.5" fill={C.ice} />
  </>
);

const shapes = {
  // gettone esagonale con nucleo a rombo
  coin: () => <><Glyph d="M12 2.5l7.8 4.5v10L12 21.5 4.2 17V7z" c={C.amber} fill={0.18} /><Line d="M12 2.5v3.2M12 18.3v3.2" c={C.amber} w={1.3} /><circle cx="12" cy="12" r="3.6" fill="none" {...stroke(C.amber, 1.5)} /><path d="M12 9.6l1.8 2.4-1.8 2.4-1.8-2.4z" fill={C.ice} /></>,
  clock: () => <><circle cx="12" cy="12" r="9" fill={C.cyan} fillOpacity="0.1" {...stroke(C.cyan)} /><Line d="M12 6.5V12l3.6 2.2" c={C.ice} /><Line d="M12 3.2v1.4M12 19.4v1.4M3.2 12h1.4M19.4 12h1.4" c={C.cyan} w={1.2} /></>,
  bolt: () => <><Glyph d="M13.6 2.5L5 13.4h6.2l-1.1 8.1 8.9-11.5h-6.3z" c={C.amber} fill={0.22} /><Line d="M12.6 7.2l-2.9 4.2" c={C.ice} w={1.1} /></>,
  star: () => <Glyph d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z" c={C.amber} fill={0.22} />,
  // chiave a settore con testa aperta e rivetto
  wrench: () => <><Glyph d="M15.2 3.4a4.6 4.6 0 0 0-4.1 6.5L3.9 17.100l3 3 7.200-7.200a4.600 4.600 0 0 0 6.400-4.200l-2.900 2.900-2.700-.7-.7-2.700z" c={C.cyan} fill={0.16} /><circle cx="6.900" cy="17.100" r="1" fill={C.ice} /></>,
  play: () => <><Glyph d="M6.500 4.200v15.600L19.500 12z" c={C.green} fill={0.2} /><Line d="M6.500 12h5" c={C.ice} w={1.1} /></>,
  pause: () => <><Glyph d="M6 4.500h4v15H6zM14 4.500h4v15h-4z" c={C.green} fill={0.2} /></>,
  check: () => <Line d="M4.800 12.500l4.700 4.600L19.400 7" c={C.green} w={2.4} />,
  cross: () => <Line d="M6 6l12 12M18 6L6 18" c={C.red} w={2.4} />,
  lock: () => <><Line d="M8 11V8a4 4 0 0 1 8 0v3" c={C.cyan} /><Glyph d="M5 11h14v9.500H5z" c={C.cyan} fill={0.18} /><circle cx="12" cy="15.700" r="1.300" fill={C.ice} /></>,
  help: () => <><circle cx="12" cy="12" r="9" fill={C.cyan} fillOpacity="0.12" {...stroke(C.cyan)} /><Line d="M9.200 9.400a2.900 2.900 0 1 1 4.200 2.600c-.900.500-1.400 1-1.400 2" c={C.ice} /><circle cx="12" cy="17.200" r="1.100" fill={C.ice} /></>,
  globe: () => <><circle cx="12" cy="12" r="9" fill={C.cyan} fillOpacity="0.1" {...stroke(C.cyan)} /><Line d="M3 12h18M12 3c3.200 3 3.200 15 0 18M12 3c-3.200 3-3.200 15 0 18" c={C.cyan} w={1.2} /></>,
  ring: () => <><circle cx="12" cy="12" r="8.200" fill="none" {...stroke(C.ice, 1.6)} /><circle cx="12" cy="12" r="5.200" fill="none" {...stroke(C.cyan, 1.2)} strokeDasharray="2 2.200" /><circle cx="12" cy="3.800" r="2" fill={C.amber} /></>,
  beam: () => <><Line d="M2.500 12h19" c={C.cyan} w={2} /><circle cx="15.500" cy="12" r="3" fill={C.ice} /></>,
  atom: () => <><ellipse cx="12" cy="12" rx="9.500" ry="3.800" fill="none" {...stroke(C.cyan, 1.4)} /><ellipse cx="12" cy="12" rx="9.500" ry="3.800" transform="rotate(60 12 12)" fill="none" {...stroke(C.violet, 1.4)} /><ellipse cx="12" cy="12" rx="9.500" ry="3.800" transform="rotate(120 12 12)" fill="none" {...stroke(C.green, 1.4)} /><circle cx="12" cy="12" r="2.200" fill={C.amber} /></>,
  flask: () => <><Line d="M9.200 3h5.600M10 3v6.200L4.800 18.300A2 2 0 0 0 6.500 21.300h11a2 2 0 0 0 1.700-3L14 9.200V3" c={C.green} w={1.6} /><path d="M6.700 16.500h10.600l1.300 2.200a1 1 0 0 1-.9 1.500H6.300a1 1 0 0 1-.9-1.500z" fill={C.green} fillOpacity="0.35" /></>,
  sun: () => <><circle cx="12" cy="12" r="4.200" fill={C.amber} fillOpacity="0.25" {...stroke(C.amber)} /><Line d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100" c={C.amber} w={1.4} /></>,
  chevron: () => <path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  back: () => <path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  plus: () => <path d="M12 4.500v15M4.500 12h15" fill="none" stroke="currentColor" strokeWidth="2.800" strokeLinecap="round" />,
  close: () => <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" />,
  tracker: () => <Ring3 c={C.cyan} />,
  ecal: () => <Ring3 c={C.green} />,
  hcal: () => <Ring3 c={C.amber} />,
  muon: () => <Ring3 c={C.violet} />,
  daq: () => <><Glyph d="M6 6h12v12H6z" c={C.cyan} fill={0.14} /><Line d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" c={C.cyan} w={1.2} /><path d="M9.500 12h5" stroke={C.green} strokeWidth="1.600" strokeLinecap="round" /></>,
};
shapes.rho = shapes.atom;

export const ICON_NAMES = Object.keys(shapes);

export function Icon({ name, size = 22, className }) {
  const draw = shapes[name];
  if (!draw) return null;
  return <svg className={`ds-icon${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">{draw()}</svg>;
}
