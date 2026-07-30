import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { num } from '../domain/format.js';
import { Table, PanelHead, TipoBadge, Btn, s } from '../components/ui.jsx';

export function ProductosPanel() {
  const { store, isAdmin, openModal } = useProductos();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');

  const ql = q.toLowerCase();
  const productos = store.state.productos.filter(
    (p) => (!ql || p.nombre.toLowerCase().includes(ql) || p.categoria.toLowerCase().includes(ql)) && (!tipo || p.tipo === tipo),
  );

  const stop = (e) => e.stopPropagation();

  const filas = productos.map((p) => {
    const base = p.tipo === 'granel'
      ? store.suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
      : store.suma({ productoId: p.id, estado: 'disponible' });
    return (
      <tr key={p.id} className={s.clickable} onClick={() => openModal('detalleProducto', { prodId: p.id })}>
        <td>{p.id}</td>
        <td>{p.nombre}</td>
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
                <Btn variant="btn-delete" small onClick={() => openModal('eliminarProducto', { prodId: p.id })}>Eliminar</Btn>
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
        actions={isAdmin && <Btn variant="btn-primary" onClick={() => openModal('producto', {})}>+ Nuevo producto</Btn>}
      />
      <div className={s.toolbar}>
        <input type="search" placeholder="Buscar producto o categoría..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="granel">A granel</option>
          <option value="entero">Enteros</option>
        </select>
      </div>
      <Table
        cols={[
          { h: 'ID' }, { h: 'Producto' }, { h: 'Marca' }, { h: 'Tipo' }, { h: 'Categoría' },
          { h: 'IVA', num: true }, { h: 'Disp. (base)', num: true },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="No hay productos."
      >
        {filas}
      </Table>
    </div>
  );
}
