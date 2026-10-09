// UI della modalità budget. Testo dinamico sempre via textContent: nessun innerHTML.
(() => {
  'use strict';
  const B = Budget;

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
      el('h2', null, `Misura la massa: ${sc.resonance}`),
      el('p', 'muted', `${opts.label}. Distribuisci ${B.BUDGET} unità tra le voci. Hai ${B.MAX_SIMS} simulazioni per capire dove investire, poi pubblica: conta solo la precisione finale.`),
    );
    const remaining = el('p', 'bg-remaining');
    root.append(remaining);

    const rows = new Map();
    for (const item of B.ITEMS) {
      const row = el('div', 'bg-row');
      const head = el('div', 'bg-head');
      const name = el('strong', null, item.name);
      const val = el('span');
      head.append(name, val);
      const input = el('input');
      input.type = 'range';
      input.min = '0';
      input.max = String(B.BUDGET);
      input.step = String(B.STEP);
      input.value = '0';
      input.setAttribute('aria-label', item.name);
      input.addEventListener('input', () => onInput(item.id, input));
      row.append(head, input, el('small', 'muted', item.desc));
      root.append(row);
      rows.set(item.id, { input, val });
    }

    const simBtn = button('', simulate);
    const pubBtn = button('Pubblica il risultato', publish);
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
      remaining.textContent = `Budget rimasto: ${left} / ${B.BUDGET}`;
      for (const item of B.ITEMS) rows.get(item.id).val.textContent = String(alloc[item.id]);
      simBtn.textContent = `Simula (${B.MAX_SIMS - sims} rimaste)`;
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
      log.append(el('li', null, `statistica ${sigma(m.stat)} · sistematica ${sigma(m.syst)} · totale ${sigma(m.total)}`));
      refresh();
    }

    function publish() {
      if (done) return;
      done = true;
      for (const { input } of rows.values()) input.disabled = true;
      const m = B.measure(sc, alloc);
      const pts = B.score(sc, alloc);
      const best = B.ITEMS.map((i) => `${i.name} ${sc.optimum.alloc[i.id]}`).join(' · ');
      result.replaceChildren(
        el('p', 'bg-score', `Precisione ${sigma(m.total)} · ${pts}/100`),
        el('p', 'muted', `Ottimo di riferimento: ${sigma(sc.optimum.total)}. Allocazione ottima: ${best}.`),
      );
      const day = /^\d{4}-\d{2}-\d{2}$/.test(sc.seed) ? ` ${sc.seed}` : '';
      const text = `Acceleratore · Budget${day}\n🎯 ${pts}/100`;
      const row = el('div', 'row');
      row.append(button('Condividi', async (e) => shareText(e.currentTarget, text)));
      if (opts.onNew) row.append(button('Nuovo scenario', () => opts.onNew()));
      result.append(row);
      result.hidden = false;
      refresh();
    }

    async function shareText(btn, text) {
      const original = btn.textContent;
      try {
        if (navigator.share) await navigator.share({ text });
        else await navigator.clipboard.writeText(text);
        btn.textContent = 'Fatto!';
      } catch (err) {
        btn.textContent = err && err.name === 'AbortError' ? original : 'Non riuscito';
      }
      setTimeout(() => { btn.textContent = original; }, 1500);
    }

    refresh();
    return { destroy() { root.remove(); } };
  }

  window.BudgetUI = { create };
})();
