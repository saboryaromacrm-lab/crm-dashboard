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
import { contextoResolucion, resolverRenglon } from './listas.js';
import { resolverOfertas } from './ofertas.js';

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
 * USO EXCLUSIVO DE CAFETERÍA (0089): el motivo por el que este ítem no puede ir
 * al ticket, o null si puede. El ítem SE MUESTRA en los buscadores con su
 * marca — esconderlo haría que un código escaneado "no exista", que parece un
 * error — y se bloquea al agregarlo, siempre con el mismo texto. La API lo
 * revalida en el confirm (el catálogo se cachea al abrir la caja).
 */
export function motivoBloqueo(item) {
  if (item?.soloCafeteria) {
    return `${item.nombre} es de uso exclusivo de la Cafetería: no se vende en el mostrador. Sale por el envío de Almacén › Cafetería.`;
  }
  return null;
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

  // Código de un FORMATO de venta (el EAN de la caja): devuelve el producto
  // marcado con las unidades del formato — escanear la caja carga las N de
  // una, y el motor de listas resuelve solo el precio mayorista.
  for (const i of catalogo) {
    const f = (i.formatosVenta ?? []).find((x) => x.codigoBarras && x.codigoBarras === q);
    if (f) return [{ ...i, _escaneoUnidades: f.unidades, _escaneoListaId: f.listaId }];
  }

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

/**
 * Neto, IVA y total de un renglón. El descuento porcentual va sobre el bruto;
 * la oferta resta un IMPORTE después (con tope en el neto: una promo jamás
 * puede dejar un renglón negativo). El IVA se calcula sobre lo que de verdad
 * se cobra — mismo criterio que el backend.
 */
export function calcularRenglon(r) {
  const bruto = (Number(r.cantidad) || 0) * (Number(r.precioUnitario) || 0);
  const sinOferta = bruto * (1 - (Number(r.descuento) || 0) / 100);
  const oferta = Math.min(Math.max(0, Number(r.ofertaDescuento) || 0), sinOferta);
  const neto = sinOferta - oferta;
  const iva = (neto * (Number(r.iva) || 0)) / 100;
  return { bruto: r2(bruto), oferta: r2(oferta), neto: r2(neto), iva: r2(iva), total: r2(neto + iva) };
}

/**
 * Totales del ticket. Los extras (envío, packaging) entran como un renglón más
 * con su propia alícuota: es lo que hace el backend, y un solo criterio evita
 * que la pantalla y el comprobante muestren números distintos.
 */
export function totalesTicket(renglones, extras = []) {
  let neto = 0; let iva = 0; let bruto = 0; let unidades = 0; let ahorro = 0;
  for (const r of renglones) {
    const c = calcularRenglon(r);
    bruto += c.bruto; neto += c.neto; iva += c.iva; ahorro += c.oferta;
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
    /** Lo que las OFERTAS le ahorraron al cliente (ya incluido en `descuento`). */
    ahorro: r2(ahorro),
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

/**
 * `ctx` es lo que hace falta para cotizar: el catálogo (listas, reglas de marca
 * y la regla de monto), el cliente y el índice de precios por artículo. Vive en
 * el estado (y no se lee de afuera) para que el reducer siga siendo **puro** y
 * pueda recalcular las listas de forma síncrona, sin efectos.
 *
 * `montoAplicado` es lo único de esto que es del TICKET y no del puesto: la
 * modalidad que el vendedor desbloqueó al aceptar la sugerencia por monto.
 */
export const ticketInicial = {
  renglones: [], extras: [], uid: 1, montoAplicado: null,
  /** Oferta de ticket ("10% desde $30.000") que el cajero aceptó. Id o null. */
  ofertaTicket: null,
  /**
   * Descuentos con nombre aplicados, por ID. Uno por lista de precios: es la
   * regla del negocio y la que hace que dos descuentos no compitan por los
   * mismos renglones. Solo ids — el porcentaje lo dice el catálogo y lo
   * REVALIDA el servidor.
   */
  descuentos: [],
  ctx: {
    catalogo: null, cliente: null, precios: new Map(), sucursalId: null, ahora: null,
    /** Catálogo de descuentos con nombre disponibles (lo trae el POS). */
    descuentos: [],
  },
};

/**
 * Reasigna la lista de cada renglón que NO fue elegido a mano.
 *
 * Se corre después de toda acción que cambie cantidades, porque las puertas de
 * acceso se miden sobre cantidades: agregar la 12ª unidad de una marca habilita
 * el precio mayorista de TODOS sus renglones, y sacarla lo revierte.
 *
 * El contexto se arma UNA vez por recálculo (los agregados y las reglas de
 * marca son del ticket entero, no de cada renglón) y después cada renglón sale
 * en O(sus listas).
 *
 * Si nada cambia devuelve el MISMO estado (misma referencia): sin eso, cada
 * tecla dispararía un re-render y un autoguardado inútiles.
 */
function recalcular(estado) {
  const { catalogo, cliente, precios } = estado.ctx;
  if (!catalogo?.listas?.length) return estado;

  const ctx = contextoResolucion({
    catalogo,
    cliente,
    renglones: estado.renglones,
    modalidadesExtra: estado.montoAplicado ? [estado.montoAplicado] : [],
  });
  let cambio = false;

  let renglones = estado.renglones.map((r) => {
    if (r.listaManual) return r;                 // la decisión de una persona manda
    const res = resolverRenglon(r, precios.get(r.key), ctx);
    if (!res) return r;
    // Compara también el precio: con el mismo `listaId` puede haber cambiado el
    // catálogo por detrás (una actualización de costos, otro cliente).
    if (res.lista.listaId === r.listaId && res.precio === r.precioLista) return r;
    cambio = true;
    return {
      ...r,
      listaId: res.lista.listaId,
      lista: res.lista.etiqueta,
      listaOrigen: res.origen,
      listaMotivo: res.detalle ?? '',
      precioLista: res.precio,
      precioUnitario: res.precio,
    };
  });

  /* OFERTAS — segunda pasada, sobre los precios YA resueltos. El orden no es
   * casual: la promo descuenta sobre lo que el renglón efectivamente paga
   * (incluida una lista mayorista, si la oferta lo permite). */
  const promos = resolverOfertas(renglones, catalogo.ofertas ?? [], {
    ahora: estado.ctx.ahora,
    sucursalId: estado.ctx.sucursalId,
    ticketAplicadaId: estado.ofertaTicket,
  });
  renglones = renglones.map((r) => {
    const p = promos.get(r.key) ?? null;
    const igual = p
      ? r.ofertaId === p.ofertaId && r.ofertaDescuento === p.descuento
      : !r.ofertaId && !(r.ofertaDescuento > 0);
    if (igual) return r;
    cambio = true;
    return p
      ? { ...r, ofertaId: p.ofertaId, oferta: p.oferta, ofertaDescuento: p.descuento, ofertaDetalle: p.detalle ?? '' }
      : { ...r, ofertaId: null, oferta: '', ofertaDescuento: 0, ofertaDetalle: '' };
  });

  /*
   * DESCUENTOS CON NOMBRE — tercera pasada, y va última por las mismas dos
   * razones que en el servidor (`resolverDescuentos` en ventas.module.ts):
   * después de resolver la lista, porque el descuento cae sobre los renglones
   * de SU lista; y después de las ofertas, porque no toca un renglón que ya
   * tiene promo.
   *
   * ESTO ES LO QUE HACE QUE EL DESCUENTO SEA ESTADO DEL TICKET Y NO UN AJUSTE.
   * `recalcular` corre en cada cambio, así que agregar un producto de esa lista
   * lo mete solo, cambiar un renglón de lista lo saca, y sacar el último lo deja
   * sin efecto — sin que nadie tenga que acordarse de recalcular.
   *
   * `descuentoBase` guarda lo que el renglón trae por su cuenta (el descuento
   * del cliente o el que puso el vendedor a mano). Se conserva aparte porque
   * "gana el mayor" tiene que poder DESHACERSE: si el nombrado se quita, el
   * renglón vuelve a su descuento propio, no a cero.
   *
   * Y ES `descuentoBase` LO QUE VIAJA A LA API, no el combinado — ver
   * `itemsParaApi`. Mandar el 25% del nombrado como si fuera manual lo haría
   * rebotar contra `descuentoMaxVendedor` antes de que el servidor llegue a
   * aplicarlo.
   */
  const aplicados = (estado.ctx.descuentos ?? [])
    .filter((d) => (estado.descuentos ?? []).includes(d.id));
  const porLista = new Map(aplicados.map((d) => [d.listaId, d]));

  renglones = renglones.map((r) => {
    const base = Number(r.descuentoBase ?? r.descuento) || 0;
    const d = r.ofertaDescuento > 0 ? null : (porLista.get(r.listaId) ?? null);
    const gana = d && Number(d.porcentaje) > base + 1e-9 ? d : null;
    const desc = gana ? Number(gana.porcentaje) : base;
    if (r.descuento === desc && r.descuentoBase === base
      && (r.descuentoId ?? null) === (gana?.id ?? null)) return r;
    cambio = true;
    return {
      ...r,
      descuentoBase: base,
      descuento: desc,
      descuentoId: gana?.id ?? null,
      descuentoNombre: gana?.nombre ?? '',
    };
  });

  return cambio ? { ...estado, renglones } : estado;
}

/**
 * `uid` es la identidad del renglón en la UI (no viaja al backend). Se usa un
 * contador y no la posición del array para que editar una fila no reordene el
 * foco ni pierda el input a medio tipear.
 */
export function ticketReducer(estado, accion) {
  switch (accion.tipo) {
    /** Cambió el catálogo o el cliente: se recotiza todo lo no manual. */
    case 'contexto':
      return recalcular({ ...estado, ctx: accion.ctx });

    case 'agregar': {
      const { item, cantidad = 1, descuentoCliente = 0, listaFija = null } = accion;
      // Repetir un artículo suma cantidad en vez de abrir otro renglón. Si la
      // carga viene de escanear una CAJA, la lista del formato queda FIJADA
      // (manual): el cliente compró la caja, no seis sueltas — y el motor no
      // se la recotiza a mostrador.
      const existente = estado.renglones.find((r) => r.key === item.key);
      if (existente) {
        return recalcular({
          ...estado,
          renglones: estado.renglones.map((r) =>
            r.key === item.key
              ? {
                ...r,
                cantidad: r2(r.cantidad + cantidad),
                ...(listaFija ? {
                  listaId: listaFija.listaId, lista: listaFija.etiqueta, listaOrigen: 'manual',
                  listaManual: true, precioLista: listaFija.precio, precioUnitario: listaFija.precio,
                } : {}),
              }
              : r),
        });
      }
      const renglon = {
        uid: estado.uid,
        key: item.key,
        productoId: item.productoId,
        presentacionId: item.presentacionId,
        nombre: item.nombre,
        detalle: item.detalle,
        // Ids de clasificación: contra esto matchean la regla de marca y el
        // alcance de las ofertas. El nombre viaja aparte, solo para mostrar.
        marca: item.marca,
        marcaId: item.marcaId ?? null,
        categoriaId: item.categoriaId ?? null,
        etiquetas: item.etiquetas ?? [],
        unidad: item.unidad,
        fraccionable: item.fraccionable,
        iva: item.iva,
        stock: item.stock,
        listaId: listaFija?.listaId ?? null,
        lista: listaFija?.etiqueta ?? '',
        listaOrigen: listaFija ? 'manual' : 'base',
        listaManual: !!listaFija,
        precioLista: listaFija?.precio ?? item.precio,
        precioUnitario: listaFija?.precio ?? item.precio,
        // Los dos, y el mismo valor: `descuentoBase` es lo que decidió una
        // persona y `descuento` lo que se cobra. Recién si un nombrado le gana
        // se separan (tercera pasada de `recalcular`).
        descuentoBase: descuentoCliente,
        descuento: descuentoCliente,
        descuentoId: null,
        descuentoNombre: '',
        ofertaId: null,
        oferta: '',
        ofertaDescuento: 0,
        cantidad: r2(cantidad),
      };
      return recalcular({ ...estado, renglones: [...estado.renglones, renglon], uid: estado.uid + 1 });
    }
    case 'cantidad':
      return recalcular({
        ...estado,
        renglones: estado.renglones.map((r) =>
          r.uid === accion.uid ? { ...r, cantidad: Math.max(0, Number(accion.valor) || 0) } : r),
      });
    /**
     * Descuento puesto A MANO por el vendedor. Escribe la BASE, no el que se
     * ve: si el renglón está bajo un descuento con nombre más grande, tipear un
     * 5% no tiene que bajarle el precio al cliente — el nombrado sigue ganando,
     * y el 5% queda anotado para cuando el nombrado se saque.
     *
     * `descuento` se escribe igual, para que el número sea correcto aunque el
     * catálogo todavía no esté cargado y `recalcular` se corte en la primera
     * línea. Con catálogo, la tercera pasada lo recalcula y manda ella.
     */
    case 'descuento': {
      const v = Math.min(100, Math.max(0, Number(accion.valor) || 0));
      return recalcular({
        ...estado,
        renglones: estado.renglones.map((r) =>
          r.uid === accion.uid ? { ...r, descuentoBase: v, descuento: v } : r),
      });
    }
    case 'precio':
      return {
        ...estado,
        renglones: estado.renglones.map((r) =>
          r.uid === accion.uid ? { ...r, precioUnitario: Math.max(0, Number(accion.valor) || 0) } : r),
      };
    /**
     * Elección MANUAL de lista en un renglón. Queda marcado con `listaManual`
     * para que el automático no se la pise en la próxima tecla: la decisión de
     * una persona siempre gana. `manual: false` la devuelve al automático.
     */
    case 'lista':
      return recalcular({
        ...estado,
        renglones: estado.renglones.map((r) => {
          if (r.uid !== accion.uid) return r;
          if (accion.manual === false) return { ...r, listaManual: false };
          return {
            ...r,
            listaId: accion.lista.listaId,
            lista: accion.lista.etiqueta,
            listaOrigen: 'manual',
            listaManual: true,
            precioLista: accion.precio,
            precioUnitario: accion.precio,
          };
        }),
      });

    /**
     * El vendedor aceptó (o retiró) la sugerencia por MONTO. No se toca ningún
     * renglón a mano: se desbloquea la MODALIDAD y el motor hace el resto. Así,
     * un producto sin lista en esa modalidad se queda con su precio de siempre
     * —sin excluirlo de ninguna lista— y quitar la sugerencia revierte todo
     * solo, sin tener que acordarse de qué precio tenía cada uno.
     */
    case 'monto':
      return recalcular({ ...estado, montoAplicado: accion.modalidadId ?? null });

    /**
     * El cajero aceptó (o retiró) una OFERTA DE TICKET. Igual que el monto: no
     * se toca ningún renglón a mano, se anota la decisión y el recálculo
     * reparte — así quitar la oferta revierte todo solo.
     */
    case 'ofertaTicket':
      return recalcular({ ...estado, ofertaTicket: accion.ofertaId ?? null });

    /**
     * Aplicación MASIVA a mano: el vendedor elige una MODALIDAD y cada renglón
     * toma la mejor lista suya dentro de ella. Se elige modalidad y no lista
     * porque las listas son del producto: "Mayorista" puede ser la 1 en un
     * artículo y la 2 en otro, y pedir una lista puntual dejaría afuera al
     * segundo. El que no tenga ninguna de esa modalidad queda como estaba.
     */
    case 'modalidadTodos': {
      const { modalidadId, listasPorId, preciosDe } = accion;
      let tocados = 0;
      const renglones = estado.renglones.map((r) => {
        if (modalidadId == null) return r.listaManual ? { ...r, listaManual: false } : r;
        // Ya vienen ordenados por preferencia: la primera de la modalidad gana.
        const elegido = (preciosDe(r.key) ?? [])
          .find((x) => listasPorId.get(x.listaId)?.modalidadId === modalidadId);
        if (!elegido) return r;
        tocados += 1;
        const lista = listasPorId.get(elegido.listaId);
        return {
          ...r,
          listaId: lista.listaId,
          lista: lista.etiqueta,
          listaOrigen: 'manual',
          listaMotivo: '',
          listaManual: true,
          precioLista: elegido.precio,
          precioUnitario: elegido.precio,
        };
      });
      // Volver al automático tiene que recotizar; fijar a mano, no.
      return modalidadId == null
        ? recalcular({ ...estado, renglones })
        : (tocados ? { ...estado, renglones } : estado);
    }

    case 'quitar':
      return recalcular({ ...estado, renglones: estado.renglones.filter((r) => r.uid !== accion.uid) });
    case 'limpiar':
      return { ...estado, renglones: [], extras: [], montoAplicado: null, ofertaTicket: null, descuentos: [] };

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
    case 'cargar': {
      // El ctx (catálogo y precios) es del PUESTO, no del ticket: sobrevive a
      // cambiar de venta. Y se recotiza, porque las puertas dependen de las
      // cantidades que acaban de cargarse.
      //
      // La sugerencia por monto no se guarda como bandera: se deduce de los
      // renglones que quedaron con ese origen. Una verdad sola, la que ya viaja.
      const conMonto = accion.renglones.find((r) => r.listaOrigen === 'monto');
      const modalidadId = conMonto
        ? estado.ctx.catalogo?.listas?.find((l) => l.listaId === conMonto.listaId)?.modalidadId ?? null
        : null;
      // La oferta de ticket aceptada se deduce igual: del renglón que la lleva.
      const conOfertaTicket = accion.renglones.find((r) => r.ofertaId
        && estado.ctx.catalogo?.ofertas?.find((o) => o.id === r.ofertaId)?.tipo === 'ticket');
      /*
       * Y los descuentos con nombre, por el mismo camino: salen de los
       * renglones que los llevan. Una verdad sola, la que ya viaja.
       *
       * Consecuencia asumida: un descuento que no ganó en NINGÚN renglón —
       * porque todos tenían uno propio más grande— no vuelve marcado al
       * reabrir. Es coherente con la regla: si no bajó ni un peso, no está
       * aplicado a nada. Y en cuanto entre un renglón donde sí gane, la cajera
       * lo aplica de nuevo con un clic.
       */
      const idsDescuento = [...new Set(accion.renglones.map((r) => r.descuentoId).filter(Boolean))];
      return recalcular({
        ...estado,
        renglones: accion.renglones, extras: accion.extras, uid: accion.uid,
        montoAplicado: modalidadId,
        ofertaTicket: conOfertaTicket?.ofertaId ?? null,
        descuentos: idsDescuento,
      });
    }
    /**
     * Cambió el cliente: se re-aplica su descuento a los renglones que no se
     * tocaron.
     *
     * "No se tocaron" se mide contra la BASE y no contra el descuento visible,
     * y ahí había una trampa: un renglón donde ganó un nombrado del 25% muestra
     * 25 aunque su base siga siendo el 10% del cliente anterior. Comparando el
     * visible, ese renglón no coincidía con `anterior` y se quedaba con el
     * descuento del cliente VIEJO escondido debajo — que reaparecía al quitar
     * el nombrado, o al confirmar si el nombrado dejaba de aplicar.
     */
    case 'descuentoCliente':
      return recalcular({
        ...estado,
        renglones: estado.renglones.map((r) => {
          const base = Number(r.descuentoBase ?? r.descuento) || 0;
          if (base !== (accion.anterior || 0)) return r;
          const v = accion.valor || 0;
          return { ...r, descuentoBase: v, descuento: v };
        }),
      });

    /**
     * El cajero aplicó (o quitó) DESCUENTOS CON NOMBRE. Mismo criterio que la
     * sugerencia por monto y la oferta de ticket: no se toca ningún renglón a
     * mano, se anota la decisión y `recalcular` reparte. Por eso quitar uno
     * revierte solo, sin que nadie tenga que acordarse de qué traía cada
     * renglón antes.
     *
     * Viajan IDS. El porcentaje lo dice el catálogo para mostrar, y lo vuelve a
     * decidir el servidor al guardar.
     */
    case 'descuentos':
      return recalcular({ ...estado, descuentos: accion.ids ?? [] });
    default:
      return estado;
  }
}

/**
 * QUÉ DESCUENTOS CON NOMBRE SIRVEN PARA ESTE TICKET, y por qué los otros no.
 *
 * Devuelve el catálogo entero —no solo los que se pueden— porque en el
 * mostrador "no está" y "está pero no se puede, por esto" son cosas distintas:
 * lo primero manda a la cajera a buscar al encargado sin saber qué preguntar.
 *
 * El orden de los motivos va del más permanente al más circunstancial, para que
 * el que se muestre sea el que de verdad hay que resolver: si venció, no
 * importa que además ningún renglón use su lista.
 *
 * Un descuento YA APLICADO se devuelve siempre clickeable aunque tenga motivo:
 * hay que poder sacarlo. Ahí el motivo pasa a ser un aviso —"lo aplicaste y ya
 * no descuenta nada"— que es exactamente lo que la cajera necesita ver.
 */
export function descuentosDisponibles(estado, { esAdmin = false } = {}) {
  const catalogo = estado.ctx.catalogo;
  const t = estado.ctx.ahora ? new Date(estado.ctx.ahora).getTime() : Date.now();
  const sucursalId = estado.ctx.sucursalId ?? null;
  const puestos = estado.descuentos ?? [];

  const etiqueta = (listaId) => catalogo?.listas
    ?.find((l) => l.listaId === listaId)?.etiqueta || 'esa lista';

  /* Dos conjuntos y no uno: un renglón en oferta USA su lista (así que el
   * descuento no está "fuera del ticket") pero no la deja descontar. */
  const conRenglon = new Set();
  const sinOferta = new Set();
  for (const r of estado.renglones) {
    if (r.listaId == null) continue;
    conRenglon.add(r.listaId);
    if (!(r.ofertaDescuento > 0)) sinOferta.add(r.listaId);
  }

  const ocupadas = new Set(
    (estado.ctx.descuentos ?? []).filter((d) => puestos.includes(d.id)).map((d) => d.listaId),
  );

  return (estado.ctx.descuentos ?? [])
    .filter((d) => d.activo !== false)
    .map((d) => {
      const puesto = puestos.includes(d.id);
      let motivo = '';
      if (d.vence && new Date(d.vence).getTime() < t) motivo = 'Venció';
      else if (d.sucursalId != null && sucursalId != null && d.sucursalId !== sucursalId) {
        motivo = 'Es de otra sucursal';
      } else if (d.requiereAdmin && !esAdmin) motivo = 'Lo aplica un administrador';
      else if (!conRenglon.has(d.listaId)) motivo = `Ningún renglón usa ${etiqueta(d.listaId)}`;
      else if (!sinOferta.has(d.listaId)) motivo = `Lo de ${etiqueta(d.listaId)} ya está en oferta`;
      else if (!puesto && ocupadas.has(d.listaId)) motivo = `Ya hay uno de ${etiqueta(d.listaId)}`;
      return { ...d, lista: etiqueta(d.listaId), puesto, motivo, aplicable: puesto || !motivo };
    });
}

/**
 * LOS DESCUENTOS QUE VIAJAN A LA API — que no son todos los que el POS muestra.
 *
 * El ticket conserva el id de un descuento que dejó de tener efecto (porque su
 * lista se cayó del ticket, o porque venció mientras estaba abierto) y lo
 * muestra con el aviso: si vuelve a entrar un renglón de esa lista, el
 * descuento se reactiva solo. Eso es del POS.
 *
 * El servidor no puede razonar así — RECHAZA un descuento cuya lista no está en
 * el ticket, y con razón: es la defensa contra colgarle a una venta un
 * descuento que no le corresponde. Si el POS mandara el id igual, el
 * autoguardado devolvería 400 EN CADA TECLA y el ticket quedaría sin poder
 * guardarse, con un error sobre algo que la cajera ya ve marcado en pantalla.
 *
 * Así que se manda lo que el servidor acepta, y el aviso queda del lado de acá.
 * Descubierto guardando un ticket de verdad, no en las pruebas de API.
 */
export function descuentosParaApi(estado) {
  const listas = new Set(estado.renglones.map((r) => r.listaId).filter((x) => x != null));
  const ahora = estado.ctx.ahora ? new Date(estado.ctx.ahora).getTime() : Date.now();
  return (estado.descuentos ?? []).filter((id) => {
    const d = (estado.ctx.descuentos ?? []).find((x) => x.id === id);
    if (!d || !listas.has(d.listaId)) return false;
    return !(d.vence && new Date(d.vence).getTime() < ahora);
  });
}

/**
 * Renglones en el formato que espera `POST/PUT /ventas`.
 *
 * NO viaja `iva`: la alícuota es del PRODUCTO y la pone el servidor
 * (`resolverRenglones`). `VentaItemDto` no lo declara, así que el `whitelist` de
 * la API lo descartaba en silencio — mandarlo hacía creer que la pantalla decide
 * el IVA del renglón.
 */
export function itemsParaApi(renglones) {
  return renglones.map((r) => ({
    productoId: r.productoId,
    presentacionId: r.presentacionId ?? undefined,
    cantidad: r.cantidad,
    listaId: r.listaId ?? undefined,
    lista: r.lista || undefined,
    listaOrigen: r.listaOrigen || undefined,
    precioLista: r.precioLista,
    precioUnitario: r.precioUnitario,
    /*
     * VIAJA EL DESCUENTO BASE, no el que se ve en pantalla.
     *
     * El de pantalla puede ser el de un descuento CON NOMBRE que ganó (25% de
     * "Atención por tardanza"), y ese porcentaje lo pone el servidor a partir
     * del id — no lo acepta del navegador. Si se mandara el combinado, el
     * servidor lo leería como un descuento puesto a mano y lo rebotaría contra
     * `descuentoMaxVendedor` (10%) antes de llegar a aplicar el nombrado.
     *
     * O sea: el cliente manda lo que decidió una persona, el servidor suma lo
     * que autorizó el dueño. Cada uno pone lo que le corresponde.
     */
    descuento: Number(r.descuentoBase ?? r.descuento) || 0,
    ofertaId: r.ofertaId ?? undefined,
    oferta: r.oferta || undefined,
    ofertaDescuento: r.ofertaDescuento > 0 ? r.ofertaDescuento : undefined,
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
      marca: cat?.marca ?? '',
      marcaId: cat?.marcaId ?? null,
      categoriaId: cat?.categoriaId ?? null,
      etiquetas: cat?.etiquetas ?? [],
      listaId: it.listaId ?? null,
      lista: it.lista || '',
      listaOrigen: it.listaOrigen || 'base',
      // Al retomar una venta se respeta lo que se había decidido a mano.
      listaManual: it.listaOrigen === 'manual',
      precioLista: it.precioLista,
      precioUnitario: it.precioUnitario,
      descuento: it.descuento,
      /*
       * LA BASE VIENE DE LA BASE. El `??` es para los renglones anteriores a la
       * migración 0064, donde la columna no existía y el descuento cobrado ERA
       * el propio (no había descuentos con nombre todavía).
       */
      descuentoBase: it.descuentoBase ?? it.descuento,
      descuentoId: it.descuentoId ?? null,
      descuentoNombre: it.descuentoNombre || '',
      ofertaId: it.ofertaId ?? null,
      oferta: it.oferta || '',
      ofertaDescuento: it.ofertaDescuento || 0,
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
export function problemasDelTicket(renglones, { permitirStockNegativo, descuentoMax, puedePisarPrecio }) {
  const problemas = [];
  if (!renglones.length) problemas.push('El ticket está vacío.');
  for (const r of renglones) {
    const etiqueta = `${r.nombre} (${r.detalle})`;
    if (r.cantidad <= 0) problemas.push(`${etiqueta}: la cantidad tiene que ser mayor a 0.`);
    if (r.precioUnitario <= 0) problemas.push(`${etiqueta}: no tiene precio cargado.`);
    if (!permitirStockNegativo && r.cantidad > r.stock + 1e-9) {
      problemas.push(`${etiqueta}: hay ${r.stock} ${r.unidad} y estás vendiendo ${r.cantidad}.`);
    }
    if (!puedePisarPrecio && r.descuento > descuentoMax + 1e-9) {
      problemas.push(`${etiqueta}: el descuento de ${r.descuento}% supera el tope de ${descuentoMax}%.`);
    }
  }
  return problemas;
}
