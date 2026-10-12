// Progetti (pagati subito), installazione, budget annuale, trasferimenti, eventi sui fondi.
const { test, expect, state, tab, tick, patch, built, hud } = require('./helpers');

const openProjects = async (page) => { await page.locator('.cardbtn.c-proj').click(); await expect(page.locator('#overlay .tile').first()).toBeVisible(); };

test.describe('progetti', () => {
  test.beforeEach(async ({ game: page }) => { await built(page); });

  test('energia: il costo si paga tutto subito, poi si procede col tempo e il livello sale', async ({ game: page }) => {
    const rnd0 = (await state(page)).pools.rnd;
    await openProjects(page);
    await page.locator('#overlay .tile[aria-label*="Energia"]').click();
    await expect(page.locator('#overlay')).toContainText('costo intero si paga subito');
    await page.locator('#overlay button.primary').click();
    const s = await state(page);
    expect(s.projects.energy.state).toBe('dev');
    expect(s.pools.rnd).toBe(rnd0 - s.projects.energy.cost);
    await tick(page, 0.3);
    expect((await state(page)).pools.rnd).toBe(rnd0 - s.projects.energy.cost); // niente altre uscite durante lo sviluppo
    await tick(page, 3);
    const done = await state(page);
    expect(done.energyLvl).toBe(1);
    expect(done.projects.energy).toBeUndefined();
    expect((await hud(page)).energy).toBe('10 GeV');
  });

  test('senza fondi il progetto non parte e il motivo è scritto', async ({ game: page }) => {
    await patch(page, { pools: { ops: 450, analysis: 200, rnd: 5 } });
    await openProjects(page);
    await page.locator('#overlay .tile[aria-label*="Energia"]').click();
    await expect(page.locator('#overlay button.primary')).toBeDisabled();
    await expect(page.locator('#overlay .warn-text')).toBeVisible();
  });

  test('massimo 3 progetti insieme', async ({ game: page }) => {
    await patch(page, { pools: { ops: 450, analysis: 200, rnd: 1e5 }, det: { tracker: 1, ecal: 1, hcal: 1, muon: 1, daq: 1 } });
    await page.evaluate(() => { for (const k of ['tracker', 'ecal', 'hcal', 'muon']) UI.update((s) => Game.startProject(s, 'det', k, {})); });
    expect(Object.keys((await state(page)).projects)).toHaveLength(3);
  });

  test('upgrade detector: popup con cosa sblocca/migliora; installazione solo in Long Shutdown', async ({ game: page }) => {
    await patch(page, { pools: { ops: 450, analysis: 200, rnd: 1e5 } });
    await page.evaluate(() => UI.update((s) => Game.startProject(s, 'det', 'tracker', { risk: 'safe' })));
    await openProjects(page);
    await expect(page.locator('#overlay .gain-i').first()).toBeVisible(); // ogni upgrade mostra un beneficio
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => UI.closeOverlay());
    await tick(page, 8);
    const ready = await state(page);
    expect(ready.projects['det:tracker'].state).toBe('ready');
    expect(ready.det.tracker).toBe(1); // non ancora installato
    await page.locator('.cardbtn.c-build').click();
    await page.locator('#overlay .tile[aria-label*="Tracciatore"]').click();
    await expect(page.locator('#overlay .foot')).not.toContainText('Immediato'); // serve un fermo vero
    await page.locator('#overlay button.primary').click();
    const sd = await state(page);
    expect(sd.shutdown).not.toBeNull();
    await tick(page, 6);
    const after = await state(page);
    expect(after.det.tracker).toBe(2);
    expect(after.shutdowns).toBe(1);
    expect(after.projects['det:tracker']).toBeUndefined();
  });

  const injectDelay = (page) => page.evaluate(() => {
    UI.update((s) => ({ ...Game.startProject({ ...s, pools: { ...s.pools, rnd: 1e5 } }, 'energy', null, { risk: 'bold' }) }));
    UI.update((s) => ({ ...s, pending: [{ id: 'energy@2', key: 'energy', stall: 1.2, pay: 50, deadline: s.t + 0.5 }] }));
  });

  test('ritardo con scelta: il popup di notizie si apre da solo; "Paga" toglie il ritardo dal fondo Sviluppo', async ({ game: page }) => {
    await injectDelay(page);
    await expect(page.locator('#overlay')).toBeVisible();
    const rnd = (await state(page)).pools.rnd;
    await page.locator('#overlay .tile').nth(0).click(); // Paga
    const s = await state(page);
    expect(s.pools.rnd).toBe(rnd - 50);
    expect(s.pending).toHaveLength(0);
    expect(s.projects.energy.stall).toBe(0);
  });

  test('ritardo con scelta: "Aspetta" ferma il progetto', async ({ game: page }) => {
    await injectDelay(page);
    await page.locator('#overlay .tile').nth(1).click();
    const s = await state(page);
    expect(s.pending).toHaveLength(0);
    expect(s.projects.energy.stall).toBeGreaterThan(s.t);
  });

  test('ritardo senza scelta entro la scadenza: si accetta in automatico', async ({ game: page }) => {
    await injectDelay(page);
    await page.evaluate(() => UI.closeOverlay());
    await tick(page, 0.7);
    const s = await state(page);
    expect(s.pending).toHaveLength(0);
  });
});

test.describe('budget', () => {
  test('cursori: somma sempre 100, minimo 10%, i fondi non cambiano', async ({ game: page }) => {
    await built(page);
    await page.locator('#hud-dev').click();
    const ranges = page.locator('#overlay input[type="range"]');
    const total0 = await page.evaluate(() => Game.totalFunds(UI.get()));
    await ranges.nth(0).evaluate((el) => { el.value = '70'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    let a = (await state(page)).alloc;
    expect(a.ops + a.analysis + a.rnd).toBe(100);
    expect(Math.min(a.ops, a.analysis, a.rnd)).toBeGreaterThanOrEqual(10);
    await ranges.nth(2).evaluate((el) => { el.value = '0'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    a = (await state(page)).alloc;
    expect(a.ops + a.analysis + a.rnd).toBe(100);
    expect(Math.min(a.ops, a.analysis, a.rnd)).toBeGreaterThanOrEqual(10);
    expect(await page.evaluate(() => Game.totalFunds(UI.get()))).toBeCloseTo(total0, 6);
  });

  test('trasferimento tra fondi: metà con 10% di perdita', async ({ game: page }) => {
    await built(page);
    const s0 = await state(page);
    await page.locator('#hud-dev').click();
    await page.locator('#overlay .mv .chips').nth(0).locator('button').nth(0).click(); // da Corsa
    await page.locator('#overlay .mv .chips').nth(1).locator('button').nth(2).click(); // a Sviluppo
    await page.locator('#overlay .mv > button').last().click();
    const s = await state(page);
    expect(s.pools.ops).toBeCloseTo(s0.pools.ops / 2, 6);
    expect(s.pools.rnd).toBeCloseTo(s0.pools.rnd + (s0.pools.ops / 2) * 0.9, 6);
  });

  test('nuovo anno: il budget annuale viene accreditato secondo le percentuali', async ({ game: page }) => {
    await built(page);
    const before = (await state(page)).pools;
    await tick(page, 1.05);
    const after = (await state(page)).pools;
    for (const k of ['ops', 'analysis', 'rnd']) expect(after[k]).toBeGreaterThan(before[k]);
  });

  test('la previsione a 5 anni mostra 5 colonne e il boost di una pubblicazione decresce', async ({ game: page }) => {
    await built(page);
    await patch(page, { boosts: [{ amount: 0.4, start: 0, years: 6 }] });
    const b0 = await page.evaluate(() => Game.annualBudget(UI.get(), 0));
    const b3 = await page.evaluate(() => Game.annualBudget(UI.get(), 4.5));
    const b7 = await page.evaluate(() => Game.annualBudget(UI.get(), 7));
    expect(b0).toBe(1400);
    expect(b3).toBeLessThan(b0);
    expect(b3).toBeGreaterThan(b7);
    expect(b7).toBe(1000); // poi torna alla base: non è permanente
    await page.locator('#hud-dev').click();
    await expect(page.locator('#overlay .fc')).toHaveCount(5);
  });
});

test.describe('eventi sui fondi', () => {
  test('su 40 anni compaiono eventi positivi e negativi, i conti restano ≥ 0 e il banner li racconta', async ({ game: page }) => {
    await built(page);
    const signs = new Map();
    for (let y = 0; y < 40; y++) {
      await tick(page, 1);
      const s = await state(page);
      expect(Object.values(s.pools).every((v) => v >= 0)).toBe(true);
      for (const e of s.events) if (e.k === 'fev') signs.set(e.n, e.v.sign);
    }
    const all = [...signs.values()];
    expect(all.length).toBeGreaterThan(5);
    expect(all).toContain('+');
    expect(all).toContain('−');
    const texts = await page.evaluate(() => Game.FUND_EVENTS.map((e) => I18n.t(`fev.${e.id}`, { amt: '100', sign: '+' })));
    for (const t of texts) expect(t).not.toMatch(/^fev\./); // tutte le 20 hanno testo
    expect(texts).toHaveLength(20);
  });

  test('un evento sui fondi appare nel banner con importo e segno', async ({ game: page }) => {
    await built(page);
    const found = await page.evaluate(() => {
      for (let i = 0; i < 200; i++) {
        const s0 = { ...Game.newState(1, `fx${i}`), built: true };
        const s = Game.tick(s0, 1.1 * Game.YEAR_S + 0 * 1);
        const t = Game.tick(s, 1 * Game.YEAR_S);
        if (t.events.some((e) => e.k === 'fev')) { UI.update(() => s); return i; }
      }
      return -1;
    });
    expect(found).toBeGreaterThanOrEqual(0);
    await tick(page, 1);
    await expect(page.locator('#banner')).toContainText(/[+−]\d/);
  });
});
