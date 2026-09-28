/**
 * EL MAPA DE MÁRGENES — todos los markups del catálogo, de un pantallazo.
 * ============================================================================
 * El problema, dicho por el dueño: *"para ver qué markup tiene cada producto
 * tengo que entrar producto por producto y no termino más, siendo que muchos
 * comparten el mismo"*.
 *
 * ESTO NO LE PIDE NADA AL SERVIDOR, y es la decisión central. El snapshot del
 * inventario ya trae, para cada producto y cada paquete fraccionado, su formato
 * de venta en CADA lista con el markup y el precio ya resueltos — hasta ahora
 * eso se usaba solo para pintar la ficha de a un producto por vez. Acá se
 * aplana esa misma información que ya está en memoria y se agrupa. Por eso la
 * pantalla abre instantánea aunque el catálogo tenga miles de productos: es
 * cuenta en memoria, no una consulta más.
 *
 * TRES MIRADAS SOBRE EL MISMO DATO, y por eso viven juntas:
 *
 *   · `filasDeMargenes` — una fila por cosa que se vende (el producto suelto y
 *     cada uno de sus paquetes) × cada lista donde tiene precio cargado. Es el
 *     grano fino del que salen las otras dos.
 *   · `agruparMargenes` — las mismas filas juntadas por lista y valor: "en
 *     Minorista, 1.240 artículos al 35%". Es la vista que hace corto el
 *     trabajo, justamente porque muchos comparten el mismo número — y de paso
 *     las excepciones saltan solas (los tres al 62% que nadie recuerda).
 *   · `grillaDeMargenes` — producto en la fila, lista en la columna. Es el
 *     "ver todos" literal, para comparar una lista contra otra.
 *
 * NO SE RECALCULA NINGÚN PRECIO NI NINGÚN COSTO. Los dos salen tal cual del
 * snapshot, que los derivó con el MISMO motor que la caja y la ficha. Si acá se
 * volvieran a calcular, esta pantalla podría mostrar un número distinto del que
 * cobra el mostrador, y el que mira no tendría forma de saber cuál vale.
 */

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Cómo se llama la forma que se vende: el producto suelto, o uno de sus paquetes. */
export function etiquetaForma(prod, pres) {
  if (pres) {
    const kg = Number(pres.tamKg) || 0;
    return kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg} kg`;
  }
  return prod?.tipo === 'granel' ? 'Granel (kg)' : 'Unidad';
}

/**
 * Todas las filas de formato de venta del catálogo, aplanadas.
 *
 * `filaId` es el id de `producto_listas`, que es LA LLAVE con la que trabaja la
 * actualización masiva de márgenes: gracias a eso, "cambiar este grupo" puede
 * apuntar exactamente a estas filas y a ninguna otra — ni a los paquetes del
 * mismo producto, que tienen su markup propio.
 */
export function filasDeMargenes(productos = []) {
  const filas = [];
  const agregar = (p, pres, listas, costo) => {
    for (const l of listas || []) {
      if (!l || !l.id) continue;
      filas.push({
        filaId: l.id,
        productoId: p.id,
        producto: p.nombre ?? '',
        marca: p.marca ?? '',
        categoria: p.categoria ?? '',
        tipo: p.tipo,
        estado: p.estado,
        presentacionId: pres ? pres.id : null,
        forma: etiquetaForma(p, pres),
        listaId: l.listaId,
        lista: l.etiqueta || l.nombre || '',
        modalidad: l.modalidad || '',
        orden: Number(l.orden) || 0,
        /* Una fila trabaja por PORCENTAJE sobre el costo o con un precio
         * DEFINIDO a mano. Son dos mundos: al segundo no se le puede aplicar
         * una regla de márgenes, y por eso viaja distinguido y no como markup 0. */
        modoPrecio: l.modoPrecio === 'precio' ? 'precio' : 'markup',
        markup: r2(l.markup),
        precioFijo: r2(l.precioFijo),
        unidadesMinimas: Number(l.unidadesMinimas) || 0,
        costo: r2(costo),
        precioFinal: r2(l.precioFinalUnitario),
      });
    }
  };
  for (const p of productos) {
    if (!p) continue;
    agregar(p, null, p.listas, p.costoNeto);
    for (const pr of p.presentaciones || []) agregar(p, pr, pr.listas, pr.costoNeto);
  }
  return filas;
}

/**
 * Las filas juntadas por lista y por valor: un grupo es "todo lo que en esta
 * lista va al 35%".
 *
 * EL PRECIO DEFINIDO CAE EN SU PROPIO GRUPO, uno por lista. No es un markup del
 * 0%: es una fila donde el porcentaje no gobierna nada, y mezclarla con los
 * markups haría que una regla masiva la pisara sin que nadie lo haya pedido.
 */
export function agruparMargenes(filas = []) {
  const mapa = new Map();
  for (const f of filas) {
    const valor = f.modoPrecio === 'precio' ? null : f.markup;
    const clave = `${f.listaId}|${f.modoPrecio}|${valor ?? ''}`;
    let g = mapa.get(clave);
    if (!g) {
      g = {
        clave,
        listaId: f.listaId,
        lista: f.lista,
        modalidad: f.modalidad,
        orden: f.orden,
        modoPrecio: f.modoPrecio,
        markup: valor,
        /** Cuántas filas (el suelto y cada paquete cuentan por separado). */
        cantidad: 0,
        /** Los ids de `producto_listas`: el alcance exacto de la masiva. */
        filaIds: [],
        /** Cuántos PRODUCTOS distintos, que no es lo mismo que cuántas filas. */
        productos: new Set(),
      };
      mapa.set(clave, g);
    }
    g.cantidad += 1;
    g.filaIds.push(f.filaId);
    g.productos.add(f.productoId);
  }
  /*
   * El orden es el de la pregunta que se viene a hacer: primero las listas en
   * su orden de preferencia (el mismo con el que el POS resuelve el precio),
   * y adentro de cada una el markup de mayor a menor. El precio definido va
   * último: no es un porcentaje, así que no compite en esa escala.
   */
  return [...mapa.values()].sort((a, b) => (
    a.orden - b.orden
    || String(a.lista).localeCompare(String(b.lista))
    || (a.modoPrecio === b.modoPrecio ? 0 : (a.modoPrecio === 'precio' ? 1 : -1))
    || (b.markup ?? 0) - (a.markup ?? 0)
  ));
}

/**
 * Los grupos ordenados por lista, con el total de cada una y el grupo más
 * grande — que es contra el que se dibuja la barra de la pantalla.
 */
export function resumenPorLista(grupos = []) {
  const mapa = new Map();
  for (const g of grupos) {
    let l = mapa.get(g.listaId);
    if (!l) {
      l = { listaId: g.listaId, lista: g.lista, modalidad: g.modalidad, orden: g.orden, total: 0, mayor: 0, grupos: [] };
      mapa.set(g.listaId, l);
    }
    l.total += g.cantidad;
    l.mayor = Math.max(l.mayor, g.cantidad);
    l.grupos.push(g);
  }
  return [...mapa.values()].sort((a, b) => a.orden - b.orden || String(a.lista).localeCompare(String(b.lista)));
}

/** Las listas que aparecen en las filas, en su orden de preferencia: las columnas. */
export function columnasDeMargenes(filas = []) {
  const mapa = new Map();
  for (const f of filas) {
    if (!mapa.has(f.listaId)) {
      mapa.set(f.listaId, { listaId: f.listaId, lista: f.lista, modalidad: f.modalidad, orden: f.orden });
    }
  }
  return [...mapa.values()].sort((a, b) => a.orden - b.orden || String(a.lista).localeCompare(String(b.lista)));
}

/**
 * La grilla: una fila por cosa que se vende, una celda por lista.
 *
 * El paquete fraccionado es fila PROPIA y no un renglón adentro del producto:
 * tiene su costo y su markup, y aplastarlo contra el del kilo sería mostrar un
 * margen que nadie cargó.
 */
export function grillaDeMargenes(filas = []) {
  const mapa = new Map();
  for (const f of filas) {
    const clave = `${f.productoId}:${f.presentacionId ?? ''}`;
    let fila = mapa.get(clave);
    if (!fila) {
      fila = {
        clave,
        productoId: f.productoId,
        producto: f.producto,
        marca: f.marca,
        categoria: f.categoria,
        presentacionId: f.presentacionId,
        forma: f.forma,
        costo: f.costo,
        celdas: new Map(),
      };
      mapa.set(clave, fila);
    }
    fila.celdas.set(f.listaId, f);
  }
  return [...mapa.values()].sort((a, b) => (
    String(a.producto).localeCompare(String(b.producto))
    // El suelto antes que sus paquetes: es el orden en que se lee la ficha.
    || (a.presentacionId ?? 0) - (b.presentacionId ?? 0)
  ));
}

/* ======================================================================= *
 * REDONDEAR MARKUPS (28/9/2026, pedido del dueño): "me quedan muchísimos
 * markups … uno de 134,8 lo ideal es que vaya a 135". Sin decimales y de 5
 * en 5: cada markup va al múltiplo de `paso` MÁS CERCANO — nunca se mueve más
 * de medio paso (2,5 puntos con paso 5), y el empate va para arriba
 * (132,5 → 135), igual que se redondea a mano.
 * ======================================================================= */

/** El markup redondeado al múltiplo de `paso` más cercano. */
export function redondearMarkup(valor, paso = 5) {
  const p = Number(paso) > 0 ? Number(paso) : 5;
  const v = Number(valor) || 0;
  // El +1e-9 absorbe el error de coma flotante (132,5 / 5 = 26,4999…).
  return r2(Math.round(v / p + 1e-9) * p);
}

/**
 * Qué cambia al redondear estas filas. Solo las de MARKUP: el precio
 * definido lo fijó una persona y un redondeo de porcentajes no lo pisa.
 * `listaId` acota a una lista; sin él, todas.
 */
export function planRedondeo(filas = [], { paso = 5, listaId = null } = {}) {
  const alcance = filas.filter((f) => listaId == null || f.listaId === listaId);
  const conMarkup = alcance.filter((f) => f.modoPrecio === 'markup');
  const cambios = [];
  const transiciones = new Map();
  for (const f of conMarkup) {
    const nuevo = redondearMarkup(f.markup, paso);
    if (Math.abs(nuevo - f.markup) < 0.005) continue;
    cambios.push({ id: f.filaId, antes: f.markup, despues: nuevo, productoId: f.productoId, listaId: f.listaId });
    const k = `${f.listaId}|${f.markup}`;
    const t = transiciones.get(k) || { lista: f.lista, orden: f.orden, antes: f.markup, despues: nuevo, cantidad: 0 };
    t.cantidad += 1;
    transiciones.set(k, t);
  }
  const distintos = (vals) => new Set(vals).size;
  const porLista = (fn) => {
    // "Markups distintos" se cuenta por lista: el 35% de Minorista y el de
    // Mayorista son dos valores que el dueño tiene que recordar.
    const m = new Map();
    for (const f of conMarkup) {
      if (!m.has(f.listaId)) m.set(f.listaId, []);
      m.get(f.listaId).push(fn(f));
    }
    return [...m.values()].reduce((a, vals) => a + distintos(vals), 0);
  };
  return {
    cambios,
    transiciones: [...transiciones.values()].sort((a, b) => a.orden - b.orden
      || String(a.lista).localeCompare(String(b.lista)) || b.antes - a.antes),
    filasConMarkup: conMarkup.length,
    precioDefinido: alcance.length - conMarkup.length,
    productos: new Set(cambios.map((c) => c.productoId)).size,
    valoresAntes: porLista((f) => f.markup),
    valoresDespues: porLista((f) => redondearMarkup(f.markup, paso)),
  };
}

/* ======================================================================= *
 * PASAR ARTÍCULOS DE UNA LISTA A OTRA (28/9/2026, pedido del dueño).
 * Reglas fijadas con él: se MUEVEN (salen del origen) y, si el artículo ya
 * estaba en el destino, MANDA EL DESTINO — su fila no se toca y la del origen
 * se borra. El servidor aplica exactamente esto; acá se muestra antes.
 * ======================================================================= */

const claveArticulo = (f) => `${f.productoId}:${f.presentacionId ?? ''}`;

/**
 * La fila que da el precio de góndola de un artículo — espejo del servidor
 * (`ctxPrecio`): la de la lista base si la tiene; si no, la de PEOR orden
 * entre las suyas, que es lo que se cobra sin habilitar nada.
 */
export function filaDePiso(filasArticulo, baseId) {
  if (!filasArticulo?.length) return null;
  return filasArticulo.find((f) => f.listaId === baseId)
    ?? [...filasArticulo].sort((a, b) => (Number(b.orden) || 0) - (Number(a.orden) || 0))[0];
}

/**
 * Qué pasa si se mueven `seleccion` (ids de fila) de `origenId` a `destino`.
 * `filasTodas` tiene que ser el catálogo ENTERO (no lo filtrado): para saber si
 * el artículo ya está en el destino hay que mirar todas sus filas.
 */
export function planMoverLista(filasTodas = [], { origenId, destino, seleccion, baseId }) {
  const porArticulo = new Map();
  for (const f of filasTodas) {
    const k = claveArticulo(f);
    if (!porArticulo.has(k)) porArticulo.set(k, []);
    porArticulo.get(k).push(f);
  }
  const mueven = [];
  const yaEstaban = [];
  const gondola = [];
  for (const f of filasTodas) {
    if (f.listaId !== origenId || !seleccion.has(f.filaId)) continue;
    const suyas = porArticulo.get(claveArticulo(f)) || [];
    const enDestino = suyas.find((x) => x.listaId === destino.id) || null;
    if (enDestino) yaEstaban.push({ ...f, destinoFila: enDestino }); else mueven.push(f);

    const antes = filaDePiso(suyas, baseId);
    const despuesFilas = suyas.filter((x) => x.filaId !== f.filaId);
    if (!enDestino) despuesFilas.push({ ...f, listaId: destino.id, orden: destino.orden, lista: destino.etiqueta });
    const despues = filaDePiso(despuesFilas, baseId);
    const pa = antes ? Number(antes.precioFinal) || 0 : null;
    const pd = despues ? Number(despues.precioFinal) || 0 : null;
    if (pa !== pd || antes?.listaId !== despues?.listaId) {
      if (pa == null || pd == null || Math.abs(pa - pd) >= 0.005) {
        gondola.push({
          productoId: f.productoId, producto: f.producto, forma: f.forma,
          precioAntes: pa, precioDespues: pd, listaAntes: antes?.lista ?? '', listaDespues: despues?.lista ?? '',
        });
      }
    }
  }
  return { mueven, yaEstaban, gondola, destinoEsBase: destino.id === baseId };
}

