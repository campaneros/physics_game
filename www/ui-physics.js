// Scheda Fisica: bersagli, presa dati, istogramma, trigger, analisi e conferma.
// Gli elementi si aggiornano sul posto (nessuna ricostruzione del DOM interattivo). Testo sempre via textContent.
(() => {
  'use strict';
  const G = Game;
  const PH = Physics;
  const PR = Processes;
  const { tr, el, button, fmt, fmtYears, update, get, randomSeed } = UI;

  const STRATS = Object.keys(PH.STRATEGIES);
  const sel = { strategy: 'bump', blind: true, valid: true, cuts: {}, lastCut: null };
  const cards = new Map();
  const stratBtns = new Map();
  let curId = null;
  let showDone = false;
  let showLocked = false;
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
    w.listActive = el('div', 'targets');
    w.listDone = el('div', 'targets wrap');
    w.listLocked = el('div', 'targets wrap');
    for (const p of PR.PROCESSES) {
      // toccare un bersaglio lo mostra; entra da solo nella presa dati solo se non ce n'è nessuno (poi si usa Aggiungi/Togli)
      const b = button('', () => { view = p.id; if (G.programsOf(get()).length) render(get()); else update((s) => G.select(s, p.id)); });
      b.className = 'card target';
      const name = el('strong');
      const tag = el('span', 'tag');
      b.append(name, tag);
      w.listLocked.append(b);
      cards.set(p.id, { b, name, tag, group: 'locked' });
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
    w.histCap = el('small', 'muted');
    w.legend = el('div', 'legend');
    for (const [cls, key] of [['sw-obs', 'hist.obs'], ['sw-bkg', 'hist.bkg'], ['sw-sig', 'hist.sig']]) {
      const it = el('span', 'lg');
      it.append(el('i', `sw ${cls}`), document.createTextNode(tr(key)));
      w.legend.append(it);
      if (cls === 'sw-sig') w.sigLegend = it;
    }
    w.toggle = button('', () => { const id = curId; if (id) update((s) => G.toggleProgram(s, id)); });
    w.slotNote = el('small', 'muted');
    w.detBox = el('div', 'card');
    w.detRows = el('div', 'cards');
    w.detEff = el('small', 'muted');
    w.detBox.append(el('h3', null, tr('physics.detector')), w.detRows, w.detEff);

    w.ctl = el('div', 'card');
    w.trigLab = el('small');
    w.trigIn = slider(90, sendCfg);
    w.cutLab = el('small');
    w.cutIn = slider(120, sendCfg);
    w.trigInfo = el('small', 'muted');
    w.trigDesc = el('small', 'muted', tr('physics.trig.desc'));
    w.cutDesc = el('small', 'muted', tr('physics.cut.desc'));
    w.tune = button(tr('physics.tune'), () => { const id = curId; if (id) update((s) => G.autotuneCfg(s, id)); });
    const meter = (key, cls) => {
      const row = el('div', 'meter');
      const lab = el('small', null, tr(key));
      const val = el('small', 'muted');
      const track = el('div', `bar thin ${cls}`);
      const fill = el('i');
      track.append(fill);
      row.append(lab, track, val);
      return { row, fill, val };
    };
    w.mSig = meter('physics.m.sig', 'm-sig');
    w.mBkg = meter('physics.m.bkg', 'm-bkg');
    w.mPur = meter('physics.m.pur', 'm-pur');
    w.mBw = meter('physics.m.bw', 'm-bw');
    w.ctl.append(el('h3', null, tr('physics.trigger.title')), w.trigLab, w.trigIn, w.trigDesc, w.cutLab, w.cutIn, w.cutDesc, w.mSig.row, w.mBkg.row, w.mPur.row, w.mBw.row, w.trigInfo, w.tune);

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
    w.tutorial = el('small', 'tutorial');
    w.menuHint = el('small', 'muted');
    w.cutsRow = el('div', 'chips');
    w.cutBtns = new Map();
    for (const c of PR.CUTS) {
      const b = button(tr(`cut.${c}`), () => {
        const id = curId;
        if (!id) return;
        const cur = sel.cuts[id] || [];
        sel.lastCut = c;
        sel.cuts[id] = cur.includes(c) ? cur.filter((x) => x !== c) : cur.length < PR.MAX_CUTS ? [...cur, c] : cur;
        render(get());
      });
      b.className = 'chip';
      w.cutsRow.append(b);
      w.cutBtns.set(c, b);
    }
    w.cutInfo = el('small', 'muted');
    w.estimate = el('small', 'muted');
    w.start = button(tr('an.start'), () => {
      const id = curId;
      if (id) update((s) => G.startAnalysis(s, id, sel.strategy, { blind: sel.blind, valid: sel.valid }, sel.cuts[id] || []));
    });
    w.start.className = 'primary';
    w.anFund = button('', () => Popups.budget());
    w.anFund.className = 'fund-chip';
    w.anFund.append(SVG.iconSvg('search', 16));
    w.anFundVal = el('b');
    w.anFund.append(w.anFundVal);
    const anHead = el('div', 'foot');
    anHead.append(el('h3', null, tr('an.title')), w.anFund);
    w.an.append(anHead, el('small', 'muted', tr('an.explain')), w.tutorial, stratRow, w.stratDesc, el('h3', null, tr('an.cuts.title')), w.menuHint, w.cutsRow, w.cutInfo, w.blind, w.valid, w.estimate, w.start);

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

    w.panel.append(w.title, w.kind, w.hint, w.reqs, w.detBox, w.toggle, w.slotNote, w.stat, w.note, w.rival, w.runBtn, w.histCap, w.hist, w.legend, w.ctl, w.an, w.job, w.done);
    w.pickNote = el('p', 'muted', tr('physics.pick'));
    w.toggleDone = button('', () => { showDone = !showDone; render(get()); });
    w.toggleLocked = button('', () => { showLocked = !showLocked; render(get()); });
    w.toggleDone.className = 'fold';
    w.toggleLocked.className = 'fold';
    host.append(w.listActive, w.toggleDone, w.listDone, w.toggleLocked, w.listLocked, w.pickNote, w.finale, w.panel);
  }

  function drawHist(h, reveal) {
    const c = w.hist.getContext('2d');
    const W = w.hist.width;
    const H = w.hist.height;
    c.fillStyle = '#0b1220';
    c.fillRect(0, 0, W, H);
    if (!h.ok) return;
    const n = h.observed.length;
    const tot = h.expB.map((b, i) => b + h.expS[i]);
    const max = Math.max(1, ...h.observed, ...tot) * 1.15;
    const bw = W / n;
    const y = (v) => H - 18 - (v / max) * (H - 28);
    c.fillStyle = '#38bdf8';
    h.observed.forEach((v, i) => c.fillRect(i * bw + 1, y(v), bw - 2, H - 18 - y(v)));
    const line = (arr, color) => {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      arr.forEach((v, i) => (i ? c.lineTo((i + 0.5) * bw, y(v)) : c.moveTo(0.5 * bw, y(v))));
      c.stroke();
    };
    line(h.expB, '#f87171');
    if (reveal.signal) line(tot, '#4ade80');
    if (reveal.peak) {
      c.strokeStyle = '#64748b';
      c.setLineDash([4, 4]);
      c.beginPath();
      c.moveTo(W / 2, 4);
      c.lineTo(W / 2, H - 18);
      c.stroke();
      c.setLineDash([]);
    }
    c.fillStyle = '#94a3c0';
    c.font = '12px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(tr(reveal.peak ? 'hist.axis' : 'hist.axis.plain'), W / 2, H - 4);
  }

  function stateKey(s, p) {
    const d = s.done[p.id];
    if (d) return d.limit ? 'state.limit' : d.scooped ? 'state.scooped' : 'state.done';
    if (!G.isAvail(s, p.id)) return 'state.locked';
    const j = s.jobs[p.id];
    if (j) return j.state === 'confirm' ? 'state.confirm' : 'state.analysis';
    return G.programsOf(s).includes(p.id) ? 'state.running' : 'state.available';
  }

  function render(s) {
    curId = view && PR.BY_ID.has(view) ? view : s.program;
    for (const p of PR.PROCESSES) {
      const c = cards.get(p.id);
      // i bersagli stanno nel gruppo giusto: disponibili (in vista), completati e bloccati (ripiegabili)
      const group = p.id in s.done ? 'done' : G.isAvail(s, p.id) ? 'active' : 'locked';
      if (c.group !== group) { ({ active: w.listActive, done: w.listDone, locked: w.listLocked })[group].append(c.b); c.group = group; }
      c.name.textContent = tr(`proc.${p.id}`);
      c.tag.textContent = tr(stateKey(s, p));
      c.b.disabled = !G.isAvail(s, p.id) && !(p.id in s.done);
      c.b.classList.toggle('sel', p.id === curId);
    }
    const nDone = Object.keys(s.done).length;
    const nLocked = PR.PROCESSES.filter((p) => !(p.id in s.done) && !G.isAvail(s, p.id)).length;
    w.toggleDone.hidden = nDone === 0;
    w.toggleDone.textContent = `${showDone ? '▾' : '▸'} ${tr('physics.done.count', { n: nDone, total: PR.PROCESSES.length })}`;
    w.listDone.hidden = !showDone || nDone === 0;
    w.toggleLocked.hidden = nLocked === 0;
    w.toggleLocked.textContent = `${showLocked ? '▾' : '▸'} ${tr('physics.locked.count', { n: nLocked })}`;
    w.listLocked.hidden = !showLocked || nLocked === 0;
    w.listActive.hidden = !w.listActive.children.length;
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
    if (d) stat.push(p.kind === 'measure' ? tr('physics.sigma', { p: Math.round(d.sigma * 100), g: Math.round(p.goal * 100) }) : tr('physics.z', { z: d.z.toFixed(1) }));
    w.stat.textContent = stat.join(' · ');
    w.note.textContent = d ? '' : s.program !== id ? tr('physics.idle') : !G.canRun(s, id) ? tr('physics.nodata') : !s.run ? tr('physics.norun') : '';
    w.runBtn.hidden = !!d || !G.isAvail(s, id);

    const f = G.rivalFraction(s, id);
    w.rival.hidden = !!d || !G.isAvail(s, id);
    w.rival.textContent = tr(f < 0.5 ? 'an.rival.low' : f < 0.85 ? 'an.rival.mid' : f < 1 ? 'an.rival.high' : 'an.rival.done');

    const frozen = d && d.snap;
    w.hist.hidden = !!d && !frozen;
    w.legend.hidden = w.hist.hidden;
    w.histCap.hidden = w.hist.hidden;
    w.histCap.textContent = frozen ? tr('hist.final', { L: fmt(d.snap.L) }) : tr('hist.live');
    w.sigLegend.hidden = !frozen;
    if (frozen) drawHist(PH.histogram(s, p, d.snap.cfg, d.snap.L), { signal: true, peak: true });
    else if (!d) drawHist(PH.histogram(s, p, cfg, L), { signal: false, peak: p.tier === 0 });

    // contributo dei sottosistemi: ogni livello in più migliora efficienza e risoluzione
    w.detBox.hidden = !!d;
    if (!d) {
      w.detRows.replaceChildren();
      for (const [k, wk] of Object.entries(PH.relevant(p))) {
        const need = p.need[k] || 0;
        const row = el('div', 'req-row');
        const pips = el('span', 'pips');
        for (let i = 0; i < PR.DETECTOR.maxLevel; i++) pips.append(el('i', i < s.det[k] ? 'on' : i < need ? 'next' : ''));
        const role = need ? (s.det[k] >= need ? tr('physics.role.ok', { n: need }) : tr('physics.role.need', { n: need })) : tr('physics.role.help');
        row.append(SVG.iconSvg(k, 18), el('strong', null, tr(`sub.${k}`)), pips, el('small', 'muted', role));
        w.detRows.append(row);
      }
      w.detEff.textContent = e.ok ? tr('physics.deteff', { eff: Math.round(e.d.eff * 100), res: (e.d.res * 100).toFixed(1), xs: e.xs.toFixed(2) }) : '';
    }

    // misure in parallelo (adroni) e pulsante per aggiungere/togliere questo bersaglio
    const ids = G.programsOf(s);
    const inList = ids.includes(id);
    const maxSlots = PH.slots(s);
    w.toggle.hidden = !!d || !G.isAvail(s, id);
    w.slotNote.hidden = w.toggle.hidden;
    w.toggle.textContent = inList ? tr('physics.removeprog') : ids.length >= maxSlots ? tr('physics.full') : tr('physics.addprog');
    w.toggle.disabled = !inList && ids.length >= maxSlots;
    w.slotNote.textContent = tr(s.collider === 'pp' ? 'physics.slots.pp' : 'physics.slots.ee', { n: ids.length, max: maxSlots });

    w.ctl.hidden = !!d;
    if (!d) {
      w.trigLab.textContent = tr('physics.trig', { v: cfg.trig.toFixed(2) });
      w.cutLab.textContent = tr('physics.cut', { v: cfg.cut.toFixed(2) });
      if (!dragging) { w.trigIn.value = String(Math.round(cfg.trig * 100)); w.cutIn.value = String(Math.round(cfg.cut * 100)); }
      w.tune.hidden = p.tier > 0;
      w.trigInfo.textContent = e.ok ? tr(e.tg.shared ? 'physics.trigshared' : 'physics.trigload', { kept: Math.round(e.tg.loss * 100), rate: fmt(e.tg.total), bw: fmt(e.tg.bandwidth) }) : '';
      const setMeter = (m, frac, text) => { m.fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`; m.val.textContent = text; };
      if (e.ok) {
        setMeter(w.mSig, e.sigEff, `${Math.round(e.sigEff * 100)}%`);
        setMeter(w.mBkg, e.bkgEff, `${Math.round(e.bkgEff * 100)}%`);
        const pur = e.Snom / (e.Snom + e.B || 1);
        setMeter(w.mPur, pur, `${Math.round(pur * 100)}%`);
        setMeter(w.mBw, e.tg.loss, `${Math.round(e.tg.loss * 100)}%`);
      }
    }

    w.anFundVal.textContent = fmt(s.pools.analysis);
    w.anFund.setAttribute('aria-label', tr('an.fund'));
    w.an.hidden = !!d || !!j;
    if (!d && !j) {
      for (const [st, b] of stratBtns) b.setAttribute('aria-pressed', String(st === sel.strategy));
      w.stratDesc.textContent = tr(`an.strategy.${sel.strategy}.desc`);
      w.blind.setAttribute('aria-pressed', String(sel.blind));
      w.valid.setAttribute('aria-pressed', String(sel.valid));
      const guided = p.tier === 0;
      const chosen = guided ? PH.goodCuts(p) : sel.cuts[id] || [];
      w.tutorial.hidden = !guided;
      w.tutorial.textContent = guided ? tr('an.tutorial') : '';
      w.menuHint.textContent = tr(`menu.hint.${p.menu}`);
      for (const [c, b] of w.cutBtns) {
        b.setAttribute('aria-pressed', String(chosen.includes(c)));
        b.disabled = guided || (!chosen.includes(c) && chosen.length >= PR.MAX_CUTS);
      }
      w.cutInfo.textContent = sel.lastCut ? `${tr(`cut.${sel.lastCut}`)}: ${tr(`cut.${sel.lastCut}.desc`)}` : tr('an.cuts.pick', { n: PR.MAX_CUTS, k: chosen.length });
      const pl = PH.plan(sel.strategy, { blind: sel.blind, valid: sel.valid }, p);
      const cost = G.analysisCost(s, p, sel.strategy, { blind: sel.blind, valid: sel.valid });
      w.estimate.textContent = L > 0 && e.ok
        ? `${tr('an.estimate', { min: fmtYears(pl.years), risk: Math.round(pl.prob * 100) })} · ${tr('an.cost', { cost: fmt(cost), have: fmt(s.pools.analysis) })}`
        : tr('an.nodata');
      w.start.disabled = !(L > 0 && e.ok) || s.pools.analysis < cost || (!guided && chosen.length === 0);
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
      const reward = d.rep ? ` ${tr('done.reward', { rep: d.rep.toFixed(1), pct: Math.round(d.boost * 100), years: d.years })}` : '';
      w.doneText.textContent = `${d.scooped ? `${main} ${tr('done.scooped')}` : main}${reward}`;
    }
  }

  UI.register({ init, render });
})();
