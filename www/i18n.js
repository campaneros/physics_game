// Traduzioni EN/IT. La lingua parte da quella del telefono (italiano → it, altrimenti en) e si cambia con il pulsante in alto.
// Il testo dinamico si inserisce sempre con textContent: qui non c'è HTML.
(function (root) {
  'use strict';

  const KEY = 'accel-lang';
  const LANGS = ['en', 'it'];

  const DICT = {
    en: {
      'app.title': 'Accelerator',
      'lang.switch': 'IT',
      'hud.energy': 'Energy', 'tab.play': 'Challenge', 'tab.budget': 'Budget',
      'aria.sections': 'Sections',                                                                                                       'budget.note.locked': 'Budget mode: unlocks after the first Long Shutdown.',
            'banner.away': 'Welcome back! {t} of data credited while you were away.',
                        'overlay.confirm': 'Confirm: {name}',
      'mode.daily': 'Daily challenge', 'mode.free': 'Free game', 'mode.freescenario': 'Free scenario',
      'share.btn': 'Share', 'share.done': 'Done!', 'share.fail': 'Failed',
            'mg.status': '{label} · Launches: {n}/{max}',
      'mg.aria': 'Game arena: launch particles and watch where they exit',
      'mg.hint.play': 'Touch near an edge and drag inward, then release to launch.',
      'mg.hint.inward': 'Drag inward to launch.',
      'mg.hint.max': 'No launches left: pick the shape.',
      'mg.hint.after': 'Where did it exit? Try another launch or pick the shape.',
      'mg.hint.needlaunch': 'Make at least one launch before answering.',
      'mg.cancel': 'Cancel', 'mg.new': 'New game', 'mg.continue': 'Continue',
      'mg.right': 'Correct! It was: {shape}. {launches}, {pts} points.',
      'mg.wrong': 'Wrong. It was: {shape}. 0 points.',
      'launch.one': '{n} launch', 'launch.other': '{n} launches',
      'share.shape': 'The Hidden Shape{day}\n{mark} {launches} · {pts}/100',
      'shape.triangolo': 'Triangle', 'shape.quadrato': 'Square', 'shape.rettangolo': 'Rectangle',
      'shape.pentagono': 'Pentagon', 'shape.esagono': 'Hexagon', 'shape.rombo': 'Rhombus',
      'shape.stella': 'Star', 'shape.L': 'L', 'shape.T': 'T', 'shape.freccia': 'Arrow',
      'bg.item.lumi.name': 'Luminosity', 'bg.item.lumi.desc': 'More collisions, but more pile-up and radiation damage',
      'bg.item.trigger.name': 'Trigger', 'bg.item.trigger.desc': 'Selects more useful events',
      'bg.item.risoluzione.name': 'Resolution', 'bg.item.risoluzione.desc': 'More precise detector',
      'bg.item.calibrazione.name': 'Calibration', 'bg.item.calibrazione.desc': 'Reduces the systematic error',
      'bg.item.calcolo.name': 'Computing', 'bg.item.calcolo.desc': 'Processes the data flow: if it is not enough, you lose events',
      'res.zprime': 'Z′ (hypothetical)', 'res.x3872': 'X(3872)', 'res.ups3s': 'Υ(3S)',
      'res.z': 'Z boson', 'res.higgs': 'Higgs boson', 'res.top': 'Top quark',
      'bg.title': 'Measure the mass: {res}',
      'bg.intro': '{label}. Distribute {budget} units among the items. You have {sims} simulations to work out where to invest, then publish: only the final precision counts.',
      'bg.remaining': 'Budget left: {left} / {total}',
      'bg.sim': 'Simulate ({n} left)', 'bg.publish': 'Publish result',
      'bg.logline': 'statistical {s} · systematic {y} · total {t}',
      'bg.score': 'Precision {p} · {pts}/100',
      'bg.optimum': 'Reference optimum: {o}. Optimal allocation: {alloc}.',
      'bg.newscenario': 'New scenario',
      'bg.share': 'Accelerator · Budget{day}\n🎯 {pts}/100',
    },
    it: {
      'app.title': 'Acceleratore',
      'lang.switch': 'EN',
      'hud.energy': 'Energia', 'tab.play': 'Sfida', 'tab.budget': 'Budget',
      'aria.sections': 'Sezioni',                                                                                                       'budget.note.locked': 'Modalità budget: si sblocca dopo il primo Long Shutdown.',
            'banner.away': 'Bentornato! {t} di dati accreditati mentre eri via.',
                        'overlay.confirm': 'Conferma: {name}',
      'mode.daily': 'Sfida del giorno', 'mode.free': 'Partita libera', 'mode.freescenario': 'Scenario libero',
      'share.btn': 'Condividi', 'share.done': 'Fatto!', 'share.fail': 'Non riuscito',
            'mg.status': '{label} · Lanci: {n}/{max}',
      'mg.aria': 'Arena di gioco: lancia particelle e osserva dove escono',
      'mg.hint.play': 'Tocca vicino a un bordo e trascina verso l\'interno, poi rilascia per lanciare.',
      'mg.hint.inward': 'Trascina verso l\'interno per lanciare.',
      'mg.hint.max': 'Lanci finiti: scegli la forma.',
      'mg.hint.after': 'Dove è uscita? Prova un altro lancio o scegli la forma.',
      'mg.hint.needlaunch': 'Fai almeno un lancio prima di rispondere.',
      'mg.cancel': 'Annulla', 'mg.new': 'Nuova partita', 'mg.continue': 'Continua',
      'mg.right': 'Esatto! Era: {shape}. {launches}, {pts} punti.',
      'mg.wrong': 'Sbagliato. Era: {shape}. 0 punti.',
      'launch.one': '{n} lancio', 'launch.other': '{n} lanci',
      'share.shape': 'La forma nascosta{day}\n{mark} {launches} · {pts}/100',
      'shape.triangolo': 'Triangolo', 'shape.quadrato': 'Quadrato', 'shape.rettangolo': 'Rettangolo',
      'shape.pentagono': 'Pentagono', 'shape.esagono': 'Esagono', 'shape.rombo': 'Rombo',
      'shape.stella': 'Stella', 'shape.L': 'L', 'shape.T': 'T', 'shape.freccia': 'Freccia',
      'bg.item.lumi.name': 'Luminosità', 'bg.item.lumi.desc': 'Più collisioni, ma più pile-up e danni da radiazione',
      'bg.item.trigger.name': 'Trigger', 'bg.item.trigger.desc': 'Seleziona più eventi utili',
      'bg.item.risoluzione.name': 'Risoluzione', 'bg.item.risoluzione.desc': 'Rivelatore più preciso',
      'bg.item.calibrazione.name': 'Calibrazione', 'bg.item.calibrazione.desc': 'Riduce l\'errore sistematico',
      'bg.item.calcolo.name': 'Calcolo', 'bg.item.calcolo.desc': 'Elabora il flusso di dati: se non basta, perdi eventi',
      'res.zprime': 'Z′ (ipotetica)', 'res.x3872': 'X(3872)', 'res.ups3s': 'Υ(3S)',
      'res.z': 'Bosone Z', 'res.higgs': 'Bosone di Higgs', 'res.top': 'Quark top',
      'bg.title': 'Misura la massa: {res}',
      'bg.intro': '{label}. Distribuisci {budget} unità tra le voci. Hai {sims} simulazioni per capire dove investire, poi pubblica: conta solo la precisione finale.',
      'bg.remaining': 'Budget rimasto: {left} / {total}',
      'bg.sim': 'Simula ({n} rimaste)', 'bg.publish': 'Pubblica il risultato',
      'bg.logline': 'statistica {s} · sistematica {y} · totale {t}',
      'bg.score': 'Precisione {p} · {pts}/100',
      'bg.optimum': 'Ottimo di riferimento: {o}. Allocazione ottima: {alloc}.',
      'bg.newscenario': 'Nuovo scenario',
      'bg.share': 'Acceleratore · Budget{day}\n🎯 {pts}/100',
    },
  };

  const hasWindow = typeof window !== 'undefined' && typeof document !== 'undefined';

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function detect() {
    const s = stored();
    if (LANGS.includes(s)) return s;
    const nav = typeof navigator !== 'undefined' && navigator.language ? navigator.language : '';
    return /^it\b/i.test(nav) ? 'it' : 'en';
  }

  let lang = detect();

  // Segnaposto {nome}; chiave mancante → inglese → la chiave stessa (visibile in test).
  function t(key, vars) {
    const text = DICT[lang][key] ?? DICT.en[key] ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
  }

  // Plurale semplice: 'launch.one' / 'launch.other'.
  const plural = (base, n, vars) => t(`${base}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });

  function setLang(next) {
    if (!LANGS.includes(next)) return;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage non disponibile */ }
  }

  const getLang = () => lang;
  const otherLang = () => LANGS.find((l) => l !== lang);

  // Traduce il testo statico dell'HTML: data-i18n → textContent, data-i18n-aria → aria-label.
  function apply() {
    if (!hasWindow) return;
    document.documentElement.lang = lang;
    document.title = t('app.title');
    document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((e) => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
  }

  const api = { DICT, LANGS, t, plural, setLang, getLang, otherLang, apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18n = api;
})(typeof self !== 'undefined' ? self : globalThis);
