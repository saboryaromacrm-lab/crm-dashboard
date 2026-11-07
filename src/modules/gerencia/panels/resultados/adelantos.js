/**
 * ADELANTOS DE SUELDO EN GERENCIA (6/11/2026, pedido del dueño). Los trae
 * `GET /externo/adelantos` (el mismo listado que toma la app de sueldos: caja
 * central + cajas de los locales, anulados incluidos). Acá, solo lo que se hace
 * con esa lista en el navegador: filtrar y resumir por empleado.
 */

/** Sin empleado elegido: los adelantos de antes de la lista del personal (0221). */
export const SIN_EMPLEADO = 'sin';
export const claveEmpleado = (a) => (a.empleado ? `e:${a.empleado.id}` : SIN_EMPLEADO);
export const nombreEmpleado = (a) => a.empleado?.nombre ?? 'Sin empleado elegido';
export const claveLugar = (a) => (a.sucursalId == null ? 'central' : `s:${a.sucursalId}`);

/** El detalle sin el nombre que el servidor le antepone al guardar («Sofía · semana 2» → «semana 2»). */
export function detalleSinNombre(a) {
  const d = a.detalle ?? '';
  const n = a.empleado?.nombre;
  if (!n || !d.startsWith(n)) return d;
  if (d === n) return '';
  return d.startsWith(`${n} · `) ? d.slice(n.length + 3) : d;
}

/**
 * Las opciones de un filtro, sin repetir y en orden alfabético: [[clave, nombre]].
 * `elegido` ([clave, nombre]) queda aunque el período no lo traiga: si no, el
 * desplegable diría «Todos» con el filtro puesto.
 */
export function opciones(lista, clave, nombre, elegido = null) {
  const m = new Map(lista.map((a) => [clave(a), nombre(a)]));
  if (elegido && !m.has(elegido[0])) m.set(elegido[0], elegido[1]);
  return [...m].sort((x, y) => x[1].localeCompare(y[1], 'es'));
}

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Aplica los filtros. Lo más nuevo primero. '' = todos. */
export function filtrar(lista, { empleado = '', lugar = '', concepto = '', anulados = false, texto = '' }) {
  const q = sinTildes(texto.trim());
  return lista
    .filter((a) => (anulados || !a.anulado)
      && (!empleado || claveEmpleado(a) === empleado)
      && (!lugar || claveLugar(a) === lugar)
      && (!concepto || a.concepto === concepto)
      && (!q || sinTildes(`${nombreEmpleado(a)} ${a.detalle} ${a.cargadoPor} ${a.lugar}`).includes(q)))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Cuánto se le adelantó a cada uno (solo lo vigente), de mayor a menor. */
export function porEmpleado(lista) {
  const m = new Map();
  for (const a of lista) {
    if (a.anulado) continue;
    const k = claveEmpleado(a);
    const e = m.get(k) ?? { clave: k, nombre: nombreEmpleado(a), cantidad: 0, total: 0 };
    e.cantidad += 1;
    e.total = Math.round((e.total + a.importe) * 100) / 100;
    m.set(k, e);
  }
  return [...m.values()].sort((x, y) => y.total - x.total || x.nombre.localeCompare(y.nombre, 'es'));
}
