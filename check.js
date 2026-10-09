// Self-check del nucleo: `node check.js`. Esce con codice != 0 se la fisica si rompe.
const assert = require('node:assert/strict');
const C = require('./www/core.js');

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const nearPt = (p, q, tol) => { near(p[0], q[0], tol); near(p[1], q[1], tol); };

const SQUARE = [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]];

// colpo ortogonale: torna indietro
nearPt(C.trace([0.5, 0], [0, 1], SQUARE).exit, [0.5, 0]);
// 45° su faccia orizzontale: riflessione speculare
nearPt(C.trace([0.2, 0], [1, 1], SQUARE).exit, [0.8, 0]);
// mancato: attraversa dritto
nearPt(C.trace([0.05, 0], [0, 1], SQUARE).exit, [0.05, 1]);

// fuzz su ogni forma (anche concave): niente NaN, rimbalzi limitati, reciprocità
const r = C.rng(42);
for (const sh of C.SHAPES) {
  const poly = sh.pts.map(([x, y]) => [0.5 + x, 0.5 + y]);
  for (let i = 0; i < 1000; i++) {
    const entry = C.entryFromPoint(r(), r());
    const dir = [entry.n[0] + (r() - 0.5) * 1.6, entry.n[1] + (r() - 0.5) * 1.6];
    if (!C.isInward(dir, entry.n)) continue;
    const out = C.trace(entry.p, dir, poly);
    assert.ok(out.exit.every(Number.isFinite), `${sh.id}: uscita non finita`);
    assert.ok(out.bounces < C.MAX_BOUNCES, `${sh.id}: troppi rimbalzi`);
    // invertendo l'uscita si deve tornare all'ingresso
    const back = C.trace(out.exit, [-out.dir[0], -out.dir[1]], poly);
    nearPt(back.exit, entry.p, 1e-5);
  }
}

// punteggio
assert.equal(C.score(1, true), 100);
assert.equal(C.score(3, true), 80);
assert.equal(C.score(12, true), 0);
assert.equal(C.score(3, false), 0);
assert.equal(C.score(0, true), 0);

// seed deterministico, scelte valide, forma dentro l'arena
for (const seed of ['2026-10-09', 'x', 'y', 'z']) {
  const g = C.newGame(seed);
  assert.deepEqual(g, C.newGame(seed));
  assert.equal(g.choices.length, 5);
  assert.equal(new Set(g.choices).size, 5);
  assert.ok(g.choices.includes(g.answer));
  assert.ok(g.poly.every(([x, y]) => x > 0.05 && x < 0.95 && y > 0.05 && y < 0.95));
}
console.log('check.js: OK');
