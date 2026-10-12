// Popup a icone: cantiere, progetti, budget, corsa di dati, notizie dai progetti. Testo solo via textContent.
(() => {
  'use strict';
  const G = Game;
  const PH = Physics;
  const PR = Processes;
  const { tr, el, button, fmt, fmtYears, update, get } = UI;
  const { iconSvg } = SVG;

  const chip = (name, text, bad) => {
    const c = el('span', `chip-i${bad ? ' bad' : ''}`);
    c.append(iconSvg(name, 16), document.createTextNode(String(text)));
    return c;
  };
  const pips = (lvl, max, next) => {
    const p = el('span', 'pips');
    for (let i = 0; i < max; i++) p.append(el('i', i < lvl ? 'on' : i === lvl && next ? 'next' : ''));
    return p;
  };
  // value, nextValue e mark sono frazioni 0..1 della barra.
  const bar = (value, nextValue, mark, cls) => {
    const b = el('div', `bar${cls ? ` ${cls}` : ''}`);
    if (nextValue != null) { const nx = el('i', 'next'); nx.style.width = `${Math.min(100, Math.max(0, nextValue * 100))}%`; b.append(nx); }
    const fill = el('i');
    fill.style.width = `${Math.min(100, Math.max(0, value * 100))}%`;
    b.append(fill);
    if (mark != null) { const m = el('b'); m.style.left = `${Math.min(100, mark * 100)}%`; b.append(m); }
    return b;
  };
  const poolIcon = { ops: 'play', analysis: 'search', rnd: 'wrench' };
  const projectName = (key) => (key.startsWith('det:') ? tr(`sub.${key.slice(4)}`) : tr(`proj.name.${key}`));
  const projectIcon = (key) => (key.startsWith('det:') ? key.slice(4) : key === 'energy' ? 'bolt' : key === 'lumi' ? 'sun' : 'ring');

  // Intestazione con titolo e chiusura; ritorna il contenitore del contenuto.
  function sheet(body, title, iconName) {
    const wrap = el('div', 'sheet');
    const head = el('div', 'sheet-head');
    const h = el('h2');
    h.append(iconSvg(iconName, 24), document.createTextNode(` ${title}`));
    const x = button('', () => UI.closeOverlay());
    x.className = 'x';
    x.setAttribute('aria-label', tr('pop.close'));
    x.append(iconSvg('close', 20));
    head.append(h, x);
    wrap.append(head);
    body.append(wrap);
    return wrap;
  }

  const tile = (iconName, name, sub, plan, selected, onClick, disabled) => {
    const b = button('', onClick);
    b.className = 'tile';
    b.setAttribute('aria-pressed', String(selected));
    b.setAttribute('aria-label', name);
    b.disabled = !!disabled;
    const mid = el('span', 'grow');
    mid.append(el('strong', null, name));
    if (sub) mid.append(sub);
    b.append(iconSvg(iconName, 28), mid);
    if (plan) b.append(plan);
    return b;
  };
  const side = (...nodes) => { const s = el('span', 'side'); s.append(...nodes); return s; };

  const colliderStats = { pp: { reach: 5, clean: 2, rate: 5, multi: 4 }, ee: { reach: 3, clean: 5, rate: 2, multi: 1 } };
  const shortName = (id) => tr(`proc.${id}`).split(' (')[0];

  // Cosa ottieni da un livello in più di un sottosistema: bersagli che serve/sblocca, miglioramento di risoluzione ed efficienza.
  function gainLine(s, k) {
    const g = PH.upgradeSummary(s, k);
    const box = el('span', 'gain');
    const add = (icon, text) => { const r = el('small', 'gain-i'); r.append(iconSvg(icon, 14), document.createTextNode(` ${text}`)); box.append(r); };
    if (k === 'daq') add('bolt', tr('gain.daq', { bw: g.bw, slot: g.slot ? tr('gain.slot') : '' }));
    if (g.unlocks.length) add('lock', tr('gain.unlocks', { names: `${g.unlocks.slice(0, 2).map(shortName).join(', ')}${g.unlocks.length > 2 ? ` +${g.unlocks.length - 2}` : ''}` }));
    if (g.n) add('check', tr('gain.better', { n: g.n, res: Math.round(g.res * 100), eff: Math.round(g.eff * 100) }));
    if (!box.children.length) add('clock', tr('gain.none'));
    return box;
  }

  // --- cantiere: costruzione iniziale e installazione di progetti pronti ---------
  function construction(pre = []) {
    UI.showOverlay((body) => {
      const wrap = sheet(body, tr('pop.build'), 'wrench');
      const picked = new Set(pre);
      let collider = 'pp';
      const list = el('div', 'cards');
      const foot = el('div', 'foot');
      wrap.append(list, foot);

      const render = () => {
        const s = get();
        list.replaceChildren();
        foot.replaceChildren();
        if (!s.built) {
          list.append(el('p', 'muted', tr('pop.choose')));
          const pair = el('div', 'pair');
          for (const c of ['pp', 'ee']) {
            const b = button('', () => { collider = c; render(); });
            b.className = 'tile col';
            b.setAttribute('aria-pressed', String(collider === c));
            b.setAttribute('aria-label', `${tr(`collider.${c}`)}: ${tr(`collider.${c}.desc`)}`);
            b.append(iconSvg('ring', 30), el('strong', null, tr(`collider.${c}`)), chip('coin', PR.COLLIDERS[c].cost, PR.COLLIDERS[c].cost > s.pools.rnd));
            for (const [k, v] of Object.entries(colliderStats[c])) { const row = el('span', 'stat-row'); row.append(el('small', null, tr(`stat.${k}`)), pips(v, 5)); b.append(row); }
            pair.append(b);
          }
          list.append(pair);
        }
        for (const k of PR.DETECTOR.subsystems) {
          const lvl = s.det[k];
          if (lvl >= PR.DETECTOR.maxLevel) { list.append(tile(k, tr(`sub.${k}`), pips(lvl, PR.DETECTOR.maxLevel, false), null, false, () => {}, true)); continue; }
          const pj = s.projects[`det:${k}`];
          const direct = lvl === 0;
          const ready = direct || (pj && pj.state === 'ready');
          if (!ready) {
            const sub = el('span', 'grow');
            sub.append(pips(lvl, PR.DETECTOR.maxLevel, true));
            if (pj) sub.append(bar(pj.spent / pj.cost, null, null, 'thin'));
            else sub.append(gainLine(s, k));
            list.append(tile(k, tr(`sub.${k}`), sub, side(iconSvg(pj ? 'clock' : 'lock', 22)), false, () => (pj ? null : Popups.projectStart('det', k)), !!pj));
            continue;
          }
          const plan = G.shutdownPlan(s, [k]);
          const readySub = el('span', 'grow'); readySub.append(pips(lvl, PR.DETECTOR.maxLevel, true), gainLine(s, k));
          list.append(tile(k, tr(`sub.${k}`), readySub, side(chip('coin', fmt(plan.cost), plan.cost > s.pools.rnd), plan.instant ? chip('bolt', tr('pop.instant')) : chip('clock', plan.years.toFixed(1))), picked.has(k), () => { if (picked.has(k)) picked.delete(k); else picked.add(k); render(); }, !!s.shutdown));
        }
        if (s.built) {
          const pj = s.projects.collider;
          const to = s.collider === 'pp' ? 'ee' : 'pp';
          if (pj && pj.state === 'ready') {
            const plan = G.shutdownPlan(s, ['collider']);
            list.append(tile('ring', tr('pop.switch', { name: tr(`collider.${to}`) }), null, side(chip('coin', fmt(plan.cost), plan.cost > s.pools.rnd), chip('clock', plan.years.toFixed(1))), picked.has('collider'), () => { if (picked.has('collider')) picked.delete('collider'); else picked.add('collider'); render(); }, !!s.shutdown));
          }
        }
        const items = [...(s.built ? [] : ['accelerator']), ...picked];
        const pl = G.shutdownPlan(s, items, collider);
        const total = el('span', 'side');
        total.append(chip('coin', `${pl.ok ? fmt(pl.cost) : 0} / ${fmt(s.pools.rnd)}`, pl.ok && pl.cost > s.pools.rnd));
        if (pl.ok) total.append(pl.instant ? chip('bolt', tr('pop.instant')) : chip('clock', `${pl.years.toFixed(1)} · ${fmtYears(pl.years)}′`));
        const go = button(tr('pop.start'), () => { update((st) => G.startShutdown(st, items, collider)); UI.closeOverlay(); });
        go.className = 'primary';
        go.disabled = !pl.ok || pl.cost > s.pools.rnd || !!s.shutdown;
        const short = pl.ok && pl.cost > s.pools.rnd;
        if (short) foot.append(el('small', 'warn-text', tr('pop.short')));
        foot.append(total, go);
      };
      render();
    });
  }

  // --- progetti: elenco con stato e avanzamento --------------------------------
  function projects() {
    UI.showOverlay((body) => {
      const wrap = sheet(body, tr('pop.projects'), 'bolt');
      const s = get();
      const list = el('div', 'cards');
      wrap.append(list);
      const keys = [['energy', null], ['lumi', null], ...PR.DETECTOR.subsystems.filter((k) => s.det[k] >= 1).map((k) => ['det', k]), ['collider', null]];
      for (const [kind, target] of keys) {
        const key = kind === 'det' ? `det:${target}` : kind;
        const pj = s.projects[key];
        const spec = G.projectSpec(s, kind, target);
        if (!pj && !spec) continue;
        const sub = el('span', 'grow');
        if (pj) {
          sub.append(bar(pj.spent / pj.cost, null, null, 'thin'));
          sub.append(el('small', 'muted', pj.state === 'ready' ? tr('proj.ready') : `${tr(`proj.${pj.risk}`)}${pj.fast ? ' ⚡' : ''}${pj.stall > s.t ? ' ⏸' : ''}`));
        } else {
          if (kind === 'det') sub.append(gainLine(s, target));
          sub.append(el('small', 'muted', kind === 'energy' ? `${fmt(PH.energy(s))} → ${fmt(PR.COLLIDERS[s.collider].energies[s.energyLvl + 1])} GeV` : kind === 'lumi' ? `${fmt(PH.lumiRate(s))} → ${fmt(PH.lumiRate(s) * PH.LUMI_GROWTH)} fb⁻¹/${tr('unit.year')}` : ''));
        }
        const right = pj ? side(chip('coin', fmt(pj.cost)), chip('clock', pj.years.toFixed(1))) : side(chip('coin', fmt(spec.cost)), chip('clock', spec.years.toFixed(1)));
        const onClick = pj ? (pj.state === 'ready' ? () => { UI.closeOverlay(); construction(kind === 'det' ? [target] : kind === 'collider' ? ['collider'] : []); } : () => {}) : () => projectStart(kind, target);
        list.append(tile(projectIcon(key), projectName(key), sub, right, !!pj, onClick, !!pj && pj.state === 'dev'));
      }
      if (!list.children.length) list.append(el('p', 'muted', tr('proj.none')));
    });
  }

  // --- avvio di un progetto: via prudente o audace, corsia veloce -----------------
  // Cosa ottieni dal progetto: bersagli sbloccati o miglioramenti (stesso linguaggio di gainLine).
  function projectGain(s, kind, target) {
    if (kind === 'det') return gainLine(s, target);
    const box = el('span', 'gain');
    const add = (icon, text) => { const r = el('small', 'gain-i'); r.append(iconSvg(icon, 14), document.createTextNode(` ${text}`)); box.append(r); };
    if (kind === 'lumi') add('sun', tr('gain.lumi', { x: PH.LUMI_GROWTH }));
    if (kind === 'energy') {
      const next = PR.COLLIDERS[s.collider].energies[s.energyLvl + 1];
      const opened = PR.PROCESSES.filter((q) => !(q.id in s.done) && q.thr[s.collider] > PH.energy(s) && q.thr[s.collider] <= next).map((q) => shortName(q.id));
      add('bolt', tr('gain.energy'));
      if (opened.length) add('lock', tr('gain.unlocks', { names: `${opened.slice(0, 2).join(', ')}${opened.length > 2 ? ` +${opened.length - 2}` : ''}` }));
    }
    return box;
  }

  function projectStart(kind, target) {
    UI.showOverlay((body) => {
      const key = kind === 'det' ? `det:${target}` : kind;
      const wrap = sheet(body, projectName(key), projectIcon(key));
      let risk = 'safe';
      let fast = false;
      const cards = el('div', 'pair');
      const info = el('div', 'foot');
      const opt = el('div', 'cards');
      wrap.append(projectGain(get(), kind, target), cards, opt, info);
      const draw = () => {
        const s = get();
        const spec = G.projectSpec(s, kind, target);
        cards.replaceChildren(); opt.replaceChildren(); info.replaceChildren();
        if (!spec) { cards.append(el('p', 'muted', tr('proj.none'))); return; }
        for (const r of ['safe', 'bold']) {
          const b = button('', () => { risk = r; draw(); });
          b.className = 'tile col';
          b.setAttribute('aria-pressed', String(risk === r));
          b.append(el('strong', null, tr(`proj.${r}`)), chip('clock', (spec.years * G.RISKS[r].years / (fast ? G.FAST.rate : 1)).toFixed(1)), pips(Math.round(G.RISKS[r].p * 10), 10, false));
          cards.append(b);
        }
        const f = button('', () => { fast = !fast; draw(); });
        f.className = 'tile';
        f.setAttribute('aria-pressed', String(fast));
        f.append(iconSvg('bolt', 24), el('strong', null, tr('proj.fast')));
        opt.append(f);
        const cost = Math.ceil(spec.cost * (fast ? G.FAST.cost : 1));
        const years = (spec.years * G.RISKS[risk].years) / (fast ? G.FAST.rate : 1);
        const full = Object.keys(s.projects).length >= G.MAX_PROJECTS;
        const go = button(tr('proj.begin'), () => { update((st) => G.startProject(st, kind, target, { risk, fast })); UI.closeOverlay(); });
        go.className = 'primary';
        const poor = cost > s.pools.rnd;
        go.disabled = full || poor;
        info.append(side(chip('coin', `${fmt(cost)} / ${fmt(s.pools.rnd)}`, poor), chip('clock', years.toFixed(1))), go);
        if (full) opt.append(el('small', 'muted', tr('proj.limit')));
        else opt.append(el('small', poor ? 'warn-text' : 'muted', tr(poor ? 'proj.short' : 'proj.upfront')));
      };
      draw();
    });
  }

  // --- budget: conti, allocazione, previsione, trasferimenti --------------------------
  function rebalance(alloc, key, value) {
    const v = Math.min(80, Math.max(G.MIN_ALLOC, Math.round(value / 5) * 5));
    const others = G.POOLS.filter((k) => k !== key);
    const rest = 100 - v;
    const w = alloc[others[0]] + alloc[others[1]];
    const first = Math.min(rest - G.MIN_ALLOC, Math.max(G.MIN_ALLOC, Math.round((rest * alloc[others[0]]) / w / 5) * 5));
    return { ...alloc, [key]: v, [others[0]]: first, [others[1]]: rest - first };
  }

  function budget() {
    UI.showOverlay((body) => {
      const wrap = sheet(body, tr('pop.budget'), 'coin');
      const box = el('div', 'cards');
      wrap.append(box);
      let from = 'ops';
      let to = 'analysis';
      const render = () => {
        const s = get();
        box.replaceChildren();
        const top = el('div', 'foot');
        top.append(chip('coin', tr('pop.annual', { amount: fmt(G.annualBudget(s)) })), chip('clock', `${G.POOLS.map((k) => `${s.alloc[k]}%`).join(' · ')}`));
        box.append(top);
        // previsione a 5 anni: base + finanziamenti temporanei attivi
        const fc = G.forecast(s, 5);
        const max = Math.max(...fc.map((f) => f.total), G.BASE_BUDGET);
        const chart = el('div', 'forecast');
        for (const f of fc) {
          const col = el('div', 'fc');
          const stack = el('div', 'stack');
          const boost = el('i', 'boost');
          boost.style.height = `${((f.total - f.base) / max) * 100}%`;
          const base = el('i', 'base');
          base.style.height = `${(f.base / max) * 100}%`;
          stack.append(boost, base);
          col.append(stack, el('small', null, `${f.year}`), el('small', 'muted', fmt(f.total)));
          chart.append(col);
        }
        box.append(el('small', 'muted', tr('pop.forecast')), chart);
        // conti e cursori di allocazione
        for (const k of G.POOLS) {
          const row = el('div', 'pool-row');
          const head = el('div', 'bg-head');
          const name = el('strong');
          name.append(iconSvg(poolIcon[k], 18), document.createTextNode(` ${tr(`pool.${k}`)}`));
          head.append(name, el('span', null, `${fmt(s.pools[k])} · ${s.alloc[k]}%`));
          const input = el('input');
          input.type = 'range'; input.min = String(G.MIN_ALLOC); input.max = '80'; input.step = '5'; input.value = String(s.alloc[k]);
          input.setAttribute('aria-label', tr(`pool.${k}`));
          input.addEventListener('change', () => { update((st) => G.setAlloc(st, rebalance(st.alloc, k, Number(input.value)))); render(); });
          row.append(head, input);
          box.append(row);
        }
        // trasferimenti
        box.append(el('small', 'muted', tr('pop.transfer')));
        const pick = (label, cur, set) => {
          const r = el('div', 'chips');
          for (const k of G.POOLS) { const b = button('', () => { set(k); render(); }); b.className = 'chip'; b.setAttribute('aria-pressed', String(cur === k)); b.setAttribute('aria-label', `${label} ${tr(`pool.${k}`)}`); b.append(iconSvg(poolIcon[k], 18)); r.append(b); }
          return r;
        };
        const mv = el('div', 'mv');
        const go = button(tr('pop.move'), () => { update((st) => G.transfer(st, from, to, Math.floor(st.pools[from] * 0.5))); render(); });
        go.disabled = from === to;
        mv.append(pick(tr('pop.from'), from, (k) => { from = k; }), iconSvg('play', 18), pick(tr('pop.to'), to, (k) => { to = k; }), go);
        box.append(mv);
      };
      render();
    });
  }

  // --- corsa di dati a pagamento ----------------------------------------------------
  // Una corsa prende dati per tutte le misure attive che il detector può fare (adroni: più misure insieme).
  function run() {
    UI.showOverlay((body) => {
      const s = get();
      const wrap = sheet(body, tr('pop.run'), 'play');
      const ids = G.programsOf(s);
      if (!ids.length) {
        const b = button(tr('pop.gotophysics'), () => { UI.closeOverlay(); UI.showTab('physics'); });
        b.className = 'primary';
        wrap.append(el('p', null, tr('pop.notarget')), b);
        return;
      }
      if (s.run) { wrap.append(chip('play', tr('pop.running')), bar((s.t - s.run.start) / (s.run.end - s.run.start))); return; }
      const live = ids.filter((id) => G.canRun(s, id));
      if (!live.length) {
        const p = PR.BY_ID.get(ids[0]);
        wrap.append(el('h3', null, tr(`proc.${p.id}`)));
        const need = el('div', 'cards');
        const row = (ok, name, text) => { const r = el('div', 'req-row'); r.append(iconSvg(ok ? 'check' : 'cross', 20), el('span', null, `${name} ${text}`)); return r; };
        need.append(row(s.built, tr('pop.accelerator'), ''));
        need.append(row(G.energyOk(s, p.id), `${fmt(PH.energy(s))} / ${fmt(p.thr[s.collider])}`, 'GeV'));
        for (const [k, lvl] of Object.entries(p.need)) need.append(row(s.det[k] >= lvl, tr(`sub.${k}`), `${s.det[k]}/${lvl}`));
        const lacking = Object.keys(p.need).filter((k) => s.det[k] < p.need[k]);
        const direct = lacking.filter((k) => s.det[k] === 0);
        const b = button(tr('act.build'), () => {
          UI.closeOverlay();
          if (!s.built || direct.length) construction(direct);
          else if (lacking.length) { const k = lacking[0]; const pj = s.projects[`det:${k}`]; if (pj) projects(); else projectStart('det', k); }
          else projectStart('energy', null);
        });
        b.className = 'primary';
        wrap.append(need, b);
        return;
      }
      let years = G.runCost(s, 2) <= s.pools.ops ? 2 : 1; // si propone la durata che puoi permetterti
      const cards = el('div', 'pair three');
      const info = el('div', 'cards');
      const foot = el('div', 'foot');
      wrap.append(el('small', 'muted', tr('pop.parallel', { n: live.length, max: PH.slots(s) })), cards, info, foot);
      const metric = (p, L) => {
        const e = PH.evaluate(s, p, G.cfgOf(s, p.id), L, PH.SYST_VALID);
        return p.kind === 'measure' ? Math.min(1.5, p.goal / (e.sigma || 1e9)) : Math.min(1.5, e.z / PH.Z_DISCOVERY);
      };
      const draw = () => {
        cards.replaceChildren(); info.replaceChildren(); foot.replaceChildren();
        for (const y of G.RUN_YEARS) {
          const cost = G.runCost(s, y);
          const b = button('', () => { years = y; draw(); });
          b.className = 'tile col';
          b.setAttribute('aria-pressed', String(y === years));
          b.append(el('strong', null, `${y} ${tr('unit.year')}`), chip('coin', fmt(cost), cost > s.pools.ops), chip('clock', `${fmtYears(y)}′`));
          cards.append(b);
        }
        for (const id of ids) {
          const p = PR.BY_ID.get(id);
          const row = el('div', 'req-row');
          const ok = live.includes(id);
          row.append(iconSvg(ok ? 'check' : 'cross', 18), el('strong', null, tr(`proc.${id}`)));
          info.append(row);
          if (ok) { const L = G.dataOf(s, id); info.append(bar(metric(p, L) / 1.5, metric(p, L + PH.lumiRate(s) * years) / 1.5, 1 / 1.5)); }
        }
        const cost = G.runCost(s, years);
        const go = button(tr('pop.start'), () => { update((st) => G.startRun(st, years)); UI.closeOverlay(); });
        go.className = 'primary';
        go.disabled = cost > s.pools.ops;
        foot.append(chip('coin', `${fmt(cost)} / ${fmt(s.pools.ops)}`, cost > s.pools.ops), go);
      };
      draw();
    });
  }

  // --- notizie dai progetti: ritardo con scelta (paga o aspetta) -------------------------
  function news(id) {
    UI.showOverlay((body) => {
      const s = get();
      const e = s.pending.find((x) => x.id === id);
      const wrap = sheet(body, tr('pop.news'), 'clock');
      if (!e) { wrap.append(el('p', 'muted', tr('proj.none'))); return; }
      wrap.append(el('h3', null, tr('evt.delay.title', { name: projectName(e.key) })));
      const pay = tile('coin', tr('evt.delay.pay'), null, side(chip('coin', fmt(e.pay), e.pay > s.pools.rnd)), false, () => { update((st) => G.resolveEvent(st, id, 'pay')); UI.closeOverlay(); }, e.pay > s.pools.rnd);
      const wait = tile('clock', tr('evt.delay.wait', { stall: e.stall }), null, side(chip('clock', e.stall.toFixed(1))), false, () => { update((st) => G.resolveEvent(st, id, 'accept')); UI.closeOverlay(); }, false);
      const choices = el('div', 'cards');
      choices.append(pay, wait);
      wrap.append(choices);
    });
  }

  window.Popups = { construction, projects, projectStart, budget, run, news };
})();
