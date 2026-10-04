/**
 * CAJAS DE LOS LOCALES ABIERTAS HACE MÁS DE 24 H (Cash Flow, parte 3).
 * ============================================================================
 * Sondeo liviano cada minuto a `GET /cashflow/alertas` (solo el superadmin lo
 * tiene). Alimenta el banner persistente del ERP: mientras haya una caja
 * olvidada abierta, el sobre de ese local no llega y el dueño tiene que
 * saberlo en cualquier pantalla, no solo adentro del Cash Flow.
 */
import { httpClient } from './httpClient.js';

const INTERVALO_MS = 60000;

let _cajas = [];
let _timer = null;
const _listeners = new Set();

async function tick() {
  try {
    const r = await httpClient.get('/cashflow/alertas');
    const lista = Array.isArray(r?.cajasAbiertas) ? r.cajasAbiertas : [];
    /* Se avisa solo si cambió algo (ids u horas): `useSyncExternalStore` compara por referencia. */
    const firma = (l) => l.map((c) => `${c.id}:${c.horas}`).join(',');
    if (firma(lista) !== firma(_cajas)) {
      _cajas = lista;
      _listeners.forEach((l) => l());
    }
  } catch { /* sin permiso o API caída: el próximo tick reintenta */ }
}

function asegurarPolling() {
  if (_timer) return;
  tick();
  _timer = setInterval(tick, INTERVALO_MS);
}
function detenerPolling() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
}

export const cajasAbiertas = {
  lista: () => _cajas,
  subscribe(listener) {
    asegurarPolling();
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
      if (!_listeners.size) detenerPolling();
    };
  },
  refrescar: tick,
};
