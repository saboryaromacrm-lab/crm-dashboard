import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { useProductos } from '../context/ProductosContext.jsx';
import { money } from '../domain/format.js';
import { ESTADOS_STOCK } from '../domain/constants.js';
import { sucursalOptions, productoOptions } from '../components/selectOptions.jsx';
import { Table, PanelHead, TipoBadge, StockPill, Btn, usePaginado, s } from '../components/ui.jsx';
import { HistorialPanel } from './HistorialPanel.jsx';

/**
 * Existencias es consulta, con UNA excepción: el AJUSTE por fila (19/8/2026,
 * pedido del dueño). Vender es del POS, mover mercadería es de Transferencias
 * y las anomalías se cargan en Incidencias — cada acción vive en su circuito.
 *
 * Tampoco se ingresa mercadería (18/8/2026, pedido del dueño): la mercadería
 * entra por la FACTURA en Compras, que es la que trae el costo, el proveedor y
 * la deuda. El botón "+ Compra (ingreso)" que había acá sumaba stock sin papel
 * detrás: el mismo kilo podía entrar dos veces —una a mano y otra con la
 * factura— y el costo quedaba sin actualizar. Para el conteo sistemático de la
 * góndola está Control de stock.
 *
 * EL AJUSTE es otra cosa: la corrección puntual de UN número ("hay 11 y el
 * sistema dice 12") hecha por quien tiene la llave `inventario`, mirándolo.
 * Abre el movimiento manual de siempre —el del historial— prellenado con la
 * fila: producto, sucursal y presentación. Solo en filas DISPONIBLES: lo
 * comprometido/vencido/defectuoso tiene sus propios circuitos (transferencias,
 * vencimientos, incidencias) y ajustarlo desde acá los descuadraría.
 */
export function ExistenciasPanel() {
  const { store, openModal } = useProductos();
  const puedeAjustar = store.can('inventario');
  const [sucF, setSucF] = useState('');
  const [prodF, setProdF] = useState('');
  const [estadoF, setEstadoF] = useState('');
  /* La FOTO y la PELÍCULA como pestañas de la misma pantalla (27/8, pedido del
   * dueño). `movsPreset.k` cuenta los clics en "Movs." y va en la key del
   * historial embebido: sin remount, los useState del filtro no releerían el
   * preset de la nueva fila. */
  const [tab, setTab] = useState('stock');
  const [movsPreset, setMovsPreset] = useState(null);
  const irAMovs = (st) => {
    setMovsPreset({ productoId: st.productoId, sucursalId: st.sucursalId, k: (movsPreset?.k ?? 0) + 1 });
    setTab('movs');
  };

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
          <td className={s['actions-col']}>
            <div className={s['row-actions']}>
              {/* La película de ESTA fila: abre la pestaña Movimientos con el
                  producto y la sucursal ya filtrados — quién lo tocó, cuándo y
                  por qué. */}
              <Btn small variant="btn-ghost" onClick={() => irAMovs(st)}>
                Movs.
              </Btn>
              {puedeAjustar && st.estado === 'disponible' && (
                <Btn
                  small
                  onClick={() => openModal('movimiento', {
                    prodId: st.productoId,
                    sucId: st.sucursalId,
                    pre: { presId: st.presentacionId, tipo: 'ajuste' },
                  })}
                >
                  Ajustar
                </Btn>
              )}
            </div>
          </td>
        </tr>
      );
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Existencias"
        desc="La foto y la película del stock: lo que hay por Producto × Sucursal × Presentación × Estado, y en Movimientos el registro de toda alta o baja."
      />
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        <Tab value="stock" label="Existencias" sx={{ minHeight: 40 }} />
        <Tab value="movs" label="Movimientos" sx={{ minHeight: 40 }} />
      </Tabs>
      {tab === 'movs' ? (
        <HistorialPanel embedded preset={movsPreset} key={movsPreset?.k ?? 0} />
      ) : (
        <>
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
              { h: '', cls: 'actions-col' },
            ]}
            empty="Sin existencias con esos filtros."
            pag={pag}
          >
            {filas}
          </Table>
        </>
      )}
    </div>
  );
}
