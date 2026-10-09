// Modalità budget: distribuire 100 unità tra 5 voci per misurare una massa con la minima incertezza.
// Incertezza totale = somma in quadratura di statistica (1/√N) e sistematica. Modello puro, senza DOM.
(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.Core;

  const BUDGET = 100;
  const STEP = 5;
  const MAX_SIMS = 6;
  const MAX_SCORE = 100;

  const ITEMS = [
    { id: 'lumi', name: 'Luminosità', desc: 'Più collisioni, ma più pile-up e danni da radiazione' },
    { id: 'trigger', name: 'Trigger', desc: 'Seleziona più eventi utili' },
    { id: 'risoluzione', name: 'Risoluzione', desc: 'Rivelatore più preciso' },
    { id: 'calibrazione', name: 'Calibrazione', desc: 'Riduce l\'errore sistematico' },
    { id: 'calcolo', name: 'Calcolo', desc: 'Elabora il flusso di dati: se non basta, perdi eventi' },
  ];

  const RESONANCES = ['Z′ (ipotetica)', 'X(3872)', 'Υ(3S)', 'Bosone Z', 'Bosone di Higgs', 'Quark top'];

  const zero = () => Object.fromEntries(ITEMS.map((i) => [i.id, 0]));

  // Fisica dell'allocazione `x` (unità spese per voce) nello scenario `s`.
  function measure(s, x) {
    const flow = (1 + 0.08 * x.lumi) * (1 - 0.7 * Math.exp(-x.trigger / 15));
    const capacity = 1 + 0.12 * x.calcolo;
    const n = s.n0 * Math.min(flow, capacity);
    const pileup = 1 + 0.02 * x.lumi + 0.0003 * x.lumi ** 2; // pile-up + radiazione
    const res = (s.res / (1 + 0.05 * x.risoluzione)) * pileup;
    const stat = Math.sqrt(s.width ** 2 + res ** 2) / Math.sqrt(n);
    const syst = s.syst / (1 + 0.1 * x.calibrazione);
    return { n, stat, syst, total: Math.hypot(stat, syst) };
  }

  // Tutte le allocazioni a passi di STEP con spesa <= BUDGET: ottimo di riferimento.
  function findOptimum(s) {
    const units = BUDGET / STEP;
    let best = null;
    const walk = (i, left, x) => {
      if (i === ITEMS.length) {
        const m = measure(s, x);
        if (!best || m.total < best.total) best = { ...m, alloc: { ...x } };
        return;
      }
      for (let u = 0; u <= left; u++) walk(i + 1, left - u, { ...x, [ITEMS[i].id]: u * STEP });
    };
    walk(0, units, zero());
    return best;
  }

  function scenario(seed) {
    const r = C.rng(C.hash(`budget-${seed}`));
    const s = {
      seed: String(seed),
      resonance: RESONANCES[Math.floor(r() * RESONANCES.length)],
      n0: 2e4 * (0.5 + r()),
      width: 1.0 * (0.5 + r() * 1.5),
      res: 2.0 * (0.6 + r() * 0.8),
      syst: 0.02 * (0.6 + r() * 1.2),
    };
    return { ...s, optimum: findOptimum(s) };
  }

  const spent = (x) => ITEMS.reduce((sum, i) => sum + x[i.id], 0);

  // Allocazione valida: multipli di STEP, non negativi, entro il budget.
  function isValid(x) {
    return ITEMS.every((i) => Number.isInteger(x[i.id]) && x[i.id] >= 0 && x[i.id] % STEP === 0) && spent(x) <= BUDGET;
  }

  // 100 = come l'ottimo; scende con la quarta potenza del rapporto tra le incertezze.
  function score(s, x) {
    if (!isValid(x)) return 0;
    const ratio = s.optimum.total / measure(s, x).total;
    return Math.min(MAX_SCORE, Math.round(MAX_SCORE * ratio ** 4));
  }

  const api = { BUDGET, STEP, MAX_SIMS, ITEMS, zero, measure, scenario, spent, isValid, score };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Budget = api;
})(typeof self !== 'undefined' ? self : globalThis);
