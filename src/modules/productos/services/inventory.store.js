/**
 * INVENTORY STORE — cliente del backend (crm-api).
 * ============================================================================
 * Reemplaza al store localStorage: ahora los datos vienen de la API REST y las
 * mutaciones llaman a los endpoints y luego refrescan el snapshot (`/bootstrap`).
 *
 * Mantiene la MISMA interfaz que consumían paneles y modales:
 *   - `state.*` (arrays cargados desde la API) para lecturas sincrónicas,
 *   - métodos de mutación (ahora async, devuelven `{ok}`/`{ok:false,error}`),
 *   - helpers de lectura (costoNeto, cant, suma, cuentaProveedor, …).
 *
 * El contexto (sucursal/usuario activo) es del cliente y se persiste en
 * localStorage — no hay auth todavía.
 */
import { httpClient, HttpError } from '@core/services/httpClient.js';
import { PERMISOS_ROL } from '../domain/constants.js';
import { num, fmtTam } from '../domain/format.js';

const CTX_KEY = 'crm_inv_ctx';

let state = nuevoEstado();
let _loaded = false;
let _loading = false;
let _loadError = null;

/* ---------------- Reactividad (pub/sub para React) ---------------- */
let _version = 0;
const _listeners = new Set();
function emit() {
  _version += 1;
  _listeners.forEach((l) => l());
}
function subscribe(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
function getVersion() { return _version; }

function _loadCtx() {
  try { const r = localStorage.getItem(CTX_KEY); if (r) return JSON.parse(r); } catch (e) { /* ignore */ }
  return { sucursalId: null, usuarioId: null };
}
function _persistCtx() { try { localStorage.setItem(CTX_KEY, JSON.stringify(state.ctx)); } catch (e) { /* ignore */ } }

function nuevoEstado() {
  return {
    sucursales: [], proveedores: [], usuarios: [], productos: [],
    stock: [], movimientos: [], transferencias: [], incidencias: [], comprobantes: [],
    // Preferencias que afectan el cálculo de precios (llegan en el bootstrap).
    configVentas: {},
    ctx: _loadCtx(),
  };
}

/* ---------------- Getters ---------------- */
const getProducto = (id) => state.productos.find((x) => x.id === id);
const getSucursal = (id) => state.sucursales.find((x) => x.id === id);
const getProveedor = (id) => state.proveedores.find((x) => x.id === id);
const getUsuario = (id) => state.usuarios.find((x) => x.id === id);
function presDe(prod, presId) { return prod && prod.presentaciones ? prod.presentaciones.find((p) => p.id === presId) : null; }
function distribuidora() { return state.sucursales.find((s) => s.tipo === 'distribuidora'); }

function unidadDe(prod, presId) { return (prod.tipo === 'granel' && !presId) ? 'kg' : 'u'; }
function presLabel(prod, presId) {
  if (!presId) return prod.tipo === 'granel' ? 'Granel (kg)' : 'Unidad';
  const p = presDe(prod, presId);
  return p ? fmtTam(p.tamKg) : 'Paquete';
}
function fmtCant(prod, presId, cantidad) {
  if (unidadDe(prod, presId) === 'kg') return num(cantidad, 3) + ' kg';
  return Math.round(cantidad) + (presId ? ' paq.' : ' u.');
}

/* ---------------- Lecturas de stock (sobre el estado cargado) ---------------- */
function cant(productoId, sucursalId, presId, estado) {
  presId = presId || null;
  const e = state.stock.find((s) =>
    s.productoId === productoId && s.sucursalId === sucursalId && (s.presentacionId || null) === presId && s.estado === estado);
  return e ? e.cantidad : 0;
}
function suma(f) {
  return state.stock.reduce((acc, s) => {
    if (f.productoId != null && s.productoId !== f.productoId) return acc;
    if (f.sucursalId != null && s.sucursalId !== f.sucursalId) return acc;
    if (f.presentacionId !== undefined && (s.presentacionId || null) !== (f.presentacionId || null)) return acc;
    if (f.estado != null && s.estado !== f.estado) return acc;
    return acc + s.cantidad;
  }, 0);
}
function movimientosDe(productoId) {
  return state.movimientos.filter((m) => m.productoId === productoId).sort((a, b) => b.id - a.id);
}

/* ---------------- Costos / precios (idéntico al backend) ---------------- */
function costoNetoEntry(e) {
  if (!e) return 0;
  const c = Number(e.costo) || 0, d = Number(e.descuento) || 0, f = Number(e.flete) || 0;
  return c * (1 - d / 100) * (1 + f / 100);
}
function proveedorActivoEntry(prod) {
  const arr = prod.proveedores || [];
  if (!arr.length) return null;
  return arr.find((e) => e.proveedorId === prod.proveedorActivoId) || arr[0];
}
function costoNeto(prod) { return costoNetoEntry(proveedorActivoEntry(prod)); }

/**
 * REDONDEO DE GÓNDOLA — espejo exacto de `pricing.ts` del backend.
 *
 * Se redondea el precio FINAL (con IVA), que es el que ve el cliente, y el neto
 * se deriva hacia atrás. Si se redondeara el neto, la góndola quedaría con
 * centavos igual. `precioFinal()` es idempotente sobre un neto ya ajustado, así
 * la etiqueta y el ticket muestran siempre el mismo número.
 *
 * El factor de redondeo llega en el bootstrap (`configVentas.redondeoPrecio`)
 * para que el frontend no tenga que pedirlo aparte ni pueda desincronizarse.
 */
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

function redondearPrecio(valor, redondeo) {
  const v = Number(valor) || 0;
  const r = Number(redondeo) || 0;
  if (r <= 0) return money(v);
  return Math.round(v / r) * r;
}
function ajustarNeto(neto, iva) {
  const r = Number(state.configVentas?.redondeoPrecio) || 0;
  if (r <= 0) return money(neto);
  const i = Number(iva) || 0;
  return money(redondearPrecio(neto * (1 + i / 100), r) / (1 + i / 100));
}
/** Precio final con IVA, redondeado: el número de la etiqueta. */
function precioFinal(neto, iva) {
  return redondearPrecio((Number(neto) || 0) * (1 + (Number(iva) || 0) / 100), state.configVentas?.redondeoPrecio);
}

function preciosVenta(prod) {
  const cn = costoNeto(prod);
  return (prod.listasPrecio || []).map((l) => ({
    ...l,
    precio: ajustarNeto(cn * (1 + (Number(l.ganancia) || 0) / 100), prod.iva),
  }));
}
function precioBaseVenta(prod) {
  const pv = preciosVenta(prod);
  return pv.length ? pv[0].precio : costoNeto(prod);
}
/**
 * El margen lo pone la LISTA; la presentación solo agrega su recargo de
 * fraccionamiento. Sin `gananciaLista` usa la primera lista del producto, que
 * es el precio de referencia que muestra el catálogo.
 */
function precioPresentacion(prod, presOrId, gananciaLista) {
  const pr = typeof presOrId === 'object' ? presOrId : presDe(prod, presOrId);
  if (!pr) return 0;
  const g = gananciaLista != null ? gananciaLista : ((prod.listasPrecio || [])[0] || {}).ganancia || 0;
  const porKg = costoNeto(prod) * (1 + (Number(g) || 0) / 100);
  return ajustarNeto(porKg * (Number(pr.tamKg) || 0) * (1 + (Number(pr.recargo) || 0) / 100), prod.iva);
}
function valorEntry(s) {
  const prod = getProducto(s.productoId); if (!prod) return 0;
  const cn = costoNeto(prod);
  if (s.presentacionId) { const pr = presDe(prod, s.presentacionId); return s.cantidad * cn * (pr ? Number(pr.tamKg) || 0 : 0); }
  return s.cantidad * cn;
}

/* ---------------- Comprobantes / cuenta corriente ---------------- */
function getComprobante(id) { return state.comprobantes.find((c) => c.id === id); }
function comprobantesDe(proveedorId) { return state.comprobantes.filter((c) => c.proveedorId === proveedorId).sort((a, b) => b.id - a.id); }
function cuentaProveedor(proveedorId) {
  let saldo = 0;
  state.comprobantes.filter((c) => c.proveedorId === proveedorId && c.estado === 'confirmado').forEach((c) => {
    if ((c.tipo === 'factura' || c.tipo === 'nota_debito') && c.condicionPago === 'cuenta_corriente') saldo += c.total;
    else if (c.tipo === 'nota_credito') saldo -= c.total;
  });
  return saldo;
}

/* ---------------- Métricas ---------------- */
function stockBajo() {
  return state.productos.filter((p) => {
    if (!p.stockMin) return false;
    const base = p.tipo === 'granel' ? suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
      : suma({ productoId: p.id, estado: 'disponible' });
    return base < p.stockMin;
  });
}
function incidenciasAbiertas() { return state.incidencias.filter((i) => i.estado !== 'resuelta'); }
function transferenciasPendientes() { return state.transferencias.filter((t) => t.estado !== 'recibida' && t.estado !== 'cancelada'); }

/* ---------------- Permisos (según el usuario activo del ctx) ---------------- */
function rolActual() {
  const u = getUsuario(state.ctx.usuarioId);
  return u ? u.rol : 'vendedor';
}
function can(perm) {
  const ps = PERMISOS_ROL[rolActual()] || [];
  return ps.indexOf('*') >= 0 || ps.indexOf(perm) >= 0;
}
function tiposMovPermitidos() {
  const r = rolActual();
  if (r === 'admin') return ['devolucion', 'ajuste', 'merma', 'vencido', 'defectuoso'];
  if (r === 'fraccionador') return ['merma', 'defectuoso'];
  if (r === 'vendedor') return ['devolucion'];
  return [];
}

/* ---------------- Contexto (cliente) ---------------- */
function setCtx(k, v) { state.ctx[k] = v; _persistCtx(); emit(); }

/* ---------------- Carga y sincronización con la API ---------------- */
function _errMsg(e) {
  const d = e instanceof HttpError ? e.data : null;
  if (d && d.message) return Array.isArray(d.message) ? d.message.join(', ') : d.message;
  return (e && e.message) || 'No se pudo conectar con la API.';
}

function mergeState(data) {
  state.sucursales = data.sucursales || [];
  state.proveedores = data.proveedores || [];
  state.usuarios = data.usuarios || [];
  state.productos = data.productos || [];
  state.stock = data.stock || [];
  // Preferencias que el cálculo local de precios necesita para dar el mismo
  // número que la API (hoy: el redondeo de góndola).
  state.configVentas = data.configVentas || {};
  // Normalización de nombres de campo que el frontend espera.
  state.transferencias = (data.transferencias || []).map((t) => ({
    ...t, items: (t.items || []).map((it) => ({ ...it, presId: it.presentacionId ?? null })),
  }));
  state.incidencias = (data.incidencias || []).map((i) => ({ ...i, presId: i.presentacionId ?? null }));
}

/* ================== SECCIONES PEREZOSAS ==================
 * `movimientos` y `comprobantes` crecen sin techo, así que salieron del
 * bootstrap: se cargan la primera vez que una pantalla las mira y no antes.
 * Los helpers de lectura siguen siendo sincrónicos sobre `state`, así que los
 * paneles no cambiaron: solo tienen que pedir la sección al montarse.
 *
 * `_seccion` recuerda qué se cargó para (a) no repetir el pedido y (b) que una
 * mutación refresque SOLO lo que alguien está mirando.
 */
const _seccion = { movimientos: false, comprobantes: false };
const _enVuelo = { movimientos: null, comprobantes: null };

/** Nombres derivados que el historial muestra; se calculan una vez al cargar. */
function _enriquecerMovimientos(rows) {
  return (rows || []).map((m) => {
    const p = getProducto(m.productoId);
    return {
      ...m,
      productoNombre: p ? p.nombre : '',
      sucursalNombre: (getSucursal(m.sucursalId) || {}).nombre || '',
      sucursalDestinoNombre: m.sucursalDestinoId ? (getSucursal(m.sucursalDestinoId) || {}).nombre : null,
      usuarioNombre: (getUsuario(m.usuarioId) || {}).nombre || '—',
      presLabel: m.presLabel || (p ? presLabel(p, m.presentacionId) : ''),
    };
  });
}

const _LOADERS = {
  movimientos: async () => {
    state.movimientos = _enriquecerMovimientos(await httpClient.get('/movimientos?limit=300'));
  },
  comprobantes: async () => {
    state.comprobantes = await httpClient.get('/comprobantes');
  },
};

/**
 * Carga una sección perezosa. Llamadas simultáneas comparten el mismo pedido;
 * si ya está cargada no hace nada (salvo `force`).
 */
function cargarSeccion(nombre, force = false) {
  if (_seccion[nombre] && !force) return Promise.resolve();
  if (_enVuelo[nombre]) return _enVuelo[nombre];
  _enVuelo[nombre] = _LOADERS[nombre]()
    .then(() => { _seccion[nombre] = true; emit(); })
    .catch(() => { /* el panel muestra vacío; el botón Actualizar reintenta */ })
    .finally(() => { _enVuelo[nombre] = null; });
  return _enVuelo[nombre];
}

/** Refresca solo las secciones que alguien ya abrió. */
function _refrescarSecciones() {
  return Promise.all(
    Object.keys(_seccion).filter((k) => _seccion[k]).map((k) => cargarSeccion(k, true)),
  );
}

async function refetch() {
  const data = await httpClient.get('/bootstrap');
  mergeState(data);
  await _refrescarSecciones();
  emit();
}

async function init() {
  if (_loaded || _loading) return;
  _loading = true;
  try {
    const data = await httpClient.get('/bootstrap');
    mergeState(data);
    if (state.ctx.usuarioId == null || !getUsuario(state.ctx.usuarioId)) {
      const admin = state.usuarios.find((u) => u.rol === 'admin') || state.usuarios[0];
      state.ctx.usuarioId = admin ? admin.id : null;
    }
    if (state.ctx.sucursalId != null && !getSucursal(state.ctx.sucursalId)) state.ctx.sucursalId = null;
    if (state.ctx.sucursalId == null && distribuidora()) state.ctx.sucursalId = distribuidora().id;
    _persistCtx();
    _loaded = true; _loadError = null;
  } catch (e) {
    _loadError = _errMsg(e);
  } finally {
    _loading = false; emit();
  }
}

async function reset() { await refetch(); }

/** Corre una mutación contra la API y refresca el snapshot. Devuelve {ok}/{ok:false,error}. */
async function _mutate(fn) {
  try {
    const data = await fn();
    await refetch();
    return Object.assign({ ok: true }, (data && typeof data === 'object') ? data : {});
  } catch (e) {
    return { ok: false, error: _errMsg(e) };
  }
}

/* ---------------- Mutaciones (API) ---------------- */
const crearProducto = (o) => _mutate(() => httpClient.post('/productos', o));
const editarProducto = (id, o) => _mutate(() => httpClient.patch('/productos/' + id, o));
const eliminarProducto = (id) => _mutate(() => httpClient.delete('/productos/' + id));
const guardarPresentaciones = (prodId, presentaciones) => _mutate(() => httpClient.put('/productos/' + prodId + '/presentaciones', { presentaciones }));
const guardarProveedoresProducto = (prodId, o) => _mutate(() => httpClient.put('/productos/' + prodId + '/proveedores', o));
const guardarListasProducto = (prodId, o) => _mutate(() => httpClient.put('/productos/' + prodId + '/listas', o));

const crearProveedor = (o) => _mutate(() => httpClient.post('/proveedores', o));
const editarProveedor = (id, o) => _mutate(() => httpClient.patch('/proveedores/' + id, o));
const eliminarProveedor = (id) => _mutate(() => httpClient.delete('/proveedores/' + id));

const crearSucursal = (o) => _mutate(() => httpClient.post('/sucursales', o));

const opCompra = (o) => _mutate(() => httpClient.post('/operaciones/compra', o));
const opVenta = (o) => _mutate(() => httpClient.post('/operaciones/venta', o));
const opFraccionar = (o) => _mutate(() => httpClient.post('/operaciones/fraccionar', o));
const opSimple = (o) => _mutate(() => httpClient.post('/operaciones/movimiento', o));

const crearTransferencia = (o) => _mutate(() => httpClient.post('/transferencias', o));
const avanzarTransferencia = (id) => _mutate(() => httpClient.post('/transferencias/' + id + '/avanzar'));
const cancelarTransferencia = (id) => _mutate(() => httpClient.post('/transferencias/' + id + '/cancelar'));

const crearIncidencia = (o) => _mutate(() => httpClient.post('/incidencias', o));
const avanzarIncidencia = (id) => _mutate(() => httpClient.post('/incidencias/' + id + '/avanzar'));
const resolverIncidencia = (id, resolucion) => _mutate(() => httpClient.post('/incidencias/' + id + '/resolver', { resolucion }));

/**
 * Un `<input type="date">` entrega `yyyy-mm-dd`, que `new Date()` interpreta
 * como medianoche UTC. En UTC−3 eso se muestra como el día ANTERIOR. Anclarlo
 * al mediodía local deja la fecha calendario intacta en cualquier huso.
 */
function _fechaLocal(v) {
  if (!v) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v;
}

function _cleanComprobante(o) {
  return {
    tipo: o.tipo, letra: o.letra, puntoVenta: o.puntoVenta,
    fecha: _fechaLocal(o.fecha), fechaCarga: _fechaLocal(o.fechaCarga),
    proveedorId: Number(o.proveedorId),
    sucursalId: o.sucursalId != null && o.sucursalId !== '' ? Number(o.sucursalId) : undefined,
    numero: o.numero != null && o.numero !== '' ? Number(o.numero) : undefined,
    condicionPago: o.condicionPago, recepcion: !!o.recepcion,
    vencimientoPago: _fechaLocal(o.vencimientoPago), observaciones: o.observaciones || '',
    // Costos que el usuario aceptó actualizar desde "Diferencias de costo".
    actualizarCostos: (o.actualizarCostos || []).map((x) => ({
      productoId: Number(x.productoId), costo: Number(x.costo) || 0,
    })),
    usuarioId: o.usuarioId != null ? Number(o.usuarioId) : undefined,
    items: (o.items || []).map((it) => ({
      productoId: Number(it.productoId),
      presentacionId: it.presentacionId != null && it.presentacionId !== '' ? Number(it.presentacionId) : undefined,
      cantidad: Number(it.cantidad) || 0, costoUnitario: Number(it.costoUnitario) || 0,
      descuento: Number(it.descuento) || 0, iva: it.iva != null ? Number(it.iva) : 21,
    })),
  };
}
const crearComprobante = (o) => _mutate(() => httpClient.post('/comprobantes', _cleanComprobante(o)));

/* ---- Costos y márgenes ----
 * La previsualización se calcula en el navegador (el store ya tiene costos y
 * márgenes), así que acá solo viajan los cambios aprobados. `historial` es
 * lectura pura; el resto refresca porque mueve todos los precios derivados. */
const actualizarCostos = (o) => _mutate(() => httpClient.post('/precios/costos', o));
const actualizarMargenes = (o) => _mutate(() => httpClient.post('/precios/margenes', o));
const historialPrecios = (q = '') => httpClient.get('/precios/historial' + q);
const revertirLotePrecios = (lote) => _mutate(() => httpClient.post('/precios/revertir/' + lote, {}));

export const inventoryStore = {
  get state() { return state; },
  get loaded() { return _loaded; },
  get loadError() { return _loadError; },
  subscribe, getVersion,
  init, reset, refetch, cargarSeccion,
  getProducto, getSucursal, getProveedor, getUsuario, presDe, distribuidora,
  unidadDe, presLabel, fmtCant, cant, suma, movimientosDe, valorEntry,
  rolActual, can, tiposMovPermitidos, setCtx,
  opCompra, opFraccionar, opVenta, opSimple,
  crearTransferencia, avanzarTransferencia, cancelarTransferencia,
  crearIncidencia, avanzarIncidencia, resolverIncidencia,
  crearProducto, editarProducto, eliminarProducto, guardarPresentaciones, crearSucursal,
  crearProveedor, editarProveedor, eliminarProveedor,
  guardarProveedoresProducto, guardarListasProducto,
  costoNeto, costoNetoEntry, proveedorActivoEntry, preciosVenta, precioBaseVenta, precioPresentacion,
  precioFinal, redondearPrecio,
  crearComprobante, getComprobante, comprobantesDe, cuentaProveedor,
  actualizarCostos, actualizarMargenes, historialPrecios, revertirLotePrecios,
  stockBajo, incidenciasAbiertas, transferenciasPendientes,
};
