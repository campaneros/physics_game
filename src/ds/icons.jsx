// Icone con contorno a inchiostro, riquadro 24×24. Ogni icona è un frammento SVG: <Icon name="coin" size={22} />.
const INK = '#04070e';
const o = { stroke: INK, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' };
const line = (d, c = '#e6ebf5', w = 2.4) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;

const shapes = {
  coin: () => <><circle cx="12" cy="12" r="9.5" fill="url(#ds-g-gold)" {...o} />{line('M12 6.5v11M9.2 9.4h4.4a1.9 1.9 0 0 1 0 3.8h-3.2a1.9 1.9 0 0 0 0 3.8h4.6', '#5b3d08', 1.9)}</>,
  clock: () => <><circle cx="12" cy="12" r="9.5" fill="#1c2a47" {...o} />{line('M12 6.5V12l3.8 2.2', '#38bdf8', 2.2)}</>,
  bolt: () => <path d="M13.5 2L4.5 13.5h6L9.5 22l10-12.5h-6.4z" fill="url(#ds-g-gold)" {...o} />,
  star: () => <path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.5 6 20.900l1.300-6.700-5-4.700 6.800-.800z" fill="url(#ds-g-gold)" {...o} />,
  wrench: () => <><path d="M15 3.5a5 5 0 0 0-4.900 6.600L3.800 16.400a2.100 2.100 0 0 0 3 3l6.300-6.300A5 5 0 0 0 19.700 8.200l-3 3-2.800-.6-.6-2.800z" fill="url(#ds-g-steel)" {...o} /></>,
  play: () => <path d="M7 3.800l13 8.200-13 8.200z" fill="url(#ds-g-green)" {...o} />,
  pause: () => <><rect x="5.500" y="4" width="4.500" height="16" rx="1.200" fill="url(#ds-g-steel)" {...o} /><rect x="14" y="4" width="4.500" height="16" rx="1.200" fill="url(#ds-g-steel)" {...o} /></>,
  check: () => <path d="M4.500 12.500l5 5L20 6.500" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />,
  cross: () => <path d="M5.500 5.500l13 13M18.500 5.500l-13 13" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />,
  lock: () => <><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke={INK} strokeWidth="4.200" strokeLinecap="round" />{line('M8 11V8a4 4 0 0 1 8 0v3', '#94a3c0', 2)}<rect x="4.500" y="10.500" width="15" height="11" rx="2.500" fill="url(#ds-g-steel)" {...o} /></>,
  help: () => <><circle cx="12" cy="12" r="9.500" fill="url(#ds-g-blue)" {...o} />{line('M9.200 9.300a2.900 2.900 0 1 1 4.200 2.600c-.900.500-1.400 1-1.400 2', '#fff', 2.200)}<circle cx="12" cy="17.200" r="1.300" fill="#fff" /></>,
  globe: () => <><circle cx="12" cy="12" r="9.500" fill="url(#ds-g-blue)" {...o} />{line('M2.800 12h18.400M12 2.500c3 3 3 16 0 19M12 2.500c-3 3-3 16 0 19', '#fff', 1.400)}</>,
  ring: () => <><circle cx="12" cy="12" r="8" fill="none" stroke={INK} strokeWidth="6" /><circle cx="12" cy="12" r="8" fill="none" stroke="url(#ds-g-steel)" strokeWidth="3.200" /><circle cx="12" cy="4" r="2.600" fill="#fde047" {...o} /></>,
  beam: () => <><path d="M2 12h20" stroke={INK} strokeWidth="6" strokeLinecap="round" /><path d="M2 12h20" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" /><circle cx="16" cy="12" r="3" fill="#fff" {...o} /></>,
  atom: () => <><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke={INK} strokeWidth="3.600" /><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#38bdf8" strokeWidth="1.600" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" fill="none" stroke={INK} strokeWidth="3.600" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" fill="none" stroke="#a78bfa" strokeWidth="1.600" /><circle cx="12" cy="12" r="2.800" fill="url(#ds-g-gold)" {...o} /></>,
  flask: () => <><path d="M9 3h6M10 3v6l-5.500 9.500A2 2 0 0 0 6.200 21.500h11.600a2 2 0 0 0 1.700-3L14 9V3" fill="#1c2a47" {...o} /><path d="M7.200 16h9.600l1.700 3a.9.900 0 0 1-.8 1.400H6.300a.9.900 0 0 1-.8-1.400z" fill="url(#ds-g-green)" /></>,
  chevron: () => <path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />,
  back: () => <path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />,
  plus: () => <path d="M12 4.500v15M4.500 12h15" fill="none" stroke="currentColor" strokeWidth="3.200" strokeLinecap="round" />,
  close: () => <path d="M5.500 5.500l13 13M18.500 5.500l-13 13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />,
  tracker: () => <><circle cx="12" cy="12" r="8.500" fill="none" stroke={INK} strokeWidth="6" /><circle cx="12" cy="12" r="8.500" fill="none" stroke="#38bdf8" strokeWidth="3.200" /><circle cx="12" cy="12" r="2.300" fill="#e6ebf5" {...o} /></>,
  ecal: () => <><circle cx="12" cy="12" r="8.500" fill="none" stroke={INK} strokeWidth="6" /><circle cx="12" cy="12" r="8.500" fill="none" stroke="#34d399" strokeWidth="3.200" /><circle cx="12" cy="12" r="2.300" fill="#e6ebf5" {...o} /></>,
  hcal: () => <><circle cx="12" cy="12" r="8.500" fill="none" stroke={INK} strokeWidth="6" /><circle cx="12" cy="12" r="8.500" fill="none" stroke="#fb923c" strokeWidth="3.200" /><circle cx="12" cy="12" r="2.300" fill="#e6ebf5" {...o} /></>,
  muon: () => <><circle cx="12" cy="12" r="8.500" fill="none" stroke={INK} strokeWidth="6" /><circle cx="12" cy="12" r="8.500" fill="none" stroke="#a78bfa" strokeWidth="3.200" /><circle cx="12" cy="12" r="2.300" fill="#e6ebf5" {...o} /></>,
  daq: () => <><rect x="4" y="3" width="16" height="18" rx="2.500" fill="#1c2a47" {...o} /><circle cx="8.500" cy="8" r="1.600" fill="#4ade80" /><circle cx="8.500" cy="13" r="1.600" fill="#4ade80" />{line('M12.500 8h4.500M12.500 13h4.500M8 17.500h9', '#94a3c0', 1.600)}</>,
};
shapes.rho = shapes.atom;

export const ICON_NAMES = Object.keys(shapes);

export function Icon({ name, size = 22, className }) {
  const draw = shapes[name];
  if (!draw) return null;
  return <svg className={`ds-icon${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">{draw()}</svg>;
}
