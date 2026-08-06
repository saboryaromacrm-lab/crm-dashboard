import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { useSeccion } from '../hooks/useSeccion.js';
import { num, fmtFechaHora } from '../domain/format.js';
import { Table, PanelHead, Btn, usePaginado, s } from '../components/ui.jsx';

/** Texto comparable: sin mayúsculas ni acentos. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function FraccionamientoPanel() {
  const { store, can, openModal } = useProductos();
  useSeccion('movimientos');
  const puede = can('fraccionar');
  const [q, setQ] = useState('');

  const ql = norm(q);
  const granel = store.state.stock
    .filter((st) => !st.presentacionId && st.estado === 'disponible' && st.cantidad > 1e-9 && store.getProducto(st.productoId).tipo === 'granel')
    .filter((st) => {
      if (!ql) return true;
      const p = store.getProducto(st.productoId);
      return norm(p.nombre).includes(ql) || norm(p.marca).includes(ql);
    });

  const pag = usePaginado(granel, 'fraccionamiento', q);

  const filas = pag.visibles.map((st) => {
      const p = store.getProducto(st.productoId), su = store.getSucursal(st.sucursalId);
      return (
        <tr key={st.id}>
          <td>{p.nombre}</td>
          <td>{su.nombre}</td>
          <td className={s.num}>{num(st.cantidad, 3)} kg</td>
          <td className={s['actions-col']}>
            {puede
              ? <Btn variant="btn-fracc" small onClick={() => openModal('fraccionar', { prodId: p.id, sucId: st.sucursalId })}>Fraccionar</Btn>
              : <span className={s.muted}>sin permiso</span>}
          </td>
        </tr>
      );
    });

  const hist = store.state.movimientos
    .filter((m) => m.tipo === 'fraccionamiento')
    .sort((a, b) => b.id - a.id)
    .slice(0, 8)
    .map((m) => (
      <tr key={m.id}>
        <td>{fmtFechaHora(m.fecha)}</td>
        <td>{m.productoNombre}</td>
        <td>{m.sucursalNombre}</td>
        <td>{m.descripcion}</td>
      </tr>
    ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Fraccionamiento"
        desc="Convertí granel en paquetes en la misma sucursal. Descuenta del stock a granel disponible."
      />
      <div className={s.toolbar}>
        <input
          type="search"
          placeholder="Buscar producto a granel por nombre o marca..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <h3 className={s['card-title']}>Granel disponible para fraccionar</h3>
      <Table
        cols={[{ h: 'Producto' }, { h: 'Sucursal' }, { h: 'Granel', num: true }, { h: '', cls: 'actions-col' }]}
        empty="No hay stock a granel disponible."
        pag={pag}
      >
        {filas}
      </Table>
      <h3 className={s['card-title']} style={{ marginTop: 12 }}>Fraccionamientos recientes</h3>
      <Table cols={[{ h: 'Fecha' }, { h: 'Producto' }, { h: 'Sucursal' }, { h: 'Detalle' }]} empty="Sin fraccionamientos aún.">
        {hist}
      </Table>
    </div>
  );
}
