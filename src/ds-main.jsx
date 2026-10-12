// Vetrina del design system (ds.html): componenti isolati, senza motore di gioco.
import { createRoot } from 'react-dom/client';
import './ds/tokens.css';
import './ds/ds.css';
import { Gallery } from './ds/Gallery.jsx';

createRoot(document.getElementById('root')).render(<Gallery />);
