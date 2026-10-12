// Bot di prova: gioca l'intera partita con la logica pura (nessun browser). Usato da check-game.js e dagli strumenti di calibrazione.
// Gioca più misure in parallelo (collisore adronico), analizza quando la sensibilità basta e finanzia gli upgrade spostando fondi.
const G = require('./www/game.js');
const PR = require('./www/processes.js');
const PH = require('./www/physics.js');

const BEST = { peak: 'bump', rare: 'mva', nonres: 'mva', precision: 'fit' };

function play({ score = 80, strategy = (p) => BEST[p.type], maxHours = 120, lazy = false, transfers = true, runYears = [2, 1], cutsPolicy = 'good', sample = 0, seed = 'bot', snapshotHours = [], parallel = true }) {
  let s = G.newState(0, seed);
  const snapshots = {};
  const pendingSnaps = snapshotHours.slice().sort((x, y) => x - y);
  const counts = { inconclusive: 0, review: 0, scooped: 0, rival: 0, claim: 0, 'proj.overrun': 0, 'proj.delay': 0, 'proj.boost': 0, 'proj.idea': 0, budget: 0 };
  let lastTune = -1e9;
  let lastProgram = null;
  let seen = 0;
  const firstDone = {};
  const timeline = [];
  let rng = 12345 + [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
  const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
  const cutsFor = (p) => {
    if (cutsPolicy === 'good') return undefined; // il tutorial e i tagli giusti
    if (cutsPolicy === 'none') return [];
    const all = PR.CUTS.slice();
    const pick = [];
    while (pick.length < PR.MAX_CUTS) pick.push(all.splice(Math.floor(rand() * all.length), 1)[0]);
    return pick;
  };
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
    if (process.env.TRACE && i % 60 === 0) { const h = (i * 5) / 3600; if (h >= Number(process.env.TRACE.split(',')[0]) && h <= Number(process.env.TRACE.split(',')[1])) console.log(h.toFixed(2) + 'h', 'prog=' + G.programsOf(s).join('+'), 'run=' + !!s.run, 'sh=' + !!s.shutdown, 'ops=' + (s.pools.ops | 0), 'an=' + (s.pools.analysis | 0), 'rnd=' + (s.pools.rnd | 0), 'E=' + s.energyLvl, 'L=' + s.lumiLvl, 'det=' + Object.values(s.det).join(''), 'proj=' + Object.entries(s.projects).map(([k, p]) => k + ':' + p.state + (p.spent / p.cost).toFixed(1)).join('|'), 'jobs=' + Object.keys(s.jobs).join('|')); }
    if (sample && i % sample === 0) timeline.push({ h: (i * 5) / 3600, ops: s.pools.ops, an: s.pools.analysis, rnd: s.pools.rnd, run: !!s.run, sh: !!s.shutdown, proj: Object.keys(s.projects).length, jobs: Object.keys(s.jobs).length, progs: G.programsOf(s).length, open: PR.PROCESSES.filter((p) => G.isAvail(s, p.id) && !G.isDone(s, p.id)).length });
    while (pendingSnaps.length && (i * 5) / 3600 >= pendingSnaps[0]) snapshots[pendingSnaps.shift()] = G.serialize({ ...s, last: 0 });
    if (G.isComplete(s)) return { hours: (i * 5) / 3600, s, counts, firstDone, timeline, snapshots };
    if (lazy) continue;
    for (const [id, job] of Object.entries(s.jobs)) if (job.state === 'confirm') s = G.confirmDiscovery(s, id, score);
    for (const e of s.pending) s = G.resolveEvent(s, e.id, s.pools.rnd > e.pay * 4 ? 'pay' : 'accept');
    if (G.totalFunds(s) < 3000 && G.canClaim(s, 'shape', 'free')) s = G.claimFunds(s, 'shape', score, 'free');
    const ensure = (pool, cost) => {
      if (!transfers || s.pools[pool] >= cost) return;
      const need = (cost - s.pools[pool]) / (1 - G.TRANSFER_FEE);
      const donor = G.POOLS.filter((k) => k !== pool).sort((a, b) => s.pools[b] - s.pools[a])[0];
      if (s.pools[donor] >= need * 1.2) s = G.transfer(s, donor, pool, need);
    };
    const open = PR.PROCESSES.filter((p) => G.isAvail(s, p.id) && !G.isDone(s, p.id));
    if (!open.length) continue;
    // misure attive: le più "a portata di mano" (requisiti già soddisfatti) fino ai posti disponibili; le altre servono a pianificare gli upgrade
    const runnable = open.filter((p) => G.canRun(s, p.id) || s.shutdown || !s.built);
    const ready = runnable.slice().sort((x, y) => x.L5 - y.L5);
    const wanted = (ready.length ? ready : open).slice(0, parallel ? Math.max(1, PH.slots(s)) : 1);
    const cur = G.programsOf(s);
    if (wanted.map((p) => p.id).join() !== cur.join() && !s.run) {
      s = G.select(s, wanted[0].id);
      for (const p of wanted.slice(1)) s = G.toggleProgram(s, p.id);
    }
    const blocked = open.filter((p) => !G.canRun(s, p.id)).sort((x, y) => x.L5 - y.L5);
    const target = wanted[0];

    // sviluppo: per i bersagli bloccati più vicini, per non restare fermi ad aspettare
    for (const p of blocked.slice(0, 3)) {
      for (const k of needs(p)) if (s.det[k] >= 1 && !s.projects[`det:${k}`]) s = G.startProject(s, 'det', k, { risk: 'safe' });
      if (!G.energyOk(s, p.id) && !s.projects.energy) s = G.startProject(s, 'energy', null, { risk: 'safe' });
    }
    const maxL5 = Math.max(...wanted.map((p) => p.L5));
    const wantLumi = Math.min(PH.MAX_LUMI, Math.max(0, Math.ceil(Math.log(maxL5 / 60) / Math.log(PH.LUMI_GROWTH))));
    if (s.built && s.lumiLvl < wantLumi && !s.projects.lumi) s = G.startProject(s, 'lumi', null, { risk: 'safe' });
    for (const k of PR.DETECTOR.aging) if (s.built && PH.damage(s, k) > 0.7 && s.det[k] >= 1 && s.det[k] < PR.DETECTOR.maxLevel && !s.projects[`det:${k}`]) s = G.startProject(s, 'det', k, { risk: 'safe' });
    const wantDaq = Math.min(PR.DETECTOR.maxLevel, Math.max(2, 1 + Math.ceil(s.lumiLvl / 3)));
    if (s.built && s.det.daq >= 1 && s.det.daq < wantDaq && !s.projects['det:daq']) s = G.startProject(s, 'det', 'daq', { risk: 'safe' });

    // installazione: livello 0→1 subito, dal 2° solo con progetto pronto
    if (!s.shutdown && !s.run) {
      const items = [];
      if (!s.built) items.push('accelerator');
      for (const p of blocked.slice(0, 3)) for (const k of needs(p)) if (s.det[k] === 0 || (s.projects[`det:${k}`] && s.projects[`det:${k}`].state === 'ready')) items.push(k);
      if (s.built && s.det.daq === 0) items.push('daq');
      if (s.projects['det:daq'] && s.projects['det:daq'].state === 'ready') items.push('daq');
      for (const k of PR.DETECTOR.aging) if (s.projects[`det:${k}`] && s.projects[`det:${k}`].state === 'ready') items.push(k);
      if (items.length) s = G.startShutdown(s, [...new Set(items)], 'pp');
    }
    if (i * 5 - lastTune > 600 || G.programsOf(s).join() !== lastProgram) { for (const id of G.programsOf(s)) s = G.autotuneCfg(s, id); lastTune = i * 5; lastProgram = G.programsOf(s).join(); }
    // analisi: ogni misura attiva parte quando la sensibilità attesa basta
    for (const id of G.programsOf(s)) {
      const tg = PR.BY_ID.get(id);
      if (s.jobs[id] || !G.canRun(s, id)) continue;
      const L = G.dataOf(s, id);
      const st = strategy(tg);
      const pl = PH.plan(st, { blind: true, valid: true }, tg);
      const e = PH.evaluate(s, tg, G.cfgOf(s, id), L, PH.SYST_VALID);
      const go = L > 0 && e.ok && (tg.kind === 'measure' ? e.sigma / pl.sens <= tg.goal * 0.95 : e.znom * pl.sens >= 5.2);
      if (go) { ensure('analysis', G.analysisCost(s, tg, st, { blind: true, valid: true })); s = G.startAnalysis(s, id, st, { blind: true, valid: true }, cutsFor(tg)); }
    }
    if (!s.run && G.programsOf(s).some((id) => G.canRun(s, id))) { ensure('ops', G.runCost(s, 2)); let started = s; for (const y of runYears) { started = G.startRun(s, y); if (started.run) break; } s = started; }
    void target;
  }
  return { hours: Infinity, s, counts, firstDone, timeline, snapshots };
}

module.exports = { play, BEST };
