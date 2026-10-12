// Modello di fisica: collisioni → trigger → detector → analisi → segnale S, fondo B, significatività Z.
// Funzioni pure sullo stato di gioco `s`; nessun DOM.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const PR = isNode ? require('./processes.js') : root.Processes;
  const C = isNode ? require('./core.js') : root.Core;

  const BASE_LUMI = 5; // fb⁻¹ all'anno a luminosità livello 0
  const MAX_LUMI = 12;
  const LUMI_GROWTH = 2.5; // la luminosità cresce di 2,5× per livello
  const DAQ_GROWTH = 6; // la banda del trigger cresce di 6× per livello DAQ
  const AGE_SCALE = 30000; // fb⁻¹ di dose: il danno da radiazione satura (al massimo ×2 su efficienza e risoluzione)
  const BANDWIDTH = 15; // banda del trigger a DAQ livello 0 (unità arbitrarie)
  const Z_DISCOVERY = 5;
  const Z_LIMIT = 3;
  const SYST_VALID = 0.75; // le regioni di controllo riducono le sistematiche
  const BINS = 24;
  const SPAN = 6; // istogramma: ±6σ di risoluzione intorno alla massa

  const lumiRate = (s) => BASE_LUMI * LUMI_GROWTH ** s.lumiLvl * PR.COLLIDERS[s.collider].lumi;
  const pileup = (s) => 1 + 0.25 * s.lumiLvl;
  const energy = (s) => PR.COLLIDERS[s.collider].energies[s.energyLvl];
  const damage = (s, k) => 1 - Math.exp(-(s.age[k] || 0) / AGE_SCALE); // 0..1
  const searchExists = (s, p) => C.rng(C.hash(`${s.seed}:exists:${p.id}`))() < p.existsP;

  // Z di Asimov per segnale S su fondo B (valido anche a basso numero di eventi).
  function asimov(S, B) {
    if (!(S > 0)) return 0;
    const b = Math.max(B, 1e-9);
    return Math.sqrt(2 * ((S + b) * Math.log(1 + S / b) - S));
  }

  // Sottosistemi che contano per un processo: quelli richiesti (peso 1) e quelli del suo menu di trigger.
  function relevant(p) {
    const w = {};
    for (const k of Object.keys(p.need)) w[k] = 1;
    for (const [k, v] of Object.entries(PR.MENU_SUBS[p.menu] || {})) w[k] = Math.max(w[k] || 0, v);
    return w;
  }

  // Detector: serve il livello minimo di ogni sottosistema richiesto; ogni livello in più (anche nei sottosistemi
  // del menu di trigger) migliora efficienza e risoluzione. Le parti usurate peggiorano entrambe.
  function detector(s, p) {
    for (const [k, lvl] of Object.entries(p.need)) if (s.det[k] < lvl) return { ok: false, eff: 0, res: p.res0, missing: k };
    const w = relevant(p);
    let extra = 0;
    let age = 0;
    let tot = 0;
    for (const [k, wk] of Object.entries(w)) {
      extra += wk * Math.max(0, s.det[k] - (p.need[k] || 0));
      age += wk * (1 + damage(s, k));
      tot += wk;
    }
    extra /= tot;
    age /= tot;
    return {
      ok: true, extra,
      eff: Math.min(0.95, 0.6 + 0.1 * extra) / age,
      res: ((p.res0 / (1 + 0.25 * extra)) * age) * Math.sqrt(pileup(s)),
    };
  }

  // Misure in parallelo: gli adroni ne fanno fino a 1 + livello DAQ, i leptoni una sola.
  const slots = (s) => Math.max(1, Math.min(PR.COLLIDERS[s.collider].maxSlots, PR.COLLIDERS[s.collider].baseSlots + s.det.daq));
  const activeIds = (s) => [s.program, ...(s.extra || [])].filter((id, i, a) => id && PR.BY_ID.has(id) && a.indexOf(id) === i);
  const DEFAULT_CFG = { trig: 0.3, cut: 0.3 };
  const cfgFor = (s, id) => (s.cfg && s.cfg[id]) || DEFAULT_CFG;

  // Cosa guadagna il processo `p` con un livello in più di `k`: miglioramento di risoluzione ed efficienza.
  function upgradeGain(s, p, k) {
    if (s.det[k] >= PR.DETECTOR.maxLevel) return null;
    const next = { ...s, det: { ...s.det, [k]: s.det[k] + 1 } };
    const before = detector(s, p);
    const after = detector(next, p);
    if (!before.ok) {
      // sblocca il processo, o soddisfa il requisito di questo sottosistema (ne mancano altri)
      return after.ok || p.need[k] === s.det[k] + 1 ? { unlocks: true, res: 0, eff: 0 } : null;
    }
    return { unlocks: false, res: 1 - after.res / before.res, eff: after.eff / before.eff - 1 };
  }

  // Il sottosistema che più limita la misura `p`: quello rilevante con meno livelli sopra il minimo (a parità, il più pesante).
  function limitingSub(s, p) {
    const w = relevant(p);
    const list = Object.entries(w).filter(([k]) => s.det[k] < PR.DETECTOR.maxLevel)
      .map(([k, wk]) => ({ k, slack: s.det[k] - (p.need[k] || 0), wk }))
      .sort((a, b) => a.slack - b.slack || b.wk - a.wk);
    return list.length ? list[0].k : 'tracker';
  }

  // Riassunto di un upgrade del sottosistema `k` sui bersagli ancora da fare: cosa sblocca e di quanto migliora.
  function upgradeSummary(s, k) {
    if (k === 'daq') return { unlocks: [], res: 0, eff: 0, n: 0, bw: DAQ_GROWTH, slot: s.collider === 'pp' && slots(s) < PR.COLLIDERS.pp.maxSlots };
    const open = PR.PROCESSES.filter((p) => !(s.done && p.id in s.done));
    const unlocks = [];
    let res = 0;
    let eff = 0;
    let n = 0;
    for (const p of open) {
      const g = upgradeGain(s, p, k);
      if (!g) continue;
      if (g.unlocks) { unlocks.push(p.id); continue; }
      if (g.res > 0.001 || g.eff > 0.001) { res += g.res; eff += g.eff; n += 1; }
    }
    return { unlocks, res: n ? res / n : 0, eff: n ? eff / n : 0, n, bw: 1, slot: false };
  }

  // Trigger: soglia più stretta = meno fondo ma meno segnale. La banda è condivisa da tutte le misure in corso:
  // se la frequenza totale supera la banda si perdono eventi (in proporzione) per tutte.
  const trigFrac = (trig) => (1 - trig) ** 2 + 0.12; // 0.12: fondo che nessuna soglia elimina
  const trigRate = (s, p, trig) => PR.MENU_RATE[p.menu] * LUMI_GROWTH ** s.lumiLvl * trigFrac(trig);
  function trigger(s, p, trig) {
    const f = trigFrac(trig);
    const rate = trigRate(s, p, trig);
    const others = activeIds(s).filter((id) => id !== p.id).reduce((a, id) => a + trigRate(s, PR.BY_ID.get(id), cfgFor(s, id).trig), 0);
    const bandwidth = BANDWIDTH * DAQ_GROWTH ** s.det.daq;
    return { f, epsS: 1 - 0.8 * trig, rate, total: rate + others, shared: others > 0, bandwidth, loss: Math.min(1, bandwidth / (rate + others)) };
  }

  // Valuta il processo `p` con configurazione `cfg` {trig, cut} e luminosità integrata L (fb⁻¹).
  function evaluate(s, p, cfg, L, systMul = 1) {
    const d = detector(s, p);
    if (!d.ok) return { ok: false, d, S: 0, B: 0, Snom: 0, z: 0, znom: 0, sigma: Infinity };
    const col = PR.COLLIDERS[s.collider];
    const tg = trigger(s, p, cfg.trig);
    const xs = Math.min(3, (energy(s) / p.thr[s.collider]) ** 0.4); // più energia sopra soglia = più eventi
    const Snom = L * p.sig * col.sig * xs * d.eff * tg.epsS * tg.loss * Math.exp(-cfg.cut);
    const B = L * p.bkg * col.bkg * xs ** 0.5 * d.eff * tg.f * tg.loss * (d.res / p.res0) * Math.sqrt(pileup(s)) * (0.05 + 0.95 * Math.exp(-3 * cfg.cut)); // fondo irriducibile del 5%
    const exists = p.kind !== 'search' || searchExists(s, p);
    const S = exists ? Snom : 0;
    const stat = Snom > 0 ? Math.sqrt(Snom + B) / Snom : Infinity;
    const syst = p.syst * systMul;
    return {
      ok: true, d, tg, S, B, Snom, z: asimov(S, B), znom: asimov(Snom, B), stat, syst, sigma: Math.hypot(stat, syst), xs,
      sigEff: tg.epsS * Math.exp(-cfg.cut), bkgEff: tg.f * (0.05 + 0.95 * Math.exp(-3 * cfg.cut)),
    };
  }

  // Cerca trigger e selezione che massimizzano la sensibilità (griglia).
  function autotune(s, p) {
    let best = { trig: 0.3, cut: 0.3 };
    let bz = -1;
    for (let i = 0; i <= 18; i++) {
      for (let j = 0; j <= 24; j++) {
        const cfg = { trig: i * 0.05, cut: j * 0.05 };
        const e = evaluate(s, p, cfg, 1000);
        if (e.ok && e.znom > bz) { bz = e.znom; best = cfg; }
      }
    }
    return best;
  }

  // Istogramma di massa osservato (fluttuazioni deterministiche dal seed): segnale + fondo che cala con la massa.
  function histogram(s, p, cfg, L) {
    const e = evaluate(s, p, cfg, L);
    const w = (2 * SPAN) / BINS;
    const xs = Array.from({ length: BINS }, (_, i) => -SPAN + (i + 0.5) * w);
    const bg = xs.map((x) => Math.exp(-0.12 * x));
    const sg = xs.map((x) => Math.exp((-x * x) / 2));
    const sumB = bg.reduce((a, b) => a + b, 0);
    const sumS = sg.reduce((a, b) => a + b, 0);
    const bkgTot = e.ok ? (e.B * (2 * SPAN)) / 4 : 0; // B è definito nella finestra ±2σ
    const expB = bg.map((v) => (bkgTot * v) / sumB);
    const expS = sg.map((v) => ((e.ok ? e.S : 0) * v) / sumS);
    const observed = xs.map((_, i) => {
      const r = C.rng(C.hash(`${s.seed}:${p.id}:bin${i}`));
      const g = Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
      const mu = expB[i] + expS[i];
      return Math.max(0, mu + Math.sqrt(mu) * g);
    });
    return { ok: e.ok, expB, expS, observed };
  }

  // Strategie di analisi: tempo (anni), probabilità base di richiesta di ricontrollo, sensibilità per tipo di segnale.
  const STRATEGIES = {
    cuts: { years: 0.25, p: 0.15, sens: { peak: 0.85, rare: 0.7, nonres: 0.6, precision: 0.6 } },
    bump: { years: 0.5, p: 0.2, sens: { peak: 1.0, rare: 0.8, nonres: 0.45, precision: 0.9 } },
    mva: { years: 1.0, p: 0.45, sens: { peak: 1.15, rare: 1.3, nonres: 1.2, precision: 1.0 } },
    fit: { years: 1.3, p: 0.35, sens: { peak: 0.95, rare: 1.0, nonres: 1.1, precision: 1.25 } },
  };

  function plan(strategy, opts, p) {
    const st = STRATEGIES[strategy];
    const blind = opts.blind ? 1 : 0;
    const valid = opts.valid ? 1 : 0;
    return {
      years: st.years * (1 + 0.1 * blind + 0.15 * valid),
      prob: Math.min(0.9, Math.max(0.03, st.p - 0.25 * valid - 0.05 * blind + (blind ? 0 : 0.1))),
      sens: st.sens[p.type] * (blind ? 1 : 0.95),
    };
  }

  // La revisione chiede (o no) un ricontrollo: deterministico da seed, processo e giro.
  // Qualità dei tagli scelti: i tagli giusti per il processo (dal suo menu) valgono, gli altri fanno perdere segnale.
  const goodCuts = (p) => PR.MENU_CUTS[p.menu];
  function cutQuality(p, chosen) {
    const pick = [...new Set(chosen)].filter((c) => PR.CUTS.includes(c)).slice(0, PR.MAX_CUTS);
    const good = pick.filter((c) => goodCuts(p).includes(c)).length;
    const bad = pick.length - good;
    return { m: Math.min(1, 0.6 + 0.14 * good) * 0.85 ** bad, good, bad, pick };
  }

  const review = (seed, id, round, prob) => C.rng(C.hash(`${seed}:review:${id}:${round}`))() < prob;

  const api = {
    BASE_LUMI, MAX_LUMI, LUMI_GROWTH, AGE_SCALE, BANDWIDTH, Z_DISCOVERY, Z_LIMIT, SYST_VALID, BINS, SPAN, STRATEGIES,
    goodCuts, cutQuality, lumiRate, pileup, energy, damage, searchExists, asimov, detector, relevant, limitingSub, slots, activeIds, cfgFor, upgradeGain, upgradeSummary, trigger, evaluate, autotune, histogram, plan, review,
  };
  if (isNode) module.exports = api;
  else root.Physics = api;
})(typeof self !== 'undefined' ? self : globalThis);
