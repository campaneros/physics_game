import { Defs, Backdrop } from './ds/Defs.jsx';
import { TopBar } from './shell/TopBar.jsx';
import { Ticker, TabBar, Viewport, OverlayFrame } from './shell/Chrome.jsx';

export function App() {
  return (
    <>
      <Defs />
      <Backdrop />
      <TopBar />
      <Ticker />
      <Viewport />
      <TabBar />
      <OverlayFrame />
    </>
  );
}
