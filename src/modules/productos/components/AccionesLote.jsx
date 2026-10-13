/**
 * LAS PIEZAS DE LAS ACCIONES EN LOTE (13/10/2026, como WooCommerce): la casilla
 * de la cabecera y la barra que aparece con algo elegido. Las usan Almacén ›
 * Existencias y Compras › Productos con `useSeleccionLote`; la acción la
 * confirma `AccionLoteModal`.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { ACCIONES_LOTE } from '../domain/constants.js';
import { Btn, s } from './ui.jsx';

/** La casilla de la cabecera: elige o saca todos los de la página (a medias si hay algunos). */
export function CasillaTodos({ sel, ids, alternar }) {
  const marcados = ids.filter((id) => sel.has(id)).length;
  return (
    <input
      type="checkbox" aria-label="Elegir todos los de esta página"
      checked={ids.length > 0 && marcados === ids.length}
      ref={(el) => { if (el) el.indeterminate = marcados > 0 && marcados < ids.length; }}
      onChange={(e) => alternar(ids, e.target.checked)}
    />
  );
}

/** La casilla de un renglón. */
export function CasillaLote({ sel, id, nombre, alternar }) {
  return (
    <td style={{ width: 36 }} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={sel.has(id)} onChange={(e) => alternar([id], e.target.checked)} aria-label={`Elegir ${nombre}`} />
    </td>
  );
}

/** La barra con algo elegido: cuántos, «elegir los del filtro», la acción y quitar la selección. */
export function BarraLote({ sel, idsFiltro, alternar, limpiar, id }) {
  const { openModal } = useProductos();
  const [accion, setAccion] = useState('');
  if (!sel.size) return null;
  const faltan = idsFiltro.filter((x) => !sel.has(x)).length;
  const aplicar = () => openModal('accionLote', { accion, ids: [...sel], onDone: () => { limpiar(); setAccion(''); } });
  return (
    <div className={cx(s.callout, s.info)} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <strong>{sel.size} producto(s) elegido(s)</strong>
      {faltan > 0 && <Btn small variant="btn-ghost" onClick={() => alternar(idsFiltro, true)}>Elegir los {idsFiltro.length} del filtro</Btn>}
      <select id={id} className={s['select-inline']} value={accion} onChange={(e) => setAccion(e.target.value)} aria-label="Acción en lote">
        <option value="">Acciones en lote…</option>
        {Object.entries(ACCIONES_LOTE).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <Btn small variant="btn-primary" onClick={aplicar} disabled={!accion}>Aplicar</Btn>
      <Btn small variant="btn-ghost" onClick={limpiar}>Quitar selección</Btn>
    </div>
  );
}
