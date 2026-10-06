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

/** Kg que trae la BOLSA de un granel: el formato de compra que fija el precio (o el más viejo). 0 = sin dato. */
export function kgBolsa(p) {
  if (!p || p.tipo !== 'granel') return 0;
  const arr = p.formatosCompra || [];
  const f = arr.find((e) => e.usarParaPrecio) || [...arr].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))[0];
  const kg = Number(f?.cantidad) || 0;
  return kg > 1 ? kg : 0;
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

