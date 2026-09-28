/**
 * CAÍDAS POR ARCA — contador vivo de ventas cobradas que quedaron sin factura.
 * ============================================================================
 * Alimenta el globito de la sección "Caídas por ARCA" del menú de Ventas. Es
 * el mismo patrón que `ordenesWeb`: un solo reloj, arranca con el primer
 * oyente y se apaga con el último, tolerante a la API caída.
 *
 * Cuenta con el listado de Ventas (`sinFacturar`, `limit: 1`): el servidor ya
 * lo acota a la sucursal del cajero, así que cada uno ve SUS pendientes.
 */
import { ventasApi } from './ventas.api.js';

const INTERVALO_MS = 60000;

let _count = 0;
let _timer = null;
const _listeners = new Set();

async function tick() {
  try {
    const r = await ventasApi.listadoVentas({ sinFacturar: 'true', limit: 1 });
    const n = Number(r?.total) || 0;
    if (n !== _count) {
      _count = n;
      _listeners.forEach((l) => l());
    }
  } catch { /* API caída: el próximo tick reintenta */ }
}

export const arcaPendientes = {
  count: () => _count,
  subscribe(listener) {
    if (!_timer) { tick(); _timer = setInterval(tick, INTERVALO_MS); }
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
      if (!_listeners.size && _timer) { clearInterval(_timer); _timer = null; }
    };
  },
  /** Refresco inmediato: después de facturar, sin esperar el minuto. */
  refrescar: tick,
};
