// Self-check del gioco: `node check-game.js [--report]`. Dati, fisica, budget annuale, progetti, eventi, salvataggi e bot.
const assert = require('node:assert/strict');
const PR = require('./www/processes.js');
const PH = require('./www/physics.js');
const G = require('./www/game.js');

const report = process.argv.includes('--report');
const log = (...a) => { if (report) console.log(...a); };
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const Y = G.YEAR_S;
const poolsSum = (s) => G.totalFunds(s);

// --- 1. tabella dei processi ------------------------------------------------
const ids = new Set(PR.PROCESSES.map((p) => p.id));
assert.equal(ids.size, PR.PROCESSES.length);
for (const p of PR.PROCESSES) {
  assert.ok(p.after.every((a) => ids.has(a)), `${p.id}: prerequisito inesistente`);
  assert.ok(Number.isFinite(p.sig) && p.sig > 0 && Number.isFinite(p.bkg) && p.bkg > 0, `${p.id}: sig/bkg`);
  for (const c of Object.keys(PR.COLLIDERS)) assert.ok(p.thr[c] <= Math.max(...PR.COLLIDERS[c].energies), `${p.id}: soglia irraggiungibile su ${c}`);
  for (const [k, lvl] of Object.entries(p.need)) assert.ok(PR.DETECTOR.subsystems.includes(k) && lvl <= PR.DETECTOR.maxLevel, `${p.id}: requisito ${k}`);
  assert.ok(PH.STRATEGIES.cuts.sens[p.type] > 0, `${p.id}: tipo ${p.type}`);
}

// --- 2. fisica ---------------------------------------------------------------
const built = (over = {}) => ({ ...G.newState(0, 'ref'), built: true, ...over });
function referenceState() {
  const det = {};
  for (const k of PR.DETECTOR.subsystems) det[k] = 4;
  return built({ det, lumiLvl: 5, energyLvl: PR.COLLIDERS.pp.energies.length - 1 });
}
const ref = referenceState();
for (const p of PR.PROCESSES) {
  const weak = { ...ref, det: { ...ref.det, ...Object.fromEntries(Object.keys(p.need).map((k) => [k, Math.max(0, p.need[k] - 1)])) } };
  assert.equal(PH.evaluate(weak, p, { trig: 0.3, cut: 0.3 }, 1e6).z, 0, `${p.id}: senza detector adeguato il segnale deve essere nullo`);
  const cfg = PH.autotune(ref, p);
  assert.ok(!(cfg.trig === 0 && cfg.cut === 0), `${p.id}: ottimo agli estremi`);
  assert.ok(PH.evaluate(ref, p, cfg, 2e3).znom > PH.evaluate(ref, p, cfg, 1e3).znom, `${p.id}: Z deve crescere con la luminosità`);
  let lo = 1e-3, hi = 1e9;
  for (let i = 0; i < 80; i++) { const m = Math.sqrt(lo * hi); if (PH.evaluate(ref, p, cfg, m).znom < 5) lo = m; else hi = m; }
  log(p.id.padEnd(8), 'L5 tabella', String(p.L5).padStart(7), ' L5 modello', hi.toFixed(1).padStart(10));
  assert.ok(hi > p.L5 / 30 && hi < p.L5 * 30, `${p.id}: L5 del modello (${hi.toFixed(1)}) lontana dalla tabella (${p.L5})`);
}
assert.ok(PH.plan('mva', {}, PR.BY_ID.get('hh')).sens > PH.plan('cuts', {}, PR.BY_ID.get('hh')).sens);
assert.ok(PH.plan('mva', { valid: true }, PR.BY_ID.get('rho')).prob < PH.plan('mva', {}, PR.BY_ID.get('rho')).prob);

// --- 3. budget annuale: conti, riporto, finanziamenti temporanei ---------------
{
  const s0 = G.newState(0, 'b');
  assert.equal(poolsSum(s0), 1500, 'fondi iniziali');
  // nessun reddito dentro lo stesso anno
  assert.equal(poolsSum(G.tick(s0, 0.9 * Y)), 1500);
  // a ogni anno intero arriva il budget, diviso secondo l'allocazione, con riporto del 50%
  const s1 = G.tick(s0, 1 * Y + 5);
  const budget = G.annualBudget(s0);
  assert.equal(budget, G.BASE_BUDGET);
  near(s1.pools.ops, s0.pools.ops * 0.5 + (budget * s0.alloc.ops) / 100, 1e-6);
  near(poolsSum(s1), poolsSum(s0) * 0.5 + budget, 1e-6);
  // allocazione: somma 100 e minimo 10% per conto
  assert.equal(G.setAlloc(s0, { ops: 5, analysis: 45, rnd: 50 }), s0, 'sotto il minimo');
  assert.equal(G.setAlloc(s0, { ops: 50, analysis: 30, rnd: 30 }), s0, 'somma diversa da 100');
  assert.deepEqual(G.setAlloc(s0, { ops: 60, analysis: 10, rnd: 30 }).alloc, { ops: 60, analysis: 10, rnd: 30 });
  // trasferimenti tra conti: con perdita del 10%, mai oltre il saldo, mai sullo stesso conto
  const tr = G.transfer(s0, 'ops', 'analysis', 100);
  assert.equal(tr.pools.ops, s0.pools.ops - 100);
  near(tr.pools.analysis, s0.pools.analysis + 90);
  assert.ok(poolsSum(tr) < poolsSum(s0));
  assert.equal(G.transfer(s0, 'ops', 'analysis', s0.pools.ops + 1), s0);
  assert.equal(G.transfer(s0, 'ops', 'ops', 10), s0);
  assert.equal(G.transfer(s0, 'ops', 'bogus', 10), s0);
  assert.equal(G.transfer(s0, 'ops', 'rnd', -5), s0);
  // finanziamento temporaneo: piatto per metà della durata, poi cala, poi finisce
  const p = PR.BY_ID.get('higgs');
  const boosted = { ...s0, boosts: [{ amount: 1, start: 0, years: 6 }] };
  assert.equal(G.annualBudget(boosted, 1), 2 * G.BASE_BUDGET);
  assert.equal(G.annualBudget(boosted, 2.9), 2 * G.BASE_BUDGET);
  assert.ok(G.annualBudget(boosted, 4.5) < 2 * G.BASE_BUDGET && G.annualBudget(boosted, 4.5) > G.BASE_BUDGET);
  assert.equal(G.annualBudget(boosted, 6), G.BASE_BUDGET, 'scaduto: torna la base');
  assert.equal(G.annualBudget({ ...s0, boosts: Array(10).fill({ amount: 2, start: 0, years: 6 }) }, 1), 5 * G.BASE_BUDGET, 'tetto +400%');
  const fc = G.forecast(boosted, 5);
  assert.equal(fc.length, 5);
  assert.ok(fc[0].total >= fc[4].total, 'la previsione cala quando il finanziamento scade');
  assert.ok(p.value > 0);
}

// --- 4. cantiere iniziale e installazioni -----------------------------------------
{
  const empty = G.newState(0, 'x');
  assert.equal(empty.built, false);
  assert.ok(Object.values(empty.det).every((v) => v === 0), 'il rilevatore parte vuoto');
  const first = G.shutdownPlan(empty, ['accelerator', 'tracker', 'muon', 'daq']);
  assert.ok(first.ok && first.years < 1.5 && first.cost <= empty.pools.rnd, `cantiere iniziale: ${JSON.stringify(first)}`);
  const run1 = G.runCost({ ...empty, det: { tracker: 1, ecal: 0, hcal: 0, muon: 1, daq: 1 } }, 2);
  assert.ok(run1 <= empty.pools.ops, 'devono bastare due anni di corsa con i fondi iniziali');
  let b = G.startShutdown({ ...empty }, ['accelerator', 'tracker', 'muon'], 'ee');
  b = G.tick(b, 3 * Y);
  assert.ok(b.built && b.collider === 'ee' && b.det.tracker === 1 && b.det.muon === 1);
  assert.equal(G.shutdownPlan(empty, ['collider']).ok, false);
  assert.equal(G.shutdownPlan(built(), ['accelerator']).ok, false);
}

// --- 5. progetti di sviluppo: tempi, finanziamento, rischio, eventi ---------------------
{
  const s = built({ det: { tracker: 1, ecal: 1, hcal: 1, muon: 1, daq: 1 }, pools: { ops: 0, analysis: 0, rnd: 1e6 } });
  assert.equal(G.shutdownPlan(s, ['ecal']).ok, false, 'dal 2° livello serve il progetto');
  assert.deepEqual(G.shutdownPlan(s, ['ecal']).missing, ['ecal']);
  assert.equal(G.startProject(s, 'det', 'ecal', {}).projects['det:ecal'].state, 'dev');
  assert.equal(G.startProject(s, 'det', 'bogus', {}), s);
  assert.equal(G.startProject(G.newState(0, 'x'), 'energy', null, {}).projects.energy, undefined, 'serve l\'acceleratore');
  // con fondi, un progetto sicuro dura ~ years×1.3 (con eventi: almeno quanto il nominale)
  const spec = G.projectSpec(s, 'det', 'ecal');
  const safe = G.startProject(s, 'det', 'ecal', { risk: 'safe' }).projects['det:ecal'];
  const bold = G.startProject(s, 'det', 'ecal', { risk: 'bold' }).projects['det:ecal'];
  const fast = G.startProject(s, 'det', 'ecal', { risk: 'safe', fast: true }).projects['det:ecal'];
  near(safe.years, spec.years * 1.3);
  assert.ok(bold.years < safe.years, 'la via audace è più corta');
  assert.ok(fast.years < safe.years && fast.cost > safe.cost, 'accelerare costa di più');
  let t = G.tick(G.startProject(s, 'det', 'ecal', { risk: 'safe' }), 12 * Y);
  assert.equal(t.projects['det:ecal'].state, 'ready', 'finanziato, il progetto arriva alla fine');
  const plan = G.shutdownPlan(t, ['ecal']);
  assert.ok(plan.ok && plan.cost === Math.ceil(G.COST.det('ecal', 1) * G.INSTALL_FRACTION));
  t = G.tick(G.startShutdown(t, ['ecal']), 6 * Y);
  assert.equal(t.det.ecal, 2);
  assert.equal(t.projects['det:ecal'], undefined, 'installato: il progetto si chiude');
  // energia e luminosità: il progetto applica da sé il livello
  const e = G.tick(G.startProject(s, 'energy', null, {}), 6 * Y);
  assert.equal(e.energyLvl, 1);
  // senza fondi di sviluppo il progetto non avanza
  const poor = G.tick({ ...G.startProject(s, 'lumi', null, {}), pools: { ops: 0, analysis: 0, rnd: 0 } }, 0.9 * Y);
  assert.equal(poor.projects.lumi.spent, 0);
  // tetto ai progetti contemporanei
  let many = s;
  for (const k of ['tracker', 'ecal', 'hcal', 'muon']) many = G.startProject(many, 'det', k, {});
  assert.equal(Object.keys(many.projects).length, G.MAX_PROJECTS);
}
{
  // eventi: deterministici, ritardo con scelta (paga o aspetta), decisione automatica alla scadenza
  const base = built({ seed: 'ev-seed', det: { tracker: 1, ecal: 1, hcal: 1, muon: 1, daq: 1 }, pools: { ops: 0, analysis: 0, rnd: 1e6 } });
  const run = (seed) => G.tick(G.startProject({ ...base, seed }, 'det', 'ecal', { risk: 'bold' }), 6 * Y);
  assert.deepEqual(run('a1').events.map((e) => e.k), run('a1').events.map((e) => e.k), 'stesso seed, stessi eventi');
  const kinds = new Set();
  let withDelay = null;
  const wanted = ['proj.overrun', 'proj.delay', 'proj.boost', 'proj.idea'];
  for (let i = 0; i < 300 && !(withDelay && wanted.every((k) => kinds.has(k))); i++) {
    const r = run(`seed${i}`);
    r.events.forEach((e) => kinds.add(e.k));
    if (!withDelay && r.events.some((e) => e.k === 'proj.delay')) withDelay = `seed${i}`;
  }
  for (const k of ['proj.overrun', 'proj.delay', 'proj.boost', 'proj.idea']) assert.ok(kinds.has(k), `evento mai generato: ${k}`);
  assert.ok(withDelay, 'serve almeno un ritardo per il test');
  // ritardo: scegli
  let s = { ...base, seed: withDelay };
  s = G.startProject(s, 'det', 'ecal', { risk: 'bold' });
  let step = 0;
  while (!s.pending.length && step++ < 6000) s = G.tick(s, 5);
  assert.ok(s.pending.length, 'ritardo atteso');
  const ev0 = s.pending[0];
  const paid = G.resolveEvent(s, ev0.id, 'pay');
  assert.equal(paid.pending.length, 0);
  assert.equal(paid.pools.rnd, s.pools.rnd - ev0.pay);
  assert.equal(paid.projects[ev0.key].stall, s.projects[ev0.key].stall, 'pagando non c\'è ritardo');
  const waited = G.resolveEvent(s, ev0.id, 'accept');
  assert.ok(waited.projects[ev0.key].stall > s.t, 'aspettando il progetto si ferma');
  assert.equal(G.resolveEvent({ ...s, pools: { ...s.pools, rnd: 0 } }, ev0.id, 'pay').pending.length, 1, 'senza fondi non puoi pagare');
  const auto = G.tick(s, 0.6 * Y);
  assert.ok(!auto.pending.some((x) => x.id === ev0.id), 'alla scadenza si accetta da soli');
}

// --- 6. corse e analisi pagate dai conti giusti -----------------------------------
{
  let s = built({ det: { tracker: 1, ecal: 0, hcal: 0, muon: 1, daq: 1 }, pools: { ops: 500, analysis: 500, rnd: 0 } });
  s = G.select(s, 'rho');
  const cost = G.runCost(s, 2);
  assert.equal(G.startRun({ ...s, pools: { ...s.pools, ops: cost - 1 } }, 2).run, null, 'senza fondi di corsa non parte');
  assert.equal(G.startRun(s, 3), s);
  let r = G.startRun(s, 2);
  assert.equal(r.pools.ops, 500 - cost);
  assert.equal(r.pools.analysis, 500, 'la corsa non tocca il conto analisi');
  r = G.tick(r, 1 * Y);
  assert.ok(r.data.rho > 0);
  r = G.tick(r, 1.5 * Y);
  assert.equal(r.run, null);
  const L = r.data.rho;
  assert.ok(Math.abs(L - PH.lumiRate(r) * 2) < PH.lumiRate(r) * 0.01);
  // analisi: costa dal conto analisi
  r = G.autotuneCfg(r, 'rho');
  const ac = G.analysisCost(PR.BY_ID.get('rho'), 'bump', { blind: true, valid: true });
  assert.ok(ac > 0 && ac <= 500);
  const a = G.startAnalysis(r, 'rho', 'bump', { blind: true, valid: true });
  assert.ok(a.jobs.rho);
  assert.equal(a.pools.analysis, r.pools.analysis - ac);
  assert.equal(G.startAnalysis({ ...r, pools: { ...r.pools, analysis: ac - 1 } }, 'rho', 'bump', { blind: true, valid: true }).jobs.rho, undefined, 'senza fondi per l\'analisi non parte');
}

// --- 7. richieste di fondi dalle sfide --------------------------------------------
{
  const s = built({ pools: { ops: 0, analysis: 0, rnd: 0 }, det: { tracker: 1, ecal: 0, hcal: 0, muon: 1, daq: 1 } });
  const day = '2026-10-09';
  const a = G.claimFunds(s, 'shape', 60, day);
  assert.ok(poolsSum(a) >= G.runCost(s, 1), 'un punteggio discreto copre almeno un anno di corsa');
  near(a.pools.ops, (poolsSum(a) * s.alloc.ops) / 100, 1e-6);
  assert.equal(G.claimFunds(a, 'shape', 100, day), a);
  const f = G.claimFunds(a, 'budget', 80, 'free');
  assert.ok(poolsSum(f) > poolsSum(a));
  assert.equal(G.claimFunds(f, 'budget', 80, 'free'), f);
  assert.equal(G.canClaim(G.tick(f, G.CLAIM_COOLDOWN * Y + 5), 'budget', 'free'), true);
}

// --- 8. salvataggio con input ostile ---------------------------------------
for (const text of ['not json', 'null', '[]', '{"v":5}',
  '{"v":5,"pools":{"ops":"x","rnd":-5},"alloc":{"ops":99,"analysis":1,"rnd":0},"det":{"tracker":99},"collider":"zz","projects":{"../x":{},"energy":{"cost":"a","state":"zz"}},"pending":[{"id":"<b>","key":"energy"}],"boosts":[{"amount":1e9,"years":-3}],"claims":{"../x":1}}',
  JSON.stringify({ v: 5, pools: { ops: NaN, analysis: Infinity, rnd: 1e99 }, t: Infinity, lumiLvl: 1e9, energyLvl: -3, program: 'evil', seed: '<script>', shutdown: { items: ['evil', 'accelerator'], until: 5, collider: 'zz' } })]) {
  const { state } = G.load(text, 1e12);
  for (const k of G.POOLS) assert.ok(Number.isFinite(state.pools[k]) && state.pools[k] >= 0, `${text.slice(0, 30)}: pool ${k}`);
  assert.equal(Object.values(state.alloc).reduce((a, b) => a + b, 0), 100);
  assert.ok(Object.values(state.alloc).every((v) => v >= G.MIN_ALLOC));
  for (const k of ['rep', 't', 'lumiLvl', 'energyLvl']) assert.ok(Number.isFinite(state[k]) && state[k] >= 0);
  assert.ok(state.boosts.every((b) => b.amount <= 10 && b.years >= 1));
  assert.ok(Object.keys(state.projects).every((k) => /^(energy|lumi|collider|det:\w+)$/.test(k)));
  assert.ok(state.pending.every((e) => /^[\w:.@-]+$/.test(e.id) && e.key in state.projects));
  assert.ok(state.program === null || PR.BY_ID.has(state.program) && /^[\w-]+$/.test(state.seed));
}
{
  const s0 = built({ pools: { ops: 1e6, analysis: 1e6, rnd: 1e6 }, det: { tracker: 1, ecal: 1, hcal: 1, muon: 1, daq: 1 } });
  const s = G.tick(G.startRun(G.select(G.startProject(s0, 'det', 'hcal', {}), 'rho'), 2), 600);
  const back = G.load(G.serialize({ ...s, last: 0 }), 0).state;
  assert.deepEqual(back.data, s.data);
  assert.deepEqual(back.projects, s.projects);
  assert.deepEqual(back.run, s.run);
  assert.equal(G.load(G.serialize({ ...s, last: 0 }), 100 * 3600 * 1000).away, 4 * 3600);
}

// --- 9. bot ----------------------------------------------------------------------
const BEST = { peak: 'bump', rare: 'mva', nonres: 'mva', precision: 'fit' };

function play({ score = 80, strategy = (p) => BEST[p.type], maxHours = 120, lazy = false }) {
  let s = G.newState(0, 'bot');
  const counts = { inconclusive: 0, review: 0, scooped: 0, rival: 0, claim: 0, 'proj.overrun': 0, 'proj.delay': 0, 'proj.boost': 0, 'proj.idea': 0, budget: 0 };
  let lastTune = -1e9;
  let lastProgram = null;
  let seen = 0;
  const firstDone = {};
  const needs = (p) => {
    const out = [];
    for (const [k, lvl] of Object.entries(p.need)) if (s.det[k] < lvl) out.push(k);
    return out;
  };
  for (let i = 0; i * 5 < maxHours * 3600; i++) {
    s = G.tick(s, 5);
    if (process.env.DBG && i % 7200 === 0) console.log((i * 5 / 3600).toFixed(0) + 'h', 't=' + s.t.toFixed(0), 'prog=' + s.program, 'run=' + !!s.run, 'sh=' + !!s.shutdown, 'ops=' + (s.pools.ops | 0), 'rnd=' + (s.pools.rnd | 0), 'L=' + ((s.data[s.program] || 0) | 0), 'proj=' + Object.keys(s.projects).join('|'), 'jobs=' + Object.keys(s.jobs).join('|'), 'pend=' + s.pending.length);
    for (const e of s.events) if (e.n > seen && counts[e.k] !== undefined) counts[e.k]++;
    seen = s.evN;
    for (const id of Object.keys(s.done)) if (!(id in firstDone)) firstDone[id] = (i * 5) / 3600;
    if (G.isComplete(s)) return { hours: (i * 5) / 3600, s, counts, firstDone };
    if (lazy) continue;
    for (const [id, job] of Object.entries(s.jobs)) if (job.state === 'confirm') s = G.confirmDiscovery(s, id, score);
    for (const e of s.pending) s = G.resolveEvent(s, e.id, s.pools.rnd > e.pay * 4 ? 'pay' : 'accept');
    if (G.totalFunds(s) < 3000 && G.canClaim(s, 'shape', 'free')) s = G.claimFunds(s, 'shape', score, 'free');
    const ensure = (pool, cost) => {
      if (s.pools[pool] >= cost) return;
      const need = (cost - s.pools[pool]) / (1 - G.TRANSFER_FEE);
      const donor = G.POOLS.filter((k) => k !== pool).sort((a, b) => s.pools[b] - s.pools[a])[0];
      if (s.pools[donor] >= need * 1.2) s = G.transfer(s, donor, pool, need);
    };
    const open = PR.PROCESSES.filter((p) => G.isAvail(s, p.id) && !G.isDone(s, p.id));
    const target = open.find((p) => !s.jobs[p.id]);
    if (!target) continue;
    if (s.program !== target.id) s = G.select(s, target.id);

    // sviluppo: per il bersaglio e per il prossimo, per non restare fermi ad aspettare
    for (const p of open.slice(0, 2)) {
      for (const k of needs(p)) if (s.det[k] >= 1 && !s.projects[`det:${k}`]) s = G.startProject(s, 'det', k, { risk: 'safe' });
      if (!G.energyOk(s, p.id) && !s.projects.energy) s = G.startProject(s, 'energy', null, { risk: 'safe' });
    }
    const wantLumi = Math.min(PH.MAX_LUMI, Math.max(0, Math.ceil(Math.log(target.L5 / 60) / Math.log(PH.LUMI_GROWTH))));
    if (s.built && s.lumiLvl < wantLumi && !s.projects.lumi) s = G.startProject(s, 'lumi', null, { risk: 'safe' });
    for (const k of PR.DETECTOR.aging) if (s.built && PH.damage(s, k) > 0.7 && s.det[k] >= 1 && s.det[k] < PR.DETECTOR.maxLevel && !s.projects[`det:${k}`]) s = G.startProject(s, 'det', k, { risk: 'safe' });
    const wantDaq = Math.min(PR.DETECTOR.maxLevel, 1 + Math.ceil(s.lumiLvl / 3));
    if (s.built && s.det.daq >= 1 && s.det.daq < wantDaq && !s.projects['det:daq']) s = G.startProject(s, 'det', 'daq', { risk: 'safe' });

    // installazione: livello 0→1 subito, dal 2° solo con progetto pronto
    if (!s.shutdown && !s.run) {
      const items = [];
      if (!s.built) items.push('accelerator');
      for (const p of open.slice(0, 2)) for (const k of needs(p)) if (s.det[k] === 0 || (s.projects[`det:${k}`] && s.projects[`det:${k}`].state === 'ready')) items.push(k);
      if (s.built && s.det.daq === 0) items.push('daq');
      if (s.projects['det:daq'] && s.projects['det:daq'].state === 'ready') items.push('daq');
      for (const k of PR.DETECTOR.aging) if (s.projects[`det:${k}`] && s.projects[`det:${k}`].state === 'ready') items.push(k);
      if (items.length) s = G.startShutdown(s, [...new Set(items)], 'pp');
    }
    if (i * 5 - lastTune > 600 || s.program !== lastProgram) { s = G.autotuneCfg(s, target.id); lastTune = i * 5; lastProgram = s.program; }
    const L = G.dataOf(s, target.id);
    if (s.program === target.id && G.canRun(s, target.id)) {
      const st = strategy(target);
      const pl = PH.plan(st, { blind: true, valid: true }, target);
      const e = PH.evaluate(s, target, G.cfgOf(s, target.id), L, PH.SYST_VALID);
      const ready = L > 0 && e.ok && (target.kind === 'measure' ? e.sigma / pl.sens <= target.goal * 0.95 : e.znom * pl.sens >= 5.2);
      if (ready) { ensure('analysis', G.analysisCost(target, st, { blind: true, valid: true })); s = G.startAnalysis(s, target.id, st, { blind: true, valid: true }); }
      else if (!s.run) { ensure('ops', G.runCost(s, 2)); const r2 = G.startRun(s, 2); s = r2.run ? r2 : G.startRun(s, 1); }
    }
  }
  return { hours: Infinity, s, counts, firstDone };
}

const smart = play({});
log('bot esperto:', smart.hours.toFixed(1), 'h', JSON.stringify(smart.counts));
for (const [id, h] of Object.entries(smart.firstDone)) log('  ', id.padEnd(8), h.toFixed(2), 'h');
if (!Number.isFinite(smart.hours)) {
  const q = smart.s;
  assert.fail(`il bot esperto non completa il gioco: ${JSON.stringify({ t: q.t, pools: q.pools.rnd | 0, ops: q.pools.ops | 0, an: q.pools.analysis | 0, budget: G.annualBudget(q), program: q.program, det: q.det, lumi: q.lumiLvl, e: q.energyLvl, built: q.built, run: q.run, shutdown: !!q.shutdown, projects: Object.keys(q.projects), done: Object.keys(q.done), L: q.data[q.program], jobs: Object.keys(q.jobs), age: q.age, ev: (() => { const pp = PR.BY_ID.get(q.program); const e = PH.evaluate(q, pp, G.cfgOf(q, pp.id), q.data[pp.id] || 0, 0.75); return { ok: e.ok, z: e.znom, S: e.S, B: e.B, loss: e.tg && e.tg.loss, cfg: G.cfgOf(q, pp.id) }; })() })}`);
}
assert.ok(smart.hours >= 2 && smart.hours <= 45, `durata fuori scala: ${smart.hours.toFixed(1)} h`);

const dumb = play({ strategy: () => 'cuts' });
log('bot con strategia sbagliata:', dumb.hours.toFixed(1), 'h', JSON.stringify(dumb.counts));
assert.ok(dumb.hours > smart.hours, 'la strategia sbagliata deve costare');

const idle = play({ lazy: true, maxHours: 30 });
assert.ok(Number.isFinite(idle.s.pools.ops) && idle.s.rivalNoted.rho === true && Object.keys(idle.s.done).length === 0);

console.log(`check-game.js: OK (bot esperto ${smart.hours.toFixed(1)} h, strategia sbagliata ${Number.isFinite(dumb.hours) ? dumb.hours.toFixed(1) + ' h' : 'non finisce'})`);
