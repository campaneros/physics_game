// Presa dati, trigger/selezione, analisi con tagli, conferma col minigioco, pubblicazione.
const { test, expect, state, tab, tick, patch, built, launch } = require('./helpers');

const targetCard = (page, re) => page.locator('#physics-host .target').filter({ hasText: re }).first();
const physText = (page) => page.locator('#physics-host').innerText();

async function pick(page, re) {
  await tab(page, 'physics');
  await targetCard(page, re).click();
}

// Avvia una corsa dalla scheda Fisica e porta il tempo in avanti fino alla fine.
async function runData(page, years = 2) {
  await page.locator('#physics-host button.primary').filter({ hasText: /Corsa/ }).click();
  await page.locator('#overlay .tile.col').nth([1, 2, 5].indexOf(years)).click();
  await page.locator('#overlay button.primary').click();
  await tick(page, years + 0.1);
}

test.describe('presa dati', () => {
  test.beforeEach(async ({ game: page }) => { await built(page); });

  test('selezione bersaglio, requisiti verdi, corsa pagata dal fondo Operazioni', async ({ game: page }) => {
    await pick(page, /ρ/);
    await expect(page.locator('#physics-host .req li.ok')).toHaveCount(3);
    const before = (await state(page)).pools.ops;
    await page.locator('#physics-host button.primary').filter({ hasText: /Corsa/ }).click();
    await expect(page.locator('#overlay .tile.col')).toHaveCount(3);
    await page.locator('#overlay .tile.col').nth(1).click(); // 2 anni
    await page.locator('#overlay button.primary').click();
    const s = await state(page);
    expect(s.run).not.toBeNull();
    expect(s.pools.ops).toBeLessThan(before);
    expect(s.pools.rnd).toBe(580); // lo sviluppo non si tocca
  });

  test('i dati crescono e la corsa termina; la significatività NON è visibile', async ({ game: page }) => {
    await pick(page, /ρ/);
    await runData(page, 2);
    const s = await state(page);
    expect(s.run).toBeNull();
    expect(s.data.rho).toBeGreaterThan(15);
    const t = await physText(page);
    expect(t).toMatch(/Dati: [\d.]+ fb/);
    expect(t).not.toMatch(/Significatività/);
    await expect(page.locator('#physics-host .legend .lg').nth(2)).toBeHidden(); // curva del segnale svelata solo a scoperta fatta
  });

  test('corsa senza fondi sufficienti: Avvia spento', async ({ game: page }) => {
    await pick(page, /ρ/);
    await patch(page, { pools: { ops: 5, analysis: 200, rnd: 580 } });
    await page.locator('#physics-host button.primary').filter({ hasText: /Corsa/ }).click();
    await expect(page.locator('#overlay button.primary')).toBeDisabled();
  });

  test('trigger e selezione: le barre rispondono ai cursori', async ({ game: page }) => {
    await pick(page, /ρ/);
    const sig = () => page.locator('#physics-host .meter .m-sig').locator('xpath=following-sibling::small').innerText();
    const before = await sig();
    await page.locator('#physics-host input[type="range"]').first().evaluate((el) => { el.value = '80'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(await sig()).not.toBe(before);
    expect((await state(page)).cfg.rho.trig).toBeCloseTo(0.8, 2);
  });

  test('Auto-regola è visibile solo nel tutorial (livello 0)', async ({ game: page }) => {
    await pick(page, /ρ/);
    await expect(page.locator('#physics-host button').filter({ hasText: 'Auto-regola' })).toBeVisible();
  });
});

test.describe('misure in parallelo', () => {
  const upTo = { rho: 1, jpsi: 1, upsilon: 1, w: 1, z: 1, top: 1, higgs: 1 };
  const doneAll = (ids) => Object.fromEntries(ids.map((id) => [id, { z: 9, sigma: 0, limit: false, scooped: false, t: 0, rep: 1, boost: 0.1, years: 6, snap: null }]));

  test('adroni: più misure con il DAQ; ogni misura ha il suo trigger', async ({ game: page }) => {
    await patch(page, { built: true, det: { tracker: 3, ecal: 3, hcal: 3, muon: 3, daq: 2 }, energyLvl: 8, pools: { ops: 1e5, analysis: 1e5, rnd: 1e5 }, done: doneAll(Object.keys(upTo)), availAt: { hbb: 0, hmumu: 0, zprime: 0, tth: 0 } });
    await tab(page, 'physics');
    await targetCard(page, /H → bb/).click(); // il primo bersaglio entra da solo
    await expect(page.locator('#physics-host button').filter({ hasText: /Togli dalla presa dati/ })).toBeVisible();
    await targetCard(page, /H → μμ/).click(); // guardare un altro bersaglio non lo aggiunge
    expect((await state(page)).extra).toEqual([]);
    await page.locator('#physics-host button').filter({ hasText: /Aggiungi alla presa dati/ }).click();
    expect((await state(page)).extra.length + 1).toBe(2);
    await expect(page.locator('#physics-host')).toContainText('Ognuna ha il suo trigger');
    await targetCard(page, /Z′/).click();
    await page.locator('#physics-host button').filter({ hasText: /Aggiungi alla presa dati/ }).click();
    await expect(page.locator('#physics-host button').filter({ hasText: /Posti di presa dati esauriti|Togli/ }).first()).toBeVisible();
    // una corsa dà dati a tutte le misure attive
    await page.locator('#physics-host button.primary').filter({ hasText: /Corsa/ }).click();
    await expect(page.locator('#overlay')).toContainText('3 misura'); // le tre misure condividono la corsa
    await page.locator('#overlay button.primary').click();
    await tick(page, 0.5);
    const s = await state(page);
    expect(s.data.hbb).toBeGreaterThan(0);
    expect(s.data.hmumu).toBeGreaterThan(0);
  });

  test('leptoni: una sola misura alla volta', async ({ game: page }) => {
    await patch(page, { built: true, collider: 'ee', det: { tracker: 3, ecal: 3, hcal: 3, muon: 3, daq: 3 }, energyLvl: 4, done: doneAll(['rho']), availAt: { jpsi: 0 } });
    await tab(page, 'physics');
    await targetCard(page, /J\/ψ/).click();
    await expect(page.locator('#physics-host')).toContainText('una misura alla volta');
  });
});

test.describe('analisi, tagli e pubblicazione', () => {
  test('tutorial: tagli giusti preimpostati e bloccati', async ({ game: page }) => {
    await built(page);
    await pick(page, /ρ/);
    await runData(page, 2);
    const chips = page.locator('#physics-host .chips button').filter({ hasText: /Finestra di massa|Isolamento|Identificazione leptoni/ });
    await expect(chips).toHaveCount(3);
    for (let i = 0; i < 3; i++) { await expect(chips.nth(i)).toHaveAttribute('aria-pressed', 'true'); await expect(chips.nth(i)).toBeDisabled(); }
    await expect(page.locator('#physics-host .tutorial')).toBeVisible();
  });

  test('flusso completo ρ: analisi → conferma → pubblicazione con premio e grafico finale', async ({ game: page }) => {
    await built(page);
    await pick(page, /ρ/);
    await runData(page, 2);
    await patch(page, { data: { rho: 500 } }); // il ritmo del gioco richiede più dati di una corsa: qui si testa il flusso, non la durata
    const fundBefore = (await state(page)).pools.analysis;
    await page.locator('#physics-host button.primary').filter({ hasText: /Avvia l'analisi/ }).click();
    const s1 = await state(page);
    expect(s1.jobs.rho.state).toBe('run');
    expect(s1.pools.analysis).toBeLessThan(fundBefore);
    await expect(page.locator('#physics-host')).not.toContainText('Significatività');
    await tick(page, 2);
    expect((await state(page)).jobs.rho.state).toBe('confirm');

    await page.locator('#physics-host button.primary').filter({ hasText: /Conferma/ }).click();
    await expect(page.locator('#overlay canvas.mg-canvas')).toBeVisible();
    // risposta sbagliata o corretta: cerchiamo quella giusta calcolandola dal seed deterministico
    const answer = await page.evaluate(() => I18n.t(`shape.${Core.newGame('s-00', Processes.TIERS[0].pool).answer}`));
    await launch(page);
    await page.locator('#overlay .choice').filter({ hasText: answer }).click();
    await expect(page.locator('#overlay')).toContainText('Esatto');
    await page.locator('#overlay button').filter({ hasText: 'Continua' }).click();
    await expect(page.locator('#overlay')).toBeHidden();

    const s = await state(page);
    expect(Object.keys(s.done)).toContain('rho');
    expect(s.boosts.length).toBe(1);
    expect(s.rep).toBeGreaterThan(0);
    await expect(page.locator('#physics-host')).toContainText('Scoperto');
    await expect(page.locator('#physics-host')).toContainText('Premio');
    await expect(page.locator('#physics-host canvas.hist')).toBeVisible(); // grafico finale
    await expect(page.locator('#physics-host .legend .lg').nth(2)).toBeVisible(); // ora la curva del segnale è svelata
    await expect(page.locator('#physics-host .target').filter({ hasText: /^J\/ψ/ })).toContainText('disponibile');
  });

  test('minigioco: risposta senza lanci non è ammessa', async ({ game: page }) => {
    await built(page);
    await patch(page, { program: 'rho', data: { rho: 500 } });
    await pick(page, /ρ/);
    await page.locator('#physics-host button.primary').filter({ hasText: /Avvia l'analisi/ }).click();
    await tick(page, 2);
    await page.locator('#physics-host button.primary').filter({ hasText: /Conferma/ }).click();
    await page.locator('#overlay .choice').first().click();
    await expect(page.locator('#overlay')).toContainText('almeno un lancio');
    await page.locator('#overlay button').filter({ hasText: 'Annulla' }).click();
    await expect(page.locator('#overlay')).toBeHidden();
    expect((await state(page)).done.rho).toBeUndefined();
  });

  test('livello successivo: tagli sbagliati → non conclusiva con conteggio, tagli giusti → soglia', async ({ game: page }) => {
    // W: menu "met": tagli giusti = energia mancante, veto sui jet, pT alto. Calibriamo i dati per avere Z ≈ 7 con i tagli giusti.
    const pre = { built: true, det: { tracker: 2, ecal: 2, hcal: 2, muon: 2, daq: 2 }, energyLvl: 4, pools: { ops: 5000, analysis: 5000, rnd: 5000 } };
    await patch(page, { ...pre, done: Object.fromEntries(['rho', 'jpsi', 'upsilon'].map((id) => [id, { z: 9, sigma: 0, limit: false, scooped: false, t: 0, rep: 1, boost: 0.1, years: 6, snap: null }])), availAt: { w: 0 }, program: 'w' });
    const L = await page.evaluate(() => {
      const s = UI.get(); const p = Processes.BY_ID.get('w'); const cfg = Game.cfgOf(s, 'w');
      let lo = 1; let hi = 1e6;
      for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; (Physics.evaluate(s, p, cfg, mid).z < 7 / 1.0 ? (lo = mid) : (hi = mid)); }
      return hi;
    });
    await patch(page, { data: { w: L * 1.0 } });
    await tab(page, 'physics');
    await targetCard(page, /Bosone W/).click();
    await expect(page.locator('#physics-host .tutorial')).toBeHidden(); // niente più tutorial
    await expect(page.locator('#physics-host button').filter({ hasText: 'Auto-regola' })).toBeHidden();
    const cut = (re) => page.locator('#physics-host .chips button').filter({ hasText: re });
    // senza alcun taglio non si parte
    await expect(page.locator('#physics-host button.primary').filter({ hasText: /Avvia l'analisi/ })).toBeDisabled();
    // tre tagli sbagliati
    for (const re of [/Identificazione leptoni/, /b-tagging/, /Qualità del vertice/]) await cut(re).click();
    await page.locator('#physics-host button.primary').filter({ hasText: /Avvia l'analisi/ }).click();
    expect((await state(page)).jobs.w.good).toBe(0);
    await tick(page, 6);
    const bad = await state(page);
    expect(bad.jobs.w).toBeUndefined();
    expect(bad.done.w).toBeUndefined();
    expect(bad.events.some((e) => e.k === 'inconclusive' && e.v.good === 0)).toBe(true);
    expect(await page.evaluate(() => I18n.t('ev.inconclusive', { name: 'W', good: 0 }))).toContain('0/3');
    // tre tagli giusti
    for (const re of [/Identificazione leptoni/, /b-tagging/, /Qualità del vertice/]) await cut(re).click(); // deseleziona
    for (const re of [/Energia mancante/, /Veto sui jet/, /Soglia di pT alto/]) await cut(re).click();
    await page.locator('#physics-host button.primary').filter({ hasText: /Avvia l'analisi/ }).click();
    expect((await state(page)).jobs.w.good).toBe(3);
    await tick(page, 6);
    expect((await state(page)).jobs.w.state).toBe('confirm');
  });
});
