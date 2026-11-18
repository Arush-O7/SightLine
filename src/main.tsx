import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/geist';
import '@fontsource/bebas-neue';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import './styles.css';
import App from './App';
import { loadArtFonts } from './lib/art';
import { loadCatalog } from './lib/catalog';

const root = createRoot(document.getElementById('root')!);

// the posters are painted on canvas, so make sure their typefaces are ready first, and
// apply the cinema's own titles, prices and schedule before anything is listed (without waiting long)
const schedule = loadCatalog().catch(() => {});
Promise.all([loadArtFonts(), Promise.race([schedule, new Promise((ok) => setTimeout(ok, 1500))])]).finally(() => {
  root.render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
});
