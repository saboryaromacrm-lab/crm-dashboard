import { useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { useProductos } from '../context/ProductosContext.jsx';
import { money } from '../domain/format.js';
import { ESTADOS_STOCK } from '../domain/constants.js';
import { indiceDisponible } from '../domain/bulto.js';
import { sucursalOptions, productoOptions } from '../components/selectOptions.jsx';
import { FiltroProductoControles } from '../components/FiltroProducto.jsx';
import { useFiltroProducto } from '../hooks/useFiltroProducto.js';
import { Table, PanelHead, TipoBadge, StockPill, Pill, Btn, usePaginado, s } from '../components/ui.jsx';
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
 *
 * PROVEEDOR, SIN STOCK Y ORDEN DE PEDIDO (12/10/2026, pedido del dueño): el
 * filtro de proveedor mira sus formatos de compra; «Sin stock» lista los
 * productos activos con 0 o menos disponible (no tienen fila de stock, por eso
 * se arman aparte); y «Crear orden de pedido» abre la lista para pedirle al
 * proveedor lo que está por debajo de un número.
 */
/** El estado «Sin stock» del filtro: no es un estado de una fila, es la falta de ella. */
const SIN_STOCK = 'sin_stock';
export function ExistenciasPanel() {
  const { store, openModal } = useProductos();
  const puedeAjustar = store.can('inventario');
  /* Tirar lo vencido pide `merma`; lo defectuoso, `defectuoso` — las mismas
   * llaves que marcarlo así. */
  const puedeDescartar = (estado) => (estado === 'vencido' ? store.can('merma') : estado === 'defectuoso' ? store.can('defectuoso') : false);
  const [sucF, setSucF] = useState('');
  const [prodF, setProdF] = useState('');
  const [estadoF, setEstadoF] = useState('');
  const [provF, setProvF] = useState('');
  /* Tipo y «solo con stock» (12/10/2026, pedido del dueño): el tipo acota la
   * tabla y la lista de productos; el tilde deja en esa lista solo lo que tiene
   * stock disponible (en la sucursal elegida, o en cualquiera). */
  const [tipoF, setTipoF] = useState('');
  const [conStockF, setConStockF] = useState(false);
  const fp = useFiltroProducto(store);
  const { productos, stock, proveedores, sucursales } = store.state;
  const delProveedor = useMemo(() => (provF
    ? new Set(productos.filter((p) => (p.formatosCompra || []).some((e) => String(e.proveedorId) === provF)).map((p) => p.id))
    : null), [productos, provF]);
  const proveedoresMerc = useMemo(
    () => proveedores.filter((p) => p.proveeMercaderia).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [proveedores],
  );
  const sinStock = estadoF === SIN_STOCK;
  const conDisponible = useMemo(() => {
    if (!conStockF || sinStock) return null;
    const suc = sucF ? parseInt(sucF, 10) : null;
    return new Set(stock.filter((st) => st.estado === 'disponible' && st.cantidad > 1e-9 && (!suc || st.sucursalId === suc)).map((st) => st.productoId));
  }, [conStockF, sinStock, stock, sucF]);
  /** Si el producto pasa los filtros de producto (buscador, marca, proveedor, tipo y «solo con stock»). */
  const pasaProducto = (id) => {
    if (!fp.coincide(id) || (delProveedor && !delProveedor.has(id)) || (conDisponible && !conDisponible.has(id))) return false;
    return !tipoF || store.getProducto(id)?.tipo === tipoF;
  };
  /* Sin stock: producto activo × sucursal activa con 0 o menos disponible (en kg el granel, con sus paquetes). */
  const faltantes = useMemo(() => {
    if (!sinStock) return [];
    const disponible = indiceDisponible(stock, productos);
    const sucs = sucursales.filter((su) => su.activa !== false && (!sucF || su.id === parseInt(sucF, 10)));
    const out = [];
    for (const p of productos) {
      if (p.estado !== 'activo') continue;
      for (const su of sucs) {
        const q = disponible(p.id, su.id);
        if (q <= 1e-9) out.push({ id: `sin-${p.id}-${su.id}`, productoId: p.id, sucursalId: su.id, presentacionId: null, estado: SIN_STOCK, cantidad: q });
      }
    }
    return out;
  }, [sinStock, stock, productos, sucursales, sucF]);
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

  const entradas = (sinStock ? faltantes : stock.filter((st) => st.cantidad > 1e-9))
    .filter((st) => {
      if (sucF && st.sucursalId !== parseInt(sucF, 10)) return false;
      if (prodF && st.productoId !== parseInt(prodF, 10)) return false;
      if (estadoF && !sinStock && st.estado !== estadoF) return false;
      return pasaProducto(st.productoId);
    })
    .sort((a, b) => a.productoId - b.productoId || a.sucursalId - b.sucursalId);

  const pag = usePaginado(entradas, 'existencias', `${sucF}|${prodF}|${estadoF}|${provF}|${tipoF}|${conStockF}|${fp.clave}`);

  const filas = pag.visibles.map((st) => {
      const p = store.getProducto(st.productoId), su = store.getSucursal(st.sucursalId);
      return (
        <tr key={st.id}>
          <td>{p.nombre} <TipoBadge prod={p} /></td>
          <td>{su.nombre}</td>
          <td>{store.presLabel(p, st.presentacionId)}</td>
          <td>{st.estado === SIN_STOCK ? <Pill pill="st-defectuoso" label="Sin stock" /> : <StockPill estado={st.estado} />}</td>
          <td className={s.num}>{store.fmtCant(p, st.presentacionId, st.cantidad)}</td>
          <td className={s.num}>{st.estado === SIN_STOCK ? '—' : money(store.valorEntry(st))}</td>
          <td className={s['actions-col']}>
            <div className={s['row-actions']}>
              {/* La película de ESTA fila: abre la pestaña Movimientos con el
                  producto y la sucursal ya filtrados — quién lo tocó, cuándo y
                  por qué. */}
              <Btn small variant="btn-ghost" onClick={() => irAMovs(st)}>
                Movs.
              </Btn>
              {puedeAjustar && (st.estado === 'disponible' || st.estado === SIN_STOCK) && (
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
              {st.estado !== SIN_STOCK && puedeDescartar(st.estado) && (
                <Btn small variant="btn-delete" onClick={() => openModal('descartarEstado', { stockId: st.id })}>
                  Descartar
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
        actions={(
          <Btn variant="btn-primary" onClick={() => openModal('ordenPedido', { proveedorId: provF, sucursalId: sucF ? parseInt(sucF, 10) : null })}>
            Crear orden de pedido
          </Btn>
        )}
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
            <FiltroProductoControles f={fp} id="exist" />
            <select id="exist-proveedor" className={s['select-inline']} value={provF} onChange={(e) => setProvF(e.target.value)} aria-label="Proveedor">
              <option value="">Todos los proveedores</option>
              {proveedoresMerc.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select className={s['select-inline']} value={sucF} onChange={(e) => setSucF(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursalOptions(store, false)}
            </select>
            <select className={s['select-inline']} value={prodF} onChange={(e) => setProdF(e.target.value)}>
              <option value="">Todos los productos</option>
              {productoOptions(store, false, null, (p) => String(p.id) === prodF || pasaProducto(p.id))}
            </select>
            <select id="exist-tipo" className={s['select-inline']} value={tipoF} onChange={(e) => setTipoF(e.target.value)} aria-label="Tipo">
              <option value="">Enteros y granel</option>
              <option value="entero">Solo enteros</option>
              <option value="granel">Solo granel</option>
            </select>
            <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, opacity: sinStock ? 0.5 : 1 }} title={sinStock ? 'No aplica con «Sin stock»' : 'La lista de productos muestra solo los que tienen stock disponible'}>
              <input id="exist-con-stock" type="checkbox" checked={conStockF && !sinStock} disabled={sinStock} onChange={(e) => setConStockF(e.target.checked)} />
              Solo con stock
            </label>
            <select className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.keys(ESTADOS_STOCK).map((k) => <option key={k} value={k}>{ESTADOS_STOCK[k].label}</option>)}
              <option value={SIN_STOCK}>Sin stock (0 o menos)</option>
            </select>
          </div>
          <Table
            cols={[
              { h: 'Producto' }, { h: 'Sucursal' }, { h: 'Present.' },
              { h: 'Estado' }, { h: 'Cantidad', num: true }, { h: 'Valor', num: true },
              { h: '', cls: 'actions-col' },
            ]}
            empty={sinStock ? 'Ningún producto sin stock con esos filtros.' : 'Sin existencias con esos filtros.'}
            pag={pag}
          >
            {filas}
          </Table>
        </>
      )}
    </div>
  );
}
