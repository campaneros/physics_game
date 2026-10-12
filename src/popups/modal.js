// Popup React dentro la cornice #overlay. Riusa UI.showOverlay (cronologia di Android, classe body.modal, pulizia alla chiusura).
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { UI } from '../engine.js';

export function openModal(node) {
  UI.showOverlay((body) => {
    // contenitore proprio: closeOverlay svuota il body, e l'unmount di React deve trovare i suoi nodi ancora al loro posto
    const host = document.createElement('div');
    body.append(host);
    const root = createRoot(host);
    flushSync(() => root.render(node));
    return () => root.unmount();
  });
}
