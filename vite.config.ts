import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';

/**
 * The font files get hashed names at build time, so the preload tags for the
 * two faces every page needs are written into index.html after bundling.
 */
function preloadFonts(patterns: RegExp[]): Plugin {
  return {
    name: 'preload-critical-fonts',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return;
        const tags: HtmlTagDescriptor[] = [];
        for (const file of Object.keys(ctx.bundle)) {
          if (patterns.some((p) => p.test(file))) {
            tags.push({
              tag: 'link',
              attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `./${file}`, crossorigin: '' },
              injectTo: 'head',
            });
          }
        }
        return tags;
      },
    },
  };
}

/** In development the API runs inside the Vite server, so there is one process and one port. */
function devApi(): Plugin {
  // optional settings (real email, demo mode, database path); see .env.example
  if (existsSync('.env')) process.loadEnvFile('.env');
  return {
    name: 'sightline-dev-api',
    configureServer(server) {
      // re-run the API with fresh code after an edit to it or to the data it shares with the site
      server.watcher.on('change', (file) => {
        if (/[\\/](server|src[\\/](data|lib))[\\/]/.test(file)) {
          for (const mod of server.moduleGraph.idToModuleMap.values()) if (mod.ssrModule) server.moduleGraph.invalidateModule(mod);
        }
      });
      server.middlewares.use('/api', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/server/app.ts');
          await mod.handleApi(req, res, req.url ?? '/');
        } catch (err) {
          console.error('[api] failed to load', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'server_error', message: 'The server failed to start.' } }));
        }
      });
    },
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), devApi(), preloadFonts([/geist-latin-wght-normal-[\w-]+\.woff2$/, /bebas-neue-latin-400-normal-[\w-]+\.woff2$/])],
  base: './',
  server: { port: 5173, strictPort: false },
  // the server build needs only its own code; the site's public files are served from dist/
  build: { chunkSizeWarningLimit: 1200, copyPublicDir: !isSsrBuild },
  ssr: { external: ['node:sqlite'] },
}));
