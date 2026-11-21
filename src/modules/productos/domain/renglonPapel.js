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

/*
 * EL PRODUCTO NUEVO QUE NACE DE UN RENGLÓN (21/11/2026, crear el producto desde
 * la carga de la factura). El Formato de Compra guarda el costo del BULTO y
 * cuántas unidades (o kg) trae, así que el alta tiene que saber las dos cosas;
 * si no, nace con «bulto de 1» y el costo de la caja, y cada unidad vale N veces
 * más. Del papel se deduce así, en este orden:
 *
 *   1. la columna de BULTOS: «45 unidades en 1 bulto» → bulto de 45, y el
 *      precio impreso es por unidad (el bulto cuesta 45 veces eso);
 *   2. el IMPORTE: si solo cierra con N unidades por bulto («2 PACK a $13.632,30
 *      −8 −18 = $246.820,97» cierra con 12), el bulto es N y `costoBulto` (el
 *      importe repartido entre los bultos) ya es el del bulto. N puede no ser
 *      entero: «X 22,680 KG» → bulto de 22,68 kg (granel);
 *   3. el NOMBRE: «560G X14U», «Bulto x 72u.» → bulto de 14 / 72, al precio del
 *      renglón (que entonces es el del bulto).
 *
 * Sin nada de eso, bulto de 1. Es una PROPUESTA: el alta la muestra con el costo
 * por unidad al lado, para que la persona la confirme o la corrija.
 */
const r3 = (n) => Math.round(n * 1000) / 1000;
const redondearBulto = (k) => (Math.abs(k - Math.round(k)) <= 0.01 * k ? Math.round(k) : r3(k));
const BULTO_EN_NOMBRE = /\bx\s*(\d{1,4})\s*(?:u|un|und|unid|unidades)\b/i;

export function bultoDelRenglon({ cantidad, costoBulto, precioUnitario, bultosPapel = 0, descripcion = '' }) {
  const q = Number(cantidad) || 0;
  const c = Number(costoBulto) || 0;
  const pu = Number(precioUnitario) || 0;
  const b = Number(bultosPapel) || 0;
  if (b > 0 && q > b + EPS) {
    const n = redondearBulto(q / b);
    return { bulto: n, costo: +(c * n).toFixed(4), por: 'bultos' };
  }
  if (pu > 0 && c > 0 && c / pu > 1.01) return { bulto: redondearBulto(c / pu), costo: c, por: 'importe' };
  const m = BULTO_EN_NOMBRE.exec(descripcion || '');
  if (m && Number(m[1]) > 1) return { bulto: Number(m[1]), costo: c, por: 'nombre' };
  return { bulto: 1, costo: c, por: null };
}

/** El nombre del papel sin la cola de lote y vencimiento que algunos proveedores le pegan («… - +IC04 113163 K BS.AS 11/06/2026»). */
export function nombreDelRenglon(descripcion) {
  return String(descripcion || '')
    .replace(/\s+-\s+\+.*$/, '')
    .replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, '')
    .trim();
}
