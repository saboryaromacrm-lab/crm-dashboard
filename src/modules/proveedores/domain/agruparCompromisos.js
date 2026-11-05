/**
 * CUENTAS CORRIENTES AGRUPADAS POR PROVEEDOR (5/11/2026, pedido del dueño:
 * «una fila con el total de Herradura y que se despliegue con las dos
 * facturas»). Siempre agrupado. Recibe las filas como las manda la API
 * (ordenadas por vencimiento) y devuelve un grupo por proveedor, en el orden
 * de su compromiso más viejo: lo más vencido sigue arriba de todo.
 *
 * El importe de cada compromiso es el mismo que suma el pie de la tabla: lo
 * que falta si está pendiente, el importe si ya se pagó.
 */
const EPS = 0.009;
const r2 = (n) => Math.round(n * 100) / 100;

export const importeVisible = (k) => (k.pagado ? k.importe : k.falta);

export function agruparCompromisos(filas) {
  const grupos = new Map();
  for (const k of filas) {
    const g = grupos.get(k.proveedorId);
    if (g) g.filas.push(k);
    else grupos.set(k.proveedorId, { proveedorId: k.proveedorId, proveedorNombre: k.proveedorNombre, filas: [k] });
  }
  return [...grupos.values()].map((g) => {
    const impagas = g.filas.filter((k) => !k.pagado);
    const plazos = new Set(g.filas.map((k) => k.diasPlazo ?? null));
    return {
      ...g,
      /** La que manda en la fila: la impaga que vence primero (o la primera, si está todo pagado). */
      primera: impagas[0] ?? g.filas[0],
      total: r2(g.filas.reduce((a, k) => a + importeVisible(k), 0)),
      /** Lo que de verdad se le debe hoy: lo que falta de cada impago. */
      aPagar: r2(impagas.reduce((a, k) => a + k.falta, 0)),
      pagado: impagas.length === 0,
      /** Un solo plazo para todas, o null si son distintos («varios»). */
      plazo: plazos.size === 1 ? { dias: [...plazos][0] } : null,
      /** Las facturas que se pagan juntas desde la fila del proveedor (si su saldo suma `aPagar`: ver CtasCtesPanel). */
      comprobantesAPagar: [...new Set(impagas.filter((k) => k.falta > EPS && k.comprobanteId).map((k) => k.comprobanteId))],
      todasConComprobante: g.filas.every((k) => k.comprobanteId),
    };
  });
}
