// Criteri di bilanciamento misurabili. Uso: node tools/balance.js   (esce con codice 1 se un criterio non è rispettato)
const G = require('../www/game.js');
const PR = require('../www/processes.js');
const PH = require('../www/physics.js');
const { play } = require('../bot.js');

// Misure di ritmo: attese per chiusure e buchi tra le ricompense (G.tick instrumentato solo per la partita dell'esperto).
const instrumented = (() => {
  const orig = G.tick;
  const T = [];
  const E = [];
  let seen = 0;
  G.tick = (s, dt) => {
    const n = orig(s, dt);
    const h = (n.t * G.YEAR_S) / 3600;
    const prog = G.programsOf(n);
    T.push({ blocked: !!(prog.length && !prog.some((id) => G.canRun(n, id)) && !n.run) });
    for (const e of n.events) if (e.n > seen) { E.push({ h, k: e.k }); seen = Math.max(seen, e.n); }
    return n;
  };
  const r = require('../bot.js').play({ maxHours: 80 });
  G.tick = orig;
  const REW = new Set(['published', 'scooped', 'limit', 'proj.done', 'shutdown.done', 'build.done']);
  const rew = E.filter((e) => REW.has(e.k)).map((e) => e.h * 60);
  const gaps = rew.slice(1).map((x, i) => x - rew[i]);
  return { hours: r.hours, waitShare: T.filter((x) => x.blocked).length / T.length, maxGap: Math.max(...gaps), perHour: rew.length / r.hours };
})();

const rows = [];
let failed = 0;
const gate = (name, ok, detail) => { rows.push(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${detail}`); if (!ok) failed++; };

const run = (opt) => play({ maxHours: 80, ...opt });
const expert = run({});
const noTransfers = run({ transfers: false });
const oneYear = run({ runYears: [1] });
const weak = run({ strategy: () => 'cuts' });
const randomCuts = run({ cutsPolicy: 'random' });
const serial = run({ parallel: false });
const mvaOnly = run({ strategy: () => 'mva' });
const H = expert.hours;
const sc = (r) => r.counts.scooped;

gate('G1 durata esperto 10-12,5 h', H >= 10 && H <= 12.5, `${H.toFixed(1)} h`);
gate('G2 senza trasferimenti ≤ 1,15× esperto', noTransfers.hours <= 1.15 * H, `${noTransfers.hours.toFixed(1)} h (${(noTransfers.hours / H).toFixed(2)}×)`);
gate('G2 solo corse da 1 anno ≤ 1,15× esperto', oneYear.hours <= 1.15 * H, `${oneYear.hours.toFixed(1)} h (${(oneYear.hours / H).toFixed(2)}×)`);
gate('G3 strategia debole 1,8-3,0× esperto (le scelte contano, ma non si resta bloccati)', weak.hours >= 1.8 * H && weak.hours <= 3 * H, `${weak.hours.toFixed(1)} h (${(weak.hours / H).toFixed(2)}×)`);
gate('G3 strategia debole: scavalcato 10-40 volte su 56 (i rivali contano)', sc(weak) >= 10 && sc(weak) <= 40, `${sc(weak)}`);
gate('G4 tagli a caso 1,25-2,5× esperto (scegliere i tagli giusti conviene)', randomCuts.hours >= 1.25 * H && randomCuts.hours <= 2.5 * H, `${randomCuts.hours.toFixed(1)} h (${(randomCuts.hours / H).toFixed(2)}×)`);
gate('G12 usare sempre MVA non batte la scelta per tipo di segnale (nessuna strategia dominante)', mvaOnly.hours >= 0.98 * H, `${mvaOnly.hours.toFixed(1)} h contro ${H.toFixed(1)} h`);
gate('G8 cercare più misure insieme (adroni) conviene: una alla volta ≥ 1,08× esperto', serial.hours >= 1.08 * H, `${serial.hours.toFixed(1)} h (${(serial.hours / H).toFixed(2)}×)`);
gate('G6 esperto scavalcato ≤ 2 volte', sc(expert) <= 2, `${sc(expert)}`);

// ritmo
const times = Object.entries(expert.firstDone).sort((a, b) => a[1] - b[1]).map(([, h]) => h * 60);
const n = times.length;
const avg = (a, b) => (times[b - 1] - (a ? times[a - 1] : 0)) / (b - a);
const thirds = [avg(0, Math.floor(n / 3)), avg(Math.floor(n / 3), Math.floor((2 * n) / 3)), avg(Math.floor((2 * n) / 3), n)];
gate('G7 ritmo: ogni terzo 8-16 min e nessun terzo oltre 1,4× il più rapido', thirds.every((x) => x >= 8 && x <= 16) && Math.max(...thirds) <= 1.4 * Math.min(...thirds), thirds.map((x) => x.toFixed(1)).join(' → '));
gate('G7 primo risultato 5-20 min (ricompensa subito, mai a vuoto)', times[0] >= 5 && times[0] <= 20, `${times[0].toFixed(0)} min`);
// il bot pianifica a breve raggio: una persona che prepara gli upgrade in anticipo ha attese e buchi più corti (prima dell'audit: 14% e 56 min)
gate('G9 attesa passiva (misure scelte ma nessuna eseguibile) ≤ 12% della partita', instrumented.waitShare <= 0.12, `${(100 * instrumented.waitShare).toFixed(1)}%`);
gate('G9 buco più lungo tra ricompense ≤ 48 min', instrumented.maxGap <= 48, `${instrumented.maxGap.toFixed(0)} min`);
gate('G9 almeno 6 ricompense all\'ora', instrumented.perHour >= 6, `${instrumented.perHour.toFixed(1)}/h`);

// fondi a regime contro i costi massimi
const al = G.newState(0, 'x').alloc;
const steady = (share) => (G.BASE_BUDGET * share) / 100 / (1 - G.CARRY);
const sub = PR.DETECTOR.subsystems;
const maxDet = Math.max(...sub.map((k) => G.COST.det(k, 3)));
const late = { ...G.newState(0, 'x'), built: true, collider: 'pp', det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq: 4 }, energyLvl: 8, lumiLvl: 9 };
const maxAnalysis = Math.max(...PR.PROCESSES.map((p) => G.analysisCost(late, p, 'mva', { blind: true, valid: true })));
// i costi di fine partita richiedono risparmio, trasferimenti o finanziamenti, ma non superano mai i fondi totali a regime (nessun blocco)
const total = (steady(al.rnd) + steady(al.ops) + steady(al.analysis));
gate('G5 fondo Sviluppo a regime ≥ 0,75× upgrade detector più caro', steady(al.rnd) >= maxDet * 0.75, `${steady(al.rnd).toFixed(0)} vs ${maxDet}`);
gate('G5 fondo Sviluppo a regime ≥ ultimo upgrade di energia', steady(al.rnd) >= G.COST.energy(7), `${steady(al.rnd).toFixed(0)} vs ${G.COST.energy(7)}`);
gate('G5 fondo Operazioni a regime ≥ 0,75× corsa da 2 anni e ≥ 1,3× corsa da 1 anno a fine partita', steady(al.ops) >= G.runCost(late, 2) * 0.75 && steady(al.ops) >= G.runCost(late, 1) * 1.3, `${steady(al.ops).toFixed(0)} vs ${G.runCost(late, 2)} / ${G.runCost(late, 1)}`);
gate('G5 fondo Analisi a regime ≥ 0,5× analisi più cara', steady(al.analysis) >= maxAnalysis * 0.5, `${steady(al.analysis).toFixed(0)} vs ${maxAnalysis}`);
gate('G5 fondi totali a regime ≥ 1,5× la spesa singola più cara (si può sempre pagare spostando fondi)', total >= 1.5 * Math.max(maxDet, maxAnalysis, G.runCost(late, 2)), `${total.toFixed(0)} vs ${Math.max(maxDet, maxAnalysis, G.runCost(late, 2))}`);
// allocazioni estreme: nessun blocco (il bot esperto finisce comunque)
for (const [name, alloc] of [['80/10/10', { ops: 80, analysis: 10, rnd: 10 }], ['10/80/10', { ops: 10, analysis: 80, rnd: 10 }], ['10/10/80', { ops: 10, analysis: 10, rnd: 80 }]]) {
  const orig = G.newState;
  G.newState = (...a) => ({ ...orig(...a), alloc });
  const r = run({});
  G.newState = orig;
  gate(`G10 allocazione ${name}: si finisce entro 2× l'esperto (nessun blocco)`, Number.isFinite(r.hours) && r.hours <= 2 * H, `${Number.isFinite(r.hours) ? r.hours.toFixed(1) : 'non finisce'} h`);
}
// il collisore leptonico ha una nicchia (non è una trappola) e l'adronico resta il generalista
const eeFaster = PR.PROCESSES.filter((p) => p.kind === 'discovery' && PH.fasterCollider(p) === 'ee').length;
gate('G11 collisore leptonico più rapido su 5-15 scoperte (nicchia reale)', eeFaster >= 5 && eeFaster <= 15, `${eeFaster}`);

console.log(rows.join('\n'));
console.log(failed ? `\n${failed} criteri non rispettati` : '\nTutti i criteri rispettati');
void PH;
process.exit(failed ? 1 : 0);
