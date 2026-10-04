/**
 * ABM DE UN CATÁLOGO (marcas, categorías, subcategorías, etiquetas)
 * ============================================================================
 * Un solo componente para los cuatro: cambia el título y, en subcategorías, el
 * filtro por categoría. Se usa en dos lados sin duplicarse — en el panel
 * Catálogos y montado dentro del modal de producto cuando se toca "Administrar".
 *
 * La acción que evita que esto se vuelva un basural es **Fusionar**: sin ella,
 * el día que entren "Coca Cola" y "Coca-Cola" no hay forma de arreglarlo sin
 * tocar la base a mano.
 */
import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { useProductos } from '../context/ProductosContext.jsx';
import { ModalShell } from './Modal.jsx';
import { Btn, s } from './ui.jsx';

/**
 * INHABILITAR / HABILITAR UNA MARCA (0135, pedido del dueño): sus productos
 * acompañan. Antes de hacerlo se muestra cuántos cambian y se confirma dos
 * veces — es sacar mercadería de la venta y de las compras de una vez.
 */
function MarcaEstadoModal({ fila, onCerrar, onHecho, store, toast }) {
  const activar = !fila.activa;
  const [imp, setImp] = useState(null);
  const [error, setError] = useState('');
  const sc = useSegundaConfirmacion(`${fila.id}|${activar}`);
  useEffect(() => {
    let vivo = true;
    httpClient.get(`/catalogos/marcas/${fila.id}/impacto`)
      .then((r) => { if (vivo) setImp(r); })
      .catch(() => { if (vivo) setError('No se pudo calcular cuántos productos cambian.'); });
    return () => { vivo = false; };
  }, [fila.id]);
  const cambian = imp ? (activar ? imp.aReactivar : imp.aDiscontinuar + imp.aArchivar) : 0;
  const confirmar = () => sc.clic(
    () => !!imp,
    async () => {
      const r = await store.editarCatalogo('marcas', fila.id, { nombre: fila.nombre, activa: activar, confirmado: true });
      if (r && r.ok === false) { setError(r.error || 'No se pudo.'); return; }
      const pr = r?.productos ?? {};
      toast(activar
        ? `«${fila.nombre}» habilitada: ${pr.reactivados ?? 0} producto(s) volvieron a activo.`
        : `«${fila.nombre}» inhabilitada: ${pr.discontinuados ?? 0} discontinuado(s) y ${pr.archivados ?? 0} archivado(s).`, 'ok');
      onHecho();
    },
  );
  return (
    <ModalShell
      title={`${activar ? 'Habilitar' : 'Inhabilitar'} la marca «${fila.nombre}»`}
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', onClick: onCerrar },
        {
          texto: textoBoton(sc, activar ? `Habilitar${cambian ? ` y reactivar ${cambian}` : ''}` : `Inhabilitar${cambian ? ` y dar de baja ${cambian}` : ''}`, 'Sí, confirmar'),
          clase: activar ? 'btn-primary' : 'btn-delete', onClick: confirmar, disabled: !imp,
        },
      ]}
    >
      {!imp && !error && <div className={s.hint}>Calculando qué productos cambian…</div>}
      {imp && (activar ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div><strong>{imp.aReactivar}</strong> producto(s) que dio de baja la marca vuelven a <strong>Activo</strong>: se compran y se venden de nuevo.</div>
          {imp.yaDeBaja > 0 && <div className={s.hint} style={{ margin: 0 }}>{imp.yaDeBaja} que se dieron de baja a mano (antes o después) quedan como están.</div>}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div><strong>{imp.aDiscontinuar}</strong> con stock pasan a <strong>Discontinuado</strong>: no aparecen más en compras ni en reposición, pero se siguen vendiendo hasta agotar.</div>
          <div><strong>{imp.aArchivar}</strong> sin stock quedan <strong>Archivados</strong>: fuera de catálogo, no se compran ni se venden.</div>
          {imp.yaDeBaja > 0 && <div className={s.hint} style={{ margin: 0 }}>{imp.yaDeBaja} ya estaban discontinuados o archivados: no se tocan.</div>}
          <div className={s.hint} style={{ margin: 0 }}>Si después habilitás la marca, vuelven a activo solo los que dio de baja ella.</div>
        </div>
      ))}
      <AvisoSegundaConfirmacion {...sc}>
        {activar ? <>Se habilita «{fila.nombre}» y {cambian} producto(s) vuelven a activo.</> : <>Se inhabilita «{fila.nombre}» y {cambian} producto(s) salen de las compras{imp?.aArchivar ? ' (y los sin stock, de la venta)' : ''}.</>}
      </AvisoSegundaConfirmacion>
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
    </ModalShell>
  );
}

const META = {
  marcas: { titulo: 'Marcas', singular: 'marca', placeholder: 'Ej: Cachafaz' },
  categorias: { titulo: 'Categorías', singular: 'categoría', placeholder: 'Ej: Alfajores' },
  subcategorias: { titulo: 'Subcategorías', singular: 'subcategoría', placeholder: 'Ej: Tradicionales' },
  etiquetas: { titulo: 'Etiquetas', singular: 'etiqueta', placeholder: 'Ej: SIN TACC' },
};

export function CatalogoAdmin({ tipo }) {
  const { store, toast } = useProductos();
  const meta = META[tipo];

  const [nuevo, setNuevo] = useState('');
  const [color, setColor] = useState('#2e7d32');
  const [catFiltro, setCatFiltro] = useState(null);   // solo subcategorías
  const [editId, setEditId] = useState(null);
  const [editTxt, setEditTxt] = useState('');
  const [fusionId, setFusionId] = useState(null);
  const [fusionHacia, setFusionHacia] = useState('');
  const [marcaModal, setMarcaModal] = useState(null);

  const categorias = store.state.catalogos.categorias;
  const todas = store.state.catalogos[tipo] || [];

  // En subcategorías la lista solo tiene sentido dentro de una categoría: sin
  // el filtro se mezclan "Tradicionales" de Alfajores y de Galletitas.
  const filas = useMemo(() => {
    if (tipo !== 'subcategorias') return todas;
    return catFiltro ? todas.filter((x) => x.categoriaId === catFiltro) : todas;
  }, [todas, tipo, catFiltro]);

  const nombreCategoria = (id) => categorias.find((c) => c.id === id)?.nombre ?? '—';

  /** Corre una mutación y avisa. Devuelve el resultado para poder encadenar. */
  const correr = async (promesa, okMsg) => {
    const r = await promesa;
    if (r && r.ok === false) { toast(r.error || 'No se pudo.', 'err'); return null; }
    toast(okMsg, 'ok');
    return r;
  };

  const agregar = async () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    if (tipo === 'subcategorias' && !catFiltro) {
      toast('Elegí primero la categoría a la que pertenece.', 'err');
      return;
    }
    const body = { nombre };
    if (tipo === 'subcategorias') body.categoriaId = catFiltro;
    if (tipo === 'etiquetas') body.color = color;
    const r = await correr(store.crearCatalogo(tipo, body), `${meta.singular} creada.`);
    if (r) setNuevo('');
  };

  const renombrar = async (fila) => {
    const nombre = editTxt.trim();
    if (!nombre || nombre === fila.nombre) { setEditId(null); return; }
    const body = { nombre, activa: fila.activa };
    if (tipo === 'subcategorias') body.categoriaId = fila.categoriaId;
    if (tipo === 'etiquetas') body.color = fila.color;
    const r = await correr(store.editarCatalogo(tipo, fila.id, body), 'Renombrada.');
    if (r) setEditId(null);
  };

  const alternarActiva = (fila) => {
    if (tipo === 'marcas') { setMarcaModal(fila); return null; }
    const body = { nombre: fila.nombre, activa: !fila.activa };
    if (tipo === 'subcategorias') body.categoriaId = fila.categoriaId;
    if (tipo === 'etiquetas') body.color = fila.color;
    return correr(store.editarCatalogo(tipo, fila.id, body), fila.activa ? 'Desactivada.' : 'Reactivada.');
  };

  const eliminar = async (fila) => {
    const r = await store.eliminarCatalogo(tipo, fila.id);
    if (r && r.ok === false) { toast(r.error || 'No se pudo.', 'err'); return; }
    // El backend desactiva en vez de borrar cuando hay algo apuntando: se dice.
    if (r && r.desactivada) toast(`Está en uso (${r.detalle}). Se desactivó en vez de borrarse.`, 'ok');
    else toast('Eliminada.', 'ok');
  };

  const fusionar = async (fila) => {
    const hacia = Number(fusionHacia);
    if (!hacia) { toast('Elegí con cuál se fusiona.', 'err'); return; }
    const r = await correr(store.fusionarCatalogo(tipo, fila.id, hacia), 'Fusionadas.');
    if (r) { setFusionId(null); setFusionHacia(''); }
  };

  /** Candidatas a destino de la fusión: las demás de la misma categoría. */
  const destinos = (fila) => todas.filter((x) => x.id !== fila.id
    && (tipo !== 'subcategorias' || x.categoriaId === fila.categoriaId));

  return (
    <div>
      {tipo === 'subcategorias' && (
        <div className={s.field}>
          <label>Categoría</label>
          <select value={catFiltro ?? ''} onChange={(e) => setCatFiltro(Number(e.target.value) || null)}>
            <option value="">— Todas —</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Para dar de alta hay que elegir una: la subcategoría siempre cuelga de una categoría.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
        <div className={s.field} style={{ flex: 1, marginBottom: 0 }}>
          <label>Nueva {meta.singular}</label>
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
            placeholder={meta.placeholder}
          />
        </div>
        {tipo === 'etiquetas' && (
          <div className={s.field} style={{ marginBottom: 0, width: 74 }}>
            <label>Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ padding: 3, height: 38 }} />
          </div>
        )}
        <Btn variant="btn-primary" onClick={agregar}>Agregar</Btn>
      </div>

      <table className={s.table}>
        <thead>
          <tr>
            <th>Nombre</th>
            {tipo === 'subcategorias' && <th>Categoría</th>}
            <th>Estado</th>
            <th className={s['actions-col']}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr><td colSpan={4} className={s['empty-state']}>Sin {meta.titulo.toLowerCase()}.</td></tr>
          )}
          {filas.map((f) => (
            <tr key={f.id} style={{ opacity: f.activa ? 1 : 0.55 }}>
              <td>
                {editId === f.id ? (
                  <input
                    autoFocus
                    value={editTxt}
                    onChange={(e) => setEditTxt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); renombrar(f); }
                      if (e.key === 'Escape') setEditId(null);
                    }}
                    onBlur={() => renombrar(f)}
                  />
                ) : (
                  <span style={f.color ? { color: f.color, fontWeight: 600 } : undefined}>{f.nombre}</span>
                )}
              </td>
              {tipo === 'subcategorias' && <td className={s.muted}>{nombreCategoria(f.categoriaId)}</td>}
              <td>{f.activa ? <span className={s.badge}>activa</span> : <span className={s.muted}>inactiva</span>}</td>
              <td className={s['actions-col']}>
                {fusionId === f.id ? (
                  <div className={s['row-actions']}>
                    <select value={fusionHacia} onChange={(e) => setFusionHacia(e.target.value)}>
                      <option value="">— Fusionar con… —</option>
                      {destinos(f).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                    <Btn small variant="btn-primary" onClick={() => fusionar(f)}>Aplicar</Btn>
                    <Btn small onClick={() => setFusionId(null)}>Cancelar</Btn>
                  </div>
                ) : (
                  <div className={s['row-actions']}>
                    <Btn small onClick={() => { setEditId(f.id); setEditTxt(f.nombre); }}>Renombrar</Btn>
                    {destinos(f).length > 0 && (
                      <Btn small onClick={() => { setFusionId(f.id); setFusionHacia(''); }}>Fusionar</Btn>
                    )}
                    <Btn small onClick={() => alternarActiva(f)}>
                      {tipo === 'marcas' ? (f.activa ? 'Inhabilitar' : 'Habilitar') : (f.activa ? 'Desactivar' : 'Reactivar')}
                    </Btn>
                    <Btn small variant="btn-delete" onClick={() => eliminar(f)}>Eliminar</Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {marcaModal && (
        <MarcaEstadoModal fila={marcaModal} store={store} toast={toast} onCerrar={() => setMarcaModal(null)} onHecho={() => setMarcaModal(null)} />
      )}

      <div className={cx(s.callout, s.info)} style={{ marginTop: 14 }}>
        <strong>Fusionar</strong> reapunta todo lo que usaba una a la otra y borra la sobrante — es
        la forma de arreglar duplicados como «Coca Cola» y «Coca-Cola». <strong>Eliminar</strong> solo
        borra de verdad si nadie la está usando; si está en uso, se desactiva para no dejar
        productos viejos sin dato.
        {tipo === 'marcas' && (
          <> En marcas, <strong>Inhabilitar</strong> da de baja también sus productos (con stock: discontinuados, se venden
          hasta agotar; sin stock: archivados) y <strong>Habilitar</strong> los vuelve a activo. Una marca con productos no se
          elimina: se inhabilita.</>
        )}
      </div>
    </div>
  );
}
