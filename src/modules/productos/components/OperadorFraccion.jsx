/**
 * QUIÉN FRACCIONÓ (0102) — el selector que usan los tres lugares que fraccionan:
 * el botón Fraccionar, la corrección de una tanda y la lista de granel de un
 * pedido.
 *
 * La lista de operadores es chica y cambia poco: se guarda en memoria para que
 * el modal abra ya con ella, y cada apertura la refresca por detrás (una sola
 * consulta aunque haya dos selectores montados). Así un operador que el
 * encargado cargó en otra PC aparece sin recargar la página.
 *
 * Cada PC recuerda el último elegido: en el puesto de fraccionado trabaja casi
 * siempre la misma persona, y elegirla en cada tanda es fricción pura.
 */
import { useEffect, useMemo, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { s } from './ui.jsx';

let cache = null;
let enVuelo = null;
const suscriptores = new Set();

function refrescar(store) {
  if (!enVuelo) {
    enVuelo = store.operadoresFraccion().then((r) => {
      enVuelo = null;
      if (r.ok) {
        cache = r.data;
        suscriptores.forEach((fn) => fn(cache));
      }
      return r;
    });
  }
  return enVuelo;
}

/** Después de dar de alta, editar o dar de baja un operador. */
export const refrescarOperadores = refrescar;

const CLAVE = 'crm.fraccion.operador';
const recordado = () => { try { return Number(localStorage.getItem(CLAVE)) || null; } catch { return null; } };
const recordar = (id) => { try { if (id) localStorage.setItem(CLAVE, String(id)); } catch { /* navegación privada */ } };

/** Los operadores activos que pueden trabajar en esa sucursal (sin sucursal = en todas). */
export function useOperadoresFraccion(sucursalId) {
  const { store } = useProductos();
  const [lista, setLista] = useState(cache);
  useEffect(() => {
    suscriptores.add(setLista);
    refrescar(store);
    return () => { suscriptores.delete(setLista); };
  }, [store]);
  const suc = Number(sucursalId) || null;
  const disponibles = useMemo(
    () => (lista || []).filter((o) => o.activo && (o.sucursalId == null || o.sucursalId === suc)),
    [lista, suc],
  );
  return { disponibles, cargando: lista == null };
}

/**
 * `ops` es lo que devuelve `useOperadoresFraccion` en el padre: el padre
 * necesita saber si hay operadores para decidir si el botón se habilita.
 * Sin operadores cargados no se pinta nada — fraccionar sigue andando igual.
 *
 * `opcional` (la corrección): arranca vacío y ofrece "no sé", porque quien
 * corrige días después puede no saber de quién era la tanda.
 */
export function SelectorOperador({ ops, value, onChange, opcional = false, label = '¿Quién fraccionó?', compacto = false }) {
  const { disponibles } = ops;

  /* Si el elegido deja de valer (se cambió de sucursal, lo dieron de baja), se
   * suelta; si no hay nadie elegido, se propone el recordado o el único. */
  useEffect(() => {
    if (value && disponibles.some((o) => o.id === value)) return;
    if (opcional || !disponibles.length) { if (value) onChange(null); return; }
    const previo = recordado();
    const elegido = disponibles.find((o) => o.id === previo) ?? (disponibles.length === 1 ? disponibles[0] : null);
    onChange(elegido ? elegido.id : null);
  }, [disponibles, value, opcional, onChange]);

  if (!disponibles.length) return null;

  const elegir = (v) => {
    const id = Number(v) || null;
    if (!opcional) recordar(id);
    onChange(id);
  };

  const select = (
    <select
      value={value ?? ''}
      onChange={(e) => elegir(e.target.value)}
      style={compacto ? { width: 'auto', minWidth: 160 } : undefined}
      aria-label={label}
    >
      <option value="">{opcional ? 'No sé / no corresponde' : 'Elegí…'}</option>
      {disponibles.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>
  );

  if (compacto) return select;
  return (
    <div className={s.field}>
      <label>{label} {!opcional && <span className={s.req}>*</span>}</label>
      {select}
    </div>
  );
}
