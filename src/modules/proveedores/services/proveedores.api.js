/**
 * CAPA DE API DEL MÓDULO PROVEEDORES (0068)
 * ============================================================================
 * Funciones puras contra `crm-api`. El módulo gira alrededor de la relación
 * con el proveedor — la deuda misma nace en Compras (comprobantes) y se
 * cancela en pagos: acá se la mira (EDOC), se la promete (compromisos y
 * echeqs) y se coordina el pedirle (kanban).
 */
import { httpClient, HttpError } from '@core/services/httpClient.js';

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

function qs(params = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const provApi = {
  /* El padrón (la ficha completa vive acá desde 0068) */
  proveedores: () => httpClient.get('/proveedores'),
  proveedor: (id) => httpClient.get(`/proveedores/${id}`),
  crearProveedor: (data) => httpClient.post('/proveedores', data),
  editarProveedor: (id, data) => httpClient.patch(`/proveedores/${id}`, data),
  eliminarProveedor: (id) => httpClient.delete(`/proveedores/${id}`),
  cuentas: (id) => httpClient.get(`/proveedores/${id}/cuentas`),
  guardarCuentas: (id, cuentas) => httpClient.put(`/proveedores/${id}/cuentas`, { cuentas }),

  /* Pedidos (kanban + ingresos) */
  kanban: () => httpClient.get('/pedidos-proveedor'),
  statsPedidos: () => httpClient.get('/pedidos-proveedor/stats'),
  ingresos: (filtros) => httpClient.get(`/pedidos-proveedor/recibidos${qs(filtros)}`),
  solicitarPedidos: (data) => httpClient.post('/pedidos-proveedor', data),
  pedidoDirecto: (data) => httpClient.post('/pedidos-proveedor/directo', data),
  editarPedido: (id, data) => httpClient.patch(`/pedidos-proveedor/${id}`, data),
  estadoPedido: (id, estado) => httpClient.patch(`/pedidos-proveedor/${id}/estado`, { estado }),
  togglePedidoEnviado: (id) => httpClient.post(`/pedidos-proveedor/${id}/enviado`),
  marcarRevisado: (id, deshacer) => httpClient.post(`/pedidos-proveedor/${id}/revisado`, { deshacer }),
  borrarPedido: (id) => httpClient.delete(`/pedidos-proveedor/${id}`),

  /* Compromisos (Cuentas corrientes) */
  compromisos: (filtros) => httpClient.get(`/compromisos${qs(filtros)}`),
  statsCompromisos: () => httpClient.get('/compromisos/stats'),
  crearCompromiso: (data) => httpClient.post('/compromisos', data),
  editarCompromiso: (id, data) => httpClient.patch(`/compromisos/${id}`, data),
  pagarCompromiso: (id, data) => httpClient.post(`/compromisos/${id}/pagar`, data),
  borrarCompromiso: (id) => httpClient.delete(`/compromisos/${id}`),

  /* Echeqs */
  echeqs: (filtros) => httpClient.get(`/echeqs${qs(filtros)}`),
  statsEcheqs: () => httpClient.get('/echeqs/stats'),
  crearEcheq: (data) => httpClient.post('/echeqs', data),
  editarEcheq: (id, data) => httpClient.patch(`/echeqs/${id}`, data),
  estadoEcheq: (id, estado) => httpClient.post(`/echeqs/${id}/estado`, { estado }),
  borrarEcheq: (id) => httpClient.delete(`/echeqs/${id}`),

  /* Estado de cuenta */
  edoc: () => httpClient.get('/proveedores-edoc'),
  edocProveedor: (id) => httpClient.get(`/proveedores-edoc/${id}`),
  crearAjuste: (data) => httpClient.post('/proveedores-edoc/ajustes', data),
  borrarAjuste: (id) => httpClient.delete(`/proveedores-edoc/ajustes/${id}`),
  conciliar: (proveedorId) => httpClient.post(`/proveedores-edoc/${proveedorId}/conciliar`),
  desconciliar: (proveedorId) => httpClient.delete(`/proveedores-edoc/${proveedorId}/conciliar`),

  /* La caja de la sucursal (para el pago en efectivo desde el cajón) */
  cajaActual: (sucursalId) => httpClient.get(`/caja/actual/${sucursalId}`),
};

/* Etiquetas compartidas del módulo. */
export const MEDIOS_HABITUALES = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  echeq: 'Echeq',
  cta_cte: 'Cta cte',
};
export const CONDICIONES_COMPRA = {
  factura: 'Factura',
  liquidacion: 'Liquidación',
  mixto: 'Mixto',
};
export const MEDIOS_PAGO_REAL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  cheque: 'Cheque',
  echeq: 'Echeq',
  otro: 'Otro',
};
