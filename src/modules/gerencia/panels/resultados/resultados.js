/**
 * GERENCIA › RESULTADOS (0152) — la lógica de la pantalla, sin React.
 * ============================================================================
 * La cuenta la hace el servidor (`crm-api/src/resultados`): manda, por mes y
 * por balde (cada local, «Sin local» y «Administración»), los hechos con su
 * cascada. Acá solo se SUMAN (la cascada es suma: la de varios meses o locales
 * es la suma de sus cascadas) y se arman los renglones, los porcentajes, el
 * punto de equilibrio y la comparación con el objetivo.
 *
 * Sin alias de importación: lo prueba `node --test`.
 */

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const N = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* ------------------------------ meses ------------------------------ */

export function sumarMeses(mes, n) {
  const [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function mesesEntre(a, b) {
  const out = [];
  for (let m = a; m <= b; m = sumarMeses(m, 1)) out.push(m);
  return out;
}

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** «Octubre 2026» · corto: «oct 26». */
export function nombreMes(mes, corto = false) {
  const [y, m] = String(mes).split('-').map(Number);
  if (!y || !m) return mes;
  const n = NOMBRES_MES[m - 1];
  return corto ? `${n.slice(0, 3)} ${String(y).slice(2)}` : `${n.charAt(0).toUpperCase()}${n.slice(1)} ${y}`;
}

export const mesActual = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/* ------------------------------ sumar ------------------------------ */

const GRUPOS = ['variables', 'fijos', 'financieros'];
/** Todos los números de una columna, en cero: un local sin nada en el mes da cero, no «vacío». */
const CEROS = Object.fromEntries([
  'ventasLista', 'descuentos', 'notasCredito', 'cargos', 'cmv', 'mermas', 'ajustesStock', 'iibb', 'municipalidad',
  'comisiones', 'sueldos', 'amortizaciones', 'recargos', 'retiros', 'sinCosto', 'ventaSinCosto', 'facturado',
  'ivaSinFactura', 'comisionesMp', 'ventasNetas', 'margenBruto', 'otrosVariables', 'totalVariables', 'contribucion',
  'otrosFijos', 'totalFijos', 'operativo', 'resultadoFinanciero', 'antesGanancias',
].map((k) => [k, 0]));

/** Suma objetos de hechos/cascada: los números campo a campo y los rubros por id. */
export function sumar(lista) {
  const out = { variables: {}, fijos: {}, financieros: {} };
  for (const x of lista) {
    if (!x) continue;
    for (const [k, v] of Object.entries(x)) {
      if (typeof v === 'number') out[k] = r2(N(out[k]) + v);
      else if (GRUPOS.includes(k) && v) for (const [id, imp] of Object.entries(v)) out[k][id] = r2(N(out[k][id]) + N(imp));
    }
  }
  return out;
}

/**
 * LO DE UNA COLUMNA: los meses que entran y un balde (o todos, `null`).
 * Ganancias y el resultado neto existen solo para la empresa entera.
 */
export function columna(datos, meses, balde = null) {
  const elegidos = (datos?.meses ?? []).filter((m) => meses.includes(m.mes));
  const partes = elegidos.map((m) => {
    if (balde == null) return { ...m.total.hechos, ...m.total.cascada };
    const b = m.baldes.find((x) => x.balde === balde);
    return b ? { ...b.hechos, ...b.cascada } : null;
  });
  const v = { ...CEROS, ...sumar(partes) };
  const empresa = balde == null;
  v.ganancias = empresa ? r2(elegidos.reduce((a, m) => a + N(m.ganancias?.impuesto), 0)) : null;
  v.neto = empresa ? r2(N(v.antesGanancias) - v.ganancias) : null;
  v.meses = elegidos.length;
  return v;
}

/* ------------------------------ los renglones ------------------------------ */

/**
 * La cascada como renglones. `valor(v)` devuelve el número CON SIGNO de cómo
 * entra (los costos en negativo): así la columna se lee sumando.
 * `siempre`: se muestra aunque dé cero (si falta, es un dato que falta cargar).
 */
export const RENGLONES = [
  { id: 'ventasLista', texto: 'Ventas a precio de lista', valor: (v) => N(v.ventasLista), siempre: true },
  { id: 'descuentos', texto: 'Descuentos y ofertas', valor: (v) => -N(v.descuentos) },
  { id: 'notasCredito', texto: 'Devoluciones y notas de crédito', valor: (v) => -N(v.notasCredito) },
  { id: 'cargos', texto: 'Envíos y otros cargos cobrados', valor: (v) => N(v.cargos) },
  { id: 'ventasNetas', texto: 'Ventas netas', valor: (v) => N(v.ventasNetas), sub: true },
  { id: 'cmv', texto: 'Costo de la mercadería vendida', valor: (v) => -N(v.cmv), siempre: true },
  { id: 'mermas', texto: 'Mermas, vencidos y defectuosos', valor: (v) => -N(v.mermas) },
  { id: 'ajustesStock', texto: 'Diferencias de inventario (ajustes y controles)', valor: (v) => N(v.ajustesStock) },
  { id: 'margenBruto', texto: 'Margen bruto', valor: (v) => N(v.margenBruto), sub: true },
  { id: 'iibb', texto: 'Ingresos Brutos', valor: (v) => -N(v.iibb), siempre: true, origen: 'iibb' },
  { id: 'municipalidad', texto: 'Tasa municipal', valor: (v) => -N(v.municipalidad), siempre: true, origen: 'municipalidad' },
  { id: 'comisiones', texto: 'Comisiones de tarjetas y Mercado Pago', valor: (v) => -N(v.comisiones), origen: 'comisiones' },
  { id: 'otrosVariables', texto: 'Otros gastos variables', valor: (v) => -N(v.otrosVariables), grupo: 'variables' },
  { id: 'contribucion', texto: 'Contribución marginal', valor: (v) => N(v.contribucion), sub: true },
  { id: 'sueldos', texto: 'Sueldos y cargas (con aguinaldo)', valor: (v) => -N(v.sueldos), siempre: true, origen: 'sueldos' },
  { id: 'otrosFijos', texto: 'Gastos fijos', valor: (v) => -N(v.otrosFijos), siempre: true, grupo: 'fijos' },
  { id: 'amortizaciones', texto: 'Amortizaciones', valor: (v) => -N(v.amortizaciones) },
  { id: 'operativo', texto: 'Resultado operativo', valor: (v) => N(v.operativo), sub: true },
  { id: 'recargos', texto: 'Recargo por cuotas cobrado', valor: (v) => N(v.recargos) },
  { id: 'financieros', texto: 'Gastos financieros', valor: (v) => -sumaGrupo(v.financieros), grupo: 'financieros' },
  { id: 'antesGanancias', texto: 'Resultado antes de Ganancias', valor: (v) => N(v.antesGanancias), sub: true },
  { id: 'ganancias', texto: 'Impuesto a las Ganancias (estimado)', valor: (v) => (v.ganancias == null ? null : -N(v.ganancias)), siempre: true, soloEmpresa: true },
  { id: 'neto', texto: 'Resultado neto', valor: (v) => v.neto, sub: true, final: true, soloEmpresa: true },
];

const sumaGrupo = (o) => Object.values(o ?? {}).reduce((a, x) => a + N(x), 0);

/**
 * Los renglones a mostrar para unas columnas: sin los que dan cero en todas
 * (salvo `siempre` y los subtotales), con el detalle por rubro de los grupos
 * abiertos, y sin Ganancias/neto si ninguna columna es la empresa entera.
 */
export function renglones(columnas, rubros = [], abiertos = new Set()) {
  const empresa = columnas.some((c) => c.ganancias != null);
  const nombreRubro = (id) => rubros.find((r) => String(r.id) === String(id))?.nombre ?? `Rubro ${id}`;
  const out = [];
  for (const def of RENGLONES) {
    if (def.soloEmpresa && !empresa) continue;
    const valores = columnas.map((c) => def.valor(c));
    const vacio = valores.every((x) => x == null || Math.abs(x) < 0.005);
    if (vacio && !def.sub && !def.siempre) continue;
    const ids = def.grupo ? [...new Set(columnas.flatMap((c) => Object.keys(c[def.grupo] ?? {})))] : [];
    out.push({ ...def, valores, abrible: ids.length > 0, abierto: abiertos.has(def.id) });
    if (def.grupo && abiertos.has(def.id)) {
      const detalle = ids
        .map((id) => ({ id: `${def.id}:${id}`, texto: nombreRubro(id), detalle: true, valores: columnas.map((c) => -N(c[def.grupo]?.[id])) }))
        .filter((x) => x.valores.some((v) => Math.abs(v) >= 0.005))
        .sort((a, b) => a.valores.reduce((s, v) => s + v, 0) - b.valores.reduce((s, v) => s + v, 0));
      out.push(...detalle);
    }
  }
  return out;
}

/** % sobre las ventas netas de la columna. */
export const sobreVentas = (valor, col) => (N(col.ventasNetas) > 0 && valor != null ? r2((valor / col.ventasNetas) * 100) : null);

/* ------------------------------ indicadores ------------------------------ */

/**
 * LOS INDICADORES de una columna:
 *   · margen bruto y contribución marginal en % de las ventas netas;
 *   · PUNTO DE EQUILIBRIO: las ventas netas que cubren los costos fijos con la
 *     contribución de hoy = fijos ÷ (contribución ÷ ventas). Si la contribución
 *     no es positiva, no hay venta que alcance;
 *   · fijos sobre ventas.
 */
export function indicadores(c) {
  const vn = N(c.ventasNetas);
  const fijos = N(c.totalFijos);
  const tasaContrib = vn > 0 ? N(c.contribucion) / vn : null;
  return {
    margenBrutoPct: vn > 0 ? r2((N(c.margenBruto) / vn) * 100) : null,
    contribucionPct: tasaContrib == null ? null : r2(tasaContrib * 100),
    equilibrio: tasaContrib != null && tasaContrib > 0 ? r2(fijos / tasaContrib) : null,
    sinEquilibrio: tasaContrib != null && tasaContrib <= 0,
    fijosPct: vn > 0 ? r2((fijos / vn) * 100) : null,
    margenSeguridadPct: tasaContrib != null && tasaContrib > 0 && vn > 0 ? r2(((vn - fijos / tasaContrib) / vn) * 100) : null,
  };
}

/** Variación % de `a` contra `b` (null si `b` es 0). */
export const variacion = (a, b) => (b == null || Math.abs(N(b)) < 0.005 || a == null ? null : r2(((N(a) - N(b)) / Math.abs(N(b))) * 100));

/* ------------------------------ objetivos ------------------------------ */

/** Lo esperado para esos meses (de la empresa con `sucursalId` null, o de un local). Solo los meses que tienen objetivo. */
export function objetivoDe(objetivos, meses, sucursalId = null) {
  const deEsos = (objetivos ?? []).filter((o) => meses.includes(o.mes) && (o.sucursalId ?? null) === (sucursalId ?? null));
  const venta = deEsos.filter((o) => o.ventaNeta != null);
  const res = deEsos.filter((o) => o.resultado != null);
  return {
    ventaNeta: venta.length ? r2(venta.reduce((a, o) => a + o.ventaNeta, 0)) : null,
    resultado: res.length ? r2(res.reduce((a, o) => a + o.resultado, 0)) : null,
    mesesVenta: venta.map((o) => o.mes), mesesResultado: res.map((o) => o.mes),
  };
}

/** Cuánto se cumplió: real ÷ objetivo en % (objetivo negativo o cero: no se calcula). */
export const cumplimiento = (real, objetivo) => (objetivo == null || objetivo <= 0 ? null : r2((N(real) / objetivo) * 100));

/* ------------------------------ estimado o real ------------------------------ */

/** De los meses, cuántos van con el estimado y cuántos con el pago real (IIBB, municipal, comisiones, sueldos). */
export function origenDe(datos, meses, clave) {
  const cuenta = {};
  for (const m of datos?.meses ?? []) {
    if (!meses.includes(m.mes)) continue;
    const o = m.origen?.[clave];
    if (o) cuenta[o] = (cuenta[o] ?? 0) + 1;
  }
  return cuenta;
}

const ORIGEN_TXT = {
  estimado: 'estimado', real: 'pago real', mixto: 'real en algunos locales',
  empleados: 'planilla de empleados', gastos: 'cargado en Gastos', nada: 'sin cargar',
};
export function textoOrigen(cuenta, clave = '') {
  const claves = Object.keys(cuenta);
  if (!claves.length) return '';
  const t = claves.length === 1
    ? ORIGEN_TXT[claves[0]] ?? claves[0]
    : claves.map((k) => `${ORIGEN_TXT[k] ?? k} en ${cuenta[k]} mes${cuenta[k] === 1 ? '' : 'es'}`).join(', ');
  /* Mercado Pago va siempre con su comisión real: lo estimado o pagado es el posnet. */
  return clave === 'comisiones' ? `posnet: ${t} · Mercado Pago: real` : t;
}

/* ------------------------------ baldes ------------------------------ */

/** Los baldes con algo en el período, con nombre: los locales, «Sin local» y «Administración» al final. */
export function baldesDe(datos, meses) {
  const ids = new Set();
  for (const m of datos?.meses ?? []) if (meses.includes(m.mes)) for (const b of m.baldes) ids.add(b.balde);
  const nombre = (id) => {
    if (id === 0) return 'Sin local (web)';
    if (id === -1) return 'Administración';
    return datos?.sucursales?.find((s) => s.id === id)?.nombre ?? `Local ${id}`;
  };
  return [...ids].sort((a, b) => (a <= 0) - (b <= 0) || (a <= 0 ? b - a : a - b)).map((id) => ({ id, nombre: nombre(id) }));
}

/* ------------------------------ formato ------------------------------ */

/** $ con signo adelante: «−$1.234,50» (nunca «$-1.234,50»). */
export function pesos(v, dec = 2) {
  if (v == null) return '—';
  const n = N(v);
  const t = Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return `${n < -0.004 ? '−' : ''}$${t}`;
}
/** $ sin centavos, para tarjetas y celular. */
export const pesosRedondo = (v) => pesos(v, 0);
export const pct = (v, dec = 1) => {
  if (v == null) return '—';
  const t = Math.abs(N(v)).toLocaleString('es-AR', { maximumFractionDigits: dec });
  return `${N(v) < 0 && t !== '0' ? '−' : ''}${t} %`;
};

/* ------------------------------ las columnas de la vista ------------------------------ */

/** ¿Ese mes tiene algo (de la empresa o del balde)? */
export function hayDatos(datos, mes, balde = null) {
  const m = (datos?.meses ?? []).find((x) => x.mes === mes);
  return !!m && (balde == null ? m.baldes.length > 0 : m.baldes.some((b) => b.balde === balde));
}

/**
 * LAS COLUMNAS DE LO QUE SE PIDIÓ.
 *   · Un mes, por mes: ese mes, el anterior y el mismo del año pasado (si hay datos).
 *   · Varios meses, por mes: cada mes y el total.
 *   · Por local (uno o varios meses): cada local, «Sin local», «Administración» y el total.
 * `principal` es la columna de las tarjetas; `contra`, con qué se compara.
 */
export function armarColumnas(datos, { modo, mes, desde, hasta, vista, balde = null }) {
  const meses = modo === 'mes' ? [mes] : mesesEntre(desde, hasta);
  const titulo = modo === 'mes' ? nombreMes(mes) : `${nombreMes(desde, true)} a ${nombreMes(hasta, true)}`;
  if (vista === 'locales') {
    const total = { key: 'total', titulo: 'Total', sub: titulo, col: columna(datos, meses, null) };
    const cols = baldesDe(datos, meses).map((b) => ({ key: `b${b.id}`, titulo: b.nombre, sub: '', col: columna(datos, meses, b.id) }));
    return { columnas: [...cols, total], principal: total.col, contra: null, contraTxt: '', meses, empresa: true };
  }
  const empresa = balde == null;
  if (modo === 'mes') {
    const principal = { key: mes, titulo: nombreMes(mes), sub: 'este período', col: columna(datos, [mes], balde) };
    const ant = sumarMeses(mes, -1);
    const anio = sumarMeses(mes, -12);
    const cols = [principal];
    if (hayDatos(datos, ant, balde)) cols.push({ key: ant, titulo: nombreMes(ant), sub: 'mes anterior', col: columna(datos, [ant], balde) });
    if (hayDatos(datos, anio, balde)) cols.push({ key: anio, titulo: nombreMes(anio), sub: 'un año antes', col: columna(datos, [anio], balde) });
    const contra = cols[1]?.sub === 'mes anterior' ? cols[1].col : null;
    return { columnas: cols, principal: principal.col, contra, contraTxt: 'vs mes anterior', meses, empresa };
  }
  const porMes = meses.map((m) => ({ key: m, titulo: nombreMes(m, true), sub: '', col: columna(datos, [m], balde) }));
  if (porMes.length === 1) return { columnas: porMes, principal: porMes[0].col, contra: null, contraTxt: '', meses, empresa };
  const total = { key: 'total', titulo: 'Total', sub: `${meses.length} meses`, col: columna(datos, meses, balde) };
  return { columnas: [...porMes, total], principal: total.col, contra: null, contraTxt: '', meses, empresa };
}
