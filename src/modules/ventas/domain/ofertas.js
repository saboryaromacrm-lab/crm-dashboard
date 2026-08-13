/**
 * MOTOR DE OFERTAS (puro, sin React)
 * ============================================================================
 * Decide qué promoción le toca a cada renglón y cuánto descuenta, en memoria y
 * con cada tecla — por eso vive acá y no en la API.
 *
 * LAS REGLAS QUE SOSTIENEN TODO:
 *
 *  1. La MISMA regla de oro del formato de venta: mecánicas medidas sobre
 *     CANTIDADES (3×2, 2ª unidad, pack, combo) son estables → se aplican
 *     solas. La de MONTO del ticket se mide sobre pesos — aplicarla baja el
 *     total y podría des-calificarse a sí misma — → se SUGIERE con un clic.
 *
 *  2. UNA oferta por renglón: la de mayor beneficio. Apilar promos vuelve el
 *     ticket inexplicable y el margen negativo. Los combos van primero y
 *     CONSUMEN unidades: lo que entró en un combo no cuenta para otra promo.
 *
 *  3. Los precios configurados ($ de pack, combo y precio fijo) son FINALES,
 *     con IVA — el número del cartel. El motor deriva el neto por renglón,
 *     porque el ticket trabaja en neto y cada producto tiene su alícuota.
 *
 * Convención del resultado: `{ ofertaId, oferta, descuento, detalle }` por
 * renglón, con `descuento` en NETO. `null` = sin oferta.
 */
// Redondeo local (idéntico al de pos.js) y no un import: pos.js importa de acá,
// y un ciclo de módulos por dos líneas es comprar un problema gratis.
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ------------------------------------------------------------------ *
 * Vigencia y alcance
 * ------------------------------------------------------------------ */

/**
 * ¿La oferta está viva AHORA, ACÁ? El catálogo manda todas las activas y esto
 * se evalúa en cada recálculo: una promo puede arrancar o vencer en medio del
 * turno sin recargar la caja.
 */
export function ofertaVigente(o, { ahora, sucursalId }) {
  if (!o || o.activa === false) return false;
  const t = ahora instanceof Date ? ahora : new Date(ahora || Date.now());
  if (o.desde && t < new Date(o.desde)) return false;
  if (o.hasta && t > new Date(o.hasta)) return false;
  // Máscara lunes→domingo; getDay() arranca en domingo, de ahí el corrimiento.
  if (o.dias && o.dias.length === 7 && o.dias[(t.getDay() + 6) % 7] !== '1') return false;
  if (o.sucursales && sucursalId != null) {
    const ids = String(o.sucursales).split(',').map((x) => x.trim()).filter(Boolean);
    if (ids.length && !ids.includes(String(sucursalId))) return false;
  }
  return true;
}

/**
 * ¿El alcance de la oferta incluye a este renglón? Varias filas = unión.
 *
 * EL PAQUETE FRACCIONADO NO ES SU MADRE (0054). Los cuatro alcances de siempre
 * se resuelven por datos de la MADRE —producto, marca, categoría, etiqueta— y el
 * renglón de un paquete los hereda todos, así que sin este filtro una oferta a
 * "Nuez Pecán" le bajaba el precio también a sus paquetes de 250 g. Nadie lo
 * había decidido: era el efecto de comparar `productoId`. Ahora lo decide el
 * tilde `incluyeFraccionados` de cada oferta, y el alcance `presentacion` apunta
 * a UN paquete a propósito.
 */
export function alcanzaRenglon(o, r) {
  const esPaquete = r.presentacionId != null;
  return (o.alcances ?? []).some((a) => {
    if (a.tipo === 'presentacion') return esPaquete && r.presentacionId === a.refId;
    // Los que se resuelven por la madre: al paquete solo lo alcanzan si la
    // oferta lo dice.
    if (esPaquete && !o.incluyeFraccionados) return false;
    switch (a.tipo) {
      case 'producto': return r.productoId === a.refId;
      case 'marca': return r.marcaId === a.refId;
      case 'categoria': return r.categoriaId === a.refId;
      case 'etiqueta': return (r.etiquetas ?? []).includes(a.refId);
      default: return false;
    }
  });
}

/**
 * `soloPrecioBase`: la promo de vidriera no se suma a un precio ya negociado.
 * El renglón elegible es el que está al precio de mostrador.
 */
function pasaPrecioBase(o, r) {
  return !o.soloPrecioBase || r.listaOrigen === 'base';
}

/** Neto de un precio de cartel (final, con IVA) para la alícuota del renglón. */
const netoDe = (precioFinal, iva) => (Number(precioFinal) || 0) / (1 + (Number(iva) || 0) / 100);

/* ------------------------------------------------------------------ *
 * Mecánicas por renglón
 * ------------------------------------------------------------------ */

/**
 * Descuento NETO que la mecánica produce sobre `c` unidades al precio del
 * renglón. Devuelve `{ descuento, detalle }`; descuento 0 = no aplica (por
 * ejemplo, un "precio de oferta" más caro que el precio actual: subirle el
 * precio a alguien nunca es una oferta).
 */
export function descuentoMecanica(o, r, c) {
  const p = Number(r.precioUnitario) || 0;
  if (!(c > 0) || !(p > 0)) return null;

  switch (o.tipo) {
    case 'porcentaje': {
      const d = c * p * o.porcentaje / 100;
      return d > 0 ? { descuento: d, detalle: `${o.porcentaje}% off` } : null;
    }
    case 'precio_fijo': {
      const pf = netoDe(o.precio, r.iva);
      if (pf >= p) return null;
      return { descuento: c * (p - pf), detalle: `Precio oferta` };
    }
    case 'nxm': {
      const gratis = Math.floor(c / o.lleva) * (o.lleva - o.paga);
      if (gratis <= 0) return null;
      return { descuento: gratis * p, detalle: `${o.lleva}×${o.paga}: ${gratis} sin cargo` };
    }
    case 'segunda_unidad': {
      const pares = Math.floor(c / 2);
      if (pares <= 0) return null;
      return { descuento: pares * p * o.porcentaje / 100, detalle: `2ª unidad −${o.porcentaje}%` };
    }
    case 'pack': {
      const grupos = Math.floor(c / o.lleva);
      if (grupos <= 0) return null;
      const ahorroPorPack = o.lleva * p - netoDe(o.precio, r.iva);
      if (ahorroPorPack <= 0) return null;
      return { descuento: grupos * ahorroPorPack, detalle: `${grupos}× pack de ${o.lleva}` };
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Combos (consumen unidades)
 * ------------------------------------------------------------------ */

/**
 * Un combo junta productos DISTINTOS a un precio de conjunto. Se detectan
 * cuántos conjuntos completos hay, se descuenta la diferencia contra los
 * precios actuales y se reparte proporcional al valor de lo que aportó cada
 * renglón — así cada parte del descuento tributa con el IVA de su producto.
 *
 * Las unidades que entran en un combo se anotan en `usadas` y no cuentan para
 * ninguna otra mecánica: sin eso, las mismas galletitas serían el combo Y el
 * 3×2 a la vez.
 */
function aplicarCombos(combos, renglones, usadas, resultado) {
  for (const o of combos) {
    const comps = o.componentes ?? [];
    if (comps.length < 2 || !(o.precio > 0)) continue;

    // Disponible por producto = lo cargado menos lo ya consumido por otro combo.
    const disponibles = new Map();
    for (const r of renglones) {
      if (!pasaPrecioBase(o, r) || resultado.has(r.key)) continue;
      const libre = (Number(r.cantidad) || 0) - (usadas.get(r.key) ?? 0);
      if (libre > 0) disponibles.set(r.productoId, (disponibles.get(r.productoId) ?? 0) + libre);
    }
    const sets = Math.min(...comps.map((cmp) =>
      Math.floor((disponibles.get(cmp.productoId) ?? 0) / cmp.cantidad)));
    if (!(sets >= 1) || !Number.isFinite(sets)) continue;

    // Se toma de los renglones en orden de carga y se anota cuánto puso cada uno.
    const tomas = [];
    let valorFinalTotal = 0;
    for (const cmp of comps) {
      let falta = cmp.cantidad * sets;
      for (const r of renglones) {
        if (falta <= 0) break;
        if (r.productoId !== cmp.productoId || !pasaPrecioBase(o, r) || resultado.has(r.key)) continue;
        const libre = (Number(r.cantidad) || 0) - (usadas.get(r.key) ?? 0);
        if (libre <= 0) continue;
        const toma = Math.min(libre, falta);
        const valorFinal = toma * (Number(r.precioUnitario) || 0) * (1 + (Number(r.iva) || 0) / 100);
        tomas.push({ r, toma, valorFinal });
        valorFinalTotal += valorFinal;
        falta -= toma;
      }
    }

    const descuentoFinal = valorFinalTotal - sets * o.precio;
    if (descuentoFinal <= 0) continue;   // el combo no mejora nada: no consume

    for (const t of tomas) {
      usadas.set(t.r.key, (usadas.get(t.r.key) ?? 0) + t.toma);
      const parteFinal = descuentoFinal * (t.valorFinal / valorFinalTotal);
      const parteNeta = parteFinal / (1 + (Number(t.r.iva) || 0) / 100);
      resultado.set(t.r.key, {
        ofertaId: o.id,
        oferta: o.nombre,
        descuento: parteNeta,
        detalle: `${sets}× combo`,
      });
    }
  }
}

/* ------------------------------------------------------------------ *
 * Resolución del ticket
 * ------------------------------------------------------------------ */

/**
 * Qué oferta le toca a cada renglón. Combos primero (consumen unidades),
 * después cada renglón se queda con la mecánica de MAYOR descuento entre las
 * que lo alcanzan. Devuelve un Map key → resultado (sin entrada = sin oferta).
 *
 * `ticketAplicada` es la oferta de ticket que el cajero ya aceptó: reparte su
 * porcentaje entre los renglones QUE NO tienen otra oferta — el 10% del ticket
 * no se apila sobre el 3×2.
 */
export function resolverOfertas(renglones, ofertas, { ahora, sucursalId, ticketAplicadaId }) {
  const resultado = new Map();
  if (!renglones.length || !ofertas?.length) return resultado;

  const vivas = ofertas.filter((o) => o.tipo !== 'ticket' && ofertaVigente(o, { ahora, sucursalId }));
  const usadas = new Map();

  aplicarCombos(vivas.filter((o) => o.tipo === 'combo'), renglones, usadas, resultado);

  const porRenglon = vivas.filter((o) => o.tipo !== 'combo');
  for (const r of renglones) {
    if (resultado.has(r.key)) continue;   // ya está en un combo
    const libre = (Number(r.cantidad) || 0) - (usadas.get(r.key) ?? 0);
    let mejor = null;
    for (const o of porRenglon) {
      if (!pasaPrecioBase(o, r) || !alcanzaRenglon(o, r)) continue;
      const res = descuentoMecanica(o, r, libre);
      if (res && (!mejor || res.descuento > mejor.descuento)) {
        mejor = { ofertaId: o.id, oferta: o.nombre, tipoOferta: o.tipo, ...res };
      }
    }
    /*
     * LA PROMO PORCENTUAL DESCUENTA SOBRE LO QUE EL RENGLÓN PAGA DE VERDAD.
     *
     * Un "20% off" se calculaba sobre el precio unitario —el bruto— aunque el
     * renglón ya viniera con el descuento del cliente encima. La API acota esas
     * promos al porcentaje del neto YA bonificado, así que las dos puntas no
     * coincidían y el ticket se rechazaba entero: un cliente con 10% de
     * descuento no podía comprar nada en oferta (10 u × $1.000 daba $2.000 acá
     * contra un techo de $1.800 allá, y el autoguardado fallaba en cada tecla).
     *
     * SOLO LAS PROPORCIONALES, y por eso la condición mira el tipo en vez de
     * aplicar el factor a todo. El corte es si el ahorro es un MÚLTIPLO del
     * precio unitario:
     *
     *  - `porcentaje` (c·p·pct), `segunda_unidad` (pares·p·pct) y `nxm`
     *    (gratis·p) lo son. En el 3×2 la unidad gratis vale lo que el cliente
     *    iba a pagar por ella —$900 si tiene 10% de descuento, no $1.000—, así
     *    que sin el factor el ticket regalaba $100 de más.
     *  - `precio_fijo` y `pack` NO: prometen un PRECIO ("el kilo a $800", "el
     *    pack de 6 a $4.000"). Escalarles el ahorro le cobraría al cliente más
     *    que el número del cartel, y del lado del servidor nadie lo pide — su
     *    techo para esas dos es el bruto del renglón. Cómo se combinan un precio
     *    de oferta y el descuento del cliente es decisión del dueño, no un
     *    efecto de esta línea: quedan como estaban.
     */
    if (mejor) {
      const proporcional = mejor.tipoOferta === 'porcentaje'
        || mejor.tipoOferta === 'segunda_unidad'
        || mejor.tipoOferta === 'nxm';
      const bonificacion = 1 - (Number(r.descuento) || 0) / 100;
      resultado.set(r.key, proporcional && bonificacion < 1
        ? { ...mejor, descuento: mejor.descuento * bonificacion }
        : mejor);
    }
  }

  // La oferta de ticket aceptada: % sobre los renglones que quedaron sin promo.
  if (ticketAplicadaId) {
    const ot = ofertas.find((o) => o.id === ticketAplicadaId && o.tipo === 'ticket');
    if (ot && ofertaVigente(ot, { ahora, sucursalId })) {
      for (const r of renglones) {
        if (resultado.has(r.key) || !pasaPrecioBase(ot, r)) continue;
        const neto = (Number(r.cantidad) || 0) * (Number(r.precioUnitario) || 0)
          * (1 - (Number(r.descuento) || 0) / 100);
        if (neto <= 0) continue;
        resultado.set(r.key, {
          ofertaId: ot.id,
          oferta: ot.nombre,
          descuento: neto * ot.porcentaje / 100,
          detalle: `${ot.porcentaje}% al ticket`,
        });
      }
    }
  }

  for (const v of resultado.values()) v.descuento = r2(v.descuento);
  return resultado;
}

/**
 * Ofertas de ticket que el total ya habilita y no están aplicadas. Es lo único
 * que se ofrece en vez de aplicarse solo (regla de oro), y avisa POR ADELANTADO
 * si exigen un medio de pago — el cajero lo dice antes de cobrar, no después.
 */
export function sugerenciasOfertaTicket(ofertas, renglones, total, { ahora, sucursalId }, aplicadaId) {
  return (ofertas ?? [])
    .filter((o) => o.tipo === 'ticket'
      && o.id !== aplicadaId
      && ofertaVigente(o, { ahora, sucursalId })
      && total + 1e-9 >= o.montoMinimo
      // Solo si de verdad cambiaría algún renglón: la de ticket no se apila
      // sobre promos ya aplicadas, y ofrecer algo que no hace nada ensucia la
      // pantalla del cajero.
      && (renglones ?? []).some((r) => !(r.ofertaDescuento > 0) && pasaPrecioBase(o, r)))
    .map((o) => ({
      id: o.id,
      nombre: o.nombre,
      porcentaje: o.porcentaje,
      montoMinimo: o.montoMinimo,
      mediosPago: String(o.mediosPago || '').split(',').map((m) => m.trim()).filter(Boolean),
    }))
    .sort((a, b) => b.porcentaje - a.porcentaje);
}

/* ------------------------------------------------------------------ *
 * Presentación (panel y formulario)
 * ------------------------------------------------------------------ */

/** Descripción corta de la mecánica: lo que diría el cartel. */
export function describirOferta(o) {
  switch (o.tipo) {
    case 'porcentaje': return `${o.porcentaje}% de descuento`;
    case 'precio_fijo': return `Precio oferta $${o.precio}`;
    case 'nxm': return `${o.lleva}×${o.paga}`;
    case 'segunda_unidad': return `2ª unidad al ${o.porcentaje}%`;
    case 'pack': return `${o.lleva} por $${o.precio}`;
    case 'combo': return `Combo por $${o.precio}`;
    case 'ticket': return `${o.porcentaje}% al ticket desde $${o.montoMinimo}`;
    default: return o.tipo;
  }
}

/** Estado calculado para el panel: por qué (no) está corriendo ahora. */
export function estadoOferta(o, ahora = new Date()) {
  if (!o.activa) return { id: 'inactiva', label: 'Inactiva' };
  if (o.desde && ahora < new Date(o.desde)) return { id: 'programada', label: 'Programada' };
  if (o.hasta && ahora > new Date(o.hasta)) return { id: 'vencida', label: 'Vencida' };
  return { id: 'vigente', label: 'Vigente' };
}
