// Primitive SVG e icone vettoriali. Tutto costruito con createElementNS: niente immagini, niente innerHTML.
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  const S = (tag, attrs, ...kids) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, String(v));
    for (const k of kids) if (k != null) e.append(k);
    return e;
  };
  const stroke = (d, color, w = 2.4) => S('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });

  // Icone in un riquadro 24×24.
  const icon = {
    coin: () => S('g', {}, S('circle', { cx: 12, cy: 12, r: 10, fill: '#facc15', stroke: '#a16207', 'stroke-width': 2 }), stroke('M12 6v12M9 9.5h4.5a2 2 0 0 1 0 4H10a2 2 0 0 0 0 4h5', '#713f12', 2)),
    clock: () => S('g', {}, S('circle', { cx: 12, cy: 12, r: 10, fill: 'none', stroke: '#94a3c0', 'stroke-width': 2 }), stroke('M12 6v6l4 2', '#94a3c0', 2)),
    wrench: () => S('g', {}, stroke('M14.5 4.5a5 5 0 0 0-5.2 6.8L3.5 17l3.5 3.5 5.7-5.8a5 5 0 0 0 6.8-5.2l-3 3-3-1-1-3z', '#e6ebf5', 2)),
    bolt: () => S('path', { d: 'M13 2L4 14h6l-1 8 9-12h-6z', fill: '#facc15' }),
    sun: () => S('g', {}, S('circle', { cx: 12, cy: 12, r: 5, fill: '#fb923c' }), stroke('M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1', '#fb923c', 2)),
    play: () => S('path', { d: 'M7 4l13 8-13 8z', fill: '#4ade80' }),
    check: () => stroke('M4 12.5l5 5L20 6.5', '#4ade80', 3),
    cross: () => stroke('M5 5l14 14M19 5L5 19', '#f87171', 3),
    close: () => stroke('M5 5l14 14M19 5L5 19', '#e6ebf5', 2.6),
    plus: () => stroke('M12 4v16M4 12h16', '#e6ebf5', 3),
    back: () => stroke('M15 4l-8 8 8 8', '#e6ebf5', 3),
    rack: () => S('g', {}, S('rect', { x: 4, y: 3, width: 16, height: 18, rx: 2, fill: '#1e293b', stroke: '#94a3c0', 'stroke-width': 2 }), S('circle', { cx: 8, cy: 8, r: 1.5, fill: '#4ade80' }), S('circle', { cx: 8, cy: 13, r: 1.5, fill: '#4ade80' }), stroke('M12 8h5M12 13h5', '#94a3c0', 2)),
    ring: () => S('g', {}, S('circle', { cx: 12, cy: 12, r: 9, fill: 'none', stroke: '#94a3b8', 'stroke-width': 3 }), S('circle', { cx: 12, cy: 3, r: 2.5, fill: '#fde047' })),
    lock: () => S('g', {}, S('rect', { x: 5, y: 11, width: 14, height: 10, rx: 2, fill: '#94a3c0' }), stroke('M8 11V8a4 4 0 0 1 8 0v3', '#94a3c0', 2.4)),
    star: () => S('path', { d: 'M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.200l1.4-7L2 9.400l7-.9z', fill: '#fbbf24', stroke: '#92400e', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
    search: () => S('g', {}, S('circle', { cx: 10, cy: 10, r: 6, fill: 'none', stroke: '#e6ebf5', 'stroke-width': 2.4 }), stroke('M15 15l6 6', '#e6ebf5', 2.6)),
  };

  // Strato del detector come anello colorato.
  const layer = (color) => () => S('g', {}, S('circle', { cx: 12, cy: 12, r: 8, fill: 'none', stroke: color, 'stroke-width': 5 }), S('circle', { cx: 12, cy: 12, r: 2, fill: '#e2e8f0' }));
  for (const [k, c] of Object.entries({ tracker: '#38bdf8', ecal: '#34d399', hcal: '#fb923c', muon: '#a78bfa' })) icon[k] = layer(c);
  icon.daq = icon.rack;

  // <svg> pronto da inserire nell'HTML (pulsanti, popup).
  const iconSvg = (name, size = 22) => S('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' }, icon[name]());

  window.SVG = { S, icon, iconSvg };
})();
