// Partita completa nel browser (@long): un bot gioca tutti e 12 i bersagli usando la UI vera per le azioni principali
// (costruzione, corsa, analisi con tagli, conferma col minigioco) e le API solo per far scorrere il tempo e finanziare gli upgrade.
const { test, expect, tab, launch } = require('./helpers');

const STEP = 0.25; // anni di gioco per passo
const MAX_YEARS_PER_TARGET = 120;

// --- azioni "in pagina": tempo, fondi, upgrade --------------------------------------------------------------
const advance = (page, years) => page.evaluate((y) => { UI.closeOverlay(); UI.update((s) => Game.tick(s, y * Game.YEAR_S)); }, years);

// Porta i requisiti del bersaglio a posto: sottosistemi, energia, luminosità sufficiente. Ritorna gli anni spesi.
async function ensureReady(page, id) {
  return page.evaluate(async ([tid, step, maxYears]) => {
    const p = Processes.BY_ID.get(tid);
    const t0 = UI.get().t;
    const topUp = (pool, need) => { // sposta fondi dal conto più ricco se serve e se avanza
      const s = UI.get();
      if (s.pools[pool] >= need) return;
      const donor = ['ops', 'analysis', 'rnd'].filter((k) => k !== pool).sort((a, b) => s.pools[b] - s.pools[a])[0];
      const gap = (need - s.pools[pool]) / 0.9;
      if (s.pools[donor] > gap * 1.5) UI.update((st) => Game.transfer(st, donor, pool, Math.ceil(gap)));
    };
    for (let i = 0; i < maxYears / step; i++) {
      UI.closeOverlay();
      const s = UI.get();
      const idle = !s.shutdown && !s.run;
      let acted = false;
      for (const [k, need] of Object.entries(p.need)) {
        const lvl = s.det[k];
        if (lvl >= need) continue;
        const pj = s.projects[`det:${k}`];
        if (lvl === 0 && idle) { const pl = Game.shutdownPlan(s, [k], s.collider); topUp('rnd', pl.cost); UI.update((st) => Game.startShutdown(st, [k], st.collider)); acted = true; }
        else if (lvl >= 1 && !pj) { const sp = Game.projectSpec(s, 'det', k); if (sp) { topUp('rnd', sp.cost); UI.update((st) => Game.startProject(st, 'det', k, { risk: 'safe' })); acted = true; } }
        else if (pj && pj.state === 'ready' && idle) { const pl = Game.shutdownPlan(s, [k], s.collider); topUp('rnd', pl.cost); UI.update((st) => Game.startShutdown(st, [k], st.collider)); acted = true; }
      }
      if (!Game.energyOk(s, tid) && !s.projects.energy) { const sp = Game.projectSpec(s, 'energy'); if (sp) { topUp('rnd', sp.cost); UI.update((st) => Game.startProject(st, 'energy', null, { risk: 'safe' })); acted = true; } }
      // luminosità: se servono troppi anni di dati, si migliora
      const cfg = Game.cfgOf(UI.get(), tid);
      let lo = 1; let hi = 1e8;
      for (let j = 0; j < 50; j++) { const mid = Math.sqrt(lo * hi); (Physics.evaluate({ ...UI.get() }, p, cfg, mid).z < 7 ? (lo = mid) : (hi = mid)); }
      const rate = Physics.lumiRate(UI.get());
      const needYears = p.kind === 'measure' ? 1 : hi / rate;
      const cur = UI.get();
      if (Game.canRun(cur, tid) && needYears > 6 && cur.lumiLvl < Physics.MAX_LUMI && !cur.projects.lumi) { const sp = Game.projectSpec(cur, 'lumi'); if (sp) { topUp('rnd', sp.cost); UI.update((st) => Game.startProject(st, 'lumi', null, { risk: 'safe' })); acted = true; } }
      const ready = Game.canRun(UI.get(), tid) && !UI.get().shutdown; // la luminosità si migliora in parallelo, senza bloccare
      if (ready) break;
      void acted;
      UI.update((st) => Game.tick(st, step * Game.YEAR_S));
    }
    return UI.get().t - t0;
  }, [id, STEP, MAX_YEARS_PER_TARGET]);
}

const metric = (page, id, strategy) => page.evaluate(([tid, strat]) => {
  const s = UI.get(); const p = Processes.BY_ID.get(tid);
  const e = Physics.evaluate(s, p, Game.cfgOf(s, tid), Game.dataOf(s, tid), Physics.SYST_VALID);
  const pl = Physics.plan(strat, { blind: true, valid: true }, p);
  return p.kind === 'measure' ? p.goal / (e.sigma / pl.sens) : (p.kind === 'search' ? e.znom : e.z) * pl.sens;
}, [id, strategy]);

const strategyFor = (kind, type) => (kind === 'measure' ? 'fit' : type === 'nonres' || type === 'rare' ? 'mva' : 'bump');

// --- azioni "di UI" ---------------------------------------------------------------------------------
async function selectTarget(page, id) {
  await page.evaluate(() => UI.closeOverlay());
  await tab(page, 'physics');
  const name = await page.evaluate((i) => I18n.t(`proc.${i}`), id);
  const inList = await page.evaluate((i) => Game.programsOf(UI.get()).includes(i), id);
  // se ci sono altre misure attive le togliamo: il bot ne gioca una per volta
  await page.evaluate((i) => UI.update((s) => ({ ...s, program: i, extra: [] })), id);
  await page.locator('#physics-host .target').filter({ hasText: name }).first().click();
  void inList;
}

async function uiRun(page) {
  for (let tries = 0; tries < 80; tries++) {
    await page.evaluate(() => UI.closeOverlay());
    if (await page.evaluate(() => !!UI.get().run)) return true;
    await page.locator('#physics-host button.primary').filter({ hasText: /Corsa/ }).click();
    const go = page.locator('#overlay button.primary');
    await expect(go).toBeVisible();
    const isRunPopup = (await page.locator('#overlay .tile.col').count()) === 3; // altrimenti è l'elenco dei requisiti mancanti
    if (isRunPopup && (await go.isEnabled())) { await go.click(); return true; }
    await page.evaluate(() => UI.closeOverlay());
    await advance(page, 0.5); // senza fondi per la corsa o rilevatore in fermo: si aspetta
  }
  return false;
}

async function uiAnalysis(page, id, strategy) {
  const tier = await page.evaluate((i) => Processes.BY_ID.get(i).tier, id);
  const stratName = await page.evaluate((st) => I18n.t(`an.strategy.${st}`), strategy);
  await page.locator('#physics-host .chips button').filter({ hasText: new RegExp(`^${stratName}$`) }).click();
  if (tier > 0) { // scelta dei tagli: i tre giusti (il bot conosce la risposta, il giocatore la deduce dall'indizio)
    const good = await page.evaluate((i) => Physics.goodCuts(Processes.BY_ID.get(i)).map((c) => I18n.t(`cut.${c}`)), id);
    for (const name of good) {
      const b = page.locator('#physics-host .chips button').filter({ hasText: new RegExp(`^${name}$`) });
      if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
    }
  }
  // il fondo Analisi (15% del budget) non basta per le analisi più care: il giocatore sposta fondi dagli altri conti
  await page.evaluate(([i, strat]) => {
    const s = UI.get(); const p = Processes.BY_ID.get(i);
    const cost = Game.analysisCost(s, p, strat, { blind: true, valid: true });
    if (s.pools.analysis >= cost) return;
    const donor = ['ops', 'rnd'].sort((a, b) => s.pools[b] - s.pools[a])[0];
    UI.update((st) => Game.transfer(st, donor, 'analysis', Math.ceil((cost - s.pools.analysis) / 0.9) + 1));
  }, [id, strategy]);
  const start = page.locator('#physics-host button.primary').filter({ hasText: /Avvia l'analisi/ });
  for (let i = 0; i < 80 && !(await start.isEnabled()); i++) await advance(page, 0.5); // fondi analisi
  if (!(await start.isEnabled())) {
    const dump = await page.evaluate((i) => { const s = UI.get(); const p = Processes.BY_ID.get(i); const e = Physics.evaluate(s, p, Game.cfgOf(s, i), Game.dataOf(s, i), Physics.SYST_VALID); return JSON.stringify({ t: s.t, pools: s.pools, cost: Game.analysisCost(s, p, 'bump', { blind: true, valid: true }), L: Game.dataOf(s, i), ok: e.ok, z: e.z, job: s.jobs[i], done: Object.keys(s.done) }); }, id);
    throw new Error(`analisi non avviabile per ${id}: ${dump}`);
  }
  await start.click();
}

async function uiConfirm(page, id) {
  const tier = await page.evaluate((i) => Processes.BY_ID.get(i).tier, id);
  await page.locator('#physics-host button.primary').filter({ hasText: /Conferma/ }).click();
  const answer = await page.evaluate((t) => I18n.t(`shape.${Core.newGame('s-00', Processes.TIERS[t].pool).answer}`), tier);
  await launch(page);
  await page.locator('#overlay .choice').filter({ hasText: answer }).click();
  await expect(page.locator('#overlay')).toContainText('Esatto');
  await page.locator('#overlay button').filter({ hasText: 'Continua' }).click();
}

// Gioca un bersaglio fino alla pubblicazione; ritorna { years, scooped }.
async function playTarget(page, id) {
  const t0 = await page.evaluate(() => UI.get().t);
  const meta = await page.evaluate((i) => { const p = Processes.BY_ID.get(i); return { kind: p.kind, type: p.type, tier: p.tier }; }, id);
  const strategy = strategyFor(meta.kind, meta.type);
  await ensureReady(page, id);
  await selectTarget(page, id);
  if (meta.tier === 0) await page.locator('#physics-host button').filter({ hasText: 'Auto-regola' }).click();
  else await page.evaluate((i) => UI.update((s) => Game.autotuneCfg(s, i)), id);
  for (let attempt = 0; attempt < 8; attempt++) {
    // raccolta dati finché la sensibilità attesa non basta (il bot "sa" il valore; il giocatore guarda l'istogramma)
    for (let i = 0; i < 400 && (await metric(page, id, strategy)) < (meta.kind === 'measure' ? 1.25 : meta.kind === 'search' ? 3.6 : 6.5); i++) {
      await ensureReady(page, id);
      await selectTarget(page, id);
      if (!(await uiRun(page))) {
        const dump = await page.evaluate((i) => { const s = UI.get(); return JSON.stringify({ t: s.t, det: s.det, e: s.energyLvl, lumi: s.lumiLvl, pools: s.pools, projects: s.projects, shutdown: s.shutdown, canRun: Game.canRun(s, i), energyOk: Game.energyOk(s, i), cost: Game.runCost(s, 2) }); }, id);
        throw new Error(`corsa impossibile per ${id}: ${dump}`);
      }
      await advance(page, 2.1);
    }
    await selectTarget(page, id);
    await uiAnalysis(page, id, strategy);
    // attesa dell'analisi (e di eventuali ricontrolli)
    for (let i = 0; i < 80; i++) {
      await advance(page, 0.5);
      const st = await page.evaluate((i2) => ({ job: UI.get().jobs[i2] && UI.get().jobs[i2].state, done: i2 in UI.get().done }), id);
      if (st.done || st.job === 'confirm' || !st.job) break;
    }
    const after = await page.evaluate((i) => ({ job: UI.get().jobs[i] && UI.get().jobs[i].state, done: i in UI.get().done }), id);
    if (after.done) break;
    if (after.job === 'confirm') { await selectTarget(page, id); await uiConfirm(page, id); break; }
    // inconclusiva: servono più dati
    await page.evaluate((i) => UI.update((s) => ({ ...s, data: { ...s.data, [i]: s.data[i] * 1 } })), id);
    await advance(page, 4);
  }
  const res = await page.evaluate((i) => ({ done: UI.get().done[i], t: UI.get().t }), id);
  expect(res.done, `${id} pubblicato`).toBeTruthy();
  return { years: res.t - t0, scooped: !!res.done.scooped, limit: !!res.done.limit };
}

test.describe('partita completa @long', () => {
  test.setTimeout(12 * 60_000);

  test('un giocatore competente pubblica i primi risultati giocando dalla UI', async ({ game: page }) => {
    // costruzione iniziale dalla UI vera
    await page.locator('.cardbtn.c-build').click();
    for (const n of ['Tracciatore', 'muoni', 'DAQ']) await page.locator(`#overlay .tile[aria-label*="${n}"]`).click();
    await page.locator('#overlay button.primary').click();
    await expect(page.locator('#overlay')).toBeHidden();

    // il bot di UI gioca un risultato alla volta: i primi N (E2E_RESULTS, default 12), sempre il disponibile con meno dati richiesti
    const N = Number(process.env.E2E_RESULTS || 12);
    const report = [];
    for (let k = 0; k < N; k++) {
      const id = await page.evaluate(() => {
        const s = UI.get();
        return Processes.PROCESSES.filter((p) => Game.isAvail(s, p.id) && !(p.id in s.done)).sort((a, b) => a.L5 - b.L5)[0].id;
      });
      const r = await playTarget(page, id);
      console.log(`  ${k + 1}. ${id}: ${r.years.toFixed(1)} anni${r.scooped ? ' (scavalcato)' : ''}${r.limit ? ' (limite)' : ''}`);
      report.push({ id, ...r, year: await page.evaluate(() => UI.get().t) });
    }
    const end = await page.evaluate(() => ({ complete: Game.isComplete(UI.get()), t: UI.get().t, rep: Game.repTotal(UI.get()), pools: UI.get().pools }));
    test.info().annotations.push({ type: 'rapporto', description: JSON.stringify({ report: report.map((r) => `${r.id}: ${r.years.toFixed(1)}a${r.scooped ? ' (scavalcato)' : ''}${r.limit ? ' (limite)' : ''}`), end }) });
    console.log('RAPPORTO PARTITA', JSON.stringify({ report, end }, null, 1));
    expect(Object.keys(await page.evaluate(() => UI.get().done)).length).toBeGreaterThanOrEqual(N);
    expect(end.t, 'tempo di gioco ragionevole per i primi risultati').toBeLessThan(40 * N);
  });
});
