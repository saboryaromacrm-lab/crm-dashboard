import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { money } from '../domain/format.js';
import { ESTADOS_STOCK } from '../domain/constants.js';
import { sucursalOptions, productoOptions } from '../components/selectOptions.jsx';
import { Table, PanelHead, TipoBadge, StockPill, Btn, usePaginado, s } from '../components/ui.jsx';

/**
 * Existencias es CONSULTA pura: acá se mira el stock, no se opera. Vender es
 * del POS, mover mercadería es de Transferencias y las anomalías se cargan en
 * Incidencias — cada acción vive en su circuito, con sus validaciones.
 */
export function ExistenciasPanel() {
  const { store, isAdmin, openModal } = useProductos();
  const [sucF, setSucF] = useState('');
  const [prodF, setProdF] = useState('');
  const [estadoF, setEstadoF] = useState('');

  const entradas = store.state.stock
    .filter((st) => st.cantidad > 1e-9)
    .filter((st) => {
      if (sucF && st.sucursalId !== parseInt(sucF, 10)) return false;
      if (prodF && st.productoId !== parseInt(prodF, 10)) return false;
      if (estadoF && st.estado !== estadoF) return false;
      return true;
    })
    .sort((a, b) => a.productoId - b.productoId || a.sucursalId - b.sucursalId);

  const pag = usePaginado(entradas, 'existencias', `${sucF}|${prodF}|${estadoF}`);

  const filas = pag.visibles.map((st) => {
      const p = store.getProducto(st.productoId), su = store.getSucursal(st.sucursalId);
      return (
        <tr key={st.id}>
          <td>{p.nombre} <TipoBadge prod={p} /></td>
          <td>{su.nombre}</td>
          <td>{store.presLabel(p, st.presentacionId)}</td>
          <td><StockPill estado={st.estado} /></td>
          <td className={s.num}>{store.fmtCant(p, st.presentacionId, st.cantidad)}</td>
          <td className={s.num}>{money(store.valorEntry(st))}</td>
        </tr>
      );
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Existencias · Movimientos de stock"
        desc="Stock real por Producto × Sucursal × Presentación × Estado. Toda baja o alta genera un movimiento."
        actions={isAdmin && <Btn variant="btn-ingreso" onClick={() => openModal('compra', {})}>+ Compra (ingreso)</Btn>}
      />
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={sucF} onChange={(e) => setSucF(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursalOptions(store, false)}
        </select>
        <select className={s['select-inline']} value={prodF} onChange={(e) => setProdF(e.target.value)}>
          <option value="">Todos los productos</option>
          {productoOptions(store, false)}
        </select>
        <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADOS_STOCK).map((k) => <option key={k} value={k}>{ESTADOS_STOCK[k].label}</option>)}
        </select>
      </div>
      <Table
        cols={[
          { h: 'Producto' }, { h: 'Sucursal' }, { h: 'Present.' },
          { h: 'Estado' }, { h: 'Cantidad', num: true }, { h: 'Valor', num: true },
        ]}
        empty="Sin existencias con esos filtros."
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}
