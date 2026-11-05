/**
 * LO CARGADO A MANO, AGRUPADO POR LO QUE ESCRIBIERON (5/11/2026). «CARAMELOS»,
 * «caramelos» y «Caramelos » son lo mismo: se juntan sin mayúsculas, acentos
 * ni espacios de más, y se muestra el texto más usado. Sirve para ver qué
 * productos faltan dar de alta (o los cajeros no encuentran).
 */
export const claveTexto = (t) => String(t ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const r2 = (n) => Math.round(n * 100) / 100;

export function agruparAMano(filas) {
  const grupos = new Map();
  for (const x of filas) {
    const k = claveTexto(x.concepto);
    let g = grupos.get(k);
    if (!g) {
      g = { clave: k, textos: new Map(), veces: 0, cobrado: 0, min: Infinity, max: -Infinity, cajeros: new Set(), locales: new Set(), ultima: x.fecha };
      grupos.set(k, g);
    }
    g.textos.set(x.concepto, (g.textos.get(x.concepto) ?? 0) + 1);
    g.veces += 1;
    g.cobrado = r2(g.cobrado + x.cobrado);
    if (x.cobrado > 0) { g.min = Math.min(g.min, x.cobrado); g.max = Math.max(g.max, x.cobrado); }
    if (x.cajero) g.cajeros.add(x.cajero);
    if (x.sucursal) g.locales.add(x.sucursal);
    if (new Date(x.fecha) > new Date(g.ultima)) g.ultima = x.fecha;
  }
  return [...grupos.values()].map((g) => ({
    clave: g.clave,
    texto: [...g.textos.entries()].sort((a, b) => b[1] - a[1])[0][0],
    veces: g.veces,
    cobrado: g.cobrado,
    min: Number.isFinite(g.min) ? g.min : null,
    max: Number.isFinite(g.max) ? g.max : null,
    cajeros: [...g.cajeros].sort(),
    locales: [...g.locales].sort(),
    ultima: g.ultima,
  })).sort((a, b) => b.cobrado - a.cobrado || a.texto.localeCompare(b.texto, 'es'));
}
