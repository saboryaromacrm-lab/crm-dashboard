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
 *
 * 12/10/2026 (pedido del dueño): buscador y filtros (estado, uso, y la categoría
 * en subcategorías), orden alfabético por defecto, cuántos productos usan cada
 * una, y el alta en un solo botón «+ Nueva…» que abre su ventanita.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { useProductos } from '../context/ProductosContext.jsx';
import { norm } from './CatalogoPicker.jsx';
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

/** Qué productos usan cada valor del catálogo (sin los archivados). */
const USO = {
  marcas: (p) => [p.marcaId],
  categorias: (p) => [p.categoriaId],
  subcategorias: (p) => [p.subcategoriaId],
  etiquetas: (p) => p.etiquetas || [],
};
const ORDEN = {
  az: (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  za: (a, b) => b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' }),
  mas: (a, b) => b.productos - a.productos || ORDEN.az(a, b),
  menos: (a, b) => a.productos - b.productos || ORDEN.az(a, b),
};

/**
 * EL ALTA, en su ventanita: el nombre (y el color en etiquetas, la categoría en
 * subcategorías). Avisa si ya existe una igual —sin importar mayúsculas ni
 * tildes— antes de crear un duplicado que después hay que fusionar.
 */
function NuevoCatalogoModal({ tipo, meta, todas, categorias, categoriaInicial, onCerrar, store, toast }) {
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#2e7d32');
  const [categoriaId, setCategoriaId] = useState(categoriaInicial ?? null);
  const [creando, setCreando] = useState(false);
  const enVuelo = useRef(false);
  const igual = nombre.trim()
    ? todas.find((x) => norm(x.nombre) === norm(nombre.trim()) && (tipo !== 'subcategorias' || x.categoriaId === categoriaId))
    : null;
  const falta = !nombre.trim() || (tipo === 'subcategorias' && !categoriaId) || !!igual;

  const crear = async () => {
    if (falta || enVuelo.current) return;
    enVuelo.current = true; setCreando(true);
    const body = { nombre: nombre.trim() };
    if (tipo === 'subcategorias') body.categoriaId = categoriaId;
    if (tipo === 'etiquetas') body.color = color;
    try {
      const r = await store.crearCatalogo(tipo, body);
      if (r && r.ok === false) { toast(r.error || 'No se pudo.', 'err'); return; }
      toast(`${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} «${body.nombre}» creada.`, 'ok');
      onCerrar();
    } finally { enVuelo.current = false; setCreando(false); }
  };

  return (
    <ModalShell
      title={`Nueva ${meta.singular}`}
      onClose={onCerrar}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: creando ? 'Creando…' : 'Crear', clase: 'btn-primary', onClick: crear, disabled: falta || creando },
      ]}
    >
      {tipo === 'subcategorias' && (
        <div className={s.field}>
          <label htmlFor="catalogo-nuevo-categoria">Categoría <span className={s.req}>*</span></label>
          <select id="catalogo-nuevo-categoria" value={categoriaId ?? ''} onChange={(e) => setCategoriaId(Number(e.target.value) || null)}>
            <option value="">— Elegí la categoría —</option>
            {[...categorias].sort(ORDEN.az).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div className={s.field} style={{ flex: 1, marginBottom: 0 }}>
          <label htmlFor="catalogo-nuevo-nombre">Nombre <span className={s.req}>*</span></label>
          <input
            id="catalogo-nuevo-nombre" autoFocus value={nombre} placeholder={meta.placeholder}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } }}
          />
        </div>
        {tipo === 'etiquetas' && (
          <div className={s.field} style={{ marginBottom: 0, width: 74 }}>
            <label htmlFor="catalogo-nuevo-color">Color</label>
            <input id="catalogo-nuevo-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ padding: 3, height: 38 }} />
          </div>
        )}
      </div>
      {igual && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 8 }}>
          Ya existe «{igual.nombre}»{igual.activa ? '' : ' (inactiva: podés reactivarla)'}. No hace falta crearla de nuevo.
        </div>
      )}
    </ModalShell>
  );
}

export function CatalogoAdmin({ tipo }) {
  const { store, toast } = useProductos();
  const meta = META[tipo];

  const [creandoNueva, setCreandoNueva] = useState(false);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');           // '' | 'activas' | 'inactivas'
  const [uso, setUso] = useState('');                 // '' | 'con' | 'sin'
  const [orden, setOrden] = useState('az');
  const [catFiltro, setCatFiltro] = useState(null);   // solo subcategorías
  const [editId, setEditId] = useState(null);
  const [editTxt, setEditTxt] = useState('');
  const [fusionId, setFusionId] = useState(null);
  const [fusionHacia, setFusionHacia] = useState('');
  const [marcaModal, setMarcaModal] = useState(null);

  const categorias = store.state.catalogos.categorias;
  const todas = store.state.catalogos[tipo] || [];

  /* Cuántos productos (sin los archivados) usan cada valor: dice qué se puede
   * eliminar y qué conviene fusionar. */
  const usoPorId = useMemo(() => {
    const m = new Map();
    for (const p of store.state.productos) {
      if (p.estado === 'archivado') continue;
      for (const id of USO[tipo](p)) if (id != null) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [store.state.productos, tipo]);

  // En subcategorías se filtra además por categoría: sin eso se mezclan
  // "Tradicionales" de Alfajores y de Galletitas.
  const filas = useMemo(() => {
    const t = norm(q.trim());
    return todas
      .map((x) => ({ ...x, productos: usoPorId.get(x.id) ?? 0 }))
      .filter((x) => (tipo !== 'subcategorias' || !catFiltro || x.categoriaId === catFiltro)
        && (!estado || (estado === 'activas' ? x.activa : !x.activa))
        && (!uso || (uso === 'con' ? x.productos > 0 : x.productos === 0))
        && (!t || norm(x.nombre).includes(t)))
      .sort(ORDEN[orden]);
  }, [todas, usoPorId, tipo, catFiltro, estado, uso, q, orden]);
  const hayFiltro = !!(q.trim() || estado || uso || catFiltro);

  const nombreCategoria = (id) => categorias.find((c) => c.id === id)?.nombre ?? '—';

  /** Corre una mutación y avisa. Devuelve el resultado para poder encadenar. */
  const correr = async (promesa, okMsg) => {
    const r = await promesa;
    if (r && r.ok === false) { toast(r.error || 'No se pudo.', 'err'); return null; }
    toast(okMsg, 'ok');
    return r;
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

  /** Candidatas a destino de la fusión: las demás de la misma categoría, por nombre. */
  const destinos = (fila) => todas.filter((x) => x.id !== fila.id
    && (tipo !== 'subcategorias' || x.categoriaId === fila.categoriaId)).sort(ORDEN.az);

  return (
    <div>
      <div className={s.toolbar} style={{ marginBottom: 12 }}>
        <input
          id={`catalogo-buscar-${tipo}`} type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={`Buscar ${meta.singular}…`} style={{ minWidth: 220 }}
        />
        {tipo === 'subcategorias' && (
          <select className={s['select-inline']} value={catFiltro ?? ''} onChange={(e) => setCatFiltro(Number(e.target.value) || null)} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {[...categorias].sort(ORDEN.az).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
        <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Activas e inactivas</option>
          <option value="activas">Solo activas</option>
          <option value="inactivas">Solo {tipo === 'marcas' ? 'inhabilitadas' : 'inactivas'}</option>
        </select>
        <select className={s['select-inline']} value={uso} onChange={(e) => setUso(e.target.value)} aria-label="Uso">
          <option value="">Con y sin productos</option>
          <option value="con">Con productos</option>
          <option value="sin">Sin productos</option>
        </select>
        <select className={s['select-inline']} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Orden">
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="mas">Más productos primero</option>
          <option value="menos">Menos productos primero</option>
        </select>
        {hayFiltro && <Btn small onClick={() => { setQ(''); setEstado(''); setUso(''); setCatFiltro(null); }}>Limpiar</Btn>}
        <span className={s.hint} style={{ margin: 0 }}>{filas.length === todas.length ? `${todas.length} en total` : `${filas.length} de ${todas.length}`}</span>
        <span style={{ flex: 1 }} />
        <Btn variant="btn-primary" onClick={() => setCreandoNueva(true)}>+ Nueva {meta.singular}</Btn>
      </div>

      <table className={s.table}>
        <thead>
          <tr>
            <th>Nombre</th>
            {tipo === 'subcategorias' && <th>Categoría</th>}
            <th className={s.num}>Productos</th>
            <th>Estado</th>
            <th className={s['actions-col']}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr><td colSpan={5} className={s['empty-state']}>{hayFiltro ? 'Ninguna con esos filtros.' : `Sin ${meta.titulo.toLowerCase()}.`}</td></tr>
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
              <td className={s.num}>{f.productos || <span className={s.muted}>0</span>}</td>
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

      {creandoNueva && (
        <NuevoCatalogoModal
          tipo={tipo} meta={meta} todas={todas} categorias={categorias} categoriaInicial={catFiltro}
          store={store} toast={toast} onCerrar={() => setCreandoNueva(false)}
        />
      )}

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
