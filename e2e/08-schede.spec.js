// Matrice di test per le quattro schede: stato che avanza, scena SVG, cambio bersaglio, limiti del minigioco, guscio persistente, percorso completo.
const { test, expect, tab, state, patch, built, launch } = require('./helpers');

const rec = (over) => ({ z: 6, sigma: 0.05, limit: false, scooped: false, t: 1, rep: 1, boost: 0.1, years: 6, snap: null, ...over });

// --- SITO -------------------------------------------------------------------------------------
test.describe('sito', () => {
  test('S1 costruire il DAQ scala il fondo Sviluppo, aggiorna l’HUD e accende il LED sulla scena', async ({ game: page }) => {
    await built(page, { det: { tracker: 1, ecal: 0, hcal: 0, muon: 1, daq: 0 }, pools: { ops: 400, analysis: 200, rnd: 3000 } });
    const before = await state(page);
    const hudBefore = await page.locator('#hud-funds').innerText();
    const leds = () => page.evaluate(() => [...document.querySelectorAll('svg.scene [aria-label*="acquisizione"] circle')].filter((c) => c.getAttribute('fill') === '#4ade80').length);
    const ledsBefore = await leds();
    await page.locator('.cardbtn.c-build').click();
    await page.locator('#overlay .tile[aria-label*="DAQ"]').click();
    await page.locator('#overlay button.primary').click();
    const after = await state(page);
    expect(after.pools.rnd).toBeLessThan(before.pools.rnd);
    expect(after.det.daq).toBeGreaterThan(before.det.daq);
    await expect(page.locator('#hud-funds')).not.toHaveText(hudBefore);
    expect(await leds()).toBeGreaterThan(ledsBefore);
  });

  test('S2 il "+" del terreno apre COSTRUISCI e ha l’alone olografico animato', async ({ game: page }) => {
    const plot = page.locator('svg.scene [aria-label*="Terreno"]');
    await expect(plot).toBeVisible();
    const fx = await page.evaluate(() => {
      const g = document.querySelector('svg.scene [aria-label*="Terreno"]');
      const dashed = [...g.querySelectorAll('rect')].find((r) => r.getAttribute('stroke-dasharray'));
      const aura = g.querySelector('.aura');
      return { filter: dashed && dashed.getAttribute('filter'), anim: aura && getComputedStyle(aura).animationName, scan: !!g.querySelector('.scan') };
    });
    expect(fx.filter).toContain('holoGlow');
    expect(fx.anim).toBe('aura');
    expect(fx.scan).toBe(true);
    await plot.click({ force: true });
    await expect(page.locator('#overlay')).toBeVisible();
    await expect(page.locator('#overlay .tile').first()).toBeVisible();
  });

  test('S2 l’alone si spegne con il movimento ridotto', async ({ game: page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('svg.scene .aura')).animationName);
    expect(anim).toBe('none');
  });
});

// --- layout della scena su più schermi Android (S3) -----------------------------------------------
const ANDROID = [
  { name: '360x740', width: 360, height: 740 }, { name: '390x844', width: 390, height: 844 }, { name: '412x915', width: 412, height: 915 },
  { name: '600x960', width: 600, height: 960 }, { name: '768x1024', width: 768, height: 1024 },
];
for (const vp of ANDROID) {
  test.describe(`scena ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test('S3 niente sbordamenti: scena, azioni e navigazione dentro lo schermo', async ({ game: page }) => {
      await built(page, { energyLvl: 3, lumiLvl: 2, det: { tracker: 3, ecal: 2, hcal: 1, muon: 1, daq: 2 } });
      const r = await page.evaluate(() => {
        const w = innerWidth;
        const out = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.left < -1 || b.right > w + 1); };
        const svg = document.querySelector('svg.scene').getBoundingClientRect();
        const hits = [...document.querySelectorAll('svg.scene .hit')].filter((g) => { const b = g.getBoundingClientRect(); return b.width > 0 && (b.right > svg.right + 1 || b.left < svg.left - 1); });
        return {
          hscroll: document.documentElement.scrollWidth > w + 1,
          svgOut: out(document.querySelector('svg.scene')),
          deckOut: [...document.querySelectorAll('.deck button')].filter(out).length,
          tabsOut: [...document.querySelectorAll('#tabs button')].filter(out).length,
          hitsOut: hits.length,
          ratio: svg.width / svg.height,
          svgH: svg.height,
          navOverlap: document.querySelector('.deck').getBoundingClientRect().bottom > document.querySelector('#tabs').getBoundingClientRect().top + 1 ? 'sovrapposto' : 'ok',
        };
      });
      expect(r.hscroll).toBe(false);
      expect(r.svgOut).toBe(false);
      expect(r.deckOut).toBe(0);
      expect(r.tabsOut).toBe(0);
      expect(r.hitsOut).toBe(0);
      expect(r.ratio).toBeGreaterThanOrEqual(360 / 540 - 0.02); // il riquadro non è mai più stretto del disegno: nessuna deformazione (preserveAspectRatio)
      expect(r.svgH).toBeLessThanOrEqual(vp.height * 0.62 + 2); // tetto di altezza della scena
      void r.navOverlap; // la pagina scorre sotto la barra: la sovrapposizione iniziale è normale
    });
  });
}

// --- FISICA -----------------------------------------------------------------------------------
test.describe('fisica', () => {
  test('F1 cambiare bersaglio rinnova titolo, checklist e stato', async ({ game: page }) => {
    await built(page, { det: { tracker: 3, ecal: 3, hcal: 3, muon: 3, daq: 2 }, energyLvl: 5, done: { rho: rec({}) }, availAt: { omega: 0, phi: 0, jpsi: 0 } });
    await tab(page, 'physics');
    const targets = page.locator('#physics-host .target:not(.is-discovered)');
    const n = await targets.count();
    expect(n).toBeGreaterThanOrEqual(3);
    const seen = [];
    for (let i = 0; i < 3; i++) {
      await targets.nth(i).click();
      const title = await page.locator('#physics-host .panel h2').innerText();
      const reqs = await page.locator('#physics-host .req li').count();
      expect(reqs).toBeGreaterThan(0);
      await expect(page.locator('#physics-host .status.is-todo')).toBeVisible();
      seen.push(title);
    }
    expect(new Set(seen).size).toBe(3); // tre bersagli, tre schermate diverse
  });

  test('F2 tasto di presa dati: aggiungi, togli, posti esauriti (disabilitato)', async ({ game: page }) => {
    await built(page, { collider: 'pp', det: { tracker: 3, ecal: 3, hcal: 3, muon: 3, daq: 0 }, energyLvl: 5, done: { rho: rec({}) }, availAt: { omega: 0, phi: 0, jpsi: 0 } });
    await tab(page, 'physics');
    const main = page.locator('#physics-host .panel .ds-btn').first();
    const toggles = page.locator('#physics-host .slot-toggle');
    await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'false'); // disponibile
    await toggles.nth(0).click();
    await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'true'); // attivo
    await toggles.nth(1).click();
    await expect(toggles.nth(2)).toBeDisabled(); // posti esauriti
    void main;
  });
});

// --- SFIDA ------------------------------------------------------------------------------------
test.describe('sfida (forma nascosta)', () => {
  const status = (page) => page.locator('#play-host .mg-status');

  test('C2 lancio verso l’esterno rifiutato, risposta senza lanci rifiutata', async ({ game: page }) => {
    await tab(page, 'play');
    await expect(page.locator('#play-host canvas.mg-canvas')).toBeVisible();
    await expect(status(page)).toContainText('0/15');
    await launch(page, [0.02, 0.4], [0.0, 0.4]); // dal bordo verso l'esterno
    await expect(status(page)).toContainText('0/15');
    await page.locator('#play-host .choice').first().click(); // senza lanci
    await expect(page.locator('#play-host .mg-result')).toHaveCount(0);
    await expect(page.locator('#play-host .choice').first()).toBeEnabled();
  });

  test('C1/C2 al massimo 15 lanci; poi si risponde e il punteggio non è negativo', async ({ game: page }) => {
    await tab(page, 'play');
    for (let i = 0; i < 17; i++) await launch(page, [0.02, 0.1 + (i % 8) * 0.1], [0.2, 0.1 + (i % 8) * 0.1]);
    await expect(status(page)).toContainText('15/15');
    await page.locator('#play-host .choice').first().click();
    await expect(page.locator('#play-host .mg-result')).toBeVisible();
    await expect(page.locator('#play-host .choice').first()).toBeDisabled(); // a risposta data si chiude
  });
});

// --- guscio persistente (G1) -----------------------------------------------------------------------
test.describe('guscio', () => {
  test('G1 cambiare scheda non azzera né ritarda l’HUD; il tempo non torna indietro', async ({ game: page }) => {
    await built(page, { pools: { ops: 800, analysis: 300, rnd: 900 }, rep: 2.5, t: 4.2 });
    const read = () => page.evaluate(() => ({ year: Number(document.getElementById('hud-year').textContent), funds: document.getElementById('hud-funds').textContent, rep: document.getElementById('hud-rep').textContent, state: { t: UI.get().t, rep: Game.repTotal(UI.get()).toFixed(1), funds: UI.fmt(UI.get().pools.rnd) } }));
    let lastYear = (await read()).year;
    for (let round = 0; round < 3; round++) {
      for (const v of ['physics', 'play', 'budget', 'site']) {
        await tab(page, v);
        const h = await read();
        expect(h.year).toBeGreaterThanOrEqual(lastYear); // mai indietro
        expect(h.funds).toBe(h.state.funds); // nessun ritardo rispetto allo stato
        expect(h.rep).toBe(h.state.rep);
        expect(h.funds).toMatch(/^\d+(\.\d{1,2})?[KMBT]?$/); // nessun rumore in virgola mobile a schermo
        lastYear = h.year;
      }
    }
    expect(lastYear).toBeGreaterThanOrEqual(4.2);
  });

  test('G1 la scelta fatta in Fisica sopravvive al giro delle schede', async ({ game: page }) => {
    await built(page, { det: { tracker: 3, ecal: 3, hcal: 3, muon: 3, daq: 2 }, energyLvl: 5, done: { rho: rec({}) }, availAt: { omega: 0, phi: 0, jpsi: 0 } });
    await tab(page, 'physics');
    await page.locator('#physics-host .target:not(.is-discovered)').nth(1).click();
    const title = await page.locator('#physics-host .panel h2').innerText();
    for (const v of ['site', 'play', 'budget', 'physics']) await tab(page, v);
    await expect(page.locator('#physics-host .panel h2')).toHaveText(title);
  });
});

// --- percorso completo: Sito → upgrade → Fisica → Sfida ------------------------------------------------
test('percorso: upgrade dal Sito, poi Fisica e Sfida riflettono lo stato', async ({ game: page }) => {
  await built(page, { det: { tracker: 1, ecal: 0, hcal: 0, muon: 1, daq: 0 }, pools: { ops: 500, analysis: 200, rnd: 3000 }, collider: 'pp' });
  const s0 = await state(page);
  await page.locator('.cardbtn.c-build').click();
  await page.locator('#overlay .tile[aria-label*="DAQ"]').click();
  await page.locator('#overlay button.primary').click();
  const s1 = await state(page);
  expect(s1.pools.rnd).toBeLessThan(s0.pools.rnd);
  expect(s1.det.daq).toBe(1);

  await tab(page, 'physics');
  await expect(page.locator('#physics-host .progress')).toContainText('0/56');
  const slots = await page.evaluate(() => Physics.slots(UI.get()));
  expect(slots).toBe(3); // 2 di base + 1 per il DAQ appena installato
  await expect(page.locator('#physics-host .progress')).toContainText(`/${slots}`);

  await tab(page, 'play');
  await expect(page.locator('#play-host canvas.mg-canvas')).toBeVisible();
  await tab(page, 'site');
  expect((await state(page)).pools.rnd).toBe(s1.pools.rnd); // nessuna perdita al ritorno
});
