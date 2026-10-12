// Layout a più larghezze, accessibilità, lingue, movimento ridotto. Gli screenshot vanno in e2e/screens/ per la revisione a occhio.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect, built, tab, patch, state } = require('./helpers');

const SCREENS = path.join(__dirname, 'screens');
const VIEWPORTS = [{ name: 'phone-s', width: 360, height: 740 }, { name: 'phone', width: 411, height: 860 }, { name: 'tablet', width: 768, height: 1024 }];

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = async (page, name) => { fs.mkdirSync(SCREENS, { recursive: true }); await page.screenshot({ path: path.join(SCREENS, `${name}.png`), fullPage: true }); };

// Stato di metà partita, così ogni schermata mostra contenuti reali.
async function midGame(page) {
  await built(page);
  await patch(page, {
    pools: { ops: 800, analysis: 300, rnd: 900 }, rep: 1.5, data: { rho: 12 }, program: 'rho', t: 3.2,
    done: {}, boosts: [{ amount: 0.2, start: 1, years: 6 }],
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`layout ${vp.name} ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('schede principali senza scorrimento orizzontale', async ({ game: page }) => {
      await midGame(page);
      for (const v of ['site', 'physics', 'play', 'budget']) {
        await tab(page, v);
        expect(await noHScroll(page), `scheda ${v}`).toBe(true);
        await shot(page, `${vp.name}-${v}`);
      }
    });

    test('i titoli delle carte non sono tagliati', async ({ game: page }) => {
      await midGame(page);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.cardbtn .ctitle')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      expect(clipped).toEqual([]);
    });

    test('popup principali senza scorrimento orizzontale e con il contenuto dentro lo schermo', async ({ game: page }) => {
      await midGame(page);
      const popups = { costruzione: () => Popups.construction(), progetti: () => Popups.projects(), budget: () => Popups.budget(), corsa: () => Popups.run(), 'avvio-progetto': () => Popups.projectStart('energy', null) };
      for (const [name, open] of Object.entries(popups)) {
        await page.evaluate(open);
        await expect(page.locator('#overlay')).toBeVisible();
        expect(await noHScroll(page), `popup ${name}`).toBe(true);
        const out = await page.evaluate(() => [...document.querySelectorAll('#overlay button, #overlay .tile')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1); }).length);
        expect(out, `popup ${name}: elementi fuori schermo`).toBe(0);
        await shot(page, `${vp.name}-popup-${name}`);
        await page.evaluate(() => UI.closeOverlay());
      }
    });

    test('la scena (sito e detector) mantiene le proporzioni e non esce dal contenitore', async ({ game: page }) => {
      await midGame(page);
      const box = await page.locator('svg.scene').boundingBox();
      expect(box.width).toBeLessThanOrEqual(vp.width);
      expect(box.height).toBeGreaterThan(200);
      await page.locator('svg.scene [aria-label*="collisione"]').click({ force: true });
      await shot(page, `${vp.name}-detector`);
      expect(await noHScroll(page)).toBe(true);
    });
  });
}

test.describe('accessibilità', () => {
  test('ogni pulsante ha un nome accessibile', async ({ game: page }) => {
    await midGame(page);
    for (const v of ['site', 'physics', 'play', 'budget']) {
      await tab(page, v);
      const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"]')].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !(b.getAttribute('aria-label') || b.textContent.trim());
      }).map((b) => b.className || b.id));
      expect(unnamed, `scheda ${v}`).toEqual([]);
    }
  });

  test('bersagli di tocco: nessun pulsante visibile sotto i 30 px (la maggior parte ≥ 44)', async ({ game: page }) => {
    await midGame(page);
    const small = [];
    for (const v of ['site', 'physics', 'budget']) {
      await tab(page, v);
      small.push(...await page.evaluate(() => [...document.querySelectorAll('main button, #tabs button, .cardbtn')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => { const r = b.getBoundingClientRect(); return { n: (b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.h < 44 || x.w < 44)));
    }
    test.info().annotations.push({ type: 'tocchi piccoli', description: JSON.stringify(small) });
    expect(small.filter((x) => x.h < 30 || x.w < 30)).toEqual([]);
  });

  test('i controlli SVG interattivi sono raggiungibili da tastiera (Invio/Spazio)', async ({ game: page }) => {
    await built(page);
    const ring = page.locator('svg.scene [aria-label*="Anello"]');
    await ring.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#overlay')).toBeVisible();
  });

  test('con movimento ridotto le animazioni sono spente', async ({ game: page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await built(page);
    const names = await page.evaluate(() => ['.twinkle', '.drift', '.flicker', '.breathe', '.crane'].map((q) => { const e = document.querySelector(`svg.scene ${q}`); return e ? getComputedStyle(e).animationName : 'assente'; }));
    for (const n of names) expect(['none', 'assente']).toContain(n);
  });
});

test.describe('lingue', () => {
  test('nessuna chiave di traduzione "nuda" nelle schede e nei popup (IT)', async ({ game: page }) => {
    await midGame(page);
    const raw = /\b(?:ev|fev|pop|physics|an|cut|gain|hist|proj|pool|hud|act|menu|done|stat|kind|state|sub|proc)\.[a-z_.]{2,}/;
    for (const v of ['site', 'physics', 'play', 'budget']) { await tab(page, v); expect(await page.locator('body').innerText(), v).not.toMatch(raw); }
    for (const open of [() => Popups.construction(), () => Popups.projects(), () => Popups.budget(), () => Popups.run()]) {
      await page.evaluate(open);
      expect(await page.locator('#overlay').innerText()).not.toMatch(raw);
      await page.evaluate(() => UI.closeOverlay());
    }
  });

  test('passando all’inglese lo stato resta e i testi cambiano', async ({ game: page }) => {
    await midGame(page);
    const before = await state(page);
    await page.evaluate(() => document.getElementById('lang').click());
    await page.waitForFunction(() => window.UI);
    await page.evaluate(() => UI.closeOverlay());
    const after = await state(page);
    expect(after.built).toBe(before.built);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    await tab(page, 'physics');
    expect(await page.locator('body').innerText()).toMatch(/Trigger and selection|Data:/);
    const raw = /\b(?:ev|fev|pop|physics|an|cut|gain|hist|proj)\.[a-z_.]{2,}/;
    expect(await page.locator('body').innerText()).not.toMatch(raw);
  });
});
