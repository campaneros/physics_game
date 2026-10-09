// Self-check dell'economia: `node check-idle.js [--report]`. Un bot avido deve completare il gioco in tempi sensati.
const assert = require('node:assert/strict');
const I = require('./www/idle.js');

const NOW = 1_700_000_000_000;

// --- salvataggio: input ostile non deve produrre NaN/Infinity ---------------
const hostile = [
  'not json', 'null', '[]', '{"v":1,"dati":"x"}',
  '{"v":1,"dati":1e999,"levels":{"magneti":-5,"lumi":1e9},"discovered":{"rho":99,"evil":1},"last":-1}',
  JSON.stringify({ v: 1, dati: NaN, signal: Infinity, levels: { magneti: 2.7 }, pending: true, last: NOW + 9e9 }),
];
for (const text of hostile) {
  const { state } = I.load(text, NOW);
  for (const k of ['dati', 'signal', 'shutdowns', 'last']) assert.ok(Number.isFinite(state[k]), `${text}: ${k}`);
  for (const u of I.UPGRADES) assert.ok(Number.isInteger(state.levels[u.id]) && state.levels[u.id] >= 0 && state.levels[u.id] <= 500);
  assert.ok(Object.keys(state.discovered).every((k) => I.DISCOVERIES.some((d) => d.id === k)));
  assert.ok(Object.values(state.discovered).every((m) => m >= 1 && m <= 2));
  assert.ok(Number.isFinite(I.rate(state)));
}

// --- andata e ritorno del salvataggio -----------------------------------------
{
  let s = I.newState(NOW);
  s = I.tick(s, 100);
  s = I.buy(s, 'lumi');
  const back = I.load(I.serialize({ ...s, last: NOW }), NOW).state;
  assert.deepEqual(back.levels, s.levels);
  assert.equal(back.dati, s.dati);
}

// --- offline: tetto 8h a efficienza 50% -------------------------------------
{
  const s = { ...I.newState(NOW), last: NOW - 100 * 3600 * 1000 };
  const { away } = I.load(I.serialize(s), NOW);
  assert.equal(away, 4 * 3600);
}

// --- conferma: bonus dal punteggio, fallimento tiene metà segnale -----------
{
  const s = { ...I.newState(NOW), pending: true, signal: I.DISCOVERIES[0].need };
  assert.equal(I.confirm(s, 80).discovered.rho, 1.8);
  const failed = I.confirm(s, 0);
  assert.equal(failed.pending, false);
  assert.equal(failed.signal, I.DISCOVERIES[0].need * 0.5);
  assert.equal(I.confirm(I.newState(NOW), 100).discovered.rho, undefined); // niente pending
}

// --- bot avido ----------------------------------------------------------------
function play(score) {
  let s = I.newState(0);
  const log = [];
  for (let t = 1; t <= 40 * 3600; t++) {
    s = I.tick(s, 1);
    if (s.pending) {
      const d = I.target(s);
      s = I.confirm(s, score);
      log.push([d.id, t]);
      if (!I.target(s)) return { t, log, s };
    }
    for (let guard = 0; guard < 50; guard++) {
      const tg = I.target(s);
      const gated = tg && I.energy(s) < tg.gev;
      if (gated && s.dati >= I.cost(s, 'magneti')) { s = I.buy(s, 'magneti'); continue; }
      const options = I.UPGRADES.filter((u) => u.id !== 'magneti' || !gated)
        .map((u) => [u.id, I.cost(s, u.id)]).sort((a, b) => a[1] - b[1]);
      const reserve = gated ? I.cost(s, 'magneti') * 0.25 : 0;
      const [id, price] = options[0];
      if (s.dati - reserve >= price) { s = I.buy(s, id); continue; }
      break;
    }
  }
  return { t: Infinity, log, s };
}

const run = play(80);
if (process.argv.includes('--report')) {
  for (const [id, t] of run.log) console.log(`${id.padEnd(8)} ${(t / 60).toFixed(1)} min`);
  console.log('totale', (run.t / 3600).toFixed(2), 'h');
}
assert.ok(Number.isFinite(run.t), 'il bot non completa il gioco in 40h');
assert.ok(run.log[0][1] >= 5 && run.log[0][1] <= 180, `prima scoperta fuori scala: ${run.log[0][1]}s`);
assert.ok(run.t >= 20 * 60 && run.t <= 8 * 3600, `durata totale fuori scala: ${(run.t / 3600).toFixed(2)}h`);
console.log('check-idle.js: OK');
