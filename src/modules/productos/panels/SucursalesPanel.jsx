import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money } from '../domain/format.js';
import { Table, PanelHead, Btn, s } from '../components/ui.jsx';

export function SucursalesPanel() {
  const { store, isAdmin, openModal } = useProductos();

  const filasSuc = store.state.sucursales.map((su) => {
    let v = 0; const prods = {};
    store.state.stock.forEach((st) => {
      if (st.sucursalId === su.id && st.estado === 'disponible' && st.cantidad > 1e-9) { v += store.valorEntry(st); prods[st.productoId] = 1; }
    });
    return (
      <tr key={su.id}>
        <td>{su.nombre}</td>
        <td><span className={cx(s.pill, s[su.tipo === 'distribuidora' ? 'st-retenido' : 'st-disponible'])}>{su.tipo === 'distribuidora' ? 'Mayorista + Minorista' : 'Minorista'}</span></td>
        <td className={s.num}>{Object.keys(prods).length}</td>
        <td className={s.num}>{money(v)}</td>
      </tr>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Sucursales"
        desc="1 Distribuidora (mayorista + minorista) y locales Express (minorista). La mercadería ingresa por la Distribuidora."
        actions={isAdmin && <Btn variant="btn-primary" onClick={() => openModal('sucursal', {})}>+ Nueva sucursal</Btn>}
      />
      <Table cols={[{ h: 'Sucursal' }, { h: 'Modalidad' }, { h: 'Productos', num: true }, { h: 'Valor disp.', num: true }]}>
        {filasSuc}
      </Table>
    </div>
  );
}
