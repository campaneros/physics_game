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
  assert.equal(poolsSum(s0), 1950, 'fondi iniziali');
  // nessun reddito dentro lo stesso anno
  assert.equal(poolsSum(G.tick(s0, 0.9 * Y)), 1950);
  // a ogni anno intero arriva il budget, diviso secondo l'allocazione, con riporto pari a G.CARRY
  const s1 = G.tick(s0, 1 * Y + 5);
  const budget = G.annualBudget(s0);
  assert.equal(budget, G.BASE_BUDGET);
  near(s1.pools.ops, s0.pools.ops * G.CARRY + (budget * s0.alloc.ops) / 100, 1e-6);
  near(poolsSum(s1), poolsSum(s0) * G.CARRY + budget, 1e-6);
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
  const inst = G.startShutdown({ ...empty }, ['accelerator', 'tracker', 'muon', 'daq'], 'pp');
  assert.ok(inst.built && !inst.shutdown && inst.shutdowns === 0 && inst.det.daq === 1, 'la prima costruzione è immediata e non è un Long Shutdown');
  assert.equal(G.shutdownPlan(empty, ['accelerator', 'tracker']).instant, true);
  assert.equal(G.shutdownPlan(built({ det: { tracker: 1, ecal: 1, hcal: 0, muon: 0, daq: 0 }, projects: { 'det:ecal': { state: 'ready' } } }), ['ecal']).instant, false);
  assert.equal(G.shutdownPlan(empty, ['collider']).ok, false);
  assert.equal(G.shutdownPlan(built(), ['accelerator']).ok, false);
}

// --- 4b. più misure insieme (adroni), costi dei collisori, upgrade collegati ------------------
{
  const det = { tracker: 2, ecal: 2, hcal: 2, muon: 2, daq: 2 };
  const pp = built({ det, collider: 'pp', energyLvl: 3, pools: { ops: 1e5, analysis: 1e5, rnd: 1e5 } });
  assert.equal(PH.slots(pp), 2 + pp.det.daq, 'adroni: 2 posti di base + livello DAQ');
  assert.equal(PH.slots({ ...pp, det: { ...pp.det, daq: 0 } }), 2, 'adroni: già con DAQ 0 si cercano due misure insieme');
  assert.equal(PH.slots({ ...pp, det: { ...pp.det, daq: 4 } }), 6, 'adroni: massimo 6 misure insieme');
  assert.equal(PH.slots({ ...pp, collider: 'ee' }), 1, 'leptoni: una misura sola');
  let s = G.select(pp, 'rho');
  s = G.toggleProgram(s, 'jpsi');
  assert.deepEqual(G.programsOf(s), ['rho'], 'jpsi non è disponibile finché rho non è fatto');
  const doneUp = Object.fromEntries(['rho', 'jpsi', 'upsilon', 'w', 'z', 'top', 'higgs'].map((id) => [id, { z: 9, sigma: 0, limit: false, scooped: false, t: 0 }]));
  const open = G.toggleProgram(G.select({ ...pp, done: doneUp }, 'hbb'), 'hmumu');
  assert.deepEqual(G.programsOf(open), ['hbb', 'hmumu'], 'dopo l\'Higgs si misurano più canali insieme');
  assert.deepEqual(G.programsOf(G.toggleProgram(G.toggleProgram(open, 'zprime'), 'tth')), ['hbb', 'hmumu', 'zprime'], 'massimo = posti disponibili (DAQ 2 → 3)');
  // dati per tutte le misure attive durante una corsa
  const base = G.startRun(G.select(pp, 'rho'), 1);
  const both = G.startRun({ ...G.select(pp, 'rho'), extra: ['jpsi'], done: {}, availAt: { jpsi: 0 } }, 1);
  const ra = G.tick(base, 0.5 * Y);
  const rb = G.tick(both, 0.5 * Y);
  assert.ok(G.dataOf(ra, 'rho') > 0 && G.dataOf(rb, 'rho') > 0 && G.dataOf(rb, 'jpsi') > 0, 'una corsa dà dati a tutte le misure attive');
  near(G.dataOf(rb, 'rho'), G.dataOf(ra, 'rho'));
  // la banda del trigger è condivisa: con più misure si perde di più
  const withSecond = PH.evaluate({ ...pp, program: 'rho', extra: ['jpsi'] }, PR.BY_ID.get('rho'), { trig: 0.1, cut: 0.3 }, 100);
  const alone = PH.evaluate({ ...pp, program: 'rho', extra: [] }, PR.BY_ID.get('rho'), { trig: 0.1, cut: 0.3 }, 100);
  assert.ok(withSecond.tg.total > alone.tg.total && withSecond.tg.loss <= alone.tg.loss && withSecond.tg.shared && !alone.tg.shared);
  // costo: adronico più caro da costruire e da far girare
  assert.ok(PR.COLLIDERS.pp.cost > PR.COLLIDERS.ee.cost && PR.COLLIDERS.pp.runMul > PR.COLLIDERS.ee.runMul);
  const empty = G.newState(0, 'x');
  assert.ok(G.shutdownPlan(empty, ['accelerator'], 'pp').cost > G.shutdownPlan(empty, ['accelerator'], 'ee').cost);
  assert.ok(G.runCost(pp, 2) > G.runCost({ ...pp, collider: 'ee' }, 2));
  // cambiare collisore azzera le misure extra
  const sw = G.tick(G.startShutdown({ ...pp, extra: ['jpsi'], projects: { collider: { state: 'ready', kind: 'collider', spent: 1, cost: 1, years: 1 } } }, ['collider']), 10 * Y);
  assert.equal(sw.collider, 'ee');
  assert.deepEqual(sw.extra, []);
  // ogni livello conta: un calorimetro migliore migliora efficienza e risoluzione delle misure con elettroni/fotoni (menu egamma)
  const higgs = PR.BY_ID.get('higgs');
  const d3 = PH.detector({ ...pp, det: { ...det, ecal: 3 } }, higgs);
  const d4 = PH.detector({ ...pp, det: { ...det, ecal: 4 } }, higgs);
  assert.ok(d4.ok && d4.res < d3.res && d4.eff > d3.eff, 'ECAL in più migliora il segnale egamma');
  const g = PH.upgradeSummary({ ...pp, det: { ...det, ecal: 3 } }, 'ecal');
  assert.ok(g.n >= 1 && g.res > 0 && g.eff > 0, 'il riassunto dell\'upgrade mostra un guadagno');
  assert.ok(PH.upgradeSummary(pp, 'daq').slot === true);
  // più energia sopra soglia = più eventi
  const zb = PR.BY_ID.get('z');
  assert.ok(PH.evaluate({ ...pp, energyLvl: 5 }, zb, { trig: 0.3, cut: 0.3 }, 10).Snom > PH.evaluate({ ...pp, energyLvl: 4 }, zb, { trig: 0.3, cut: 0.3 }, 10).Snom);
}

// --- 4c. tagli di analisi: tutorial guidato, poi scelta del giocatore ----------------------
{
  const q0 = PH.cutQuality(PR.BY_ID.get('top'), PH.goodCuts(PR.BY_ID.get('top')));
  near(q0.m, 1);
  assert.ok(PH.cutQuality(PR.BY_ID.get('top'), ['pt', 'jetveto', 'window']).m === 1);
  assert.ok(PH.cutQuality(PR.BY_ID.get('top'), ['lepid', 'met', 'btag']).m < 0.5, 'tre tagli sbagliati: meno della metà del segnale');
  assert.ok(PH.cutQuality(PR.BY_ID.get('top'), []).m <= 0.6, 'nessun taglio: analisi debole');
  assert.ok(PH.cutQuality(PR.BY_ID.get('top'), ['pt', 'lepid']).m < PH.cutQuality(PR.BY_ID.get('top'), ['pt']).m);
  const rich = built({ det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq: 4 }, energyLvl: 6, pools: { ops: 1e5, analysis: 1e5, rnd: 1e5 }, data: { rho: 100, top: 2000 }, done: { z: { z: 9, sigma: 0, limit: false, scooped: false, t: 0 } }, availAt: { rho: 0, top: 0 } });
  const tut = G.startAnalysis(rich, 'rho', 'bump', { blind: true, valid: true }, ['window']);
  assert.deepEqual(tut.jobs.rho.cuts.sort(), [...PH.goodCuts(PR.BY_ID.get('rho'))].sort(), 'livello 0: i tagli sono guidati');
  const good = G.startAnalysis(rich, 'top', 'mva', { blind: true, valid: true }, ['pt', 'jetveto', 'window']);
  const bad = G.startAnalysis(rich, 'top', 'mva', { blind: true, valid: true }, ['lepid', 'met', 'btag']);
  assert.ok(good.jobs.top.q > bad.jobs.top.q && good.jobs.top.good === 3 && bad.jobs.top.bad === 3);
  const wrongEnd = G.tick(bad, 5 * Y);
  assert.equal(wrongEnd.done.top, undefined, 'con i tagli sbagliati non si pubblica');
  assert.ok(G.tick(good, 5 * Y).jobs.top.state === 'confirm', 'con i tagli giusti la stessa statistica basta');
  assert.ok(wrongEnd.events.some((e) => e.k === 'inconclusive' && e.v.good === 0));
}

// --- 5b. eventi casuali sui fondi -------------------------------------------------------
{
  assert.equal(G.FUND_EVENTS.length, 20);
  const seen = new Set();
  const signs = new Set();
  for (let i = 0; i < 20; i++) {
    const r = G.tick(built({ seed: `fev${i}` }), 30 * Y);
    assert.ok(Object.values(r.pools).every((v) => v >= 0), 'i conti non vanno mai sotto zero');
    for (const e of r.events) if (e.k === 'fev') { seen.add(e.v.id); signs.add(e.v.sign); }
    const again = G.tick(built({ seed: `fev${i}` }), 30 * Y);
    assert.deepEqual(r.events.filter((e) => e.k === 'fev').map((e) => e.v), again.events.filter((e) => e.k === 'fev').map((e) => e.v), 'deterministici dal seed');
  }
  assert.ok(seen.size >= 15 && signs.has('+') && signs.has('−'), `eventi positivi e negativi (${seen.size} diversi)`);
  const quiet = G.tick(built({ seed: 'fev0' }), 1.5 * Y);
  assert.ok(!quiet.events.some((e) => e.k === 'fev'), 'nessun evento nel primo anno');
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
  // il costo intero si paga subito all'avvio; senza fondi il progetto non parte
  const started = G.startProject(s, 'lumi', null, {});
  near(started.pools.rnd, s.pools.rnd - started.projects.lumi.cost);
  const mid = G.tick(started, 0.5 * Y);
  near(mid.pools.rnd, started.pools.rnd, 1e-6 + 0); // lo sviluppo non toglie altro
  assert.equal(G.startProject({ ...s, pools: { ...s.pools, rnd: 1 } }, 'lumi', null, {}).projects.lumi, undefined, 'senza fondi non parte');
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
  const ac = G.analysisCost(r, PR.BY_ID.get('rho'), 'bump', { blind: true, valid: true });
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
const { play } = require('./bot.js');

const smart = play({});
log('bot esperto:', smart.hours.toFixed(1), 'h', JSON.stringify(smart.counts));
for (const [id, h] of Object.entries(smart.firstDone)) log('  ', id.padEnd(8), h.toFixed(2), 'h');
if (!Number.isFinite(smart.hours)) {
  const q = smart.s;
  assert.fail(`il bot esperto non completa il gioco: ${JSON.stringify({ t: q.t, pools: q.pools.rnd | 0, ops: q.pools.ops | 0, an: q.pools.analysis | 0, budget: G.annualBudget(q), program: q.program, det: q.det, lumi: q.lumiLvl, e: q.energyLvl, built: q.built, run: q.run, shutdown: !!q.shutdown, projects: Object.keys(q.projects), done: Object.keys(q.done), L: q.data[q.program], jobs: Object.keys(q.jobs), age: q.age, ev: (() => { const pp = PR.BY_ID.get(q.program); const e = PH.evaluate(q, pp, G.cfgOf(q, pp.id), q.data[pp.id] || 0, 0.75); return { ok: e.ok, z: e.znom, S: e.S, B: e.B, loss: e.tg && e.tg.loss, cfg: G.cfgOf(q, pp.id) }; })() })}`);
}
assert.ok(smart.hours >= 2 && smart.hours <= 45, `durata fuori scala: ${smart.hours.toFixed(1)} h`);
// ritmo dei risultati: ~56 risultati in ~7-9 h, uno ogni 5-10 min in media, più radi all'inizio e più fitti alla fine
{
  const times = Object.entries(smart.firstDone).sort((a, b) => a[1] - b[1]).map(([, h]) => h * 60);
  assert.equal(times.length, 56, 'il catalogo ha 56 risultati');
  assert.ok(smart.hours >= 10 && smart.hours <= 12.5, `durata totale ${smart.hours.toFixed(1)} h fuori dalle 10-12,5 h`);
  const avg = (a, b) => (times[b - 1] - (a ? times[a - 1] : 0)) / (b - a);
  const n = times.length;
  const thirds = [avg(0, Math.floor(n / 3)), avg(Math.floor(n / 3), Math.floor((2 * n) / 3)), avg(Math.floor((2 * n) / 3), n)];
  log('intervallo medio per terzo (min):', thirds.map((x) => x.toFixed(1)).join(' → '));
  assert.ok(thirds.every((x) => x >= 8 && x <= 16), `intervalli per terzo fuori scala: ${thirds.map((x) => x.toFixed(1))}`);
  assert.ok(Math.max(...thirds) <= 1.4 * Math.min(...thirds), 'nessun terzo di partita è molto più lento degli altri (niente buchi di ricompense)');
  assert.ok(times[0] >= 5 && times[0] <= 20, 'il primo risultato arriva tra 5 e 20 minuti');
}

const dumb = play({ strategy: () => 'cuts' });
log('bot con strategia sbagliata:', dumb.hours.toFixed(1), 'h', JSON.stringify(dumb.counts));
assert.ok(dumb.hours > smart.hours, 'la strategia sbagliata deve costare');

const idle = play({ lazy: true, maxHours: 30 });
assert.ok(Number.isFinite(idle.s.pools.ops) && idle.s.rivalNoted.rho === true && Object.keys(idle.s.done).length === 0);

console.log(`check-game.js: OK (bot esperto ${smart.hours.toFixed(1)} h, strategia sbagliata ${Number.isFinite(dumb.hours) ? dumb.hours.toFixed(1) + ' h' : 'non finisce'})`);
