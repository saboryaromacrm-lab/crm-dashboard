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
import { appConfig } from '@core/config/app.config.js';
import { leerClave, escribirClave, leerSesion } from '@core/auth/sesion.js';
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
  return leerClave(CTX_KEY) || { sucursalId: null, usuarioId: null };
}
function _persistCtx() { escribirClave(CTX_KEY, state.ctx); }

function nuevoEstado() {
  return {
    sucursales: [], proveedores: [], usuarios: [], productos: [],
    stock: [], movimientos: [], transferencias: [], incidencias: [], comprobantes: [],
    // Preferencias que afectan el cálculo de precios (llegan en el bootstrap).
    configVentas: {},
    // Catálogo del formato de venta (modalidad › lista). Se necesita para
    // ofrecer "agregar lista" en el producto: la lista existe en el catálogo,
    // lo que se carga acá es el markup de ESE producto en ella.
    listasCatalogo: { modalidades: [], listas: [], reglasMarca: [] },
    // Catálogos del producto (marca, categoría › subcategoría, etiquetas). Son
    // chicos y estables: viajan enteros en el bootstrap y los desplegables del
    // modal filtran en memoria, sin una llamada por tecla.
    catalogos: { marcas: [], categorias: [], subcategorias: [], etiquetas: [] },
    // Cuántas facturas de papel esperan que alguien las cargue (para el globito
    // del menú). Es solo el número: la bandeja la pide su panel.
    lecturasPendientes: 0,
    pedidosCafeteriaPendientes: 0,
    // Lo que apura del vigía de fechas (vencidos sin procesar + vence en ≤7 días).
    vencimientosUrgentes: 0,
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
/**
 * FORMATO DE COMPRA — espejo exacto de `costosFormato()` de `pricing.ts`.
 *
 * Está duplicado a propósito: la pantalla necesita recalcular la cadena con
 * cada tecla, y pedírsela a la API en cada pulsación sería inusable. Cualquier
 * cambio va en los dos lados o el formulario miente.
 *
 * Todos los importes son del BULTO; lo unitario se deriva con `cantidad`.
 */
function descuentoEfectivo(e) {
  if (!e) return 0;
  const factor = [e.descuento, e.descuento2, e.descuento3, e.descuento4]
    .reduce((acc, d) => acc * (1 - (Number(d) || 0) / 100), 1);
  return (1 - factor) * 100;
}

function costosFormato(e, iva) {
  const vacio = {
    cantidad: 1, costoLista: 0, costoListaUnitario: 0, descuentoEfectivo: 0,
    costoBruto: 0, costoNeto: 0, costoFinal: 0, costoNetoUnitario: 0, costoFinalUnitario: 0,
  };
  if (!e) return vacio;
  // Una cantidad en 0 dividiría por cero y dejaría los precios en Infinity.
  const cantidad = Math.max(Number(e.cantidad) || 1, 1e-9);
  const factorIva = 1 + (Number(iva) || 0) / 100;

  if (e.modoCosto === 'final') {
    const costoFinal = Number(e.costoFinal) || 0;
    const costoNeto = costoFinal / factorIva;
    return {
      cantidad, costoLista: 0, costoListaUnitario: 0, descuentoEfectivo: 0,
      costoBruto: costoNeto, costoNeto, costoFinal,
      costoNetoUnitario: costoNeto / cantidad,
      costoFinalUnitario: costoFinal / cantidad,
    };
  }

  const costoLista = Number(e.costo) || 0;
  const desc = descuentoEfectivo(e);
  const costoBruto = costoLista * (1 - desc / 100);
  const costoNeto = costoBruto * (1 + (Number(e.flete) || 0) / 100);
  const costoFinal = costoNeto * factorIva;
  return {
    cantidad,
    costoLista,
    costoListaUnitario: costoLista / cantidad,
    descuentoEfectivo: desc,
    costoBruto,
    costoNeto,
    costoFinal,
    costoNetoUnitario: costoNeto / cantidad,
    costoFinalUnitario: costoFinal / cantidad,
  };
}

/** El costo que alimenta el precio de venta: neto y unitario. */
function costoNetoEntry(e, iva) { return costosFormato(e, iva).costoNetoUnitario; }

/**
 * El formato que fija el precio. Una sola definición, igual que en el backend:
 * si cada pantalla eligiera por su cuenta, el precio de la ficha podría no
 * coincidir con el del POS.
 */
function formatoActivo(prod) {
  const arr = prod?.formatosCompra || prod?.proveedores || [];
  if (!arr.length) return null;
  return arr.find((e) => e.usarParaPrecio) || arr[0];
}
function costoNeto(prod) { return costoNetoEntry(formatoActivo(prod), prod?.iva); }

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

/**
 * Espejo de `precioVentaFila` (pricing.ts): la fila del formato de venta hecha
 * precio, en los dos modos. Con MARKUP el precio acompaña al costo (redondeo de
 * góndola sobre el final unitario); con PRECIO definido el final del FORMATO es
 * exacto — es la voluntad del que lo fijó — y la unidad se deriva dividiendo.
 *
 * `costo` permite cotizar un PAQUETE fraccionado con el mismo helper: su costo es
 * el del kilo × su tamaño. Sin él se usa el del producto, que es el caso normal.
 */
function ventaFormato(prod, fila, costo) {
  const unidades = Math.max(Number(fila?.unidades) || 1, 1e-9);
  const iva = Number(prod?.iva) || 0;
  const redondeo = prod?.redondeo ?? (Number(state.configVentas?.redondeoPrecio) || 0);
  if (fila?.modoPrecio === 'precio') {
    const finalFormato = money(Number(fila.precioFijo) || 0);
    return {
      unidades,
      netoUnitario: money(finalFormato / (1 + iva / 100) / unidades),
      finalUnitario: money(finalFormato / unidades),
      finalFormato,
    };
  }
  const base = costo != null ? Number(costo) || 0 : costoNeto(prod);
  const bruto = base * (1 + (Number(fila?.markup) || 0) / 100);
  const netoUnitario = redondeo > 0 ? money(redondearPrecio(bruto * (1 + iva / 100), redondeo) / (1 + iva / 100)) : money(bruto);
  const finalUnitario = redondeo > 0 ? redondearPrecio(netoUnitario * (1 + iva / 100), redondeo) : money(netoUnitario * (1 + iva / 100));
  return { unidades, netoUnitario, finalUnitario, finalFormato: money(finalUnitario * unidades) };
}

function preciosVenta(prod) {
  const cn = costoNeto(prod);
  // `prod.listas` es el FORMATO DE VENTA: solo las listas en las que este
  // producto se vende, cada una con SU markup. Acá solo se aplica el redondeo.
  return (prod.listas || []).map((l) => ({
    ...l,
    // El servidor ya resolvió el modo (markup o precio definido); recalcular
    // acá con markup rompería las filas de precio fijo.
    precio: l.precio != null ? l.precio : ajustarNeto(cn * (1 + (Number(l.markup) || 0) / 100), prod.iva),
  }));
}

/**
 * La fila del PISO: la lista base configurada, o —si el producto no la tiene—
 * la de peor orden, que es la más cara. Es el precio de vidriera: lo que se
 * cobra sin que el ticket habilite ninguna otra lista.
 */
function filaPiso(prod) {
  const suyas = prod.listas || [];
  if (!suyas.length) return null;
  const baseId = state.configVentas?.listaBaseId;
  return suyas.find((l) => l.listaId === baseId) || suyas[suyas.length - 1];
}

function precioBaseVenta(prod) {
  const piso = filaPiso(prod);
  if (!piso) return costoNeto(prod);
  if (piso.precio != null) return piso.precio;
  return ajustarNeto(costoNeto(prod) * (1 + (Number(piso.markup) || 0) / 100), prod.iva);
}
/**
 * PRECIO FINAL DE UN PAQUETE, con IVA. Lo trae la API en cada presentación
 * (`precioFinal`), derivado de SU formato de venta — acá no se recalcula nada:
 * hubo una función que multiplicaba el precio de la lista de la madre por un
 * recargo y esa era la segunda forma de decir cuánto vale un paquete. Se borró
 * con la columna (0053).
 *
 * `null` significa **sin precio** (el paquete no tiene formato de venta
 * cargado), y no es lo mismo que cero: quien muestra tiene que decirlo.
 */
function precioPaquete(prod, presOrId) {
  const pr = typeof presOrId === 'object' ? presOrId : presDe(prod, presOrId);
  return pr && pr.precioFinal != null ? pr.precioFinal : null;
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
/**
 * Saldo del proveedor calculado con lo que ya está en memoria.
 *
 * LISTA DE TIPOS · tiene que decir lo MISMO que `cuenta()` de la API
 * (`comprobantes.module.ts`), que es la fuente de verdad. Estaba desalineada en
 * dos cosas:
 *
 *   · Le faltaba la **liquidación**, así que la mitad no facturada generaba
 *     deuda en la base y el saldo de la pantalla no la contaba: plata que se
 *     debe, invisible.
 *   · Filtraba por `condicionPago === 'cuenta_corriente'`, criterio que el
 *     backend ya abandonó: una factura marcada "contado" pero sin pago
 *     registrado desaparecía del saldo aunque no se hubiera pagado nunca. Ahora
 *     la deuda la define el DOCUMENTO y la cancela el PAGO.
 */
function cuentaProveedor(proveedorId) {
  let deuda = 0;
  let pagado = 0;
  state.comprobantes.filter((c) => c.proveedorId === proveedorId && c.estado === 'confirmado').forEach((c) => {
    if (c.tipo === 'factura' || c.tipo === 'liquidacion' || c.tipo === 'nota_debito') {
      deuda += c.total; pagado += c.pagado || 0;
    } else if (c.tipo === 'nota_credito') deuda -= c.total;
  });
  return deuda - pagado;
}

/* ---------------- Métricas ---------------- */
function stockBajo() {
  return state.productos.filter((p) => {
    if (!p.stockMin) return false;
    /* Lo que ya no se trae NO se repone: un discontinuado con stock mínimo
     * pediría reposición para siempre, y el archivado ni existe. */
    if ((p.estado || 'activo') !== 'activo') return false;
    const base = p.tipo === 'granel' ? suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
      : suma({ productoId: p.id, estado: 'disponible' });
    return base < p.stockMin;
  });
}
function incidenciasAbiertas() { return state.incidencias.filter((i) => i.estado !== 'resuelta'); }
function transferenciasPendientes() { return state.transferencias.filter((t) => t.estado !== 'recibida' && t.estado !== 'cancelada'); }

/* ---------------- Permisos (dinámicos: viajan con el usuario en el bootstrap) ---------------- */
function rolActual() {
  const u = getUsuario(state.ctx.usuarioId);
  return u ? u.rolClave : '';
}
function can(perm) {
  const u = getUsuario(state.ctx.usuarioId);
  const ps = (u && u.permisos) || [];
  return ps.indexOf('*') >= 0 || ps.indexOf(perm) >= 0;
}
/** Tipos de movimiento manual que el usuario puede registrar, según sus permisos. */
function tiposMovPermitidos() {
  const tipos = [];
  if (can('devoluciones')) tipos.push('devolucion');
  if (can('inventario')) tipos.push('ajuste', 'vencido');
  if (can('merma')) tipos.push('merma');
  if (can('defectuoso')) tipos.push('defectuoso');
  return tipos;
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
  state.listasCatalogo = data.listasCatalogo || { modalidades: [], listas: [], reglasMarca: [] };
  state.catalogos = data.catalogos || { marcas: [], categorias: [], subcategorias: [], etiquetas: [] };
  // Normalización de nombres de campo que el frontend espera.
  state.transferencias = (data.transferencias || []).map((t) => ({
    ...t, items: (t.items || []).map((it) => ({ ...it, presId: it.presentacionId ?? null })),
  }));
  state.incidencias = (data.incidencias || []).map((i) => ({ ...i, presId: i.presentacionId ?? null }));
  state.lecturasPendientes = Number(data.lecturasPendientes) || 0;
  state.pedidosCafeteriaPendientes = Number(data.pedidosCafeteriaPendientes) || 0;
  state.vencimientosUrgentes = Number(data.vencimientosUrgentes) || 0;
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
    // LA SESIÓN MANDA: el usuario operativo es el que se LOGUEÓ — con login
    // real ya no hay selector libre de usuario. Si el logueado no es
    // admin/superadmin, tampoco cambia de sucursal: opera donde dijo al entrar.
    const sesion = leerSesion();
    const uSesion = sesion?.usuario?.id != null ? getUsuario(sesion.usuario.id) : null;
    if (uSesion) {
      state.ctx.usuarioId = uSesion.id;
      const esJefe = uSesion.rolClave === 'admin' || uSesion.rolClave === 'superadmin';
      if (!esJefe && sesion?.sucursal?.id != null && getSucursal(sesion.sucursal.id)) {
        state.ctx.sucursalId = sesion.sucursal.id;
      }
    } else if (state.ctx.usuarioId == null || !getUsuario(state.ctx.usuarioId)) {
      // Sin sesión (desarrollo con la API abierta): cae al jefe para no romper.
      const activos = state.usuarios.filter((u) => u.activo !== false);
      const jefe = activos.find((u) => u.rolClave === 'superadmin')
        || activos.find((u) => u.rolClave === 'admin') || activos[0];
      state.ctx.usuarioId = jefe ? jefe.id : null;
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
/**
 * Ciclo de vida: activo | discontinuado | archivado. Un solo endpoint para dar
 * de baja y para reactivar — es el mismo movimiento en las dos direcciones.
 */
const cambiarEstadoProducto = (id, estado, motivo) => _mutate(
  () => httpClient.post(`/productos/${id}/estado`, { estado, motivo: motivo || undefined }),
);
/* Los discontinuados que ya se agotaron. Lectura directa (no vive en el
 * snapshot: es una consulta con gracia de días que el panel pide cuando entra). */
const sugerenciasArchivado = () => httpClient.get('/productos/sugerencias/archivado');
const archivarLote = (ids, motivo) => _mutate(
  () => httpClient.post('/productos/archivar-lote', { ids, motivo: motivo || undefined }),
);
const guardarPresentaciones = (prodId, presentaciones) => _mutate(() => httpClient.put('/productos/' + prodId + '/presentaciones', { presentaciones }));
const guardarFormatosCompra = (prodId, formatos) => _mutate(() => httpClient.put('/productos/' + prodId + '/formatos-compra', { formatos }));
const guardarListasProducto = (prodId, o) => _mutate(() => httpClient.put('/productos/' + prodId + '/listas', o));

/**
 * El formato de venta de UN PAQUETE fraccionado. Va por su propia ruta: la madre
 * y el paquete se cotizan por separado, y un solo PUT para los dos haría que
 * guardar uno pudiera borrar el otro.
 */
const guardarListasPresentacion = (presId, o) => _mutate(() => httpClient.put('/productos/presentaciones/' + presId + '/listas', o));

/* ---------------- Catálogos del producto ---------------- */

/**
 * `tipo` es 'marcas' | 'categorias' | 'subcategorias' | 'etiquetas'. Un solo
 * juego de métodos para los cuatro: el backend resuelve las diferencias, acá
 * no hay razón para escribir lo mismo cuatro veces.
 */
const crearCatalogo = (tipo, o) => _mutate(() => httpClient.post('/catalogos/' + tipo, o));
const editarCatalogo = (tipo, id, o) => _mutate(() => httpClient.patch('/catalogos/' + tipo + '/' + id, o));
const eliminarCatalogo = (tipo, id) => _mutate(() => httpClient.delete('/catalogos/' + tipo + '/' + id));
const fusionarCatalogo = (tipo, id, haciaId) =>
  _mutate(() => httpClient.post('/catalogos/' + tipo + '/' + id + '/fusionar', { haciaId }));

/** Siguiente código propio libre, para el botón "Crear un código". */
const siguienteCodigo = () => httpClient.get('/productos/siguiente-codigo');

/**
 * Un EAN-13 propio libre, para el botón "Generar" de la presentación. `excluir`
 * son los códigos que la pantalla tiene cargados y todavía no guardó: el
 * servidor no los conoce y sin eso dos renglones nuevos salían iguales.
 */
const siguienteEan = (excluir = []) => httpClient.get(
  '/productos/siguiente-ean' + (excluir.length ? `?excluir=${encodeURIComponent(excluir.join(','))}` : ''),
);

/** Subcategorías de una categoría: la mitad de abajo de la cascada. */
function subcategoriasDe(categoriaId) {
  if (!categoriaId) return [];
  return state.catalogos.subcategorias.filter((sc) => sc.categoriaId === categoriaId);
}

const crearProveedor = (o) => _mutate(() => httpClient.post('/proveedores', o));
const editarProveedor = (id, o) => _mutate(() => httpClient.patch('/proveedores/' + id, o));
const eliminarProveedor = (id) => _mutate(() => httpClient.delete('/proveedores/' + id));

const opCompra = (o) => _mutate(() => httpClient.post('/operaciones/compra', o));
const opVenta = (o) => _mutate(() => httpClient.post('/operaciones/venta', o));
const opFraccionar = (o) => _mutate(() => httpClient.post('/operaciones/fraccionar', o));

/**
 * Corregir una tanda mal cargada. Manda el usuario: una corrección de stock sin
 * autor es justo la que uno quiere poder preguntar después.
 */
const opCorregirFraccionado = (o) => _mutate(() => httpClient.post('/operaciones/corregir-fraccionado', {
  usuarioId: state.ctx.usuarioId ?? undefined,
  ...o,
}));
const opSimple = (o) => _mutate(() => httpClient.post('/operaciones/movimiento', o));

const crearTransferencia = (o) => _mutate(() => httpClient.post('/transferencias', o));
const avanzarTransferencia = (id, desde) => _mutate(() => httpClient.post('/transferencias/' + id + '/avanzar', { usuarioId: state.ctx.usuarioId, desde }));
const cancelarTransferencia = (id) => _mutate(() => httpClient.post('/transferencias/' + id + '/cancelar'));

/* Preparación en dos listas: editar renglones, agregar/quitar y confirmar con reserva. */
const editarItemTransferencia = (id, itemId, o) => _mutate(() => httpClient.patch(`/transferencias/${id}/items/${itemId}`, o));
const agregarItemTransferencia = (id, o) => _mutate(() => httpClient.post(`/transferencias/${id}/items`, o));
const quitarItemTransferencia = (id, itemId) => _mutate(() => httpClient.delete(`/transferencias/${id}/items/${itemId}`));
const confirmarListaTransferencia = (id, tipo, listo) => _mutate(() => httpClient.post(`/transferencias/${id}/lista`, { tipo, listo, usuarioId: state.ctx.usuarioId }));
/** Recepción CONTADA: items = [{itemId, cantidadRecibida}]. La diferencia genera incidencia sola. */
const recibirTransferencia = (id, o) => _mutate(() => httpClient.post('/transferencias/' + id + '/recibir', o));
/** El libro del almacén: una fila por documento, valuada a costo congelado. */
const operacionesAlmacen = (q = '') => httpClient.get('/operaciones/almacen' + q);

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
    /*
     * De la bandeja de facturas subidas: el CAE que salió del QR y la lectura
     * que este comprobante viene a cerrar. Sin `lecturaId` acá, el papel se
     * cargaba pero la bandeja se quedaba con la factura marcada como pendiente
     * para siempre (la lista de abajo ya se tragó cuatro campos por lo mismo).
     */
    cae: o.cae || undefined,
    lecturaId: o.lecturaId != null && o.lecturaId !== '' ? Number(o.lecturaId) : undefined,
    /*
     * La factura que esta NC/ND ajusta. Sin esto la nota quedaba flotando: restaba
     * de la deuda TOTAL del proveedor pero la factura seguía ofreciendo su importe
     * entero para pagar, y el que paga factura por factura le pagaba de más.
     */
    refComprobanteId: o.refComprobanteId != null && o.refComprobanteId !== ''
      ? Number(o.refComprobanteId) : undefined,
    /*
     * EL PIE DE LA FACTURA. El descuento general y las percepciones que trajo el
     * papel: sin estos campos acá se perdían en silencio y el total del sistema
     * quedaba distinto del de la factura (esta función ya se tragó
     * `usuarioId`, `cantidad` y `activarProveedor` por la misma razón —
     * agregar un campo al modal y olvidarse de esta lista).
     */
    bonificacion: Number(o.bonificacion) || 0,
    bonificacionImporte: Number(o.bonificacionImporte) || 0,
    percepciones: (o.percepciones || [])
      .filter((p) => (p?.nombre ?? '').trim() && Number(p.importe) > 0)
      .map((p) => ({
        nombre: String(p.nombre).trim(),
        alicuota: Number(p.alicuota) || 0,
        base: p.base === 'total' ? 'total' : 'neto',
        importe: Number(p.importe) || 0,
      })),
    /*
     * Costos que el usuario aceptó actualizar desde "Impacto en precios".
     * `cantidad` es el tamaño del bulto de ESTA entrega (kg o unidades) y viaja
     * JUNTO al costo porque son un solo hecho: "la bolsa de 20 kg sale
     * $40.000". Mandar el precio nuevo con los kilos viejos dejaría el $/kg
     * —que es lo que fija la góndola— mintiendo.
     */
    actualizarCostos: (o.actualizarCostos || []).map((x) => ({
      productoId: Number(x.productoId),
      costo: Number(x.costo) || 0,
      cantidad: Number(x.cantidad) > 0 ? Number(x.cantidad) : undefined,
    })),
    /** Productos cuyo proveedor activo pasa a ser el de este comprobante. */
    activarProveedor: (o.activarProveedor || []).map(Number).filter(Boolean),
    /**
     * El pago, en el mismo acto de cargar el comprobante: los pagos de sucursal
     * que esta factura toma (así se APLICAN) y el resto que se paga ahora.
     */
    tomarPagos: (o.tomarPagos || [])
      .map((x) => ({ pagoId: Number(x.pagoId), importe: Number(x.importe) || 0 }))
      .filter((x) => x.pagoId && x.importe > 0),
    pagoContado: o.pagoContado && Number(o.pagoContado.importe) > 0
      ? {
        importe: Number(o.pagoContado.importe),
        medio: o.pagoContado.medio || 'efectivo',
        cajaSesionId: o.pagoContado.cajaSesionId != null ? Number(o.pagoContado.cajaSesionId) : undefined,
        referencia: o.pagoContado.referencia || undefined,
      }
      : undefined,
    /*
     * Quién lo cargó. Por defecto el usuario operativo (el de la sesión): sin
     * esto el cambio de precio que dispara la recepción queda sin autor, y ni
     * la auditoría ni el aviso a los cajeros pueden decir quién lo hizo.
     */
    usuarioId: o.usuarioId != null ? Number(o.usuarioId) : (state.ctx.usuarioId ?? undefined),
    items: (o.items || []).map((it) => ({
      productoId: Number(it.productoId),
      presentacionId: it.presentacionId != null && it.presentacionId !== '' ? Number(it.presentacionId) : undefined,
      cantidad: Number(it.cantidad) || 0, costoUnitario: Number(it.costoUnitario) || 0,
      descuento: Number(it.descuento) || 0, iva: it.iva != null ? Number(it.iva) : 21,
      /*
       * Del renglón leído del PDF: el código del artículo como lo imprime el
       * proveedor y la descripción del papel. Alimentan el MAPEO APRENDIDO
       * (la próxima factura reconoce el artículo sola). Esta lista ya se tragó
       * campos en silencio — si el ítem gana un campo, va acá también.
       */
      codigoProveedor: it.codigoProveedor ? String(it.codigoProveedor) : undefined,
      descripcionPapel: it.descripcionPapel ? String(it.descripcionPapel) : undefined,
    })),
  };
}
const crearComprobante = (o) => _mutate(() => httpClient.post('/comprobantes', _cleanComprobante(o)));
/** Las facturas de este proveedor que una NC/ND puede ajustar, con su saldo real. */
const facturasReferenciables = (proveedorId) => httpClient.get('/comprobantes/referenciables/' + proveedorId);

/* ---- Pagos en sucursal (plata a cuenta de proveedores de MERCADERÍA) ---- */
/**
 * El pago nace en la caja de una sucursal (módulo Ventas) con destino
 * "mercaderia" y espera acá a que el administrador cargue la factura y lo
 * aplique. Lecturas directas (no viven en el snapshot del store: crecen y se
 * filtran); las mutaciones pasan por `_mutate` para refrescar lo abierto —
 * aplicar un pago cambia el `pagado` de los comprobantes.
 */
const _qsPagos = (filtros = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const q = p.toString();
  return q ? `?${q}` : '';
};
const pagosSucursal = (filtros) => httpClient.get('/pagos-proveedor' + _qsPagos({ destino: 'mercaderia', ...filtros }));
const pagoSucursal = (id) => httpClient.get('/pagos-proveedor/' + id);
const pagosDisponibles = (proveedorId) => httpClient.get(`/pagos-proveedor/disponibles/${proveedorId}?destino=mercaderia`);
/** Turno abierto de una sucursal, o null. Lo usa el pago al contado del comprobante. */
const cajaAbierta = (sucursalId) => httpClient.get(`/caja/actual/${sucursalId}`);
const pagosDocsPendientes = (proveedorId) => httpClient.get(`/pagos-proveedor/pendientes/${proveedorId}?destino=mercaderia`);
const imputarPago = (id, imputaciones, usuarioId) => _mutate(() => httpClient.post(`/pagos-proveedor/${id}/imputar`, { imputaciones, usuarioId }));
const quitarImputacionPago = (imputacionId) => _mutate(() => httpClient.delete('/pagos-proveedor/imputaciones/' + imputacionId));
const anularPago = (id, motivo) => _mutate(() => httpClient.post(`/pagos-proveedor/${id}/anular`, { motivo }));
const moverDestinoPago = (id, destino) => _mutate(() => httpClient.patch(`/pagos-proveedor/${id}/destino`, { destino }));

/* ---- Cafetería (coffit) ----
 * El envío es un PUNTO DE SALIDA a costo: el CRM no lleva el stock del café
 * (coffit es el dueño). Crear/anular pasan por `_mutate` porque mueven stock. */
const enviosCafeteria = (filtros) => httpClient.get('/cafeteria/envios' + _qsPagos(filtros || {}));
const envioCafeteria = (id) => httpClient.get('/cafeteria/envios/' + id);
const resumenCafeteria = (filtros) => httpClient.get('/cafeteria/resumen' + _qsPagos(filtros || {}));
/** Lo enviado a coffit en el período, agregado por artículo (con filtros). */
const metricaCafeteria = (filtros) => httpClient.get('/cafeteria/metrica' + _qsPagos(filtros || {}));
const crearEnvioCafeteria = (o) => _mutate(() => httpClient.post('/cafeteria/envios', { usuarioId: state.ctx.usuarioId ?? undefined, ...o }));
/**
 * Editar un envío YA ENVIADO: la API revierte el egreso viejo y aplica el
 * nuevo en una transacción. `version` viaja para que dos pantallas abiertas no
 * se pisen en silencio: la que quedó vieja recibe un error claro.
 */
const editarEnvioCafeteria = (id, o) => _mutate(() => httpClient.put(`/cafeteria/envios/${id}`, { usuarioId: state.ctx.usuarioId ?? undefined, ...o }));

/* ---- Pedidos de la cafetería (la demanda; el envío los cumple y los cierra) ---- */
const pedidosCafeteria = (filtros) => httpClient.get('/cafeteria/pedidos' + _qsPagos(filtros || {}));
const pedidoCafeteria = (id) => httpClient.get('/cafeteria/pedidos/' + id);
const crearPedidoCafeteria = (o) => _mutate(() => httpClient.post('/cafeteria/pedidos', { usuarioId: state.ctx.usuarioId ?? undefined, ...o }));
const tomarPedidoCafeteria = (id) => _mutate(() => httpClient.post(`/cafeteria/pedidos/${id}/tomar`, {}));
const anularPedidoCafeteria = (id, motivo) => _mutate(() => httpClient.post(`/cafeteria/pedidos/${id}/anular`, { motivo, usuarioId: state.ctx.usuarioId ?? undefined }));
/** pedido → transito → recibido. `desde` evita que un doble clic salte dos pasos. */
const anularEnvioCafeteria = (id, motivo) => _mutate(() => httpClient.post(`/cafeteria/envios/${id}/anular`, { motivo, usuarioId: state.ctx.usuarioId ?? undefined }));

/* ---- Vencimientos (el vigía de fechas, sin lote) ----
 *
 * Los registros NO son stock: lecturas directas, fuera del snapshot (crecen
 * con cada control). En el bootstrap viaja solo el CONTADOR de urgentes para
 * el globito. Las mutaciones SÍ pasan por `_mutate`: procesar puede bajar
 * stock de verdad (movimiento 'vencido') y el contador del globito cambia. */
const vencimientos = () => httpClient.get('/vencimientos');
const resumenVencimientos = () => httpClient.get('/vencimientos/resumen');
const reportesVencimientos = (periodo) => httpClient.get('/vencimientos/reportes?periodo=' + encodeURIComponent(periodo || 'mes'));
const crearSesionVencimientos = (o) => _mutate(() => httpClient.post('/vencimientos/sesiones', { usuarioId: state.ctx.usuarioId ?? undefined, ...o }));
const editarVencimiento = (id, o) => _mutate(() => httpClient.put(`/vencimientos/${id}`, o));
const eliminarVencimiento = (id) => _mutate(() => httpClient.delete(`/vencimientos/${id}`));
const procesarVencimiento = (id, o) => _mutate(() => httpClient.post(`/vencimientos/${id}/procesar`, { usuarioId: state.ctx.usuarioId ?? undefined, ...o }));
/* El cruce oferta ↔ mercadería vigilada. La oferta NO se crea acá: se arma en el
 * motor de Ventas (un solo lugar para crear ofertas en todo el sistema) y el
 * registro queda atado a ella. Esto es la lectura de ese cruce. */
const ofertasVencimientos = () => httpClient.get('/vencimientos/ofertas');

/* ---- Facturas por procesar (la bandeja de papeles subidos) ----
 *
 * Lecturas directas, sin pasar por el snapshot del store: la bandeja crece y se
 * filtra, y el panel la pide con su filtro. Lo único que viaja en el bootstrap
 * es el CONTADOR de pendientes, para el globito del menú.
 *
 * Las mutaciones tampoco pasan por `_mutate`: subir o descartar un papel no
 * cambia nada del inventario, así que refrescar el store entero sería tirar
 * abajo el catálogo por nada. El que sí lo hace es `crearComprobante`, y ahí el
 * `lecturaId` cierra la bandeja del lado de la API.
 */
const lecturasFactura = (estado) => httpClient.get('/facturas/lecturas' + (estado ? `?estado=${estado}` : ''));
const lecturaFactura = (id) => httpClient.get('/facturas/lecturas/' + id);
const subirFactura = (o) => httpClient.post('/facturas/lecturas', {
  usuarioId: state.ctx.usuarioId ?? undefined,
  // La sucursal del que sube es la MEJOR PISTA de dónde entró la mercadería —
  // la cajera de Express 2 fotografía lo que recibió Express 2— pero sigue
  // siendo editable: el papel no dice la sucursal y nadie puede adivinarla.
  sucursalId: state.ctx.sucursalId ?? undefined,
  ...o,
});
const agregarPaginaFactura = (id, archivo) => httpClient.post(`/facturas/lecturas/${id}/archivos`, archivo);
const borrarPaginaFactura = (archivoId) => httpClient.delete('/facturas/archivos/' + archivoId);
const guardarLecturaFactura = (id, patch) => httpClient.put('/facturas/lecturas/' + id, patch);
const descartarLecturaFactura = (id, motivo) => httpClient.post(`/facturas/lecturas/${id}/descartar`, { motivo });
const recuperarLecturaFactura = (id) => httpClient.post(`/facturas/lecturas/${id}/recuperar`, {});
/** "Esta factura ya la había cargado a mano": engancha el papel al comprobante. */
const vincularLecturaFactura = (id, comprobanteId) => _mutate(() => httpClient.post(`/facturas/lecturas/${id}/vincular`, { comprobanteId }));
/** URL directa del papel: va en un <img src> o se abre en una pestaña. */
const urlPapelFactura = (archivoId) => `${appConfig.api.baseUrl}/facturas/archivos/${archivoId}`;
/**
 * La propuesta de carga leída del PDF digital: renglones + pie + encabezado.
 * Solo lectura — no toca nada; el alta la usa para precargar y la persona
 * confirma. Para fotos el endpoint contesta 400 (eso es la etapa de visión).
 */
const leerRenglonesLectura = (id) => httpClient.get(`/facturas/lecturas/${id}/renglones`);

/* ---- Costos y márgenes ----
 * La previsualización se calcula en el navegador (el store ya tiene costos y
 * márgenes), así que acá solo viajan los cambios aprobados. `historial` es
 * lectura pura; el resto refresca porque mueve todos los precios derivados. */
/* ---- Percepciones del proveedor (las que cobra al pie de sus facturas) ---- */
const percepcionesProveedor = (id) => httpClient.get(`/proveedores/${id}/percepciones`);
const guardarPercepcionesProveedor = (id, percepciones) => _mutate(() => httpClient.put(`/proveedores/${id}/percepciones`, { percepciones }));

/** Importación masiva: la API escribe el catálogo entero en una transacción. */
const importarCatalogo = (proveedorId, items) => _mutate(() => httpClient.post('/productos/importar', { proveedorId, items }));

const actualizarCostos = (o) => _mutate(() => httpClient.post('/precios/costos', o));
const actualizarMargenes = (o) => _mutate(() => httpClient.post('/precios/margenes', o));
const historialPrecios = (q = '') => httpClient.get('/precios/historial' + q);
const evolucionPrecios = (productoId) => httpClient.get('/precios/evolucion?productoId=' + productoId);
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
  opCompra, opFraccionar, opCorregirFraccionado, opVenta, opSimple,
  crearTransferencia, avanzarTransferencia, cancelarTransferencia,
  editarItemTransferencia, agregarItemTransferencia, quitarItemTransferencia, confirmarListaTransferencia,
  crearIncidencia, avanzarIncidencia, resolverIncidencia,
  crearProducto, editarProducto, eliminarProducto, cambiarEstadoProducto,
  sugerenciasArchivado, archivarLote,
  guardarPresentaciones, importarCatalogo,
  crearCatalogo, editarCatalogo, eliminarCatalogo, fusionarCatalogo, subcategoriasDe, siguienteCodigo, siguienteEan,
  crearProveedor, editarProveedor, eliminarProveedor,
  percepcionesProveedor, guardarPercepcionesProveedor,
  guardarFormatosCompra, guardarListasProducto, guardarListasPresentacion,
  costoNeto, costoNetoEntry, costosFormato, descuentoEfectivo, formatoActivo, preciosVenta, ventaFormato, precioBaseVenta, precioPaquete,
  precioFinal, redondearPrecio,
  crearComprobante, getComprobante, comprobantesDe, cuentaProveedor, facturasReferenciables,
  lecturasFactura, lecturaFactura, subirFactura, agregarPaginaFactura, borrarPaginaFactura,
  guardarLecturaFactura, descartarLecturaFactura, recuperarLecturaFactura, vincularLecturaFactura,
  urlPapelFactura, leerRenglonesLectura,
  pagosSucursal, pagoSucursal, pagosDisponibles, pagosDocsPendientes, cajaAbierta,
  enviosCafeteria, envioCafeteria, resumenCafeteria, metricaCafeteria,
  crearEnvioCafeteria, editarEnvioCafeteria, anularEnvioCafeteria,
  pedidosCafeteria, pedidoCafeteria, crearPedidoCafeteria, tomarPedidoCafeteria, anularPedidoCafeteria,
  vencimientos, resumenVencimientos, reportesVencimientos, crearSesionVencimientos,
  editarVencimiento, eliminarVencimiento, procesarVencimiento, ofertasVencimientos,
  imputarPago, quitarImputacionPago, anularPago, moverDestinoPago,
  actualizarCostos, actualizarMargenes, historialPrecios, evolucionPrecios, revertirLotePrecios,
  stockBajo, incidenciasAbiertas, transferenciasPendientes,
  recibirTransferencia, operacionesAlmacen,
};
