// Test del modello puro (nessun browser): `node check-model.js`.
// Detector → efficienza/risoluzione, albero dei bersagli, minigioco (seed e punteggio), conti e fondi (proprietà su sequenze casuali).
const assert = require('node:assert/strict');
const G = require('./www/game.js');
const PR = require('./www/processes.js');
const PH = require('./www/physics.js');
const C = require('./www/core.js');

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
const MAXL = PR.DETECTOR.maxLevel;
const built = (over = {}) => ({ ...G.newState(0, 'model'), built: true, collider: 'pp', energyLvl: 6, det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq: 2 }, age: {}, ...over });

// --- 1. detector: formule di efficienza e risoluzione, e monotonia per livello ----------------
{
  // riferimento indipendente (la specifica): extra = media pesata dei livelli sopra il minimo; eff = min(0.95, 0.6 + 0.1·extra); res = res0/(1 + 0.25·extra)·√pileup
  const reference = (s, p) => {
    const w = PH.relevant(p);
    let extra = 0, tot = 0;
    for (const [k, wk] of Object.entries(w)) { extra += wk * Math.max(0, s.det[k] - (p.need[k] || 0)); tot += wk; }
    extra /= tot;
    return { extra, eff: Math.min(0.95, 0.6 + 0.1 * extra), res: (p.res0 / (1 + 0.25 * extra)) * Math.sqrt(PH.pileup(s)) };
  };
  let checked = 0;
  for (const p of PR.PROCESSES) {
    for (let lvl = 0; lvl <= MAXL; lvl++) {
      const s = built({ det: Object.fromEntries(PR.DETECTOR.subsystems.map((k) => [k, lvl])), lumiLvl: 0 });
      const d = PH.detector(s, p);
      const needMet = Object.entries(p.need).every(([k, n]) => s.det[k] >= n);
      assert.equal(d.ok, needMet, `${p.id} lvl ${lvl}: ok dipende solo dai requisiti`);
      if (!d.ok) continue;
      const ref = reference(s, p);
      near(d.eff, ref.eff); near(d.res, ref.res); near(d.extra, ref.extra);
      checked++;
    }
    // ogni livello in più di un sottosistema rilevante non peggiora efficienza né risoluzione, e il segnale atteso non cala
    for (const k of Object.keys(PH.relevant(p))) {
      const base = Object.fromEntries(PR.DETECTOR.subsystems.map((x) => [x, 4]));
      let prev = null;
      for (let lvl = p.need[k] || 0; lvl <= MAXL; lvl++) {
        const s = built({ det: { ...base, [k]: lvl } });
        const d = PH.detector(s, p);
        const e = PH.evaluate(s, p, { trig: 0.3, cut: 0.3 }, 100);
        if (prev) {
          assert.ok(d.eff >= prev.d.eff - 1e-12, `${p.id}/${k}: l'efficienza non deve calare salendo di livello`);
          assert.ok(d.res <= prev.d.res + 1e-12, `${p.id}/${k}: la risoluzione (σ) non deve peggiorare`);
          assert.ok(e.Snom >= prev.e.Snom - 1e-9, `${p.id}/${k}: il segnale atteso non deve calare`);
        }
        prev = { d, e };
      }
    }
  }
  assert.ok(checked > 100, `copertura: processi × livelli verificati (${checked})`);
  // la sezione d'urto effettiva dipende dall'energia sopra soglia, non dal detector: stesso detector → stesso xs
  const p = PR.BY_ID.get('rho');
  const a = PH.evaluate(built({ det: { tracker: 1, ecal: 1, hcal: 1, muon: 1, daq: 1 } }), p, { trig: 0.3, cut: 0.3 }, 10);
  const b = PH.evaluate(built({ det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq: 1 } }), p, { trig: 0.3, cut: 0.3 }, 10);
  near(a.xs, b.xs);
  assert.ok(b.S >= a.S, 'detector migliore → più segnale');
  // upgradeGain coerente con detector(): il guadagno dichiarato è esattamente il rapporto prima/dopo
  const s = built({ det: { tracker: 1, ecal: 1, hcal: 1, muon: 1, daq: 1 } });
  const g = PH.upgradeGain(s, p, 'tracker');
  const d0 = PH.detector(s, p), d1 = PH.detector({ ...s, det: { ...s.det, tracker: 2 } }, p);
  near(g.res, 1 - d1.res / d0.res); near(g.eff, d1.eff / d0.eff - 1);
  // DAQ: la banda del trigger cresce di ×6 a ogni livello e la perdita di eventi non peggiora
  let prevBw = 0, prevLoss = 0;
  for (let daq = 0; daq <= MAXL; daq++) {
    const t = PH.trigger(built({ det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq } }), p, 0.3);
    if (daq) { near(t.bandwidth / prevBw, 6); assert.ok(t.loss >= prevLoss); }
    prevBw = t.bandwidth; prevLoss = t.loss;
  }
}

// --- 2. albero dei bersagli: dipendenze e posti ------------------------------------------------
{
  const ids = new Set(PR.PROCESSES.map((p) => p.id));
  const seen = new Set();
  for (const p of PR.PROCESSES) {
    for (const a of p.after) { assert.ok(ids.has(a), `${p.id}: prerequisito sconosciuto ${a}`); assert.ok(seen.has(a), `${p.id}: ${a} deve venire prima nel catalogo (nessun ciclo)`); }
    seen.add(p.id);
  }
  const rec = { z: 6, sigma: 0, limit: false, scooped: false, t: 0, rep: 1, boost: 0.1, years: 6, snap: null };
  for (const p of PR.PROCESSES.filter((q) => q.after.length)) {
    const base = built({ done: {} });
    assert.equal(G.isAvail(base, p.id), false, `${p.id}: bloccato senza prerequisiti`);
    assert.strictEqual(G.select(base, p.id), base, `${p.id}: non si seleziona se bloccato`);
    assert.strictEqual(G.toggleProgram(base, p.id), base, `${p.id}: non si aggiunge alla presa dati se bloccato`);
    assert.strictEqual(G.startAnalysis(base, p.id, 'bump', {}, []), base, `${p.id}: nessuna analisi se bloccato`);
    // tutti i prerequisiti tranne uno: ancora bloccato; con l'ultimo: disponibile
    p.after.forEach((missing) => {
      const done = Object.fromEntries(p.after.filter((a) => a !== missing).map((a) => [a, rec]));
      if (p.after.length > 1) assert.equal(G.isAvail({ ...base, done }, p.id), false, `${p.id}: manca ${missing}`);
    });
    const all = Object.fromEntries(p.after.map((a) => [a, rec]));
    assert.equal(G.isAvail({ ...base, done: all }, p.id), true, `${p.id}: sbloccato con tutti i prerequisiti`);
  }
  // posti in parallelo: mai oltre il massimo, mai un bersaglio ripetuto
  let s = built({ collider: 'pp', det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq: 0 }, done: Object.fromEntries(PR.PROCESSES.filter((p) => !p.after.length || p.after.every((a) => a === 'rho')).map((p) => [p.id, rec])) });
  const open = PR.PROCESSES.filter((p) => G.isAvail(s, p.id) && !(p.id in s.done)).map((p) => p.id);
  for (const id of open) s = G.toggleProgram(s, id);
  assert.ok(G.programsOf(s).length <= PH.slots(s), 'mai oltre i posti disponibili');
  assert.equal(new Set(G.programsOf(s)).size, G.programsOf(s).length, 'nessun bersaglio ripetuto');
}

// --- 3. minigioco: seed e punteggio -------------------------------------------------------------
{
  for (let i = 0; i < 40; i++) {
    const a = C.newGame(`seed-${i}`), b = C.newGame(`seed-${i}`);
    assert.deepEqual({ ...a }, { ...b }, 'stesso seed → stessa partita');
    assert.ok(a.choices.includes(a.answer), 'la risposta è tra le scelte');
  }
  const answers = new Set(Array.from({ length: 60 }, (_, i) => C.newGame(`v-${i}`).answer));
  assert.ok(answers.size >= 4, 'seed diversi → forme diverse');
  assert.equal(C.score(5, false), 0, 'risposta sbagliata: zero punti');
  assert.equal(C.score(0, true), 0, 'nessun lancio: zero punti');
  for (let n = 1; n < 20; n++) assert.ok(C.score(n + 1, true) <= C.score(n, true), 'più lanci non fanno guadagnare');
  assert.ok(C.score(1, true) > 0);
  // sfida giornaliera: una ricompensa per giorno e per sorgente
  let s = G.newState(0, 'x');
  assert.equal(G.canClaim(s, 'shape', '2026-01-01'), true);
  const once = G.claimFunds(s, 'shape', 80, '2026-01-01');
  assert.ok(G.totalFunds(once) > G.totalFunds(s), 'la prima ricompensa paga');
  assert.equal(G.canClaim(once, 'shape', '2026-01-01'), false, 'non si riscuote due volte lo stesso giorno');
  assert.strictEqual(G.claimFunds(once, 'shape', 80, '2026-01-01'), once, 'il secondo tentativo non cambia nulla');
}

// --- 4. conti e fondi: proprietà su sequenze casuali ---------------------------------------------
{
  const r = C.rng(C.hash('ledger'));
  let s = built({ pools: { ops: 450, analysis: 200, rnd: 1300 } });
  let worstDrift = 0;
  const check = (label) => {
    for (const k of G.POOLS) { assert.ok(Number.isFinite(s.pools[k]), `${label}: ${k} finito`); assert.ok(s.pools[k] >= -1e-9, `${label}: ${k} non negativo`); }
    assert.equal(G.POOLS.reduce((a, k) => a + s.alloc[k], 0), 100, `${label}: allocazione somma 100`);
    assert.ok(G.POOLS.every((k) => s.alloc[k] >= G.MIN_ALLOC), `${label}: minimo 10%`);
    near(G.totalFunds(s), G.POOLS.reduce((a, k) => a + s.pools[k], 0), 1e-12);
  };
  for (let i = 0; i < 3000; i++) {
    const op = r();
    const before = G.totalFunds(s);
    if (op < 0.4) s = G.tick(s, 1 + r() * 30);
    else if (op < 0.75) {
      const [from, to] = [G.POOLS[Math.floor(r() * 3)], G.POOLS[Math.floor(r() * 3)]];
      const amount = r() * s.pools[from];
      const fee = G.transferFee(s, to);
      const next = G.transfer(s, from, to, amount);
      if (next !== s) { const drift = Math.abs((before - G.totalFunds(next)) - amount * fee); worstDrift = Math.max(worstDrift, drift / Math.max(1, before)); }
      s = next;
    } else if (op < 0.9) {
      const a = 10 + 5 * Math.floor(r() * 13), b2 = 10 + 5 * Math.floor(r() * Math.max(1, (100 - a - 10) / 5));
      const alloc = { ops: a, analysis: Math.min(b2, 90 - a), rnd: 0 };
      alloc.rnd = 100 - alloc.ops - alloc.analysis;
      s = G.setAlloc(s, alloc);
    } else s = G.addFunds(s, r() * 500);
    check(`passo ${i}`);
  }
  assert.ok(worstDrift < 1e-12, `la commissione dei trasferimenti è esatta (deriva ${worstDrift})`);
  // il bilancio annuale è un intero: nessun resto in virgola mobile nei fondi di base
  for (const y of [0, 1.5, 7.25, 40]) assert.ok(Number.isInteger(G.annualBudget(built(), y)), 'budget annuale intero');
  // commissione: 10% di norma, nulla verso un conto quasi a secco (rete di sicurezza contro i blocchi)
  const t0 = built({ pools: { ops: 1000, analysis: 0, rnd: 1000 } });
  near(G.transferFee(t0, 'analysis'), 0);
  near(G.transferFee(t0, 'rnd'), G.TRANSFER_FEE);
  const t1 = G.transfer(t0, 'ops', 'analysis', 500);
  near(t1.pools.ops, 500); near(t1.pools.analysis, 500); // verso un conto vuoto: nessuna perdita
  const t2 = G.transfer(t0, 'ops', 'rnd', 500);
  near(t2.pools.rnd, 1450); // verso un conto pieno: 10%
  const low = 0.25 * G.annualBudget(t0);
  near(G.transferFee(built({ pools: { ops: 0, analysis: low - 1, rnd: 0 } }), 'analysis'), 0);
  near(G.transferFee(built({ pools: { ops: 0, analysis: low, rnd: 0 } }), 'analysis'), G.TRANSFER_FEE);
  assert.strictEqual(G.transfer(t0, 'ops', 'ops', 10), t0, 'da un conto a se stesso: nulla');
  assert.strictEqual(G.transfer(t0, 'ops', 'rnd', 1001), t0, 'oltre il saldo: rifiutato');
}

// --- 5. costo delle analisi, strategie e collisori ----------------------------------------------------
{
  const s = built();
  const p = PR.BY_ID.get('rho');
  const none = G.analysisCost(s, p, 'bump', { blind: false, valid: false });
  const blind = G.analysisCost(s, p, 'bump', { blind: true, valid: false });
  const valid = G.analysisCost(s, p, 'bump', { blind: false, valid: true });
  const both = G.analysisCost(s, p, 'bump', { blind: true, valid: true });
  assert.ok(Math.abs(blind / none - 1.2) < 0.01, 'analisi cieca: +20% di fondi Analisi');
  assert.ok(Math.abs(valid / none - 1.25) < 0.01, 'validazione: +25% di fondi Analisi');
  assert.ok(Math.abs(both / none - 1.45) < 0.01, 'insieme: +45%');
  // nessuna strategia domina le altre su tutti i tipi di segnale per tempo atteso e costo insieme
  for (const type of ['peak', 'rare', 'nonres', 'precision']) {
    const q = PR.PROCESSES.find((x) => x.type === type);
    const score = (st) => PH.STRATEGIES[st].sens[type] / (PH.plan(st, { blind: true, valid: true }, q).years * G.analysisCost(s, q, st, { blind: true, valid: true }));
    const best = Object.keys(PH.STRATEGIES).sort((a, b) => score(b) - score(a))[0];
    assert.ok(best, `${type}: esiste una strategia più efficiente per ${type}`);
  }
  assert.ok(PH.STRATEGIES.mva.years > PH.STRATEGIES.bump.years, 'MVA è più lenta del bump hunt');
  // collisore più rapido: ρ e J/ψ meglio con gli adroni, le Higgs con i leptoni, le misure non hanno suggerimento
  assert.equal(PH.fasterCollider(PR.BY_ID.get('rho')), 'pp');
  assert.equal(PH.fasterCollider(PR.BY_ID.get('higgs')), 'ee');
  assert.equal(PH.fasterCollider(PR.PROCESSES.find((x) => x.kind === 'measure')), null);
  const verdicts = new Set(PR.PROCESSES.filter((x) => x.kind === 'discovery').map((x) => PH.fasterCollider(x)));
  assert.ok(verdicts.has('pp') && verdicts.has('ee'), 'entrambi i collisori hanno una nicchia');
}

console.log('check-model.js: OK');
