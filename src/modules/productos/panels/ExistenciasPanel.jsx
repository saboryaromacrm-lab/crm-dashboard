import { useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { money } from '../domain/format.js';
import { ESTADOS_STOCK } from '../domain/constants.js';
import { sucursalOptions, productoOptions } from '../components/selectOptions.jsx';
import { Table, PanelHead, TipoBadge, StockPill, Btn, usePaginado, s } from '../components/ui.jsx';

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
  const { store, openModal, goPanel } = useProductos();
  const puedeAjustar = store.can('inventario');
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
          <td className={s['actions-col']}>
            <div className={s['row-actions']}>
              {/* La película de ESTA fila (27/8): salta al historial con el
                  producto y la sucursal ya filtrados — quién lo tocó, cuándo y
                  por qué, sin cruzar de módulo. */}
              <Btn
                small
                variant="btn-ghost"
                onClick={() => goPanel('historial', { productoId: st.productoId, sucursalId: st.sucursalId })}
              >
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
        title="Existencias · Movimientos de stock"
        desc="Stock real por Producto × Sucursal × Presentación × Estado. Toda baja o alta genera un movimiento."
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
          { h: '', cls: 'actions-col' },
        ]}
        empty="Sin existencias con esos filtros."
        pag={pag}
      >
        {filas}
      </Table>
    </div>
  );
}
