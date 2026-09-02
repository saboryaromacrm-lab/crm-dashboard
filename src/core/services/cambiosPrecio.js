/**
 * CAMBIOS DE PRECIO — vigilancia viva de los precios en pantalla
 * ============================================================================
 * El punto de venta pide el catálogo UNA vez y lo guarda en memoria: cambiar de
 * cliente o cruzar un umbral se resuelve sin volver a la red. Es rápido, pero
 * tiene un costo — si el administrador actualiza precios mientras un cajero
 * tiene el POS abierto, ese cajero **sigue cobrando el precio viejo** hasta que
 * se acuerda de apretar "Actualizar precios". Nadie se acuerda.
 *
 * Este poller cierra ese agujero: mira la firma del último cambio de precio y
 * avisa cuando aparece una nueva.
 *
 * Dos ids, y la diferencia importa:
 *  - `_ultimo.id`: la firma que dice la API — el último cambio que existe.
 *  - `_visto`: la firma que este navegador ya reconoció.
 * Hay novedad solo cuando el primero le pasa al segundo. Tener el "visto" ACÁ
 * y no en el componente del aviso es lo que hace que actualizar los precios
 * desde el POS también apague el cartel: las dos puntas hablan del mismo dato.
 *
 * Mismo patrón que `ordenesWeb`: un solo poller para todas las caras del aviso,
 * arranca cuando alguien se suscribe y tolera la API caída (el próximo tick
 * reintenta).
 */
import { httpClient } from './httpClient.js';

const INTERVALO_MS = 30000;

/** Firma del último cambio: { id, fecha, origen, detalle, usuarioId, productos } */
let _ultimo = null;
/** Id ya reconocido por este navegador. `null` = todavía no hubo un tick. */
let _visto = null;
/**
 * Snapshot memoizado. `useSyncExternalStore` exige que la misma lectura
 * devuelva el MISMO objeto mientras nada cambió: si se armara uno nuevo en cada
 * llamada, React entraría en un bucle de re-render.
 */
let _snap = { ultimo: null, hayNovedad: false };
const _listeners = new Set();
let _timer = null;

function publicar() {
  _snap = {
    ultimo: _ultimo,
    hayNovedad: !!_ultimo && _visto !== null && _ultimo.id > _visto,
  };
  _listeners.forEach((l) => l());
}

async function tick() {
  try {
    const r = await httpClient.get('/precios/ultimo-cambio');
    const id = Number(r?.id) || 0;
    // Solo el `id` decide: es monotónico y no depende de relojes ni de husos.
    if (id === (_ultimo?.id ?? null)) return;
    _ultimo = { ...r, id };
    // Primer tick: la foto de arranque no es una novedad — el catálogo que el
    // cajero acaba de cargar ya viene con estos precios.
    if (_visto === null) _visto = id;
    publicar();
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

export const cambiosPrecio = {
  /** `{ ultimo, hayNovedad }` — pensado para `useSyncExternalStore`. */
  estado: () => _snap,
  /** Suscribe (y enciende el poller la primera vez). Devuelve el des-suscribir. */
  subscribe(listener) {
    asegurarPolling();
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
      if (!_listeners.size) detenerPolling();
    };
  },
  /**
   * "Ya estoy al día con esta firma": apaga el aviso hasta el próximo cambio.
   * Lo llama tanto el botón del aviso como el "Actualizar precios" del POS —
   * quien ya trajo los precios nuevos no tiene que ver el cartel.
   */
  marcarVisto() {
    if (!_ultimo || _visto === _ultimo.id) return;
    _visto = _ultimo.id;
    publicar();
  },
  /** Refresco inmediato, sin esperar el tick. */
  refrescar: tick,
};

/**
 * Evento global "los precios cambiaron, recargá lo que tengas cacheado".
 *
 * Es un evento del window y no un prop porque el aviso vive en el layout
 * —arriba de todo, para que suene en cualquier pantalla— y el catálogo vive
 * adentro del panel del POS. Pasarlo por props obligaría a atravesar el árbol
 * entero para conectar dos puntas que no se conocen entre sí.
 */
export const EVENTO_PRECIOS = 'crm:precios-actualizados';

export function pedirRecargaDePrecios() {
  cambiosPrecio.marcarVisto();
  window.dispatchEvent(new Event(EVENTO_PRECIOS));
}
