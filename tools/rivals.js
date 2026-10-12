// Rigenera i tempi dei rivali (RIVAL in www/processes.js) come multiplo della durata del bot esperto.
// Uso: node tools/rivals.js [fattore]   (default 3,0: il rivale pubblica dopo ~3× il tempo di un giocatore esperto)
const fs = require('node:fs');
const path = require('node:path');
const FILE = path.join(__dirname, '..', 'www', 'processes.js');
const FACTOR = Number(process.argv[2] || 3);

const { play } = require('../bot.js');
const r = play({});
const map = {};
for (const [id, d] of Object.entries(r.s.done)) map[id] = Math.max(6, Math.round((d.t - (r.s.availAt[id] || 0)) * FACTOR));
const body = Object.entries(map).map(([k, v]) => `${k}: ${v}`).join(', ');
const src = fs.readFileSync(FILE, 'utf8');
const next = src.replace(/const RIVAL = \{[^}]*\};/, `const RIVAL = { ${body} };`);
if (next === src) throw new Error('RIVAL non trovato in processes.js');
fs.writeFileSync(FILE, next);
console.log(`rivali rigenerati (fattore ${FACTOR}): ${Object.keys(map).length} voci`);
