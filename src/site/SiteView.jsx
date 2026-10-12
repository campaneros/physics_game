import { CommandDeck } from './CommandDeck.jsx';

// #scene-host: scene.js vi disegna la sezione del sito/detector; la mano di carte è un componente React.
export function SiteView() {
  return (
    <div id="site-host">
      <div id="scene-host" />
      <CommandDeck />
    </div>
  );
}
