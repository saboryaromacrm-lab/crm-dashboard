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
  /**
   * El LISTADO de la pantalla Ventas: paginado de servidor (`offset`/`limit`) y
   * totales del filtro completo. Aparte de `ventas` a propósito — ese es el
   * primitivo que usan el POS y la ficha del cliente, y devuelve un array.
   */
  listadoVentas: (filtros) => httpClient.get(`/ventas/listado${qs(filtros)}`),
  venta: (id) => httpClient.get(`/ventas/${id}`),
  /** El motivo es obligatorio: queda en `anuladoMotivo` junto a quién y cuándo. */
  anularVenta: (id, motivo) => httpClient.post(`/ventas/${id}/anular`, { motivo }),
  /** Emite la factura de un ticket provisorio (ARCA caído al cobrar). Inocuo si falla. */
  facturarVenta: (id) => httpClient.post(`/ventas/${id}/facturar`, {}),
  /* ---- ARCA: el panel de diagnóstico (Ventas › Configuración) ----
   *
   * Son DOS y no uno a propósito: `arcaEstado` lee entorno y disco (barato, se
   * pide al abrir la pantalla) y `arcaProbar` sale a la red contra ARCA — hasta
   * unos 10 segundos si hay que pedir un ticket de acceso nuevo, así que lo
   * dispara el usuario apretando el botón, nunca la carga de la pantalla. */
  arcaEstado: () => httpClient.get('/arca/estado'),
  arcaProbar: () => httpClient.post('/arca/probar', {}),

  /**
   * NOTA DE CRÉDITO: la única forma de deshacer una factura con CAE.
   * `items` vacío = nota TOTAL (toda la venta, con sus otros cargos).
   * `{ motivo, items?: [{itemId, cantidad}], devuelveMercaderia?, devolverEfectivo? }`
   */
  notaCredito: (id, datos) => httpClient.post(`/ventas/${id}/nota-credito`, datos),

  /* Ventas abiertas del punto de venta (borradores) */
  ventasAbiertas: (sucursalId) =>
    httpClient.get(`/ventas${qs({ estado: 'borrador', sucursalId, incluirItems: true, limit: 100 })}`),
  abrirVenta: (data) => httpClient.post('/ventas', { ...data, estado: 'borrador' }),
  guardarVenta: (id, data) => httpClient.put(`/ventas/${id}`, data),
  confirmarVenta: (id, data) => httpClient.post(`/ventas/${id}/confirmar`, data),
  /*
   * `paraUsuarioId` y no `usuarioId`: acá el id es de OTRO —a quién se le pasa
   * el borrador—, y el `usuarioId` del body ahora lo pisa el servidor con el de
   * la sesión. Si se llamara igual, delegar terminaría delegándose a uno mismo.
   */
  delegarVenta: (id, paraUsuarioId) => httpClient.post(`/ventas/${id}/delegar`, { paraUsuarioId }),
  descartarVenta: (id) => httpClient.delete(`/ventas/${id}`),
  cuentaCliente: (clienteId) => httpClient.get(`/ventas/cuenta/${clienteId}`),

  /**
   * Todo lo vendible de una sucursal:
   * `{ listas, reglasMarca, montoMayorista, items }`.
   *
   * Cada artículo trae su FORMATO DE VENTA en `precios: [{listaId, precio,
   * unidadesMinimas}]` — el precio y la condición son del producto. `listas`
   * lleva solo la identidad, y las dos reglas globales (marca y monto) viajan
   * aparte. El POS resuelve en memoria cuál aplica.
   */
  catalogo: (sucursalId) => httpClient.get(`/ventas/catalogo${qs({ sucursalId })}`),

  /* ---- Ofertas ---- */
  ofertas: () => httpClient.get('/ofertas'),
  crearOferta: (o) => httpClient.post('/ofertas', o),
  /*
   * Puente con el vigía de fechas (Almacén › Vencimientos). Vive acá porque el
   * MOTOR de ofertas es uno solo y está en este módulo: el vencimiento manda el
   * borrador, se crea la oferta como cualquier otra y después queda atada al
   * registro. `enOferta` es el cruce al revés — qué mercadería vigilada está
   * bajo una oferta y qué se desalineó — y se muestra acá porque acá se apaga
   * una oferta que está descontando algo ya vencido.
   */
  borradorOfertaVencimiento: (id) => httpClient.get(`/vencimientos/${id}/borrador-oferta`),
  vincularOfertaVencimiento: (id, ofertaId) => httpClient.post(`/vencimientos/${id}/vincular-oferta`, { ofertaId }),
  vencimientosEnOferta: () => httpClient.get('/vencimientos/ofertas'),
  editarOferta: (id, o) => httpClient.patch('/ofertas/' + id, o),
  borrarOferta: (id) => httpClient.delete('/ofertas/' + id),

  /* ---- Formato de venta: modalidad › lista + reglas de marca ----
     El catálogo (modalidades + listas + reglas) llega con el bootstrap: acá van
     solo las escrituras. */
  crearReglaMarca: (o) => httpClient.post('/listas/reglas-marca', o),
  editarReglaMarca: (id, o) => httpClient.patch(`/listas/reglas-marca/${id}`, o),
  borrarReglaMarca: (id) => httpClient.delete(`/listas/reglas-marca/${id}`),
  crearModalidad: (o) => httpClient.post('/listas/modalidades', o),
  editarModalidad: (id, o) => httpClient.patch(`/listas/modalidades/${id}`, o),
  borrarModalidad: (id) => httpClient.delete(`/listas/modalidades/${id}`),
  crearLista: (o) => httpClient.post('/listas', o),
  editarLista: (id, o) => httpClient.patch(`/listas/${id}`, o),
  borrarLista: (id) => httpClient.delete(`/listas/${id}`),
  setListasCliente: (clienteId, listas) => httpClient.put(`/listas/cliente/${clienteId}`, { listas }),

  /* Caja */
  cajaActual: (sucursalId) => httpClient.get(`/caja/actual/${sucursalId}`),
  cajaTurnos: (filtros) => httpClient.get(`/caja${qs(filtros)}`),
  cajaArqueo: (id) => httpClient.get(`/caja/${id}/arqueo`),
  abrirCaja: (data) => httpClient.post('/caja/abrir', data),
  cerrarCaja: (id, data) => httpClient.post(`/caja/${id}/cerrar`, data),
  controlCaja: (id, data) => httpClient.post(`/caja/${id}/control`, data),
  movimientoCaja: (id, data) => httpClient.post(`/caja/${id}/movimiento`, data),

  /* Pagos a proveedores (la plata que sale, desde la caja o desde Gastos) */
  proveedoresPadron: (tipo) => httpClient.get(`/proveedores${qs({ tipo })}`),
  crearPagoProveedor: (data) => httpClient.post('/pagos-proveedor', data),

  /* Cobranzas */
  cobranzas: (filtros) => httpClient.get(`/cobranzas${qs(filtros)}`),
  cobranza: (id) => httpClient.get(`/cobranzas/${id}`),
  crearCobranza: (data) => httpClient.post('/cobranzas', data),
  anularCobranza: (id, motivo) => httpClient.post(`/cobranzas/${id}/anular`, { motivo }),

  /* Presupuestos (pedidos mayoristas: WhatsApp hoy, tienda web mañana) */
  presupuestos: () => httpClient.get('/presupuestos'),
  crearPresupuesto: (data) => httpClient.post('/presupuestos', data),
  enviarPresupuesto: (id) => httpClient.post(`/presupuestos/${id}/enviar`, {}),
  reabrirPresupuesto: (id) => httpClient.post(`/presupuestos/${id}/reabrir`, {}),
  confirmarPresupuesto: (id, usuarioId) => httpClient.post(`/presupuestos/${id}/confirmar`, { usuarioId }),
  armarPresupuesto: (id, items) => httpClient.post(`/presupuestos/${id}/armar`, { items }),
  delegarPresupuesto: (id, vendedorId) => httpClient.post(`/presupuestos/${id}/delegar`, { vendedorId }),
  cancelarPresupuesto: (id, usuarioId, motivo) => httpClient.post(`/presupuestos/${id}/cancelar`, { usuarioId, motivo }),

  /* Órdenes web (pedidos del sitio en estado pendiente).
     El CONTADOR de pendientes no está acá: lo pollea `@core/services/ordenesWeb.js`,
     que es el único que habla con ese endpoint (badge del sidebar + alerta). */
  orden: (id) => httpClient.get(`/presupuestos/${id}/orden`),
  aceptarOrden: (id, data) => httpClient.post(`/presupuestos/${id}/aceptar`, data),

  /* Configuración (la lectura viaja con el bootstrap). */
  guardarConfig: (patch) => httpClient.put('/configuracion/ventas', patch),

  /*
   * DESCUENTOS CON NOMBRE. Endpoint propio y no parte del bootstrap: la
   * pantalla de configuración los edita de a uno, y el POS los pide aparte
   * porque su vigencia se vence sola en medio de un turno — un catálogo
   * cacheado al abrir la caja seguiría ofreciendo el que venció al mediodía.
   */
  descuentos: () => httpClient.get('/descuentos'),
  crearDescuento: (data) => httpClient.post('/descuentos', data),
  editarDescuento: (id, data) => httpClient.patch(`/descuentos/${id}`, data),
  borrarDescuento: (id) => httpClient.delete(`/descuentos/${id}`),
};
