/**
 * ALMACÉN › INGRESOS — lo puro de la pantalla.
 *
 * La nota de un pedido que salió de una orden de pedido (OrdenPedidoModal) es la
 * lista: «Pedido - quién - fecha», un renglón por producto («Nombre — 3 bultos»)
 * y, desde el 22/10, la línea «Total: 33 bultos · 675 unidades». Plegada, la fila
 * muestra ese total; si no está, lo cuenta de los renglones; si la nota no es una
 * orden, su primera línea útil recortada.
 */
const LARGO = 90;
const n = (t) => Number(String(t).replace(/\./g, '').replace(',', '.')) || 0;
const cifra = (v) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 });

/** Los renglones de la orden: «— 3 bultos», «— 40 u.», «— 2 bolsas», «— 5 kg». */
function contarRenglones(t) {
  const suma = { productos: 0, bultos: 0, u: 0, bolsas: 0, kg: 0 };
  for (const m of t.matchAll(/— ([\d.,]+) (bultos?|u\.|bolsas?|kg)/g)) {
    suma.productos += 1;
    const clave = m[2].startsWith('bulto') ? 'bultos' : m[2].startsWith('bolsa') ? 'bolsas' : m[2] === 'u.' ? 'u' : 'kg';
    suma[clave] += n(m[1]);
  }
  if (!suma.productos) return '';
  return [
    `${suma.productos} producto${suma.productos === 1 ? '' : 's'}`,
    suma.bultos && `${cifra(suma.bultos)} bulto${suma.bultos === 1 ? '' : 's'}`,
    suma.u && `${cifra(suma.u)} u.`,
    suma.bolsas && `${cifra(suma.bolsas)} bolsa${suma.bolsas === 1 ? '' : 's'}`,
    suma.kg && `${cifra(suma.kg)} kg`,
  ].filter(Boolean).join(' · ');
}

export function resumenNota(notas) {
  const t = String(notas ?? '').trim();
  if (!t) return '';
  /* Las partes que escribe `totalesPedido` (domain/bulto.js): bultos, unidades, bolsas y kg. */
  const total = /Total:\s*((?:[\d.,]+\s*(?:bultos?|unidad(?:es)?|bolsas?|kg)\s*·?\s*)+)/i.exec(t);
  if (total) return `Total: ${total[1].replace(/[\s·]+$/, '')}`;
  const contado = contarRenglones(t);
  if (contado) return contado;
  const primera = t.split('\n').map((l) => l.trim()).find((l) => l && !/^Pedido - /.test(l)) ?? t.split('\n')[0].trim();
  return primera.length > LARGO ? `${primera.slice(0, LARGO - 1).trimEnd()}…` : primera;
}
