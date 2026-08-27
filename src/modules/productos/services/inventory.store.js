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
    /** `{ total, porProveedor }` que calcula la API; ver `cuentaProveedor`. */
    saldosProveedor: { total: 0, porProveedor: {} },
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
    porcSinFactura: 0, costoPrecio: 0, costoPrecioUnitario: 0,
    ivaAbsorbido: 0, ivaAbsorbidoUnitario: 0, desembolso: 0, desembolsoUnitario: 0,
  };
  if (!e) return vacio;
  // Una cantidad en 0 dividiría por cero y dejaría los precios en Infinity.
  const cantidad = Math.max(Number(e.cantidad) || 1, 1e-9);
  const factorIva = 1 + (Number(iva) || 0) / 100;
  /*
   * MERCADERÍA SIN FACTURA (0072): el costo se parte en dos. `costoNeto` es el
   * REAL (la parte facturada en neto porque su IVA se recupera + la parte sin
   * factura entera + el flete); `costoPrecio` es la base del markup, con la
   * parte sin factura despojada del IVA que el negocio absorbe al vender
   * (÷ factor). La diferencia es `ivaAbsorbido`.
   *
   * EL FLETE SIGUE LA CADENA DEL SISTEMA VIEJO (25/8/2026, espejo exacto de
   * `pricing.ts` del backend — ahí está el razonamiento completo). El flete
   * viene facturado y su % es el bruto: su IVA vuelve como crédito, así que a
   * la base entra × ratio, igual que la mercadería. La base queda
   * `(mercadería + flete) × ratio`, el absorbido es SOLO de la mercadería
   * (el IVA del flete no se pierde), y con q=0 el ratio es 1 y nada cambia.
   */
  const q = Math.min(Math.max(Number(e.porcSinFactura) || 0, 0), 100) / 100;
  const ratio = (1 - q) + q / factorIva;
  const partir = (mercaderia, flete) => {
    const costoPrecio = (mercaderia + flete) * ratio;
    const desembolso = mercaderia * ((1 - q) * factorIva + q);
    const absorbido = mercaderia * (1 - ratio);
    return {
      porcSinFactura: q * 100,
      costoPrecio,
      costoPrecioUnitario: costoPrecio / cantidad,
      ivaAbsorbido: absorbido,
      ivaAbsorbidoUnitario: absorbido / cantidad,
      desembolso,
      desembolsoUnitario: desembolso / cantidad,
    };
  };

  if (e.modoCosto === 'final') {
    // Lo cargado es el DESEMBOLSO al proveedor (lo que se paga): solo la parte
    // facturada trae IVA adentro. Sin flete acá: queda fuera del cálculo.
    const costoFinal = Number(e.costoFinal) || 0;
    const costoNeto = costoFinal / ((1 - q) * factorIva + q);
    return {
      cantidad, costoLista: 0, costoListaUnitario: 0, descuentoEfectivo: 0,
      costoBruto: costoNeto, costoNeto, costoFinal,
      costoNetoUnitario: costoNeto / cantidad,
      costoFinalUnitario: costoFinal / cantidad,
      ...partir(costoNeto, 0),
    };
  }

  const costoLista = Number(e.costo) || 0;
  const desc = descuentoEfectivo(e);
  const costoBruto = costoLista * (1 - desc / 100);
  // El flete NOMINAL y su valor real en neto (facturado → su IVA vuelve): con
  // q=0 son el mismo número y todo queda como siempre.
  const flete = costoBruto * ((Number(e.flete) || 0) / 100);
  const costoNeto = costoBruto + flete * ratio;
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
    // La mercadería es el bruto (post descuentos); el flete va NOMINAL — el
    // ratio se lo aplica `partir` adentro, junto con la mercadería.
    ...partir(costoBruto, flete),
  };
}

/** El costo REAL unitario: valuación de stock y pérdidas. NO cotiza. */
function costoNetoEntry(e, iva) { return costosFormato(e, iva).costoNetoUnitario; }
/** La BASE del precio de venta: lo único que puede multiplicar el markup. */
function costoPrecioEntry(e, iva) { return costosFormato(e, iva).costoPrecioUnitario; }

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
/** La base del precio del producto (0072): con todo facturado, = costoNeto. */
function costoPrecio(prod) { return costoPrecioEntry(formatoActivo(prod), prod?.iva); }

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
  // La BASE del precio (0072), no el costo real: acá se cotiza.
  const base = costo != null ? Number(costo) || 0 : costoPrecio(prod);
  const bruto = base * (1 + (Number(fila?.markup) || 0) / 100);
  const netoUnitario = redondeo > 0 ? money(redondearPrecio(bruto * (1 + iva / 100), redondeo) / (1 + iva / 100)) : money(bruto);
  const finalUnitario = redondeo > 0 ? redondearPrecio(netoUnitario * (1 + iva / 100), redondeo) : money(netoUnitario * (1 + iva / 100));
  return { unidades, netoUnitario, finalUnitario, finalFormato: money(finalUnitario * unidades) };
}

function preciosVenta(prod) {
  // La BASE del precio (0072), no el costo real: acá se cotiza.
  const cn = costoPrecio(prod);
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
  // La BASE del precio (0072): sin lista cargada, "el precio" es el costo — y
  // el costo que cotiza es la base, no el real.
  if (!piso) return costoPrecio(prod);
  if (piso.precio != null) return piso.precio;
  return ajustarNeto(costoPrecio(prod) * (1 + (Number(piso.markup) || 0) / 100), prod.iva);
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
 * SALDO DEL PROVEEDOR — LO CALCULA LA API, NO ESTA PANTALLA.
 * ============================================================================
 * Antes esto sumaba sobre `state.comprobantes`, y era la CUARTA copia de la
 * fórmula de la deuda. Ya se había desalineado dos veces: le faltaba la
 * liquidación (la mitad no facturada generaba deuda invisible) y filtraba por
 * `condicionPago`, criterio que el backend había abandonado.
 *
 * Lo que la mató fue algo peor: desde que el listado esconde las liquidaciones
 * a quien no tiene el permiso, este saldo salía **más bajo que la deuda real**
 * para ese usuario, sin ningún aviso. Un saldo que depende de quién lo mira no
 * es un saldo.
 *
 * Ahora viene de `GET /comprobantes/saldos`, que suma en la base — y por eso el
 * listado pudo pasar a pedirse acotado sin dejar el saldo mal en silencio.
 */
function cuentaProveedor(proveedorId) {
  return state.saldosProveedor?.porProveedor?.[proveedorId] ?? 0;
}

/** El saldo de TODOS los proveedores, para el encabezado sin filtro. */
function saldoTotalProveedores() {
  return state.saldosProveedor?.total ?? 0;
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
/**
 * Lo que cuenta el globito del menú: trabajo que alguien tiene que atender.
 * El `borrador` NO entra — es el pedido que se está escribiendo, no le llegó a
 * nadie, y el contador no filtra por sucursal: sumaría los borradores de todos
 * los locales al globito de cada uno.
 */
function transferenciasPendientes() {
  return state.transferencias.filter((t) => t.estado !== 'borrador' && t.estado !== 'recibida' && t.estado !== 'cancelada');
}
/** El borrador de esa ruta si existe (uno por ruta: ver la migración 0056). */
function borradorDeRuta(origenId, destinoId) {
  return state.transferencias.find(
    (t) => t.estado === 'borrador' && t.origenId === origenId && t.destinoId === destinoId,
  ) || null;
}
/** Los pedidos que MI sucursal dejó a medio armar, para retomarlos. */
function misBorradores(sucursalId) {
  return state.transferencias.filter((t) => t.estado === 'borrador' && t.destinoId === sucursalId);
}

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
  /*
   * Los comprobantes se piden ACOTADOS y con los SALDOS al lado.
   *
   * Era el único listado sin techo: traía todos los comprobantes con sus ítems,
   * percepciones, pagos y notas, y se re-pedía completo en cada `_mutate`
   * (cargar una factura recargaba la historia entera).
   *
   * Los `saldos` vienen aparte y de la base, no de sumar esta lista: si el saldo
   * se calculara con lo que llegó, acotar la lista lo dejaría MAL EN SILENCIO
   * para cualquier proveedor con más de 300 comprobantes. Van juntos en la misma
   * carga a propósito — el techo y el saldo son dos mitades de lo mismo.
   */
  comprobantes: async () => {
    const [lista, saldos] = await Promise.all([
      httpClient.get('/comprobantes?limit=300'),
      httpClient.get('/comprobantes/saldos'),
    ]);
    state.comprobantes = lista;
    state.saldosProveedor = saldos;
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

const crearProveedor = (o) => _mutate(() => httpClient.post('/proveedores', o));
const editarProveedor = (id, o) => _mutate(() => httpClient.patch('/proveedores/' + id, o));
const eliminarProveedor = (id) => _mutate(() => httpClient.delete('/proveedores/' + id));

/* Sin `opCompra`: el ingreso de mercadería es la factura de Compras (18/8/2026). */
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

const avanzarTransferencia = (id, desde) => _mutate(() => httpClient.post('/transferencias/' + id + '/avanzar', { usuarioId: state.ctx.usuarioId, desde }));
const cancelarTransferencia = (id) => _mutate(() => httpClient.post('/transferencias/' + id + '/cancelar'));

/* ---------------- El pedido que se arma durante el día ----------------
 * Abre o retoma el borrador de esa ruta (uno por ruta), lo guarda solo
 * mientras se arma, y lo envía cuando está listo.
 */
const abrirBorradorPedido = (origenId, destinoId) => _mutate(
  () => httpClient.post('/transferencias/borrador', { origenId, destinoId, usuarioId: state.ctx.usuarioId }),
);
/**
 * GUARDADO AUTOMÁTICO: **no pasa por `_mutate` a propósito**. `_mutate`
 * recarga el bootstrap completo (productos, stock, listas, todo) y esto se
 * dispara cada vez que el cajero deja de tipear — sería traerse el inventario
 * entero cada dos segundos. La pantalla se refresca una sola vez, cuando el
 * pedido se envía o se descarta.
 */
const guardarBorradorPedido = async (id, o) => {
  try {
    const data = await httpClient.put(`/transferencias/${id}/borrador`, { usuarioId: state.ctx.usuarioId, ...o });
    return Object.assign({ ok: true }, data && typeof data === 'object' ? data : {});
  } catch (e) {
    return { ok: false, error: _errMsg(e) };
  }
};
const enviarBorradorPedido = (id) => _mutate(
  () => httpClient.post(`/transferencias/${id}/enviar`, { usuarioId: state.ctx.usuarioId }),
);
const descartarBorradorPedido = (id) => _mutate(() => httpClient.delete(`/transferencias/${id}/borrador`));

/* ---------------- Control de stock (0066) ----------------
 * Nada de esto pasa por `_mutate` SALVO aplicar, y es a propósito: abrir,
 * contar y cerrar no tocan stock, y recargar el bootstrap completo por cada
 * Enter del contador sería traerse el inventario entero renglón por renglón
 * (la lección del autosave del pedido). Aplicar sí mueve stock: ahí el
 * refresco completo es exactamente lo que corresponde.
 */
/* Siempre `{ ok, data }` — el patrón del borrador mezclaba la respuesta en el
 * objeto y eso rompe cuando la API devuelve un ARRAY (Object.assign sobre un
 * array lo convierte en {0:…,1:…}). */
const _directo = async (fn) => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: _errMsg(e) };
  }
};
const listarConteos = () => _directo(() => httpClient.get('/conteos'));
const crearConteo = (o) => _directo(() => httpClient.post('/conteos', o));
const getConteo = (id) => _directo(() => httpClient.get(`/conteos/${id}`));
/** `contado: null` devuelve el renglón a pendiente. */
const contarItemConteo = (id, itemId, contado) => _directo(
  () => httpClient.put(`/conteos/${id}/items/${itemId}`, { contado }),
);
const cerrarConteo = (id) => _directo(() => httpClient.post(`/conteos/${id}/cerrar`, {}));
const reabrirConteo = (id) => _directo(() => httpClient.post(`/conteos/${id}/reabrir`, {}));
const marcarRecontarConteo = (id, itemId, recontar) => _directo(
  () => httpClient.post(`/conteos/${id}/items/${itemId}/recontar`, { recontar }),
);
const descartarConteo = (id) => _directo(() => httpClient.delete(`/conteos/${id}`));
const aplicarConteo = (id) => _mutate(() => httpClient.post(`/conteos/${id}/aplicar`, {}));

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
    /*
     * COMPROMISOS (0068): las cuotas con que el proveedor diferido promete
     * pagar el saldo. Esta lista YA se tragó seis campos por olvidarse de
     * agregarlos acá — que no sea el séptimo.
     */
    compromisos: (o.compromisos || [])
      .map((k) => ({ importe: Number(k.importe) || 0, fechaVenc: k.fechaVenc, obs: k.obs || undefined }))
      .filter((k) => k.importe > 0 && k.fechaVenc),
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
/**
 * LLEGÓ LA FACTURA DE UN REMITO (26/8): el remito PASA A SER la factura, sin
 * volver a mover stock. Los renglones viajan por `itemId` (los del remito) y
 * solo llevan lo que el papel puede traer distinto: precio, descuento e IVA.
 */
const facturarRemito = (remitoId, o) => _mutate(() => httpClient.post(`/comprobantes/${remitoId}/facturar`, {
  letra: o.letra, puntoVenta: o.puntoVenta,
  numero: o.numero != null && o.numero !== '' ? Number(o.numero) : undefined,
  fecha: _fechaLocal(o.fecha), fechaCarga: _fechaLocal(o.fechaCarga),
  vencimientoPago: _fechaLocal(o.vencimientoPago), observaciones: o.observaciones || '',
  cae: o.cae || undefined,
  lecturaId: o.lecturaId != null && o.lecturaId !== '' ? Number(o.lecturaId) : undefined,
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
  actualizarCostos: (o.actualizarCostos || []).map((x) => ({
    productoId: Number(x.productoId),
    costo: Number(x.costo) || 0,
    cantidad: Number(x.cantidad) > 0 ? Number(x.cantidad) : undefined,
  })),
  activarProveedor: (o.activarProveedor || []).map(Number).filter(Boolean),
  tomarPagos: (o.tomarPagos || [])
    .map((x) => ({ pagoId: Number(x.pagoId), importe: Number(x.importe) || 0 }))
    .filter((x) => x.pagoId && x.importe > 0),
  compromisos: (o.compromisos || [])
    .map((k) => ({ importe: Number(k.importe) || 0, fechaVenc: k.fechaVenc, obs: k.obs || undefined }))
    .filter((k) => k.importe > 0 && k.fechaVenc),
  pagoContado: o.pagoContado && Number(o.pagoContado.importe) > 0
    ? {
      importe: Number(o.pagoContado.importe),
      medio: o.pagoContado.medio || 'efectivo',
      cajaSesionId: o.pagoContado.cajaSesionId != null ? Number(o.pagoContado.cajaSesionId) : undefined,
      referencia: o.pagoContado.referencia || undefined,
    }
    : undefined,
  usuarioId: o.usuarioId != null ? Number(o.usuarioId) : (state.ctx.usuarioId ?? undefined),
  items: (o.items || []).map((it) => ({
    itemId: Number(it.itemId),
    costoUnitario: Number(it.costoUnitario) || 0,
    descuento: Number(it.descuento) || 0,
    iva: it.iva != null ? Number(it.iva) : 21,
  })),
}));
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
/** El PAPEL del pago (nº de remito y concepto). No toca plata: la cajera paga
 *  el flete con el camión en la puerta y el remito lo tiene el administrativo. */
const actualizarPapelPago = (id, datos) => _mutate(() => httpClient.patch(`/pagos-proveedor/${id}/papel`, datos));

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
/** Anular = reversión completa del egreso; sube la versión y coffit lo deshace. */
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
/*
 * EL PAPEL DE UNA FACTURA, con la credencial (25/8). Desde que la API se cerró,
 * la URL cruda en un `<img src>` o un `<a href>` recibía 401 — la etiqueta no
 * puede mandar el token — y la bandeja mostraba miniaturas rotas. Devuelve una
 * promesa con una URL `blob:` local, bajada con el Bearer y cacheada.
 */
const papelFactura = (archivoId) => httpClient.urlProtegida(`/facturas/archivos/${archivoId}`);
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

/** Importación masiva: la API escribe el catálogo entero en una transacción.
 *  La del PADRÓN de proveedores vive en el módulo Proveedores (27/8). */
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
  opFraccionar, opCorregirFraccionado, opVenta, opSimple,
  avanzarTransferencia, cancelarTransferencia,
  abrirBorradorPedido, guardarBorradorPedido, enviarBorradorPedido, descartarBorradorPedido,
  listarConteos, crearConteo, getConteo, contarItemConteo, cerrarConteo, reabrirConteo,
  marcarRecontarConteo, descartarConteo, aplicarConteo,
  editarItemTransferencia, agregarItemTransferencia, quitarItemTransferencia, confirmarListaTransferencia,
  crearIncidencia, avanzarIncidencia, resolverIncidencia,
  crearProducto, editarProducto, eliminarProducto, cambiarEstadoProducto,
  sugerenciasArchivado, archivarLote,
  guardarPresentaciones, importarCatalogo,
  crearCatalogo, editarCatalogo, eliminarCatalogo, fusionarCatalogo, siguienteCodigo, siguienteEan,
  crearProveedor, editarProveedor, eliminarProveedor,
  percepcionesProveedor, guardarPercepcionesProveedor,
  guardarFormatosCompra, guardarListasProducto, guardarListasPresentacion,
  costoNeto, costoNetoEntry, costoPrecio, costoPrecioEntry, costosFormato, descuentoEfectivo, formatoActivo, preciosVenta, ventaFormato, precioBaseVenta, precioPaquete,
  precioFinal, redondearPrecio,
  crearComprobante, facturarRemito, getComprobante, comprobantesDe, cuentaProveedor, saldoTotalProveedores,
  facturasReferenciables,
  lecturasFactura, lecturaFactura, subirFactura, agregarPaginaFactura, borrarPaginaFactura,
  guardarLecturaFactura, descartarLecturaFactura, recuperarLecturaFactura, vincularLecturaFactura,
  papelFactura, leerRenglonesLectura,
  pagosSucursal, pagoSucursal, pagosDisponibles, pagosDocsPendientes, cajaAbierta,
  enviosCafeteria, envioCafeteria, resumenCafeteria, metricaCafeteria,
  crearEnvioCafeteria, editarEnvioCafeteria, anularEnvioCafeteria,
  pedidosCafeteria, pedidoCafeteria, crearPedidoCafeteria, tomarPedidoCafeteria, anularPedidoCafeteria,
  vencimientos, resumenVencimientos, reportesVencimientos, crearSesionVencimientos,
  editarVencimiento, eliminarVencimiento, procesarVencimiento, ofertasVencimientos,
  imputarPago, quitarImputacionPago, anularPago, moverDestinoPago, actualizarPapelPago,
  actualizarCostos, actualizarMargenes, historialPrecios, evolucionPrecios, revertirLotePrecios,
  stockBajo, incidenciasAbiertas, transferenciasPendientes, borradorDeRuta, misBorradores,
  recibirTransferencia, operacionesAlmacen,
};
