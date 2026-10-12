// Prestazioni e riferimenti visivi. Non girano di default: `npm run e2e:perf` e `npm run e2e:visual`.
// Le prestazioni sono un PROXY in Chromium con CPU rallentata 4×: non sostituiscono una prova su un telefono Android reale.
const { test, expect, tab, patch, built } = require('./helpers');

const CPU_SLOWDOWN = 8; // più severo di un telefono di fascia media (misurato: 60 fps costanti fino a 16×, primi cali a 24×)
const THRESHOLDS = { frameP95Ms: 34, frameAvgMs: 20, heapGrowth: 1.15, switchMs: 120 };

async function throttle(page, rate) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return cdp;
}
const heap = async (cdp) => {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'JSHeapUsedSize').value;
};
// Intervalli tra due frame consecutivi per `ms` millisecondi.
const frames = (page, ms) => page.evaluate((dur) => new Promise((resolve) => {
  const dts = [];
  let last = performance.now();
  const end = last + dur;
  const step = (now) => { dts.push(now - last); last = now; if (now < end) requestAnimationFrame(step); else resolve(dts.slice(2)); };
  requestAnimationFrame(step);
}), ms);
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

test.describe('prestazioni @perf', () => {
  test('G3 sito animato (scena, beam, aura): frame regolari con CPU rallentata', async ({ game: page }) => {
    await built(page, { energyLvl: 4, lumiLvl: 2, det: { tracker: 3, ecal: 3, hcal: 2, muon: 2, daq: 2 }, program: 'rho', run: { start: 0, end: 99, years: 1 }, data: { rho: 5 } });
    await patch(page, { shutdown: null });
    await throttle(page, CPU_SLOWDOWN);
    const dts = await frames(page, 4000);
    const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
    const p95 = pct(dts, 0.95);
    const note = `media ${avg.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · ${dts.length} frame`;
    test.info().annotations.push({ type: 'frame', description: note });
    console.log(`[perf] sito: ${note}`);
    expect(avg).toBeLessThanOrEqual(THRESHOLDS.frameAvgMs);
    expect(p95).toBeLessThanOrEqual(THRESHOLDS.frameP95Ms);
  });

  test('G3 scheda Fisica con più misure: aggiornamento del tick senza blocchi', async ({ game: page }) => {
    await built(page, { det: { tracker: 3, ecal: 3, hcal: 3, muon: 3, daq: 3 }, energyLvl: 5, done: { rho: { z: 6, sigma: 0, limit: false, scooped: false, t: 1, rep: 1, boost: 0.1, years: 6, snap: null } }, availAt: { omega: 0, phi: 0, jpsi: 0 } });
    await tab(page, 'physics');
    await page.locator('#physics-host .slot-toggle').nth(0).click();
    await page.locator('#physics-host .slot-toggle').nth(1).click();
    await throttle(page, CPU_SLOWDOWN);
    const dts = await frames(page, 3000);
    const p95 = pct(dts, 0.95);
    test.info().annotations.push({ type: 'frame', description: `p95 ${p95.toFixed(1)} ms` });
    console.log(`[perf] fisica: p95 ${p95.toFixed(1)} ms`);
    expect(p95).toBeLessThanOrEqual(THRESHOLDS.frameP95Ms);
  });

  test('G4 200 cambi di scheda: la memoria non cresce e ogni cambio è veloce', async ({ game: page }) => {
    await built(page);
    const cdp = await throttle(page, 1);
    await cdp.send('Performance.enable');
    for (let i = 0; i < 20; i++) for (const v of ['physics', 'play', 'budget', 'site']) await page.evaluate((x) => UI.showTab(x), v);
    const base = await heap(cdp);
    const t0 = Date.now();
    for (let i = 0; i < 50; i++) for (const v of ['physics', 'play', 'budget', 'site']) await page.evaluate((x) => UI.showTab(x), v);
    const perSwitch = (Date.now() - t0) / 200;
    const end = await heap(cdp);
    const note = `${(base / 1e6).toFixed(1)} → ${(end / 1e6).toFixed(1)} MB · ${perSwitch.toFixed(1)} ms/cambio`;
    test.info().annotations.push({ type: 'memoria', description: note });
    console.log(`[perf] memoria: ${note}`);
    expect(end / base).toBeLessThanOrEqual(THRESHOLDS.heapGrowth);
    expect(perSwitch).toBeLessThanOrEqual(THRESHOLDS.switchMs);
    expect(await page.locator('svg.scene').count()).toBe(1); // nessuna scena duplicata
  });
});

// Riferimenti visivi: generarli con `npx playwright test --grep @visual --update-snapshots`. Dipendono da font e sistema operativo.
test.describe('riferimenti visivi @visual', () => {
  test.use({ viewport: { width: 411, height: 860 }, reducedMotion: 'reduce' });
  test('S4 sito: vuoto, costruito', async ({ game: page }) => {
    await page.waitForTimeout(300);
    await expect(page.locator('.scene-frame')).toHaveScreenshot('sito-vuoto.png', { maxDiffPixelRatio: 0.02 });
    await built(page, { energyLvl: 3, lumiLvl: 2, det: { tracker: 3, ecal: 2, hcal: 1, muon: 1, daq: 2 } });
    await page.waitForTimeout(300);
    await expect(page.locator('.scene-frame')).toHaveScreenshot('sito-costruito.png', { maxDiffPixelRatio: 0.02 });
    await expect(page.locator('.deck')).toHaveScreenshot('azioni.png', { maxDiffPixelRatio: 0.02 });
  });
});
