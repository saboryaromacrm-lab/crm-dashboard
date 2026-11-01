/**
 * GERENCIA › INDICADORES — el catálogo (1/11/2026)
 * ============================================================================
 * Cada indicador con su explicación para la encargada: QUÉ ES, PARA QUÉ SIRVE
 * y QUÉ HACER si está mal, y el objetivo de partida (el dueño lo cambia desde
 * la pantalla; lo guardado manda). Pensado como lo plantearía un administrador
 * de empresas con mirada contable: primero si el negocio crece de verdad
 * (contra la inflación), después cuánto deja, la plata parada en stock y la
 * prolijidad de la operación.
 *
 *   formato   'variacion' (+3,2 % contra antes) · 'pct' (una parte del total)
 *   sentido   'mayor' (más es mejor) · 'menor' (menos es mejor)
 *   tolerancia  cuántos puntos fuera del objetivo sigue en amarillo
 *   previo    el valor del período anterior se muestra en puntos (pts)
 */

export const BLOQUES = [
  {
    id: 'ventas', titulo: 'Ventas',
    sub: '¿El negocio crece de verdad? Clientes, cuánto compra cada uno y cómo pagan.',
  },
  {
    id: 'rentabilidad', titulo: 'Rentabilidad',
    sub: '¿Cuánto queda de lo que se vende? Margen, granel, descuentos y errores de precio.',
  },
  {
    id: 'stock', titulo: 'Stock',
    sub: 'La mercadería es plata: cuánta está parada, cuánta sobra y qué está por faltar. Es el stock de hoy.',
  },
  {
    id: 'operacion', titulo: 'Operación',
    sub: 'La prolijidad del día a día: las cajas y las devoluciones.',
  },
];

export const INDICADORES = [
  /* ------------------------------ VENTAS ------------------------------ */
  {
    id: 'crecimiento', bloque: 'ventas', nombre: 'Crecimiento de las ventas', formato: 'variacion',
    sentido: 'mayor', objetivo: 2, tolerancia: 2, contra: 'contra el período anterior',
    que: 'Cuánto más (o menos) se vendió que en el período anterior del mismo largo.',
    paraQue: 'Es el pulso del negocio. Con inflación, vender lo mismo en pesos es vender menos mercadería: por eso el objetivo tiene que ser, como mínimo, la inflación del período (para un mes, la mensual del INDEC).',
    accion: 'Mirá abajo qué sucursal perdió participación, si faltó mercadería (Stock › por agotarse) y si hubo días cerrados o feriados en el período.',
  },
  {
    id: 'crecimientoAnual', bloque: 'ventas', nombre: 'Contra el año pasado', formato: 'variacion',
    sentido: 'mayor', objetivo: 30, tolerancia: 5, contra: 'contra los mismos días de hace un año',
    que: 'Lo vendido contra los mismos días de la semana de hace un año (un sábado contra un sábado).',
    paraQue: 'Saca del medio la temporada: diciembre contra diciembre. Es la comparación más justa. Por encima de la inflación anual es crecimiento real; por debajo, el negocio se achicó aunque los números en pesos suban.',
    accion: 'Si está por debajo de la inflación anual: revisar precios contra la competencia, clientes que dejaron de venir y categorías que cayeron.',
  },
  {
    id: 'tickets', bloque: 'ventas', nombre: 'Cantidad de tickets', formato: 'variacion',
    sentido: 'mayor', objetivo: 0, tolerancia: 3, contra: 'contra el período anterior',
    que: 'Cuántas ventas hubo (clientes atendidos) contra el período anterior.',
    paraQue: 'Mide si viene más o menos gente. No depende de los precios: es el indicador más honesto de la clientela.',
    accion: 'Si baja: atención en la caja, horarios, faltantes, competencia nueva cerca. Una promoción visible ayuda a traer gente.',
  },
  {
    id: 'ticketPromedio', bloque: 'ventas', nombre: 'Ticket promedio', formato: 'variacion',
    sentido: 'mayor', objetivo: 2, tolerancia: 2, contra: 'contra el período anterior',
    que: 'Cuánto gasta cada cliente por compra, contra el período anterior.',
    paraQue: 'Si sube menos que la inflación, cada cliente se lleva menos mercadería. Subirlo es la forma más barata de vender más: el cliente ya está adentro.',
    accion: 'Ofrecer algo complementario al cobrar (venta cruzada), exhibir cerca de la caja, armar combos y packs.',
  },
  {
    id: 'credito', bloque: 'ventas', nombre: 'Cobrado con tarjeta de crédito', formato: 'pct',
    sentido: 'menor', objetivo: 10, tolerancia: 3,
    que: 'Qué parte de lo cobrado entró con tarjeta de crédito.',
    paraQue: 'La tarjeta de crédito cobra comisión y tarda en acreditarse. Cada punto que pasa a efectivo, transferencia o QR deja más plata y más rápido.',
    accion: 'Ofrecer el descuento por efectivo o transferencia y tener el QR a la vista en la caja.',
  },

  /* --------------------------- RENTABILIDAD --------------------------- */
  {
    id: 'margen', bloque: 'rentabilidad', nombre: 'Margen bruto', formato: 'pct', previo: true,
    sentido: 'mayor', objetivo: 30, tolerancia: 2,
    que: 'De cada $100 que se venden (sin IVA), cuánto queda después de pagar la mercadería.',
    paraQue: 'Con ese margen se pagan sueldos, alquiler, luz e impuestos: lo que sobra es la ganancia. Si baja con las ventas estables, se está vendiendo barato o comprando caro.',
    accion: 'Revisar precios que quedaron viejos después de un aumento del proveedor, las ofertas y los descuentos, y que los costos estén cargados.',
  },
  {
    id: 'granel', bloque: 'rentabilidad', nombre: 'Granel en la venta', formato: 'pct', previo: true,
    sentido: 'mayor', objetivo: null, tolerancia: 2,
    que: 'Qué parte de lo vendido es granel (en paquetes o suelto al peso).',
    paraQue: 'El granel suele dejar más margen que los productos enteros (compará los dos márgenes en esta tarjeta). Cuanto más pesa en la venta, mejor queda el margen total.',
    accion: 'Granel bien exhibido y rotulado, que no falten fraccionados, paquetes chicos a la vista y degustación.',
  },
  {
    id: 'descuentos', bloque: 'rentabilidad', nombre: 'Descuentos sobre el precio de lista', formato: 'pct',
    sentido: 'menor', objetivo: 3, tolerancia: 1,
    que: 'De cada $100 a precio de lista, cuánto se dejó de cobrar: ofertas, descuentos, cupones y precios cambiados a mano.',
    paraQue: 'Todo descuento sale directo del margen. Sirve si trae más venta; si no, es plata regalada.',
    accion: 'Revisar las ofertas que no aumentan la venta, los descuentos a mano y los clientes con descuento fijo.',
  },
  {
    id: 'bajoCosto', bloque: 'rentabilidad', nombre: 'Venta por debajo del costo', formato: 'pct',
    sentido: 'menor', objetivo: 0.5, tolerancia: 0.5,
    que: 'Qué parte de la venta se hizo a un precio menor que lo que costó la mercadería.',
    paraQue: 'Casi siempre es un error: precio viejo, costo mal cargado u oferta mal armada. Cada caso es plata perdida en cada venta.',
    accion: 'Buscar los productos en Métricas › Rentabilidad con «Menor margen (%)» y corregir el precio o el costo.',
  },

  /* ------------------------------ STOCK ------------------------------ */
  {
    id: 'parado', bloque: 'stock', nombre: 'Mercadería parada', formato: 'pct',
    sentido: 'menor', objetivo: 10, tolerancia: 5,
    que: 'Qué parte de la mercadería (valuada a costo) no tuvo ninguna venta en los últimos 60 días.',
    paraQue: 'Es plata inmovilizada: no rinde, ocupa lugar y se puede vencer.',
    accion: 'Liquidar con una oferta, pasarla a la sucursal donde se vende y no volver a comprarla.',
  },
  {
    id: 'sobrestock', bloque: 'stock', nombre: 'Sobrestock', formato: 'pct',
    sentido: 'menor', objetivo: 15, tolerancia: 5,
    que: 'Qué parte de la mercadería alcanza para más de 180 días al ritmo de venta actual.',
    paraQue: 'Se compró de más: es plata que podría estar en mercadería que sí rota.',
    accion: 'Frenar las compras de esos productos hasta que bajen al nivel normal.',
  },
  {
    id: 'porAgotarse', bloque: 'stock', nombre: 'Artículos por agotarse', formato: 'pct',
    sentido: 'menor', objetivo: 5, tolerancia: 3,
    que: 'De los artículos con stock, cuántos se terminan en menos de 7 días al ritmo de venta actual.',
    paraQue: 'Cada faltante es una venta perdida y un cliente que prueba en otro lado.',
    accion: 'Pedir a tiempo: Almacén › Bajos en stock y la orden de pedido al proveedor.',
  },

  /* ---------------------------- OPERACIÓN ---------------------------- */
  {
    id: 'cierresDiferencia', bloque: 'operacion', nombre: 'Cierres de caja con diferencia', formato: 'pct',
    sentido: 'menor', objetivo: 10, tolerancia: 10,
    que: 'De los cierres de caja del período, cuántos tuvieron una diferencia importante entre lo contado y lo que dice el sistema (la misma que manda una caja a «Cajas a controlar»; los pesos de las monedas no cuentan).',
    paraQue: 'Mide la prolijidad en la caja: cobros mal registrados, vueltos, errores al elegir el medio de pago.',
    accion: 'Hablar con el turno, revisar esos cierres en Ventas › Caja y repasar: registrar todo, elegir bien el medio y contar dos veces.',
  },
  {
    id: 'notas', bloque: 'operacion', nombre: 'Notas de crédito y devoluciones', formato: 'pct', previo: true,
    sentido: 'menor', objetivo: 1, tolerancia: 0.5,
    que: 'Cada 100 tickets, cuántas notas de crédito o devoluciones hubo.',
    paraQue: 'Muestra errores al cobrar o productos con problemas de calidad.',
    accion: 'Ver el motivo de cada una; si se repite un producto, hablarlo con el proveedor; si se repite un error de caja, repasarlo con el equipo.',
  },
];

/** Verde, amarillo o rojo según el objetivo. null = sin dato o sin objetivo. */
export function semaforo(ind, valor, objetivo) {
  if (valor == null || objetivo == null) return null;
  const tol = ind.tolerancia ?? 0;
  if (ind.sentido === 'menor') return valor <= objetivo ? 'ok' : valor <= objetivo + tol ? 'cerca' : 'fuera';
  return valor >= objetivo ? 'ok' : valor >= objetivo - tol ? 'cerca' : 'fuera';
}
