/**
 * PEDIDOS DE INGRESO A LA TIENDA (0155) — contador vivo de los pendientes.
 * ============================================================================
 * Mismo patrón que `ordenesWeb`: un solo poller para el globito de la sección
 * y el cartel de arriba; arranca con el primer oyente, se apaga con el último
 * y solo avisa cuando el número CAMBIA. Quien no tiene la llave
 * `ventas.accesos_tienda` no se suscribe (si no, un 403 por minuto).
 */
import { httpClient } from './httpClient.js';

const INTERVALO_MS = 60000;

let _count = 0;
let _timer = null;
/** El rol no tiene la llave (403): no se vuelve a preguntar en esta sesión del navegador. */
let _sinLlave = false;
const _listeners = new Set();

const detener = () => { if (_timer) { clearInterval(_timer); _timer = null; } };

async function tick() {
  try {
    const r = await httpClient.get('/tienda-accesos/pendientes');
    const n = Number(r?.pendientes) || 0;
    if (n !== _count) {
      _count = n;
      _listeners.forEach((l) => l());
    }
  } catch (e) {
    /* El badge del sidebar se suscribe sin saber los permisos: un 403 apaga el reloj. Otra falla: el próximo tick reintenta. */
    if (e?.status === 403) { _sinLlave = true; detener(); }
  }
}

export const accesosTienda = {
  count: () => _count,
  subscribe(listener) {
    if (!_timer && !_sinLlave) { tick(); _timer = setInterval(tick, INTERVALO_MS); }
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
      if (!_listeners.size) detener();
    };
  },
  /** Refresco inmediato después de habilitar o rechazar. */
  refrescar: tick,
};

/** Suscripción vacía, para quien no tiene la llave. */
export const sinSuscripcion = () => () => {};
