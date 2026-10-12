// Componenti base del design system. Tutti passano className/id/aria-*/data-* al nodo radice, così i selettori dei test restano validi.
import { useEffect, useRef } from 'react';
import { Icon } from './icons.jsx';

const cx = (...a) => a.filter(Boolean).join(' ');

export function Panel({ title, tone = 'plain', className, children, ...rest }) {
  return (
    <section className={cx('ds-panel', `ds-panel--${tone}`, className)} {...rest}>
      {title && <h2 className="ds-panel__title"><span>{title}</span></h2>}
      {children}
    </section>
  );
}

export function Button({ variant = 'secondary', icon, className, children, type = 'button', ...rest }) {
  return (
    <button type={type} className={cx('ds-btn', `ds-btn--${variant}`, variant === 'primary' && 'primary', className)} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      {children != null && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon, className, ...rest }) {
  return <button type="button" className={cx('ds-ibtn', className)} {...rest}><Icon name={icon} size={22} /></button>;
}

export function Badge({ tone = 'gold', className, children, ...rest }) {
  return <span className={cx('ds-badge', `ds-badge--${tone}`, className)} {...rest}>{children}</span>;
}

// Pulsante-pannello per le azioni principali: icona, etichetta e un badge con il numero che serve a colpo d'occhio.
export function ActionButton({ icon, label, labelClass, badge, tone = 'blue', warn, className, ...rest }) {
  return (
    <button type="button" className={cx('ds-action', `ds-action--${tone}`, warn && 'is-warn', className)} {...rest}>
      {badge != null && <Badge className="ds-action__badge" tone={warn ? 'red' : 'gold'}>{badge}</Badge>}
      <Icon name={icon} size={36} />
      <span className={cx('ds-action__label', labelClass)}>{label}</span>
    </button>
  );
}

// Indicatore a punti (matrice di livello 1..max).
export function Pips({ value, max = 4, need = 0, className }) {
  return (
    <span className={cx('ds-pips', className)} role="img" aria-label={`${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? 'on' : i < need ? 'next' : undefined} />)}
    </span>
  );
}

// Barra di avanzamento: value pieno, next (anteprima di dove si arriva) e mark (soglia) opzionali, tutti frazioni 0..1.
const frac = (v) => `${Math.max(0, Math.min(1, v)) * 100}%`;
export function Meter({ value, next, mark, tone = 'cyan', label, className }) {
  return (
    <span className={cx('ds-meter', `ds-meter--${tone}`, className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(1, value)) * 100)} aria-label={label}>
      {next != null && <i className="ds-meter__next" style={{ width: frac(next) }} />}
      <i style={{ width: frac(value) }} />
      {mark != null && <b className="ds-meter__mark" style={{ left: frac(mark) }} />}
    </span>
  );
}

// Cursore nativo: ascolta input e change dal DOM (non da React) e non salta mentre lo si trascina.
export function Range({ value, min = 0, max = 100, step = 5, onInput, onChange, className, ...rest }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const handlers = useRef({});
  handlers.current = { onInput, onChange };
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const el = ref.current;
    const fire = (name) => () => { const h = handlers.current[name]; if (h) h(Number(el.value)); };
    const input = fire('onInput');
    const change = fire('onChange');
    el.addEventListener('input', input);
    el.addEventListener('change', change);
    return () => { el.removeEventListener('input', input); el.removeEventListener('change', change); };
  }, []);
  useEffect(() => { if (!dragging.current && ref.current) ref.current.value = String(value); }, [value]);
  // al rilascio il cursore torna al valore accettato (es. tetto del budget raggiunto)
  const release = () => { dragging.current = false; if (ref.current) ref.current.value = String(latest.current); };
  return (
    <input
      ref={ref}
      type="range"
      className={cx('ds-range', className)}
      min={min}
      max={max}
      step={step}
      defaultValue={value}
      onPointerDown={() => { dragging.current = true; }}
      onPointerUp={release}
      onPointerCancel={release}
      {...rest}
    />
  );
}

// Voce di checklist (requisito soddisfatto o no).
export function Check({ ok, children, className }) {
  return (
    <li className={cx('ds-check', ok ? 'is-ok ok' : 'is-ko bad', className)}>
      <span className="ds-check__mark"><Icon name={ok ? 'check' : 'cross'} size={14} /></span>
      <span>{children}</span>
    </li>
  );
}

// Nodo della mappa dei progetti/anni.
export function MapNode({ icon = 'atom', state = 'next', label, className, ...rest }) {
  return (
    <button type="button" className={cx('ds-node', `ds-node--${state}`, className)} aria-label={label} disabled={state === 'locked'} {...rest}>
      <Icon name={state === 'locked' ? 'lock' : icon} size={26} />
    </button>
  );
}

// Chip a due stati (aria-pressed): scelte multiple e opzioni.
export function Chip({ pressed, className, children, ...rest }) {
  return <button type="button" className={cx('ds-chip', 'chip', className)} aria-pressed={pressed} {...rest}>{children}</button>;
}

export function Tip({ text, children }) {
  return <span className="ds-tip" data-tip={text}>{children}</span>;
}
