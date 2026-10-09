// Self-check della modalità budget: `node check-budget.js [--report]`.
const assert = require('node:assert/strict');
const B = require('./www/budget.js');

const alloc = (o) => ({ ...B.zero(), ...o });
const report = process.argv.includes('--report');
let interior = 0;
const seeds = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);

for (const seed of seeds) {
  const s = B.scenario(seed);
  assert.deepEqual(s, B.scenario(seed)); // deterministico
  const opt = s.optimum.alloc;
  assert.equal(B.score(s, opt), 100, `${seed}: l'ottimo deve dare 100`);
  assert.ok(B.spent(opt) <= B.BUDGET);

  // spendere tutto su una voce sola non paga mai
  for (const item of B.ITEMS) {
    const all = B.score(s, alloc({ [item.id]: B.BUDGET }));
    assert.ok(all < 60, `${seed}: tutto su ${item.id} dà ${all}`);
  }
  // nessuna spesa = risultato peggiore di una distribuzione uniforme
  const even = alloc(Object.fromEntries(B.ITEMS.map((i) => [i.id, 20])));
  assert.ok(B.score(s, alloc({})) < B.score(s, even), `${seed}: spendere deve aiutare`);
  // ottimo interno: nessuna voce al 100% e almeno 4 voci su 5 finanziate
  assert.ok(Math.max(...Object.values(opt)) < B.BUDGET);
  if (B.ITEMS.filter((i) => opt[i.id] > 0).length >= 4) interior++;
  if (report) console.log(seed, s.resonance.padEnd(16), JSON.stringify(opt), 'σ=', s.optimum.total.toExponential(2), 'uniforme=', B.score(s, even));
}
assert.ok(interior >= 25, `ottimo troppo sbilanciato: ${interior}/30 scenari con >=4 voci`);

// allocazioni non valide valgono 0 (input ostile)
const s0 = B.scenario('x');
for (const bad of [alloc({ lumi: 7 }), alloc({ lumi: -5 }), alloc({ lumi: 60, trigger: 60 }), alloc({ lumi: 5.5 }), alloc({ lumi: NaN })]) {
  assert.equal(B.isValid(bad), false);
  assert.equal(B.score(s0, bad), 0);
}
console.log('check-budget.js: OK');
