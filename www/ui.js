// Guscio dell'interfaccia: HUD, schede, banner, overlay, salvataggio e ciclo di gioco.
// Il testo dinamico passa sempre da textContent: nessun innerHTML. Le schede si registrano con UI.register.
(() => {
  'use strict';
  const G = Game;
  const PH = Physics;
  const tr = I18n.t;

  const SAVE_KEY = 'accel-save-v5';
  const TICK_MS = 250;
  const MAX_DT_S = 2;
  const SAVE_EVERY_MS = 5000;
  const ARM_MS = 3000;
  const HELP_PAGES = 6;
  const AWAY_BANNER_MIN_S = 60;

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const button = (text, onClick) => {
    const b = el('button', null, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  const store = {
    get() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } },
    set(t) { try { localStorage.setItem(SAVE_KEY, t); } catch (e) { /* storage non disponibile */ } },
    clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage non disponibile */ } },
  };
  const randomSeed = () => {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return `s-${a[0].toString(36)}${a[1].toString(36)}`;
  };
  const utcDay = () => new Date().toISOString().slice(0, 10);

  const SUFFIX = ['', 'K', 'M', 'B', 'T'];
  function fmt(n) {
    if (!Number.isFinite(n)) return '∞';
    const a = Math.abs(n);
    if (a < 1000) return a < 10 && n % 1 ? n.toFixed(2) : a < 100 && n % 1 ? n.toFixed(1) : String(Math.round(n));
    const e = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(a) / 3));
    return (n / 1000 ** e).toFixed(2) + SUFFIX[e];
  }
  const fmtYears = (y) => Math.max(1, Math.round((y * G.YEAR_S) / 60));
  const fmtAway = (sec) => {
    const m = Math.floor(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
  };

  let s = G.newState(Date.now(), randomSeed());
  let lastTick = Date.now();
  let lastSave = 0;
  let shownEv = 0;
  let overlayCleanup = null;
  let freeGame = null;
  let budgetGame = null;
  const modules = [];
  const newsShown = new Set();

  function banner(text) { $('banner').textContent = text; }

  function eventText(e) {
    const v = { ...e.v };
    if (v.id) v.name = tr(`proc.${v.id}`);
    if (v.sub) v.subname = tr(`sub.${v.sub}`);
    if (v.key) v.name = v.key.startsWith('det:') ? tr(`sub.${v.key.slice(4)}`) : tr(`proj.name.${v.key}`);
    if (e.k === 'fev') return tr(`fev.${v.id}`, { amt: fmt(v.amt), sign: v.sign });
    return tr(`ev.${e.k}`, v);
  }

  function flushEvents() {
    const fresh = s.events.filter((e) => e.n > shownEv);
    if (!fresh.length) return;
    banner(eventText(fresh[fresh.length - 1]));
    shownEv = s.evN;
  }

  function save() {
    s = { ...s, last: Date.now() };
    store.set(G.serialize(s));
    lastSave = Date.now();
  }

  function resume() {
    const r = G.load(store.get(), Date.now(), randomSeed());
    s = r.state;
    lastTick = Date.now();
    shownEv = s.evN;
    if (r.away >= AWAY_BANNER_MIN_S) banner(tr('banner.away', { t: fmtAway(r.away) }));
  }

  // --- overlay (con tasto Indietro di Android) -------------------------------
  let backTimer = 0;
  function closeOverlay(silent) {
    if ($('overlay').hidden) return;
    if (overlayCleanup) overlayCleanup();
    overlayCleanup = null;
    $('overlay-body').replaceChildren();
    $('overlay').hidden = true;
    document.body.classList.remove('modal');
    if (silent) return;
    // la voce di cronologia si toglie solo se nessun altro popup si apre subito (altrimenti la riusa showOverlay)
    clearTimeout(backTimer);
    backTimer = setTimeout(() => { if ($('overlay').hidden && history.state && history.state.overlay) history.back(); }, 0);
  }

  // build(body) costruisce il contenuto e può restituire una funzione di pulizia.
  function showOverlay(build) {
    clearTimeout(backTimer);
    closeOverlay(true);
    const body = $('overlay-body');
    body.replaceChildren();
    overlayCleanup = build(body) || null;
    $('overlay').hidden = false;
    document.body.classList.add('modal');
    if (history.state && history.state.overlay) history.replaceState({ overlay: true }, '');
    else history.pushState({ overlay: true }, '');
  }

  window.addEventListener('popstate', () => closeOverlay(true));

  function openHelp() {
    showOverlay((body) => {
      body.append(el('h2', null, tr('help.title')));
      for (let i = 1; i <= HELP_PAGES; i++) body.append(el('p', null, tr(`help.p${i}`)));
      let armedAt = 0;
      const reset = button(tr('help.reset'), () => {
        if (Date.now() - armedAt > ARM_MS) { armedAt = Date.now(); reset.textContent = tr('help.reset.armed'); return; }
        store.clear();
        s = G.newState(Date.now(), randomSeed());
        shownEv = 0;
        closeOverlay();
        banner('');
        render();
      });
      const row = el('div', 'row');
      row.append(button(tr('help.close'), () => closeOverlay()), reset);
      body.append(row);
    });
  }

  // --- schede ----------------------------------------------------------------
  // Fondi dalle sfide: una al giorno (seed = data) oppure libere a intervalli.
  function claimReward(source, score, seed) {
    if (!(score > 0)) return tr('reward.none');
    const key = /^\d{4}-\d{2}-\d{2}$/.test(seed) ? seed : 'free';
    if (!G.canClaim(s, source, key)) return tr('reward.wait');
    const before = G.totalFunds(s);
    update((st) => G.claimFunds(st, source, score, key));
    return tr('reward.gain', { gain: fmt(G.totalFunds(s) - before) });
  }

  function ensureFree() {
    if (freeGame) return;
    // si parte da una partita libera (forma casuale ogni volta); la sfida del giorno è sempre la stessa, quindi è un'alternativa
    const mount = (seed, label) => {
      if (freeGame) freeGame.destroy();
      const daily = seed === utcDay();
      freeGame = Minigame.create($('play-host'), {
        seed, label, shareLabel: tr('share.btn'),
        onNew: () => mount(randomSeed(), tr('mode.free')),
        onAlt: daily ? () => mount(randomSeed(), tr('mode.free')) : () => mount(utcDay(), tr('mode.daily')),
        altLabel: daily ? tr('mode.free') : tr('mode.daily'),
        onFinish: (r) => claimReward('shape', r.score, seed),
      });
    };
    mount(randomSeed(), tr('mode.free'));
  }

  function ensureBudget() {
    if (budgetGame || !G.unlockedBudget(s)) return;
    const mount = (seed, label) => {
      if (budgetGame) budgetGame.destroy();
      budgetGame = BudgetUI.create($('budget-host'), {
        seed, label,
        onNew: () => mount(randomSeed(), tr('mode.freescenario')),
        onPublish: (resId, pts) => {
          update((st) => G.recordBudget(st, resId, pts));
          return claimReward('budget', pts, seed);
        },
      });
    };
    mount(utcDay(), tr('mode.daily'));
  }

  function showTab(name) {
    document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === name)));
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${name}`; });
    if (name === 'play') ensureFree();
    if (name === 'budget') ensureBudget();
    window.dispatchEvent(new Event('resize'));
  }

  // --- ciclo -----------------------------------------------------------------
  function render() {
    $('hud-funds').textContent = fmt(s.pools.rnd);
    $('hud-year').textContent = s.t.toFixed(1);
    const e = PH.energy(s);
    $('hud-energy').textContent = e >= 1000 ? `${(e / 1000).toFixed(1)} TeV` : `${fmt(e)} GeV`;
    $('hud-rep').textContent = G.repTotal(s).toFixed(1);
    const open = G.unlockedBudget(s);
    $('budget-lock').hidden = open;
    $('budget-host').hidden = !open;
    flushEvents();
    const pending = s.pending[0];
    if (pending && $('overlay').hidden && !newsShown.has(pending.id)) { newsShown.add(pending.id); Popups.news(pending.id); }
    for (const m of modules) m.render(s);
  }

  function update(fn) {
    s = fn(s);
    render();
  }

  window.UI = {
    tr, el, button, fmt, fmtYears, randomSeed, utcDay, banner, showOverlay, closeOverlay, showTab,
    get: () => s,
    update,
    register: (m) => modules.push(m),
  };

  function boot() {
    I18n.apply();
    document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.view)));
    $('lang').addEventListener('click', () => { I18n.setLang(I18n.otherLang()); save(); location.reload(); });
    $('help').addEventListener('click', openHelp);
    $('hud-dev').addEventListener('click', () => Popups.budget());
    document.querySelectorAll('[data-icon]').forEach((e) => e.append(SVG.iconSvg(e.dataset.icon, 22)));
    for (const m of modules) if (m.init) m.init();
    resume();
    if (!s.tutorial) { s = { ...s, tutorial: true }; openHelp(); }
    render();
    setInterval(() => {
      const now = Date.now();
      s = G.tick(s, Math.min((now - lastTick) / 1000, MAX_DT_S));
      lastTick = now;
      if (now - lastSave > SAVE_EVERY_MS) save();
      render();
    }, TICK_MS);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { resume(); render(); } });
    window.addEventListener('pagehide', save);
    // Il service worker serve solo alla versione web; nell'APK i file sono locali.
    if ('serviceWorker' in navigator && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.addEventListener('load', boot);
})();
