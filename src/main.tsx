import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/geist';
import '@fontsource/bebas-neue';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import './styles.css';
import App from './App';
import { loadArtFonts } from './lib/art';

const root = createRoot(document.getElementById('root')!);

// the posters are painted on canvas, so make sure their typefaces are ready first
loadArtFonts().finally(() => {
  root.render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
});
