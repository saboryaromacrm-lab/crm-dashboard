/**
 * GASTOS PENDIENTES — contador vivo del sidebar.
 * ============================================================================
 * Suma dos cosas que piden atención del administrador y que si no se ven, no
 * existen:
 *
 *   · gastos VENCIDOS (o que vencen hoy) sin pagar;
 *   · pagos a proveedor SIN APLICAR — plata que ya salió del cajón y todavía
 *     no tiene una factura detrás. Un número alto acá significa una de dos
 *     cosas: falta cargar comprobantes, o falta explicar una salida.
 *
 * Mismo patrón que `ordenesWeb`: un solo poller, arranca cuando alguien se
 * suscribe, notifica solo cuando el número cambia y tolera la API caída.
 */
import { httpClient } from './httpClient.js';

const INTERVALO_MS = 60000;

let _count = 0;
const _listeners = new Set();
let _timer = null;

async function tick() {
  try {
    const [pend, pagos] = await Promise.all([
      httpClient.get('/gastos/pendientes'),
      // Solo los de GASTOS: los de mercadería son asunto de Compras.
      httpClient.get('/pagos-proveedor/sin-aplicar?destino=gastos'),
    ]);
    const n = (Number(pend?.vencidos) || 0) + (Number(pagos?.cantidad) || 0);
    if (n !== _count) {
      _count = n;
      _listeners.forEach((l) => l());
    }
  } catch (e) {
    /*
     * UN 403 NO SE REINTENTA. El módulo se ve con cualquiera de sus seis
     * secciones, pero estos dos contadores piden claves más finas: un rol con
     * solo "Rubros" o solo "Resumen" ve el módulo, arranca el poller y se come
     * un 403 cada 60 segundos, para siempre, tragado por este mismo `catch` —
     * ruido en el log del servidor y trabajo al pedo de las dos puntas. El
     * permiso no va a aparecer solo: se corta el reloj y el badge queda en 0,
     * que es exactamente lo que corresponde mostrarle a ese rol.
     *
     * Todo lo demás (la API caída, un corte de red) SÍ se reintenta.
     */
    if (e?.status === 403) detenerPolling();
  }
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

export const gastosPendientes = {
  count: () => _count,
  subscribe(listener) {
    asegurarPolling();
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
      // Sin oyentes se apaga el reloj, igual que los otros pollers del núcleo.
      if (!_listeners.size) detenerPolling();
    };
  },
  /** Refresco inmediato después de pagar o imputar, sin esperar el tick. */
  refrescar: tick,
};
