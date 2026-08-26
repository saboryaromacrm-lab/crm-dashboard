import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { Table, PanelHead, Btn, usePaginado, s } from '../components/ui.jsx';

/**
 * Lo OPERATIVO de compras por proveedor: operaciones, costos por producto
 * (con la regla masiva), percepciones y cuenta. El ABM de la ficha (alta,
 * edición, baja, cta cte, echeq) vive en el MÓDULO Proveedores desde 0068 —
 * por eso acá no hay botones de alta ni edición.
 *
 * MIGRACIÓN (26/8): esta lista es además el tablero del administrativo que
 * está pasando el catálogo del sistema viejo, proveedor por proveedor. La
 * columna Migración muestra el avance ("35 de 64": formatos de compra
 * cargados contra los productos que el proveedor tiene allá) y el tilde
 * manual de "terminé con este" — manual a propósito: el número viejo puede
 * incluir discontinuados que nunca van a migrar; el que sabe si está
 * completo es el que carga.
 */
export function ProveedoresPanel() {
  const { store, openModal, toast } = useProductos();
  const [q, setQ] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);

  // Cuántos productos usan cada proveedor (referencias en datos comerciales).
  const usoDe = (provId) => store.state.productos.filter((p) => (p.formatosCompra || []).some((e) => e.proveedorId === provId)).length;

  const ql = q.toLowerCase();
  const proveedores = store.state.proveedores.filter(
    (p) => (!ql || p.nombre.toLowerCase().includes(ql) || (p.cuit || '').toLowerCase().includes(ql))
      && (!soloPendientes || !p.migracionLista),
  );

  const stop = (e) => e.stopPropagation();

  const marcarMigracion = async (p, lista) => {
    const r = await store.marcarMigracionProveedor(p.id, lista);
    if (!r.ok) toast(r.error || 'No se pudo guardar.', 'err');
  };

  const pag = usePaginado(proveedores, 'proveedores', `${q}|${soloPendientes}`);

  const filas = pag.visibles.map((p) => {
    const cargados = usoDe(p.id);
    const esperados = Number(p.productosEsperados) || 0;
    const color = p.migracionLista
      ? 'var(--crm-color-success)'
      : cargados === 0 ? 'var(--crm-color-text-muted)' : 'var(--crm-color-warning, #b45309)';
    return (
      <tr key={p.id} className={s.clickable} onClick={() => openModal('detalleProveedor', { provId: p.id })}>
        <td>{p.nombre}</td>
        <td className={s.mono}>{p.cuit || '—'}</td>
        <td>{p.telefono || '—'}</td>
        <td className={s.num}>{cargados}</td>
        <td onClick={stop}>
          {/* El avance contra el sistema viejo + el tilde de "terminé". */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={!!p.migracionLista}
              onChange={(e) => marcarMigracion(p, e.target.checked)}
            />
            <span style={{ fontWeight: 600, color }}>
              {p.migracionLista
                ? '✓ Completa'
                : esperados > 0 ? `${cargados} de ${esperados}` : (cargados > 0 ? `${cargados} cargados` : 'Sin empezar')}
            </span>
          </label>
        </td>
        <td className={s['actions-col']}>
          <div className={s['row-actions']} onClick={stop}>
            <Btn small onClick={() => openModal('detalleProveedor', { provId: p.id })}>Ver</Btn>
          </div>
        </td>
      </tr>
    );
  });

  const pendientes = store.state.proveedores.filter((p) => !p.migracionLista).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Costos y percepciones"
        desc="Clic en una fila: operaciones, productos y costos (con la regla masiva), percepciones y cuenta. La ficha del proveedor (alta, edición, cómo cobra) se administra en el módulo Proveedores."
        actions={<Btn onClick={() => openModal('importarProveedores', {})}>Importar proveedores</Btn>}
      />
      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar por nombre o CUIT..." value={q} onChange={(e) => setQ(e.target.value)} />
        <label className={cx(s.hint)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Solo migración pendiente ({pendientes})
        </label>
      </div>
      <Table
        cols={[
          { h: 'Nombre comercial' }, { h: 'CUIT' }, { h: 'Teléfono' },
          { h: 'Productos', num: true }, { h: 'Migración' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="No hay proveedores."
        pag={pag}
      >
        {filas}
      </Table>
      <div className={s.hint}>
        <strong>Migración</strong>: cuántos productos de este proveedor ya tienen su formato de
        compra cargado, contra los que tiene en el sistema viejo (columna “Productos asociados”
        de su export). El tilde es manual: lo marca quien carga cuando da el catálogo por
        terminado — el número viejo puede incluir discontinuados que no van a migrar.
      </div>
    </div>
  );
}
