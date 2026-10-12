// Audit del gioco (solo logica, niente browser): scenari di giocatori diversi, fuzz con azioni casuali, fattibilità del collisore leptonico.
// Uso: node tools/audit.js   — stampa un rapporto con le criticità; non fallisce.
const G = require('../www/game.js');
const PR = require('../www/processes.js');
const PH = require('../www/physics.js');
const { play } = require('../bot.js');

const out = (...a) => console.log(...a);
const pct = (x) => `${Math.round(x * 100)}%`;

// 1. giocatori diversi -------------------------------------------------------------------------------
out('## 1. Scenari di giocatori (ore di gioco attivo per finire; "—" = non finisce entro 60 h)');
const scenarios = {
  'esperto (riferimento)': {},
  'senza trasferimenti di fondi': { transfers: false },
  'solo corse da 1 anno': { runYears: [1] },
  'strategia sempre "conta dopo i tagli"': { strategy: () => 'cuts' },
  'tagli scelti a caso': { cutsPolicy: 'random' },
  'nessun taglio scelto': { cutsPolicy: 'none' },
  'assente (non fa nulla)': { lazy: true, maxHours: 30 },
};
const results = {};
for (const [name, opt] of Object.entries(scenarios)) {
  const r = play({ maxHours: 60, sample: 60, ...opt });
  results[name] = r;
  const done = Object.keys(r.s.done).length;
  out(`- ${name.padEnd(40)} ${Number.isFinite(r.hours) ? `${r.hours.toFixed(1)} h` : '—'.padEnd(6)} risultati ${done}/56, scavalcato ${r.counts.scooped}, non conclusive ${r.counts.inconclusive}, ricontrolli ${r.counts.review}`);
}

// 2. tempi morti e fondi (giocatore esperto) ----------------------------------------------------------
out('\n## 2. Tempi morti del giocatore esperto');
const tl = results['esperto (riferimento)'].timeline;
const idle = tl.filter((t) => !t.run && !t.sh).length / tl.length;
const lowOps = tl.filter((t) => t.ops < 150).length / tl.length;
out(`- campioni senza corsa né fermo in corso: ${pct(idle)}; fondo Operazioni sotto 150: ${pct(lowOps)}`);
const gaps = Object.entries(results['esperto (riferimento)'].firstDone).sort((a, b) => a[1] - b[1]);
const biggest = gaps.map(([id, h], i) => [id, (h - (i ? gaps[i - 1][1] : 0)) * 60]).sort((a, b) => b[1] - a[1]).slice(0, 5);
out(`- cinque attese più lunghe tra due risultati: ${biggest.map(([id, m]) => `${id} +${m.toFixed(0)} min`).join(', ')}`);
const scoopedBy = results['strategia sempre "conta dopo i tagli"'].counts.scooped;
out(`- con strategia sbagliata il giocatore viene scavalcato ${scoopedBy} volte su 56`);

// 3. fattibilità del collisore leptonico ------------------------------------------------------------------
out('\n## 3. Collisore leptonico (ee): bersagli raggiungibili con tutto al massimo e 10 anni di dati');
const eeBase = { ...G.newState(0, 'ee'), built: true, collider: 'ee', det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq: 4 }, lumiLvl: PH.MAX_LUMI };
const unreachable = [];
for (const p of PR.PROCESSES) {
  const lvl = PR.COLLIDERS.ee.energies.findIndex((e) => e >= p.thr.ee);
  if (lvl < 0) { unreachable.push(`${p.id} (energia)`); continue; }
  const s = { ...eeBase, energyLvl: lvl };
  const cfg = PH.autotune(s, p);
  const L = PH.lumiRate(s) * 10;
  const e = PH.evaluate(s, p, cfg, L, PH.SYST_VALID);
  const ok = p.kind === 'measure' ? e.sigma <= p.goal : (p.kind === 'search' ? e.znom : e.z) >= 5;
  if (!ok) unreachable.push(`${p.id} (${p.kind === 'measure' ? `±${Math.round(e.sigma * 100)}%` : `${e.z.toFixed(1)}σ`})`);
}
out(`- non raggiungibili con il collisore leptonico: ${unreachable.length}/56${unreachable.length ? ` → ${unreachable.join(', ')}` : ''}`);
const ppBase = { ...G.newState(0, 'pp'), built: true, collider: 'pp', det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq: 4 }, lumiLvl: PH.MAX_LUMI };
const ppUnreach = [];
for (const p of PR.PROCESSES) {
  const lvl = PR.COLLIDERS.pp.energies.findIndex((e) => e >= p.thr.pp);
  const s = { ...ppBase, energyLvl: lvl };
  const e = PH.evaluate(s, p, PH.autotune(s, p), PH.lumiRate(s) * 10, PH.SYST_VALID);
  if (lvl < 0 || !((p.kind === 'measure' ? e.sigma <= p.goal : (p.kind === 'search' ? e.znom : e.z) >= 5))) ppUnreach.push(p.id);
}
out(`- non raggiungibili con il collisore adronico: ${ppUnreach.length}/56 ${ppUnreach.join(', ')}`);

// 4. fuzz: azioni casuali, invarianti ----------------------------------------------------------------------
out('\n## 4. Fuzz: 120 partite casuali da 300 azioni');
let rngSeed = 7;
const rnd = () => { rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0; return rngSeed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const violations = [];
const subs = PR.DETECTOR.subsystems;
for (let g = 0; g < 120; g++) {
  let s = G.newState(0, `fz${g}`);
  for (let i = 0; i < 300; i++) {
    const r = rnd();
    try {
      if (r < 0.10) s = G.startShutdown(s, [pick(['accelerator', ...subs, 'collider'])], pick(['pp', 'ee']));
      else if (r < 0.2) s = G.startProject(s, pick(['energy', 'lumi', 'det', 'collider']), pick(subs), { risk: pick(['safe', 'bold']), fast: rnd() < 0.3 });
      else if (r < 0.3) s = G.select(s, pick(PR.PROCESSES).id);
      else if (r < 0.38) s = G.toggleProgram(s, pick(PR.PROCESSES).id);
      else if (r < 0.46) s = G.startRun(s, pick(G.RUN_YEARS));
      else if (r < 0.54) s = G.setCfg(s, pick(PR.PROCESSES).id, { trig: rnd() * 1.4 - 0.2, cut: rnd() * 1.6 });
      else if (r < 0.62) s = G.startAnalysis(s, pick(PR.PROCESSES).id, pick(Object.keys(PH.STRATEGIES)), { blind: rnd() < 0.5, valid: rnd() < 0.5 }, [pick(PR.CUTS), pick(PR.CUTS)]);
      else if (r < 0.68) s = G.transfer(s, pick(G.POOLS), pick(G.POOLS), rnd() * 1500 - 100);
      else if (r < 0.72) s = G.setAlloc(s, { ops: Math.floor(rnd() * 100), analysis: Math.floor(rnd() * 100), rnd: Math.floor(rnd() * 100) });
      else if (r < 0.76) for (const j of Object.keys(s.jobs)) s = G.confirmDiscovery(s, j, rnd() < 0.5 ? 0 : 70);
      else if (r < 0.80) for (const e of s.pending) s = G.resolveEvent(s, e.id, pick(['pay', 'accept']));
      else s = G.tick(s, rnd() * 2 * G.YEAR_S);
      // invarianti
      for (const k of G.POOLS) if (!Number.isFinite(s.pools[k]) || s.pools[k] < -1e-6) violations.push(`fz${g}/${i}: fondo ${k}=${s.pools[k]}`);
      if (s.alloc.ops + s.alloc.analysis + s.alloc.rnd !== 100) violations.push(`fz${g}/${i}: allocazione ${JSON.stringify(s.alloc)}`);
      if (Object.keys(s.projects).length > G.MAX_PROJECTS) violations.push(`fz${g}/${i}: troppi progetti`);
      if (G.programsOf(s).length > PH.slots(s)) violations.push(`fz${g}/${i}: più misure (${G.programsOf(s).length}) dei posti (${PH.slots(s)})`);
      if (s.collider === 'ee' && G.programsOf(s).length > 1) violations.push(`fz${g}/${i}: leptoni con più misure`);
      for (const id of G.programsOf(s)) if (G.isDone(s, id) || !G.isAvail(s, id)) violations.push(`fz${g}/${i}: misura ${id} non valida in corso`);
      if (s.run && s.shutdown) violations.push(`fz${g}/${i}: corsa e fermo insieme`);
      for (const k of subs) if (s.det[k] < 0 || s.det[k] > PR.DETECTOR.maxLevel) violations.push(`fz${g}/${i}: livello ${k}=${s.det[k]}`);
      for (const [id, v] of Object.entries(s.data)) if (!(v >= 0) || !Number.isFinite(v)) violations.push(`fz${g}/${i}: dati ${id}=${v}`);
      const round = G.load(G.serialize({ ...s, last: 0 }), 0).state;
      if (Object.keys(round.done).sort().join() !== Object.keys(s.done).sort().join() || round.built !== s.built || round.energyLvl !== s.energyLvl || Math.abs(round.t - s.t) > 1e-9) violations.push(`fz${g}/${i}: il salvataggio non si ricarica uguale`);
    } catch (e) { violations.push(`fz${g}/${i}: ECCEZIONE ${e.message}`); break; }
  }
}
const uniq = [...new Set(violations.map((v) => v.replace(/^fz\d+\/\d+: /, '')))];
out(`- violazioni: ${violations.length}${uniq.length ? ` (${uniq.length} tipi)` : ''}`);
for (const u of uniq.slice(0, 10)) out(`  • ${u}`);

// 5. fondi: massimo raggiungibile e costi massimi -------------------------------------------------------------
out('\n## 5. Soglie dei fondi a regime');
const steady = (share) => (G.BASE_BUDGET * share) / 100 / (1 - G.CARRY); // fondo a regime con il riporto
const al = G.newState(0, 'x').alloc;
out(`- fondo a regime senza boost: Operazioni ${steady(al.ops)}, Analisi ${steady(al.analysis)}, Sviluppo ${steady(al.rnd)}`);
const bigDet = Math.max(...subs.map((k) => G.COST.det(k, 3)));
out(`- costo massimo di un upgrade detector a livello 4: ${bigDet} (${bigDet > steady(al.rnd) ? 'SUPERA' : 'entro'} il fondo Sviluppo a regime)`);
const topCost = G.COST.energy(7);
out(`- costo dell'ultimo upgrade di energia: ${topCost}; corsa da 2 anni a fine partita: ${G.runCost({ ...ppBase, energyLvl: 8 }, 2)} (Operazioni a regime ${steady(al.ops)})`);
const lastAnalysis = Math.max(...PR.PROCESSES.map((p) => G.analysisCost({ ...ppBase, energyLvl: 8 }, p, 'mva', { blind: true, valid: true })));
out(`- analisi più cara a fine partita: ${lastAnalysis} (Analisi a regime ${steady(al.analysis)})`);
