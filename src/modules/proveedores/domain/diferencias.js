/**
 * DIFERENCIAS DE ENTREGA (0248): cómo se dicen y cómo se resuelven a mano en
 * Proveedores › Cambios de mercadería. Las reglas: crm-api/src/proveedores/diferencias.ts.
 */

/** Lo que se resuelve sin papel, por tipo (la NC y la factura que cobra lo de más se atan al cargarlas). */
export const ACCIONES = {
  faltante: [
    { como: 'llego', boton: 'Llegó', titulo: 'Llegó lo que faltaba', ayuda: 'Entra al stock de la sucursal de la entrega, sin deuda: ya estaba en el papel.' },
    { como: 'perdido', boton: 'Dar por perdido', titulo: 'Dar por perdido', ayuda: 'No lo va a reponer ni a descontar. No toca el stock (nunca entró) ni la deuda.' },
  ],
  sobrante: [
    { como: 'devuelto', boton: 'Devolver', titulo: 'Se lo devolviste', ayuda: 'Sale del stock de la sucursal de la entrega.' },
    { como: 'sin_cargo', boton: 'Sin cargo', titulo: 'Quedó sin cargo', ayuda: 'No lo va a cobrar: queda en el stock como bonificación.' },
  ],
};
export const accionDe = (tipo, como) => (ACCIONES[tipo] ?? []).find((a) => a.como === como) ?? null;

/** «4 u.» / «1,5 kg». */
export const cantTxt = (n, tipoProducto) => `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${tipoProducto === 'granel' ? 'kg' : 'u.'}`;

/** «Faltaron 4 u.» / «Vinieron 2 u. de más». */
export const queTxt = (d) => (d.tipo === 'faltante' ? `Faltaron ${cantTxt(d.cantidad, d.tipoProducto)}` : `Vinieron ${cantTxt(d.cantidad, d.tipoProducto)} de más`);

/** Lo pendiente a costo de una lista: lo que te deben (faltantes) y lo que le debés (lo que vino de más). */
export function totalesPendientes(lista) {
  let teDeben = 0;
  let leDebes = 0;
  for (const d of lista) {
    if (d.estado !== 'pendiente') continue;
    if (d.tipo === 'faltante') teDeben += d.valorPendiente; else leDebes += d.valorPendiente;
  }
  return { teDeben: Math.round(teDeben * 100) / 100, leDebes: Math.round(leDebes * 100) / 100 };
}
