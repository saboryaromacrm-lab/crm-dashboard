import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { num } from '../domain/format.js';
import {
  Table, PanelHead, TipoBadge, EstadoProductoBadge, Btn, usePaginado, s,
} from '../components/ui.jsx';

/** Texto comparable: sin mayúsculas ni acentos. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Los discontinuados que ya se agotaron: el sistema los DETECTA y los propone,
 * no los archiva solo. Archivar en el acto de vender la última unidad rompería
 * al cajero (el catálogo del POS se carga al abrir la caja) y una devolución o
 * la anulación de ese mismo ticket devolvería el stock. El camino de vuelta sí
 * es automático: si reaparece stock, el producto se reabre solo.
 */
function AvisoParaArchivar() {
  const { store, act } = useProductos();
  const [datos, setDatos] = useState(null);
  const version = store.getVersion?.() ?? 0;

  useEffect(() => {
    let vivo = true;
    store.sugerenciasArchivado()
      .then((r) => { if (vivo) setDatos(r); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [store, version]);

  const lista = datos?.productos ?? [];
  if (!lista.length) return null;

  const archivar = () => act(
    store.archivarLote(lista.map((p) => p.id)),
    `${lista.length === 1 ? 'Producto archivado' : `${lista.length} productos archivados`}.`,
  );

  return (
    <div className={cx(s.callout, s.info)} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>
        <strong>
          {lista.length === 1
            ? 'Un producto discontinuado se agotó'
            : `${lista.length} productos discontinuados se agotaron`}
        </strong>{' '}
        y {lista.length === 1 ? 'no tuvo' : 'no tuvieron'} movimiento en {datos.diasGracia} días:{' '}
        {lista.slice(0, 4).map((p) => p.nombre).join(', ')}
        {lista.length > 4 ? ` y ${lista.length - 4} más` : ''}.{' '}
        {lista.length === 1 ? 'Archivarlo lo saca' : 'Archivarlos los saca'} del catálogo
        (se {lista.length === 1 ? 'puede' : 'pueden'} reactivar).
      </span>
      <Btn variant="btn-primary" small onClick={archivar}>
        Archivar {lista.length === 1 ? 'el producto' : `los ${lista.length}`}
      </Btn>
    </div>
  );
}

export function ProductosPanel() {
  const { store, isAdmin, openModal } = useProductos();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  /**
   * Por defecto el listado muestra lo que ESTÁ EN JUEGO (activo +
   * discontinuado): el archivado ya no se compra ni se vende, y tenerlo
   * mezclado obliga a leer un catálogo lleno de cosas que no existen. Se ve
   * eligiéndolo en el filtro — que es también el camino para reactivarlo.
   */
  const [estadoF, setEstadoF] = useState('vigentes');

  /** Opciones de los filtros, derivadas del catálogo ya cargado (sin red). */
  const opciones = useMemo(() => {
    const marcas = new Set();
    const categorias = new Set();
    for (const p of store.state.productos) {
      if (p.marca) marcas.add(p.marca);
      if (p.categoria) categorias.add(p.categoria);
    }
    return { marcas: [...marcas].sort(), categorias: [...categorias].sort() };
  }, [store.state.productos]);

  const productos = useMemo(() => {
    const ql = norm(q);
    const provId = proveedorId ? Number(proveedorId) : null;
    return store.state.productos.filter((p) => {
      const est = p.estado || 'activo';
      if (estadoF === 'vigentes' && est === 'archivado') return false;
      if (estadoF !== 'vigentes' && estadoF !== '' && est !== estadoF) return false;
      if (tipo && p.tipo !== tipo) return false;
      if (marca && p.marca !== marca) return false;
      if (categoria && p.categoria !== categoria) return false;
      if (provId && !(p.formatosCompra || []).some((e) => e.proveedorId === provId)) return false;
      if (!ql) return true;
      return norm(p.nombre).includes(ql) || norm(p.marca).includes(ql)
        || norm(p.categoria).includes(ql) || (p.codigoBarras || '').includes(q.trim())
        // También por el código de barras de un fraccionado: cada tamaño lleva
        // etiqueta propia y es lo que la balanza o la caja escanean.
        || (p.presentaciones || []).some((pr) => pr.codigoBarras && pr.codigoBarras.includes(q.trim()));
    });
  }, [store.state.productos, q, tipo, marca, categoria, proveedorId, estadoF]);

  /*
   * CADA FRACCIONADO ES UNA FILA PROPIA (decisión del dueño, 9/8/2026): el
   * Ajo X500G se busca y se abre como un producto más, debajo de su madre.
   * El listado pasa de ~94 a ~167 filas — a cambio, lo que se escanea existe.
   */
  const filasLista = useMemo(() => {
    const out = [];
    for (const p of productos) {
      out.push({ clave: `p${p.id}`, p, pr: null });
      if (p.tipo === 'granel') {
        for (const pr of (p.presentaciones || [])) out.push({ clave: `f${pr.id}`, p, pr });
      }
    }
    return out;
  }, [productos]);

  const hayFiltro = !!(q || tipo || marca || categoria || proveedorId || estadoF !== 'vigentes');
  const stop = (e) => e.stopPropagation();

  const pag = usePaginado(filasLista, 'productos', `${q}|${tipo}|${marca}|${categoria}|${proveedorId}|${estadoF}`);

  const filas = pag.visibles.map(({ clave, p, pr }) => {
    if (pr) {
      const disp = store.suma({ productoId: p.id, presentacionId: pr.id, estado: 'disponible' });
      return (
        <tr key={clave} className={s.clickable} onClick={() => openModal('fraccionado', { prodId: p.id, presId: pr.id })}>
          <td className={s.muted}>{p.id}</td>
          <td>
            <span className={s.muted}>↳ </span>{p.nombre} · {store.presLabel(p, pr.id)}
          </td>
          <td>{p.marca || '—'}</td>
          <td><span className={cx(s.badge, s['badge-granel'])}>Fraccionado</span></td>
          <td>{p.categoria}</td>
          <td className={s.num}>{num(p.iva ?? 21, 1)}%</td>
          <td className={s.num}>{num(disp, 0)} paq.</td>
          <td className={s['actions-col']}><span className={s.muted}>—</span></td>
        </tr>
      );
    }
    const base = p.tipo === 'granel'
      ? store.suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
      : store.suma({ productoId: p.id, estado: 'disponible' });
    return (
      <tr key={clave} className={s.clickable} onClick={() => openModal('detalleProducto', { prodId: p.id })}>
        <td>{p.id}</td>
        <td>
          {p.nombre}
          <EstadoProductoBadge estado={p.estado} />
        </td>
        <td>{p.marca || '—'}</td>
        <td><TipoBadge prod={p} /></td>
        <td>{p.categoria}</td>
        <td className={s.num}>{num(p.iva ?? 21, 1)}%</td>
        <td className={s.num}>{num(base, 2)}{p.tipo === 'granel' ? ' kg' : ' u.'}</td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={stop}>
            {isAdmin ? (
              <>
                <Btn variant="btn-edit" small onClick={() => openModal('producto', { prodId: p.id })}>Editar</Btn>
                {(p.estado || 'activo') === 'activo' ? (
                  <Btn small onClick={() => openModal('bajaProducto', { prodId: p.id })}>Dar de baja</Btn>
                ) : (
                  <Btn variant="btn-ingreso" small onClick={() => openModal('bajaProducto', { prodId: p.id })}>
                    Reactivar
                  </Btn>
                )}
              </>
            ) : (
              <span className={s.muted}>—</span>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Productos"
        desc="Catálogo. Clic en una fila para ver el detalle, stock por sucursal y trazabilidad."
        actions={isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => openModal('margenesMasivos', { productos })}>Actualizar márgenes</Btn>
            <Btn onClick={() => openModal('importarCatalogo', {})}>Importar catálogo</Btn>
            <Btn variant="btn-primary" onClick={() => openModal('producto', {})}>+ Nuevo producto</Btn>
          </div>
        )}
      />
      {isAdmin && <AvisoParaArchivar />}
      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar por nombre, marca o código..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s['select-inline']} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {opciones.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={s['select-inline']} value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="">Todas las marcas</option>
          {opciones.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={s['select-inline']} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {store.state.proveedores
            .filter((p) => p.proveeMercaderia !== false)
            .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {/* El estado: por defecto lo que está en juego. Acá se llega a los
            archivados, que es el camino para reactivar uno. */}
        <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
          <option value="vigentes">En juego (activos + discontinuados)</option>
          <option value="activo">Solo activos</option>
          <option value="discontinuado">Solo discontinuados</option>
          <option value="archivado">Solo archivados</option>
          <option value="">Todos, incluso archivados</option>
        </select>
        <select className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="granel">A granel</option>
          <option value="entero">Enteros</option>
        </select>
        {hayFiltro && (
          <Btn small onClick={() => { setQ(''); setTipo(''); setMarca(''); setCategoria(''); setProveedorId(''); }}>
            Limpiar
          </Btn>
        )}
      </div>
      {hayFiltro && (
        <div className={s.hint} style={{ margin: 0 }}>
          {productos.length} de {store.state.productos.length} productos.
          {isAdmin && ' «Actualizar márgenes» alcanza solo a los filtrados.'}
        </div>
      )}
      <Table
        cols={[
          { h: 'ID' }, { h: 'Producto' }, { h: 'Marca' }, { h: 'Tipo' }, { h: 'Categoría' },
          { h: 'IVA', num: true }, { h: 'Disp. (base)', num: true },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="No hay productos."
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}
