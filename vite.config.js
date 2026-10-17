import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

// Serves app.html for /portal/*, /admin/*, /verify/* in dev and preview (Vercel does the same via vercel.json).
const APP_ROUTES = /^\/(portal|admin|verify)(\/|$|\?)/;
const MAP_ROUTE = /^\/map(\/|$|\?)/;
const spaFallback = () => {
  const handler = (req, _res, next) => {
    if (req.url && APP_ROUTES.test(req.url) && !/\.[a-z0-9]+(\?|$)/i.test(req.url.split('?')[0])) req.url = '/app.html';
    else if (req.url && MAP_ROUTE.test(req.url) && !/\.[a-z0-9]+(\?|$)/i.test(req.url.split('?')[0])) req.url = '/index.html';
    next();
  };
  return {
    name: 'vland-app-fallback',
    configureServer(s) { s.middlewares.use(handler); },
    configurePreviewServer(s) { s.middlewares.use(handler); },
  };
};

export default defineConfig({
  plugins: [react(), spaFallback()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src/app', import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: { main: resolve('index.html'), app: resolve('app.html') } },
  },
  test: { include: ['src/app/**/*.test.ts', 'src/app/**/*.test.tsx'], environment: 'node' },
});
