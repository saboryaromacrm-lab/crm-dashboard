/**
 * MOTOR DEL FORMATO DE VENTA (puro, sin React)
 * ============================================================================
 * Decide con qué lista se cotiza CADA renglón del ticket.
 *
 * El precio es del PRODUCTO, no de la lista: cada producto trae en el catálogo
 * las listas en las que se vende, con su precio y su mínimo de unidades propio.
 * Lo que la lista aporta es identidad y `orden` de preferencia.
 *
 * POR DEFECTO, MINORISTA (1/10/2026, pedido del dueño: "muchas veces llevan
 * cantidades en forma minorista"). Hay CINCO puertas a otra lista, y son un OR
 * — con una alcanza —, pero NINGUNA se aplica sola: el motor dice qué renglones
 * CALIFICAN y por qué, la caja lo muestra en un aviso, y recién cuando el
 * cajero lo acepta (`aplicado`) se cotizan con esa lista.
 *
 *   1. CLIENTE   la tiene asignada en su ficha.
 *   2. PRODUCTO  el ticket llegó al mínimo de unidades de ESE producto.
 *   3. MARCA     el ticket llegó al mínimo de unidades de una MARCA (surtido).
 *                Alcanza solo a los renglones DE ESA MARCA.
 *   4. BULTO     el ticket lleva la caja cerrada: la de la lista que vende "de
 *                a N", o el bulto del producto para su PRIMERA lista mayorista.
 *   5. MONTO     el total a precio de mostrador pasó el umbral. Todo el ticket.
 *
 * Una vez aceptado el aviso, el ticket queda "en mayorista": lo que se agregue
 * y califique entra solo, y el renglón que deje de calificar (sacaron
 * unidades) vuelve solo a minorista. El precio mayorista se paga con los
 * medios que diga la configuración (`restriccionMayorista`), y eso lo vuelve a
 * validar el servidor.
 *
 * Entre las puertas abiertas gana la lista de `orden` menor. Una lista MÁS CARA
 * que el mostrador nunca califica: no sería un beneficio. Sin ninguna, queda el
 * PISO (la lista base).
 *
 * Todas las puertas se miden sobre CANTIDADES —o, el monto, sobre el precio de
 * MOSTRADOR, que no cambia al aplicar—, así que aplicar no altera la
 * calificación y el resultado no depende del orden en que se cargó el ticket.
 * Todo se resuelve en memoria con lo que ya trajo el catálogo.
 */

/**
 * Cantidades acumuladas del ticket, que es contra lo que se miden las puertas
 * 2 y 3. Se cuentan SIEMPRE, sin importar a qué lista quedó cada renglón: la
 * condición habla del volumen comprado, no del precio aplicado. Si dependiera
 * del precio, aplicar una lista cambiaría la calificación (razonamiento
 * circular) y el resultado dependería del orden en que se cargó el ticket.
 *
 * El granel suelto suma en su unidad (kg); los envasados, en unidades.
 */
export function agregadosTicket(renglones) {
  const porProducto = new Map();
  const porMarca = new Map();
  for (const r of renglones) {
    const c = Number(r.cantidad) || 0;
    if (!(c > 0)) continue;
    porProducto.set(r.productoId, (porProducto.get(r.productoId) ?? 0) + c);
    // Por id, no por nombre: la marca es una entidad del catálogo, así que no
    // hay que normalizar acentos ni caja, y renombrarla no parte la cuenta.
    if (r.marcaId) porMarca.set(r.marcaId, (porMarca.get(r.marcaId) ?? 0) + c);
  }
  return { porProducto, porMarca };
}

/**
 * Reglas de marca que el ticket cumplió.
 *
 * El beneficio alcanza SOLO a los renglones de esa marca: llevar 12 Coca-Cola
 * habilita mayorista para las Coca-Cola y nada más — el resto del ticket sigue
 * a su precio de siempre. Por eso el resultado se indexa por marca y no por
 * modalidad: si fuera por modalidad, cualquier renglón del ticket entraría.
 *
 * Devuelve `marcaId → Map(modalidadId → regla)`. Es un Map adentro de otro
 * porque una misma marca puede tener varias reglas que abren modalidades
 * distintas ("12 → Mayorista", "50 → Distribuidor"), y el renglón se queda con
 * la mejor lista de cualquiera de las que haya abierto.
 *
 * La regla viaja entera para poder explicarle al cajero POR QUÉ cambió el precio.
 */
export function reglasDeMarcaCumplidas(reglas, agregados) {
  const porMarca = new Map();
  for (const r of reglas || []) {
    const min = Number(r.unidadesMinimas) || 0;
    if (!(min > 0)) continue;
    const llevadas = agregados.porMarca.get(r.marcaId) ?? 0;
    if (llevadas + 1e-9 < min) continue;
    let deLaMarca = porMarca.get(r.marcaId);
    if (!deLaMarca) { deLaMarca = new Map(); porMarca.set(r.marcaId, deLaMarca); }
    if (!deLaMarca.has(r.modalidadId)) deLaMarca.set(r.modalidadId, { ...r, llevadas });
  }
  return porMarca;
}

/** El precio de MOSTRADOR de un artículo: el de la lista base o, sin ella, el último. */
function pisoDe(precios, porLista) {
  if (!precios?.length) return null;
  return precios.find((p) => porLista.get(p.listaId)?.esBase) ?? precios[precios.length - 1];
}

/**
 * El total del ticket a precio de MOSTRADOR, con IVA. Contra esto se mide el
 * monto: es lo que suma el servidor (`resolverRenglones`) y no cambia al
 * aplicar el mayorista, así que no hay ciclo.
 */
export function totalPiso(renglones, precios, porLista) {
  let t = 0;
  for (const r of renglones) {
    const piso = pisoDe(precios?.get(r.key), porLista);
    if (!piso) continue;
    t += (Number(r.cantidad) || 0) * (Number(piso.precio) || 0) * (1 + (Number(r.iva) || 0) / 100);
  }
  return Math.round(t * 100) / 100;
}

/**
 * Contexto de resolución: todo lo que no cambia renglón a renglón. Se arma una
 * vez por recálculo y se pasa a `calificacion`, que así queda O(listas del
 * producto) y sin cerrar sobre nada.
 *
 * `precios` (key → formato de venta) hace falta para el monto; `aplicado` es la
 * decisión del cajero de aceptar el aviso.
 */
export function contextoResolucion({ catalogo, cliente, renglones, aplicado = false, precios = null }) {
  const listas = catalogo?.listas ?? [];
  const porLista = new Map(listas.map((l) => [l.listaId, l]));
  const agregados = agregadosTicket(renglones);
  const may = catalogo?.mayorista ?? null;
  const monto = catalogo?.montoMayorista ?? null;
  const umbral = Number(monto?.monto) || 0;
  const total = precios ? totalPiso(renglones, precios, porLista) : 0;
  return {
    agregados,
    reglasMarca: catalogo?.reglasMarca ?? [],
    /** Por MARCA: alcanza solo a los renglones de esa marca. */
    porMarca: reglasDeMarcaCumplidas(catalogo?.reglasMarca, agregados),
    porLista,
    delCliente: new Set(cliente?.listas ?? []),
    base: listas.find((l) => l.esBase) ?? null,
    /** La modalidad mayorista: la que abre el bulto del producto y la que se paga con sus medios. */
    modalidadMayorista: may?.modalidadId ?? monto?.modalidadId ?? null,
    porBulto: !!may && may.porBulto !== false,
    /** Por MONTO: la modalidad que abre, si el ticket llegó. Alcanza a TODO el ticket. */
    montoCumplido: monto?.modalidadId && umbral > 0 && total + 1e-9 >= umbral ? monto.modalidadId : null,
    totalPiso: total,
    aplicado: !!aplicado,
  };
}

/**
 * ¿A qué lista CALIFICA el renglón, y por qué? Solo la calificación: no aplica
 * nada. Devuelve `{ lista, precio, origen, detalle }` o null (solo mostrador).
 *
 * `precios` es el formato de venta del artículo tal como vino del catálogo:
 * `[{listaId, precio, unidadesMinimas, unidades}]`, ya ordenado por
 * preferencia, así que la PRIMERA que abra alguna puerta es la que gana.
 */
export function calificacion(renglon, precios, ctx) {
  if (!precios?.length) return null;
  const piso = pisoDe(precios, ctx.porLista);
  const llevadas = ctx.agregados.porProducto.get(renglon.productoId) ?? 0;
  // Las reglas de marca que cumplió ESTE renglón. Un renglón de otra marca ve
  // un Map vacío aunque el ticket tenga 20 Coca-Cola: el beneficio no se
  // derrama al resto del ticket.
  const misReglas = ctx.porMarca.get(renglon.marcaId);
  // El bulto del producto abre solo la PRIMERA lista mayorista del artículo.
  const bultoProd = ctx.porBulto && !renglon.presentacionId && !renglon.fraccionable
    ? Number(renglon.unidadesPorBulto) || 0 : 0;
  let vioMayorista = false;

  for (const p of precios) {
    const lista = ctx.porLista.get(p.listaId);
    if (!lista || p === piso) continue;
    const esMayorista = lista.modalidadId === ctx.modalidadMayorista;
    const primeraMayorista = esMayorista && !vioMayorista;
    if (esMayorista) vioMayorista = true;
    // Más cara que el mostrador no es un beneficio: no se ofrece.
    if (Number(p.precio) > Number(piso.precio) + 1e-6) continue;
    const con = (origen, detalle) => ({ lista, precio: p.precio, origen, detalle });

    // 1 — La lista del cliente.
    if (ctx.delCliente.has(p.listaId)) return con('cliente', 'lista del cliente');

    // 2 — Mínimo de unidades de este producto.
    const min = Number(p.unidadesMinimas) || 0;
    if (min > 0 && llevadas + 1e-9 >= min) return con('auto', `${llevadas} u. ≥ ${min}`);

    // 3 — Regla de marca. Solo si la regla es de LA MARCA DE ESTE RENGLÓN.
    const regla = misReglas?.get(lista.modalidadId);
    if (regla) return con('marca', `${regla.marca}: ${regla.llevadas} u. ≥ ${regla.unidadesMinimas}`);

    // 4 — Bulto cerrado: el de la lista ("vende de a N") o el del producto.
    const bulto = (Number(p.unidades) || 1) > 1 ? Number(p.unidades) : (primeraMayorista ? bultoProd : 0);
    if (bulto > 1 && llevadas + 1e-9 >= bulto) return con('bulto', `bulto cerrado de ${bulto}`);

    // 5 — Monto del ticket: alcanza a todos los renglones.
    if (ctx.montoCumplido != null && lista.modalidadId === ctx.montoCumplido) return con('monto', 'monto de compra');
  }
  return null;
}

/**
 * Lista que le corresponde a un renglón, con el motivo. Sin aceptar el aviso,
 * siempre el mostrador; aceptado, la que califique.
 */
export function resolverRenglon(renglon, precios, ctx) {
  if (!precios?.length) return null;
  if (ctx.aplicado) {
    const c = calificacion(renglon, precios, ctx);
    if (c) return c;
  }
  // Precio de mostrador. Si el producto ni siquiera tiene el piso cargado, se
  // cae a la última que tenga para que igual sea vendible.
  const piso = pisoDe(precios, ctx.porLista);
  const lista = ctx.porLista.get(piso.listaId);
  return lista ? { lista, precio: piso.precio, origen: 'base' } : null;
}

/**
 * EL AVISO: qué renglones calificarían para otra lista y cuánto ahorra el
 * cliente. Null si ya se aceptó o si no hay nada que ofrecer. Los renglones
 * fijados a mano no se ofrecen: la decisión de una persona manda.
 */
export function sugerenciaMayorista(renglones, preciosDe, ctx) {
  if (ctx.aplicado) return null;
  const items = [];
  for (const r of renglones) {
    if (r.listaManual) continue;
    const c = calificacion(r, preciosDe(r.key), ctx);
    if (!c || c.lista.listaId === r.listaId) continue;
    const ahorro = ((Number(r.precioLista) || 0) - (Number(c.precio) || 0))
      * (Number(r.cantidad) || 0) * (1 + (Number(r.iva) || 0) / 100);
    if (!(ahorro > 0.005)) continue;
    items.push({
      uid: r.uid, nombre: r.nombre, detalle: r.detalle, cantidad: r.cantidad,
      lista: c.lista.etiqueta || c.lista.nombre, modalidad: c.lista.modalidad || '',
      origen: c.origen, motivo: c.detalle, ahorro: Math.round(ahorro * 100) / 100,
    });
  }
  if (!items.length) return null;
  return {
    renglones: items,
    ahorro: Math.round(items.reduce((a, i) => a + i.ahorro, 0) * 100) / 100,
    modalidad: [...new Set(items.map((i) => i.modalidad).filter(Boolean))].join(' / ') || 'otra lista',
  };
}

/**
 * EL EMPUJÓN POR UNIDADES: bultos y marcas a los que les falta poco (pasada la
 * mitad, como el del monto). "Faltan 3 para el bulto de 12". Solo lo que
 * todavía no califica, los más cercanos primero.
 */
export function faltantesMayorista(renglones, preciosDe, ctx, max = 3) {
  const out = [];
  const vistos = new Set();
  for (const r of renglones) {
    if (vistos.has(r.productoId)) continue;
    vistos.add(r.productoId);
    const precios = preciosDe(r.key) ?? [];
    if (calificacion(r, precios, ctx)) continue;
    const may = precios.find((p) => ctx.porLista.get(p.listaId)?.modalidadId === ctx.modalidadMayorista);
    if (!may) continue;
    const bulto = (Number(may.unidades) || 1) > 1 ? Number(may.unidades)
      : (ctx.porBulto && !r.presentacionId && !r.fraccionable ? Number(r.unidadesPorBulto) || 0 : 0);
    const llevadas = ctx.agregados.porProducto.get(r.productoId) ?? 0;
    if (bulto > 1 && llevadas + 1e-9 >= bulto / 2 && llevadas < bulto) {
      out.push({ texto: `${r.nombre}: faltan ${bulto - llevadas} para el bulto de ${bulto}`, falta: (bulto - llevadas) / bulto });
    }
  }
  for (const regla of ctx.reglasMarca) {
    const llevadas = ctx.agregados.porMarca.get(regla.marcaId) ?? 0;
    const min = Number(regla.unidadesMinimas) || 0;
    if (!(min > 0) || llevadas + 1e-9 < min / 2 || llevadas >= min) continue;
    out.push({ texto: `${regla.marca}: faltan ${min - llevadas} unidades de la marca`, falta: (min - llevadas) / min });
  }
  return out.sort((a, b) => a.falta - b.falta).slice(0, max).map((x) => x.texto);
}

/**
 * El total con IVA de un renglón, sumado COMO SUMA EL TICKET: neto redondeado +
 * IVA redondeado (los dos campos de `calcularRenglon` en pos.js), igual que
 * `calcularTotales` del servidor. Redondear neto+IVA juntos daba centavos de
 * más y un ticket todo mayorista no cerraba.
 */
function totalRenglon(r) {
  const r2 = (n) => Math.round(n * 100) / 100;
  const sinOferta = (Number(r.cantidad) || 0) * (Number(r.precioUnitario) || 0) * (1 - (Number(r.descuento) || 0) / 100);
  // La oferta, redondeada como la guarda el servidor (es con lo que valida al cobrar).
  const neto = sinOferta - r2(Math.min(Math.max(0, Number(r.ofertaDescuento) || 0), sinOferta));
  return r2(neto) + r2((neto * (Number(r.iva) || 0)) / 100);
}

/**
 * CON QUÉ SE PUEDE PAGAR (1/10/2026): si el ticket tiene renglones a precio
 * mayorista y la configuración fija sus medios ("efectivo y transferencia"),
 * `monto` es la PARTE MAYORISTA del ticket (con IVA): lo pagado con esos medios
 * tiene que cubrirla, y el resto —la parte minorista— se paga con cualquier
 * medio, en la misma operación. Null = sin restricción. Mide la MODALIDAD de
 * la lista puesta, no por qué llegó: es la misma regla que valida el servidor
 * (`validarMediosMayorista`).
 */
export function restriccionMayorista(renglones, catalogo) {
  const may = catalogo?.mayorista;
  if (!may?.modalidadId || !may.mediosPago?.length) return null;
  const modalidadDe = new Map((catalogo.listas ?? []).map((l) => [l.listaId, l.modalidadId]));
  const suyos = renglones.filter((r) => modalidadDe.get(r.listaId) === may.modalidadId);
  if (!suyos.length) return null;
  const monto = Math.round(suyos.reduce((a, r) => a + totalRenglon(r), 0) * 100) / 100;
  return { medios: may.mediosPago, articulos: suyos.length, monto, modalidad: may.modalidad || 'mayorista' };
}

/** Índice `key → [{listaId, precio, unidadesMinimas}]`, ya ordenado por preferencia. */
export function indicePrecios(items) {
  const m = new Map();
  for (const i of items) m.set(i.key, i.precios || []);
  return m;
}
