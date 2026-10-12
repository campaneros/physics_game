// Pittura della scena in SVG: gradienti, contorni scuri, luci. Solo disegno statico, nessuna logica di gioco.
(() => {
  'use strict';
  const { S } = SVG;
  const INK = '#0a0f1e';
  const W = 360;
  const H = 540;
  const GROUND = 190;

  const ink = (w = 2.5) => ({ stroke: INK, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  const stop = (o, c, a) => S('stop', { offset: o, 'stop-color': c, 'stop-opacity': a == null ? 1 : a });
  const lin = (id, stops, dir = 'v') => S('linearGradient', { id, x1: 0, y1: 0, x2: dir === 'v' ? 0 : 1, y2: dir === 'v' ? 1 : 0 }, ...stops.map(([o, c, a]) => stop(o, c, a)));
  const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) => S('radialGradient', { id, cx, cy, r }, ...stops.map(([o, c, a]) => stop(o, c, a)));

  function defs() {
    return S('defs', {},
      lin('sky', [[0, '#141a45'], [0.45, '#4a3a8c'], [0.8, '#e0708a'], [1, '#fbbf77']]),
      rad('sunGlow', [[0, '#fff3c4', 0.95], [0.35, '#fcd34d', 0.5], [1, '#fb923c', 0]]),
      lin('mtnFar', [[0, '#8b7fc9'], [1, '#4c3f86']]),
      lin('mtnNear', [[0, '#3f3a78'], [1, '#231f4d']]),
      lin('grass', [[0, '#5fbf4a'], [1, '#2a7a3a']]),
      lin('soil', [[0, '#5a3b22'], [0.5, '#3d2716'], [1, '#1d120b']]),
      lin('rock', [[0, '#8a6b4a'], [1, '#4a3322']]),
      lin('tube', [[0, '#cfd8e6'], [0.45, '#8693a8'], [1, '#3b4660']]),
      lin('magBlue', [[0, '#7dd3fc'], [0.5, '#2f7fd1'], [1, '#17386e']]),
      lin('magGreen', [[0, '#86efac'], [0.5, '#22a05a'], [1, '#0f4a2c']]),
      lin('gold', [[0, '#fde68a'], [1, '#b7791f']]),
      lin('wall', [[0, '#dfe6f1'], [1, '#8d9bb3']]),
      lin('roof', [[0, '#e0483f'], [1, '#8f1d1d']]),
      lin('steel', [[0, '#5b6b88'], [1, '#222c44']]),
      lin('muonA', [[0, '#b9a6ff'], [1, '#6a4fd1']]),
      lin('muonB', [[0, '#7d89a3'], [1, '#3a4560']]),
      lin('hcalG', [[0, '#fdba74'], [1, '#c2570c']]),
      lin('ecalG', [[0, '#86efc0'], [1, '#12915c']]),
      lin('trkG', [[0, '#7dd3fc'], [1, '#1e6fb8']]),
      rad('cavern', [[0, '#2a3358'], [0.6, '#131a33'], [1, '#05070f']], 0.5, 0.45, 0.75),
      S('pattern', { id: 'bricks', width: 36, height: 18, patternUnits: 'userSpaceOnUse' },
        S('rect', { width: 36, height: 18, fill: 'none' }), S('path', { d: 'M0 .5H36M0 9.5H36M.5 0V9M18.5 9V18', stroke: '#0a0604', 'stroke-width': 1.4, fill: 'none', opacity: 0.55 }),
        S('path', { d: 'M2 2H16M20 11H34', stroke: '#c9a070', 'stroke-width': 1, opacity: 0.14 })),
      rad('torch', [[0, '#ffd27a', 0.55], [0.5, '#f97316', 0.18], [1, '#f97316', 0]]),
      rad('crys', [[0, '#b6ffcf', 0.9], [0.4, '#22c55e', 0.35], [1, '#22c55e', 0]]),
      rad('ipGlow', [[0, '#ffffff', 1], [0.3, '#fde68a', 0.7], [1, '#f59e0b', 0]]),
      rad('vig', [[0.55, '#000', 0], [1, '#000', 0.55]], 0.5, 0.5, 0.75),
      lin('beam', [[0, '#fde68a', 0], [0.5, '#fff7d6', 1], [1, '#fde68a', 0]], 'h'),
      lin('cone', [[0, '#fff3c4', 0.5], [1, '#fff3c4', 0]]),
      S('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' },
        S('feGaussianBlur', { stdDeviation: 3, result: 'b' }), S('feMerge', {}, S('feMergeNode', { in: 'b' }), S('feMergeNode', { in: 'SourceGraphic' }))),
      S('filter', { id: 'grain', x: 0, y: 0, width: '100%', height: '100%' },
        S('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, seed: 7 }),
        S('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 -0.35' })));
  }

  const tree = (x, y, k = 1) => S('g', { transform: `translate(${x} ${y}) scale(${k})` },
    S('rect', { x: -3, y: -14, width: 6, height: 16, fill: '#6b4423', ...ink(2) }),
    S('circle', { cx: 0, cy: -26, r: 15, fill: '#2f8f46', ...ink(2.2) }),
    S('circle', { cx: -7, cy: -22, r: 9, fill: '#46b35a' }), S('circle', { cx: 5, cy: -32, r: 6, fill: '#6fd17c', opacity: 0.8 }));

  const cloud = (x, y, k, op) => S('g', { transform: `translate(${x} ${y}) scale(${k})`, opacity: op },
    S('path', { d: 'M-34 8C-46 8-46-8-32-8C-30-24-6-26 0-12C12-22 34-14 30 4C44 4 44 14 30 14H-30C-34 14-34 8-34 8z', fill: '#fbe9f2', ...ink(2) }),
    S('path', { d: 'M-26 8H26', stroke: '#e3b8d6', 'stroke-width': 4, 'stroke-linecap': 'round' }));

  // cielo, montagne, prato: parte alta della scena.
  function skyland() {
    const g = S('g');
    g.append(S('rect', { width: W, height: GROUND + 10, fill: 'url(#sky)' }));
    const stars = [[30, 22], [70, 50], [120, 16], [160, 40], [210, 20], [250, 52], [300, 26], [340, 60], [95, 78], [330, 14]];
    stars.forEach(([x, y], i) => { const c = S('circle', { cx: x, cy: y, r: i % 3 ? 1.1 : 1.7, fill: '#fff', class: 'twinkle' }); c.style.animationDelay = `${(i * 0.37).toFixed(2)}s`; g.append(c); });
    g.append(S('circle', { cx: 262, cy: 128, r: 74, fill: 'url(#sunGlow)' }), S('circle', { cx: 262, cy: 128, r: 20, fill: '#fff1b8', ...ink(2) }));
    g.append(S('path', { d: 'M0 150L38 96L58 118L92 70L128 120L150 104L196 150L240 112L276 140L318 90L360 134V190H0z', fill: 'url(#mtnFar)', ...ink(2.2) }),
      S('path', { d: 'M82 82L92 70L102 84L96 80L92 86zM308 100L318 90L330 106L322 100L316 106z', fill: '#f5eefc', opacity: 0.9 }),
      S('path', { d: 'M0 168C40 142 90 146 130 164C170 150 220 146 262 162C300 150 330 152 360 166V196H0z', fill: 'url(#mtnNear)', ...ink(2.2) }));
    g.append(S('g', { class: 'drift' }, cloud(70, 52, 0.8, 0.9)), S('g', { class: 'drift slow' }, cloud(240, 34, 0.55, 0.75)));
    g.append(S('path', { d: `M0 ${GROUND - 4}C60 ${GROUND - 12} 120 ${GROUND + 2} 190 ${GROUND - 6}C250 ${GROUND - 14} 310 ${GROUND} 360 ${GROUND - 8}V${GROUND + 10}H0z`, fill: 'url(#grass)', ...ink(2.4) }));
    for (let i = 0; i < 16; i++) { const x = 8 + i * 22.5; g.append(S('path', { d: `M${x} ${GROUND + 6}l2-7l2 7M${x + 5} ${GROUND + 7}l2-6l2 6`, stroke: '#2a7a3a', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' })); }
    g.append(tree(112, GROUND + 2, 0.9), tree(138, GROUND + 4, 0.7), tree(222, GROUND + 2, 0.8), tree(345, GROUND + 4, 0.75));
    return g;
  }

  // sottosuolo: strati, rocce, fossile.
  function underground() {
    const g = S('g');
    g.append(S('rect', { x: 0, y: GROUND + 4, width: W, height: H - GROUND - 4, fill: 'url(#soil)', ...ink(2) }));
    for (let i = 0; i < 6; i++) {
      const y = GROUND + 44 + i * 58;
      g.append(S('path', { d: `M0 ${y}C70 ${y - 12} 140 ${y + 12} 220 ${y - 4}C280 ${y - 14} 330 ${y + 6} 360 ${y}V${y + 16}C320 ${y + 22} 270 ${y + 6} 210 ${y + 14}C140 ${y + 24} 70 ${y + 4} 0 ${y + 14}z`, fill: i % 2 ? '#52361f' : '#6b4a2c', opacity: 0.45 }));
    }
    const rocks = [[34, 262, 12, 8], [320, 300, 14, 9], [52, 430, 10, 7], [300, 470, 13, 8], [24, 358, 8, 6], [338, 396, 9, 6], [90, 506, 12, 7]];
    for (const [x, y, rx, ry] of rocks) g.append(S('ellipse', { cx: x, cy: y, rx, ry, fill: 'url(#rock)', ...ink(2) }), S('ellipse', { cx: x - rx * 0.3, cy: y - ry * 0.3, rx: rx * 0.35, ry: ry * 0.3, fill: '#c2a07c', opacity: 0.6 }));
    g.append(S('g', { transform: 'translate(316 238)' }, S('path', { d: 'M0 0a10 10 0 1 1 7 9a6 6 0 1 1-5-6a3 3 0 1 1-2 3', fill: 'none', stroke: '#d9c3a0', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.8 })));
    g.append(S('rect', { x: 0, y: GROUND + 4, width: W, height: H - GROUND - 4, fill: 'url(#bricks)', opacity: 0.6, 'pointer-events': 'none' }));
    for (const [x, y] of [[30, 230], [330, 230]]) {
      const t = S('g', { 'pointer-events': 'none' }, S('circle', { cx: x, cy: y, r: 62, fill: 'url(#torch)', class: 'flicker' }),
        S('rect', { x: x - 3, y: y, width: 6, height: 16, fill: '#5b3b22', ...ink(1.8) }),
        S('path', { d: `M${x} ${y - 14}C${x + 9} ${y - 4} ${x + 6} ${y + 2} ${x} ${y + 3}C${x - 6} ${y + 2} ${x - 9} ${y - 4} ${x} ${y - 14}z`, fill: '#fbbf24', ...ink(1.8), class: 'flicker' }));
      g.append(t);
    }
    for (const [x, y, k] of [[44, 484, 1], [318, 500, 1.2], [200, 524, 0.8]]) {
      g.append(S('g', { transform: `translate(${x} ${y}) scale(${k})`, 'pointer-events': 'none' }, S('circle', { r: 30, cy: -12, fill: 'url(#crys)', class: 'breathe' }),
        S('path', { d: 'M-10 0L-6-20L-1 0zM-2 0L4-30L11 0zM8 0L14-16L18 0z', fill: '#4ade80', ...ink(1.8) }), S('path', { d: 'M4-30L6-12L2-2z', fill: '#d9ffe6', opacity: 0.7 })));
    }
    g.append(S('path', { d: `M20 ${GROUND + 8}C14 ${GROUND + 30} 30 ${GROUND + 44} 22 ${GROUND + 70}M24 ${GROUND + 28}l12 8`, stroke: '#7a5532', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }));
    return g;
  }

  function controlRoom() {
    return S('g', {},
      S('rect', { x: 20, y: 124, width: 70, height: 54, fill: 'url(#wall)', ...ink(2.4) }),
      S('path', { d: 'M12 126L55 92L98 126z', fill: 'url(#roof)', ...ink(2.4) }),
      S('rect', { x: 70, y: 98, width: 10, height: 20, fill: '#8d9bb3', ...ink(2) }),
      S('rect', { x: 32, y: 140, width: 16, height: 16, fill: '#fcd34d', ...ink(2) }), S('rect', { x: 60, y: 140, width: 16, height: 16, fill: '#fcd34d', ...ink(2) }),
      S('rect', { x: 32, y: 140, width: 16, height: 16, fill: 'url(#cone)', opacity: 0.6 }),
      S('rect', { x: 46, y: 160, width: 14, height: 18, fill: '#5b3b22', ...ink(2) }),
      S('rect', { x: 8, y: 90, width: 96, height: 92, fill: 'transparent' }));
  }

  function dataCenter() {
    return S('g', {},
      S('rect', { x: 268, y: 130, width: 72, height: 48, fill: 'url(#wall)', ...ink(2.4) }),
      S('rect', { x: 262, y: 118, width: 84, height: 14, fill: 'url(#steel)', ...ink(2.4) }),
      S('path', { d: 'M334 118V96M326 96h16', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }),
      S('path', { d: 'M296 118L306 98L316 118', fill: 'url(#gold)', ...ink(2) }),
      S('rect', { x: 256, y: 94, width: 96, height: 90, fill: 'transparent' }));
  }

  // cunicolo del detector: sfondo della vista in sezione.
  function detBackdrop() {
    const g = S('g');
    g.append(S('rect', { width: W, height: H, fill: 'url(#cavern)' }));
    for (let i = 0; i < 6; i++) g.append(S('path', { d: `M${40 + i * 56} 0L${20 + i * 56} 120L${60 + i * 56} 120z`, fill: 'url(#cone)', opacity: 0.12 }));
    g.append(S('rect', { x: 0, y: 470, width: W, height: 70, fill: '#161d36', ...ink(2.4) }),
      S('path', { d: 'M0 470H360', stroke: '#3a4770', 'stroke-width': 3 }));
    for (let i = 0; i < 9; i++) g.append(S('rect', { x: i * 42 + 6, y: 482, width: 30, height: 6, rx: 2, fill: '#242e52' }));
    // culla di sostegno
    g.append(S('path', { d: 'M70 470L100 420H260L290 470z', fill: 'url(#steel)', ...ink(3) }),
      S('path', { d: 'M96 428H264', stroke: '#8fa0c4', 'stroke-width': 2, opacity: 0.6 }));
    // travi e cavi
    g.append(S('rect', { x: 0, y: 70, width: 14, height: 400, fill: 'url(#steel)', ...ink(2.4) }), S('rect', { x: 346, y: 70, width: 14, height: 400, fill: 'url(#steel)', ...ink(2.4) }),
      S('path', { d: 'M14 110C60 150 40 230 14 260M346 100C300 150 320 240 346 280', stroke: '#e0483f', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }),
      S('path', { d: 'M14 130C70 180 50 250 14 300M346 130C290 190 316 260 346 320', stroke: '#38bdf8', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }));
    return g;
  }

  const wedge = (cx, cy, ri, ro, a0, a1) => {
    const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    return `M${p(ri, a0)}L${p(ro, a0)}A${ro} ${ro} 0 0 1 ${p(ro, a1)}L${p(ri, a1)}A${ri} ${ri} 0 0 0 ${p(ri, a0)}z`;
  };

  const vignette = () => S('rect', { width: W, height: H, fill: 'url(#vig)', 'pointer-events': 'none' });
  const grain = () => S('rect', { width: W, height: H, filter: 'url(#grain)', opacity: 0.07, 'pointer-events': 'none' });

  window.SceneArt = { INK, W, H, GROUND, ink, defs, skyland, underground, controlRoom, dataCenter, detBackdrop, wedge, vignette, grain };
})();
