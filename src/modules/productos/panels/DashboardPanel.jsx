import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, num, fmtFechaHora } from '../domain/format.js';
import { Table, Stat, MovTag, s } from '../components/ui.jsx';

function DashCard({ title, panelId, cols, rows, empty }) {
  const { goPanel, panels } = useProductos();
  const canGo = panels.some((p) => p.id === panelId);
  return (
    <div className={cx(s.card, s.cardPad)}>
      <h3 className={s['card-title']}>
        {title}
        {canGo && <span className={s.link} onClick={() => goPanel(panelId)}>Ver todo →</span>}
      </h3>
      <Table cols={cols} empty={empty}>{rows}</Table>
    </div>
  );
}

export function DashboardPanel() {
  const { store } = useProductos();

  let valor = 0; let comprometidoVal = 0;
  store.state.stock.forEach((st) => {
    if (st.estado === 'disponible') valor += store.valorEntry(st);
    if (st.estado === 'comprometido') comprometidoVal += store.valorEntry(st);
  });
  const bajo = store.stockBajo();
  const comprometidos = store.state.stock.filter((st) => st.estado === 'comprometido' && st.cantidad > 1e-9);

  const filasSuc = store.state.sucursales.map((su) => {
    let v = 0; const prods = {};
    store.state.stock.forEach((st) => {
      if (st.sucursalId === su.id && st.estado === 'disponible' && st.cantidad > 1e-9) { v += store.valorEntry(st); prods[st.productoId] = 1; }
    });
    return (
      <tr key={su.id}>
        <td>{su.nombre}</td>
        <td><span className={cx(s.pill, s[su.tipo === 'distribuidora' ? 'st-retenido' : 'st-disponible'])}>{su.tipo === 'distribuidora' ? 'Distribuidora' : 'Express'}</span></td>
        <td className={s.num}>{Object.keys(prods).length}</td>
        <td className={s.num}>{money(v)}</td>
      </tr>
    );
  });

  const filasBajo = bajo.slice(0, 6).map((p) => {
    const base = p.tipo === 'granel'
      ? store.suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
      : store.suma({ productoId: p.id, estado: 'disponible' });
    return (
      <tr key={p.id}>
        <td>{p.nombre}</td>
        <td className={cx(s.num, s['stock-low'])}>{num(base, 2)}{p.tipo === 'granel' ? ' kg' : ' u.'}</td>
        <td className={cx(s.num, s.muted)}>mín {p.stockMin}</td>
      </tr>
    );
  });

  const filasComp = comprometidos.slice(0, 6).map((st) => {
    const p = store.getProducto(st.productoId), su = store.getSucursal(st.sucursalId);
    return (
      <tr key={st.id}>
        <td>{p.nombre}</td>
        <td>{su.nombre}</td>
        <td>{store.presLabel(p, st.presentacionId)}</td>
        <td className={s.num}>{store.fmtCant(p, st.presentacionId, st.cantidad)}</td>
      </tr>
    );
  });

  const ultimos = store.state.movimientos.slice().sort((a, b) => b.id - a.id).slice(0, 6).map((m) => (
    <tr key={m.id}>
      <td>{fmtFechaHora(m.fecha)}</td>
      <td><MovTag tipo={m.tipo} /></td>
      <td>{m.descripcion}</td>
    </tr>
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-5)' }}>
      <div className={s.stats}>
        <Stat label="Valor inventario (disp.)" value={money(valor)} accent="accent-green" />
        <Stat label="Productos" value={store.state.productos.length} />
        <Stat label="Stock bajo" value={bajo.length} accent={bajo.length ? 'accent-red' : undefined} />
        <Stat label="Valor comprometido" value={money(comprometidoVal)} accent={comprometidoVal ? 'accent-amber' : undefined} />
      </div>

      <div className={s['dash-grid']}>
        <DashCard title="Stock por sucursal" panelId="existencias"
          cols={[{ h: 'Sucursal' }, { h: 'Tipo' }, { h: 'Productos', num: true }, { h: 'Valor disp.', num: true }]} rows={filasSuc} />
        <DashCard title="Stock bajo" panelId="productos"
          cols={[{ h: 'Producto' }, { h: 'Disp.', num: true }, { h: 'Mínimo', num: true }]} rows={filasBajo} empty="Todo por encima del mínimo ✅" />
        <DashCard title="Stock comprometido" panelId="existencias"
          cols={[{ h: 'Producto' }, { h: 'Sucursal' }, { h: 'Present.' }, { h: 'Cant.', num: true }]} rows={filasComp} empty="Sin stock comprometido" />
        <DashCard title="Últimos movimientos" panelId="historial"
          cols={[{ h: 'Fecha' }, { h: 'Tipo' }, { h: 'Detalle' }]} rows={ultimos} empty="Sin movimientos." />
      </div>
    </div>
  );
}
