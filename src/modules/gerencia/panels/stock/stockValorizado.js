/**
 * GERENCIA › STOCK VALORIZADO — filtros, orden, totales, ABC y agrupado (17/11/2026).
 * ============================================================================
 * La API manda todos los artículos con stock (unos pocos miles como mucho) y
 * acá se filtra, se ordena, se agrupa y se vuelve a sumar al instante. Los
 * totales siguen a los filtros: «¿cuánta plata tengo en Arcor?» es elegir la
 * marca y mirar arriba. Lo de uso exclusivo de Coffit nunca suma a la plata propia.
 */

export const ESTADOS_STOCK = {
  parado: { label: 'Parado', desc: 'Sin ventas en la ventana elegida', color: 'var(--crm-color-danger)' },
  por_agotarse: { label: 'Por agotarse', desc: 'Menos de 7 días de stock al ritmo actual', color: 'var(--crm-color-warning, #b45309)' },
  sobrestock: { label: 'Sobrestock', desc: 'Más de 180 días de stock al ritmo actual', color: 'var(--crm-color-warning, #b45309)' },
  ok: { label: 'Rota bien', desc: 'Entre 7 y 180 días de stock', color: 'var(--crm-color-success)' },
};

/**
 * CLASIFICACIÓN ABC: de mayor a menor plata, los artículos que juntan el
 * primer 80 % son A (los que conviene contar y cuidar más), el 15 % que sigue
 * B y la cola C. Se calcula sobre todo el stock del local elegido, no sobre lo
 * filtrado: un artículo es A del negocio, se lo mire como se lo mire.
 */
export const CLASES_ABC = {
  A: { hasta: 80, desc: 'Juntan el 80 % de la plata: contarlos y reponerlos con más cuidado' },
  B: { hasta: 95, desc: 'El 15 % de la plata que sigue' },
  C: { hasta: 100, desc: 'La cola: muchos artículos, poca plata' },
};

/** Columnas por las que se ordena la lista. La primera vez, de mayor a menor (el nombre, de la A a la Z). */
export const ORDENES = {
  valor: { primero: 'desc', de: (x) => x.valor },
  venta: { primero: 'desc', de: (x) => x.valorVenta },
  stock: { primero: 'desc', de: (x) => x.stock },
  costo: { primero: 'desc', de: (x) => x.costoUnitario },
  vendido: { primero: 'desc', de: (x) => x.vendido },
  dias: { primero: 'desc', de: (x) => x.diasDeStock },
  nombre: { primero: 'asc', de: (x) => x.nombre },
};

/** Las de la vista agrupada (ver `agruparStock`). */
export const ORDENES_GRUPO = {
  valor: { primero: 'desc', de: (x) => x.valor },
  venta: { primero: 'desc', de: (x) => x.venta },
  articulos: { primero: 'desc', de: (x) => x.articulos },
  margen: { primero: 'desc', de: (x) => x.margenPotencialPct },
  parado: { primero: 'desc', de: (x) => x.parado },
  rotacion: { primero: 'desc', de: (x) => x.rotacion },
  rinde: { primero: 'desc', de: (x) => x.rinde },
  nombre: { primero: 'asc', de: (x) => x.nombre },
};

/** Por qué se puede agrupar: el id que filtra y el nombre que se muestra. */
export const AGRUPAR = {
  proveedor: { label: 'Por proveedor', columna: 'Proveedor', id: 'proveedorId', nombre: 'proveedor', sin: 'Sin proveedor' },
  marca: { label: 'Por marca', columna: 'Marca', id: 'marcaId', nombre: 'marca', sin: 'Sin marca' },
  categoria: { label: 'Por categoría', columna: 'Categoría', id: 'categoriaId', nombre: 'categoria', sin: 'Sin categoría' },
};

const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Los valores de un filtro de lista: '' = todos; '0' = «sin …» (sin proveedor, sin marca, sin categoría). */
const coincide = (elegido, id) => !elegido || (elegido === '0' ? id == null : String(id) === elegido);

const FALTA = {
  costo: (x) => !(x.costoUnitario > 0),
  precio: (x) => x.valorVenta == null,
};

/** Marca la clase ABC de cada artículo propio (lo de Coffit queda sin clase). */
export function marcarAbc(filas) {
  const propias = filas.filter((x) => !x.deCoffit).sort((a, b) => b.valor - a.valor);
  const total = propias.reduce((t, x) => t + x.valor, 0);
  const clase = new Map();
  let antes = 0;
  for (const x of propias) {
    const p = total > 0 ? (antes / total) * 100 : 100;
    clase.set(x.productoId, p < CLASES_ABC.A.hasta ? 'A' : p < CLASES_ABC.B.hasta ? 'B' : 'C');
    antes += x.valor;
  }
  return filas.map((x) => ({ ...x, abc: clase.get(x.productoId) ?? null }));
}

/**
 * `f`: { proveedor, marca, categoria, tipo ('' | 'granel' | 'entero'), estado, abc, falta ('' | 'costo' | 'precio'), q }.
 */
export function filtrarStock(filas, f = {}) {
  const txt = sinAcentos(f.q).trim();
  return filas.filter((x) => coincide(f.proveedor, x.proveedorId)
    && coincide(f.marca, x.marcaId)
    && coincide(f.categoria, x.categoriaId)
    && (!f.tipo || (f.tipo === 'granel' ? x.tipo === 'granel' : x.tipo !== 'granel'))
    && (!f.estado || x.estado === f.estado)
    && (!f.abc || x.abc === f.abc)
    && (!f.falta || (!x.deCoffit && FALTA[f.falta]?.(x)))
    && (!txt || [x.nombre, x.marca, x.categoria, x.proveedor].some((t) => sinAcentos(t).includes(txt))));
}

/** `orden`: { col, dir }. Lo que no tiene dato (días de stock de lo que no se vende, venta sin precio) va siempre al final. */
export function ordenarStock(filas, { col = 'valor', dir = 'desc' } = {}, tabla = ORDENES) {
  const de = (tabla[col] ?? tabla.valor).de;
  const signo = dir === 'asc' ? 1 : -1;
  return [...filas].sort((a, b) => {
    const va = de(a); const vb = de(b);
    if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
    const c = typeof va === 'string' ? va.localeCompare(vb, 'es') : va - vb;
    return c * signo || b.valor - a.valor;
  });
}

/** Clic en una columna: si ya era esa, da vuelta el sentido; si no, arranca por su sentido natural. */
export function siguienteOrden(actual, col, tabla = ORDENES) {
  if (actual.col === col) return { col, dir: actual.dir === 'desc' ? 'asc' : 'desc' };
  return { col, dir: tabla[col]?.primero ?? 'desc' };
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const razon = (a, b) => (b > 0 ? r2(a / b) : null);

/**
 * Las sumas de un grupo de artículos (todo el filtro, o un proveedor, una
 * marca, una categoría):
 *  · `venta`: a precio de mostrador, neto, de lo que tiene precio;
 *  · `margenPotencial`: lo que se ganaría vendiéndolo, solo sobre lo que tiene
 *    costo Y precio (sin uno de los dos, la cuenta mentiría);
 *  · `rotacion`: el costo de lo vendido en 12 meses / la plata en stock (veces por año);
 *  · `rinde`: el margen de 12 meses / la plata en stock (cuánto deja por año cada $1 de stock).
 */
function sumar(filas) {
  const t = {
    valor: 0, articulos: 0, parado: 0, parados: 0, sobrestock: 0, porAgotarse: 0, coffit: 0, sinCosto: 0, sinPrecio: 0,
    venta: 0, ventaConCosto: 0, costoConPrecio: 0, margenAnio: 0, costoVendidoAnio: 0,
  };
  for (const x of filas) {
    if (x.deCoffit) { t.coffit += x.valor; continue; }
    t.articulos += 1;
    t.valor += x.valor;
    if (x.estado === 'parado') { t.parado += x.valor; t.parados += 1; }
    if (x.estado === 'sobrestock') t.sobrestock += x.valor;
    if (x.estado === 'por_agotarse') t.porAgotarse += 1;
    const conCosto = x.costoUnitario > 0;
    if (!conCosto) t.sinCosto += 1;
    if (x.valorVenta == null) t.sinPrecio += 1;
    else {
      t.venta += x.valorVenta;
      if (conCosto) { t.ventaConCosto += x.valorVenta; t.costoConPrecio += x.valor; }
    }
    t.margenAnio += x.margenAnio ?? 0;
    t.costoVendidoAnio += x.costoVendidoAnio ?? 0;
  }
  const margenPotencial = t.ventaConCosto - t.costoConPrecio;
  return {
    valor: r2(t.valor), articulos: t.articulos, parado: r2(t.parado), parados: t.parados, sobrestock: r2(t.sobrestock),
    porAgotarse: t.porAgotarse, coffit: r2(t.coffit), sinCosto: t.sinCosto, sinPrecio: t.sinPrecio,
    porcentajeParado: t.valor > 0 ? r2((t.parado / t.valor) * 100) : null,
    venta: r2(t.venta), margenPotencial: r2(margenPotencial),
    margenPotencialPct: t.ventaConCosto > 0 ? r2((margenPotencial / t.ventaConCosto) * 100) : null,
    margenAnio: r2(t.margenAnio), rotacion: razon(t.costoVendidoAnio, t.valor), rinde: razon(t.margenAnio, t.valor),
  };
}

/** Los números de arriba, la plata por local y el reparto ABC, sobre lo filtrado. */
export function resumirStock(filas, nombreSuc = () => '') {
  const porSuc = new Map();
  const abc = Object.fromEntries(Object.keys(CLASES_ABC).map((k) => [k, { articulos: 0, valor: 0 }]));
  for (const x of filas) {
    if (x.deCoffit) continue;
    if (abc[x.abc]) { abc[x.abc].articulos += 1; abc[x.abc].valor += x.valor; }
    for (const [id, v] of Object.entries(x.locales ?? {})) {
      const s = porSuc.get(id) ?? { valor: 0, productos: 0 };
      s.valor += v; s.productos += 1;
      porSuc.set(id, s);
    }
  }
  return {
    ...sumar(filas),
    abc: Object.entries(abc).map(([clase, a]) => ({ clase, articulos: a.articulos, valor: r2(a.valor) })),
    porSucursal: [...porSuc.entries()]
      .map(([id, s]) => ({ sucursalId: Number(id), nombre: nombreSuc(Number(id)) || 'Sin sucursal', valor: r2(s.valor), productos: s.productos }))
      .sort((a, b) => b.valor - a.valor),
  };
}

/** La vista agrupada: una fila por proveedor, marca o categoría, con sus sumas. `clave` es el valor de su filtro. */
export function agruparStock(filas, por) {
  const g = AGRUPAR[por];
  const grupos = new Map();
  for (const x of filas) {
    if (x.deCoffit) continue;
    const clave = x[g.id] == null ? '0' : String(x[g.id]);
    const a = grupos.get(clave);
    if (a) a.push(x); else grupos.set(clave, [x]);
  }
  return [...grupos.entries()].map(([clave, fs]) => ({
    clave, nombre: clave === '0' ? g.sin : (fs[0][g.nombre] || `#${clave}`), ...sumar(fs),
  }));
}

/** Las opciones de los filtros: solo lo que tiene stock, de la A a la Z, con «Sin …» al final si hace falta. */
export function opcionesStock(filas) {
  const juntar = (id, nombre) => {
    const m = new Map();
    let sin = false;
    for (const x of filas) {
      if (x[id] == null) sin = true;
      else if (!m.has(x[id])) m.set(x[id], x[nombre] || `#${x[id]}`);
    }
    return { lista: [...m.entries()].map(([v, l]) => ({ v: String(v), l })).sort((a, b) => a.l.localeCompare(b.l, 'es')), sin };
  };
  return { proveedores: juntar('proveedorId', 'proveedor'), marcas: juntar('marcaId', 'marca'), categorias: juntar('categoriaId', 'categoria') };
}

/** Las fotos de fin de mes con la variación contra el mes anterior (vienen de la más nueva a la más vieja). */
export function conVariacion(meses) {
  return meses.map((m, i) => {
    const antes = meses[i + 1];
    return { ...m, variacion: antes && antes.valor > 0 ? r2(((m.valor - antes.valor) / antes.valor) * 100) : null };
  });
}
