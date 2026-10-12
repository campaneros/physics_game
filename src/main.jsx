import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import './ds/tokens.css';
import './ds/ds.css';
import './shell/shell.css';
import './site/site.css';
import { App } from './App.jsx';

// Render sincrono: i moduli vecchi si montano nei contenitori (#site-host, …) all'evento load, che arriva dopo questo script.
const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(<App />));
