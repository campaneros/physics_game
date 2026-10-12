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

// Orbe del costo, in alto a sinistra sulle carte.
export function Orb({ children, tone = 'blue', className }) {
  return <span className={cx('ds-orb', `ds-orb--${tone}`, className)}>{children}</span>;
}

// Carta: cornice con rarità, nastro del titolo, riquadro illustrazione, corpo e badge d'angolo.
export function Card({ title, titleClass, art, cost, rarity = 'common', badge, selected, locked, className, children, onClick, disabled, ...rest }) {
  const Tag = onClick ? 'button' : 'div';
  const props = onClick ? { type: 'button', onClick, disabled } : {};
  return (
    <Tag className={cx('ds-card', `ds-card--${rarity}`, selected && 'is-selected', locked && 'is-locked', className)} {...props} {...rest}>
      {cost != null && <Orb className="ds-card__cost">{cost}</Orb>}
      {badge != null && <Badge className="ds-card__badge" tone="gold">{badge}</Badge>}
      <span className="ds-card__ribbon"><span className={titleClass}>{title}</span></span>
      <span className="ds-card__art">{typeof art === 'string' ? <Icon name={art} size={34} /> : art}{locked && <span className="ds-card__lock"><Icon name="lock" size={22} /></span>}</span>
      {children != null && <span className="ds-card__body">{children}</span>}
    </Tag>
  );
}

// Reliquia: medaglione rotondo per i potenziamenti permanenti.
export function Relic({ icon, label, level, locked, className, ...rest }) {
  return (
    <button type="button" className={cx('ds-relic', locked && 'is-locked', className)} aria-label={label} {...rest}>
      <Icon name={locked ? 'lock' : icon} size={26} />
      {level != null && !locked && <span className="ds-relic__lvl">{level}</span>}
    </button>
  );
}

// Indicatore a punti (matrice di livello 1..max).
export function Pips({ value, max = 4, className }) {
  return (
    <span className={cx('ds-pips', className)} role="img" aria-label={`${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? 'on' : undefined} />)}
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
    <li className={cx('ds-check', ok ? 'is-ok' : 'is-ko', className)}>
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

export function Tip({ text, children }) {
  return <span className="ds-tip" data-tip={text}>{children}</span>;
}
