import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { createTranslateMiddleware } from './src/server/translateMiddleware';

function translateApiPlugin(): Plugin {
  return {
    name: 'translate-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/translate', createTranslateMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/translate', createTranslateMiddleware());
    },
  };
}

const port = Number(process.env.PORT || 3000);
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  envDir: path.resolve(import.meta.dirname, '../..'),
  plugins: [
    react(),
    tailwindcss(),
    translateApiPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});

