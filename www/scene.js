// Scena interattiva: sito (campo, edifici, tunnel sotterraneo) e sezione del detector. Tutto SVG, aggiornato sul posto.
(() => {
  'use strict';
  const G = Game;
  const PH = Physics;
  const PR = Processes;
  const { tr, el, button, fmt, update } = UI;
  const { S, icon, iconSvg } = SVG;

  const W = 360;
  const H = 540;
  const CX = 180;
  const CY = 366; // centro dell'anello
  const GROUND = 180;
  const DCY = 330; // centro della sezione del detector
  const LAYERS = [ // dall'esterno verso l'interno
    { id: 'muon', r: 140, w: 22, color: '#a78bfa' },
    { id: 'hcal', r: 104, w: 28, color: '#fb923c' },
    { id: 'ecal', r: 74, w: 22, color: '#34d399' },
    { id: 'tracker', r: 44, w: 30, color: '#38bdf8' },
  ];
  const ringRadius = (lvl) => 50 + 15 * lvl;

  let view = 'site';
  let sig = '';
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
    S('rect', { x: -2, y: -60, width: 4, height: 60, fill: '#facc15' }),
    S('path', { d: 'M-2 -60H34', stroke: '#facc15', 'stroke-width': 4 }),
    S('path', { d: 'M30 -58V-30', stroke: '#e2e8f0', 'stroke-width': 1.5 }),
    S('rect', { x: 26, y: -30, width: 8, height: 8, fill: '#f97316' }),
    S('rect', { x: -10, y: -4, width: 20, height: 4, fill: '#64748b' })));

  // --- sito -------------------------------------------------------------------
  function buildSite() {
    const g = S('g');
    g.append(
      S('defs', {}, S('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, S('stop', { offset: '0%', 'stop-color': '#1e3a8a' }), S('stop', { offset: '100%', 'stop-color': '#7dd3fc' }))),
      S('rect', { x: 0, y: 0, width: W, height: GROUND, fill: 'url(#sky)' }),
      S('circle', { cx: 306, cy: 44, r: 16, fill: '#fde68a' }),
      S('ellipse', { cx: 96, cy: 44, rx: 34, ry: 10, fill: '#e2e8f0', opacity: 0.8 }),
      S('rect', { x: 0, y: GROUND - 6, width: W, height: 12, fill: '#15803d' }),
      S('rect', { x: 0, y: GROUND + 6, width: W, height: H - GROUND - 6, fill: '#3b2a1a' }),
    );
    for (let i = 0; i < 5; i++) g.append(S('rect', { x: 0, y: GROUND + 40 + i * 72, width: W, height: 18, fill: '#4a3524', opacity: 0.6 }));

    const ctrl = S('g', {}, S('rect', { x: 22, y: 122, width: 66, height: 52, fill: '#cbd5e1', stroke: '#64748b' }), S('path', { d: 'M16 122L55 94L94 122z', fill: '#b91c1c' }),
      S('rect', { x: 36, y: 138, width: 16, height: 14, fill: '#38bdf8' }), S('rect', { x: 60, y: 138, width: 16, height: 14, fill: '#38bdf8' }), S('rect', { x: 10, y: 84, width: 90, height: 100, fill: 'transparent' }));
    hit(ctrl, tr('site.control'), () => UI.showTab('physics'));

    const daq = S('g', {}, S('rect', { x: 272, y: 126, width: 68, height: 48, fill: '#94a3b8', stroke: '#475569' }), S('rect', { x: 266, y: 112, width: 80, height: 14, fill: '#475569' }));
    for (let i = 0; i < 4; i++) { const led = S('circle', { cx: 286 + i * 15, cy: 150, r: 4, fill: '#334155' }); r.leds.push(led); daq.append(led); }
    daq.append(S('rect', { x: 260, y: 100, width: 92, height: 88, fill: 'transparent' }));
    hit(daq, tr('site.daq'), () => Popups.construction(['daq']));

    r.plot = S('g', {}, S('rect', { x: 56, y: 236, width: 248, height: 250, rx: 16, fill: 'none', stroke: '#a3a3a3', 'stroke-width': 3, 'stroke-dasharray': '10 8' }),
      (r.plotPlus = S('g', { transform: `translate(${CX - 24} ${CY - 24}) scale(2)` }, icon.plus())), S('rect', { x: 56, y: 236, width: 248, height: 250, fill: 'transparent' }));
    hit(r.plot, tr('site.plot'), () => Popups.construction());
    r.ring = S('g');
    r.beams = S('g', { display: 'none', 'pointer-events': 'none' });
    r.works = S('g', { display: 'none', 'pointer-events': 'none' }, crane(CX - 40, CY + 20));
    r.bar = S('rect', { x: 20, y: GROUND + 14, width: 0, height: 6, rx: 3, fill: '#4ade80' });
    g.append(r.plot, r.ring, r.beams, r.works, ctrl, daq, S('rect', { x: 20, y: GROUND + 14, width: 320, height: 6, rx: 3, fill: '#1f2937', opacity: 0.6 }), r.bar);
    return g;
  }

  function buildRing(s) {
    r.ring.replaceChildren();
    r.beams.replaceChildren();
    if (!s.built) return;
    const rad = ringRadius(s.energyLvl);
    const n = 8 + 4 * s.energyLvl;
    const col = s.collider === 'pp' ? '#38bdf8' : '#4ade80';
    const tunnel = S('g', {}, S('circle', { cx: CX, cy: CY, r: rad, fill: 'none', stroke: '#0b1220', 'stroke-width': 14 }), S('circle', { cx: CX, cy: CY, r: rad, fill: 'none', stroke: '#94a3b8', 'stroke-width': 8 }),
      S('circle', { cx: CX, cy: CY, r: rad, fill: 'none', stroke: 'transparent', 'stroke-width': 36 }));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      const x = CX + rad * Math.cos(a);
      const y = CY + rad * Math.sin(a);
      tunnel.append(S('rect', { x: x - 5, y: y - 3, width: 10, height: 6, fill: col, transform: `rotate(${(a * 180) / Math.PI + 90} ${x} ${y})` }));
    }
    hit(tunnel, tr('site.ring'), () => Popups.projects());
    const ipY = CY - rad;
    const ip = S('g', {}, S('rect', { x: CX - 3, y: GROUND, width: 6, height: Math.max(0, ipY - GROUND), fill: '#475569' }),
      S('rect', { x: CX - 18, y: ipY - 14, width: 36, height: 28, rx: 4, fill: '#1e293b', stroke: '#e2e8f0', 'stroke-width': 2 }),
      S('circle', { cx: CX, cy: ipY, r: 7, fill: '#0b1220', stroke: col, 'stroke-width': 2 }), S('circle', { cx: CX, cy: ipY, r: 24, fill: 'transparent' }));
    hit(ip, tr('site.ip'), () => setView('det'));
    r.ring.append(tunnel, ip);
    const path = (sweep) => `M ${CX + rad} ${CY} A ${rad} ${rad} 0 1 ${sweep} ${CX - rad} ${CY} A ${rad} ${rad} 0 1 ${sweep} ${CX + rad} ${CY}`;
    for (const sweep of [1, 0]) r.beams.append(S('circle', { r: 4, fill: '#fde047' }, S('animateMotion', { dur: '2.4s', repeatCount: 'indefinite', path: path(sweep) })));
    r.beams.append(S('circle', { cx: CX, cy: ipY, r: 4, fill: '#ffffff' }, S('animate', { attributeName: 'r', values: '3;12;3', dur: '0.8s', repeatCount: 'indefinite' })));
    r.works.firstChild.setAttribute('transform', `translate(${CX - 46} ${ipY + 52})`);
  }

  // --- sezione del detector ---------------------------------------------------
  function buildDet() {
    const g = S('g', { display: 'none' });
    g.append(S('rect', { x: 0, y: 0, width: W, height: H, fill: '#0b1220' }), S('rect', { x: 12, y: 130, width: 336, height: 400, rx: 34, fill: '#111c33', stroke: '#334155', 'stroke-width': 3 }),
      S('path', { d: `M12 ${DCY}H348`, stroke: '#64748b', 'stroke-width': 4 }));
    for (const L of LAYERS) {
      const ring = S('circle', { cx: DCY === 0 ? 0 : CX, cy: DCY, r: L.r, fill: 'none', stroke: L.color, 'stroke-width': L.w });
      const hitring = S('circle', { cx: CX, cy: DCY, r: L.r, fill: 'none', stroke: 'transparent', 'stroke-width': L.w + 8 });
      const grp = S('g', {}, ring, hitring);
      hit(grp, tr(`sub.${L.id}`), () => Popups.construction([L.id]));
      const req = S('circle', { cx: CX, cy: DCY, r: L.r + L.w / 2 + 3, fill: 'none', 'stroke-width': 2.5, display: 'none' });
      const pips = [];
      for (let i = 0; i < PR.DETECTOR.maxLevel; i++) {
        const a = (Math.PI / 180) * (35 + i * 11);
        const dot = S('circle', { cx: CX + L.r * Math.cos(a), cy: DCY + L.r * Math.sin(a), r: 3, fill: '#0b1220', stroke: '#e2e8f0', 'stroke-width': 1 });
        pips.push(dot);
        grp.append(dot);
      }
      r.layers[L.id] = ring;
      r.pips[L.id] = pips;
      r.req[L.id] = req;
      g.append(grp, req);
    }
    g.append(S('circle', { cx: CX, cy: DCY, r: 120, fill: 'none', stroke: '#fbbf24', 'stroke-width': 5, opacity: 0.8 }), S('circle', { cx: CX, cy: DCY, r: 10, fill: '#e2e8f0' }));
    r.tracks = S('g', { display: 'none', 'pointer-events': 'none' });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 2 * Math.PI + 0.3;
      const len = 60 + ((i * 37) % 70);
      const track = S('path', { d: `M${CX} ${DCY} L${CX + len * Math.cos(a)} ${DCY + len * Math.sin(a)}`, stroke: i % 3 === 0 ? '#f87171' : '#fde047', 'stroke-width': 2, class: 'track' });
      track.style.animationDelay = `${(i * 0.13).toFixed(2)}s`;
      r.tracks.append(track);
    }
    const rack = S('g', {}, S('rect', { x: 286, y: 140, width: 52, height: 40, rx: 6, fill: '#1e293b', stroke: '#94a3b8', 'stroke-width': 2 }), S('rect', { x: 280, y: 134, width: 64, height: 52, fill: 'transparent' }));
    for (let i = 0; i < 4; i++) { const led = S('circle', { cx: 298 + i * 11, cy: 160, r: 3.5, fill: '#334155' }); r.dleds.push(led); rack.append(led); }
    hit(rack, tr('site.daq'), () => Popups.construction(['daq']));
    const back = S('g', {}, S('circle', { cx: 34, cy: 40, r: 20, fill: '#1f2a44', stroke: '#94a3c0', 'stroke-width': 2 }), S('g', { transform: 'translate(22 28)' }, icon.back()));
    hit(back, tr('det.back'), () => setView('site'));
    r.works2 = S('g', { display: 'none', 'pointer-events': 'none' }, crane(CX + 60, DCY - 150));
    g.append(r.tracks, rack, back, r.works2);
    return g;
  }

  function setView(v) {
    view = v;
    r.site.setAttribute('display', v === 'site' ? 'inline' : 'none');
    r.det.setAttribute('display', v === 'det' ? 'inline' : 'none');
    render(UI.get());
  }

  // --- barra delle azioni (HTML, bersagli grandi) ------------------------------------
  function actions(host) {
    const bar = el('div', 'actbar');
    const mk = (name, key, fn) => {
      const b = button('', fn);
      b.className = 'act';
      b.setAttribute('aria-label', tr(key));
      const badge = el('small');
      b.append(iconSvg(name, 28), badge);
      bar.append(b);
      return { b, badge };
    };
    r.aBuild = mk('wrench', 'act.build', () => Popups.construction());
    r.aProj = mk('bolt', 'act.projects', () => Popups.projects());
    r.aBudget = mk('coin', 'act.budget', () => Popups.budget());
    r.aRun = mk('play', 'act.run', () => Popups.run());
    host.append(bar);
  }

  function init() {
    const host = document.getElementById('site-host');
    r.svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene', role: 'group', 'aria-label': tr('tab.site') });
    r.site = buildSite();
    r.det = buildDet();
    r.svg.append(r.site, r.det);
    host.append(r.svg);
    actions(host);
  }

  function render(s) {
    const running = !!(s.run && s.program && G.canRun(s, s.program));
    const building = !!s.shutdown;
    const key = [s.built, s.collider, s.energyLvl].join();
    if (key !== sig) { sig = key; buildRing(s); }
    r.plot.setAttribute('display', s.built ? 'none' : 'inline');
    r.plotPlus.setAttribute('display', building ? 'none' : 'inline');
    r.beams.setAttribute('display', running ? 'inline' : 'none');
    r.works.setAttribute('display', building && view === 'site' ? 'inline' : 'none');
    r.works2.setAttribute('display', building ? 'inline' : 'none');
    r.tracks.setAttribute('display', running ? 'inline' : 'none');
    for (let i = 0; i < 4; i++) {
      r.leds[i].setAttribute('fill', i < s.det.daq ? '#4ade80' : '#334155');
      r.dleds[i].setAttribute('fill', i < s.det.daq ? '#4ade80' : '#334155');
    }
    const prog = s.shutdown ? (s.t - s.shutdown.start) / (s.shutdown.until - s.shutdown.start) : s.run ? (s.t - s.run.start) / (s.run.end - s.run.start) : 0;
    r.bar.setAttribute('width', String(Math.max(0, Math.min(1, prog)) * 320));
    r.bar.setAttribute('fill', s.shutdown ? '#f59e0b' : '#4ade80');

    const p = s.program ? PR.BY_ID.get(s.program) : null;
    for (const L of LAYERS) {
      const lvl = s.det[L.id];
      const ring = r.layers[L.id];
      ring.setAttribute('stroke-opacity', lvl === 0 ? '0.2' : String(0.35 + 0.15 * lvl));
      ring.setAttribute('stroke-dasharray', lvl === 0 ? '6 6' : 'none');
      ring.setAttribute('class', s.shutdown && s.shutdown.items.includes(L.id) ? 'building' : '');
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
