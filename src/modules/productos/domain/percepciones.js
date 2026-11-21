/**
 * LAS PERCEPCIONES DEL PIE DE UNA FACTURA DE COMPRA
 * ============================================================================
 * De qué impuesto es cada una (0132) y cómo se emparejan las que el proveedor
 * tiene en su ficha con las que trajo el papel.
 */

export const NOMBRE_TIPO_PERC = { iva: 'IVA', iibb: 'Ingresos Brutos', otro: 'Otro impuesto' };

/* De qué impuesto es, por el nombre: la MISMA regla del servidor (crm-api
 * common/iva.ts), que es la que usa Gerencia › Métricas › Resultados IVA. */
export function tipoSegunNombre(nombre) {
  const n = String(nombre ?? '').toLowerCase();
  if (/(^|[^a-z])iva([^a-z]|$)|rg\s*(2408|3337|5329)/.test(n)) return 'iva';
  if (/iibb|ingresos\s*brutos|(^|[^a-z])dgr([^a-z]|$)|(^|[^a-z])ib([^a-z]|$)/.test(n)) return 'iibb';
  return 'otro';
}

/** Manda la marca de la ficha; sin marca, el nombre. */
export const tipoDe = (p) => (['iva', 'iibb', 'otro'].includes(p?.tipo) ? p.tipo : tipoSegunNombre(p?.nombre));

/* El nombre sin las palabras que llevan todas («Percepción», «Perc.», «Per»…): si no, «Percepción» a secas «contiene» a cualquiera. */
const GENERICAS = new Set(['PERCEPCION', 'PERCEPCIONES', 'PERCEP', 'PERC', 'PER', 'RETENCION', 'RET', 'IMPUESTO', 'IMP', 'DE', 'DEL', 'LA', 'EL', 'A', 'S']);
const clave = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  .split(/[^A-Z0-9]+/).filter((w) => w && !GENERICAS.has(w)).join('');
const mismoNombre = (a, b) => {
  const x = clave(a); const y = clave(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};
const mismaAlicuota = (a, b) => Number(a.alicuota) > 0 && Number(a.alicuota) === Number(b.alicuota);
/** La única de la lista que cumple, o null si hay ninguna o más de una (en la duda, no se adivina). */
const unica = (lista, cumple) => {
  const hay = lista.filter(cumple);
  return hay.length === 1 ? hay[0] : null;
};

/**
 * EMPAREJAR LAS DEL PROVEEDOR CON LAS DEL PAPEL (21/11/2026). Antes alcanzaba
 * la misma alícuota: en una factura de La Serenísima con «Percepción IVA» 3 %
 * e «IIBB Formosa» 3 %, la de IVA de la ficha podía quedarse con el importe de
 * IIBB si venía primera en el papel. Ahora, para cada una de la ficha:
 *  1. el nombre (uno contiene al otro);
 *  2. si no, el mismo impuesto: la única del papel de ese impuesto o, si hay
 *     varias, la única de ese impuesto con la misma alícuota;
 *  3. una de la ficha sin impuesto reconocible («Percepción 3 %»): la única
 *     del papel con su alícuota.
 * Cada una del papel se usa una sola vez. Las que quedan sin pareja
 * (`sueltas`) son percepciones que el proveedor todavía no tiene en su ficha.
 *
 * Devuelve `pares` (índice de la ficha → la del papel) y `sueltas`.
 */
export function emparejarPercepciones(delProveedor, delPapel) {
  const libres = [...(delPapel ?? [])];
  const pares = new Map();
  const tomar = (i, x) => { pares.set(i, x); libres.splice(libres.indexOf(x), 1); };
  (delProveedor ?? []).forEach((p, i) => {
    const porNombre = libres.find((x) => mismoNombre(x.nombre, p.nombre));
    if (porNombre) { tomar(i, porNombre); return; }
    const tipo = tipoDe(p);
    const delImpuesto = libres.filter((x) => tipoSegunNombre(x.nombre) === tipo);
    const porImpuesto = tipo !== 'otro'
      ? (delImpuesto.length === 1 ? delImpuesto[0] : unica(delImpuesto, (x) => mismaAlicuota(x, p)))
      : unica(libres, (x) => mismaAlicuota(x, p));
    if (porImpuesto) tomar(i, porImpuesto);
  });
  return { pares, sueltas: libres };
}
