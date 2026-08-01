/**
 * CAPA DE API DEL MÓDULO VENTAS
 * ============================================================================
 * Funciones puras contra `crm-api`: sin estado, sin React, sin caché. El estado
 * vive en el contexto (catálogos) o en `useResource` (listados bajo demanda).
 *
 * Deliberadamente NO hay un store singleton como en inventario: los datos de
 * ventas son o muy chicos (clientes, config) o ilimitados (ventas, cobranzas).
 * Los primeros se cargan una vez; los segundos se piden paginados cuando se
 * miran. Así el módulo no arrastra memoria ni tráfico que nadie usa.
 */
import { httpClient, HttpError } from '@core/services/httpClient.js';

/** Convierte cualquier fallo en el mensaje que muestra la UI. */
export function errorMsg(e) {
  if (e instanceof HttpError) {
    const d = e.data;
    if (typeof d === 'string' && d) return d;
    const m = d?.message;
    if (Array.isArray(m)) return m.join(' · ');
    if (typeof m === 'string' && m) return m;
    return `Error ${e.status}`;
  }
  return e?.message || 'No se pudo conectar con la API.';
}

/** Serializa filtros salteando los vacíos (`?a=1&b=2`). */
function qs(params = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const ventasApi = {
  /* Catálogos del módulo (chicos, se cargan una vez). */
  bootstrap: () => httpClient.get('/ventas/bootstrap'),

  /* Clientes */
  crearCliente: (data) => httpClient.post('/clientes', data),
  editarCliente: (id, data) => httpClient.patch(`/clientes/${id}`, data),
  eliminarCliente: (id) => httpClient.delete(`/clientes/${id}`),
  reactivarCliente: (id) => httpClient.post(`/clientes/${id}/reactivar`, {}),

  /* Ventas / cuenta corriente */
  ventas: (filtros) => httpClient.get(`/ventas${qs(filtros)}`),
  venta: (id) => httpClient.get(`/ventas/${id}`),
  crearVenta: (data) => httpClient.post('/ventas', data),
  anularVenta: (id) => httpClient.post(`/ventas/${id}/anular`, {}),

  /* Ventas abiertas del punto de venta (borradores) */
  ventasAbiertas: (sucursalId) =>
    httpClient.get(`/ventas${qs({ estado: 'borrador', sucursalId, incluirItems: true, limit: 100 })}`),
  abrirVenta: (data) => httpClient.post('/ventas', { ...data, estado: 'borrador' }),
  guardarVenta: (id, data) => httpClient.put(`/ventas/${id}`, data),
  confirmarVenta: (id, data) => httpClient.post(`/ventas/${id}/confirmar`, data),
  delegarVenta: (id, usuarioId) => httpClient.post(`/ventas/${id}/delegar`, { usuarioId }),
  descartarVenta: (id) => httpClient.delete(`/ventas/${id}`),
  cuentaCliente: (clienteId) => httpClient.get(`/ventas/cuenta/${clienteId}`),

  /** Todo lo vendible de una sucursal con precio y stock resueltos (POS). */
  catalogo: (sucursalId, lista) => httpClient.get(`/ventas/catalogo${qs({ sucursalId, lista })}`),

  /* Caja */
  cajaActual: (sucursalId) => httpClient.get(`/caja/actual/${sucursalId}`),
  cajaTurnos: (filtros) => httpClient.get(`/caja${qs(filtros)}`),
  cajaArqueo: (id) => httpClient.get(`/caja/${id}/arqueo`),
  abrirCaja: (data) => httpClient.post('/caja/abrir', data),
  cerrarCaja: (id, data) => httpClient.post(`/caja/${id}/cerrar`, data),
  movimientoCaja: (id, data) => httpClient.post(`/caja/${id}/movimiento`, data),

  /* Cobranzas */
  cobranzas: (filtros) => httpClient.get(`/cobranzas${qs(filtros)}`),
  cobranza: (id) => httpClient.get(`/cobranzas/${id}`),
  crearCobranza: (data) => httpClient.post('/cobranzas', data),
  anularCobranza: (id) => httpClient.post(`/cobranzas/${id}/anular`, {}),

  /* Configuración */
  config: () => httpClient.get('/configuracion/ventas'),
  guardarConfig: (patch) => httpClient.put('/configuracion/ventas', patch),
};
