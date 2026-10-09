// UI della modalità budget. Testo dinamico sempre via textContent: nessun innerHTML.
(() => {
  'use strict';
  const B = Budget;
  const tr = I18n.t;

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
  const sigma = (gev) => `±${(gev * 1000).toPrecision(3)} MeV`;

  // opts: { seed, label, onNew() }
  function create(container, opts) {
    const sc = B.scenario(opts.seed);
    let alloc = B.zero();
    let sims = 0;
    let done = false;

    const root = el('div', 'bg');
    root.append(
      el('h2', null, tr('bg.title', { res: tr(`res.${sc.resonance}`) })),
      el('p', 'muted', tr('bg.intro', { label: opts.label, budget: B.BUDGET, sims: B.MAX_SIMS })),
    );
    const remaining = el('p', 'bg-remaining');
    root.append(remaining);

    const rows = new Map();
    for (const item of B.ITEMS) {
      const row = el('div', 'bg-row');
      const head = el('div', 'bg-head');
      const name = el('strong', null, tr(`bg.item.${item.id}.name`));
      const val = el('span');
      head.append(name, val);
      const input = el('input');
      input.type = 'range';
      input.min = '0';
      input.max = String(B.BUDGET);
      input.step = String(B.STEP);
      input.value = '0';
      input.setAttribute('aria-label', tr(`bg.item.${item.id}.name`));
      input.addEventListener('input', () => onInput(item.id, input));
      row.append(head, input, el('small', 'muted', tr(`bg.item.${item.id}.desc`)));
      root.append(row);
      rows.set(item.id, { input, val });
    }

    const simBtn = button('', simulate);
    const pubBtn = button(tr('bg.publish'), publish);
    pubBtn.className = 'primary';
    const actions = el('div', 'row');
    actions.append(simBtn, pubBtn);
    const log = el('ol', 'bg-log');
    const result = el('div', 'bg-result');
    result.hidden = true;
    root.append(actions, log, result);
    container.append(root);

    function refresh() {
      const left = B.BUDGET - B.spent(alloc);
      remaining.textContent = tr('bg.remaining', { left, total: B.BUDGET });
      for (const item of B.ITEMS) rows.get(item.id).val.textContent = String(alloc[item.id]);
      simBtn.textContent = tr('bg.sim', { n: B.MAX_SIMS - sims });
      simBtn.disabled = done || sims >= B.MAX_SIMS;
      pubBtn.disabled = done;
    }

    function onInput(id, input) {
      if (done) return;
      const room = B.BUDGET - B.spent(alloc) + alloc[id];
      const next = Math.min(Number(input.value), room);
      input.value = String(next);
      alloc = { ...alloc, [id]: next };
      refresh();
    }

    function simulate() {
      if (done || sims >= B.MAX_SIMS) return;
      sims += 1;
      const m = B.measure(sc, alloc);
      log.append(el('li', null, tr('bg.logline', { s: sigma(m.stat), y: sigma(m.syst), t: sigma(m.total) })));
      refresh();
    }

    function publish() {
      if (done) return;
      done = true;
      for (const { input } of rows.values()) input.disabled = true;
      const m = B.measure(sc, alloc);
      const pts = B.score(sc, alloc);
      const rewardText = opts.onPublish ? opts.onPublish(sc.resonance, pts) || '' : '';
      const best = B.ITEMS.map((i) => `${tr(`bg.item.${i.id}.name`)} ${sc.optimum.alloc[i.id]}`).join(' · ');
      result.replaceChildren(
        el('p', 'bg-score', tr('bg.score', { p: sigma(m.total), pts })),
        el('p', 'muted', tr('bg.optimum', { o: sigma(sc.optimum.total), alloc: best })),
      );
      if (rewardText) result.append(el('p', 'bg-reward', rewardText));
      const day = /^\d{4}-\d{2}-\d{2}$/.test(sc.seed) ? ` ${sc.seed}` : '';
      const text = tr('bg.share', { day, pts });
      const row = el('div', 'row');
      row.append(button(tr('share.btn'), async (e) => shareText(e.currentTarget, text)));
      if (opts.onNew) row.append(button(tr('bg.newscenario'), () => opts.onNew()));
      result.append(row);
      result.hidden = false;
      refresh();
    }

    async function shareText(btn, text) {
      const original = btn.textContent;
      try {
        if (navigator.share) await navigator.share({ text });
        else await navigator.clipboard.writeText(text);
        btn.textContent = tr('share.done');
      } catch (err) {
        btn.textContent = err && err.name === 'AbortError' ? original : tr('share.fail');
      }
      setTimeout(() => { btn.textContent = original; }, 1500);
    }

    refresh();
    return { destroy() { root.remove(); } };
  }

  window.BudgetUI = { create };
})();
