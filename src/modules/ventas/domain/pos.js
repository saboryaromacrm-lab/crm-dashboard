/**
 * LÓGICA DEL PUNTO DE VENTA (pura, sin React)
 * ============================================================================
 * Todo lo que el POS calcula vive acá: parseo de códigos, aritmética del
 * renglón y del ticket, y el reducer del ticket en curso. Separado de la vista
 * porque es lo que hay que poder razonar (y algún día testear) sin pantalla.
 *
 * Criterio de importes, igual que en el backend: los precios son NETOS y el
 * IVA se suma aparte.
 */
import { norm } from './constants.js';

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ------------------------------------------------------------------ *
 * Códigos de barras
 * ------------------------------------------------------------------ */

/**
 * Etiqueta de balanza (peso variable). Formato EAN-13 de plaza:
 *
 *     PP  IIIII  VVVVV  C
 *     │   │      │      └ dígito verificador
 *     │   │      └ valor: peso en GRAMOS, o importe con 2 decimales
 *     │   └ código interno del artículo (5 dígitos)
 *     └ prefijo configurable (por defecto 20)
 *
 * Convención de vinculación: el artículo se busca por un `codigoBarras` que
 * *termine* con esos 5 dígitos, que es como se etiquetan en la balanza.
 *
 * Devuelve `null` si no es una etiqueta de balanza; así el llamador sigue con
 * la búsqueda normal sin ramificar.
 */
export function parseEtiquetaBalanza(codigo, config) {
  if (!config?.balanzaHabilitada) return null;
  const c = String(codigo || '').trim();
  const prefijo = String(config.balanzaPrefijo || '20');
  if (c.length !== 13 || !/^\d+$/.test(c) || !c.startsWith(prefijo)) return null;

  const codigoItem = c.slice(2, 7);
  const bruto = Number(c.slice(7, 12));
  return config.balanzaModo === 'importe'
    ? { codigoItem, importe: r2(bruto / 100) }
    : { codigoItem, cantidad: r2(bruto / 1000) }; // gramos → kg
}

/**
 * Busca en el catálogo lo que el cajero tipeó o escaneó.
 * Prioridad: código exacto → código que termina igual → nombre/marca.
 * El orden importa: un escaneo tiene que resolver en un solo resultado.
 */
export function buscarEnCatalogo(catalogo, texto, limite = 8) {
  const q = String(texto || '').trim();
  if (!q) return [];

  const exacto = catalogo.filter((i) => i.codigoBarras && i.codigoBarras === q);
  if (exacto.length) return exacto;

  if (/^\d{3,}$/.test(q)) {
    const parcial = catalogo.filter((i) => i.codigoBarras && i.codigoBarras.endsWith(q));
    if (parcial.length) return parcial.slice(0, limite);
  }

  const ql = norm(q);
  return catalogo
    .filter((i) => norm(i.nombre).includes(ql) || norm(i.marca).includes(ql))
    .slice(0, limite);
}

/* ------------------------------------------------------------------ *
 * Aritmética
 * ------------------------------------------------------------------ */

/** Neto, IVA y total de un renglón. El descuento se aplica sobre el bruto. */
export function calcularRenglon(r) {
  const bruto = (Number(r.cantidad) || 0) * (Number(r.precioUnitario) || 0);
  const neto = bruto * (1 - (Number(r.descuento) || 0) / 100);
  const iva = (neto * (Number(r.iva) || 0)) / 100;
  return { bruto: r2(bruto), neto: r2(neto), iva: r2(iva), total: r2(neto + iva) };
}

/**
 * Totales del ticket. Los extras (envío, packaging) entran como un renglón más
 * con su propia alícuota: es lo que hace el backend, y un solo criterio evita
 * que la pantalla y el comprobante muestren números distintos.
 */
export function totalesTicket(renglones, extras = []) {
  let neto = 0; let iva = 0; let bruto = 0; let unidades = 0;
  for (const r of renglones) {
    const c = calcularRenglon(r);
    bruto += c.bruto; neto += c.neto; iva += c.iva;
    unidades += Number(r.cantidad) || 0;
  }
  let netoExtras = 0;
  for (const e of extras) {
    const imp = Number(e.importe) || 0;
    netoExtras += imp;
    iva += (imp * (Number(e.iva) || 0)) / 100;
  }
  return {
    bruto: r2(bruto),
    descuento: r2(bruto - neto),
    extras: r2(netoExtras),
    neto: r2(neto + netoExtras),
    iva: r2(iva),
    total: r2(neto + netoExtras + iva),
    renglones: renglones.length,
    unidades: r2(unidades),
  };
}

/* ------------------------------------------------------------------ *
 * Ticket en curso (reducer)
 * ------------------------------------------------------------------ */

export const ticketInicial = { renglones: [], extras: [], uid: 1 };

/**
 * `uid` es la identidad del renglón en la UI (no viaja al backend). Se usa un
 * contador y no la posición del array para que editar una fila no reordene el
 * foco ni pierda el input a medio tipear.
 */
export function ticketReducer(estado, accion) {
  switch (accion.tipo) {
    case 'agregar': {
      const { item, cantidad = 1, descuentoCliente = 0 } = accion;
      // Repetir un artículo suma cantidad en vez de abrir otro renglón.
      const existente = estado.renglones.find((r) => r.key === item.key);
      if (existente) {
        return {
          ...estado,
          renglones: estado.renglones.map((r) =>
            r.key === item.key ? { ...r, cantidad: r2(r.cantidad + cantidad) } : r),
        };
      }
      const renglon = {
        uid: estado.uid,
        key: item.key,
        productoId: item.productoId,
        presentacionId: item.presentacionId,
        nombre: item.nombre,
        detalle: item.detalle,
        unidad: item.unidad,
        fraccionable: item.fraccionable,
        iva: item.iva,
        stock: item.stock,
        precioLista: item.precio,
        precioUnitario: item.precio,
        descuento: descuentoCliente,
        cantidad: r2(cantidad),
      };
      return { ...estado, renglones: [...estado.renglones, renglon], uid: estado.uid + 1 };
    }
    case 'cantidad':
      return {
        ...estado,
        renglones: estado.renglones.map((r) =>
          r.uid === accion.uid ? { ...r, cantidad: Math.max(0, Number(accion.valor) || 0) } : r),
      };
    case 'descuento':
      return {
        ...estado,
        renglones: estado.renglones.map((r) =>
          r.uid === accion.uid ? { ...r, descuento: Math.min(100, Math.max(0, Number(accion.valor) || 0)) } : r),
      };
    case 'precio':
      return {
        ...estado,
        renglones: estado.renglones.map((r) =>
          r.uid === accion.uid ? { ...r, precioUnitario: Math.max(0, Number(accion.valor) || 0) } : r),
      };
    case 'quitar':
      return { ...estado, renglones: estado.renglones.filter((r) => r.uid !== accion.uid) };
    case 'limpiar':
      return { ...estado, renglones: [], extras: [] };

    /* ---- Cargos que no son mercadería (envío, packaging) ---- */
    case 'extraAgregar':
      return {
        ...estado,
        extras: [...estado.extras, {
          uid: estado.uid,
          concepto: accion.concepto,
          importe: r2(accion.importe),
          iva: Number(accion.iva) || 0,
        }],
        uid: estado.uid + 1,
      };
    case 'extraQuitar':
      return { ...estado, extras: estado.extras.filter((e) => e.uid !== accion.uid) };

    /** Carga un borrador traído de la API (al abrir una venta en curso). */
    case 'cargar':
      return { renglones: accion.renglones, extras: accion.extras, uid: accion.uid };
    /** Cambió el cliente: se re-aplica su descuento a los renglones que no se tocaron. */
    case 'descuentoCliente':
      return {
        ...estado,
        renglones: estado.renglones.map((r) =>
          r.descuento === (accion.anterior || 0) ? { ...r, descuento: accion.valor || 0 } : r),
      };
    default:
      return estado;
  }
}

/** Renglones en el formato que espera `POST/PUT /ventas`. */
export function itemsParaApi(renglones) {
  return renglones.map((r) => ({
    productoId: r.productoId,
    presentacionId: r.presentacionId ?? undefined,
    cantidad: r.cantidad,
    precioLista: r.precioLista,
    precioUnitario: r.precioUnitario,
    descuento: r.descuento,
    iva: r.iva,
  }));
}

export function extrasParaApi(extras) {
  return extras.map((e) => ({ concepto: e.concepto, importe: e.importe, iva: e.iva }));
}

/**
 * Reconstruye el ticket a partir de un borrador de la API.
 *
 * El borrador guarda ids y precios, no nombres: el catálogo (que el POS ya
 * tiene en memoria) aporta nombre, detalle, unidad y stock. Si un artículo dejó
 * de existir en el catálogo, el renglón igual se muestra —con lo que se sabe—
 * en vez de desaparecer sin aviso.
 */
export function ticketDesdeBorrador(borrador, catalogo) {
  const porClave = new Map(catalogo.map((c) => [`${c.productoId}:${c.presentacionId ?? ''}`, c]));
  let uid = 1;

  const renglones = (borrador.items ?? []).map((it) => {
    const cat = porClave.get(`${it.productoId}:${it.presentacionId ?? ''}`);
    return {
      uid: uid++,
      key: cat?.key ?? `x${it.id}`,
      productoId: it.productoId,
      presentacionId: it.presentacionId ?? null,
      nombre: cat?.nombre ?? `Producto #${it.productoId}`,
      detalle: cat?.detalle ?? '—',
      unidad: cat?.unidad ?? 'u',
      fraccionable: cat?.fraccionable ?? false,
      iva: it.iva,
      stock: cat?.stock ?? 0,
      precioLista: it.precioLista,
      precioUnitario: it.precioUnitario,
      descuento: it.descuento,
      cantidad: it.cantidad,
    };
  });

  const extras = (borrador.extras ?? []).map((e) => ({
    uid: uid++, concepto: e.concepto, importe: e.importe, iva: e.iva,
  }));

  return { renglones, extras, uid };
}

/** Etiqueta del último artículo cargado, para la tabla de ventas abiertas. */
export function ultimoArticulo(borrador, catalogo) {
  const items = borrador.items ?? [];
  if (!items.length) return null;
  const it = items[items.length - 1];
  const cat = catalogo.find(
    (c) => c.productoId === it.productoId && (c.presentacionId ?? null) === (it.presentacionId ?? null),
  );
  const nombre = cat ? `${cat.nombre} · ${cat.detalle}` : `Producto #${it.productoId}`;
  return { nombre, cantidad: it.cantidad, unidad: cat?.unidad ?? 'u' };
}

/**
 * Motivos por los que el ticket todavía no se puede cobrar. Se devuelven todos
 * juntos para que el cajero vea de una qué arreglar, no de a uno.
 */
export function problemasDelTicket(renglones, { permitirStockNegativo, descuentoMax, esAdmin }) {
  const problemas = [];
  if (!renglones.length) problemas.push('El ticket está vacío.');
  for (const r of renglones) {
    const etiqueta = `${r.nombre} (${r.detalle})`;
    if (r.cantidad <= 0) problemas.push(`${etiqueta}: la cantidad tiene que ser mayor a 0.`);
    if (r.precioUnitario <= 0) problemas.push(`${etiqueta}: no tiene precio cargado.`);
    if (!permitirStockNegativo && r.cantidad > r.stock + 1e-9) {
      problemas.push(`${etiqueta}: hay ${r.stock} ${r.unidad} y estás vendiendo ${r.cantidad}.`);
    }
    if (!esAdmin && r.descuento > descuentoMax + 1e-9) {
      problemas.push(`${etiqueta}: el descuento de ${r.descuento}% supera el tope de ${descuentoMax}%.`);
    }
  }
  return problemas;
}
