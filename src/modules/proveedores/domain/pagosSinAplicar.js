/**
 * LA PLATA PAGADA SIN APLICAR (17/11/2026, pedido del dueño con BRACEMA).
 * ============================================================================
 * Un pago registrado desde la caja, o «a cuenta», no dice qué factura paga: el
 * saldo del proveedor da 0 pero, en una cuenta «por facturas», cada factura
 * sigue «debiendo» y la pantalla de pago las ofrecía otra vez (pagarlas era
 * pagar dos veces). Dos piezas:
 *
 *  · `repartirPago`: «Aplicar a facturas» en el renglón del pago. Lo que le
 *    queda al pago va a las facturas tildadas, de la más vieja a la más nueva,
 *    cada una por su saldo entero; si no alcanza, la última se lleva TODO lo
 *    que le queda al pago. Es la regla que la API acepta en «por facturas»
 *    (saldo completo, o el pago a cuenta aplicado entero).
 *  · `cubiertoALaCuenta`: lo que la cuenta ya tiene a favor contra sus
 *    documentos (pagos sin aplicar, ajustes) = lo que deben los documentos −
 *    el saldo de la cuenta. Cubre de la más vieja a la más nueva, igual que
 *    Cuentas corrientes (3/11/2026). Es una cuenta, no una marca: anular el
 *    pago la deshace sola.
 */

const EPS = 0.009;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const masViejoPrimero = (a, b) => new Date(a.fecha) - new Date(b.fecha) || a.docId - b.docId;

/** `{ lineas: [{ doc, importe }], sobra, sinAlcanzar: [doc] }` para lo que le queda al pago (`disponible`). */
export function repartirPago(disponible, docs) {
  let queda = r2(disponible);
  const lineas = [];
  const sinAlcanzar = [];
  for (const doc of [...docs].sort(masViejoPrimero)) {
    if (queda <= EPS) { sinAlcanzar.push(doc); continue; }
    const importe = r2(Math.min(doc.saldo, queda));
    lineas.push({ doc, importe });
    queda = r2(queda - importe);
  }
  return { lineas, sobra: queda, sinAlcanzar };
}

/** `{ total, porDoc: Map(clave → cuánto de su saldo ya está cubierto) }`. `clave(doc)` identifica cada documento. */
export function cubiertoALaCuenta(docs, saldoCuenta, clave) {
  const deben = r2(docs.reduce((a, d) => a + d.saldo, 0));
  let queda = saldoCuenta == null ? 0 : r2(Math.max(0, deben - Math.max(0, saldoCuenta)));
  const total = queda;
  const porDoc = new Map();
  for (const d of [...docs].sort(masViejoPrimero)) {
    if (queda <= EPS) break;
    const cubre = r2(Math.min(d.saldo, queda));
    porDoc.set(clave(d), cubre);
    queda = r2(queda - cubre);
  }
  return { total, porDoc };
}
