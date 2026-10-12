// Fixture e utilità comuni: pagina pulita, errori di console/rete = test fallito, tempo di gioco guidato da Game.tick.
const base = require('@playwright/test');

const SAVE_KEY = 'accel-save-v5';
const FAR = 'http'; // qualsiasi richiesta esterna è un errore: il gioco è offline

const test = base.test.extend({
  // `game`: pagina caricata, tutorial chiuso, seed deterministico (crypto stub), nessun errore ammesso.
  game: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
    page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1' && u.protocol.startsWith(FAR)) problems.push(`richiesta esterna: ${r.url()}`); });
    await page.addInitScript(() => {
      // seed deterministico: Game, rivali e minigioco ripetibili
      Object.defineProperty(window.crypto, 'getRandomValues', { value: (a) => a.fill(0) });
    });
    await boot(page);
    await use(page);
    base.expect(problems, 'errori di console o di rete').toEqual([]);
  },
});

async function boot(page, { keepSave = false } = {}) {
  await page.goto('/index.html');
  await page.waitForFunction(() => window.UI && window.Game && window.Popups);
  if (!keepSave) await fresh(page);
  await closeOverlay(page);
}

async function fresh(page) {
  await page.evaluate(() => { UI.closeOverlay(); UI.update(() => ({ ...Game.newState(Date.now(), 's-00'), tutorial: true })); });
}

const closeOverlay = (page) => page.evaluate(() => UI.closeOverlay());
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(UI.get())));
const patch = (page, p) => page.evaluate((x) => UI.update((s) => ({ ...s, ...x })), p);
const tick = (page, years) => page.evaluate((y) => UI.update((s) => Game.tick(s, y * Game.YEAR_S)), years);
const tab = (page, name) => page.locator(`#tabs button[data-view="${name}"]`).click();
const overlayOpen = (page) => page.evaluate(() => !document.getElementById('overlay').hidden);
const hud = (page) => page.evaluate(() => ({
  dev: document.getElementById('hud-funds').textContent, year: document.getElementById('hud-year').textContent,
  energy: document.getElementById('hud-energy').textContent, rep: document.getElementById('hud-rep').textContent,
}));

// Stato "già costruito" senza passare dalla UI (per i test che non riguardano la costruzione).
async function built(page, extra = {}) {
  await page.evaluate((x) => {
    UI.update((s) => ({ ...Game.startShutdown(s, ['accelerator', 'tracker', 'muon', 'daq'], 'pp'), ...x }));
  }, extra);
}

// Una forma sbagliata in un minigioco aperto; `exitAt` = punti relativi del lancio.
async function launch(page, from = [0.02, 0.4], to = [0.2, 0.4]) {
  const c = page.locator('#overlay canvas.mg-canvas, #play-host canvas.mg-canvas').first();
  const b = await c.boundingBox();
  await page.mouse.move(b.x + b.width * from[0], b.y + b.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * to[0], b.y + b.height * to[1], { steps: 4 });
  await page.mouse.up();
}

module.exports = { test, expect: base.expect, SAVE_KEY, boot, fresh, closeOverlay, state, patch, tick, tab, overlayOpen, hud, built, launch };
