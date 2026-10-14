/**
 * VENTAS › VARIACIONES (14/10/2026, pedido del dueño) — la cuenta, en un lugar.
 * ============================================================================
 * La API manda una fila por (producto, sucursal, lista) con lo vendido en los
 * dos períodos (A = ahora, B = antes), en cantidad y en plata neta. Acá se
 * filtra, se agrupa y se compara al instante: cambiar un filtro, el «ver por»,
 * la medida o el umbral no vuelve a pedir nada.
 *
 *   · Cantidad: unidades los enteros y kg el granel, SIEMPRE por separado
 *     (sumar kilos con unidades no significa nada).
 *   · Variación: (A − B) ÷ B. Sin venta antes y con venta ahora es «nuevo»
 *     (no hay % posible); con venta antes y nada ahora, «dejó de venderse».
 *   · Los filtros son DINÁMICOS: cada desplegable cuenta los productos que
 *     quedarían con los OTROS filtros puestos.
 */
const EPS = 1e-6;
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Por qué se puede agrupar y filtrar. `dic`: el diccionario de nombres que manda la API. */
export const DIMENSIONES = {
  producto: { label: 'Producto', clave: (f) => [f.p.id] },
  marca: { label: 'Marca', dic: 'marcas', sin: 'Sin marca', clave: (f) => [f.p.marca] },
  categoria: { label: 'Categoría', dic: 'categorias', sin: 'Sin categoría', clave: (f) => [f.p.categoria] },
  subcategoria: { label: 'Subcategoría', dic: 'subcategorias', sin: 'Sin subcategoría', clave: (f) => [f.p.subcategoria] },
  /* Un producto con dos etiquetas suma en las dos: el total general no se toca. */
  etiqueta: { label: 'Etiqueta', dic: 'etiquetas', sin: 'Sin etiqueta', clave: (f) => (f.p.etiquetas.length ? f.p.etiquetas : [0]) },
  proveedor: { label: 'Proveedor', dic: 'proveedores', sin: 'Sin proveedor', clave: (f) => [f.p.proveedor] },
  sucursal: { label: 'Sucursal', dic: 'sucursales', sin: 'Sin sucursal', clave: (f) => [f.s] },
  lista: { label: 'Lista de precios', dic: 'listas', sin: 'Sin lista', clave: (f) => [f.l] },
};

const TIPO = { label: 'Tipo', clave: (f) => [f.p.granel ? 'granel' : 'entero'], nombre: (k) => (k === 'granel' ? 'Granel' : 'Enteros') };
/** Los filtros, en el orden de la pantalla. */
export const FILTRABLES = ['sucursal', 'lista', 'tipo', 'marca', 'categoria', 'subcategoria', 'etiqueta', 'proveedor'];
const dimDe = (d) => (d === 'tipo' ? TIPO : DIMENSIONES[d]);

export const MEDIDAS = {
  plata: { label: 'Plata', a: 'va', b: 'vb' },
  unidades: { label: 'Unidades', a: 'ua', b: 'ub' },
  kilos: { label: 'Kilos', a: 'ka', b: 'kb' },
};

/** Cómo varió una medida. null = ni antes ni ahora: no hay nada que comparar. */
export function variar(a, b, umbral = 10) {
  if (Math.abs(a) < EPS && Math.abs(b) < EPS) return null;
  const dif = a - b;
  if (b < EPS) return { dif, pct: null, estado: a > EPS ? 'nuevo' : 'igual' };
  const pct = (dif / b) * 100;
  const estado = a < EPS ? 'dejo' : pct >= umbral ? 'sube' : pct <= -umbral ? 'baja' : 'igual';
  return { dif, pct, estado };
}

/** La respuesta de la API, lista para recorrer (una vez por pedido). */
export function prepararVariaciones(datos) {
  if (!datos) return null;
  const prod = new Map((datos.productos ?? []).map(([id, nombre, granel, marca, categoria, subcategoria, proveedor, etiquetas]) => [id, {
    id, nombre, granel: !!granel, marca: marca ?? 0, categoria: categoria ?? 0, subcategoria: subcategoria ?? 0,
    proveedor: proveedor ?? 0, etiquetas: etiquetas ?? [], busca: norm(nombre),
  }]));
  const filas = (datos.filas ?? []).map(([p, s, l, qa, qb, va, vb]) => ({
    p: prod.get(p) ?? { id: p, nombre: 'Producto eliminado', granel: false, marca: 0, categoria: 0, subcategoria: 0, proveedor: 0, etiquetas: [], busca: '' },
    s, l, qa, qb, va, vb,
  }));
  return { filas, nombres: datos.nombres ?? {} };
}

const acum = () => ({ ua: 0, ub: 0, ka: 0, kb: 0, va: 0, vb: 0 });
function sumar(x, f) {
  if (f.p.granel) { x.ka += f.qa; x.kb += f.qb; } else { x.ua += f.qa; x.ub += f.qb; }
  x.va += f.va; x.vb += f.vb;
}
const conVariacion = (x, umbral) => ({
  ...x, v: Object.fromEntries(Object.entries(MEDIDAS).map(([k, m]) => [k, variar(x[m.a], x[m.b], umbral)])),
});

/** El nombre de una clave de una dimensión (0 = «Sin …»). */
export function nombreDe(prep, dim, k) {
  if (dim === 'tipo') return TIPO.nombre(k);
  const d = DIMENSIONES[dim];
  return k ? prep.nombres[d.dic]?.[k] ?? `#${k}` : d.sin;
}

/* ---------------------------- el orden ---------------------------- */
const orden = (cmp) => (a, b) => cmp(a, b) || a.nombre.localeCompare(b.nombre, 'es');
/** Los vacíos (sin nada que comparar en esa medida) siempre al final. */
const porNumero = (val, sentido) => orden((a, b) => {
  const x = val(a); const y = val(b);
  if (x == null || y == null) return (x == null) - (y == null);
  return sentido * (y - x);
});
const pctDe = (m) => (g) => { const v = g.v[m]; return v == null ? null : v.estado === 'nuevo' ? Infinity : v.pct; };
const difDe = (m) => (g) => g.v[m]?.dif ?? null;
export const ORDENES = {
  sube: { label: 'Más subió (%)', cmp: (m) => porNumero(pctDe(m), 1) },
  baja: { label: 'Más bajó (%)', cmp: (m) => porNumero(pctDe(m), -1) },
  subeMonto: { label: 'Más subió (en monto)', cmp: (m) => porNumero(difDe(m), 1) },
  bajaMonto: { label: 'Más bajó (en monto)', cmp: (m) => porNumero(difDe(m), -1) },
  vendido: { label: 'Más vendido ahora', cmp: (m) => porNumero((g) => g[MEDIDAS[m].a], 1) },
  nombre: { label: 'Nombre', cmp: () => orden(() => 0) },
};

/**
 * @param prep      `prepararVariaciones(datos)`
 * @param opciones  { verPor, filtros: { [FILTRABLES]: '' | valor }, buscar, medida, umbral, orden }
 * @returns { resumen, grupos, opciones } — `opciones[filtro]`: [{ valor, nombre, n }] (n = productos)
 */
export function analizarVariaciones(prep, { verPor: pedido = 'producto', filtros = {}, buscar = '', medida = 'plata', umbral = 10, orden: ord = 'sube' } = {}) {
  if (!prep) return null;
  const verPor = DIMENSIONES[pedido] ? pedido : 'producto';
  const t = norm(buscar.trim());
  const sel = FILTRABLES.filter((d) => filtros[d] !== undefined && filtros[d] !== '');
  const cuentas = Object.fromEntries(FILTRABLES.map((d) => [d, new Map()]));
  const contar = (d, f) => {
    for (const k of dimDe(d).clave(f)) {
      const m = cuentas[d];
      if (!m.has(k)) m.set(k, new Set());
      m.get(k).add(f.p.id);
    }
  };

  const total = acum();
  const grupos = new Map();
  const dim = DIMENSIONES[verPor];
  for (const f of prep.filas) {
    if (t && !f.p.busca.includes(t)) continue;
    const fallan = sel.filter((d) => !dimDe(d).clave(f).some((k) => String(k) === String(filtros[d])));
    if (fallan.length > 1) continue;
    if (fallan.length === 1) { contar(fallan[0], f); continue; }
    for (const d of FILTRABLES) contar(d, f);
    sumar(total, f);
    for (const k of dim.clave(f)) {
      let g = grupos.get(k);
      if (!g) {
        g = verPor === 'producto'
          ? { clave: k, nombre: f.p.nombre, producto: f.p, ...acum() }
          : { clave: k, nombre: nombreDe(prep, verPor, k), ...acum(), items: new Map() };
        grupos.set(k, g);
      }
      sumar(g, f);
      if (g.items) {
        let it = g.items.get(f.p.id);
        if (!it) { it = { clave: f.p.id, nombre: f.p.nombre, producto: f.p, ...acum() }; g.items.set(f.p.id, it); }
        sumar(it, f);
      }
    }
  }

  const lista = [...grupos.values()].map((g) => conVariacion(g, umbral)).sort(ORDENES[ord]?.cmp(medida) ?? ORDENES.sube.cmp(medida));
  const resumen = { ...conVariacion(total, umbral), grupos: lista.length, sube: 0, baja: 0, igual: 0, nuevo: 0, dejo: 0, mayorSuba: null, mayorBaja: null };
  for (const g of lista) {
    const v = g.v[medida];
    if (!v) continue;
    resumen[v.estado] += 1;
    if (v.dif > EPS && (!resumen.mayorSuba || v.dif > resumen.mayorSuba.v[medida].dif)) resumen.mayorSuba = g;
    if (v.dif < -EPS && (!resumen.mayorBaja || v.dif < resumen.mayorBaja.v[medida].dif)) resumen.mayorBaja = g;
  }

  const opciones = Object.fromEntries(FILTRABLES.map((d) => {
    const ops = [...cuentas[d]].map(([k, s]) => ({ valor: String(k), nombre: nombreDe(prep, d, k), n: s.size }));
    // Lo elegido queda en el desplegable aunque ya no tenga productos.
    if (filtros[d] && !ops.some((o) => o.valor === String(filtros[d]))) ops.push({ valor: String(filtros[d]), nombre: nombreDe(prep, d, d === 'tipo' ? filtros[d] : Number(filtros[d])), n: 0 });
    return [d, ops.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))];
  }));
  return { resumen, grupos: lista, opciones };
}

/** Los productos de un grupo, con la misma cuenta y el mismo orden (solo al abrirlo). */
export function detalleGrupo(grupo, { medida = 'plata', umbral = 10, orden: ord = 'sube' } = {}) {
  return [...(grupo.items?.values() ?? [])].map((x) => conVariacion(x, umbral)).sort(ORDENES[ord]?.cmp(medida) ?? ORDENES.sube.cmp(medida));
}
