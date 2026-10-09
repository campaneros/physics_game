// Nucleo puro del gioco: fisica 2D, forme, seed, punteggio. Nessun DOM, testabile con Node.
// Arena = quadrato unitario [0,1]^2. Riusabile dall'idle game / modalità a budget.
(function (root) {
  'use strict';

  const EPS = 1e-9;
  const MAX_BOUNCES = 50;
  const MIN_INWARD = 0.15; // coseno minimo tra direzione e normale entrante
  const CHOICES = 5;
  const MAX_SCORE = 100;
  const PENALTY_PER_EXTRA_LAUNCH = 10;

  const regular = (n, r) =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [r * Math.cos(a), r * Math.sin(a)];
    });

  const star = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const r = i % 2 === 0 ? 0.3 : 0.13;
    return [r * Math.cos(a), r * Math.sin(a)];
  });

  // Poligoni centrati in (0,0), semi-estensione <= 0.3.
  const SHAPES = [
    { id: 'triangolo', pts: regular(3, 0.3) },
    { id: 'quadrato', pts: [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]] },
    { id: 'rettangolo', pts: [[-0.3, -0.15], [0.3, -0.15], [0.3, 0.15], [-0.3, 0.15]] },
    { id: 'pentagono', pts: regular(5, 0.28) },
    { id: 'esagono', pts: regular(6, 0.28) },
    { id: 'rombo', pts: [[0, -0.3], [0.2, 0], [0, 0.3], [-0.2, 0]] },
    { id: 'stella', pts: star },
    { id: 'L', pts: [[-0.2, -0.25], [-0.05, -0.25], [-0.05, 0.1], [0.2, 0.1], [0.2, 0.25], [-0.2, 0.25]] },
    { id: 'T', pts: [[-0.25, -0.25], [0.25, -0.25], [0.25, -0.1], [0.075, -0.1], [0.075, 0.25], [-0.075, 0.25], [-0.075, -0.1], [-0.25, -0.1]] },
    { id: 'freccia', pts: [[0, -0.3], [0.2, 0], [0.08, 0], [0.08, 0.3], [-0.08, 0.3], [-0.08, 0], [-0.2, 0]] },
  ];

  // --- seed deterministico (FNV-1a + mulberry32) ---------------------------
  const hash = (s) => {
    let h = 2166136261;
    for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
    return h >>> 0;
  };

  const rng = (seed) => {
    let a = seed | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const shuffle = (arr, r) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  // `pool`: id delle forme ammesse (difficoltà). Default: tutte.
  function newGame(seed, pool) {
    const r = rng(hash(seed));
    const allowed = pool && pool.length >= CHOICES ? SHAPES.filter((sh) => pool.includes(sh.id)) : SHAPES;
    const answer = allowed[Math.floor(r() * allowed.length)];
    const rot = r() * 2 * Math.PI;
    const dx = (r() - 0.5) * 0.12;
    const dy = (r() - 0.5) * 0.12;
    const [c, s] = [Math.cos(rot), Math.sin(rot)];
    const poly = answer.pts.map(([x, y]) => [0.5 + dx + x * c - y * s, 0.5 + dy + x * s + y * c]);
    const others = shuffle(allowed.filter((sh) => sh.id !== answer.id), r).slice(0, CHOICES - 1);
    const choices = shuffle([answer, ...others], r).map((sh) => sh.id);
    return { seed: String(seed), answer: answer.id, poly, choices };
  }

  // --- fisica --------------------------------------------------------------
  function nearestHit(p, d, poly, skip) {
    let best = null;
    for (let i = 0; i < poly.length; i++) {
      if (i === skip) continue;
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const den = d[0] * ey - d[1] * ex;
      if (Math.abs(den) < EPS) continue; // parallelo
      const wx = a[0] - p[0];
      const wy = a[1] - p[1];
      const t = (wx * ey - wy * ex) / den;
      const u = (wx * d[1] - wy * d[0]) / den;
      if (t > EPS && u >= -EPS && u <= 1 + EPS && (!best || t < best.t)) best = { t, i, ex, ey };
    }
    return best;
  }

  function wallExit(p, d) {
    let t = Infinity;
    for (const k of [0, 1]) {
      if (d[k] > EPS) t = Math.min(t, (1 - p[k]) / d[k]);
      else if (d[k] < -EPS) t = Math.min(t, -p[k] / d[k]);
    }
    const clamp = (v) => Math.min(1, Math.max(0, v));
    return [clamp(p[0] + t * d[0]), clamp(p[1] + t * d[1])];
  }

  // Lancia da `entry` (sul bordo) con direzione `dir` (verso l'interno). Riflessione speculare.
  function trace(entry, dir, poly) {
    const len = Math.hypot(dir[0], dir[1]);
    let d = [dir[0] / len, dir[1] / len];
    let p = entry.slice();
    let skip = -1;
    let bounces = 0;
    while (bounces < MAX_BOUNCES) {
      const hit = nearestHit(p, d, poly, skip);
      if (!hit) break;
      const nl = Math.hypot(hit.ex, hit.ey);
      const n = [-hit.ey / nl, hit.ex / nl];
      const dn = d[0] * n[0] + d[1] * n[1];
      p = [p[0] + hit.t * d[0], p[1] + hit.t * d[1]];
      d = [d[0] - 2 * dn * n[0], d[1] - 2 * dn * n[1]];
      skip = hit.i;
      bounces++;
    }
    return { exit: wallExit(p, d), dir: d, bounces };
  }

  // Punto sul bordo più vicino a (x,y) e normale entrante.
  function entryFromPoint(x, y) {
    const cx = Math.min(1, Math.max(0, x));
    const cy = Math.min(1, Math.max(0, y));
    const sides = [
      { dist: cx, p: [0, cy], n: [1, 0] },
      { dist: 1 - cx, p: [1, cy], n: [-1, 0] },
      { dist: cy, p: [cx, 0], n: [0, 1] },
      { dist: 1 - cy, p: [cx, 1], n: [0, -1] },
    ];
    const s = sides.reduce((m, c) => (c.dist < m.dist ? c : m));
    return { p: s.p, n: s.n };
  }

  const isInward = (dir, n) => {
    const len = Math.hypot(dir[0], dir[1]);
    return len > EPS && (dir[0] * n[0] + dir[1] * n[1]) / len >= MIN_INWARD;
  };

  const score = (launches, correct) =>
    correct && launches > 0 ? Math.max(0, MAX_SCORE - PENALTY_PER_EXTRA_LAUNCH * (launches - 1)) : 0;

  const api = { SHAPES, newGame, trace, entryFromPoint, isInward, score, hash, rng, MAX_BOUNCES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof self !== 'undefined' ? self : globalThis);
