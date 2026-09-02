/**
 * PEDIDOS DE LA CAFETERÍA — contador vivo de la demanda del café sin tratar.
 * ============================================================================
 * El mismo patrón que las órdenes web: UN poller para el aviso del Topbar (y
 * el que quiera suscribirse), contra un endpoint que devuelve solo un count.
 * Notifica únicamente cuando el número CAMBIA, arranca con la primera
 * suscripción y tolera la API caída (el próximo tick reintenta).
 *
 * Cuenta SOLO los `pendiente`: lo "armando" ya lo está atendiendo alguien y no
 * necesita campanita.
 */
import { httpClient } from './httpClient.js';

const INTERVALO_MS = 30000;

let _count = 0;
let _timer = null;
const _listeners = new Set();

async function tick() {
  try {
    const r = await httpClient.get('/cafeteria/pedidos-pendientes');
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

/** Sin oyentes se apaga el reloj (si no, seguía corriendo tras cerrar sesión). */
function detenerPolling() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
}

export const pedidosCafe = {
  /** Pedidos del café sin tomar, según el último tick. */
  count: () => _count,
  subscribe(listener) {
    asegurarPolling();
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
      if (!_listeners.size) detenerPolling();
    };
  },
  /** Refresco inmediato (después de tomar/convertir, sin esperar el tick). */
  refrescar: tick,
};
