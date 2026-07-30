import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { Table, PanelHead, Btn, s } from '../components/ui.jsx';

export function ProveedoresPanel() {
  const { store, isAdmin, openModal } = useProductos();
  const [q, setQ] = useState('');

  const ql = q.toLowerCase();
  const proveedores = store.state.proveedores.filter(
    (p) => !ql || p.nombre.toLowerCase().includes(ql) || (p.cuit || '').toLowerCase().includes(ql),
  );

  // Cuántos productos usan cada proveedor (referencias en datos comerciales).
  const usoDe = (provId) => store.state.productos.filter((p) => (p.proveedores || []).some((e) => e.proveedorId === provId)).length;

  const filas = proveedores.map((p) => (
    <tr key={p.id}>
      <td>{p.nombre}</td>
      <td className={s.mono}>{p.cuit || '—'}</td>
      <td>{p.telefono || '—'}</td>
      <td>{p.direccion || '—'}</td>
      <td className={s.num}>{usoDe(p.id)}</td>
      <td className={s['actions-col']}>
        <div className={s['row-actions']}>
          {isAdmin ? (
            <>
              <Btn variant="btn-edit" small onClick={() => openModal('proveedorForm', { provId: p.id })}>Editar</Btn>
              <Btn variant="btn-delete" small onClick={() => openModal('eliminarProveedor', { provId: p.id })}>Eliminar</Btn>
            </>
          ) : (
            <span className={s.muted}>—</span>
          )}
        </div>
      </td>
    </tr>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Proveedores"
        desc="Alta, edición y baja de proveedores. Los costos de cada producto por proveedor se definen en el detalle del producto."
        actions={isAdmin && <Btn variant="btn-primary" onClick={() => openModal('proveedorForm', {})}>+ Nuevo proveedor</Btn>}
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
      >
        {filas}
      </Table>
    </div>
  );
}
