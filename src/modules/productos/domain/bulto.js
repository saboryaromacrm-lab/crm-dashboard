/**
 * CUÁNTAS UNIDADES TRAE EL BULTO CERRADO de un producto (1/10/2026; compartido
 * desde el 5/10/2026). La misma cuenta que `bultoCerrado` en el servidor:
 * primero la ficha (el bulto del DUN, «Unidades por bulto»); si no está, la
 * caja del formato de compra que fija el precio («Fija el precio» en la ficha
 * del proveedor). Granel, caja x1 o sin proveedor: 0 (no hay bulto).
 * Viaja para todos los roles: el tamaño del bulto no es un importe.
 */
export function bultoDe(p) {
  if (!p || p.tipo === 'granel') return 0;
  if ((Number(p.unidadesPorBulto) || 0) > 1) return Number(p.unidadesPorBulto);
  const arr = p.formatosCompra || [];
  const activo = arr.find((e) => e.usarParaPrecio) || [...arr].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))[0];
  const c = Number(activo?.cantidad) || 0;
  return c > 1 && Number.isInteger(c) ? c : 0;
}

/** «Viene en bulto de 20 u.» — o '' si el producto no tiene bulto. */
export const textoBulto = (p) => {
  const n = bultoDe(p);
  return n > 1 ? `Viene en bulto de ${n} u.` : '';
};

/*
 * UN RENGLÓN DE COMPRA COMO LA FACTURA (12/10/2026, 0161): con el bulto con
 * que se cargó y bultos enteros, «4 bultos × 14 u.»; si no, lo que entró. Lo
 * usan el detalle del comprobante y «la última vez que entró» de los pedidos.
 */
/** Los bultos enteros del renglón; 0 si se cargó por unidad, sin dato o no da justo. */
export function bultosDelRenglon(cantidad, porBulto) {
  const pb = Number(porBulto) || 0;
  const b = pb > 1 ? (Number(cantidad) || 0) / pb : 0;
  return b > 0 && Math.abs(b - Math.round(b)) < 1e-6 ? Math.round(b) : 0;
}
/** «bulto»/«bultos»; en el granel, «bolsa»/«bolsas». */
export const nombreBulto = (n, granel) => (granel ? (n === 1 ? 'bolsa' : 'bolsas') : (n === 1 ? 'bulto' : 'bultos'));

/** Kg que trae la BOLSA de un granel: el formato de compra que fija el precio (o el más viejo). 0 = sin dato. */
export function kgBolsa(p) {
  if (!p || p.tipo !== 'granel') return 0;
  const arr = p.formatosCompra || [];
  const f = arr.find((e) => e.usarParaPrecio) || [...arr].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))[0];
  const kg = Number(f?.cantidad) || 0;
  return kg > 1 ? kg : 0;
}

/*
 * LA ORDEN DE PEDIDO A UN PROVEEDOR (12/10/2026, pedido del dueño).
 * ============================================================================
 * Se le pide en SU formato: el bulto es la caja (o la bolsa del granel) del
 * formato de compra de ESE proveedor —el que fija el precio, o el más viejo—;
 * si no tiene, el bulto de la ficha. Sin ninguno, se pide por unidad (o kg).
 */
/** El formato de compra de ESE proveedor: el que fija el precio, o el más viejo (null si no le compra). */
export function formatoDelProveedor(p, proveedorId) {
  const suyos = (p?.formatosCompra || []).filter((e) => Number(e.proveedorId) === Number(proveedorId));
  return suyos.find((e) => e.usarParaPrecio) || [...suyos].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))[0] || null;
}

export function bultoDelProveedor(p, proveedorId) {
  if (!p) return 0;
  const c = Number(formatoDelProveedor(p, proveedorId)?.cantidad) || 0;
  if (p.tipo === 'granel') return c > 1 ? c : 0;
  if (c > 1 && Number.isInteger(c)) return c;
  return (Number(p.unidadesPorBulto) || 0) > 1 ? Number(p.unidadesPorBulto) : 0;
}

/** Cómo se dice el bulto en el pedido: «bulto X10Un», «bolsa X25Kg» o nada. */
export const bultoTexto = (p, n) => (n > 1 ? (p?.tipo === 'granel' ? `bolsa X${n}Kg` : `bulto X${n}Un`) : '');
/** La unidad en que se pide un renglón: bultos, bolsas, u. o kg. */
export const unidadPedido = (p, n, q) => {
  if (n > 1) return p?.tipo === 'granel' ? (q === 1 ? 'bolsa' : 'bolsas') : (q === 1 ? 'bulto' : 'bultos');
  return p?.tipo === 'granel' ? 'kg' : 'u.';
};

const cifra = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');
const plural = (n, uno, varios) => `${cifra(n)} ${n === 1 ? uno : varios}`;
/**
 * LA LÍNEA DE TOTALES DEL PEDIDO (22/10/2026, pedido del dueño): cuántos
 * bultos y cuántas unidades en total; del granel, bolsas y kilos aparte (no
 * se suman con las unidades). `renglones`: [{ p, bulto, cantidad }], la
 * cantidad en la unidad del renglón (bultos, bolsas, u. o kg). '' sin nada.
 */
export function totalesPedido(renglones) {
  const t = { bultos: 0, unidades: 0, bolsas: 0, kg: 0 };
  for (const { p, bulto, cantidad: n } of renglones) {
    if (!(n > 0)) continue;
    if (p?.tipo === 'granel') {
      if (bulto > 1) { t.bolsas += n; t.kg += n * bulto; } else t.kg += n;
    } else if (bulto > 1) { t.bultos += n; t.unidades += n * bulto; } else t.unidades += n;
  }
  const partes = [
    t.bultos > 0 && plural(t.bultos, 'bulto', 'bultos'),
    t.unidades > 0 && plural(t.unidades, 'unidad', 'unidades'),
    t.bolsas > 0 && plural(t.bolsas, 'bolsa', 'bolsas'),
    t.kg > 0 && `${cifra(t.kg)} kg`,
  ].filter(Boolean);
  return partes.length ? `Total: ${partes.join(' · ')}` : '';
}

/**
 * DISPONIBLE POR PRODUCTO Y SUCURSAL, en la unidad en que se le compra al
 * proveedor: unidades en los enteros; kg en el granel, sumando lo ya
 * fraccionado en paquetes (también es de esa bolsa). Una sola pasada por el
 * stock: el `store.cant` busca fila por fila, y para miles de productos por
 * sucursal sería lentísimo.
 */
export function indiceDisponible(stock, productos) {
  const kgPaquete = new Map();
  for (const p of productos) {
    if (p.tipo === 'granel') for (const pr of p.presentaciones || []) kgPaquete.set(pr.id, Number(pr.tamKg) || 0);
  }
  const m = new Map();
  const sumar = (k, q) => m.set(k, (m.get(k) ?? 0) + q);
  for (const st of stock) {
    if (st.estado !== 'disponible') continue;
    const q = st.presentacionId ? st.cantidad * (kgPaquete.get(st.presentacionId) ?? 0) : st.cantidad;
    if (!q) continue;
    sumar(`${st.productoId}:${st.sucursalId}`, q);
    sumar(`${st.productoId}:*`, q);
  }
  /** `sucursalId` null = la suma de todas las sucursales. */
  return (productoId, sucursalId) => Math.round((m.get(`${productoId}:${sucursalId ?? '*'}`) ?? 0) * 1000) / 1000;
}

/*
 * PEDIR O MANDAR POR BULTO (6/10/2026, pedido del dueño). El bulto es una
 * FORMA DE ESCRIBIR, no otra unidad: el renglón guarda SIEMPRE unidades
 * (`cantidad`), así que el stock, el disponible, el costo, el remito y la
 * recepción no se enteran — es la misma regla del pedido entre sucursales.
 * `modo: 'bulto'` solo cambia qué se tipea en la casilla (bultos enteros) y
 * cómo se muestra. Solo enteros sin presentación, y nunca en una ENTRADA de
 * Coffit (ahí el costo se declara por unidad).
 */
export const BULTO = '__bulto';
export const bultoOfrecible = (prod, entrada = false) => (!entrada && prod && prod.tipo !== 'granel' ? bultoDe(prod) : 0);
/** Lo que muestra el desplegable de presentación del renglón (sin bulto ofrecible, «bulto» se lee como unidad). */
export const valorPresentacion = (it, porBulto = 0) => (it.presId ? String(it.presId) : (it.modo === 'bulto' && porBulto > 1 ? BULTO : ''));
/** El cambio del desplegable: a bulto se redondea PARA ARRIBA al bulto entero (media caja no existe). */
export function cambioPresentacion(it, valor, porBulto) {
  if (valor === BULTO) {
    /* Sin bulto (el producto cambió con el formulario abierto): queda en unidad, nunca un id inválido. */
    if (!(porBulto > 1)) return { presId: null, modo: 'unidad' };
    const u = Number(it.cantidad) || 0;
    return { presId: null, modo: 'bulto', cantidad: u > 0 ? String(Math.ceil(u / porBulto) * porBulto) : '' };
  }
  const id = parseInt(valor, 10);
  return { presId: Number.isInteger(id) && id > 0 ? id : null, modo: 'unidad' };
}
/** La casilla en bultos: muestra unidades ÷ bulto y guarda bultos × bulto (en unidades). */
export const bultosDe = (it, porBulto) => (it.cantidad === '' ? '' : String(Math.round(((Number(it.cantidad) || 0) / porBulto) * 1000) / 1000));
export const unidadesDeBultos = (texto, porBulto) => (texto === '' ? '' : String(Math.round((Number(texto) || 0) * porBulto * 1000) / 1000));
/** Renglones en modo bulto que no dan bultos enteros (no se pueden mandar). */
export const bultosPartidos = (items, getProducto) => items.filter((it) => {
  if (it.modo !== 'bulto') return false;
  const n = bultoOfrecible(getProducto(it.prodId));
  const c = Number(it.cantidad) || 0;
  return n > 1 && c > 0 && !Number.isInteger(Math.round((c / n) * 1000) / 1000);
}).length;

/**
 * CUÁNTO SUMA LA ORDEN, ESTIMADO A COSTO (13/10/2026, pedido del dueño): solo
 * para mirar, no va en el mensaje. Por renglón, lo pedido en unidades (bultos ×
 * bulto, o unidades / kg) por el costo unitario del formato de ese proveedor.
 *   · aPagar: lo que se le paga — con IVA lo facturado, sin IVA lo «sin
 *     factura», más la comisión si cobra.
 *   · neto: el costo sin IVA.
 *   · sinCosto: renglones cuyo formato no tiene costo cargado (no suman).
 * `costos(formato, iva)` es `costosFormato` del store.
 */
export function estimarPedido(renglones, proveedorId, costos) {
  let aPagar = 0;
  let neto = 0;
  let sinCosto = 0;
  for (const { p, bulto, cantidad } of renglones) {
    if (!(cantidad > 0)) continue;
    const f = formatoDelProveedor(p, proveedorId);
    const c = f ? costos(f, p.iva) : null;
    if (!c || !(c.costoNetoUnitario > 0)) { sinCosto += 1; continue; }
    const unidades = cantidad * (bulto > 1 ? bulto : 1);
    aPagar += unidades * (c.desembolsoUnitario + (c.costoComisionUnitario || 0));
    neto += unidades * c.costoNetoUnitario;
  }
  return { aPagar, neto, sinCosto };
}
