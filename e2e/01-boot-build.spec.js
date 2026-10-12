// Avvio, tutorial, costruzione e popup annidati.
const { test, expect, boot, state, hud, tab, overlayOpen, closeOverlay, built, patch } = require('./helpers');

test.describe('avvio', () => {
  test('primo avvio: aiuto aperto e chiudibile, HUD con il fondo Sviluppo', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window.crypto, 'getRandomValues', { value: (a) => a.fill(0) }));
    await page.goto('/index.html');
    await page.waitForFunction(() => window.UI);
    await expect(page.locator('#overlay')).toBeVisible();
    await page.locator('#overlay button').first().click();
    await expect(page.locator('#overlay')).toBeHidden();
    expect(await hud(page)).toMatchObject({ dev: '1.30K', year: '0.0', energy: '2 GeV', rep: '0.0' });
  });

  test('le quattro carte e le quattro schede esistono', async ({ game: page }) => {
    for (const c of ['c-build', 'c-proj', 'c-budget', 'c-run']) await expect(page.locator(`.cardbtn.${c}`)).toBeVisible();
    for (const v of ['site', 'physics', 'play', 'budget']) await expect(page.locator(`#tabs button[data-view="${v}"]`)).toBeVisible();
  });

  test('il fondo Sviluppo in alto apre il Budget', async ({ game: page }) => {
    await page.locator('#hud-dev').click();
    await expect(page.locator('#overlay')).toBeVisible();
    await expect(page.locator('#overlay input[type="range"]')).toHaveCount(3);
  });
});

test.describe('costruzione', () => {
  const openBuild = async (page) => { await page.locator('.cardbtn.c-build').click(); await expect(page.locator('#overlay .tile').first()).toBeVisible(); };
  const tile = (page, re) => page.locator('#overlay .tile').filter({ has: page.locator(`xpath=self::*[@aria-label]`) }).and(page.locator(`[aria-label*="${re}"]`));

  test('acceleratore + più sottosistemi insieme: immediato, fondi scalati, nessun Long Shutdown', async ({ game: page }) => {
    await openBuild(page);
    for (const n of ['Tracciatore', 'muoni', 'DAQ']) await page.locator(`#overlay .tile[aria-label*="${n}"]`).click();
    await expect(page.locator('#overlay .foot')).toContainText('Immediato');
    await page.locator('#overlay button.primary').click();
    await expect(page.locator('#overlay')).toBeHidden();
    const s = await state(page);
    expect(s.built).toBe(true);
    expect(s.det).toMatchObject({ tracker: 1, muon: 1, daq: 1, ecal: 0, hcal: 0 });
    expect(s.shutdown).toBeNull();
    expect(s.shutdowns).toBe(0);
    expect(s.pools.rnd).toBe(1300 - (350 + 150 + 120 + 100));
    expect((await hud(page)).dev).toBe('580');
  });

  test('collisore leptonico: costa meno del adronico', async ({ game: page }) => {
    await openBuild(page);
    await page.locator('#overlay .tile.col').nth(1).click();
    await page.locator('#overlay button.primary').click();
    const s = await state(page);
    expect(s.collider).toBe('ee');
    expect(s.pools.rnd).toBe(1300 - 200);
  });

  test('senza fondi sufficienti: Avvia spento e messaggio chiaro', async ({ game: page }) => {
    await patch(page, { pools: { ops: 450, analysis: 200, rnd: 300 } });
    await openBuild(page);
    for (const n of ['Tracciatore', 'muoni', 'DAQ']) await page.locator(`#overlay .tile[aria-label*="${n}"]`).click();
    await expect(page.locator('#overlay button.primary')).toBeDisabled();
    await expect(page.locator('#overlay .warn-text')).toBeVisible();
  });

  test('popup annidati: da Corsa a Costruisci il secondo popup resta aperto', async ({ game: page }) => {
    await patch(page, { program: 'rho' });
    await page.locator('.cardbtn.c-run').click();
    await expect(page.locator('#overlay')).toBeVisible();
    await page.locator('#overlay button.primary').click(); // "Costruisci"
    await page.waitForTimeout(300); // il vecchio bug chiudeva il nuovo popup dopo un attimo
    await expect(page.locator('#overlay .tile').first()).toBeVisible();
    expect(await overlayOpen(page)).toBe(true);
  });

  test('X e tasto Indietro chiudono il popup', async ({ game: page }) => {
    await openBuild(page);
    await page.locator('#overlay .x').click();
    await expect(page.locator('#overlay')).toBeHidden();
    await openBuild(page);
    await page.goBack();
    await expect(page.locator('#overlay')).toBeHidden();
  });

  test('toccare il terreno vuoto nel sito apre la costruzione', async ({ game: page }) => {
    await page.locator('svg.scene [aria-label*="Terreno"]').click({ force: true });
    await expect(page.locator('#overlay .tile').first()).toBeVisible();
  });

  test('dopo la costruzione la scena cambia: anello e caverna compaiono', async ({ game: page }) => {
    await expect(page.locator('svg.scene [aria-label*="Terreno"]')).toBeVisible();
    await built(page);
    await expect(page.locator('svg.scene [aria-label*="Anello"]')).toBeVisible();
    await expect(page.locator('svg.scene [aria-label*="collisione"]')).toBeVisible();
    await expect(page.locator('svg.scene [aria-label*="Terreno"]')).toBeHidden();
  });

  test('toccare la caverna apre la sezione del detector e il tasto indietro torna al sito', async ({ game: page }) => {
    await built(page);
    await page.locator('svg.scene [aria-label*="collisione"]').click({ force: true });
    await expect(page.locator('svg.scene [aria-label*="Torna"]')).toBeVisible();
    await page.locator('svg.scene [aria-label*="Torna"]').click({ force: true });
    await expect(page.locator('svg.scene [aria-label*="Anello"]')).toBeVisible();
  });
});
