/*
 * ¿EL PRODUCTO ELEGIDO ES EL DEL PAPEL? (24/11/2026, pedido del dueño): la IA
 * (o un mapeo aprendido mal) puede atar «Premezcla Verde x 1000 g» a «Gallet
 * Saladitas x100g». Dos controles baratos y sin falsos positivos ruidosos:
 *   · el NOMBRE: si no comparten ninguna palabra con contenido (sin la marca
 *     ni el nombre del proveedor, que se repiten en todo), no es el mismo;
 *   · el PESO: si los dos dicen cuánto pesan (o cuánto miden) y no coincide.
 */

const VACIAS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'con', 'sin', 'para', 'por', 'en', 'y', 'x', 'u', 'un', 'una',
  'sabor', 'unidad', 'unidades', 'pack', 'caja', 'bolsa', 'bolsas', 'paquete', 'kg', 'kgs', 'gr', 'grs', 'ml', 'lt', 'lts',
]);

const normal = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Las palabras que dicen QUÉ es: sin números, sin palabras vacías, de 3 letras o más. */
export function palabras(texto, ignorar = new Set()) {
  return normal(texto).split(/[^a-zñ0-9]+/)
    .filter((w) => w.length >= 3 && !/\d/.test(w) && !VACIAS.has(w) && !ignorar.has(w));
}

/** Una palabra coincide con otra si es igual o una abrevia a la otra («gallet» / «galletitas»). */
const coincide = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

const UNIDADES = { kg: ['g', 1000], kgs: ['g', 1000], k: ['g', 1000], g: ['g', 1], gr: ['g', 1], grs: ['g', 1], gramos: ['g', 1], ml: ['ml', 1], cc: ['ml', 1], l: ['ml', 1000], lt: ['ml', 1000], lts: ['ml', 1000], litro: ['ml', 1000], litros: ['ml', 1000] };

/** El peso o el volumen que dice el texto, en g o ml («x1kg» → 1000 g; «6X450G» → 450 g). */
export function pesoDe(texto) {
  const m = normal(texto).match(/(\d+(?:[.,]\d+)?)\s*(kgs?|k|grs?|gramos|g|ml|cc|lts?|litros?|l)(?![a-z])/);
  if (!m) return null;
  const [unidad, factor] = UNIDADES[m[2]];
  return { valor: Number(m[1].replace(',', '.')) * factor, unidad };
}

const textoPeso = (p) => (p.valor >= 1000 ? `${p.valor / 1000} ${p.unidad === 'g' ? 'kg' : 'l'}` : `${p.valor} ${p.unidad}`);

/**
 * Las dudas de atar el renglón del papel `descripcion` al producto `nombre`
 * (vacío si no hay ninguna). `ignorar`: la marca del producto y el nombre del
 * proveedor, que aparecen en muchos productos y no prueban nada.
 */
export function dudasDelProducto(descripcion, nombre, ignorar = []) {
  const fuera = new Set(ignorar.flatMap((t) => palabras(t)));
  const delPapel = palabras(descripcion, fuera);
  const delProducto = palabras(nombre, fuera);
  const dudas = [];
  if (delPapel.length && delProducto.length && !delPapel.some((a) => delProducto.some((b) => coincide(a, b)))) {
    dudas.push('el nombre no se parece al del papel');
  }
  const pp = pesoDe(descripcion);
  const pr = pesoDe(nombre);
  if (pp && pr && pp.unidad === pr.unidad && Math.abs(pp.valor - pr.valor) > pp.valor * 0.01) {
    dudas.push(`el papel dice ${textoPeso(pp)} y el producto ${textoPeso(pr)}`);
  }
  return dudas;
}
