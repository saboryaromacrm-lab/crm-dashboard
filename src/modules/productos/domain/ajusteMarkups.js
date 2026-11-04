/**
 * AJUSTAR MARKUPS (0218, 4/11/2026) — pedido del dueño: «quiero ajustar
 * markups en alguna lista de precios a productos fraccionados y a
 * determinadas marcas y proveedores».
 * ============================================================================
 * Lo que entra se elige por criterios que se suman (vacío = todos):
 *
 *   · listas de precios, marcas, categorías;
 *   · proveedores: el que FIJA EL PRECIO del producto (decisión del dueño), no
 *     cualquiera que lo venda — es el costo sobre el que corre el markup;
 *   · la forma que se vende: el entero, el granel suelto (el kilo) o los
 *     fraccionados (los paquetes), y de estos, ciertos tamaños.
 *
 * Una fila es la de `producto_listas`: el producto o uno de sus paquetes en
 * una lista. Las de PRECIO DEFINIDO no entran (lo fijó una persona y un % no
 * lo pisa): se cuentan aparte para decirlo.
 *
 * Todo sale del inventario en memoria, sin pedirle nada al servidor; el
 * servidor vuelve a validar cada fila al guardar y guarda el ajuste para
 * poder deshacerlo.
 */
import { etiquetaForma, redondearMarkup } from './margenes.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const FORMAS = [
  { id: 'entero', label: 'Enteros' },
  { id: 'suelto', label: 'Granel suelto (por kg)' },
  { id: 'fraccionado', label: 'Fraccionados (paquetes)' },
];

/** Cómo se mueve el markup. Los mismos tres de la actualización masiva. */
export const REGLAS = [
  { id: 'porcentaje', label: 'Variar un %' },
  { id: 'monto', label: 'Sumar / restar puntos' },
  { id: 'fijar', label: 'Fijar valor' },
];

/** El markup que queda: 40 con +10 % → 44; con +5 puntos → 45; fijar 50 → 50. Nunca negativo. */
export function aplicarRegla(actual, modo, valor) {
  const a = Number(actual) || 0;
  const v = Number(valor) || 0;
  if (modo === 'fijar') return Math.max(0, r2(v));
  if (modo === 'monto') return Math.max(0, r2(a + v));
  return Math.max(0, r2(a * (1 + v / 100)));
}

/** El markup nuevo de una fila, con el redondeo de 5 en 5 si va. */
export const nuevoMarkup = (actual, { modo, valor, redondear }) => {
  const n = aplicarRegla(actual, modo, valor);
  return redondear ? redondearMarkup(n) : n;
};

export const formaDe = (prod, pres) => (pres ? 'fraccionado' : prod?.tipo === 'granel' ? 'suelto' : 'entero');

/** El producto y cada uno de sus paquetes, con las filas de lista de cada uno. */
const formasDe = (p) => [[null, p.listas], ...(p.presentaciones || []).map((pr) => [pr, pr.listas])];

const kgDe = (etiqueta) => {
  const [n, u] = String(etiqueta).split(' ');
  return (Number(n) || 0) * (u === 'g' ? 0.001 : 1);
};

/**
 * Lo que se puede elegir, sacado del catálogo: marcas, categorías, los
 * proveedores que fijan el precio de algo y los tamaños de paquete que existen.
 */
export function opcionesAjuste(productos = [], proveedorDe = () => null) {
  const marcas = new Set();
  const categorias = new Set();
  const proveedores = new Set();
  const tamanos = new Set();
  for (const p of productos) {
    if (p.marca) marcas.add(p.marca);
    if (p.categoria) categorias.add(p.categoria);
    const prov = proveedorDe(p);
    if (prov != null) proveedores.add(prov);
    for (const pr of p.presentaciones || []) tamanos.add(etiquetaForma(p, pr));
  }
  const az = (a, b) => a.localeCompare(b, 'es');
  return {
    marcas: [...marcas].sort(az),
    categorias: [...categorias].sort(az),
    proveedorIds: [...proveedores],
    tamanos: [...tamanos].sort((a, b) => kgDe(a) - kgDe(b)),
  };
}

/**
 * Las filas que entran con estos criterios. `criterios`: { listaIds, marcas,
 * categorias, proveedorIds, forma, tamanos } (arreglos vacíos = todos;
 * `forma` '' = todas). Devuelve las filas de markup y cuántas quedaron afuera
 * por ir con precio definido.
 */
export function filasDelAjuste(productos = [], criterios = {}, proveedorDe = () => null) {
  const { listaIds = [], marcas = [], categorias = [], proveedorIds = [], forma = '', tamanos = [] } = criterios;
  const en = (lista, v) => !lista.length || lista.includes(v);
  const filas = [];
  let aMano = 0;
  for (const p of productos) {
    if (!en(marcas, p.marca || '') || !en(categorias, p.categoria || '')) continue;
    if (proveedorIds.length && !proveedorIds.includes(proveedorDe(p))) continue;
    for (const [pres, listas] of formasDe(p)) {
      if (forma && formaDe(p, pres) !== forma) continue;
      const etiqueta = etiquetaForma(p, pres);
      if (pres && tamanos.length && !tamanos.includes(etiqueta)) continue;
      for (const l of listas || []) {
        if (!l?.id || !en(listaIds, l.listaId)) continue;
        if (l.modoPrecio === 'precio') { aMano += 1; continue; }
        filas.push({ id: l.id, producto: p, presentacion: pres, lista: l, forma: etiqueta, actual: r2(l.markup) });
      }
    }
  }
  return { filas, aMano };
}

/** Las filas que cambian con la regla, con su markup nuevo. */
export function planAjuste(filas = [], regla = {}) {
  if (regla.valor === '' || regla.valor == null || Number.isNaN(Number(regla.valor))) return [];
  return filas
    .map((f) => ({ ...f, nuevo: nuevoMarkup(f.actual, regla) }))
    .filter((f) => Math.abs(f.nuevo - f.actual) >= 0.005);
}

/** Cuánto se mueve un precio: subir más de esto pide mirarlo dos veces. */
export const SUBA_FUERTE = 30;

/** Para la vista previa: si el precio baja o sube fuerte (más de `SUBA_FUERTE` %). */
export function alertaPrecio(antes, despues) {
  if (!(antes > 0)) return null;
  const var_ = ((despues - antes) / antes) * 100;
  if (var_ < -0.005) return 'baja';
  if (var_ > SUBA_FUERTE) return 'fuerte';
  return null;
}

/**
 * Cómo se anota el ajuste («Minorista · Marcas: Alicante, Dos Anclas ·
 * Fraccionados 500 g · +5 puntos, de 5 en 5»): es lo que se lee después en la
 * lista de ajustes y en la evolución de precios.
 */
export function describirAjuste(criterios = {}, regla = {}, nombres = {}) {
  const { listaIds = [], marcas = [], categorias = [], proveedorIds = [], forma = '', tamanos = [] } = criterios;
  const lista = (titulo, xs) => (xs.length ? `${titulo}: ${xs.join(', ')}` : '');
  const formaTxt = forma ? `${FORMAS.find((f) => f.id === forma)?.label ?? forma}${tamanos.length ? ` ${tamanos.join(', ')}` : ''}` : '';
  const v = Number(regla.valor) || 0;
  const reglaTxt = regla.modo === 'fijar' ? `markup ${v} %`
    : regla.modo === 'monto' ? `${v >= 0 ? '+' : ''}${v} puntos`
      : `${v >= 0 ? '+' : ''}${v} % del markup`;
  return [
    listaIds.length ? listaIds.map((id) => nombres.lista?.(id) ?? `Lista ${id}`).join(', ') : 'Todas las listas',
    lista('Marcas', marcas),
    lista('Proveedores', proveedorIds.map((id) => nombres.proveedor?.(id) ?? `#${id}`)),
    lista('Categorías', categorias),
    formaTxt,
    `${reglaTxt}${regla.redondear ? ', de 5 en 5' : ''}`,
  ].filter(Boolean).join(' · ').slice(0, 500);
}
