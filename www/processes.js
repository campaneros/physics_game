// Dati di gioco: collisori, detector, trigger e processi fisici. VALORI STILIZZATI (ordini di grandezza):
// sono tutti qui, non nel codice, così si possono correggere senza toccare la logica.
(function (root) {
  'use strict';

  // Collisori: energie disponibili (√s in GeV) e scala di segnale/fondo/luminosità rispetto all'adronico.
  const COLLIDERS = {
    pp: { energies: [2, 10, 30, 100, 300, 1000, 2000, 7000, 14000], sig: 1, bkg: 1, lumi: 1 },
    ee: { energies: [2, 10, 30, 91, 160, 250, 350, 500], sig: 0.02, bkg: 0.0003, lumi: 2 },
  };
  const COLLIDER_SWITCH = { years: 3, cost: 2000 };
  const ACCELERATOR = { years: 0.5, cost: 250 }; // costruzione iniziale dell'anello

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
  const RAW = [
    { id: 'rho', kind: 'discovery', type: 'peak', menu: 'muon', mass: 0.77, res0: 0.05, thr: { pp: 2, ee: 2 }, need: { tracker: 1, muon: 1 }, L5: 3, sb: 1.0, value: 1, rival: 3, tier: 0, after: [] },
    { id: 'jpsi', kind: 'discovery', type: 'peak', menu: 'muon', mass: 3.1, res0: 0.03, thr: { pp: 10, ee: 10 }, need: { tracker: 1, muon: 1 }, L5: 15, sb: 2.0, value: 1, rival: 6, tier: 0, after: ['rho'] },
    { id: 'upsilon', kind: 'discovery', type: 'peak', menu: 'muon', mass: 9.46, res0: 0.02, thr: { pp: 30, ee: 30 }, need: { tracker: 1, muon: 2 }, L5: 60, sb: 1.0, value: 1.5, rival: 14, tier: 0, after: ['jpsi'] },
    { id: 'w', kind: 'discovery', type: 'peak', menu: 'met', mass: 80.4, res0: 0.1, thr: { pp: 300, ee: 160 }, need: { ecal: 1, hcal: 1, muon: 1 }, L5: 300, sb: 0.5, value: 2, rival: 16, tier: 1, after: ['upsilon'] },
    { id: 'z', kind: 'discovery', type: 'peak', menu: 'muon', mass: 91.2, res0: 0.03, thr: { pp: 300, ee: 91 }, need: { tracker: 1, ecal: 1, muon: 2 }, L5: 600, sb: 3.0, value: 2, rival: 16, tier: 1, after: ['w'] },
    { id: 'top', kind: 'discovery', type: 'nonres', menu: 'jet', mass: 173, res0: 0.12, thr: { pp: 2000, ee: 350 }, need: { tracker: 2, ecal: 1, hcal: 2, muon: 1 }, L5: 2000, sb: 0.3, value: 3, rival: 18, tier: 1, after: ['z'] },
    { id: 'higgs', kind: 'discovery', type: 'peak', menu: 'egamma', mass: 125, res0: 0.012, thr: { pp: 7000, ee: 250 }, need: { tracker: 2, ecal: 3, muon: 2 }, L5: 8000, sb: 0.05, value: 5, rival: 36, tier: 2, after: ['top'] },
    { id: 'hbb', kind: 'measure', type: 'precision', menu: 'btag', mass: 125, res0: 0.12, thr: { pp: 7000, ee: 250 }, need: { tracker: 3, ecal: 2, hcal: 3 }, L5: 20000, sb: 0.02, goal: 0.3, syst: 0.1, value: 3, rival: 16, tier: 2, after: ['higgs'] },
    { id: 'hmumu', kind: 'measure', type: 'rare', menu: 'muon', mass: 125, res0: 0.015, thr: { pp: 7000, ee: 250 }, need: { tracker: 3, ecal: 2, muon: 3 }, L5: 40000, sb: 0.01, goal: 0.4, syst: 0.15, value: 3, rival: 14, tier: 2, after: ['higgs'] },
    { id: 'tth', kind: 'measure', type: 'precision', menu: 'jet', mass: 300, res0: 0.1, thr: { pp: 14000, ee: 500 }, need: { tracker: 3, ecal: 2, hcal: 3, muon: 2 }, L5: 80000, sb: 0.05, goal: 0.3, syst: 0.12, value: 3, rival: 16, tier: 3, after: ['hbb'] },
    { id: 'hh', kind: 'discovery', type: 'nonres', menu: 'btag', mass: 250, res0: 0.1, thr: { pp: 14000, ee: 500 }, need: { tracker: 3, ecal: 3, hcal: 3, muon: 2 }, L5: 300000, sb: 0.02, value: 8, rival: 28, tier: 3, after: ['hmumu', 'tth'] },
    { id: 'zprime', kind: 'search', type: 'peak', menu: 'muon', mass: 3000, res0: 0.03, thr: { pp: 7000, ee: 500 }, need: { tracker: 2, ecal: 2, muon: 3 }, L5: 20000, sb: 0.1, value: 6, rival: 22, tier: 3, existsP: 0.35, after: ['higgs'] },
  ];

  // segnale/fondo per fb⁻¹ prima delle efficienze, da (L5, S/B) imponendo Z≈5 a L5.
  const derive = (r) => {
    const b5 = (5 / r.sb) ** 2;
    return { goal: 0, syst: 0.1, existsP: 0.35, ...r, sig: (r.sb * b5) / (r.L5 * REF_EFF_S), bkg: b5 / (r.L5 * REF_EFF_B) };
  };

  const PROCESSES = RAW.map(derive);
  const BY_ID = new Map(PROCESSES.map((p) => [p.id, p]));

  const api = { COLLIDERS, COLLIDER_SWITCH, ACCELERATOR, DETECTOR, MENU_RATE, TIERS, PROCESSES, BY_ID, REF_EFF_S, REF_EFF_B };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Processes = api;
})(typeof self !== 'undefined' ? self : globalThis);
