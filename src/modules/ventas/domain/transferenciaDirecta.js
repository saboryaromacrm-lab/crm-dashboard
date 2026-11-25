/**
 * LA TRANSFERENCIA QUE FUE DIRECTO A UN PROVEEDOR (0246, 25/11/2026, pedido
 * del dueño). El importe es el del renglón de la venta: no se elige. Se reparte
 * entre los documentos tildados con la MISMA regla que «Aplicar a facturas»
 * (`repartirPago`): del más viejo al más nuevo, cada uno por su saldo entero y
 * el último llevándose lo que quede. Lo que sobra queda a cuenta del proveedor.
 */
import { repartirPago } from '../../proveedores/domain/pagosSinAplicar.js';

/**
 * `{ lineas, aCuenta, sinAlcanzar, mezcla, imputaciones }`. `sinAlcanzar`: los
 * tildados a los que ya no les llega nada (hay que destildarlos). `mezcla`: hay
 * gastos y facturas de mercadería a la vez (un pago vive en una sola bandeja).
 */
export function planTransferencia(importe, elegidos) {
  const mezcla = elegidos.some((d) => d.tipo === 'gasto') && elegidos.some((d) => d.tipo !== 'gasto');
  const { lineas, sobra, sinAlcanzar } = repartirPago(importe, elegidos);
  return {
    lineas,
    aCuenta: sobra,
    sinAlcanzar,
    mezcla,
    imputaciones: lineas.map(({ doc, importe: i }) => (doc.tipo === 'gasto'
      ? { gastoId: doc.docId, importe: i }
      : { comprobanteId: doc.docId, importe: i })),
  };
}
