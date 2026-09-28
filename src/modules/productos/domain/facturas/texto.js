/**
 * LAS DOS MUGRES TÍPICAS DEL TEXTO QUE SALE DE UN PDF, y cómo se limpian.
 * Copia fiel de lo que usaba el servidor (`crm-api/src/facturas/extraccion.ts`):
 * la lectura se mudó al navegador (28/9/2026) y tiene que leer IGUAL.
 */

/**
 * Los PDFs de Tango (y varios más) traen espacios ADENTRO de los números:
 * "87, 731. 41", "1. 00", "00115- 00194842", "04/ 08/ 2026". Se pega solo
 * cuando el separador viene después de un dígito y antes de otro — partes de
 * un mismo número. Pegar de más fusiona números distintos ("1.00 9005.320").
 */
export const pegarNumeros = (s) =>
  String(s ?? '')
    .replace(/(\d[.,\-/]) (?=\d)/g, '$1')
    .replace(/(\d) (?=[.,]\d)/g, '$1')
    .trim();

/** Para comparar texto mugriento: sin espacios, sin acentos, mayúsculas. */
export const clave = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

/**
 * "87, 731. 41" → 87731.41 · "10,00" → 10 · "1.596.319,64" → 1596319.64.
 * El formato cambia dentro de la misma factura: si hay punto y coma, el que
 * aparece ÚLTIMO es el decimal; con solo coma, es decimal si le siguen 1 o 2
 * dígitos.
 */
export function numeroDe(txt) {
  const t = String(txt ?? '').replace(/\s+/g, '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(t)) return null;
  const punto = t.lastIndexOf('.');
  const coma = t.lastIndexOf(',');
  let limpio;
  if (punto >= 0 && coma >= 0) {
    limpio = punto > coma ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  } else if (coma >= 0) {
    limpio = t.length - coma - 1 <= 2 ? t.replace(',', '.') : t.replace(/,/g, '');
  } else {
    limpio = t;
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Todos los números de una línea, ya normalizados. */
export const nums = (t) => (String(t).match(/\d[\d.,]*/g) ?? []).map(numeroDe).filter((n) => n != null);

export const r2 = (n) => Math.round(n * 100) / 100;
