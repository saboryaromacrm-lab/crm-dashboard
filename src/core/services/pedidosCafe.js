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
let _sinResolver = 0;
let _porRecibir = 0;
let _timer = null;
const _listeners = new Set();

async function tick() {
  try {
    const r = await httpClient.get('/cafeteria/pedidos-pendientes');
    const n = Number(r?.pendientes) || 0;
    /* El globito del menú cuenta TAMBIÉN lo que ya está armándose: sigue
     * abierto hasta que sale el envío. La campanita, en cambio, solo los sin
     * tomar — lo que alguien ya está atendiendo no necesita interrumpir.
     * Un solo pedido a la API para los dos números. */
    /* Y lo que espera que YO lo controle y reciba (0113): un envío sin
     * recibir es trabajo pendiente igual que un pedido sin armar. */
    const sr = n + (Number(r?.armando) || 0) + (Number(r?.porRecibir) || 0);
    const pr = Number(r?.porRecibir) || 0;
    if (n !== _count || sr !== _sinResolver || pr !== _porRecibir) {
      _count = n;
      _sinResolver = sr;
      _porRecibir = pr;
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
  /** Pedidos del café sin tomar, según el último tick (la campanita). */
  count: () => _count,
  /** Sin tomar + armándose: lo que sigue abierto (el globito del menú). */
  sinResolver: () => _sinResolver,
  /** Envíos que le toca controlar y recibir a quien mira (0113): el globito de su pestaña. */
  porRecibir: () => _porRecibir,
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
