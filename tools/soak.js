// Test di durata della logica: gira in continuo fino all'ora indicata (default 18:00 di oggi).
// Ripete in ciclo: partite complete con semi diversi (esperto e giocatori deboli), fuzz di azioni casuali, fuzz di salvataggi mutati.
// Scrive in soak/: logic.log (una riga per giro), logic-findings.jsonl (problemi, deduplicati), logic-stats.json (statistiche).
// Uso: node tools/soak.js [HH:MM|ISO]
const fs = require('node:fs');
const path = require('node:path');
const G = require('../www/game.js');
const PR = require('../www/processes.js');
const PH = require('../www/physics.js');
const { play } = require('../bot.js');

const DIR = path.join(__dirname, '..', 'soak');
fs.mkdirSync(DIR, { recursive: true });

function parseDeadline(arg = '18:00') {
  if (/^\d{1,2}:\d{2}$/.test(arg)) { const [h, m] = arg.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); return d.getTime(); }
  return new Date(arg).getTime();
}
const DEADLINE = parseDeadline(process.argv[2]);
const START = Date.now();
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (...a) => { const line = `${stamp()} ${a.join(' ')}`; fs.appendFileSync(path.join(DIR, 'logic.log'), line + '\n'); };

// --- risultati e problemi ---------------------------------------------------------------------------
const findings = new Map();
const finding = (kind, detail, repro) => {
  const key = `${kind}:${detail.replace(/\d+(\.\d+)?/g, '#')}`;
  const f = findings.get(key) || { kind, detail, count: 0, first: stamp(), repro };
  f.count++;
  if (f.count === 1) fs.appendFileSync(path.join(DIR, 'logic-findings.jsonl'), JSON.stringify(f) + '\n');
  findings.set(key, f);
};
const stats = { runs: 0, expert: [], scoopedExpert: [], weak: [], random: [], noTransfers: [], oneYear: [], fuzzGames: 0, fuzzSteps: 0, saveMutations: 0, saveMutationFails: 0, firstResultMin: [], thirds: [] };
const quant = (a, q) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const summary = () => {
  const o = {
    started: new Date(START).toISOString(), now: stamp(), deadline: new Date(DEADLINE).toISOString(), runs: stats.runs,
    expertHours: { n: stats.expert.length, p5: quant(stats.expert, 0.05), median: quant(stats.expert, 0.5), p95: quant(stats.expert, 0.95), max: Math.max(0, ...stats.expert) },
    expertScooped: { max: Math.max(0, ...stats.scoopedExpert), mean: stats.scoopedExpert.length ? stats.scoopedExpert.reduce((a, b) => a + b, 0) / stats.scoopedExpert.length : 0 },
    firstResultMin: { min: Math.min(...stats.firstResultMin), median: quant(stats.firstResultMin, 0.5) },
    thirds: stats.thirds.length ? [0, 1, 2].map((k) => stats.thirds.reduce((a, t) => a + t[k], 0) / stats.thirds.length) : null,
    weakHours: { n: stats.weak.length, median: quant(stats.weak, 0.5), p95: quant(stats.weak, 0.95) },
    randomCutsHours: { n: stats.random.length, median: quant(stats.random, 0.5), p95: quant(stats.random, 0.95) },
    noTransfersHours: { n: stats.noTransfers.length, median: quant(stats.noTransfers, 0.5) },
    oneYearHours: { n: stats.oneYear.length, median: quant(stats.oneYear, 0.5) },
    fuzzGames: stats.fuzzGames, fuzzSteps: stats.fuzzSteps, saveMutations: stats.saveMutations, saveMutationFails: stats.saveMutationFails,
    findings: [...findings.values()].map((f) => ({ kind: f.kind, detail: f.detail, count: f.count, first: f.first })),
  };
  fs.writeFileSync(path.join(DIR, 'logic-stats.json'), JSON.stringify(o, null, 1));
  return o;
};

// --- invarianti ---------------------------------------------------------------------------------------
function invariants(s, where) {
  const bad = [];
  for (const k of G.POOLS) if (!Number.isFinite(s.pools[k]) || s.pools[k] < -1e-6) bad.push(`fondo ${k}=${s.pools[k]}`);
  if (s.alloc.ops + s.alloc.analysis + s.alloc.rnd !== 100) bad.push(`allocazione ${JSON.stringify(s.alloc)}`);
  if (Object.keys(s.projects).length > G.MAX_PROJECTS) bad.push('troppi progetti');
  if (G.programsOf(s).length > PH.slots(s)) bad.push('più misure dei posti');
  if (s.run && s.shutdown) bad.push('corsa e fermo insieme');
  for (const k of PR.DETECTOR.subsystems) if (!(s.det[k] >= 0 && s.det[k] <= PR.DETECTOR.maxLevel)) bad.push(`livello ${k}=${s.det[k]}`);
  for (const [id, v] of Object.entries(s.data)) if (!(v >= 0) || !Number.isFinite(v)) bad.push(`dati ${id}=${v}`);
  for (const k of ['t', 'rep', 'energyLvl', 'lumiLvl']) if (!Number.isFinite(s[k]) || s[k] < 0) bad.push(`${k}=${s[k]}`);
  for (const b of s.boosts) if (!(b.amount <= 10 && b.years >= 1)) bad.push('boost fuori scala');
  for (const id of G.programsOf(s)) if (G.isDone(s, id) || !G.isAvail(s, id)) bad.push(`misura ${id} non valida`);
  if (s.collider === 'ee' && G.programsOf(s).length > 1) bad.push('leptoni con più misure');
  for (const b of bad) finding('invariante', `${where}: ${b}`);
  return bad.length === 0;
}

// --- 1. partite complete -----------------------------------------------------------------------------------
const seedOf = (n) => `soak${n}`;
function fullGames(n) {
  const seed = seedOf(n);
  const snapHours = n % 4 === 0 ? [1, 2.5, 4, 5.5, 7] : [];
  const ex = play({ seed, maxHours: 80, snapshotHours: snapHours });
  stats.expert.push(ex.hours);
  stats.scoopedExpert.push(ex.counts.scooped);
  const done = Object.keys(ex.s.done).length;
  if (!Number.isFinite(ex.hours) || done < 56) finding('partita', `l'esperto non finisce (seed ${seed}): ${done}/56`, { seed });
  else {
    if (ex.hours < 6 || ex.hours > 10.5) finding('bilanciamento', `durata esperto fuori da 6-10,5 h (seed ${seed}): ${ex.hours.toFixed(1)} h`, { seed });
    if (ex.counts.scooped > 4) finding('bilanciamento', `esperto scavalcato ${ex.counts.scooped} volte (seed ${seed})`, { seed });
    const t = Object.values(ex.firstDone).sort((a, b) => a - b).map((h) => h * 60);
    stats.firstResultMin.push(t[0]);
    const avg = (a, b) => (t[b - 1] - (a ? t[a - 1] : 0)) / (b - a);
    const nn = t.length;
    const th = [avg(0, Math.floor(nn / 3)), avg(Math.floor(nn / 3), Math.floor((2 * nn) / 3)), avg(Math.floor((2 * nn) / 3), nn)];
    stats.thirds.push(th);
    if (t[0] < 6) finding('bilanciamento', `primo risultato dopo ${t[0].toFixed(0)} min (seed ${seed})`, { seed });
    if (th.some((x) => x < 4 || x > 14)) finding('bilanciamento', `ritmo per terzo fuori scala ${th.map((x) => x.toFixed(1))} (seed ${seed})`, { seed });
  }
  invariants(ex.s, `partita esperto ${seed}`);
  if (n % 3 === 0) { const w = play({ seed, maxHours: 80, strategy: () => 'cuts' }); stats.weak.push(w.hours); if (!Number.isFinite(w.hours)) finding('partita', `strategia debole non finisce (seed ${seed})`, { seed }); invariants(w.s, `partita debole ${seed}`); }
  if (n % 3 === 1) { const r = play({ seed, maxHours: 80, cutsPolicy: 'random' }); stats.random.push(r.hours); if (!Number.isFinite(r.hours)) finding('partita', `tagli a caso non finisce (seed ${seed})`, { seed }); invariants(r.s, `partita tagli a caso ${seed}`); }
  if (n % 3 === 2) { const a = play({ seed, maxHours: 80, transfers: false }); stats.noTransfers.push(a.hours); const b = play({ seed, maxHours: 80, runYears: [1] }); stats.oneYear.push(b.hours); if (!Number.isFinite(a.hours) || !Number.isFinite(b.hours)) finding('partita', `senza trasferimenti o corse da 1 anno non finisce (seed ${seed})`, { seed }); }
  if (ex.snapshots && Object.keys(ex.snapshots).length) fs.writeFileSync(path.join(DIR, 'checkpoints.json'), JSON.stringify(ex.snapshots));
  return `${seed}: esperto ${Number.isFinite(ex.hours) ? ex.hours.toFixed(2) : '—'} h, ${done}/56, scavalcato ${ex.counts.scooped}`;
}

// --- 2. fuzz di azioni casuali --------------------------------------------------------------------------------
let rs = 99;
const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
function fuzzGame(n) {
  const subs = PR.DETECTOR.subsystems;
  let s = G.newState(0, `fz${n}`);
  const steps = 500;
  for (let i = 0; i < steps; i++) {
    const r = rnd();
    try {
      if (r < 0.10) s = G.startShutdown(s, [pick(['accelerator', ...subs, 'collider'])], pick(['pp', 'ee']));
      else if (r < 0.2) s = G.startProject(s, pick(['energy', 'lumi', 'det', 'collider']), pick(subs), { risk: pick(['safe', 'bold']), fast: rnd() < 0.3 });
      else if (r < 0.28) s = G.select(s, pick(PR.PROCESSES).id);
      else if (r < 0.36) s = G.toggleProgram(s, pick(PR.PROCESSES).id);
      else if (r < 0.44) s = G.startRun(s, pick(G.RUN_YEARS));
      else if (r < 0.50) s = G.setCfg(s, pick(PR.PROCESSES).id, { trig: rnd() * 1.4 - 0.2, cut: rnd() * 1.6 });
      else if (r < 0.58) s = G.startAnalysis(s, pick(PR.PROCESSES).id, pick(Object.keys(PH.STRATEGIES)), { blind: rnd() < 0.5, valid: rnd() < 0.5 }, [pick(PR.CUTS), pick(PR.CUTS), pick(PR.CUTS)]);
      else if (r < 0.64) s = G.transfer(s, pick(G.POOLS), pick(G.POOLS), rnd() * 2500 - 100);
      else if (r < 0.68) s = G.setAlloc(s, { ops: Math.floor(rnd() * 100), analysis: Math.floor(rnd() * 100), rnd: Math.floor(rnd() * 100) });
      else if (r < 0.72) for (const j of Object.keys(s.jobs)) s = G.confirmDiscovery(s, j, rnd() < 0.5 ? 0 : 70);
      else if (r < 0.76) for (const e of s.pending) s = G.resolveEvent(s, e.id, pick(['pay', 'accept']));
      else if (r < 0.78) s = G.claimFunds(s, pick(['shape', 'budget']), rnd() * 100, pick(['free', '2026-10-12']));
      else s = G.tick(s, rnd() * 4 * G.YEAR_S);
      invariants(s, `fuzz fz${n}/${i}`);
      if (i % 50 === 0) { const back = G.load(G.serialize({ ...s, last: 0 }), 0).state; if (Object.keys(back.done).sort().join() !== Object.keys(s.done).sort().join() || back.built !== s.built || back.energyLvl !== s.energyLvl) finding('salvataggio', `ricarica diversa (fz${n}/${i})`, { n, i }); }
    } catch (e) { finding('eccezione', `fuzz fz${n}/${i}: ${e.message}`, { n, i }); return; }
  }
  stats.fuzzGames++;
  stats.fuzzSteps += steps;
}

// --- 3. salvataggi mutati ---------------------------------------------------------------------------------------
function mutate(obj, depth = 0) {
  const keys = Object.keys(obj);
  if (!keys.length) return;
  const k = pick(keys);
  const v = obj[k];
  const r = rnd();
  if (v && typeof v === 'object' && depth < 3 && r < 0.6) return mutate(v, depth + 1);
  const junk = [null, 'NaN', 'x'.repeat(5000), 1e308, -1e308, -1, 0, [], {}, [1, 2, 3], { __proto__: { evil: 1 } }, true, '<script>alert(1)</script>', 9007199254740993, 1e-300];
  if (r < 0.15) delete obj[k]; else obj[k] = pick(junk);
}
function saveMutations(n) {
  let bases = [];
  try { bases = Object.values(JSON.parse(fs.readFileSync(path.join(DIR, 'checkpoints.json'), 'utf8'))); } catch (e) { /* ancora nessun checkpoint */ }
  if (!bases.length) bases = [G.serialize({ ...G.newState(0, `m${n}`), last: 0 })];
  for (let i = 0; i < 200; i++) {
    const obj = JSON.parse(pick(bases));
    for (let m = 0, c = 1 + Math.floor(rnd() * 4); m < c; m++) mutate(obj);
    stats.saveMutations++;
    try {
      const { state } = G.load(JSON.stringify(obj), 1.7e12, 'seed');
      if (!invariants(state, `salvataggio mutato ${n}/${i}`)) stats.saveMutationFails++;
      const after = G.tick(state, 30 * G.YEAR_S);
      if (!invariants(after, `salvataggio mutato+tick ${n}/${i}`)) stats.saveMutationFails++;
      if (({}).evil !== undefined || Object.prototype.polluted !== undefined) finding('sicurezza', 'inquinamento del prototipo', { n, i });
    } catch (e) { finding('eccezione', `salvataggio mutato: ${e.message}`, { n, i, mut: JSON.stringify(obj).slice(0, 300) }); stats.saveMutationFails++; }
  }
}

// --- ciclo principale ------------------------------------------------------------------------------------------------
log(`avvio: scadenza ${new Date(DEADLINE).toISOString()}`);
let n = 0;
let lastSummary = 0;
while (Date.now() < DEADLINE) {
  const t0 = Date.now();
  try {
    const line = fullGames(n);
    for (let i = 0; i < 4 && Date.now() < DEADLINE; i++) fuzzGame(n * 10 + i);
    saveMutations(n);
    stats.runs++;
    log(`giro ${n} (${((Date.now() - t0) / 1000).toFixed(0)} s): ${line}; fuzz ${stats.fuzzGames} partite; mutazioni ${stats.saveMutations}; problemi ${findings.size}`);
  } catch (e) { finding('eccezione', `giro ${n}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`, { n }); }
  n++;
  if (Date.now() - lastSummary > 5 * 60_000) { summary(); lastSummary = Date.now(); }
}
const final = summary();
log('fine: ' + JSON.stringify({ runs: final.runs, problemi: final.findings.length }));
