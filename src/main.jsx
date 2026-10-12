import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import './ds/tokens.css';
import './base.css';
import './ds/ds.css';
import './shell/shell.css';
import './site/site.css';
import './site/scene.css';
import './physics/physics.css';
import './popups/popups.css';
import './budget/budget.css';
import './play/minigame.css';
import { App } from './App.jsx';
import { Popups } from './popups/api.js';

// Render sincrono: i moduli vecchi si montano nei contenitori (#site-host, …) all'evento load, che arriva dopo questo script.
// i moduli vecchi (scena, ciclo di gioco) aprono i popup tramite window.Popups
window.Popups = Popups;
const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(<App />));
