/**
 * Environment access layer.
 *
 * Centralizes reads from `import.meta.env` so the rest of the codebase never
 * touches Vite-specific globals directly. This makes it trivial to:
 *   - provide safe defaults,
 *   - mock env in tests,
 *   - swap the source (e.g. runtime config injected on window) later.
 */

const raw = import.meta.env ?? {};

export const env = Object.freeze({
  mode: raw.MODE ?? 'development',
  isProduction: raw.PROD === true,
  isDevelopment: raw.DEV === true,

  apiBaseUrl: raw.VITE_API_BASE_URL ?? '/api',
  appName: raw.VITE_APP_NAME ?? 'CRM Dashboard',
  defaultTheme: raw.VITE_DEFAULT_THEME ?? 'light',

  /** Comma-separated allow-list of module ids; empty means "all registered". */
  enabledModules: (raw.VITE_ENABLED_MODULES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});
