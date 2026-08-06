/**
 * ÓRDENES WEB — contador vivo de pedidos del sitio sin revisar.
 * ============================================================================
 * Un solo poller para las TRES caras del aviso: el badge del módulo Ventas en
 * el sidebar, el badge de la sección "Órdenes web" del submenu, y la alerta
 * flotante con sonido del Topbar. Pollea un endpoint hecho para eso (un
 * count, nada más) y solo notifica cuando el número CAMBIA.
 *
 * Arranca recién cuando alguien se suscribe, y es tolerante a la API caída:
 * el próximo tick reintenta solo.
 */
import { httpClient } from './httpClient.js';

const INTERVALO_MS = 30000;

let _count = 0;
let _timer = null;
const _listeners = new Set();

async function tick() {
  try {
    const r = await httpClient.get('/presupuestos/ordenes/pendientes');
    const n = Number(r?.pendientes) || 0;
    if (n !== _count) {
      _count = n;
      _listeners.forEach((l) => l());
    }
  } catch { /* API caída: el próximo tick reintenta */ }
}

function asegurarPolling() {
  if (_timer) return;
  tick();
  _timer = setInterval(tick, INTERVALO_MS);
}

export const ordenesWeb = {
  /** Pedidos web pendientes según el último tick. */
  count: () => _count,
  /** Suscribe (y enciende el poller la primera vez). Devuelve el des-suscribir. */
  subscribe(listener) {
    asegurarPolling();
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
  /** Refresco inmediato (después de aceptar/rechazar, sin esperar el tick). */
  refrescar: tick,
};
