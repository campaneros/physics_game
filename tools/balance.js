// Criteri di bilanciamento misurabili. Uso: node tools/balance.js   (esce con codice 1 se un criterio non è rispettato)
const G = require('../www/game.js');
const PR = require('../www/processes.js');
const PH = require('../www/physics.js');
const { play } = require('../bot.js');

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
const H = expert.hours;
const sc = (r) => r.counts.scooped;

gate('G1 durata esperto 10-12,5 h', H >= 10 && H <= 12.5, `${H.toFixed(1)} h`);
gate('G2 senza trasferimenti ≤ 1,15× esperto', noTransfers.hours <= 1.15 * H, `${noTransfers.hours.toFixed(1)} h (${(noTransfers.hours / H).toFixed(2)}×)`);
gate('G2 solo corse da 1 anno ≤ 1,15× esperto', oneYear.hours <= 1.15 * H, `${oneYear.hours.toFixed(1)} h (${(oneYear.hours / H).toFixed(2)}×)`);
gate('G3 strategia debole 1,8-3,0× esperto (le scelte contano, ma non si resta bloccati)', weak.hours >= 1.8 * H && weak.hours <= 3 * H, `${weak.hours.toFixed(1)} h (${(weak.hours / H).toFixed(2)}×)`);
gate('G3 strategia debole: scavalcato 10-40 volte su 56 (i rivali contano)', sc(weak) >= 10 && sc(weak) <= 40, `${sc(weak)}`);
gate('G4 tagli a caso 1,25-2,5× esperto (scegliere i tagli giusti conviene)', randomCuts.hours >= 1.25 * H && randomCuts.hours <= 2.5 * H, `${randomCuts.hours.toFixed(1)} h (${(randomCuts.hours / H).toFixed(2)}×)`);
gate('G8 cercare più misure insieme (adroni) conviene: una alla volta ≥ 1,08× esperto', serial.hours >= 1.08 * H, `${serial.hours.toFixed(1)} h (${(serial.hours / H).toFixed(2)}×)`);
gate('G6 esperto scavalcato ≤ 2 volte', sc(expert) <= 2, `${sc(expert)}`);

// ritmo
const times = Object.entries(expert.firstDone).sort((a, b) => a[1] - b[1]).map(([, h]) => h * 60);
const n = times.length;
const avg = (a, b) => (times[b - 1] - (a ? times[a - 1] : 0)) / (b - a);
const thirds = [avg(0, Math.floor(n / 3)), avg(Math.floor(n / 3), Math.floor((2 * n) / 3)), avg(Math.floor((2 * n) / 3), n)];
gate('G7 ritmo: ogni terzo 8-16 min e in discesa', thirds.every((x) => x >= 8 && x <= 16) && thirds[0] > thirds[2], thirds.map((x) => x.toFixed(1)).join(' → '));
gate('G7 primo risultato 8-20 min', times[0] >= 8 && times[0] <= 20, `${times[0].toFixed(0)} min`);

// fondi a regime contro i costi massimi
const al = G.newState(0, 'x').alloc;
const steady = (share) => (G.BASE_BUDGET * share) / 100 / (1 - G.CARRY);
const sub = PR.DETECTOR.subsystems;
const maxDet = Math.max(...sub.map((k) => G.COST.det(k, 3)));
const late = { ...G.newState(0, 'x'), built: true, collider: 'pp', det: { tracker: 4, ecal: 4, hcal: 4, muon: 4, daq: 4 }, energyLvl: 8, lumiLvl: 9 };
const maxAnalysis = Math.max(...PR.PROCESSES.map((p) => G.analysisCost(late, p, 'mva', { blind: true, valid: true })));
gate('G5 fondo Sviluppo a regime ≥ upgrade detector più caro', steady(al.rnd) >= maxDet * 0.95, `${steady(al.rnd).toFixed(0)} vs ${maxDet}`);
gate('G5 fondo Sviluppo a regime ≥ ultimo upgrade di energia', steady(al.rnd) >= G.COST.energy(7), `${steady(al.rnd).toFixed(0)} vs ${G.COST.energy(7)}`);
gate('G5 fondo Operazioni a regime ≥ corsa da 2 anni a fine partita', steady(al.ops) >= G.runCost(late, 2) * 0.95, `${steady(al.ops).toFixed(0)} vs ${G.runCost(late, 2)}`);
gate('G5 fondo Analisi a regime ≥ analisi più cara', steady(al.analysis) >= maxAnalysis * 0.9, `${steady(al.analysis).toFixed(0)} vs ${maxAnalysis}`);

console.log(rows.join('\n'));
console.log(failed ? `\n${failed} criteri non rispettati` : '\nTutti i criteri rispettati');
void PH;
process.exit(failed ? 1 : 0);
