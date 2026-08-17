import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { Table, PanelHead, Btn, usePaginado, s } from '../components/ui.jsx';

/**
 * Lo OPERATIVO de compras por proveedor: operaciones, costos por producto
 * (con la regla masiva), percepciones y cuenta. El ABM de la ficha (alta,
 * edición, baja, cta cte, echeq) vive en el MÓDULO Proveedores desde 0068 —
 * por eso acá no hay botones de alta ni edición.
 */
export function ProveedoresPanel() {
  const { store, openModal } = useProductos();
  const [q, setQ] = useState('');

  const ql = q.toLowerCase();
  const proveedores = store.state.proveedores.filter(
    (p) => !ql || p.nombre.toLowerCase().includes(ql) || (p.cuit || '').toLowerCase().includes(ql),
  );

  // Cuántos productos usan cada proveedor (referencias en datos comerciales).
  const usoDe = (provId) => store.state.productos.filter((p) => (p.formatosCompra || []).some((e) => e.proveedorId === provId)).length;

  const stop = (e) => e.stopPropagation();

  const pag = usePaginado(proveedores, 'proveedores', q);

  const filas = pag.visibles.map((p) => (
    <tr key={p.id} className={s.clickable} onClick={() => openModal('detalleProveedor', { provId: p.id })}>
      <td>{p.nombre}</td>
      <td className={s.mono}>{p.cuit || '—'}</td>
      <td>{p.telefono || '—'}</td>
      <td>{p.direccion || '—'}</td>
      <td className={s.num}>{usoDe(p.id)}</td>
      <td className={s['actions-col']}>
        <div className={s['row-actions']} onClick={stop}>
          <Btn small onClick={() => openModal('detalleProveedor', { provId: p.id })}>Ver</Btn>
        </div>
      </td>
    </tr>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Costos y percepciones"
        desc="Clic en una fila: operaciones, productos y costos (con la regla masiva), percepciones y cuenta. La ficha del proveedor (alta, edición, cómo cobra) se administra en el módulo Proveedores."
      />
      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar por nombre o CUIT..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Table
        cols={[
          { h: 'Nombre comercial' }, { h: 'CUIT' }, { h: 'Teléfono' }, { h: 'Dirección' },
          { h: 'Productos', num: true }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="No hay proveedores."
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}
