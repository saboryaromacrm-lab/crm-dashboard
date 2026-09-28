/**
 * LAS PALABRAS DE UNA LÍNEA, CON SU POSICIÓN (28/9/2026)
 * ============================================================================
 * La base del lector automático y del asistente de estructura: cada palabra
 * del renglón con su X de inicio y de fin en la hoja. Con eso se sabe en qué
 * COLUMNA cae cada dato, que es lo único estable de un proveedor a otro.
 *
 * pdf.js entrega fragmentos (a veces una palabra, a veces media línea); acá
 * se parten en palabras repartiendo el ancho del fragmento en proporción a
 * los caracteres, y se vuelven a pegar los números que el PDF partió
 * ("193, 614. 38" → "193,614.38"), igual que `pegarNumeros`.
 */
import { numeroDe } from './texto.js';

/** Un número "limpio": 1.00 · 29,639.3700 · -40.860,01 · $ 61.290,00 · 21% */
const RE_NUMERO = /^[-$]?\$?\d[\d.,]*%?$/;
/** Número con la unidad pegada: "9005.320KG". */
const RE_NUM_UNIDAD = /^(\d[\d.,]*)([A-Za-z]{1,4}\.?)$/;

/** Palabras de un fragmento con su X proporcional. */
function partir(f) {
  const s = String(f.s ?? '');
  const largo = s.length || 1;
  const w = Number(f.w) || 0;
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(s))) {
    out.push({ s: m[0], x0: f.x + (w * m.index) / largo, x1: f.x + (w * (m.index + m[0].length)) / largo });
  }
  return out;
}

/**
 * ¿`a` y `b` son partes de un mismo número que el PDF separó? La regla de
 * `pegarNumeros`, más una condición que el texto plano no tiene: que estén
 * PEGADAS en la hoja (a lo sumo un espacio). Sin eso, "12x250-" de la
 * descripción se pegaba con la cantidad "2.00", que está tres columnas más allá.
 */
const MAX_HUECO = 5;
const seguidas = (a, b) => b.x0 - a.x1 <= MAX_HUECO
  && ((/\d[.,\-/]$/.test(a.s) && /^\d/.test(b.s)) || (/\d$/.test(a.s) && /^[.,]\d/.test(b.s)));

/** Tokens de la línea: [{ s, x0, x1, num, unidad }] en orden visual. */
export function tokensDeLinea(linea) {
  const crudos = [];
  for (const f of linea.frags || []) crudos.push(...partir(f));
  crudos.sort((a, b) => a.x0 - b.x0);
  const pegados = [];
  for (const t of crudos) {
    const prev = pegados[pegados.length - 1];
    if (prev && seguidas(prev, t)) {
      prev.s += t.s;
      prev.x1 = t.x1;
    } else {
      pegados.push({ ...t });
    }
  }
  return pegados.map((t) => {
    const limpio = t.s.replace(/^\$/, '');
    if (RE_NUMERO.test(t.s) || RE_NUMERO.test(limpio)) {
      return { ...t, num: numeroDe(limpio.replace('%', '')), pct: limpio.endsWith('%') };
    }
    const u = t.s.match(RE_NUM_UNIDAD);
    if (u) return { ...t, num: numeroDe(u[1]), unidad: u[2].replace(/\.$/, '') };
    return { ...t, num: null };
  });
}

export const esNumero = (t) => t && t.num != null;
