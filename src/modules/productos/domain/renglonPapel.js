/**
 * CÓMO SE CARGA UN RENGLÓN LEÍDO DEL PAPEL (5/11/2026, pedido del dueño con
 * una factura de Bracema: «1 bulto de Cerealitas 45X212G a $1.426,14» entraba
 * como 45 bultos de 45 = 2.025 unidades a $31,69).
 * ============================================================================
 * El alta habla en BULTOS DEL FORMATO del proveedor (la caja de 45). El papel
 * puede hablar en bultos o en unidades, y su precio puede ser por bulto o por
 * unidad. Se carga por unidad cuando:
 *
 *   · el papel trae la columna de BULTOS aparte y las unidades son más que
 *     los bultos (1 bulto → 45 unidades: el P. UNIT es por unidad), o
 *   · el precio impreso se parece al costo POR UNIDAD del formato y no al del
 *     bulto (más cerca de costo/N que de costo, en escala: menos que
 *     costo/N × √N). Es lo que ya se sabe del proveedor —su formato—, así que
 *     la próxima factura igual sale bien sin configurar nada.
 *
 * Por unidad, si las unidades completan bultos enteros se cargan en bultos
 * (45 u. = 1 bulto de 45, a 45 × el precio); si no, en modo «unidad» (30 u.
 * sueltas). Si no, como siempre: la cantidad del papel en bultos del formato.
 * Lo que entra al stock y la plata son los mismos en las dos formas.
 *
 * `costoPapel` es el precio por lo que cuenta `cantidad` (sin descuentos);
 * `costoFormato`, el del bulto en el formato del proveedor (0 si no tiene).
 */
const EPS = 1e-6;

export function cargaDelRenglon({ cantidad, costoPapel, bultosPapel = 0 }, { porBulto, costoFormato = 0 }) {
  const n = Number(porBulto) > 0 ? Number(porBulto) : 1;
  const q = Number(cantidad) || 0;
  const p = Number(costoPapel) || 0;
  const comoSiempre = { bultos: q, porBulto: n, costoBulto: p || null, modo: 'bulto', porUnidad: false };
  if (!(n > 1) || !(p > 0) || !(q > 0)) return comoSiempre;

  const porColumna = Number(bultosPapel) > 0 && q > Number(bultosPapel) + EPS;
  const c = Number(costoFormato) || 0;
  const porPrecio = n > 2 && c > 0 && p < (c / n) * Math.sqrt(n);
  if (!porColumna && !porPrecio) return comoSiempre;

  const k = q / n;
  const entera = Math.round(k) > 0 && Math.abs(k - Math.round(k)) < EPS;
  return entera
    ? { bultos: Math.round(k), porBulto: n, costoBulto: +(p * n).toFixed(4), modo: 'bulto', porUnidad: true }
    : { bultos: q, porBulto: n, costoBulto: p, modo: 'unidad', porUnidad: true };
}
