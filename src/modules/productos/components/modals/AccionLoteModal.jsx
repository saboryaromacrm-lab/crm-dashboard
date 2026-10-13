import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { ACCIONES_LOTE, ESTADOS_STOCK_VIVO } from '../../domain/constants.js';
import { ModalShell } from '../Modal.jsx';
import { s } from '../ui.jsx';

/**
 * ACCIONES EN LOTE DE EXISTENCIAS (13/10/2026, pedido del dueño): lo que se
 * hace con los productos tildados, como las «Acciones en lote» de WooCommerce.
 *
 *   · baja: sacarlos del catálogo. Con stock vivo → discontinuado (se vende
 *     hasta agotar); sin stock → archivado. No toca el stock. La vista previa
 *     sale del stock en pantalla; el servidor vuelve a decidir con el actual.
 *   · marca / categoria: la misma para todos (solo las habilitadas). Cambiar
 *     la categoría sin elegir subcategoría le saca la subcategoría al que
 *     cambia de categoría.
 */
const MUESTRA = 8;
const alfabetico = (a, b) => a.nombre.localeCompare(b.nombre, 'es');

function Nombres({ lista }) {
  if (!lista.length) return null;
  const resto = lista.length - MUESTRA;
  return (
    <div className={s.hint} style={{ margin: '2px 0 0' }}>
      {lista.slice(0, MUESTRA).map((p) => p.nombre).join(' · ')}{resto > 0 ? ` · y ${resto} más` : ''}
    </div>
  );
}

export function AccionLoteModal({ accion, ids, onDone }) {
  const { store, closeModal, toast } = useProductos();
  const { productos, stock, catalogos } = store.state;
  const [motivo, setMotivo] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);

  const elegidos = useMemo(() => {
    const set = new Set(ids);
    return productos.filter((p) => set.has(p.id)).sort(alfabetico);
  }, [productos, ids]);

  /* La vista previa de la baja: quién queda discontinuado, quién archivado y quién ya estaba así. */
  const plan = useMemo(() => {
    if (accion !== 'baja') return null;
    const vivos = new Set(stock.filter((st) => st.cantidad > 1e-9 && ESTADOS_STOCK_VIVO.includes(st.estado)).map((st) => st.productoId));
    const out = { discontinuado: [], archivado: [], igual: [] };
    for (const p of elegidos) {
      const destino = vivos.has(p.id) ? 'discontinuado' : 'archivado';
      out[p.estado === 'archivado' || p.estado === destino ? 'igual' : destino].push(p);
    }
    return out;
  }, [accion, elegidos, stock]);

  const activos = (lista) => (lista ?? []).filter((x) => x.activa !== false).sort(alfabetico);
  const marcas = useMemo(() => activos(catalogos?.marcas), [catalogos]);
  const categorias = useMemo(() => activos(catalogos?.categorias), [catalogos]);
  const subcategorias = useMemo(
    () => activos(catalogos?.subcategorias).filter((x) => String(x.categoriaId) === categoriaId),
    [catalogos, categoriaId],
  );

  const cambiosBaja = plan ? plan.discontinuado.length + plan.archivado.length : 0;
  const listo = accion === 'baja' ? cambiosBaja > 0 : accion === 'marca' ? !!marcaId : !!categoriaId;

  const aplicar = async () => {
    if (!listo || enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    const r = accion === 'baja'
      ? await store.bajaLote(ids, motivo.trim())
      : await store.clasificarLote(ids, accion === 'marca'
        ? { marcaId: Number(marcaId) }
        : { categoriaId: Number(categoriaId), ...(subcategoriaId && { subcategoriaId: Number(subcategoriaId) }) });
    enVuelo.current = false;
    setEnviando(false);
    if (!r.ok) { toast(r.error, 'err'); return; }
    toast(accion === 'baja'
      ? [r.discontinuados?.length && `${r.discontinuados.length} discontinuado(s)`, r.archivados?.length && `${r.archivados.length} archivado(s)`, r.sinCambio && `${r.sinCambio} sin cambio`].filter(Boolean).join(' · ') || 'Nada para cambiar.'
      : `${r.actualizados} producto(s) actualizado(s)${r.sinCambio ? ` · ${r.sinCambio} ya estaban así` : ''}.`, 'ok');
    onDone?.();
    closeModal();
  };

  const n = elegidos.length;
  return (
    <ModalShell
      title={ACCIONES_LOTE[accion]}
      subtitle={`${n} producto(s) elegido(s)`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: enviando ? 'Aplicando…' : accion === 'baja' ? `Dar de baja ${cambiosBaja} producto(s)` : `Aplicar a ${n} producto(s)`,
          clase: accion === 'baja' ? 'btn-delete' : 'btn-primary', onClick: aplicar, disabled: !listo || enviando,
        },
      ]}
    >
      {accion === 'baja' && plan && (
        <>
          {plan.discontinuado.length > 0 && (
            <div className={cx(s.callout, s.warn)}>
              <strong>{plan.discontinuado.length} quedan discontinuados</strong>: tienen stock, así que se siguen vendiendo hasta agotarlo y no se compran más.
              <Nombres lista={plan.discontinuado} />
            </div>
          )}
          {plan.archivado.length > 0 && (
            <div className={cx(s.callout, s.info)}>
              <strong>{plan.archivado.length} se archivan</strong>: no tienen stock; salen de las listas, la caja y la tienda.
              <Nombres lista={plan.archivado} />
            </div>
          )}
          {plan.igual.length > 0 && (
            <div className={s.hint}>{plan.igual.length} ya estaban así y no cambian.<Nombres lista={plan.igual} /></div>
          )}
          <div className={s.field}>
            <label htmlFor="lote-motivo">Motivo (opcional)</label>
            <input id="lote-motivo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: no se trae más" />
          </div>
          <div className={s.hint}>El stock no se toca. Se pueden reactivar desde Compras › Productos.</div>
        </>
      )}
      {accion === 'marca' && (
        <div className={s.field}>
          <label htmlFor="lote-marca">Marca nueva</label>
          <select id="lote-marca" value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
            <option value="">Elegí la marca…</option>
            {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <Nombres lista={elegidos} />
        </div>
      )}
      {accion === 'categoria' && (
        <>
          <div className={s['form-grid']}>
            <div className={s.field}>
              <label htmlFor="lote-categoria">Categoría nueva</label>
              <select id="lote-categoria" value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setSubcategoriaId(''); }}>
                <option value="">Elegí la categoría…</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className={s.field}>
              <label htmlFor="lote-subcategoria">Subcategoría (opcional)</label>
              <select id="lote-subcategoria" value={subcategoriaId} onChange={(e) => setSubcategoriaId(e.target.value)} disabled={!subcategorias.length}>
                <option value="">{subcategorias.length ? 'Sin elegir' : 'Esa categoría no tiene'}</option>
                {subcategorias.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className={s.hint}>Sin subcategoría, el que cambia de categoría se queda sin la suya (era de la otra).</div>
          <Nombres lista={elegidos} />
        </>
      )}
    </ModalShell>
  );
}
