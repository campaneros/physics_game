// Misure in parallelo con il collisore adronico e chiarezza dell'esito (scoperta / preceduta / solo limite).
const { test, expect, tab, patch } = require('./helpers');

const rec = (over) => ({ z: 6, sigma: 0.05, limit: false, scooped: false, t: 1, rep: 1, boost: 0.1, years: 6, snap: null, ...over });
// con ρ già scoperto sono disponibili ω, φ e J/ψ (albero lineare: un bersaglio si apre quando i precedenti sono chiusi)
const BASE = { built: true, det: { tracker: 3, ecal: 3, hcal: 3, muon: 3, daq: 0 }, energyLvl: 6, pools: { ops: 1e5, analysis: 1e5, rnd: 1e5 }, done: { rho: rec({}) }, availAt: { omega: 0, phi: 0, jpsi: 0 } };
const taking = (page) => page.evaluate(() => Game.programsOf(UI.get()));

test.describe('più misure insieme', () => {
  test('collisore adronico: già con DAQ 0 si aggiungono due misure, la terza è bloccata', async ({ game: page }) => {
    await patch(page, { ...BASE, collider: 'pp' });
    await tab(page, 'physics');
    const toggles = page.locator('#physics-host .slot-toggle');
    await expect(toggles.first()).toBeVisible();
    await toggles.nth(0).click();
    await toggles.nth(1).click();
    expect(await taking(page)).toHaveLength(2);
    await expect(toggles.nth(2)).toBeDisabled(); // posti finiti
    await expect(page.locator('#physics-host .progress')).toContainText('2/2');
  });

  test('ogni livello DAQ aggiunge un posto, fino a 6', async ({ game: page }) => {
    await patch(page, { ...BASE, collider: 'pp', det: { ...BASE.det, daq: 4 }, done: { rho: rec({}), phi: rec({}), jpsi: rec({}), upsilon: rec({}) } });
    await tab(page, 'physics');
    const toggles = page.locator('#physics-host .slot-toggle');
    for (let i = 0; i < 6; i++) await toggles.nth(i).click();
    expect(await taking(page)).toHaveLength(6);
  });

  test('collisore leptonico: nessun tasto di aggiunta rapida, una misura alla volta', async ({ game: page }) => {
    await patch(page, { ...BASE, collider: 'ee', energyLvl: 3 });
    await tab(page, 'physics');
    await expect(page.locator('#physics-host .target').first()).toBeVisible();
    await expect(page.locator('#physics-host .slot-toggle')).toHaveCount(0);
  });

  test('togliere una misura libera il posto', async ({ game: page }) => {
    await patch(page, { ...BASE, collider: 'pp' });
    await tab(page, 'physics');
    const toggles = page.locator('#physics-host .slot-toggle');
    await toggles.nth(0).click();
    await toggles.nth(1).click();
    await toggles.nth(0).click();
    expect(await taking(page)).toHaveLength(1);
    await expect(toggles.nth(2)).toBeEnabled();
  });
});

test.describe('esito dei bersagli', () => {
  test('scoperta, preceduta e solo limite sono distinguibili nell’elenco e nel pannello', async ({ game: page }) => {
    await patch(page, { ...BASE, collider: 'pp', done: { rho: rec({}), omega: rec({ scooped: true }), phi: rec({ limit: true, z: 3 }) } });
    await tab(page, 'physics');
    await page.locator('#physics-host .fold').filter({ hasText: /Completati/ }).click();
    const discovered = page.locator('#physics-host .target.is-discovered');
    await expect(discovered).toHaveCount(1);
    await expect(discovered).toContainText('SCOPERTA');
    await expect(page.locator('#physics-host .target.is-scooped')).toContainText('PRECEDUTA');
    await expect(page.locator('#physics-host .target.is-limit')).toContainText('SOLO LIMITE');
    await discovered.click();
    await expect(page.locator('#physics-host .status.is-discovered')).toBeVisible();
    await expect(page.locator('#physics-host .progress')).toContainText('3/56');
  });

  test('un bersaglio non ancora scoperto lo dice chiaramente', async ({ game: page }) => {
    await patch(page, { ...BASE, collider: 'pp', done: {} });
    await tab(page, 'physics');
    await page.locator('#physics-host .target').first().click();
    await expect(page.locator('#physics-host .status.is-todo')).toContainText(/Non ancora/);
    await expect(page.locator('#physics-host .progress')).toContainText('0/56');
  });
});
