// Strumento di sviluppo: regola le luminosità L5 del catalogo (www/processes.js) finché i risultati escono con il ritmo voluto.
// Uso: node tools/calibrate.js [iterazioni] [ore-totali]
// Ritmo voluto: un risultato ogni ~12 min all'inizio, ~4,5 min alla fine (intervallo che scende in modo lineare), totale ~7,5 h.
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'www', 'processes.js');
const ITER = Number(process.argv[2] || 6);
const TOTAL_H = Number(process.argv[3] || 7.5);
const FIRST_MIN = 12;
const LAST_MIN = 4.5;

function fresh() {
  for (const k of Object.keys(require.cache)) if (/www[\\/]|bot\.js/.test(k)) delete require.cache[k];
  return require('../bot.js');
}

// tempi voluti (ore) per il risultato numero i (0-based) su n
function targets(n) {
  const gaps = Array.from({ length: n }, (_, i) => FIRST_MIN + ((LAST_MIN - FIRST_MIN) * i) / (n - 1));
  const sum = gaps.reduce((a, b) => a + b, 0);
  let t = 0;
  return gaps.map((g) => { t += (g * TOTAL_H * 60) / sum / 60; return t; });
}

const round2 = (v) => { const e = 10 ** Math.floor(Math.log10(v)); return Math.round((v / e) * 10) / 10 * e; };

let best = null;
for (let it = 0; it < ITER; it++) {
  const { play } = fresh();
  const r = play({});
  const order = Object.entries(r.firstDone).sort((a, b) => a[1] - b[1]);
  const want = targets(order.length);
  let src = fs.readFileSync(FILE, 'utf8');
  let err = 0;
  const snapshot = src; // L5 usati in questa iterazione
  order.forEach(([id, h], i) => {
    const ratio = want[i] / h;
    err += Math.abs(Math.log(ratio));
    const m = src.match(new RegExp(`(\\['${id}',[^\\n]*?,\\s*)([0-9.e+]+)(\\],)`));
    if (!m) return;
    const next = round2(Math.min(2e6, Math.max(1, Number(m[2]) * Math.min(1.5, Math.max(0.7, ratio ** 0.5)))));
    src = src.replace(m[0], `${m[1]}${next}${m[3]}`);
  });
  const score = err / order.length + Math.max(0, r.hours - TOTAL_H) * 0.05;
  if (!best || score < best.score) best = { score, snapshot, it };
  fs.writeFileSync(FILE, src);
  console.log(`iter ${it}: totale ${r.hours.toFixed(2)} h, errore medio ${(err / order.length).toFixed(2)}, primi: ${order.slice(0, 4).map(([id, h]) => `${id}@${(h * 60).toFixed(0)}m`).join(' ')}`);
}

if (best) { fs.writeFileSync(FILE, best.snapshot); console.log(`ripristinata l'iterazione migliore: ${best.it} (punteggio ${best.score.toFixed(3)})`); }
