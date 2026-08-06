/**
 * MOTOR DEL FORMATO DE VENTA (puro, sin React)
 * ============================================================================
 * Decide con qué lista se cotiza CADA renglón del ticket.
 *
 * El precio es del PRODUCTO, no de la lista: cada producto trae en el catálogo
 * las listas en las que se vende, con su precio y su mínimo de unidades propio.
 * Lo que la lista aporta es identidad y `orden` de preferencia.
 *
 * Hay CUATRO puertas de acceso a una lista, y son un OR — con una alcanza:
 *
 *   1. CLIENTE   la tiene asignada por contrato. No hay nada que cumplir.
 *   2. PRODUCTO  el ticket llegó al mínimo de unidades de ESE producto.
 *   3. MARCA     el ticket llegó al mínimo de unidades de una MARCA. Alcanza
 *                solo a los renglones DE ESA MARCA; el resto no se toca.
 *   4. MONTO     el ticket pasó el umbral configurado. Alcanza a todo el ticket,
 *                se SUGIERE (no se aplica sola) y puede exigir un medio de pago.
 *
 * Entre todas las que se habilitan gana la de `orden` menor. Si no se habilita
 * ninguna, queda el PISO (la lista base): el precio de mostrador.
 *
 * LA REGLA DE ORO: las puertas 1-3 se miden sobre CANTIDADES, que no cambian al
 * aplicar un precio, así que el resultado es estable y se aplican solas. La 4 se
 * mide sobre PESOS: aplicar el beneficio baja el total y podría dejar el ticket
 * por debajo del umbral, revertirse, volver a superarlo… un ciclo infinito. Por
 * eso el monto nunca entra en el automático.
 *
 * Todo se resuelve en memoria con lo que ya trajo el catálogo: cambiar de lista
 * no cuesta una sola llamada a la red.
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

/**
 * Contexto de resolución: todo lo que no cambia renglón a renglón. Se arma una
 * vez por recálculo y se pasa a `resolverRenglon`, que así queda O(listas del
 * producto) y sin cerrar sobre nada.
 */
export function contextoResolucion({ catalogo, cliente, renglones, modalidadesExtra }) {
  const listas = catalogo?.listas ?? [];
  const agregados = agregadosTicket(renglones);

  return {
    agregados,
    /** Por MARCA: alcanza solo a los renglones de esa marca. */
    porMarca: reglasDeMarcaCumplidas(catalogo?.reglasMarca, agregados),
    /**
     * Por MONTO: alcanza a TODO el ticket. La diferencia con la regla de marca
     * no es un descuido — el monto es una condición del ticket entero ("gastá
     * $40.000"), mientras que la de marca habla de una marca puntual.
     */
    porMonto: new Set(modalidadesExtra || []),
    porLista: new Map(listas.map((l) => [l.listaId, l])),
    delCliente: new Set(cliente?.listas ?? []),
    base: listas.find((l) => l.esBase) ?? null,
  };
}

/**
 * Lista que le corresponde a un renglón, con el motivo.
 *
 * `precios` es el formato de venta del artículo tal como vino del catálogo:
 * `[{listaId, precio, unidadesMinimas}]`. Ya llega ordenado por preferencia,
 * así que la PRIMERA que abra alguna puerta es la que gana — no hace falta
 * recorrerlas todas ni ordenar de nuevo.
 */
export function resolverRenglon(renglon, precios, ctx) {
  if (!precios?.length) return null;
  const llevadas = ctx.agregados.porProducto.get(renglon.productoId) ?? 0;
  // Las reglas de marca que cumplió ESTE renglón. Un renglón de otra marca ve
  // un Map vacío aunque el ticket tenga 12 Coca-Cola, que es justamente el
  // punto: el beneficio no se derrama al resto del ticket.
  const misReglas = ctx.porMarca.get(renglon.marcaId);
  let piso = null;

  for (const p of precios) {
    const lista = ctx.porLista.get(p.listaId);
    if (!lista) continue;

    // El piso no compite: es la red de contención si no se abre ninguna puerta.
    if (lista.esBase) { piso = { lista, precio: p.precio, origen: 'base' }; continue; }

    // 1 — Derecho del cliente.
    if (ctx.delCliente.has(p.listaId)) return { lista, precio: p.precio, origen: 'cliente' };

    // 2 — Mínimo de unidades de este producto.
    const min = Number(p.unidadesMinimas) || 0;
    if (min > 0 && llevadas + 1e-9 >= min) {
      return { lista, precio: p.precio, origen: 'auto', detalle: `${llevadas} u. ≥ ${min}` };
    }

    // 3 — Regla de marca. Solo si la regla es de LA MARCA DE ESTE RENGLÓN.
    const regla = misReglas?.get(lista.modalidadId);
    if (regla) {
      return {
        lista,
        precio: p.precio,
        origen: 'marca',
        detalle: `${regla.marca}: ${regla.llevadas} u. ≥ ${regla.unidadesMinimas}`,
      };
    }

    // 4 — Monto del ticket: esta sí alcanza a todos los renglones.
    if (ctx.porMonto.has(lista.modalidadId)) {
      return { lista, precio: p.precio, origen: 'monto' };
    }
  }

  // Nada se abrió: precio de mostrador. Si el producto ni siquiera tiene el
  // piso cargado, se cae a la última que tenga para que igual sea vendible.
  if (piso) return piso;
  const ult = precios[precios.length - 1];
  const lista = ctx.porLista.get(ult.listaId);
  return lista ? { lista, precio: ult.precio, origen: 'base' } : null;
}

/**
 * ¿El ticket habilita el precio por monto, y cambiaría algo aplicarlo?
 *
 * Devuelve la sugerencia para mostrarla al cajero, o null. No se aplica sola
 * (ver la regla de oro arriba) y solo alcanza a los productos que tengan una
 * lista cargada en esa modalidad — el resto sigue con su precio, que es
 * exactamente lo pedido: "si no tiene ninguna lista mayorista, no se le asigna
 * nada".
 */
export function sugerenciaPorMonto(renglones, total, catalogo, preciosDe, yaAplicada) {
  const cfg = catalogo?.montoMayorista;
  if (!cfg || yaAplicada) return null;
  if (total + 1e-9 < (Number(cfg.monto) || 0)) return null;

  const dela = new Set(
    (catalogo.listas ?? []).filter((l) => l.modalidadId === cfg.modalidadId).map((l) => l.listaId),
  );
  // Ofrecer algo que no cambia ningún precio solo ensucia la pantalla.
  const alcanzados = renglones.filter(
    (r) => !dela.has(r.listaId) && (preciosDe(r.key) ?? []).some((p) => dela.has(p.listaId)),
  );
  if (!alcanzados.length) return null;

  return {
    modalidadId: cfg.modalidadId,
    modalidad: cfg.modalidad,
    monto: cfg.monto,
    mediosPago: cfg.mediosPago ?? [],
    renglones: alcanzados.length,
  };
}

/** Índice `key → [{listaId, precio, unidadesMinimas}]`, ya ordenado por preferencia. */
export function indicePrecios(items) {
  const m = new Map();
  for (const i of items) m.set(i.key, i.precios || []);
  return m;
}

/**
 * Listas que el cliente tiene asignadas, ordenadas por preferencia. Sirve para
 * mostrarlas; la resolución las consulta por `Set` en el contexto.
 */
export function listasDelCliente(cliente, listasCatalogo) {
  const ids = new Set(cliente?.listas ?? []);
  return (listasCatalogo ?? [])
    .filter((l) => ids.has(l.listaId))
    .sort((a, b) => a.orden - b.orden);
}
