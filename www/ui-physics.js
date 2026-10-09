// Scheda Fisica: bersagli, presa dati, istogramma, trigger, analisi e conferma.
// Gli elementi si aggiornano sul posto (nessuna ricostruzione del DOM interattivo). Testo sempre via textContent.
(() => {
  'use strict';
  const G = Game;
  const PH = Physics;
  const PR = Processes;
  const { tr, el, button, fmt, fmtYears, update, get, randomSeed } = UI;

  const STRATS = Object.keys(PH.STRATEGIES);
  const sel = { strategy: 'bump', blind: true, valid: true };
  const cards = new Map();
  const stratBtns = new Map();
  let curId = null;
  let view = null;
  let dragging = false;
  const w = {}; // elementi del pannello

  const slider = (max, onInput) => {
    const i = el('input');
    i.type = 'range';
    i.min = '0';
    i.max = String(max);
    i.step = '5';
    i.addEventListener('input', onInput);
    i.addEventListener('pointerdown', () => { dragging = true; });
    i.addEventListener('pointerup', () => { dragging = false; });
    i.addEventListener('pointercancel', () => { dragging = false; });
    return i;
  };

  function sendCfg() {
    const id = curId;
    if (!id) return;
    update((s) => G.setCfg(s, id, { trig: Number(w.trigIn.value) / 100, cut: Number(w.cutIn.value) / 100 }));
  }

  function openConfirm() {
    const id = curId;
    const p = PR.BY_ID.get(id);
    if (!p) return;
    const tier = PR.TIERS[p.tier];
    UI.showOverlay((body) => {
      const game = Minigame.create(body, {
        seed: randomSeed(), pool: tier.pool, maxLaunches: tier.maxLaunches,
        label: tr('overlay.confirm', { name: tr(`proc.${id}`) }),
        onCancel: () => UI.closeOverlay(),
        onClose: (r) => { UI.closeOverlay(); update((s) => G.confirmDiscovery(s, id, r.score)); },
      });
      return () => game.destroy();
    });
  }

  function init() {
    const host = document.getElementById('physics-host');
    const list = el('div', 'targets');
    for (const p of PR.PROCESSES) {
      const b = button('', () => { view = p.id; update((s) => G.select(s, p.id)); });
      b.className = 'card target';
      const name = el('strong');
      const tag = el('span', 'tag');
      b.append(name, tag);
      list.append(b);
      cards.set(p.id, { b, name, tag });
    }
    w.finale = el('div', 'card');
    w.finale.hidden = true;
    w.finaleTitle = el('h2');
    w.finaleText = el('p');
    w.finale.append(w.finaleTitle, w.finaleText);

    w.panel = el('div', 'panel');
    w.title = el('h2');
    w.kind = el('p', 'muted');
    w.hint = el('p', 'muted');
    w.reqs = el('ul', 'req');
    w.stat = el('p', 'stat');
    w.note = el('p', 'muted');
    w.rival = el('p', 'muted');
    w.runBtn = button(tr('act.run'), () => Popups.run());
    w.runBtn.className = 'primary';
    w.runBtn.prepend(SVG.iconSvg('play', 18));
    w.hist = el('canvas', 'hist');
    w.hist.width = 480;
    w.hist.height = 220;

    w.ctl = el('div', 'card');
    w.trigLab = el('small');
    w.trigIn = slider(90, sendCfg);
    w.cutLab = el('small');
    w.cutIn = slider(120, sendCfg);
    w.trigInfo = el('small', 'muted');
    w.tune = button(tr('physics.tune'), () => { const id = curId; if (id) update((s) => G.autotuneCfg(s, id)); });
    w.ctl.append(w.trigLab, w.trigIn, w.cutLab, w.cutIn, w.trigInfo, w.tune);

    w.an = el('div', 'card');
    const stratRow = el('div', 'chips');
    for (const st of STRATS) {
      const b = button(tr(`an.strategy.${st}`), () => { sel.strategy = st; render(get()); });
      b.className = 'chip';
      stratRow.append(b);
      stratBtns.set(st, b);
    }
    w.stratDesc = el('small', 'muted');
    w.blind = button(tr('an.opt.blind'), () => { sel.blind = !sel.blind; render(get()); });
    w.valid = button(tr('an.opt.valid'), () => { sel.valid = !sel.valid; render(get()); });
    w.blind.className = 'chip';
    w.valid.className = 'chip';
    w.estimate = el('small', 'muted');
    w.start = button(tr('an.start'), () => {
      const id = curId;
      if (id) update((s) => G.startAnalysis(s, id, sel.strategy, { blind: sel.blind, valid: sel.valid }));
    });
    w.start.className = 'primary';
    w.an.append(el('h3', null, tr('an.title')), stratRow, w.stratDesc, w.blind, w.valid, w.estimate, w.start);

    w.job = el('div', 'card');
    w.jobText = el('p');
    w.jobBar = el('progress');
    w.jobBar.max = 1;
    w.jobRounds = el('small', 'muted');
    w.confirm = button(tr('an.confirm'), openConfirm);
    w.confirm.className = 'primary';
    w.job.append(w.jobText, w.jobBar, w.jobRounds, w.confirm);

    w.done = el('div', 'card');
    w.doneText = el('p');
    w.done.append(w.doneText);

    w.panel.append(w.title, w.kind, w.hint, w.reqs, w.stat, w.note, w.rival, w.runBtn, w.hist, w.ctl, w.an, w.job, w.done);
    w.pickNote = el('p', 'muted', tr('physics.pick'));
    host.append(list, w.pickNote, w.finale, w.panel);
  }

  function drawHist(h) {
    const c = w.hist.getContext('2d');
    const W = w.hist.width;
    const H = w.hist.height;
    c.fillStyle = '#0b1220';
    c.fillRect(0, 0, W, H);
    if (!h.ok) return;
    const n = h.observed.length;
    const max = Math.max(1, ...h.observed, ...h.expB.map((b, i) => b + h.expS[i])) * 1.15;
    const bw = W / n;
    const y = (v) => H - 6 - (v / max) * (H - 12);
    c.fillStyle = '#38bdf8';
    h.observed.forEach((v, i) => c.fillRect(i * bw + 1, y(v), bw - 2, H - 6 - y(v)));
    c.strokeStyle = '#f87171';
    c.lineWidth = 2;
    c.beginPath();
    h.expB.forEach((v, i) => (i ? c.lineTo((i + 0.5) * bw, y(v)) : c.moveTo(0.5 * bw, y(v))));
    c.stroke();
  }

  function stateKey(s, p) {
    const d = s.done[p.id];
    if (d) return d.limit ? 'state.limit' : d.scooped ? 'state.scooped' : 'state.done';
    if (!G.isAvail(s, p.id)) return 'state.locked';
    const j = s.jobs[p.id];
    if (j) return j.state === 'confirm' ? 'state.confirm' : 'state.analysis';
    return s.program === p.id ? 'state.running' : 'state.available';
  }

  function render(s) {
    curId = view && PR.BY_ID.has(view) ? view : s.program;
    for (const p of PR.PROCESSES) {
      const c = cards.get(p.id);
      c.name.textContent = tr(`proc.${p.id}`);
      c.tag.textContent = tr(stateKey(s, p));
      c.b.disabled = !G.isAvail(s, p.id) && !(p.id in s.done);
      c.b.classList.toggle('sel', p.id === curId);
    }
    w.finale.hidden = !G.isComplete(s);
    if (G.isComplete(s)) {
      const st = G.stats(s);
      w.finaleTitle.textContent = tr('finale.title');
      w.finaleText.textContent = tr('finale.text', { years: st.years.toFixed(1), pub: st.published, scooped: st.scooped, limits: st.limits });
    }

    const p = curId ? PR.BY_ID.get(curId) : null;
    w.panel.hidden = !p;
    w.pickNote.hidden = !!p;
    if (!p) return;
    const id = p.id;
    const d = s.done[id];
    const j = s.jobs[id];
    const L = G.dataOf(s, id);
    const cfg = G.cfgOf(s, id);
    const e = PH.evaluate(s, p, cfg, L, sel.valid ? PH.SYST_VALID : 1);

    w.title.textContent = tr(`proc.${id}`);
    w.kind.textContent = tr(`kind.${p.kind}`);
    w.hint.textContent = tr(`hint.${p.type}`);

    w.reqs.replaceChildren();
    const addReq = (ok, text) => w.reqs.append(el('li', ok ? 'ok' : 'bad', `${ok ? '✔' : '✖'} ${text}`));
    addReq(G.energyOk(s, id), tr('req.energy', { need: fmt(p.thr[s.collider]), now: fmt(PH.energy(s)) }));
    for (const [k, lvl] of Object.entries(p.need)) addReq(s.det[k] >= lvl, tr('req.sub', { name: tr(`sub.${k}`), need: lvl, now: s.det[k] }));

    const stat = [tr('physics.data', { L: fmt(L) })];
    if (e.ok) {
      stat.push(p.kind === 'measure'
        ? tr('physics.sigma', { p: Number.isFinite(e.sigma) ? Math.round(e.sigma * 100) : '∞', g: Math.round(p.goal * 100) })
        : tr('physics.z', { z: e.z.toFixed(1) }));
    }
    w.stat.textContent = stat.join(' · ');
    w.note.textContent = d ? '' : s.program !== id ? tr('physics.idle') : !G.canRun(s, id) ? tr('physics.nodata') : !s.run ? tr('physics.norun') : '';
    w.runBtn.hidden = !!d || !G.isAvail(s, id);

    const f = G.rivalFraction(s, id);
    w.rival.hidden = !!d || !G.isAvail(s, id);
    w.rival.textContent = tr(f < 0.5 ? 'an.rival.low' : f < 0.85 ? 'an.rival.mid' : f < 1 ? 'an.rival.high' : 'an.rival.done');

    w.hist.hidden = !!d;
    if (!d) drawHist(PH.histogram(s, p, cfg, L));

    w.ctl.hidden = !!d;
    if (!d) {
      w.trigLab.textContent = tr('physics.trig', { v: cfg.trig.toFixed(2) });
      w.cutLab.textContent = tr('physics.cut', { v: cfg.cut.toFixed(2) });
      if (!dragging) { w.trigIn.value = String(Math.round(cfg.trig * 100)); w.cutIn.value = String(Math.round(cfg.cut * 100)); }
      w.trigInfo.textContent = e.ok ? tr('physics.trigload', { kept: Math.round(e.tg.loss * 100), rate: fmt(e.tg.rate), bw: fmt(e.tg.bandwidth) }) : '';
    }

    w.an.hidden = !!d || !!j;
    if (!d && !j) {
      for (const [st, b] of stratBtns) b.setAttribute('aria-pressed', String(st === sel.strategy));
      w.stratDesc.textContent = tr(`an.strategy.${sel.strategy}.desc`);
      w.blind.setAttribute('aria-pressed', String(sel.blind));
      w.valid.setAttribute('aria-pressed', String(sel.valid));
      const pl = PH.plan(sel.strategy, { blind: sel.blind, valid: sel.valid }, p);
      const cost = G.analysisCost(p, sel.strategy, { blind: sel.blind, valid: sel.valid });
      w.estimate.textContent = L > 0 && e.ok
        ? `${tr('an.estimate', { min: fmtYears(pl.years), risk: Math.round(pl.prob * 100) })} · ${tr('an.cost', { cost: fmt(cost), have: fmt(s.pools.analysis) })}`
        : tr('an.nodata');
      w.start.disabled = !(L > 0 && e.ok) || s.pools.analysis < cost;
    }

    w.job.hidden = !j;
    if (j) {
      const running = j.state === 'run';
      w.jobText.textContent = running ? tr('an.running', { strategy: tr(`an.strategy.${j.strategy}`) }) : tr('an.confirm.hint');
      w.jobBar.hidden = !running;
      if (running) w.jobBar.value = Math.min(1, Math.max(0, (s.t - j.start) / (j.end - j.start)));
      w.jobRounds.textContent = tr('an.rounds', { n: j.rounds });
      w.confirm.hidden = running;
    }

    w.done.hidden = !d;
    if (d) {
      const main = d.limit ? tr('done.limit') : p.kind === 'measure' ? tr('done.measure', { p: Math.round(d.sigma * 100) }) : tr('done.discovery', { z: d.z.toFixed(1) });
      w.doneText.textContent = d.scooped ? `${main} ${tr('done.scooped')}` : main;
    }
  }

  UI.register({ init, render });
})();
