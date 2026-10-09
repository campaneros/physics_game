// Componente minigioco "La forma nascosta". Costruisce il proprio DOM; testo sempre via textContent.
(() => {
  'use strict';
  const { SHAPES, newGame, trace, entryFromPoint, isInward, score } = Core;

  const AIM_STUB = 0.16;
  const MIN_DRAG = 0.05;
  const COLORS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#c084fc'];
  const HINT_PLAY = 'Tocca vicino a un bordo e trascina verso l\'interno, poi rilascia per lanciare.';
  const shapeById = new Map(SHAPES.map((s) => [s.id, s]));

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const button = (text, onClick) => {
    const b = el('button', null, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };

  function pathPoly(c, pts, S, ox = 0, oy = 0) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(ox + x * S, oy + y * S) : c.moveTo(ox + x * S, oy + y * S)));
    c.closePath();
  }

  // opts: { seed, pool, maxLaunches, label, shareLabel, onNew(), onClose(result), onCancel() }
  function create(container, opts) {
    const maxLaunches = opts.maxLaunches || 15;
    const game = newGame(opts.seed, opts.pool);
    let launches = [];
    let phase = 'play';
    let aim = null;
    let shareText = '';

    const root = el('div', 'mg');
    const status = el('p', 'mg-status');
    const canvas = el('canvas', 'mg-canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Arena di gioco: lancia particelle e osserva dove escono');
    const hint = el('p', 'mg-hint', HINT_PLAY);
    hint.setAttribute('role', 'status');
    const choices = el('div', 'mg-choices');
    const result = el('div', 'mg-result');
    result.hidden = true;
    const resultText = el('p', 'mg-result-text');
    resultText.setAttribute('role', 'status');
    const row = el('div', 'row');
    result.append(resultText, row);
    const cancel = opts.onCancel ? button('Annulla', () => opts.onCancel()) : null;
    root.append(status, canvas, hint, result, choices);
    if (cancel) root.append(cancel);
    container.append(root);

    const ctx = canvas.getContext('2d');
    const setStatus = () => { status.textContent = `${opts.label || ''} · Lanci: ${launches.length}/${maxLaunches}`; };

    // --- disegno -----------------------------------------------------------
    function dot(x, y, r, color, ring) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      if (ring) { ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke(); }
      else { ctx.fillStyle = color; ctx.fill(); }
    }
    function label(n, x, y, S, color) {
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(S * 0.04)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), x, y);
    }
    function draw() {
      const S = canvas.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, S, S);
      if (phase === 'done') {
        pathPoly(ctx, game.poly, S);
        ctx.fillStyle = 'rgba(56,189,248,0.25)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
      }
      const r = S * 0.022;
      // i marcatori restano interi anche sul bordo dell'arena
      const at = ([x, y]) => [Math.min(S - r, Math.max(r, x * S)), Math.min(S - r, Math.max(r, y * S))];
      launches.forEach((l, i) => {
        const color = COLORS[i % COLORS.length];
        const [ix, iy] = at(l.entry);
        const [ox, oy] = at(l.exit);
        dot(ix, iy, r, color, false);
        dot(ox, oy, r, color, true);
        label(i + 1, ix, iy, S, '#0b1220');
        label(i + 1, ox, oy, S, color);
      });
      if (aim) {
        const [ex, ey] = aim.entry.p;
        const dir = [aim.cur[0] - ex, aim.cur[1] - ey];
        const len = Math.hypot(dir[0], dir[1]) || 1;
        ctx.strokeStyle = isInward(dir, aim.entry.n) ? '#ffffff' : '#f87171';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ex * S, ey * S);
        ctx.lineTo((ex + (dir[0] / len) * AIM_STUB) * S, (ey + (dir[1] / len) * AIM_STUB) * S);
        ctx.stroke();
        dot(ex * S, ey * S, r, ctx.strokeStyle, false);
      }
    }
    function resize() {
      const px = Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1));
      if (px > 0 && canvas.width !== px) { canvas.width = px; canvas.height = px; }
      draw();
    }

    // --- scelte e risposta -------------------------------------------------
    function buildChoices() {
      choices.replaceChildren();
      game.choices.forEach((id) => {
        const sh = shapeById.get(id);
        const btn = el('button', 'choice');
        btn.type = 'button';
        btn.disabled = phase !== 'play';
        const thumb = el('canvas');
        thumb.width = 56; thumb.height = 56;
        const c = thumb.getContext('2d');
        pathPoly(c, sh.pts, 56 / 0.7, 28, 28);
        c.fillStyle = '#94a3c0';
        c.fill();
        btn.append(thumb, el('span', null, sh.name));
        btn.addEventListener('click', () => onGuess(id));
        choices.append(btn);
      });
    }

    function onGuess(id) {
      if (phase !== 'play') return;
      if (!launches.length) { hint.textContent = 'Fai almeno un lancio prima di rispondere.'; return; }
      phase = 'done';
      const ok = id === game.answer;
      const n = launches.length;
      const pts = score(n, ok);
      const answerName = shapeById.get(game.answer).name;
      resultText.textContent = ok
        ? `Esatto! Era: ${answerName}. ${n} ${n === 1 ? 'lancio' : 'lanci'}, ${pts} punti.`
        : `Sbagliato. Era: ${answerName}. 0 punti.`;
      // solo costanti, numeri e emoji: niente stringhe esterne nel testo condiviso
      const day = /^\d{4}-\d{2}-\d{2}$/.test(game.seed) ? ` ${game.seed}` : '';
      shareText = `La forma nascosta${day}\n${ok ? '✅' : '❌'} ${n} ${n === 1 ? 'lancio' : 'lanci'} · ${pts}/100`;
      row.replaceChildren();
      if (opts.shareLabel) row.append(button(opts.shareLabel, shareBtnHandler));
      if (opts.onNew) row.append(button('Nuova partita', () => opts.onNew()));
      if (opts.onClose) row.append(button('Continua', () => opts.onClose({ ok, launches: n, score: pts })));
      result.hidden = false;
      if (cancel) cancel.hidden = true;
      hint.textContent = '';
      buildChoices();
      draw();
    }

    async function shareBtnHandler(e) {
      const btn = e.currentTarget;
      const original = btn.textContent;
      try {
        if (navigator.share) await navigator.share({ text: shareText });
        else await navigator.clipboard.writeText(shareText);
        btn.textContent = 'Fatto!';
      } catch (err) {
        btn.textContent = err && err.name === 'AbortError' ? original : 'Non riuscito';
      }
      setTimeout(() => { btn.textContent = original; }, 1500);
    }

    // --- input (Pointer Events) -------------------------------------------
    const toUnit = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (phase !== 'play') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = toUnit(e);
      aim = { entry: entryFromPoint(x, y), cur: [x, y] };
      draw();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!aim) return;
      aim.cur = toUnit(e);
      draw();
    });
    canvas.addEventListener('pointerup', () => {
      if (!aim) return;
      const a = aim;
      aim = null;
      const dir = [a.cur[0] - a.entry.p[0], a.cur[1] - a.entry.p[1]];
      if (Math.hypot(dir[0], dir[1]) < MIN_DRAG || !isInward(dir, a.entry.n)) {
        hint.textContent = 'Trascina verso l\'interno per lanciare.';
      } else if (launches.length >= maxLaunches) {
        hint.textContent = 'Lanci finiti: scegli la forma.';
      } else {
        launches.push({ entry: a.entry.p, exit: trace(a.entry.p, dir, game.poly).exit });
        setStatus();
        hint.textContent = 'Dove è uscita? Prova un altro lancio o scegli la forma.';
      }
      draw();
    });
    canvas.addEventListener('pointercancel', () => { aim = null; draw(); });

    window.addEventListener('resize', resize);
    setStatus();
    buildChoices();
    requestAnimationFrame(resize);

    return {
      destroy() {
        window.removeEventListener('resize', resize);
        root.remove();
      },
    };
  }

  window.Minigame = { create };
})();
