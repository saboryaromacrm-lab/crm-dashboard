/*
 * LOS CÓDIGOS DE BARRAS DE UN PRODUCTO (0241, 23/11/2026): el actual y los
 * ANTERIORES. Cuando el fabricante cambia el código, la mercadería vieja sigue
 * en la góndola con el de antes: toda búsqueda por código de barras pasa por
 * acá para que la encuentre igual. Sirve para el producto del catálogo de
 * Compras/Almacén y para el renglón del catálogo de la caja (los dos traen
 * `codigoBarras` y `codigosAnteriores`).
 */

/** El código de barras actual y los anteriores, sin vacíos. */
export const codigosDeBarras = (p) => [p?.codigoBarras, ...(p?.codigosAnteriores ?? [])].filter(Boolean);

/** ¿Alguno de sus códigos de barras es exactamente `codigo`? (el escáner) */
export const tieneCodigo = (p, codigo) => !!codigo && codigosDeBarras(p).includes(codigo);

/** ¿Alguno contiene `parte`? (los buscadores: tipear un pedazo del código también encuentra) */
export const codigoContiene = (p, parte) => !!parte && codigosDeBarras(p).some((c) => c.includes(parte));

/** ¿Alguno termina en `final`? (la caja: tipear los últimos dígitos) */
export const codigoTerminaEn = (p, final) => !!final && codigosDeBarras(p).some((c) => c.endsWith(final));
