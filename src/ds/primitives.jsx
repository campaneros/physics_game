// Componenti base del design system. Tutti passano className/id/aria-*/data-* al nodo radice, così i selettori dei test restano validi.
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

export function Meter({ value, tone = 'cyan', label, className }) {
  const w = Math.max(0, Math.min(1, value));
  return (
    <span className={cx('ds-meter', `ds-meter--${tone}`, className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(w * 100)} aria-label={label}>
      <i style={{ width: `${w * 100}%` }} />
    </span>
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
