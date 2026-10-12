// Definizioni SVG condivise (filtri e gradienti): un solo blocco nascosto nel documento, riferito da CSS e dalle icone.
export function Defs() {
  return (
    <svg className="ds-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ds-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 -0.12" />
        </filter>
        <linearGradient id="ds-g-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe39a" /><stop offset="0.55" stopColor="#e3b34b" /><stop offset="1" stopColor="#a47a22" />
        </linearGradient>
        <linearGradient id="ds-g-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc8ff" /><stop offset="0.55" stopColor="#1d7fd6" /><stop offset="1" stopColor="#0b3d78" />
        </linearGradient>
        <linearGradient id="ds-g-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f5ff" /><stop offset="1" stopColor="#8d9dbd" />
        </linearGradient>
        <linearGradient id="ds-g-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a7f3c4" /><stop offset="1" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="ds-g-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fecaca" /><stop offset="1" stopColor="#dc2626" />
        </linearGradient>
        <radialGradient id="ds-g-orb" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#9bd7ff" /><stop offset="0.5" stopColor="#1d7fd6" /><stop offset="1" stopColor="#082e5c" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// Grana di carta fissa dietro a tutto: un solo livello rasterizzato, non ridisegnato durante l'uso.
export function Backdrop() {
  return (
    <svg className="ds-backdrop" aria-hidden="true" focusable="false">
      <rect width="100%" height="100%" filter="url(#ds-grain)" opacity="0.07" />
    </svg>
  );
}
