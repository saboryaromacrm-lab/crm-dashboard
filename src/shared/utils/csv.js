/**
 * EXPORTAR A CSV — un solo lugar para todas las pantallas
 * ============================================================================
 * Dos detalles que parecen menores y no lo son, porque el destino real de estos
 * archivos es Excel en Windows en español:
 *
 *   · BOM al principio (U+FEFF): sin él Excel abre el archivo en su
 *     codificación vieja y "Yerba Orgánica" sale "Yerba OrgÃ¡nica".
 *   · `;` como separador: con coma decimal argentina, la coma ya está ocupada,
 *     así que un CSV separado por comas parte los números en dos columnas.
 *
 * Los números van con `csvNum` (coma decimal) por la misma razón: con punto,
 * Excel en español lee 1.5 como 15.
 */

/** Escapa un valor: entrecomilla si trae `"`, `;` o salto de línea. */
function esc(v) {
  const t = String(v ?? '');
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Número con coma decimal y dos decimales, como lo espera Excel en español. */
export function csvNum(n, dec = 2) {
  return String(Number(n ?? 0).toFixed(dec)).replace('.', ',');
}

/** Arma el CSV y lo baja. `filas` es un array de arrays, en el orden de `encabezados`. */
export function descargarCsv(nombre, encabezados, filas) {
  const cuerpo = [encabezados, ...filas].map((f) => f.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + cuerpo], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * LA VUELTA: lee un CSV armado por `descargarCsv` — mismo `;`, mismo BOM,
 * mismas comillas dobles escapadas (23/9/2026). No sirve para el CSV del
 * sistema de gestión anterior (ese es `parseCsv`, separado por comas): son
 * dos dialectos y cada uno tiene su lector, mezclar los dos en uno solo con
 * un delimitador "adivinado" es la forma de romper los dos el día que se
 * agregue el otro.
 *
 * Devuelve `{ cols, filas }`, con `filas` como objetos `{col: valor}` — la
 * misma forma que ya devuelve `parseCsv`, para que un import pueda leer con
 * cualquiera de los dos sin cambiar cómo consume el resultado.
 */
export function leerCsv(texto) {
  const limpio = texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto;
  const lineas = limpio.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return { cols: [], filas: [] };
  const partir = (linea) => {
    const out = [];
    let cur = '';
    let enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (enComillas) {
        if (ch === '"' && linea[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') enComillas = false;
        else cur += ch;
      } else if (ch === '"') enComillas = true;
      else if (ch === ';') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const cols = partir(lineas[0]).map((c) => c.trim());
  const filas = lineas.slice(1).map((l) => {
    const v = partir(l);
    return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()]));
  });
  return { cols, filas };
}
