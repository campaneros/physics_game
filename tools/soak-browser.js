// Test di durata nel browser: Chromium headless con il gioco in tempo reale fino all'ora indicata (default 18:00).
// Un "giocatore casuale" usa l'interfaccia (schede, popup, carte, cursori, minigioco) mentre si misurano memoria, nodi DOM,
// errori e coerenza dello stato; ogni ~20 min la pagina viene ricaricata (persistenza) o sostituita con un salvataggio di
// metà/fine partita (soak/checkpoints.json, prodotto da tools/soak.js) per esercitare tutte le fasi del gioco.
// Scrive in soak/: browser.log, browser-findings.jsonl, browser-stats.json, browser-last.png.
// Uso: node tools/soak-browser.js [HH:MM|ISO]
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const DIR = path.join(__dirname, '..', 'soak');
fs.mkdirSync(DIR, { recursive: true });
const WWW = path.join(__dirname, '..', 'www');
const PORT = 8819;
const SAVE_KEY = 'accel-save-v5';

function parseDeadline(arg = '18:00') {
  if (/^\d{1,2}:\d{2}$/.test(arg)) { const [h, m] = arg.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); return d.getTime(); }
  return new Date(arg).getTime();
}
const DEADLINE = parseDeadline(process.argv[2]);
const START = Date.now();
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (...a) => fs.appendFileSync(path.join(DIR, 'browser.log'), `${stamp()} ${a.join(' ')}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let rs = 4242;
const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const findings = new Map();
const finding = (kind, detail) => {
  const key = `${kind}:${detail.replace(/\d+(\.\d+)?/g, '#').slice(0, 160)}`;
  const f = findings.get(key) || { kind, detail: detail.slice(0, 400), count: 0, first: stamp() };
  f.count++;
  if (f.count === 1) fs.appendFileSync(path.join(DIR, 'browser-findings.jsonl'), JSON.stringify(f) + '\n');
  findings.set(key, f);
};

const samples = [];
const stats = { actions: 0, reloads: 0, checkpointLoads: 0, popups: 0, minigameLaunches: 0, maxDom: 0, maxHeapMB: 0, errors: 0 };
const writeStats = () => {
  const heap = samples.map((s) => s.heapMB);
  const half = Math.floor(heap.length / 2);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  fs.writeFileSync(path.join(DIR, 'browser-stats.json'), JSON.stringify({
    started: new Date(START).toISOString(), now: stamp(), deadline: new Date(DEADLINE).toISOString(), ...stats, samples: samples.length,
    heapMB: { first: heap[0], last: heap[heap.length - 1], meanFirstHalf: mean(heap.slice(0, half)), meanSecondHalf: mean(heap.slice(half)) },
    findings: [...findings.values()],
  }, null, 1));
};

async function main() {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', WWW], { stdio: 'ignore' });
  await sleep(1200);
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  const ctx = await browser.newContext({ locale: 'it-IT', viewport: { width: 411, height: 860 } });
  let page;
  const attach = (p) => {
    p.on('pageerror', (e) => { stats.errors++; finding('errore pagina', e.message); });
    p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/robots\.txt/.test(m.location().url || '')) { stats.errors++; finding(`console.${m.type()}`, m.text()); } });
    p.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1') finding('rete', `richiesta esterna ${r.url()}`); });
  };
  const open = async (save) => {
    if (page) await page.close();
    page = await ctx.newPage();
    attach(page);
    await page.goto(`http://127.0.0.1:${PORT}/robots.txt`).catch(() => {});
    if (save !== undefined) await page.evaluate(([k, v]) => { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }, [SAVE_KEY, save]);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);
    await page.waitForFunction(() => window.UI && window.Game, null, { timeout: 15000 });
    await page.evaluate(() => UI.closeOverlay());
  };
  await open(null);
  log(`avvio: scadenza ${new Date(DEADLINE).toISOString()}`);

  const checkpoints = () => { try { return Object.values(JSON.parse(fs.readFileSync(path.join(DIR, 'checkpoints.json'), 'utf8'))); } catch (e) { return []; } };

  // una azione a caso dell'interfaccia
  const act = async () => {
    stats.actions++;
    const r = rnd();
    if (r < 0.25) { await page.locator(`#tabs button[data-view="${pick(['site', 'physics', 'play', 'budget'])}"]`).click({ timeout: 3000 }); return; }
    if (r < 0.50) {
      const btns = await page.locator('main button:visible, .cardbtn:visible').all();
      const usable = [];
      for (const b of btns) { const t = ((await b.getAttribute('aria-label')) || (await b.textContent()) || '').trim(); if (!/Azzera|reset/i.test(t) && (await b.isEnabled())) usable.push(b); }
      if (usable.length) await pick(usable).click({ timeout: 3000 });
      return;
    }
    if (r < 0.68) {
      stats.popups++;
      await page.evaluate((fn) => { const f = { c: () => Popups.construction(), p: () => Popups.projects(), b: () => Popups.budget(), r: () => Popups.run() }[fn]; f(); }, pick(['c', 'p', 'b', 'r']));
      await sleep(150);
      const inner = await page.locator('#overlay button:visible, #overlay .tile:visible').all();
      const usable = [];
      for (const b of inner) { const t = ((await b.textContent()) || '').trim(); if (!/Azzera|reset/i.test(t) && (await b.isEnabled())) usable.push(b); }
      if (usable.length && rnd() < 0.7) await pick(usable).click({ timeout: 3000 }).catch(() => {});
      await sleep(100);
      const isOpen = await page.evaluate(() => !document.getElementById('overlay').hidden);
      if (isOpen && rnd() < 0.5) await page.goBack().catch(() => {}); else await page.evaluate(() => UI.closeOverlay());
      return;
    }
    if (r < 0.80) {
      const ranges = await page.locator('input[type="range"]:visible').all();
      if (ranges.length) await pick(ranges).evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, Math.floor(rnd() * 100));
      return;
    }
    if (r < 0.88) {
      const c = page.locator('canvas.mg-canvas:visible').first();
      if (await c.count()) { const b = await c.boundingBox(); if (b) { stats.minigameLaunches++; await page.mouse.move(b.x + b.width * 0.02, b.y + b.height * rnd()); await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * rnd(), { steps: 3 }); await page.mouse.up(); } }
      return;
    }
    if (r < 0.93) { await page.evaluate(() => UI.update((s) => Game.tick(s, (1 + Math.random() * 6) * Game.YEAR_S))); return; } // salto di tempo (anche oltre il credito offline)
    await sleep(500);
  };

  const sample = async () => {
    const m = await page.evaluate(() => { if (window.gc) window.gc(); const s = UI.get(); return { heapMB: Math.round(performance.memory.usedJSHeapSize / 1e5) / 10, nodes: document.querySelectorAll('*').length, t: s.t, done: Object.keys(s.done).length, pools: s.pools, ok: Object.values(s.pools).every((v) => Number.isFinite(v) && v >= 0) && s.alloc.ops + s.alloc.analysis + s.alloc.rnd === 100, svgNodes: document.querySelectorAll('svg.scene *').length, overlay: !document.getElementById('overlay').hidden, saveBytes: Game.serialize(s).length }; });
    samples.push({ at: Date.now(), ...m });
    stats.maxDom = Math.max(stats.maxDom, m.nodes);
    stats.maxHeapMB = Math.max(stats.maxHeapMB, m.heapMB);
    if (!m.ok) finding('stato', `fondi o allocazione non validi: ${JSON.stringify(m.pools)}`);
    if (m.nodes > 4000) finding('DOM', `troppi nodi: ${m.nodes}`);
    if (m.saveBytes > 200000) finding('salvataggio', `salvataggio grande: ${m.saveBytes} byte`);
    return m;
  };

  let lastSample = 0; let lastCycle = Date.now(); let lastStats = 0; let cycle = 0; let lastShot = 0;
  while (Date.now() < DEADLINE) {
    try {
      await act();
    } catch (e) {
      const msg = e.message.split('\n')[0];
      if (/Timeout/.test(msg)) stats.clickTimeouts = (stats.clickTimeouts || 0) + 1; // elemento sparito o coperto: non è un difetto del gioco
      else finding('azione fallita', msg);
      const alive = await page.evaluate(() => !!window.UI).catch(() => false);
      if (!alive) { try { await open(undefined); } catch (e2) { finding('ripartenza', e2.message.split('\n')[0]); } } else await page.evaluate(() => UI.closeOverlay()).catch(() => {});
    }
    await sleep(600 + Math.floor(rnd() * 1400));
    const now = Date.now();
    if (now - lastSample > 15_000) { lastSample = now; try { await sample(); } catch (e) { finding('campionamento', e.message.split('\n')[0]); } }
    if (now - lastShot > 10 * 60_000) { lastShot = now; await page.screenshot({ path: path.join(DIR, 'browser-last.png') }).catch(() => {}); }
    if (now - lastCycle > 20 * 60_000) {
      lastCycle = now; cycle++;
      try {
        const before = await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); const s = UI.get(); return { done: Object.keys(s.done).length, t: s.t, built: s.built }; });
        const cps = checkpoints();
        if (cycle % 2 === 1 || !cps.length) {
          stats.reloads++;
          await open(undefined); // stessa pagina, stesso salvataggio
          const after = await page.evaluate(() => { const s = UI.get(); return { done: Object.keys(s.done).length, t: s.t, built: s.built }; });
          if (after.done < before.done || after.built !== before.built || after.t < before.t - 1e-6) finding('persistenza', `dopo la ricarica lo stato è tornato indietro: ${JSON.stringify({ before, after })}`);
        } else {
          stats.checkpointLoads++;
          await open(pick(cps));
        }
        log(`ciclo ${cycle}: ${cycle % 2 === 1 ? 'ricarica' : 'checkpoint'}; azioni ${stats.actions}; heap ${stats.maxHeapMB} MB; nodi max ${stats.maxDom}; problemi ${findings.size}`);
      } catch (e) { finding('ciclo', e.message.split('\n')[0]); try { await open(null); } catch (e2) { finding('ripartenza', e2.message.split('\n')[0]); } }
    }
    if (now - lastStats > 5 * 60_000) { lastStats = now; writeStats(); }
  }
  writeStats();
  log('fine');
  await browser.close();
  server.kill();
}
main().catch((e) => { log(`ERRORE FATALE: ${e.stack}`); process.exit(1); });
