import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite configuration.
 *
 * Path aliases mirror the top-level architecture folders so imports stay
 * absolute and refactor-safe (e.g. `import { MainLayout } from '@core/layout'`).
 * These aliases are duplicated in `jsconfig.json` so the editor resolves them too.
 */
/**
 * HTTPS en desarrollo, solo cuando se pide (`npm run dev:https`).
 *
 * Por qué existe: los navegadores solo dan acceso a la CÁMARA en un "contexto
 * seguro" — HTTPS o localhost. Entrando desde el celular por
 * `http://192.168.0.x:3000` la cámara no arranca y el navegador no explica nada.
 * Con HTTPS (certificado autofirmado; el teléfono pide aceptarlo una vez) el
 * escáner de códigos de barras de Vencimientos funciona en la red local.
 *
 * Queda APAGADO por defecto: en la PC, `http://localhost` ya es contexto seguro
 * y un certificado autofirmado solo agregaría advertencias.
 */
const HTTPS = process.env.VITE_DEV_HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(HTTPS ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      '@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: true,
    // Con HTTPS el servidor escucha en toda la red: el celular entra por la IP
    // de la máquina y ahí la cámara SÍ funciona (contexto seguro).
    host: HTTPS ? true : undefined,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
