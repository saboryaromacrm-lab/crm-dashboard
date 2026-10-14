/**
 * PROVEEDORES › MONTOS (14/10/2026, pedido del dueño) — la cuenta, en un lugar.
 * ============================================================================
 * La API manda una fila por producto con stock, ya valuada con la cuenta de
 * Métricas › Stock y con el proveedor que fija su precio. Acá se filtra y se
 * agrupa por proveedor al instante (tipo, categoría, marca, locales, nombre):
 * cambiar un filtro no vuelve a pedir nada.
 *
 * Por proveedor:
 *   · valor y % del total; % acumulado en orden de valor (la curva de Pareto:
 *     cuántos proveedores juntan el 80 % de la plata);
 *   · artículos con stock, enteros (unidades) y granel (kg), cada uno con su plata;
 *   · días de stock: su plata ÷ lo que se vende por día a costo (null si no se vende);
 *   · plata parada: la de sus artículos sin ventas en el período;
 *   · sin costo: artículos con stock y costo en 0 (su plata no se puede medir).
 */
export const SIN_PROVEEDOR = 'Sin proveedor';
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const nuevoGrupo = (id, nombre, esLocal) => ({
  id, nombre, esLocal: !!esLocal, valor: 0, articulos: 0, parado: 0, sinCosto: 0, costoDia: 0,
  enteros: { articulos: 0, unidades: 0, valor: 0 }, granel: { articulos: 0, kg: 0, valor: 0 }, items: [],
});

function sumar(g, x) {
  g.valor += x.valor;
  g.articulos += 1;
  g.costoDia += x.costoDia;
  if (x.parado) g.parado += x.valor;
  if (x.sinCosto) g.sinCosto += 1;
  if (x.tipo === 'granel') { g.granel.articulos += 1; g.granel.kg += x.stock; g.granel.valor += x.valor; }
  else { g.enteros.articulos += 1; g.enteros.unidades += x.stock; g.enteros.valor += x.valor; }
}

const dias = (valor, costoDia) => (costoDia > 0 ? valor / costoDia : null);

/**
 * @param datos    la respuesta de GET /proveedores-montos
 * @param filtros  { tipo: ''|'entero'|'granel', categoriaId, marcaId, soloLocales, buscar }
 * @returns { resumen, proveedores } — proveedores ordenados de más a menos plata
 */
export function analizarMontos(datos, { tipo = '', categoriaId = '', marcaId = '', soloLocales = false, buscar = '' } = {}) {
  if (!datos) return null;
  const provDe = new Map((datos.proveedores ?? []).map((p) => [p.id, p]));
  const t = norm(buscar.trim());
  const grupos = new Map();
  const resumen = nuevoGrupo(null, 'Total', false);
  for (const x of datos.productos ?? []) {
    if (tipo && x.tipo !== tipo) continue;
    if (categoriaId && String(x.categoriaId) !== String(categoriaId)) continue;
    if (marcaId && String(x.marcaId) !== String(marcaId)) continue;
    const prov = provDe.get(x.proveedorId) ?? null;
    if (soloLocales && !prov?.esLocal) continue;
    const nombre = prov?.nombre ?? SIN_PROVEEDOR;
    if (t && !norm(nombre).includes(t)) continue;
    const clave = prov ? prov.id : 0;
    let g = grupos.get(clave);
    if (!g) { g = nuevoGrupo(clave, nombre, prov?.esLocal); grupos.set(clave, g); }
    sumar(g, x);
    g.items.push(x);
    sumar(resumen, x);
  }

  const proveedores = [...grupos.values()].sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'));
  let acumulado = 0;
  let pareto80 = 0;
  for (const g of proveedores) {
    g.pct = resumen.valor > 0 ? (g.valor / resumen.valor) * 100 : 0;
    acumulado += g.pct;
    g.pctAcumulado = acumulado;
    /* Los que entran hasta llegar al 80 % (incluido el que lo cruza). */
    g.pareto = pareto80 === 0 || acumulado - g.pct < 80 - 1e-9;
    if (g.pareto) pareto80 += 1;
    g.dias = dias(g.valor, g.costoDia);
    g.items.sort((a, b) => b.valor - a.valor);
  }
  return {
    resumen: { ...resumen, proveedores: proveedores.length, pareto80, dias: dias(resumen.valor, resumen.costoDia) },
    proveedores,
  };
}
