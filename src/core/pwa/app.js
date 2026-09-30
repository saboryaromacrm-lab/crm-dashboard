/**
 * EL ERP COMO APP INSTALABLE (30/9/2026, pedido del dueño)
 * ============================================================================
 * Registra el service worker (`public/sw.js`, ver ahí qué hace y qué NO) y
 * guarda el aviso de «se puede instalar» del navegador, que llega UNA vez y
 * temprano: si nadie lo guarda, cuando se abre Sistema › Este equipo ya pasó.
 *
 * La app instalada es el MISMO sitio (mismo dominio): comparte la sesión, el
 * registro de «Este equipo» y los permisos de ventanas emergentes y cámara que
 * ya tiene el navegador en erp.saboryaroma.com. Por eso se instala desde esa
 * dirección y no desde la sslip, que para el navegador es otro sitio.
 */

let aviso = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((fn) => fn());

/** ¿Se está usando como app instalada (ventana propia) y no en una pestaña? */
export function esAppInstalada() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

/** El sistema del equipo, para dar las instrucciones que corresponden cuando no hay botón. */
export function plataforma() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'escritorio';
}

export const puedeInstalar = () => !!aviso;

/** Abre el cuadro de instalación del navegador. Devuelve true si la persona aceptó. */
export async function instalar() {
  if (!aviso) return false;
  const a = aviso;
  aviso = null; // el navegador lo deja usar una sola vez
  avisar();
  await a.prompt();
  const { outcome } = await a.userChoice;
  return outcome === 'accepted';
}

/** Para que una pantalla se entere cuando aparece o se usa el aviso. Devuelve cómo desuscribirse. */
export function alCambiar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Se llama una vez al arrancar (main.jsx). En desarrollo no registra nada: Vite recarga solo. */
export function iniciarApp() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // sin el cartel automático: se ofrece desde Este equipo
    aviso = e;
    avisar();
  });
  window.addEventListener('appinstalled', () => { aviso = null; avisar(); });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin app instalable: el ERP funciona igual */ });
  });
}
