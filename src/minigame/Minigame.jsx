// "La forma nascosta": lancia particelle da un bordo, osserva dove escono e indovina la forma. Il tabellone è un canvas
// (puntatore e disegno restano imperativi, ma vivono in refs); stato, testi e pulsanti sono React.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Core, I18n, tr } from '../engine.js';
import { Button } from '../ds/primitives.jsx';
import { drawBoard, pathPoly } from './draw.js';

const { SHAPES, newGame, trace, entryFromPoint, isInward, score } = Core;
const MIN_DRAG = 0.05;
const THUMB = 56;
const SHARE_RESET_MS = 1500;
const shapeById = new Map(SHAPES.map((s) => [s.id, s]));

function ShapeThumb({ shape }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current.getContext('2d');
    pathPoly(c, shape.pts, THUMB / 0.7, THUMB / 2, THUMB / 2);
    c.fillStyle = '#94a3c0';
    c.fill();
  }, [shape]);
  return <canvas ref={ref} width={THUMB} height={THUMB} />;
}

function ShareButton({ text, label }) {
  const [shown, setShown] = useState(null);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setShown(tr('share.done'));
    } catch (err) {
      setShown(err && err.name === 'AbortError' ? null : tr('share.fail'));
    }
    setTimeout(() => setShown(null), SHARE_RESET_MS);
  };
  return <Button onClick={share}>{shown || label}</Button>;
}

/** opts: seed, pool, maxLaunches, label, shareLabel, onNew, onAlt/altLabel, onCancel, onClose(result), onFinish(result) → testo del premio */
export function Minigame({ seed, pool, maxLaunches = 15, label, shareLabel, onNew, onAlt, altLabel, onCancel, onClose, onFinish }) {
  const game = useMemo(() => newGame(seed, pool), [seed, pool]);
  const [launches, setLaunches] = useState([]);
  const [phase, setPhase] = useState('play');
  const [hint, setHint] = useState(tr('mg.hint.play'));
  const [result, setResult] = useState(null);
  const canvasRef = useRef(null);
  const aim = useRef(null);
  const board = () => ({ poly: game.poly, launches, phase, aim: aim.current });
  const latest = useRef(board);
  latest.current = board;
  const redraw = () => { if (canvasRef.current) drawBoard(canvasRef.current, latest.current()); };

  // la tela segue la sua larghezza reale (pixel del dispositivo)
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      const px = Math.round(c.getBoundingClientRect().width * (window.devicePixelRatio || 1));
      if (px > 0 && c.width !== px) { c.width = px; c.height = px; }
      redraw();
    };
    window.addEventListener('resize', resize);
    const frame = requestAnimationFrame(resize);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(frame); };
  }, []);
  useEffect(redraw, [launches, phase, game]);

  const toUnit = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const onDown = (e) => {
    if (phase !== 'play') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toUnit(e);
    aim.current = { entry: entryFromPoint(x, y), cur: [x, y] };
    redraw();
  };
  const onMove = (e) => {
    if (!aim.current) return;
    aim.current = { ...aim.current, cur: toUnit(e) };
    redraw();
  };
  const onUp = () => {
    const a = aim.current;
    if (!a) return;
    aim.current = null;
    const dir = [a.cur[0] - a.entry.p[0], a.cur[1] - a.entry.p[1]];
    const norm = Math.hypot(dir[0], dir[1]);
    if (norm < MIN_DRAG || !isInward(dir, a.entry.n)) setHint(tr('mg.hint.inward'));
    else if (launches.length >= maxLaunches) setHint(tr('mg.hint.max'));
    else {
      setLaunches([...launches, { entry: a.entry.p, exit: trace(a.entry.p, dir, game.poly).exit, dir: [dir[0] / norm, dir[1] / norm] }]);
      setHint(tr('mg.hint.after'));
    }
    redraw();
  };
  const onCancelAim = () => { aim.current = null; redraw(); };

  const guess = (id) => {
    if (phase !== 'play') return;
    if (!launches.length) { setHint(tr('mg.hint.needlaunch')); return; }
    const ok = id === game.answer;
    const n = launches.length;
    const pts = score(n, ok);
    const answerName = tr(`shape.${game.answer}`);
    // solo costanti, numeri e emoji: niente stringhe esterne nel testo condiviso
    const day = /^\d{4}-\d{2}-\d{2}$/.test(game.seed) ? ` ${game.seed}` : '';
    setResult({
      ok, n, pts,
      text: ok ? tr('mg.right', { shape: answerName, launches: I18n.plural('launch', n), pts }) : tr('mg.wrong', { shape: answerName }),
      share: tr('share.shape', { day, mark: ok ? '✅' : '❌', launches: I18n.plural('launch', n), pts }),
      reward: (onFinish && onFinish({ ok, launches: n, score: pts })) || '',
    });
    setPhase('done');
    setHint('');
  };

  return (
    <div className="mg">
      <p className="mg-status">{tr('mg.status', { label: label || '', n: launches.length, max: maxLaunches })}</p>
      <canvas
        ref={canvasRef}
        className="mg-canvas"
        role="img"
        aria-label={tr('mg.aria')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancelAim}
      />
      <p className="mg-hint" role="status">{hint}</p>
      <p className="mg-legend">{tr('mg.legend')}</p>
      {result && (
        <div className="mg-result">
          <p className="mg-result-text" role="status">{result.text}</p>
          <p className="mg-reward">{result.reward}</p>
          <div className="row">
            {shareLabel && <ShareButton text={result.share} label={shareLabel} />}
            {onNew && <Button onClick={onNew}>{tr('mg.new')}</Button>}
            {onAlt && <Button onClick={onAlt}>{altLabel}</Button>}
            {onClose && <Button variant="primary" onClick={() => onClose({ ok: result.ok, launches: result.n, score: result.pts })}>{tr('mg.continue')}</Button>}
          </div>
        </div>
      )}
      <div className="mg-choices">
        {game.choices.map((id) => {
          const sh = shapeById.get(id);
          return (
            <button key={id} type="button" className="choice" disabled={phase !== 'play'} onClick={() => guess(id)}>
              <ShapeThumb shape={sh} />
              <span>{tr(`shape.${sh.id}`)}</span>
            </button>
          );
        })}
      </div>
      {onCancel && phase === 'play' && <Button onClick={onCancel}>{tr('mg.cancel')}</Button>}
    </div>
  );
}
