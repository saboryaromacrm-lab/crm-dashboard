/**
 * CAPA DE API DEL MÓDULO GASTOS
 * ============================================================================
 * Funciones puras contra `crm-api`: sin estado, sin React, sin caché. Los
 * catálogos chicos viven en el contexto; los listados que crecen los pide cada
 * panel con `useResource`.
 *
 * Ojo con la separación: `/gastos` es el DOCUMENTO (lo que se debe) y
 * `/pagos-proveedor` es la PLATA (lo que salió). Son dos cosas distintas y a
 * propósito viven en dos endpoints distintos — un pago puede existir sin
 * documento, y un documento puede existir sin pago.
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

export const gastosApi = {
  /* Catálogos del módulo (chicos, se cargan una vez). */
  bootstrap: () => httpClient.get('/gastos/bootstrap'),

  /* Gastos (el documento) */
  gastos: (filtros) => httpClient.get(`/gastos${qs(filtros)}`),
  gasto: (id) => httpClient.get(`/gastos/${id}`),
  crearGasto: (data) => httpClient.post('/gastos', data),
  editarGasto: (id, data) => httpClient.patch(`/gastos/${id}`, data),
  anularGasto: (id, motivo) => httpClient.post(`/gastos/${id}/anular`, { motivo }),
  cuentasAPagar: (filtros) => httpClient.get(`/gastos/cuentas-a-pagar${qs(filtros)}`),
  pendientes: () => httpClient.get('/gastos/pendientes'),
  resumen: (filtros) => httpClient.get(`/gastos/resumen${qs(filtros)}`),

  /* Pagar un gasto (crea el pago al proveedor y lo imputa de una) */
  pagarGasto: (id, data) => httpClient.post(`/gastos/${id}/pagos`, data),
  /* Usar un pago a cuenta que ya existía */
  aplicarPagoAGasto: (id, data) => httpClient.post(`/gastos/${id}/aplicar-pago`, data),

  /* Rubros — la LISTA no está acá: viene con el bootstrap del módulo. */
  crearCategoria: (data) => httpClient.post('/gastos/categorias', data),
  editarCategoria: (id, data) => httpClient.patch(`/gastos/categorias/${id}`, data),
  borrarCategoria: (id) => httpClient.delete(`/gastos/categorias/${id}`),

  /* Gastos fijos — ídem: las plantillas vienen con el bootstrap. */
  crearRecurrente: (data) => httpClient.post('/gastos/recurrentes', data),
  editarRecurrente: (id, data) => httpClient.patch(`/gastos/recurrentes/${id}`, data),
  borrarRecurrente: (id) => httpClient.delete(`/gastos/recurrentes/${id}`),
  periodoFijos: (periodo) => httpClient.get(`/gastos/recurrentes/periodo/${periodo}`),
  generarFijos: (data) => httpClient.post('/gastos/recurrentes/generar', data),

  /*
   * Pagos a proveedores (la plata). Este módulo trabaja SIEMPRE sobre el
   * destino "gastos": los de mercadería viven en Compras › Pagos en sucursal.
   * Un pago de gastos solo puede aplicarse a gastos — el candado está en la
   * API; acá directamente no se piden los otros documentos.
   */
  pagos: (filtros) => httpClient.get(`/pagos-proveedor${qs({ destino: 'gastos', ...filtros })}`),
  pago: (id) => httpClient.get(`/pagos-proveedor/${id}`),
  crearPago: (data) => httpClient.post('/pagos-proveedor', { destino: 'gastos', ...data }),
  desimputar: (imputacionId) => httpClient.delete(`/pagos-proveedor/imputaciones/${imputacionId}`),
  anularPago: (id, motivo) => httpClient.post(`/pagos-proveedor/${id}/anular`, { motivo }),
  moverDestino: (id, destino) => httpClient.patch(`/pagos-proveedor/${id}/destino`, { destino }),
  disponibles: (proveedorId) => httpClient.get(`/pagos-proveedor/disponibles/${proveedorId}?destino=gastos`),
  documentosPendientes: (proveedorId) => httpClient.get(`/pagos-proveedor/pendientes/${proveedorId}?destino=gastos`),
  cuentaProveedor: (proveedorId) => httpClient.get(`/pagos-proveedor/cuenta/${proveedorId}`),
  sinAplicar: () => httpClient.get('/pagos-proveedor/sin-aplicar?destino=gastos'),

  /*
   * Padrón de proveedores: la ficha COMPLETA (con CUIT y contacto), que el
   * bootstrap no manda. La usa la pantalla de Proveedores, que es la que tiene
   * el permiso para verla.
   */
  proveedores: (tipo) => httpClient.get(`/proveedores${qs({ tipo })}`),
  crearProveedor: (data) => httpClient.post('/proveedores', data),
  editarProveedor: (id, data) => httpClient.patch(`/proveedores/${id}`, data),

  /* Turnos de caja abiertos: para poder pagar en efectivo desde el módulo */
  cajaActual: (sucursalId) => httpClient.get(`/caja/actual/${sucursalId}`),
};
