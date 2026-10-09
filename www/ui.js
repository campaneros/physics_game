// UI dell'idle game. Tutto il testo dinamico passa da textContent: nessun innerHTML.
(() => {
  'use strict';
  const I = Idle;

  const SAVE_KEY = 'accel-save-v1';
  const TICK_MS = 250;
  const MAX_DT_S = 2;
  const SAVE_EVERY_MS = 5000;
  const ARM_MS = 3000;
  const AWAY_BANNER_MIN_S = 60;

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const store = {
    get() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } },
    set(t) { try { localStorage.setItem(SAVE_KEY, t); } catch (e) { /* storage non disponibile */ } },
  };
  const randomSeed = () => {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return `free-${a[0].toString(36)}${a[1].toString(36)}`;
  };
  const utcDay = () => new Date().toISOString().slice(0, 10);
  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
  };

  let s = I.newState();
  let lastTick = Date.now();
  let lastSave = 0;
  let overlayGame = null;
  let freeGame = null;
  let budgetGame = null;
  let armedAt = 0;

  function save() {
    s = { ...s, last: Date.now() };
    store.set(I.serialize(s));
    lastSave = Date.now();
  }

  function banner(text) { $('banner').textContent = text; }

  function resume() {
    const { state, away } = I.load(store.get(), Date.now());
    s = state;
    lastTick = Date.now();
    if (away >= AWAY_BANNER_MIN_S) banner(`Bentornato! ${fmtTime(away)} di dati accreditati mentre eri via.`);
  }

  // --- costruzione dei blocchi dinamici (una volta sola) ---------------------
  const upgradeRefs = new Map();
  for (const u of I.UPGRADES) {
    const btn = el('button', 'card upgrade');
    btn.type = 'button';
    const name = el('strong');
    const desc = el('small', null, u.desc);
    const cost = el('span', 'cost');
    btn.append(name, desc, cost);
    btn.addEventListener('click', () => { s = I.buy(s, u.id); render(); });
    $('upgrades').append(btn);
    upgradeRefs.set(u.id, { btn, name, cost });
  }

  const discRefs = new Map();
  for (const d of I.DISCOVERIES) {
    const li = el('li');
    const name = el('span', null, d.name);
    const state = el('span', 'state');
    li.append(name, state);
    $('disc-list').append(li);
    discRefs.set(d.id, { li, state });
  }

  const shutdownBtn = $('shutdown');
  shutdownBtn.addEventListener('click', () => {
    if (!I.canShutdown(s)) return;
    const now = Date.now();
    if (now - armedAt > ARM_MS) { armedAt = now; render(); return; }
    armedAt = 0;
    s = I.shutdown(s);
    save();
    banner('Long Shutdown completato: produzione permanente aumentata.');
    render();
  });

  $('confirm').addEventListener('click', openConfirm);

  // --- render ----------------------------------------------------------------
  function render() {
    $('dati').textContent = I.fmt(s.dati);
    $('rate').textContent = `${I.fmt(I.rate(s))}/s`;
    $('energy').textContent = `${I.fmt(I.energy(s))} GeV`;
    $('mult').textContent = `×${I.multiplier(s).toFixed(2)}`;

    for (const u of I.UPGRADES) {
      const r = upgradeRefs.get(u.id);
      r.name.textContent = `${u.name} · liv. ${s.levels[u.id]}`;
      r.cost.textContent = `${I.fmt(I.cost(s, u.id))} dati`;
      r.btn.disabled = s.dati < I.cost(s, u.id);
    }

    const t = I.target(s);
    $('target').hidden = !t;
    if (t) {
      $('target-name').textContent = t.name;
      const gated = I.energy(s) < t.gev;
      $('target-info').textContent = gated
        ? `Servono ${t.gev} GeV · ora ${I.fmt(I.energy(s))} GeV. Potenzia i magneti.`
        : `Raccolta segnale: ${I.fmt(s.signal)} / ${I.fmt(t.need)} eventi`;
      const bar = $('target-bar');
      bar.max = t.need;
      bar.value = s.signal;
      $('confirm').hidden = !s.pending;
      if (s.pending) $('target-info').textContent = 'Segnale sufficiente! Conferma la scoperta.';
    }
    $('all-done').hidden = !!t;

    for (const d of I.DISCOVERIES) {
      const r = discRefs.get(d.id);
      const got = s.discovered[d.id];
      r.state.textContent = got ? `✔ ×${got.toFixed(2)}` : t && t.id === d.id ? 'in corso' : `${d.gev} GeV`;
      r.li.className = got ? 'got' : t && t.id === d.id ? 'now' : 'locked';
    }

    const can = I.canShutdown(s);
    const armed = Date.now() - armedAt <= ARM_MS;
    shutdownBtn.disabled = !can;
    shutdownBtn.textContent = !can
      ? `Long Shutdown (servono ${I.SHUTDOWN_MIN_DISCOVERIES} scoperte)`
      : armed ? 'Tocca ancora per confermare' : `Long Shutdown (fatti: ${s.shutdowns})`;
    $('budget-lock').hidden = s.shutdowns > 0;
    $('budget-host').hidden = s.shutdowns < 1;
    $('budget').textContent = s.shutdowns > 0
      ? 'Modalità budget: sbloccata, la trovi nella scheda Budget.'
      : 'Modalità budget: si sblocca dopo il primo Long Shutdown.';
  }

  // --- conferma scoperta (minigioco in overlay) ------------------------------
  function closeOverlay() {
    if (overlayGame) overlayGame.destroy();
    overlayGame = null;
    $('overlay').hidden = true;
  }

  function openConfirm() {
    const t = I.target(s);
    if (!t || !s.pending || overlayGame) return;
    const tier = I.TIERS[t.tier];
    $('overlay').hidden = false;
    overlayGame = Minigame.create($('overlay-body'), {
      seed: randomSeed(),
      pool: tier.pool,
      maxLaunches: tier.maxLaunches,
      label: `Conferma: ${t.name}`,
      onCancel: closeOverlay,
      onClose: (result) => {
        closeOverlay();
        s = I.confirm(s, result.score);
        save();
        banner(result.score > 0
          ? `${t.name} confermato! Produzione ×${(1 + result.score / 100).toFixed(2)}.`
          : 'Conferma fallita: serve nuovo segnale (metà conservato).');
        render();
      },
    });
  }

  // --- sfida libera / giornaliera --------------------------------------------
  function mountFree(seed, label) {
    if (freeGame) freeGame.destroy();
    freeGame = Minigame.create($('play-host'), {
      seed, label, shareLabel: 'Condividi',
      onNew: () => mountFree(randomSeed(), 'Partita libera'),
    });
  }

  // --- modalità budget (sbloccata dal primo Long Shutdown) ---------------------
  function mountBudget(seed, label) {
    if (budgetGame) budgetGame.destroy();
    budgetGame = BudgetUI.create($('budget-host'), {
      seed, label, onNew: () => mountBudget(randomSeed(), 'Scenario libero'),
    });
  }

  // --- tab -------------------------------------------------------------------
  const tabs = document.querySelectorAll('#tabs button');
  tabs.forEach((btn) => btn.addEventListener('click', () => {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${btn.dataset.view}`; });
    if (btn.dataset.view === 'play' && !freeGame) mountFree(utcDay(), 'Sfida del giorno');
    if (btn.dataset.view === 'budget' && s.shutdowns > 0 && !budgetGame) mountBudget(utcDay(), 'Sfida del giorno');
    window.dispatchEvent(new Event('resize'));
  }));

  // --- ciclo -----------------------------------------------------------------
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { resume(); render(); } });
  window.addEventListener('pagehide', save);

  resume();
  render();
  setInterval(() => {
    const now = Date.now();
    s = I.tick(s, Math.min((now - lastTick) / 1000, MAX_DT_S));
    lastTick = now;
    if (now - lastSave > SAVE_EVERY_MS) save();
    render();
  }, TICK_MS);

  // Il service worker serve solo alla versione web; nell'APK i file sono locali.
  if ('serviceWorker' in navigator && !window.Capacitor) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
