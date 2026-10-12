// Self-check delle traduzioni: `node check-i18n.js`. Fallisce se manca/avanza una chiave o resta testo italiano nel codice.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const WWW = path.join(__dirname, 'www');
const I = require('./www/i18n.js');
require('./www/i18n-game.js');
const PR = require('./www/processes.js');
const PH = require('./www/physics.js');
const Core = require('./www/core.js');
const Budget = require('./www/budget.js');

const { en, it } = I.DICT;
const keys = new Set(Object.keys(en));
const need = (k) => assert.ok(keys.has(k), `manca la chiave ${k}`);

// 1. stesse chiavi, segnaposto e nessun testo vuoto in entrambe le lingue
assert.deepEqual(Object.keys(en).sort(), Object.keys(it).sort(), 'chiavi diverse tra en e it');
const placeholders = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join();
for (const k of keys) {
  assert.equal(placeholders(en[k]), placeholders(it[k]), `segnaposto diversi: ${k}`);
  assert.ok(en[k].trim() && it[k].trim(), `testo vuoto: ${k}`);
}

// 2. ogni id di gioco ha la sua traduzione
for (const p of PR.PROCESSES) { need(`proc.${p.id}`); need(`hint.${p.type}`); need(`kind.${p.kind}`); }
for (const k of PR.DETECTOR.subsystems) { need(`sub.${k}`); need(`sub.${k}.desc`); }
for (const c of Object.keys(PR.COLLIDERS)) { need(`collider.${c}`); need(`collider.${c}.desc`); }
for (const s of Object.keys(PH.STRATEGIES)) { need(`an.strategy.${s}`); need(`an.strategy.${s}.desc`); }
Core.SHAPES.forEach((s) => need(`shape.${s.id}`));
Budget.ITEMS.forEach((i) => { need(`bg.item.${i.id}.name`); need(`bg.item.${i.id}.desc`); });
for (let seed = 0; seed < 300; seed++) need(`res.${Budget.scenario(seed).resonance}`);
need('launch.one'); need('launch.other');
const gameSrc = fs.readFileSync(path.join(WWW, 'game.js'), 'utf8');
for (const k of ['published', 'scooped', 'limit', 'inconclusive', 'review', 'confirm', 'confirmfail', 'rival', 'shutdown.start', 'shutdown.done', 'build.done', 'proj.start', 'proj.done', 'proj.ready', 'proj.overrun', 'proj.delay', 'proj.boost', 'proj.idea', 'proj.paid', 'budget', 'run.start', 'run.done', 'claim']) {
  need(`ev.${k}`);
  assert.ok(gameSrc.includes(`'${k}'`), `evento ${k} non emesso da game.js`);
}

for (const e of require('./www/game.js').FUND_EVENTS) need(`fev.${e.id}`);
assert.equal(require('./www/game.js').FUND_EVENTS.length, 20, 'venti eventi sui fondi');

// 3. chiavi usate nel codice e nell'HTML; chiavi mai usate; niente italiano nel codice
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const jsFiles = fs.readdirSync(WWW).filter((f) => f.endsWith('.js') && !['i18n.js', 'i18n-game.js', 'sw.js'].includes(f));
const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const accented = /[àèéìòùÀÈÉÌÒÙ]/;
const prefixes = [];
let allCode = html;
for (const f of jsFiles) {
  const src = stripComments(fs.readFileSync(path.join(WWW, f), 'utf8'));
  allCode += src;
  for (const m of src.matchAll(/\btr\(\s*(['"])([\w.]+)\1/g)) need(m[2]);
  for (const m of src.matchAll(/plural\(\s*'(\w+)'/g)) prefixes.push(`${m[1]}.`);
  for (const m of src.matchAll(/\btr\(\s*`([\w.]+)\$\{/g)) {
    prefixes.push(m[1]);
    assert.ok([...keys].some((k) => k.startsWith(m[1])), `${f}: nessuna chiave con prefisso ${m[1]}`);
  }
  for (const m of src.matchAll(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g)) {
    assert.ok(!accented.test(m[0]), `${f}: testo italiano nel codice: ${m[0].slice(0, 60)}`);
  }
}
for (const m of html.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)) need(m[1]);
const unused = [...keys].filter((k) => !allCode.includes(`'${k}'`) && !allCode.includes(`"${k}"`) && !allCode.includes(`"${k}`) && !prefixes.some((p) => k.startsWith(p)));
assert.deepEqual(unused, [], `chiavi mai usate: ${unused.join(', ')}`);

// 4. le funzioni rispettano la lingua
I.setLang('it'); assert.equal(I.t('tab.physics'), 'Fisica');
assert.equal(I.plural('launch', 1), '1 lancio'); assert.equal(I.plural('launch', 3), '3 lanci');
I.setLang('en'); assert.equal(I.t('tab.physics'), 'Physics');
assert.equal(I.plural('launch', 1), '1 launch'); assert.equal(I.plural('launch', 3), '3 launches');
assert.equal(I.t('req.energy', { need: 125, now: 3 }), 'Beam energy ≥ 125 GeV (now 3)');
assert.equal(I.t('chiave.inesistente'), 'chiave.inesistente');
I.setLang('xx'); assert.equal(I.getLang(), 'en');

console.log(`check-i18n.js: OK (${keys.size} chiavi, ${jsFiles.length} file JS controllati)`);
