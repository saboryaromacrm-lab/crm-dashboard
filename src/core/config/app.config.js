import { env } from './env.js';

/**
 * Global application configuration.
 *
 * Static, cross-cutting settings that are not tied to any single module.
 * Anything a deployment/tenant might want to override lives here (or is derived
 * from env), so components read config instead of hard-coding values.
 */
export const appConfig = Object.freeze({
  /**
   * EL NOMBRE, EN DOS PIEZAS Y NO EN DOS CONSTANTES.
   *
   * `name` es el producto y va donde el ancho manda: el sidebar tiene 264 px
   * y el nombre completo se cortaría con puntos suspensivos. `nombreCompleto`
   * es el oficial —el de la pestaña del navegador y la pantalla de entrada—
   * y se COMPONE, para que cambiar el producto no deje la firma desfasada ni
   * obligue a acordarse de tocar dos textos.
   */
  name: env.appName,
  firma: 'Coftech',
  get nombreCompleto() { return `${this.name} by ${this.firma}`; },
  version: '0.1.0',
  company: 'Sabor y Aroma',

  api: {
    baseUrl: env.apiBaseUrl,
    timeoutMs: 20000,
  },

  routes: {
    root: '/',
    // Where the app lands after login / on "/".
    defaultAuthenticatedRoute: '/dashboard',
    login: '/login',
    notFound: '/404',
  },

  layout: {
    // Persisted UI preferences default here (see UIContext).
    sidebarDefaultCollapsed: false,
  },

  theme: {
    defaultMode: env.defaultTheme === 'dark' ? 'dark' : 'light',
    storageKey: 'crm.theme-mode',
  },

  i18n: {
    defaultLocale: 'es-AR',
    fallbackLocale: 'en',
  },
});
