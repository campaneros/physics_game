// Salvataggio (anche ostile), offline/service worker, CSP, tempo in background.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect, boot, state, tick, built, patch, SAVE_KEY } = require('./helpers');

test.describe('salvataggio', () => {
  test('lo stato sopravvive a una ricarica (costruzione, dati, corsa in corso)', async ({ game: page }) => {
    await built(page);
    await patch(page, { program: 'rho' });
    await page.evaluate(() => UI.update((s) => Game.startRun(s, 2)));
    await tick(page, 0.5);
    const before = await state(page);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await page.waitForFunction(() => window.UI);
    const after = await state(page);
    expect(after.built).toBe(true);
    expect(after.det).toEqual(before.det);
    expect(after.run).not.toBeNull();
    expect(after.program).toBe('rho');
    expect(after.data.rho).toBeGreaterThanOrEqual(before.data.rho - 1e-6); // non si perdono dati (il tempo reale continua a scorrere)
    expect(after.data.rho - before.data.rho).toBeLessThan(1);
  });

  const hostile = {
    'non è JSON': 'questo non è json {{{',
    'oggetto vuoto': '{}',
    'array al posto dell’oggetto': '[1,2,3]',
    'numeri enormi/NaN': JSON.stringify({ v: 5, t: 1e308, pools: { ops: 1e308, analysis: -5, rnd: 'x' }, alloc: { ops: 1e9, analysis: -1, rnd: 0 }, energyLvl: 1e9, lumiLvl: -3, det: { tracker: 99, ecal: -1 } }),
    'chiavi pericolose': '{"__proto__":{"polluted":1},"constructor":{"prototype":{"x":1}},"pools":{"__proto__":{"ops":9}}}',
    'stringhe lunghe': JSON.stringify({ seed: 'x'.repeat(100000), program: 'y'.repeat(50000), claims: { ['k'.repeat(5000)]: 1 } }),
    'progetti e job inventati': JSON.stringify({ built: true, projects: { 'det:evil': { cost: 1, years: 1, spent: 9 }, energy: { kind: 'energy', cost: -5, years: 0, spent: 'a' } }, jobs: { rho: { strategy: 'cheat', state: 'confirm' } }, done: { rho: { z: 1e9 } }, extra: ['rho', 'rho', 'nonesiste'] }),
  };

  for (const [name, text] of Object.entries(hostile)) {
    test(`salvataggio ostile: ${name} → il gioco parte comunque, stato valido`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(([k, v]) => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem(k, v); localStorage.setItem('__seeded', '1'); } } catch (e) { /* storage */ } }, [SAVE_KEY, text]);
      await page.goto('/index.html');
      await page.waitForFunction(() => window.UI);
      await page.evaluate(() => UI.closeOverlay());
      const s = await state(page);
      expect(errors).toEqual([]);
      for (const v of Object.values(s.pools)) expect(Number.isFinite(v) && v >= 0 && v < 1e13).toBe(true);
      expect(s.alloc.ops + s.alloc.analysis + s.alloc.rnd).toBe(100);
      expect(({}).polluted).toBeUndefined();
      expect(s.energyLvl).toBeGreaterThanOrEqual(0);
      expect(Object.keys(s.projects).every((k) => /^(energy|lumi|collider|det:(tracker|ecal|hcal|muon|daq))$/.test(k))).toBe(true);
      expect(s.seed.length).toBeLessThanOrEqual(64);
      expect(Object.keys(s.done)).not.toContain('rho'); // un esito inventato non regala scoperte
      await tick(page, 1); // e il tempo continua a scorrere senza errori
      expect(errors).toEqual([]);
    });
  }

  test('Azzera progressi (due tocchi) riparte da zero', async ({ game: page }) => {
    await built(page);
    await page.locator('#help').click();
    const reset = page.locator('#overlay button').last();
    await reset.click();
    await reset.click();
    await page.waitForTimeout(200);
    const s = await state(page);
    expect(s.built).toBe(false);
    expect(s.t).toBeLessThan(0.1);
  });
});

test.describe('tempo e background', () => {
  test('credito offline al 50%, con tetto', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window.crypto, 'getRandomValues', { value: (a) => a.fill(0) }));
    await boot(page);
    await built(page);
    const t0 = (await state(page)).t;
    // si simula un'assenza: salvataggio vecchio di `h` ore, poi il ritorno in primo piano (visibilitychange → resume)
    const away = (h) => page.evaluate(([hh, k]) => {
      const saved = JSON.parse(Game.serialize(UI.get()));
      saved.last = Date.now() - hh * 3600 * 1000;
      localStorage.setItem(k, JSON.stringify(saved));
      document.dispatchEvent(new Event('visibilitychange'));
    }, [h, SAVE_KEY]);
    await away(1);
    const t1 = (await state(page)).t;
    expect(t1 - t0).toBeGreaterThan(8); // 1 ora a metà velocità = 1800 s = 10 anni di gioco
    expect(t1 - t0).toBeLessThan(11);
    await away(100);
    const t2 = (await state(page)).t;
    expect(t2 - t1).toBeLessThan((8 * 3600 * 0.5) / 180 + 1.5); // tetto a 8 ore
    expect(t2 - t1).toBeGreaterThan(79);
  });
});

test.describe('offline e service worker', () => {
  test('dopo il primo caricamento l’app si apre senza rete', async ({ page, context }) => {
    await boot(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // ora il service worker controlla la pagina
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.UI && window.Game);
    expect(await page.title()).toMatch(/Acceleratore|Accelerator/);
    await expect(page.locator('.cardbtn.c-build')).toBeVisible();
    await context.setOffline(false);
  });

  test('il service worker prova la rete per prima e usa la cache solo come ripiego', () => {
    const sw = fs.readFileSync(path.join(__dirname, '..', 'www', 'sw.js'), 'utf8');
    expect(sw.indexOf('fetch(e.request)')).toBeGreaterThan(-1);
    expect(sw.indexOf('fetch(e.request)')).toBeLessThan(sw.indexOf('caches.match(e.request)'));
    expect(sw).toMatch(/\.catch\(\(\) => caches\.match/);
  });
});

test.describe('sicurezza e CSP', () => {
  const WWW = path.join(__dirname, '..', 'www');
  const srcs = fs.readdirSync(WWW).filter((f) => f.endsWith('.js') && f !== 'sw.js');

  test('nessun innerHTML/eval/new Function nel codice del gioco', () => {
    for (const f of srcs) {
      const code = fs.readFileSync(path.join(WWW, f), 'utf8').replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/);
    }
  });

  test('la pagina dichiara una CSP restrittiva e non contiene script o stile inline', () => {
    const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
    expect(html).toMatch(/Content-Security-Policy[^>]*script-src 'self'/);
    expect(html).toMatch(/connect-src 'none'/);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[^<]/);
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toMatch(/\son\w+=/);
  });

  test('nessuna violazione CSP durante una sessione completa di schede e popup', async ({ game: page }) => {
    const violations = [];
    page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
    await built(page);
    for (const v of ['physics', 'play', 'budget', 'site']) await page.locator(`#tabs button[data-view="${v}"]`).click();
    for (const c of ['c-build', 'c-proj', 'c-budget', 'c-run']) {
      await page.locator(`.cardbtn.${c}`).click();
      await page.evaluate(() => UI.closeOverlay());
    }
    expect(violations).toEqual([]);
  });

  test('Android: nessun permesso INTERNET nel manifest', () => {
    const manifest = fs.readFileSync(path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
    expect(manifest).not.toMatch(/android\.permission\.INTERNET/);
  });
});
