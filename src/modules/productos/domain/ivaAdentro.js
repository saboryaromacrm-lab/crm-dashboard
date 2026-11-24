/*
 * FACTURA A CON LOS PRECIOS CON EL IVA ADENTRO (24/11/2026, pedido del dueño).
 *
 * Hay proveedores (Origen / Olivatto) que hacen factura A pero ponen en cada
 * renglón el precio FINAL. El ERP toma los renglones de una A como netos y les
 * suma el IVA: el IVA queda dos veces y los costos suben de más. Se reconoce
 * porque lo cargado como NETO ya da el TOTAL del papel.
 */

/**
 * ¿Los renglones cargados traen el IVA adentro? Sí cuando el neto cargado
 * (más las percepciones del papel) da el total del papel y hay IVA calculado:
 * con precios netos de verdad el neto nunca llega al total.
 */
export function preciosConIvaAdentro({ neto, iva, percepciones = 0, totalPapel, tolerancia }) {
  if (!(totalPapel > 0) || !(iva > tolerancia)) return false;
  return Math.abs(neto + percepciones - totalPapel) <= tolerancia;
}

/** El costo sin el IVA de su alícuota (4 decimales, como los costos del renglón). */
export const sinIva = (costo, alicuota) => +((Number(costo) || 0) / (1 + (Number(alicuota) || 0) / 100)).toFixed(4);
