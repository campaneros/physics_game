// Stampa il ritmo dei risultati del bot: tempi, intervalli e media per terzo. Uso: node tools/profile.js
const { play } = require('../bot.js');
const r = play({});
const o = Object.entries(r.firstDone).sort((a, b) => a[1] - b[1]);
let prev = 0;
console.log(`totale ${r.hours.toFixed(2)} h, ${o.length} risultati`);
console.log(o.map(([id, h]) => { const t = `${id} ${(h * 60).toFixed(0)}m(+${((h - prev) * 60).toFixed(0)})`; prev = h; return t; }).join(' | '));
const third = (k) => { const a = Math.floor((o.length * k) / 3); const b = Math.floor((o.length * (k + 1)) / 3); return (((o[b - 1][1] - (a ? o[a - 1][1] : 0)) * 60) / (b - a)).toFixed(1); };
console.log('intervallo medio per terzo (min):', [0, 1, 2].map(third).join(' → '));
