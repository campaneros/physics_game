import { SceneView } from '../scene/SceneView.jsx';
import { CommandDeck } from './CommandDeck.jsx';

// Scena SVG (sito e detector) e riga delle quattro azioni.
export function SiteView() {
  return (
    <div id="site-host">
      <SceneView />
      <CommandDeck />
    </div>
  );
}
