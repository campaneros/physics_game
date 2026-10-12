// Dati di gioco: collisori, detector, trigger e processi fisici. VALORI STILIZZATI (ordini di grandezza):
// sono tutti qui, non nel codice, così si possono correggere senza toccare la logica.
(function (root) {
  'use strict';

  // Collisori: energie disponibili (√s in GeV) e scala di segnale/fondo/luminosità rispetto all'adronico.
  const COLLIDERS = {
    // cost: costruzione dell'anello; runMul: costo delle corse; maxSlots: misure in parallelo con un solo fascio (adroni: fino a 1 + livello DAQ)
    pp: { energies: [2, 10, 30, 100, 300, 1000, 2000, 7000, 14000], sig: 1, bkg: 1, lumi: 1, cost: 350, runMul: 1.3, maxSlots: 4 },
    ee: { energies: [2, 10, 30, 91, 160, 250, 350, 500], sig: 0.02, bkg: 0.0003, lumi: 2, cost: 200, runMul: 0.75, maxSlots: 1 },
  };
  const COLLIDER_SWITCH = { years: 3, cost: 2000 };
  const ACCELERATOR = { years: 0.5 }; // costruzione iniziale dell'anello (il costo dipende dal collisore)

  // Sottosistemi del detector: livelli 0..4, anni di installazione e costo base (fondi).
  const DETECTOR = {
    subsystems: ['tracker', 'ecal', 'hcal', 'muon', 'daq'],
    maxLevel: 4,
    years: { tracker: 3, ecal: 3.5, hcal: 3.5, muon: 2, daq: 1.5 },
    baseCost: { tracker: 150, ecal: 200, hcal: 200, muon: 120, daq: 100 },
    start: { tracker: 0, ecal: 0, hcal: 0, muon: 0, daq: 0 },
    firstLevel: 0.25, // il primo livello di un sottosistema si installa in un quarto del tempo
    aging: ['tracker', 'ecal'], // si degradano con la radiazione finché non vengono sostituiti
  };

  // Frequenza grezza del trigger per menu (unità arbitrarie, cresce con la luminosità).
  // Sottosistemi che migliorano le misure di ogni menu di trigger (oltre a quelli richiesti dal processo): peso 1 = principale, 0.5 = di supporto.
  const MENU_SUBS = {
    muon: { muon: 1, tracker: 0.5 }, egamma: { ecal: 1, tracker: 0.5 }, jet: { hcal: 1, ecal: 0.5 },
    met: { hcal: 1, ecal: 0.5 }, btag: { tracker: 1, hcal: 0.5 },
  };
  // Tagli di analisi: ogni menu di trigger ha 3 tagli utili; gli altri sono inutili e fanno perdere segnale.
  const CUTS = ['window', 'iso', 'lepid', 'jetveto', 'btag', 'met', 'vtx', 'pt'];
  const MENU_CUTS = {
    muon: ['lepid', 'iso', 'window'], egamma: ['iso', 'window', 'vtx'], jet: ['pt', 'jetveto', 'window'],
    met: ['met', 'jetveto', 'pt'], btag: ['btag', 'vtx', 'pt'],
  };
  const MAX_CUTS = 3;
  const MENU_RATE = { muon: 1.2, egamma: 2, jet: 6, met: 3, btag: 5 };

  const CONVEX = ['triangolo', 'quadrato', 'rettangolo', 'pentagono', 'esagono', 'rombo'];
  const ALL = [...CONVEX, 'L', 'T', 'stella', 'freccia'];
  // Difficoltà della conferma (minigioco) per livello del processo.
  const TIERS = [
    { maxLaunches: 15, pool: CONVEX },
    { maxLaunches: 12, pool: [...CONVEX, 'L', 'T'] },
    { maxLaunches: 10, pool: ALL },
    { maxLaunches: 8, pool: ALL },
  ];

  // Efficienze combinate di riferimento, usate per ricavare segnale e fondo da L5 e S/B (calibrate da check-game.js).
  const REF_EFF_S = 0.21;
  const REF_EFF_B = 0.05;

  // kind: discovery | measure | search.  type: peak | rare | nonres | precision (forma del segnale).
  // L5: luminosità integrata (fb⁻¹) per 5σ con detector adeguato; sb: S/B atteso lì; thr: √s minima per collisore.
  // Il catalogo è scritto in forma compatta: [id, kind, type, menu, massa GeV, soglia pp, soglia ee, requisiti, tier, dopo, L5].
  // I valori derivati (risoluzione, S/B, premio, obiettivo di precisione) vengono dal tier e dal tipo.
  const TIER_SB = [1.0, 0.4, 0.08, 0.05]; // S/B tipico per tier
  const RES = { peak: [0.03, 0.05, 0.015, 0.012], rare: [0.03, 0.03, 0.015, 0.015], nonres: [0.12, 0.12, 0.12, 0.1], precision: [0.1, 0.1, 0.1, 0.1] };
  const VALUE = [1, 2, 3.5, 5];
  const T = (tr, ec, hc, mu) => ({ ...(tr ? { tracker: tr } : {}), ...(ec ? { ecal: ec } : {}), ...(hc ? { hcal: hc } : {}), ...(mu ? { muon: mu } : {}) });

  const CATALOG = [
    // tier 0: mesoni leggeri e quarkonia (energie basse, tracciatore e muoni)
    ['rho', 'discovery', 'peak', 'muon', 0.77, 2, 2, T(1, 0, 0, 1), 0, [], 22],
    ['omega', 'discovery', 'peak', 'muon', 0.78, 2, 2, T(1, 0, 0, 1), 0, ['rho'], 51],
    ['phi', 'discovery', 'peak', 'muon', 1.02, 2, 2, T(1, 0, 0, 1), 0, ['rho'], 120],
    ['kstar', 'discovery', 'peak', 'jet', 0.89, 2, 2, T(1, 0, 1, 0), 0, ['phi'], 76],
    ['jpsi', 'discovery', 'peak', 'muon', 3.1, 10, 10, T(1, 0, 0, 1), 0, ['rho'], 110.00000000000001],
    ['psi2s', 'discovery', 'peak', 'muon', 3.69, 10, 10, T(1, 0, 0, 1), 0, ['jpsi'], 350],
    ['jpsi_xs', 'measure', 'precision', 'muon', 3.1, 10, 10, T(1, 0, 0, 1), 0, ['jpsi'], 270],
    ['upsilon', 'discovery', 'peak', 'muon', 9.46, 30, 30, T(1, 0, 0, 2), 0, ['jpsi'], 200],
    ['ups23', 'discovery', 'peak', 'muon', 10.0, 30, 30, T(1, 0, 0, 2), 0, ['upsilon'], 110.00000000000001],
    // tier 1: elettrodebole e fisica del sapore
    ['w', 'discovery', 'peak', 'met', 80.4, 300, 160, T(0, 1, 1, 1), 1, ['upsilon'], 210],
    ['z', 'discovery', 'peak', 'muon', 91.2, 300, 91, T(1, 1, 0, 2), 1, ['w'], 229.99999999999997],
    ['b_lifetime', 'measure', 'precision', 'btag', 5.3, 100, 91, T(2, 0, 0, 0), 1, ['upsilon'], 310],
    ['lambdab', 'discovery', 'peak', 'muon', 5.6, 100, 91, T(2, 0, 0, 2), 1, ['upsilon'], 1800],
    ['bs_mumu', 'discovery', 'rare', 'muon', 5.37, 100, 91, T(3, 0, 0, 2), 1, ['upsilon'], 229.99999999999997],
    ['bmix', 'measure', 'precision', 'btag', 5.3, 100, 91, T(3, 0, 0, 0), 1, ['b_lifetime'], 1500],
    ['w_mass', 'measure', 'precision', 'met', 80.4, 300, 160, T(0, 2, 2, 1), 1, ['w'], 2200],
    ['z_width', 'measure', 'precision', 'muon', 91.2, 300, 91, T(2, 2, 0, 2), 1, ['z'], 6300],
    ['sin2w', 'measure', 'precision', 'egamma', 91.2, 300, 91, T(2, 2, 0, 2), 1, ['z'], 8300],
    ['ww', 'discovery', 'nonres', 'met', 160, 1000, 160, T(0, 2, 2, 1), 1, ['w'], 7700],
    ['wz', 'discovery', 'nonres', 'met', 171, 1000, 250, T(0, 2, 2, 2), 1, ['w', 'z'], 8700],
    ['zz', 'discovery', 'rare', 'muon', 182, 1000, 250, T(2, 2, 0, 2), 1, ['z'], 9300],
    // tier 2: top e Higgs
    ['top', 'discovery', 'nonres', 'jet', 173, 2000, 350, T(2, 1, 2, 1), 2, ['z'], 3400],
    ['top_xs', 'measure', 'precision', 'jet', 173, 2000, 350, T(2, 2, 2, 1), 2, ['top'], 4300],
    ['single_top', 'discovery', 'nonres', 'jet', 173, 2000, 350, T(2, 1, 2, 1), 2, ['top'], 6700],
    ['top_mass', 'measure', 'precision', 'jet', 173, 2000, 350, T(2, 2, 3, 1), 2, ['top'], 7800],
    ['top_spin', 'measure', 'precision', 'jet', 173, 2000, 350, T(2, 2, 3, 2), 2, ['top_mass'], 8600],
    ['wz_pol', 'measure', 'precision', 'met', 171, 2000, 250, T(0, 2, 3, 2), 2, ['wz'], 8300],
    ['tt_gamma', 'discovery', 'rare', 'egamma', 173, 2000, 350, T(2, 3, 2, 1), 2, ['top'], 7800],
    ['higgs', 'discovery', 'peak', 'egamma', 125, 7000, 250, T(2, 3, 0, 2), 2, ['top'], 7800],
    ['h_mass', 'measure', 'precision', 'egamma', 125, 7000, 250, T(2, 3, 0, 2), 2, ['higgs'], 6900],
    ['h_ww', 'discovery', 'nonres', 'met', 125, 7000, 250, T(0, 2, 3, 2), 2, ['higgs'], 6900],
    ['h_tautau', 'discovery', 'nonres', 'jet', 125, 7000, 250, T(3, 2, 3, 0), 2, ['higgs'], 6800],
    ['vbfh', 'discovery', 'nonres', 'jet', 125, 7000, 250, T(2, 2, 3, 2), 2, ['higgs'], 6800],
    ['hbb', 'measure', 'precision', 'btag', 125, 7000, 250, T(3, 2, 3, 0), 2, ['higgs'], 6900],
    ['hmumu', 'measure', 'rare', 'muon', 125, 7000, 250, T(3, 2, 0, 3), 2, ['higgs'], 6900],
    ['hcc', 'measure', 'precision', 'btag', 125, 7000, 250, T(3, 2, 3, 0), 2, ['hbb'], 6000],
    ['hzg', 'discovery', 'rare', 'egamma', 125, 7000, 250, T(3, 3, 0, 3), 2, ['higgs'], 7100],
    ['h_width', 'measure', 'precision', 'egamma', 125, 7000, 250, T(3, 3, 0, 3), 2, ['h_mass'], 6600],
    // tier 3: fisica oltre il Modello Standard e processi rarissimi
    ['tth', 'measure', 'precision', 'jet', 300, 14000, 500, T(3, 2, 3, 2), 3, ['hbb'], 6600],
    ['www', 'discovery', 'rare', 'met', 240, 14000, 500, T(3, 3, 3, 3), 3, ['ww', 'higgs'], 6900],
    ['ttz', 'discovery', 'rare', 'muon', 264, 14000, 500, T(3, 3, 3, 3), 3, ['tth'], 3800],
    ['vbs', 'discovery', 'nonres', 'jet', 160, 14000, 500, T(3, 3, 3, 2), 3, ['ww', 'zz'], 7600],
    ['h_cp', 'measure', 'precision', 'egamma', 125, 14000, 500, T(3, 3, 3, 3), 3, ['h_width'], 4700],
    ['four_top', 'discovery', 'rare', 'jet', 692, 14000, 500, T(3, 3, 3, 3), 3, ['tth'], 3700],
    ['hh', 'discovery', 'nonres', 'btag', 250, 14000, 500, T(3, 3, 3, 2), 3, ['hmumu', 'tth'], 4200],
    ['h_self', 'measure', 'precision', 'btag', 250, 14000, 500, T(4, 3, 4, 3), 3, ['hh'], 2200],
    // ricerche di nuova fisica (possono non trovare nulla: si migliora un pezzo del detector e si ritenta, o si pone un limite)
    ['zprime', 'search', 'peak', 'muon', 3000, 7000, 500, T(2, 2, 0, 3), 3, ['higgs'], 6800],
    ['wprime', 'search', 'peak', 'met', 4000, 14000, 500, T(0, 3, 3, 3), 3, ['higgs'], 6900],
    ['leptoquark', 'search', 'peak', 'egamma', 1500, 14000, 500, T(2, 3, 2, 2), 3, ['higgs'], 6700],
    ['dm_mono', 'search', 'nonres', 'met', 1000, 14000, 500, T(0, 3, 3, 2), 3, ['higgs'], 6800],
    ['heavy_nu', 'search', 'peak', 'muon', 2000, 14000, 500, T(3, 2, 0, 3), 3, ['higgs'], 6700],
    ['gluino', 'search', 'nonres', 'jet', 2000, 14000, 500, T(2, 3, 3, 2), 3, ['top'], 7600],
    ['graviton', 'search', 'peak', 'egamma', 3000, 14000, 500, T(2, 3, 2, 3), 3, ['higgs'], 6800],
    ['squark', 'search', 'nonres', 'jet', 1800, 14000, 500, T(2, 3, 3, 2), 3, ['top'], 7300],
    ['charged_h', 'search', 'nonres', 'btag', 800, 14000, 500, T(3, 3, 3, 2), 3, ['hbb'], 3600],
    ['stop', 'search', 'nonres', 'btag', 1200, 14000, 500, T(3, 3, 3, 3), 3, ['top'], 7200],
  ];

  // Anni (dalla disponibilità) dopo cui un esperimento rivale pubblica: ~3× la durata di un giocatore esperto (tools/rivals.js).
  const RIVAL = { rho: 11, omega: 13, phi: 25, jpsi: 37, kstar: 17, jpsi_xs: 22, psi2s: 28, upsilon: 39, ups23: 10, b_lifetime: 27, w: 30, bs_mumu: 48, z: 18, bmix: 41, lambdab: 70, w_mass: 45, z_width: 33, top: 41, sin2w: 41, ww: 71, single_top: 35, top_xs: 36, wz: 83, top_mass: 45, tt_gamma: 53, stop: 75, higgs: 81, squark: 81, wz_pol: 43, gluino: 98, leptoquark: 34, vbfh: 38, h_tautau: 40, heavy_nu: 59, zprime: 73, dm_mono: 78, h_mass: 80, h_width: 14, h_ww: 96, hbb: 99, hmumu: 110, h_cp: 24, charged_h: 23, hcc: 24, tth: 26, graviton: 129, four_top: 21, ttz: 33, hh: 42, www: 170, top_spin: 216, zz: 303, hzg: 200, h_self: 36, wprime: 210, vbs: 51 };

  const RAW = CATALOG.map(([id, kind, type, menu, mass, pp, ee, need, tier, after, L5]) => ({
    id, kind, type, menu, mass, res0: RES[type][tier] * (type === 'peak' && tier === 0 ? 1 + 0.5 * (mass < 2) : 1), thr: { pp, ee }, need, L5,
    sb: TIER_SB[tier] * (type === 'rare' ? 0.3 : type === 'nonres' ? 0.5 : 1), value: VALUE[tier] * (kind === 'search' ? 1.4 : kind === 'measure' ? 0.9 : 1),
    rival: RIVAL[id] || 99, tier, after,
    ...(kind === 'measure' ? { goal: 0.3, syst: 0.1 } : {}), ...(kind === 'search' ? { existsP: 0.35 } : {}),
  }));

  // segnale/fondo per fb⁻¹ prima delle efficienze, da (L5, S/B) imponendo Z≈5 a L5.
  const derive = (r) => {
    const b5 = (5 / r.sb) ** 2;
    return { goal: 0, syst: 0.1, existsP: 0.35, ...r, sig: (r.sb * b5) / (r.L5 * REF_EFF_S), bkg: b5 / (r.L5 * REF_EFF_B) };
  };

  const PROCESSES = RAW.map(derive);
  const BY_ID = new Map(PROCESSES.map((p) => [p.id, p]));

  const api = { COLLIDERS, COLLIDER_SWITCH, ACCELERATOR, DETECTOR, MENU_SUBS, CUTS, MENU_CUTS, MAX_CUTS, MENU_RATE, TIERS, PROCESSES, BY_ID, REF_EFF_S, REF_EFF_B };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Processes = api;
})(typeof self !== 'undefined' ? self : globalThis);
