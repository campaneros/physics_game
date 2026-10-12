// Scena interattiva: sito (campo, edifici, tunnel sotterraneo) e sezione del detector. SVG dipinto in scene-art.js,
// qui solo composizione e aggiornamento in base allo stato. Le parti che dipendono dallo stato si ridisegnano quando cambia la firma.
(() => {
  'use strict';
  const G = Game;
  const PR = Processes;
  const { tr, el, button, fmt } = UI;
  const { S, icon, iconSvg } = SVG;
  const A = SceneArt;
  const { INK, W, H, GROUND, ink } = A;

  const CX = 180;
  const CY = 372; // centro dell'anello
  const DCY = 292; // centro della sezione del detector
  const LAYERS = [ // dall'esterno verso l'interno
    { id: 'muon', ri: 118, ro: 146, n: 16, color: '#a78bfa', fills: ['url(#muonA)', 'url(#muonB)'] },
    { id: 'hcal', ri: 88, ro: 114, n: 24, color: '#fb923c', fills: ['url(#hcalG)'] },
    { id: 'ecal', ri: 64, ro: 86, n: 48, color: '#34d399', fills: ['url(#ecalG)'] },
    { id: 'tracker', ri: 30, ro: 62, n: 0, color: '#38bdf8', fills: [] },
  ];
  const ringRadius = (lvl) => 62 + 14 * lvl;

  let view = 'site';
  let sigSite = '';
  const r = { layers: {}, pips: {}, req: {}, leds: [], dleds: [] };

  const hit = (g, label, fn) => {
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', label);
    g.classList.add('hit');
    g.addEventListener('click', fn);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fn(); });
    return g;
  };
  const crane = (x, y) => S('g', { transform: `translate(${x} ${y})` }, S('g', { class: 'crane' },
    S('rect', { x: -3, y: -64, width: 6, height: 64, fill: '#facc15', ...ink(2) }),
    S('path', { d: 'M-3 -64H40', stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round' }),
    S('path', { d: 'M-3 -64H40', stroke: '#facc15', 'stroke-width': 4, 'stroke-linecap': 'round' }),
    S('path', { d: 'M34 -62V-32', stroke: '#e2e8f0', 'stroke-width': 1.6 }),
    S('rect', { x: 29, y: -32, width: 10, height: 10, fill: '#f97316', ...ink(2) }),
    S('rect', { x: -12, y: -5, width: 24, height: 6, rx: 2, fill: '#64748b', ...ink(2) })));
  const dust = (x, y) => {
    const g = S('g', { transform: `translate(${x} ${y})`, 'pointer-events': 'none' });
    for (let i = 0; i < 4; i++) { const c = S('circle', { cx: i * 9 - 14, cy: 0, r: 4 + (i % 2) * 2, fill: '#d6c3a0', class: 'dust' }); c.style.animationDelay = `${(i * 0.4).toFixed(1)}s`; g.append(c); }
    return g;
  };

  // --- sito -------------------------------------------------------------------
  function buildSite() {
    const g = S('g');
    g.append(A.skyland(), A.underground());

    const ctrl = A.controlRoom();
    hit(ctrl, tr('site.control'), () => UI.showTab('physics'));
    const daq = A.dataCenter();
    for (let i = 0; i < 4; i++) { const led = S('circle', { cx: 284 + i * 16, cy: 158, r: 4.5, fill: '#334155', stroke: INK, 'stroke-width': 1.6 }); r.leds.push(led); daq.append(led); }
    hit(daq, tr('site.daq'), () => Popups.construction(['daq']));

    r.plot = S('g', {},
      S('rect', { x: 56, y: 240, width: 248, height: 246, rx: 18, fill: '#2a1b10', opacity: 0.55 }),
      S('rect', { x: 56, y: 240, width: 248, height: 246, rx: 18, fill: 'none', stroke: '#fcd34d', 'stroke-width': 3.5, 'stroke-dasharray': '12 8', class: 'marchant' }),
      (r.plotPlus = S('g', { class: 'pulse2' }, S('circle', { cx: CX, cy: CY, r: 34, fill: '#1c2a52', ...ink(3) }), S('g', { transform: `translate(${CX - 24} ${CY - 24}) scale(2)` }, icon.plus()))),
      S('rect', { x: 56, y: 240, width: 248, height: 246, fill: 'transparent' }));
    hit(r.plot, tr('site.plot'), () => Popups.construction());

    r.ring = S('g');
    r.beams = S('g', { display: 'none', 'pointer-events': 'none' });
    r.dirt = S('g', { display: 'none', 'pointer-events': 'none' },
      S('path', { d: `M${CX - 70} 420C${CX - 40} 376 ${CX + 40} 376 ${CX + 70} 420z`, fill: '#8a6b4a', ...ink(2.5) }),
      S('path', { d: `M${CX - 40} 420C${CX - 20} 398 ${CX + 20} 398 ${CX + 40} 420z`, fill: '#b08d62', opacity: 0.6 }),
      S('path', { d: `M${CX + 80} 440l8-18l8 18zM${CX - 100} 448l8-18l8 18z`, fill: '#f97316', ...ink(2) }));
    r.works = S('g', { display: 'none', 'pointer-events': 'none' }, crane(CX - 40, CY + 40), dust(CX + 30, CY + 52));
    r.barBg = S('rect', { x: 20, y: GROUND + 16, width: 320, height: 10, rx: 5, fill: '#10172e', ...ink(2) });
    r.bar = S('rect', { x: 22, y: GROUND + 18, width: 0, height: 6, rx: 3, fill: '#4ade80' });
    g.append(r.plot, r.dirt, r.ring, r.beams, r.works, ctrl, daq, r.barBg, r.bar, A.vignette());
    return g;
  }

  const magnet = (x, y, deg, grad) => S('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})` },
    S('rect', { x: -9, y: -6, width: 18, height: 12, rx: 3, fill: `url(#${grad})`, ...ink(1.8) }),
    S('rect', { x: -9, y: -6, width: 4, height: 12, rx: 1.5, fill: '#e0483f', ...ink(1.2) }), S('rect', { x: 5, y: -6, width: 4, height: 12, rx: 1.5, fill: '#e0483f', ...ink(1.2) }),
    S('path', { d: 'M-3-3.5H3', stroke: '#fff', 'stroke-width': 1.4, opacity: 0.6, 'stroke-linecap': 'round' }));

  // mini detector nella caverna: ogni strato compare in base al livello costruito.
  function miniDetector(s, x, y) {
    const g = S('g', { 'pointer-events': 'none' });
    for (const [id, rr, w] of [['muon', 23, 6], ['hcal', 17, 6], ['ecal', 11.5, 5], ['tracker', 6.5, 5]]) {
      const lvl = s.det[id];
      const L = LAYERS.find((q) => q.id === id);
      g.append(S('circle', { cx: x, cy: y, r: rr, fill: 'none', stroke: lvl ? INK : '#3a4770', 'stroke-width': w + 2, opacity: lvl ? 1 : 0.5 }),
        S('circle', { cx: x, cy: y, r: rr, fill: 'none', stroke: lvl ? L.color : '#3a4770', 'stroke-width': w, opacity: lvl ? 0.55 + 0.15 * lvl : 0.5, 'stroke-dasharray': lvl ? 'none' : '3 3' }));
    }
    g.append(S('circle', { cx: x, cy: y, r: 2, fill: '#fff' }));
    return g;
  }

  function buildRing(s) {
    r.ring.replaceChildren();
    r.beams.replaceChildren();
    if (!s.built) return;
    const rad = ringRadius(s.energyLvl);
    const n = 10 + 4 * s.energyLvl;
    const mag = s.collider === 'pp' ? 'magBlue' : 'magGreen';
    const tunnel = S('g', {},
      S('circle', { cx: CX, cy: CY, r: rad, fill: 'none', stroke: INK, 'stroke-width': 22 }),
      S('circle', { cx: CX, cy: CY, r: rad, fill: 'none', stroke: 'url(#tube)', 'stroke-width': 16 }),
      S('circle', { cx: CX, cy: CY, r: rad - 3, fill: 'none', stroke: '#fff', 'stroke-width': 1.6, opacity: 0.35 }),
      S('circle', { cx: CX, cy: CY, r: rad, fill: 'none', stroke: 'transparent', 'stroke-width': 40 }));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI + Math.PI / n;
      tunnel.append(magnet(CX + rad * Math.cos(a), CY + rad * Math.sin(a), (a * 180) / Math.PI + 90, mag));
    }
    // cavità a radiofrequenza (dorate) sul lato opposto al punto di collisione
    for (const da of [-0.12, 0.12]) { const a = Math.PI / 2 + da * 3; tunnel.append(S('g', { transform: `translate(${(CX + rad * Math.cos(a)).toFixed(1)} ${(CY + rad * Math.sin(a)).toFixed(1)}) rotate(${(a * 180) / Math.PI + 90})` }, S('rect', { x: -7, y: -7, width: 14, height: 14, rx: 3, fill: 'url(#gold)', ...ink(1.8) }))); }
    // magneti di focalizzazione: più luminosità, più ne vedi accanto al punto di collisione
    for (let k = 0; k < s.lumiLvl; k++) for (const sign of [-1, 1]) {
      const a = -Math.PI / 2 + sign * (0.2 + 0.1 * k);
      tunnel.append(S('circle', { cx: CX + rad * Math.cos(a), cy: CY + rad * Math.sin(a), r: 4.2, fill: '#fef3c7', ...ink(1.6), filter: 'url(#glow)' }));
    }
    hit(tunnel, tr('site.ring'), () => Popups.projects());

    const ipY = CY - rad;
    const shaft = S('g', {},
      S('rect', { x: CX - 6, y: GROUND, width: 12, height: Math.max(0, ipY - GROUND), fill: 'url(#steel)', ...ink(2.2) }),
      S('rect', { x: CX - 5, y: GROUND + 14, width: 10, height: 12, fill: '#facc15', ...ink(1.6), class: 'lift' }));
    const cavern = S('g', {},
      S('rect', { x: CX - 40, y: ipY - 32, width: 80, height: 64, rx: 12, fill: '#0f1630', ...ink(2.8) }),
      S('rect', { x: CX - 36, y: ipY - 28, width: 72, height: 56, rx: 9, fill: 'none', stroke: '#33447e', 'stroke-width': 1.6 }),
      miniDetector(s, CX, ipY),
      S('rect', { x: CX - 44, y: ipY - 36, width: 88, height: 72, fill: 'transparent' }));
    hit(cavern, tr('site.ip'), () => setView('det'));
    const hall = S('g', { 'pointer-events': 'none' },
      S('rect', { x: CX - 26, y: GROUND - 30, width: 52, height: 34, fill: 'url(#wall)', ...ink(2.4) }),
      S('path', { d: `M${CX - 32} ${GROUND - 28}L${CX} ${GROUND - 48}L${CX + 32} ${GROUND - 28}z`, fill: 'url(#roof)', ...ink(2.4) }),
      S('rect', { x: CX - 8, y: GROUND - 16, width: 16, height: 20, fill: '#1f2a44', ...ink(1.8) }));
    r.ring.append(tunnel, shaft, hall, cavern);

    const path = (sweep) => `M ${CX + rad} ${CY} A ${rad} ${rad} 0 1 ${sweep} ${CX - rad} ${CY} A ${rad} ${rad} 0 1 ${sweep} ${CX + rad} ${CY}`;
    for (const sweep of [1, 0]) r.beams.append(S('circle', { r: 4.5, fill: '#fff7d6', filter: 'url(#glow)' }, S('animateMotion', { dur: '2.2s', repeatCount: 'indefinite', path: path(sweep) })));
    r.beams.append(S('circle', { cx: CX, cy: ipY, r: 6, fill: 'url(#ipGlow)' }, S('animate', { attributeName: 'r', values: '8;26;8', dur: '0.9s', repeatCount: 'indefinite' })));
    r.works.firstChild.setAttribute('transform', `translate(${CX - 56} ${ipY + 58})`);
  }

  // --- sezione del detector ---------------------------------------------------
  function buildDet() {
    const g = S('g', { display: 'none' });
    g.append(A.detBackdrop());
    for (const L of LAYERS) {
      const mid = (L.ri + L.ro) / 2;
      const ghost = S('g', {}, S('circle', { cx: CX, cy: DCY, r: mid, fill: '#38bdf8', 'fill-opacity': 0.05, stroke: '#38bdf8', 'stroke-opacity': 0.5, 'stroke-width': L.ro - L.ri, 'stroke-dasharray': '4 6', opacity: 0.35 }),
        S('circle', { cx: CX, cy: DCY, r: L.ro, fill: 'none', stroke: '#7dd3fc', 'stroke-width': 1.4, 'stroke-dasharray': '3 4' }));
      const solid = S('g', { display: 'none' });
      if (L.n) {
        for (let i = 0; i < L.n; i++) {
          const a0 = (i / L.n) * 2 * Math.PI + 0.012;
          const a1 = ((i + 1) / L.n) * 2 * Math.PI - 0.012;
          solid.append(S('path', { d: A.wedge(CX, DCY, L.ri, L.ro, a0, a1), fill: L.fills[i % L.fills.length], ...ink(L.n > 30 ? 1 : 1.6) }));
        }
      } else {
        for (let k = 0; k < 4; k++) {
          const rr = L.ri + 4 + (k * (L.ro - L.ri - 8)) / 3;
          solid.append(S('circle', { cx: CX, cy: DCY, r: rr, fill: 'none', stroke: INK, 'stroke-width': 5.5 }), S('circle', { cx: CX, cy: DCY, r: rr, fill: 'none', stroke: 'url(#trkG)', 'stroke-width': 3 }));
        }
        for (let i = 0; i < 18; i++) { const a = (i / 18) * 2 * Math.PI; solid.append(S('path', { d: `M${CX + L.ri * Math.cos(a)} ${DCY + L.ri * Math.sin(a)}L${CX + L.ro * Math.cos(a)} ${DCY + L.ro * Math.sin(a)}`, stroke: '#bde6ff', 'stroke-width': 0.9, opacity: 0.5 })); }
      }
      solid.append(S('circle', { cx: CX, cy: DCY, r: L.ro - 1.5, fill: 'none', stroke: '#fff', 'stroke-width': 1.4, opacity: 0.28, 'pointer-events': 'none' }));
      const glow = S('circle', { cx: CX, cy: DCY, r: L.ro + 1, fill: 'none', stroke: L.color, 'stroke-width': 3, filter: 'url(#glow)', display: 'none', 'pointer-events': 'none', class: 'breathe' });
      const grp = S('g', {}, ghost, solid, glow);
      hit(grp, tr(`sub.${L.id}`), () => Popups.construction([L.id]));
      const req = S('circle', { cx: CX, cy: DCY, r: L.ro + 5, fill: 'none', 'stroke-width': 2.6, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round', display: 'none', 'pointer-events': 'none' });
      const pips = [];
      for (let i = 0; i < PR.DETECTOR.maxLevel; i++) {
        const a = (Math.PI / 180) * (30 + i * 9);
        const dot = S('circle', { cx: CX + mid * Math.cos(a), cy: DCY + mid * Math.sin(a), r: 3.4, fill: '#0b1220', ...ink(1.4) });
        pips.push(dot);
        grp.append(dot);
      }
      r.layers[L.id] = { ghost, solid, glow, grp };
      r.pips[L.id] = pips;
      r.req[L.id] = req;
      g.append(grp, req);
    }
    g.append(S('rect', { x: 14, y: DCY - 4, width: 332, height: 8, fill: 'url(#tube)', ...ink(1.8), 'pointer-events': 'none' }),
      S('circle', { cx: CX, cy: DCY, r: 28, fill: 'url(#ipGlow)', class: 'breathe', 'pointer-events': 'none' }),
      S('circle', { cx: CX, cy: DCY, r: 5, fill: '#fff', 'pointer-events': 'none' }));
    r.tracks = S('g', { display: 'none', 'pointer-events': 'none' });
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * 2 * Math.PI + 0.3;
      const len = 70 + ((i * 37) % 80);
      const bend = (i % 2 ? 1 : -1) * (14 + (i % 4) * 5);
      const ex = CX + len * Math.cos(a);
      const ey = DCY + len * Math.sin(a);
      const mx = CX + (len / 2) * Math.cos(a) - bend * Math.sin(a);
      const my = DCY + (len / 2) * Math.sin(a) + bend * Math.cos(a);
      const tg = S('g', { class: 'track' }, S('path', { d: `M${CX} ${DCY}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, fill: 'none', stroke: i % 3 === 0 ? '#fb7185' : '#fde047', 'stroke-width': 2.2, 'stroke-linecap': 'round', filter: 'url(#glow)' }),
        S('circle', { cx: ex, cy: ey, r: 3, fill: '#fff' }));
      tg.style.animationDelay = `${(i * 0.11).toFixed(2)}s`;
      r.tracks.append(tg);
    }
    const rack = S('g', {}, S('rect', { x: 276, y: 46, width: 62, height: 46, rx: 8, fill: '#1c2547', ...ink(2.4) }), S('rect', { x: 270, y: 40, width: 74, height: 58, fill: 'transparent' }));
    for (let i = 0; i < 4; i++) { const led = S('circle', { cx: 290 + i * 14, cy: 69, r: 4, fill: '#334155', ...ink(1.4) }); r.dleds.push(led); rack.append(led); }
    hit(rack, tr('site.daq'), () => Popups.construction(['daq']));
    const back = S('g', {}, S('circle', { cx: 38, cy: 52, r: 22, fill: '#1c2547', ...ink(2.6) }), S('g', { transform: 'translate(26 40)' }, icon.back()));
    hit(back, tr('det.back'), () => setView('site'));
    r.works2 = S('g', { display: 'none', 'pointer-events': 'none' }, crane(CX + 80, DCY - 130));
    g.append(r.tracks, rack, back, r.works2, A.vignette());
    return g;
  }

  function setView(v) {
    view = v;
    r.site.setAttribute('display', v === 'site' ? 'inline' : 'none');
    r.det.setAttribute('display', v === 'det' ? 'inline' : 'none');
    render(UI.get());
  }

  // --- mano di carte (HTML, bersagli grandi) -------------------------------------------
  const FAN = [-7, -2.5, 2.5, 7];
  function actions(host) {
    const hand = el('div', 'hand');
    const mk = (name, key, kind, fn) => {
      const b = button('', fn);
      b.className = `cardbtn ${kind}`;
      b.setAttribute('aria-label', tr(key));
      const orb = el('span', 'orb');
      const art = el('span', 'art');
      art.append(iconSvg(name, 44));
      b.append(orb, art, el('span', 'ctitle', tr(key)));
      const i = hand.children.length;
      b.style.setProperty('--rot', `${FAN[i]}deg`);
      b.style.setProperty('--lift', `${Math.abs(FAN[i]) * 1.4}px`);
      hand.append(b);
      return { b, badge: orb };
    };
    r.aBuild = mk('wrench', 'act.build', 'c-build', () => Popups.construction());
    r.aProj = mk('bolt', 'act.projects', 'c-proj', () => Popups.projects());
    r.aBudget = mk('coin', 'act.budget', 'c-budget', () => Popups.budget());
    r.aRun = mk('play', 'act.run', 'c-run', () => Popups.run());
    host.append(hand);
  }

  function init() {
    const host = document.getElementById('site-host');
    r.svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene', role: 'group', 'aria-label': tr('tab.site') });
    r.svg.append(A.defs());
    r.site = buildSite();
    r.det = buildDet();
    r.svg.append(r.site, r.det);
    host.append(r.svg);
    actions(host);
  }

  function render(s) {
    const running = !!(s.run && s.program && G.canRun(s, s.program));
    const building = !!s.shutdown;
    const key = [s.built, s.collider, s.energyLvl, s.lumiLvl, ...PR.DETECTOR.subsystems.map((k) => s.det[k])].join();
    if (key !== sigSite) { sigSite = key; buildRing(s); }
    r.plot.setAttribute('display', s.built ? 'none' : 'inline');
    r.plotPlus.setAttribute('display', building ? 'none' : 'inline');
    r.dirt.setAttribute('display', building && !s.built ? 'inline' : 'none');
    r.beams.setAttribute('display', running ? 'inline' : 'none');
    r.works.setAttribute('display', building && view === 'site' ? 'inline' : 'none');
    r.works2.setAttribute('display', building ? 'inline' : 'none');
    r.tracks.setAttribute('display', running ? 'inline' : 'none');
    for (let i = 0; i < 4; i++) {
      r.leds[i].setAttribute('fill', i < s.det.daq ? '#4ade80' : '#334155');
      r.dleds[i].setAttribute('fill', i < s.det.daq ? '#4ade80' : '#334155');
    }
    const prog = s.shutdown ? (s.t - s.shutdown.start) / (s.shutdown.until - s.shutdown.start) : s.run ? (s.t - s.run.start) / (s.run.end - s.run.start) : 0;
    r.bar.setAttribute('width', String(Math.max(0, Math.min(1, prog)) * 316));
    r.bar.setAttribute('fill', s.shutdown ? '#f59e0b' : '#4ade80');

    const p = s.program ? PR.BY_ID.get(s.program) : null;
    for (const L of LAYERS) {
      const lvl = s.det[L.id];
      const lay = r.layers[L.id];
      lay.ghost.setAttribute('display', lvl === 0 ? 'inline' : 'none');
      lay.solid.setAttribute('display', lvl > 0 ? 'inline' : 'none');
      lay.solid.setAttribute('opacity', String(0.6 + 0.1 * lvl));
      lay.glow.setAttribute('display', lvl >= 3 ? 'inline' : 'none');
      lay.grp.setAttribute('class', `hit${s.shutdown && s.shutdown.items.includes(L.id) ? ' building' : ''}`);
      r.pips[L.id].forEach((d, i) => d.setAttribute('fill', i < lvl ? L.color : '#0b1220'));
      const need = p && p.need[L.id];
      const req = r.req[L.id];
      req.setAttribute('display', need ? 'inline' : 'none');
      if (need) req.setAttribute('stroke', lvl >= need ? '#4ade80' : '#f87171');
    }

    r.aBuild.badge.textContent = s.built ? `${Object.values(s.projects).filter((q) => q.state === 'ready').length || s.shutdowns}` : '+';
    r.aProj.badge.textContent = `${Object.keys(s.projects).length}/${G.MAX_PROJECTS}`;
    r.aBudget.badge.textContent = fmt(G.annualBudget(s));
    r.aBudget.b.classList.toggle('warn', s.pools.ops < G.runCost(s, 1));
    r.aRun.badge.textContent = s.run ? '▶' : fmt(G.runCost(s, 1));
    r.aRun.b.classList.toggle('warn', !s.run && !(p && G.canRun(s, p.id)));
  }

  UI.register({ init, render });
})();
