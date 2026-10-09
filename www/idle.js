// Economia dell'idle game. Funzioni pure e immutabili: ogni azione restituisce un nuovo stato.
(function (root) {
  'use strict';

  const SAVE_VERSION = 1;
  const OFFLINE_CAP_S = 8 * 3600;
  const OFFLINE_EFFICIENCY = 0.5;
  const MAX_LEVEL = 500;
  const MAX_NUM = 1e300;
  const FAIL_KEEPS = 0.5; // sbagliando la conferma resta metà del segnale
  const SHUTDOWN_MIN_DISCOVERIES = 3;
  const SHUTDOWN_BONUS = 0.5; // +50% per Long Shutdown
  const SHUTDOWN_DISCOUNT = 0.9; // x0.9 sui costi per Long Shutdown

  const UPGRADES = [
    { id: 'magneti', name: 'Magneti dipolari', desc: 'Più energia nei fasci', base: 20, growth: 1.9 },
    { id: 'lumi', name: 'Luminosità', desc: 'Più collisioni al secondo', base: 10, growth: 1.28 },
    { id: 'rivel', name: 'Rivelatori', desc: 'Registrano più eventi', base: 40, growth: 1.4 },
    { id: 'calcolo', name: 'Calcolo', desc: 'Analisi dati più veloce', base: 150, growth: 1.55 },
  ];

  const CONVEX = ['triangolo', 'quadrato', 'rettangolo', 'pentagono', 'esagono', 'rombo'];
  const ALL = [...CONVEX, 'L', 'T', 'stella', 'freccia'];
  // Il livello (tier) della scoperta decide forme ammesse e lanci disponibili nella conferma.
  const TIERS = [
    { maxLaunches: 15, pool: CONVEX },
    { maxLaunches: 12, pool: [...CONVEX, 'L', 'T'] },
    { maxLaunches: 10, pool: ALL },
    { maxLaunches: 8, pool: ALL },
  ];

  const DISCOVERIES = [
    { id: 'rho', name: 'Mesone ρ', gev: 0.77, need: 300, tier: 0 },
    { id: 'jpsi', name: 'J/ψ', gev: 3.1, need: 10000, tier: 0 },
    { id: 'upsilon', name: 'Υ (Upsilon)', gev: 9.46, need: 3e5, tier: 1 },
    { id: 'w', name: 'Bosone W', gev: 80.4, need: 8e6, tier: 1 },
    { id: 'z', name: 'Bosone Z', gev: 91.2, need: 3e7, tier: 2 },
    { id: 'higgs', name: 'Bosone di Higgs', gev: 125, need: 1.5e8, tier: 2 },
    { id: 'top', name: 'Quark top', gev: 173, need: 1.5e9, tier: 3 },
  ];

  const upgradeById = new Map(UPGRADES.map((u) => [u.id, u]));

  const zeroLevels = () => Object.fromEntries(UPGRADES.map((u) => [u.id, 0]));

  const newState = (now = Date.now()) => ({
    v: SAVE_VERSION, dati: 0, signal: 0, levels: zeroLevels(),
    discovered: {}, pending: false, shutdowns: 0, last: now,
  });

  // --- derivati ------------------------------------------------------------
  const energy = (s) => 0.5 * 1.45 ** s.levels.magneti;

  const multiplier = (s) =>
    Object.values(s.discovered).reduce((m, x) => m * x, 1) * (1 + SHUTDOWN_BONUS * s.shutdowns);

  const rate = (s) =>
    (1 + 0.5 * s.levels.lumi) * (1 + 0.3 * s.levels.rivel) * (1 + 0.2 * s.levels.calcolo) * multiplier(s);

  const cost = (s, id) => {
    const u = upgradeById.get(id);
    return Math.ceil(u.base * u.growth ** s.levels[id] * SHUTDOWN_DISCOUNT ** s.shutdowns);
  };

  const target = (s) => DISCOVERIES.find((d) => !(d.id in s.discovered)) || null;

  // --- azioni --------------------------------------------------------------
  function tick(s, dt) {
    if (!(dt > 0)) return s;
    const income = rate(s) * dt;
    const t = target(s);
    let { signal, pending } = s;
    if (t && !pending && energy(s) >= t.gev) {
      signal = Math.min(t.need, signal + income);
      pending = signal >= t.need;
    }
    return { ...s, dati: Math.min(MAX_NUM, s.dati + income), signal, pending };
  }

  function buy(s, id) {
    if (!upgradeById.has(id)) return s;
    const price = cost(s, id);
    if (s.dati < price || s.levels[id] >= MAX_LEVEL) return s;
    return { ...s, dati: s.dati - price, levels: { ...s.levels, [id]: s.levels[id] + 1 } };
  }

  // score = punteggio del minigioco 0..100. 0 = conferma sbagliata.
  function confirm(s, score) {
    const t = target(s);
    if (!s.pending || !t) return s;
    if (score > 0) {
      const bonus = 1 + Math.min(100, score) / 100;
      return { ...s, discovered: { ...s.discovered, [t.id]: bonus }, pending: false, signal: 0 };
    }
    return { ...s, pending: false, signal: t.need * FAIL_KEEPS };
  }

  const canShutdown = (s) => Object.keys(s.discovered).length >= SHUTDOWN_MIN_DISCOVERIES;

  function shutdown(s, now = Date.now()) {
    if (!canShutdown(s)) return s;
    return { ...newState(now), discovered: s.discovered, shutdowns: s.shutdowns + 1 };
  }

  // --- salvataggio (dati non fidati: validazione e clamp di ogni campo) -----
  const num = (v, lo, hi, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

  function validate(raw, now) {
    const base = newState(now);
    if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return base;
    const levels = zeroLevels();
    for (const u of UPGRADES) levels[u.id] = Math.floor(num(raw.levels && raw.levels[u.id], 0, MAX_LEVEL, 0));
    const discovered = {};
    for (const d of DISCOVERIES) {
      const m = raw.discovered && raw.discovered[d.id];
      if (typeof m === 'number') discovered[d.id] = num(m, 1, 2, 1);
    }
    const s = {
      v: SAVE_VERSION,
      dati: num(raw.dati, 0, MAX_NUM, 0),
      signal: 0,
      levels,
      discovered,
      pending: false,
      shutdowns: Math.floor(num(raw.shutdowns, 0, 1000, 0)),
      last: num(raw.last, 0, now, now),
    };
    const t = target(s);
    if (t) {
      s.signal = num(raw.signal, 0, t.need, 0);
      s.pending = raw.pending === true && s.signal >= t.need;
    }
    return s;
  }

  const serialize = (s) => JSON.stringify(s);

  // Ritorna { state, away }: `away` = secondi offline accreditati (con efficienza ridotta).
  function load(text, now = Date.now()) {
    let raw = null;
    try { raw = JSON.parse(text); } catch (e) { raw = null; }
    const s = validate(raw, now);
    const away = Math.min(OFFLINE_CAP_S, Math.max(0, (now - s.last) / 1000)) * OFFLINE_EFFICIENCY;
    return { state: tick({ ...s, last: now }, away), away };
  }

  // --- formattazione -------------------------------------------------------
  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  function fmt(n) {
    if (!Number.isFinite(n)) return '∞';
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(2) : String(Math.floor(n));
    const e = Math.floor(Math.log10(n) / 3);
    if (e >= SUFFIX.length) return n.toExponential(2).replace('+', '');
    return (n / 1000 ** e).toFixed(2) + SUFFIX[e];
  }

  const api = {
    UPGRADES, DISCOVERIES, TIERS, newState, energy, multiplier, rate, cost, target,
    tick, buy, confirm, canShutdown, shutdown, serialize, load, validate, fmt,
    SHUTDOWN_MIN_DISCOVERIES,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Idle = api;
})(typeof self !== 'undefined' ? self : globalThis);
