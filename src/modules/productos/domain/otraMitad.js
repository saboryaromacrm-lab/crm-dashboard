/*
 * LA OTRA MITAD DE UNA COMPRA MITAD Y MITAD (21/11/2026).
 *
 * El proveedor que entrega la mitad con factura A y la otra con liquidación
 * cobra casi siempre el mismo neto en los dos papeles. Si no, cada papel pisa
 * el costo del otro: «Impacto en precios» lo avisa con esta comparación.
 */

/**
 * El neto por unidad de este papel contra el de su otra mitad. `null` si dan
 * igual (medio punto de tolerancia, el mismo de Impacto en precios).
 * `ivaAdentro`: la liquidación sale más cara justo por una alícuota de IVA.
 */
export function contraLaOtraMitad(netoPapel, netoOtra, esLiquidacion) {
  if (!(netoPapel > 0) || !(netoOtra > 0)) return null;
  const variacion = (netoPapel / netoOtra - 1) * 100;
  if (Math.abs(variacion) < 0.5) return null;
  const liquidacion = esLiquidacion ? netoPapel : netoOtra;
  const factura = esLiquidacion ? netoOtra : netoPapel;
  const sobre = (liquidacion / factura - 1) * 100;
  const ivaAdentro = [21, 10.5].some((a) => Math.abs(sobre - a) < 0.6);
  return { netoPapel, variacion, ivaAdentro };
}

/**
 * EL «SIN FACTURA %» DE UN PRODUCTO CONTRA EL DE SU PROVEEDOR (25/11/2026,
 * pedido del dueño). El costo lo mezcla el % del formato de compra, no el de la
 * ficha (que solo precarga los formatos nuevos): un producto que quedó en 0 %
 * con el proveedor en 50 % sale con el IVA entero, se carguen bien o no los
 * dos papeles. `null` si dan igual (cinco centésimos de tolerancia).
 */
export function porcDistintoDeLaFicha(porcFormato, porcFicha) {
  const formato = Number(porcFormato) || 0;
  const ficha = Number(porcFicha) || 0;
  return Math.abs(formato - ficha) > 0.05 ? { formato, ficha } : null;
}
