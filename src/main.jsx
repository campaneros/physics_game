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
import { start } from './runtime.js';

// window.Popups: il runtime (notizie, tutorial) e i test aprono i popup da fuori da React.
window.Popups = Popups;
const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(<App />)); // render sincrono: il runtime parte con la UI già nel DOM
start();
