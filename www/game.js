// Stato di gioco e azioni. Funzioni pure e immutabili: ogni azione restituisce un nuovo stato.
// Un anno di gioco dura YEAR_S secondi reali. Soldi: un budget annuale (base + finanziamenti temporanei) diviso in tre conti
// (corsa, analisi, sviluppo). Gli upgrade sono progetti di più anni, con rischi, ritardi ed eventi deterministici dal seed.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const PR = isNode ? require('./processes.js') : root.Processes;
  const PH = isNode ? require('./physics.js') : root.Physics;
  const C = isNode ? require('./core.js') : root.Core;

  const SAVE_VERSION = 5;
  const YEAR_S = 360;
  const STEP_S = 5;
  const OFFLINE_CAP_S = 8 * 3600;
  const OFFLINE_EFF = 0.5;
  const MAX_EVENTS = 30;
  const MAX_ROUNDS = 3;
  const REVIEW_EXTRA = 0.3; // ogni ricontrollo aggiunge il 30% del tempo base
  const OVERLAP = 0.25; // lavori in parallelo durante una chiusura: lungo + 25% degli altri
  const SCOOP_FACTOR = 0.5;
  const LIMIT_FACTOR = 0.4;
  const BUDGET_REP = 400;

  // --- budget ----------------------------------------------------------------
  const POOLS = ['ops', 'analysis', 'rnd']; // corsa, analisi, sviluppo
  const START_POOLS = { ops: 450, analysis: 200, rnd: 850 };
  const DEFAULT_ALLOC = { ops: 45, analysis: 15, rnd: 40 };
  const MIN_ALLOC = 10; // ogni conto riceve almeno il 10%: nessuna scelta può bloccare il gioco
  const BASE_BUDGET = 1000;
  const CARRY = 0.5; // il non speso passa all'anno dopo al 50%
  const BOOST_PER_VALUE = 0.25; // +25% della base per punto di importanza
  const BOOST_CAP = 4; // i finanziamenti temporanei non superano +400%
  const boostYears = (value) => (value <= 2 ? 6 : value <= 5 ? 10 : 14);
  const MAX_BOOSTS = 20;

  // --- corse, analisi, progetti ------------------------------------------------
  const RUN_BASE = 40;
  const RUN_YEARS = [1, 2, 5];
  const ANALYSIS_BASE = { cuts: 40, bump: 80, mva: 200, fit: 260 };
  const TRANSFER_FEE = 0.1; // spostare fondi tra conti costa il 10%
  const MAX_PROJECTS = 3;
  const INSTALL_FRACTION = 0.25; // l'installazione costa un quarto del costo di sviluppo
  const RISKS = { safe: { years: 1.3, p: 0.2 }, bold: { years: 0.75, p: 0.5 } };
  const FAST = { rate: 1.4, cost: 1.25 };
  const EVENT_DEADLINE = 0.5; // anni per decidere su un ritardo, poi si accetta
  const MAX_PENDING = 5;
  const CLAIM_SCALE = { shape: 2.5, budget: 4 };
  const CLAIM_COOLDOWN = 2;
  const MAX_CLAIMS = 60;

  const COST = {
    energy: (i) => Math.ceil(40 * 1.6 ** i),
    lumi: (l) => Math.ceil(25 * 1.5 ** l),
    det: (sub, lvl) => Math.ceil(PR.DETECTOR.baseCost[sub] * 2.2 ** lvl),
  };

  const proc = (id) => PR.BY_ID.get(id);
  const omit = (o, k) => Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));
  const other = (c) => (c === 'pp' ? 'ee' : 'pp');
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  function newState(now = Date.now(), seed = 'default') {
    const availAt = {};
    for (const p of PR.PROCESSES) if (p.after.length === 0) availAt[p.id] = 0;
    return {
      v: SAVE_VERSION, seed, pools: { ...START_POOLS }, alloc: { ...DEFAULT_ALLOC }, boosts: [], rep: 0, t: 0,
      collider: 'pp', energyLvl: 0, lumiLvl: 0,
      det: { ...PR.DETECTOR.start }, age: { tracker: 0, ecal: 0 },
      shutdown: null, shutdowns: 0, built: false, run: null, projects: {}, pending: [], claims: {}, program: null,
      data: {}, cfg: {}, jobs: {}, done: {}, availAt, rivalNoted: {},
      budgetBest: {}, events: [], evN: 0, tutorial: false, last: now,
    };
  }

  function ev(s, k, v) {
    const n = s.evN + 1;
    return { ...s, evN: n, events: [...s.events, { n, k, v: v || {} }].slice(-MAX_EVENTS) };
  }

  const spend = (s, pool, amount) => ({ ...s, pools: { ...s.pools, [pool]: s.pools[pool] - amount } });
  const canPay = (s, pool, amount) => s.pools[pool] >= amount;

  // --- budget annuale ------------------------------------------------------------
  // Un finanziamento temporaneo resta pieno per metà della durata e poi cala linearmente a zero.
  const boostFraction = (b, t) => {
    const age = t - b.start;
    if (age < 0 || age >= b.years) return 0;
    const half = b.years / 2;
    return b.amount * (age < half ? 1 : 1 - (age - half) / half);
  };
  const boostTotal = (s, t = s.t) => Math.min(BOOST_CAP, s.boosts.reduce((a, b) => a + boostFraction(b, t), 0));
  const annualBudget = (s, t = s.t) => Math.round(BASE_BUDGET * (1 + boostTotal(s, t)));
  // Previsione degli anni a venire: base + finanziamenti ancora attivi.
  const forecast = (s, n = 5) => Array.from({ length: n }, (_, i) => {
    const year = Math.floor(s.t) + 1 + i;
    return { year, base: BASE_BUDGET, boosts: s.boosts.map((b) => Math.round(BASE_BUDGET * boostFraction(b, year))), total: annualBudget(s, year) };
  });
  const totalFunds = (s) => sum(s.pools);

  function creditYear(s) {
    const budget = annualBudget(s);
    const pools = {};
    for (const k of POOLS) pools[k] = s.pools[k] * CARRY + (budget * s.alloc[k]) / 100;
    return ev({ ...s, pools, boosts: s.boosts.filter((b) => s.t < b.start + b.years) }, 'budget', { amount: budget });
  }

  function setAlloc(s, alloc) {
    const ok = POOLS.every((k) => Number.isInteger(alloc[k]) && alloc[k] >= MIN_ALLOC) && sum(alloc) === 100;
    return ok ? { ...s, alloc: { ...Object.fromEntries(POOLS.map((k) => [k, alloc[k]])) } } : s;
  }

  // Sposta fondi da un conto all'altro (con una piccola perdita): evita i blocchi quando un conto è troppo magro.
  function transfer(s, from, to, amount) {
    if (!POOLS.includes(from) || !POOLS.includes(to) || from === to || !(amount > 0) || amount > s.pools[from]) return s;
    return { ...s, pools: { ...s.pools, [from]: s.pools[from] - amount, [to]: s.pools[to] + amount * (1 - TRANSFER_FEE) } };
  }

  // Fondi extra (sfide): divisi secondo l'allocazione corrente.
  function addFunds(s, amount) {
    const pools = {};
    for (const k of POOLS) pools[k] = s.pools[k] + (amount * s.alloc[k]) / 100;
    return { ...s, pools };
  }

  // --- derivati ------------------------------------------------------------
  const repTotal = (s) => s.rep + Object.values(s.budgetBest).reduce((a, b) => a + b, 0) / BUDGET_REP;
  const isDone = (s, id) => id in s.done;
  const isAvail = (s, id) => proc(id).after.every((a) => a in s.done);
  const dataOf = (s, id) => s.data[id] || 0;
  const cfgOf = (s, id) => s.cfg[id] || { trig: 0.3, cut: 0.3 };
  const rivalAt = (s, id) => (s.availAt[id] || 0) + proc(id).rival * (0.8 + 0.4 * C.rng(C.hash(`${s.seed}:rival:${id}`))());
  const rivalFraction = (s, id) => {
    const start = s.availAt[id] || 0;
    return (s.t - start) / (rivalAt(s, id) - start);
  };
  const energyOk = (s, id) => PH.energy(s) >= proc(id).thr[s.collider];
  const canRun = (s, id) => s.built && !s.shutdown && energyOk(s, id) && PH.detector(s, proc(id)).ok;
  const runCost = (s, years) => Math.ceil(years * (RUN_BASE * 1.18 ** s.energyLvl * 1.1 ** s.lumiLvl + 10 * sum(s.det)));
  const unlockedBudget = (s) => s.shutdowns >= 1;
  const isComplete = (s) => PR.PROCESSES.every((p) => p.id in s.done);
  const analysisCost = (p, strategy, opts) => Math.ceil(ANALYSIS_BASE[strategy] * (1 + 0.4 * p.tier) * (1 + (opts && opts.valid ? 0.2 : 0) + (opts && opts.blind ? 0.1 : 0)));

  function stats(s) {
    const d = Object.values(s.done);
    return { published: d.length, scooped: d.filter((x) => x.scooped).length, limits: d.filter((x) => x.limit).length, years: s.t };
  }

  // --- progetti di sviluppo --------------------------------------------------------
  const projectKey = (kind, target) => (kind === 'det' ? `det:${target}` : kind);
  const KEY_RE = /^(energy|lumi|collider|det:(tracker|ecal|hcal|muon|daq))$/;

  // Costo e durata nominali del prossimo passo; null se non è possibile.
  function projectSpec(s, kind, target) {
    if (!s.built) return null;
    if (kind === 'energy') return s.energyLvl < PR.COLLIDERS[s.collider].energies.length - 1 ? { cost: COST.energy(s.energyLvl), years: 1 + 0.25 * s.energyLvl } : null;
    if (kind === 'lumi') return s.lumiLvl < PH.MAX_LUMI ? { cost: COST.lumi(s.lumiLvl), years: 1 + 0.2 * s.lumiLvl } : null;
    if (kind === 'collider') return { cost: PR.COLLIDER_SWITCH.cost, years: PR.COLLIDER_SWITCH.years };
    if (kind === 'det' && PR.DETECTOR.subsystems.includes(target) && s.det[target] >= 1 && s.det[target] < PR.DETECTOR.maxLevel) {
      return { cost: COST.det(target, s.det[target]), years: 1.5 + 0.5 * s.det[target] };
    }
    return null;
  }

  // opts: { risk: 'safe'|'bold', fast: bool }. Il tempo reale dipende da quanto sviluppo riesci a finanziare.
  function startProject(s, kind, target, opts) {
    const key = projectKey(kind, target);
    const spec = projectSpec(s, kind, target);
    if (!spec || key in s.projects || Object.keys(s.projects).length >= MAX_PROJECTS) return s;
    const risk = opts && opts.risk === 'bold' ? 'bold' : 'safe';
    const fast = !!(opts && opts.fast);
    const years = (spec.years * RISKS[risk].years) / (fast ? FAST.rate : 1);
    const project = { kind, target: kind === 'det' ? target : null, cost: Math.ceil(spec.cost * (fast ? FAST.cost : 1)), years, spent: 0, risk, fast, stall: 0, state: 'dev' };
    return ev({ ...s, projects: { ...s.projects, [key]: project } }, 'proj.start', { key });
  }

  function applyProjectDone(s, key, p) {
    if (p.kind === 'energy') return ev({ ...s, projects: omit(s.projects, key), energyLvl: s.energyLvl + 1 }, 'proj.done', { key });
    if (p.kind === 'lumi') return ev({ ...s, projects: omit(s.projects, key), lumiLvl: s.lumiLvl + 1 }, 'proj.done', { key });
    return ev({ ...s, projects: { ...s.projects, [key]: { ...p, spent: p.cost, state: 'ready' } } }, 'proj.ready', { key });
  }

  // Sviluppo: ogni anno un progetto richiede cost/years dal conto sviluppo; se il conto è a secco rallenta.
  function advanceProjects(s, years) {
    let n = s;
    for (const [key, p] of Object.entries(s.projects)) {
      if (p.state !== 'dev' || n.t < p.stall) continue;
      const need = Math.min(p.cost - p.spent, (p.cost / p.years) * years);
      const draw = Math.min(need, n.pools.rnd);
      if (draw <= 0) continue;
      const next = { ...p, spent: p.spent + draw };
      n = { ...spend(n, 'rnd', draw), projects: { ...n.projects, [key]: next } };
      if (next.spent >= next.cost - 1e-9) n = applyProjectDone(n, key, next);
    }
    return n;
  }

  // Eventi annuali, deterministici da seed, progetto e anno.
  function projectEvents(s, year) {
    let n = s;
    for (const [key, p] of Object.entries(s.projects)) {
      if (p.state !== 'dev' || n.t < p.stall) continue;
      const r = C.rng(C.hash(`${n.seed}:pev:${key}:${year}`));
      if (r() >= RISKS[p.risk].p) continue;
      const kind = r() < 0.6 ? (r() < 0.5 ? 'overrun' : 'delay') : r() < 0.5 ? 'boost' : 'idea';
      const mag = r();
      const cur = n.projects[key];
      if (kind === 'overrun') {
        const pct = Math.round(15 + 20 * mag);
        n = ev({ ...n, projects: { ...n.projects, [key]: { ...cur, cost: Math.ceil(cur.cost * (1 + pct / 100)) } } }, 'proj.overrun', { key, pct });
      } else if (kind === 'delay' && n.pending.length < MAX_PENDING) {
        const stall = Math.round((0.5 + mag) * 10) / 10;
        const id = `${key}@${year}`;
        n = ev({ ...n, pending: [...n.pending, { id, key, stall, pay: Math.ceil(cur.cost * 0.12), deadline: n.t + EVENT_DEADLINE }] }, 'proj.delay', { key, stall });
      } else if (kind === 'boost') {
        n = ev({ ...n, projects: { ...n.projects, [key]: { ...cur, cost: Math.ceil(cur.cost * 0.85) } } }, 'proj.boost', { key });
      } else if (kind === 'idea') {
        n = ev({ ...n, projects: { ...n.projects, [key]: { ...cur, spent: Math.min(cur.cost * 0.95, cur.spent + cur.cost * 0.15) } } }, 'proj.idea', { key });
      }
    }
    return n;
  }

  // choice: 'pay' (paghi dal conto sviluppo e non c'è ritardo) | 'accept' (il progetto si ferma).
  function resolveEvent(s, id, choice) {
    const e = s.pending.find((x) => x.id === id);
    if (!e) return s;
    const rest = { pending: s.pending.filter((x) => x.id !== id) };
    if (choice === 'pay') return canPay(s, 'rnd', e.pay) ? ev({ ...spend(s, 'rnd', e.pay), ...rest }, 'proj.paid', { key: e.key }) : s;
    const p = s.projects[e.key];
    return { ...s, ...rest, projects: p ? { ...s.projects, [e.key]: { ...p, stall: Math.max(p.stall, s.t + e.stall) } } : s.projects };
  }

  const expirePending = (s) => s.pending.reduce((n, e) => (n.t >= e.deadline ? resolveEvent(n, e.id, 'accept') : n), s);

  // --- cantiere e chiusure (installazione) ------------------------------------------
  const installYears = (sub, lvl) => PR.DETECTOR.years[sub] * (lvl === 0 ? PR.DETECTOR.firstLevel : 1);

  // items: 'accelerator' (solo se manca), sottosistema (+1 livello), 'collider' (cambio tipo). Dal 2° livello serve il progetto pronto.
  function shutdownPlan(s, items) {
    let cost = 0;
    const years = [];
    const missing = [];
    for (const it of items) {
      if (it === 'accelerator') {
        if (s.built) return { ok: false, cost: 0, years: 0, missing };
        cost += PR.ACCELERATOR.cost;
        years.push(PR.ACCELERATOR.years);
      } else if (it === 'collider') {
        const pj = s.projects.collider;
        if (!s.built) return { ok: false, cost: 0, years: 0, missing };
        if (!pj || pj.state !== 'ready') { missing.push(it); continue; }
        cost += Math.ceil(PR.COLLIDER_SWITCH.cost * INSTALL_FRACTION);
        years.push(PR.COLLIDER_SWITCH.years);
      } else if (PR.DETECTOR.subsystems.includes(it) && s.det[it] < PR.DETECTOR.maxLevel) {
        if (s.det[it] === 0) {
          cost += COST.det(it, 0);
          years.push(installYears(it, 0));
        } else {
          const pj = s.projects[`det:${it}`];
          if (!pj || pj.state !== 'ready') { missing.push(it); continue; }
          cost += Math.ceil(COST.det(it, s.det[it]) * INSTALL_FRACTION);
          years.push(installYears(it, s.det[it]));
        }
      } else {
        return { ok: false, cost: 0, years: 0, missing };
      }
    }
    if (years.length === 0 || missing.length) return { ok: false, cost: 0, years: 0, missing };
    const longest = Math.max(...years);
    return { ok: true, cost, years: longest + OVERLAP * (years.reduce((x, y) => x + y, 0) - longest), missing };
  }

  // `collider`: tipo di acceleratore, scelto solo alla costruzione iniziale.
  function startShutdown(s, items, collider) {
    const unique = [...new Set(items)];
    const pl = shutdownPlan(s, unique);
    if (s.shutdown || s.run || !pl.ok || !canPay(s, 'rnd', pl.cost)) return s;
    const kind = PR.COLLIDERS[collider] ? collider : s.collider;
    return ev({ ...spend(s, 'rnd', pl.cost), shutdown: { start: s.t, until: s.t + pl.years, items: unique, collider: kind } }, 'shutdown.start', { years: pl.years.toFixed(1) });
  }

  function finishShutdown(s) {
    let det = { ...s.det };
    let age = { ...s.age };
    let projects = s.projects;
    let { collider, energyLvl, built } = s;
    for (const it of s.shutdown.items) {
      if (it === 'accelerator') { built = true; collider = s.shutdown.collider; energyLvl = 0; continue; }
      if (it === 'collider') { collider = other(collider); energyLvl = 0; projects = omit(projects, 'collider'); continue; }
      det = { ...det, [it]: Math.min(PR.DETECTOR.maxLevel, det[it] + 1) };
      projects = omit(projects, `det:${it}`);
      if (it in age) age = { ...age, [it]: 0 }; // sostituzione: nuovo sensore
    }
    return ev({ ...s, det, age, collider, energyLvl, built, projects, shutdown: null, shutdowns: s.shutdowns + 1 }, 'shutdown.done', {});
  }

  // --- presa dati a pagamento e richieste di finanziamento -----------------
  function startRun(s, years) {
    if (!RUN_YEARS.includes(years) || s.run || !s.program || !canRun(s, s.program)) return s;
    const cost = runCost(s, years);
    return canPay(s, 'ops', cost) ? ev({ ...spend(s, 'ops', cost), run: { start: s.t, end: s.t + years } }, 'run.start', { years }) : s;
  }

  const claimId = (source, key) => `${source}:${/^\d{4}-\d{2}-\d{2}$/.test(key) ? key : 'free'}`;
  function canClaim(s, source, key) {
    if (!CLAIM_SCALE[source]) return false;
    const id = claimId(source, key);
    if (!(id in s.claims)) return true;
    return s.claims[id] !== true && s.t - s.claims[id] >= CLAIM_COOLDOWN;
  }

  // Il minigioco (source 'shape') e il budget (source 'budget') fruttano fondi extra.
  function claimFunds(s, source, score, key) {
    if (!(score > 0) || !canClaim(s, source, key)) return s;
    const id = claimId(source, key);
    const gain = Math.round(Math.min(100, score) * CLAIM_SCALE[source] * (1 + repTotal(s) / 10));
    const kept = Object.entries(s.claims).slice(-(MAX_CLAIMS - 1));
    const claims = { ...Object.fromEntries(kept), [id]: id.endsWith(':free') ? s.t : true };
    return ev({ ...addFunds(s, gain), claims }, 'claim', { gain });
  }

  // --- programma di fisica, trigger e analisi ------------------------------
  const select = (s, id) => (proc(id) && isAvail(s, id) && !isDone(s, id) ? { ...s, program: id } : s);
  const setCfg = (s, id, cfg) => ({ ...s, cfg: { ...s.cfg, [id]: { trig: Math.min(0.9, Math.max(0, cfg.trig)), cut: Math.min(1.2, Math.max(0, cfg.cut)) } } });
  const autotuneCfg = (s, id) => setCfg(s, id, PH.autotune(s, proc(id)));

  function startAnalysis(s, id, strategy, opts) {
    const p = proc(id);
    if (!p || !PH.STRATEGIES[strategy] || !isAvail(s, id) || isDone(s, id) || s.jobs[id] || dataOf(s, id) <= 0) return s;
    const o = { blind: !!(opts && opts.blind), valid: !!(opts && opts.valid) };
    const cost = analysisCost(p, strategy, o);
    if (!canPay(s, 'analysis', cost)) return s;
    const e = PH.evaluate(s, p, cfgOf(s, id), dataOf(s, id), o.valid ? PH.SYST_VALID : 1);
    if (!e.ok) return s;
    const pl = PH.plan(strategy, o, p);
    const job = {
      state: 'run', strategy, opts: o, start: s.t, end: s.t + pl.years, base: pl.years, rounds: 0, p: pl.prob, sens: pl.sens,
      snap: { z: e.z, znom: e.znom, sigma: e.sigma, L: dataOf(s, id) },
    };
    return { ...spend(s, 'analysis', cost), jobs: { ...s.jobs, [id]: job } };
  }

  // Finanziamento temporaneo dopo una pubblicazione.
  const addBoost = (s, p, factor) => {
    const amount = p.value * BOOST_PER_VALUE * factor;
    return { ...s, boosts: [...s.boosts, { amount, start: s.t, years: boostYears(p.value) }].slice(-MAX_BOOSTS) };
  };

  function publish(s, id, res) {
    const p = proc(id);
    const scooped = s.t > rivalAt(s, id);
    const f = (scooped ? SCOOP_FACTOR : 1) * (res.limit ? LIMIT_FACTOR : 1) * (res.quality || 1);
    let n = addBoost({
      ...s,
      rep: s.rep + p.value * f,
      done: { ...s.done, [id]: { z: res.z || 0, sigma: res.sigma || 0, limit: !!res.limit, scooped, t: s.t } },
      jobs: omit(s.jobs, id),
      program: s.program === id ? null : s.program,
    }, p, f);
    const availAt = { ...n.availAt };
    for (const q of PR.PROCESSES) if (!(q.id in availAt) && q.after.every((a) => a in n.done)) availAt[q.id] = n.t;
    n = { ...n, availAt };
    return ev(n, scooped ? 'scooped' : res.limit ? 'limit' : 'published', { id, rep: (p.value * f).toFixed(1) });
  }

  function finishJob(s, id, job) {
    const p = proc(id);
    const z = job.snap.z * job.sens;
    const znom = job.snap.znom * job.sens;
    const sigma = job.snap.sigma / job.sens;
    const rest = omit(s.jobs, id);
    if (p.kind === 'measure') {
      return sigma <= p.goal ? publish({ ...s, jobs: rest }, id, { sigma, z }) : ev({ ...s, jobs: rest }, 'inconclusive', { id });
    }
    const exists = p.kind === 'discovery' || PH.searchExists(s, p);
    if (exists && z >= PH.Z_DISCOVERY) {
      return ev({ ...s, jobs: { ...s.jobs, [id]: { ...job, state: 'confirm', result: { z } } } }, 'confirm', { id });
    }
    if (!exists && znom >= PH.Z_LIMIT) return publish({ ...s, jobs: rest }, id, { z: znom, limit: true });
    return ev({ ...s, jobs: rest }, 'inconclusive', { id });
  }

  // Conferma di una scoperta col minigioco (analisi angolare): score 0 = da rifare.
  function confirmDiscovery(s, id, score) {
    const job = s.jobs[id];
    if (!job || job.state !== 'confirm') return s;
    if (score > 0) return publish(s, id, { z: job.result.z, quality: 1 + Math.min(100, score) / 200 });
    return ev({ ...s, jobs: { ...s.jobs, [id]: { ...job, state: 'run', rounds: job.rounds + 1, end: s.t + REVIEW_EXTRA * job.base } } }, 'confirmfail', { id });
  }

  const recordBudget = (s, resId, score) => (
    typeof score === 'number' && score > (s.budgetBest[resId] || 0)
      ? { ...s, budgetBest: { ...s.budgetBest, [resId]: Math.min(100, score) } }
      : s
  );

  // --- avanzamento del tempo ----------------------------------------------
  function runJobs(s) {
    let n = s;
    for (const [id, job] of Object.entries(s.jobs)) {
      if (job.state !== 'run' || n.t < job.end) continue;
      if (job.rounds < MAX_ROUNDS && PH.review(n.seed, id, job.rounds, job.p)) {
        const next = { ...job, rounds: job.rounds + 1, end: job.end + REVIEW_EXTRA * job.base };
        n = ev({ ...n, jobs: { ...n.jobs, [id]: next } }, 'review', { id, n: next.rounds });
      } else {
        n = finishJob(n, id, job);
      }
    }
    return n;
  }

  function noteRivals(s) {
    let n = s;
    for (const p of PR.PROCESSES) {
      if (!(p.id in n.availAt) || p.id in n.done || n.rivalNoted[p.id] || n.t < rivalAt(n, p.id)) continue;
      n = ev({ ...n, rivalNoted: { ...n.rivalNoted, [p.id]: true } }, 'rival', { id: p.id });
    }
    return n;
  }

  function advance(s, dt) {
    const years = dt / YEAR_S;
    let n = { ...s, t: s.t + years };
    for (let y = Math.floor(s.t) + 1; y <= Math.floor(n.t); y++) n = projectEvents(creditYear(n), y);
    n = advanceProjects(n, years);
    if (n.shutdown && n.t >= n.shutdown.until) {
      n = finishShutdown(n);
    } else if (n.run && n.t >= n.run.end) {
      n = ev({ ...n, run: null }, 'run.done', {});
    } else if (n.run && n.program && canRun(n, n.program)) {
      const add = PH.lumiRate(n) * years;
      n = {
        ...n,
        data: { ...n.data, [n.program]: dataOf(n, n.program) + add },
        age: { tracker: n.age.tracker + add, ecal: n.age.ecal + add },
      };
    }
    return noteRivals(runJobs(expirePending(n)));
  }

  function tick(s, dt) {
    let n = s;
    let left = dt;
    while (left > 0) {
      const step = Math.min(STEP_S, left);
      n = advance(n, step);
      left -= step;
    }
    return n;
  }

  // --- salvataggio (dati non fidati: validazione e clamp di ogni campo) -----
  const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const int = (v, lo, hi, d) => Math.floor(num(v, lo, hi, d));
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  function validate(raw, now) {
    const base = newState(now, 'default');
    if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return base;
    const collider = PR.COLLIDERS[raw.collider] ? raw.collider : 'pp';
    const det = {};
    for (const k of PR.DETECTOR.subsystems) det[k] = int(obj(raw.det)[k], 0, PR.DETECTOR.maxLevel, base.det[k]);
    const age = {};
    for (const k of PR.DETECTOR.aging) age[k] = num(obj(raw.age)[k], 0, 1e9, 0);
    const pools = {};
    for (const k of POOLS) pools[k] = num(obj(raw.pools)[k], 0, 1e12, START_POOLS[k]);
    const a = obj(raw.alloc);
    const alloc = POOLS.every((k) => Number.isInteger(a[k]) && a[k] >= MIN_ALLOC && a[k] <= 100) && POOLS.reduce((x, k) => x + a[k], 0) === 100
      ? Object.fromEntries(POOLS.map((k) => [k, a[k]])) : { ...DEFAULT_ALLOC };
    const boosts = (Array.isArray(raw.boosts) ? raw.boosts : []).slice(0, MAX_BOOSTS).map((b) => ({ amount: num(obj(b).amount, 0, 10, 0), start: num(obj(b).start, 0, 1e6, 0), years: num(obj(b).years, 1, 20, 4) }));
    const projects = {};
    for (const [key, pj] of Object.entries(obj(raw.projects)).slice(0, MAX_PROJECTS)) {
      if (!KEY_RE.test(key)) continue;
      const q = obj(pj);
      const kind = key.startsWith('det:') ? 'det' : key;
      projects[key] = {
        kind, target: kind === 'det' ? key.slice(4) : null, cost: num(q.cost, 1, 1e9, 100), years: num(q.years, 0.1, 50, 1),
        spent: num(q.spent, 0, 1e9, 0), risk: q.risk === 'bold' ? 'bold' : 'safe', fast: q.fast === true, stall: num(q.stall, 0, 1e6, 0), state: q.state === 'ready' ? 'ready' : 'dev',
      };
      projects[key].spent = Math.min(projects[key].spent, projects[key].cost);
    }
    const pending = (Array.isArray(raw.pending) ? raw.pending : []).slice(0, MAX_PENDING)
      .filter((e) => /^[\w:.@-]{1,40}$/.test(obj(e).id) && KEY_RE.test(obj(e).key) && obj(e).key in projects)
      .map((e) => ({ id: e.id, key: e.key, stall: num(e.stall, 0.1, 5, 1), pay: num(e.pay, 0, 1e9, 0), deadline: num(e.deadline, 0, 1e6, 0) }));
    const data = {}, cfg = {}, availAt = {}, rivalNoted = {}, done = {}, jobs = {}, budgetBest = {};
    for (const p of PR.PROCESSES) {
      const id = p.id;
      if (typeof obj(raw.data)[id] === 'number') data[id] = num(raw.data[id], 0, 1e12, 0);
      const c = obj(raw.cfg)[id];
      if (c) cfg[id] = { trig: num(c.trig, 0, 0.9, 0.3), cut: num(c.cut, 0, 1.2, 0.3) };
      if (typeof obj(raw.availAt)[id] === 'number') availAt[id] = num(raw.availAt[id], 0, 1e6, 0);
      if (obj(raw.rivalNoted)[id] === true) rivalNoted[id] = true;
      const d = obj(raw.done)[id];
      if (d) done[id] = { z: num(d.z, 0, 1e6, 0), sigma: num(d.sigma, 0, 1e6, 0), limit: d.limit === true, scooped: d.scooped === true, t: num(d.t, 0, 1e6, 0) };
      const j = obj(raw.jobs)[id];
      if (j && PH.STRATEGIES[j.strategy] && (j.state === 'run' || j.state === 'confirm')) {
        const sn = obj(j.snap);
        jobs[id] = {
          state: j.state, strategy: j.strategy, opts: { blind: obj(j.opts).blind === true, valid: obj(j.opts).valid === true },
          start: num(j.start, 0, 1e6, 0), end: num(j.end, 0, 1e6, 0), base: num(j.base, 0.01, 100, 1),
          rounds: int(j.rounds, 0, MAX_ROUNDS, 0), p: num(j.p, 0, 1, 0.2), sens: num(j.sens, 0.1, 3, 1),
          snap: { z: num(sn.z, 0, 1e6, 0), znom: num(sn.znom, 0, 1e6, 0), sigma: num(sn.sigma, 0, 1e9, 1e9), L: num(sn.L, 0, 1e12, 0) },
          result: { z: num(obj(j.result).z, 0, 1e6, 0) },
        };
      }
    }
    for (const q of PR.PROCESSES) if (q.after.length === 0 && !(q.id in availAt)) availAt[q.id] = 0;
    for (const [k, v] of Object.entries(obj(raw.budgetBest))) {
      if (/^\w{1,20}$/.test(k) && typeof v === 'number') budgetBest[k] = num(v, 0, 100, 0);
    }
    const sh = obj(raw.shutdown);
    const items = Array.isArray(sh.items) ? sh.items.filter((x) => x === 'collider' || x === 'accelerator' || PR.DETECTOR.subsystems.includes(x)) : [];
    const shutdown = raw.shutdown && items.length ? { start: num(sh.start, 0, 1e6, 0), until: num(sh.until, 0, 1e6, 0), items, collider: PR.COLLIDERS[sh.collider] ? sh.collider : collider } : null;
    const rn = obj(raw.run);
    const run = raw.run && typeof rn.end === 'number' ? { start: num(rn.start, 0, 1e6, 0), end: num(rn.end, 0, 1e6, 0) } : null;
    const claims = {};
    for (const [k, v] of Object.entries(obj(raw.claims)).slice(0, MAX_CLAIMS)) {
      if (/^[\w:.-]{1,40}$/.test(k) && (v === true || typeof v === 'number')) claims[k] = v === true ? true : num(v, 0, 1e6, 0);
    }
    return {
      ...base,
      seed: typeof raw.seed === 'string' && /^[\w-]{1,64}$/.test(raw.seed) ? raw.seed : base.seed,
      pools, alloc, boosts, rep: num(raw.rep, 0, 1e6, 0), t: num(raw.t, 0, 1e6, 0),
      collider, energyLvl: int(raw.energyLvl, 0, PR.COLLIDERS[collider].energies.length - 1, 0), lumiLvl: int(raw.lumiLvl, 0, PH.MAX_LUMI, 0),
      det, age, shutdown, shutdowns: int(raw.shutdowns, 0, 1000, 0), built: raw.built === true, run, projects, pending, claims,
      program: PR.BY_ID.has(raw.program) ? raw.program : null,
      data, cfg, jobs, done, availAt, rivalNoted, budgetBest,
      events: [], evN: int(raw.evN, 0, 1e9, 0), tutorial: raw.tutorial === true, last: num(raw.last, 0, now, now),
    };
  }

  const serialize = (s) => JSON.stringify({ ...s, events: [] });

  // Ritorna { state, away }: `away` = secondi offline accreditati (con efficienza ridotta).
  function load(text, now = Date.now(), seed = 'default') {
    let raw = null;
    try { raw = JSON.parse(text); } catch (e) { raw = null; }
    const parsed = validate(raw, now);
    const s = raw && raw.v === SAVE_VERSION ? parsed : newState(now, seed);
    const away = Math.min(OFFLINE_CAP_S, Math.max(0, (now - s.last) / 1000)) * OFFLINE_EFF;
    return { state: tick({ ...s, last: now }, away), away };
  }

  const api = {
    SAVE_VERSION, YEAR_S, MAX_ROUNDS, RUN_YEARS, CLAIM_COOLDOWN, POOLS, MIN_ALLOC, MAX_PROJECTS, RISKS, FAST, INSTALL_FRACTION, BASE_BUDGET, COST,
    newState, repTotal, runCost, analysisCost, installYears, annualBudget, boostTotal, forecast, totalFunds, setAlloc, addFunds, transfer, TRANSFER_FEE,
    projectSpec, startProject, resolveEvent, startRun, canClaim, claimFunds,
    isDone, isAvail, dataOf, cfgOf, rivalAt, rivalFraction, energyOk, canRun, unlockedBudget, isComplete, stats,
    shutdownPlan, startShutdown, select, setCfg, autotuneCfg, startAnalysis, confirmDiscovery, recordBudget, tick, validate, serialize, load,
  };
  if (isNode) module.exports = api;
  else root.Game = api;
})(typeof self !== 'undefined' ? self : globalThis);
