/**
 * MIS CUENTAS (0207) — de qué cuenta propia sale una transferencia.
 * ============================================================================
 * Una sola lista para todo el ERP: la leen los selectores de los pagos y la
 * edita Cash Flow › Configuración. Se pide al primer oyente (y de nuevo si
 * quedó vieja) y, al crear o editar una cuenta, todas las pantallas abiertas
 * ven el cambio sin recargar.
 */
import { httpClient } from './httpClient.js';

/** Pasado este tiempo, quien abre un pago vuelve a pedir la lista (otro pudo cargar una cuenta). */
const VIGENCIA_MS = 30000;

let _estado = { cuentas: null, error: null };
let _leidoEn = 0;
let _pedido = null;
const _listeners = new Set();

const emitir = (estado) => {
  _estado = estado;
  _listeners.forEach((l) => l());
};

function refrescar() {
  _pedido ??= httpClient.get('/cuentas-propias')
    .then((cuentas) => { _leidoEn = Date.now(); emitir({ cuentas, error: null }); })
    .catch((error) => emitir({ ..._estado, error }))
    .finally(() => { _pedido = null; });
  return _pedido;
}

export const cuentasPropias = {
  /** `{ cuentas: [{id, nombre, detalle, activa, usos}] | null, error }` — todas, activas primero. */
  estado: () => _estado,
  subscribe(listener) {
    _listeners.add(listener);
    if (Date.now() - _leidoEn > VIGENCIA_MS) refrescar();
    return () => _listeners.delete(listener);
  },
  crear: (data) => httpClient.post('/cuentas-propias', data).finally(refrescar),
  editar: (id, data) => httpClient.patch(`/cuentas-propias/${id}`, data).finally(refrescar),
};
