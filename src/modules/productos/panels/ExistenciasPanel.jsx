import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Tab } from '@mui/material';
import { proveedoresDelFiltro, SOLO_LOCALES } from '@shared/utils/proveedorLocal.js';
import { OpcionLocales } from '@shared/components/OpcionLocales.jsx';
import { useProductos } from '../context/ProductosContext.jsx';
import { money } from '../domain/format.js';
import { ESTADOS_STOCK } from '../domain/constants.js';
import { indiceDisponible } from '../domain/bulto.js';
import { sucursalOptions, productoOptions } from '../components/selectOptions.jsx';
import { FiltroProductoControles } from '../components/FiltroProducto.jsx';
import { useFiltroProducto } from '../hooks/useFiltroProducto.js';
import { Table, PanelHead, TipoBadge, StockPill, Pill, Btn, usePaginado, s } from '../components/ui.jsx';
import { HistorialPanel } from './HistorialPanel.jsx';
import { BarraLote, CasillaLote, CasillaTodos } from '../components/AccionesLote.jsx';
import { useSeleccionLote } from '../hooks/useSeleccionLote.js';

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
 *
 * FILTROS QUE SE ACOMODAN SOLOS (13/10/2026, pedido del dueño): un solo filtro
 * de stock (con / sin / los dos, con cuántos hay) y cada desplegable ofrece lo
 * que tiene resultados con los demás filtros puestos. Todo sale de UNA pasada
 * por las filas (ver `filtrar`).
 */
/** El estado de las filas «sin stock»: no es un estado de una fila, es la falta de ella. */
const SIN_STOCK = 'sin_stock';
/** El filtro de stock: con (lo que hay; por defecto), sin (0 o menos disponible) o los dos. */
const OPCIONES_STOCK = [['con', 'Con stock'], ['sin', 'Sin stock'], ['', 'Con y sin stock']];
const cruza = (a, b) => { for (const x of a) if (b.has(x)) return true; return false; };
const alfabetico = (a, b) => a.localeCompare(b, 'es');

export function ExistenciasPanel() {
  const { store, openModal } = useProductos();
  const puedeAjustar = store.can('inventario');
  /* ACCIONES EN LOTE (13/10/2026, como WooCommerce): se tildan PRODUCTOS (un
   * producto en varias sucursales o presentaciones se tilda una vez) y se les
   * aplica una acción. La misma llave que editar la ficha y darla de baja. */
  const puedeLote = store.can('compras.productos');
  const { sel, alternar, limpiar } = useSeleccionLote();
  /* Tirar lo vencido pide `merma`; lo defectuoso, `defectuoso` — las mismas
   * llaves que marcarlo así. */
  const puedeDescartar = (estado) => (estado === 'vencido' ? store.can('merma') : estado === 'defectuoso' ? store.can('defectuoso') : false);
  const [sucF, setSucF] = useState('');
  const [prodF, setProdF] = useState('');
  const [estadoF, setEstadoF] = useState('');
  const [provF, setProvF] = useState('');
  const [tipoF, setTipoF] = useState('');
  const [stockF, setStockF] = useState('con');
  const fp = useFiltroProducto(store);
  const { marca: marcaF, coincideTexto } = fp;
  /* Desde Proveedores › Pedidos («Ver stock», 12/10/2026): `?ordenPedido=ID`
   * filtra por ese proveedor y abre su orden de pedido. El parámetro se saca
   * enseguida: volver atrás o recargar no la reabre. */
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const pid = params.get('ordenPedido');
    if (!pid) return;
    setProvF(pid);
    openModal('ordenPedido', { proveedorId: pid });
    const resto = new URLSearchParams(params);
    resto.delete('ordenPedido');
    setParams(resto, { replace: true });
  }, [params, setParams, openModal]);
  const { productos, stock, proveedores, sucursales } = store.state;
  const proveedoresMerc = useMemo(
    () => proveedores.filter((p) => p.proveeMercaderia).sort((a, b) => alfabetico(a.nombre, b.nombre)),
    [proveedores],
  );
  /* Por producto, una sola vez: tipo, marca y de qué proveedores es (sus formatos de compra). */
  const infoProd = useMemo(() => new Map(productos.map((p) => [p.id, {
    tipo: p.tipo, marca: p.marca || '', provs: new Set((p.formatosCompra || []).map((e) => e.proveedorId)),
  }])), [productos]);
  const conStock = useMemo(() => stock.filter((st) => st.cantidad > 1e-9), [stock]);
  /* Sin stock: producto activo × sucursal activa con 0 o menos disponible (en kg el granel, con sus paquetes). */
  const faltantes = useMemo(() => {
    const disponible = indiceDisponible(stock, productos);
    const sucs = sucursales.filter((su) => su.activa !== false);
    const out = [];
    for (const p of productos) {
      if (p.estado !== 'activo') continue;
      for (const su of sucs) {
        const q = disponible(p.id, su.id);
        if (q <= 1e-9) out.push({ id: `sin-${p.id}-${su.id}`, productoId: p.id, sucursalId: su.id, presentacionId: null, estado: SIN_STOCK, cantidad: q });
      }
    }
    return out;
  }, [stock, productos, sucursales]);
  const provIds = useMemo(() => proveedoresDelFiltro(provF, proveedores), [provF, proveedores]);

  /*
   * UNA PASADA para la tabla y para todos los desplegables. Cada fila anota el
   * filtro que la deja afuera: si no la deja afuera ninguno, va a la tabla; si
   * la deja afuera UNO solo, igual cuenta para las opciones de ESE filtro. Así
   * cada desplegable ofrece lo que hay con todos los demás filtros puestos.
   */
  const filtrar = useMemo(() => {
    const suc = sucF ? Number(sucF) : null;
    const prod = prodF ? Number(prodF) : null;
    const pruebas = [
      ['stock', (r) => !stockF || (stockF === 'sin') === (r.estado === SIN_STOCK)],
      ['suc', (r) => !suc || r.sucursalId === suc],
      ['prod', (r) => !prod || r.productoId === prod],
      ['estado', (r) => !estadoF || r.estado === estadoF],
      ['tipo', (r, i) => !tipoF || i?.tipo === tipoF],
      ['prov', (r, i) => !provIds || (!!i && cruza(i.provs, provIds))],
      ['marca', (r, i) => !marcaF || i?.marca === marcaF],
      ['texto', (r) => coincideTexto(r.productoId)],
    ];
    const op = { stock: { con: 0, sin: 0 }, estado: new Map(), prod: new Set(), prov: new Set(), marca: new Set() };
    const salen = [];
    for (const lista of [conStock, faltantes]) {
      for (const r of lista) {
        const info = infoProd.get(r.productoId);
        let falla = null;
        let fallas = 0;
        for (const [k, ok] of pruebas) {
          if (ok(r, info)) continue;
          falla = k;
          if (++fallas > 1) break;
        }
        if (fallas > 1) continue;
        if (!falla) salen.push(r);
        const sin = r.estado === SIN_STOCK;
        if (!falla || falla === 'stock') op.stock[sin ? 'sin' : 'con'] += 1;
        if ((!falla || falla === 'estado') && !sin) op.estado.set(r.estado, (op.estado.get(r.estado) ?? 0) + 1);
        if (!falla || falla === 'prod') op.prod.add(r.productoId);
        if (info && (!falla || falla === 'prov')) for (const id of info.provs) op.prov.add(id);
        if (info?.marca && (!falla || falla === 'marca')) op.marca.add(info.marca);
      }
    }
    salen.sort((a, b) => a.productoId - b.productoId || a.sucursalId - b.sucursalId);
    return { entradas: salen, op, marcas: [...op.marca].sort(alfabetico) };
  }, [conStock, faltantes, infoProd, stockF, sucF, prodF, estadoF, tipoF, provIds, marcaF, coincideTexto]);
  const { entradas, op } = filtrar;
  const provsVisibles = proveedoresMerc.filter((p) => op.prov.has(p.id) || String(p.id) === provF);
  const cambiarStock = (v) => { setStockF(v); if (v === 'sin') setEstadoF(''); };

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

  const pag = usePaginado(entradas, 'existencias', `${sucF}|${prodF}|${estadoF}|${provF}|${tipoF}|${stockF}|${fp.clave}`);

  const idsPagina = [...new Set(pag.visibles.map((st) => st.productoId))];
  const idsFiltro = useMemo(() => [...new Set(entradas.map((st) => st.productoId))], [entradas]);

  const filas = pag.visibles.map((st) => {
      const p = store.getProducto(st.productoId), su = store.getSucursal(st.sucursalId);
      return (
        <tr key={st.id}>
          {puedeLote && <CasillaLote sel={sel} id={st.productoId} nombre={p.nombre} alternar={alternar} />}
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
          <Btn variant="btn-primary" onClick={() => openModal('ordenPedido', { proveedorId: provF === SOLO_LOCALES ? '' : provF, sucursalId: sucF ? parseInt(sucF, 10) : null })}>
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
            <FiltroProductoControles f={fp} id="exist" marcas={filtrar.marcas} />
            <select id="exist-proveedor" className={s['select-inline']} value={provF} onChange={(e) => setProvF(e.target.value)} aria-label="Proveedor">
              <option value="">Todos los proveedores</option>
              <OpcionLocales proveedores={provsVisibles} />
              {provsVisibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select className={s['select-inline']} value={sucF} onChange={(e) => setSucF(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursalOptions(store, false)}
            </select>
            <select className={s['select-inline']} value={prodF} onChange={(e) => setProdF(e.target.value)}>
              <option value="">Todos los productos</option>
              {productoOptions(store, false, null, (p) => String(p.id) === prodF || op.prod.has(p.id))}
            </select>
            <select id="exist-tipo" className={s['select-inline']} value={tipoF} onChange={(e) => setTipoF(e.target.value)} aria-label="Tipo">
              <option value="">Enteros y granel</option>
              <option value="entero">Solo enteros</option>
              <option value="granel">Solo granel</option>
            </select>
            <select id="exist-stock" className={s['select-inline']} value={stockF} onChange={(e) => cambiarStock(e.target.value)} aria-label="Stock" title="Sin stock: 0 o menos disponible">
              {OPCIONES_STOCK.map(([v, label]) => (
                <option key={v} value={v}>{label} ({v ? op.stock[v] : op.stock.con + op.stock.sin})</option>
              ))}
            </select>
            <select
              id="exist-estado" className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)} aria-label="Estado"
              disabled={stockF === 'sin'} title={stockF === 'sin' ? 'Lo que no tiene stock no tiene estado' : undefined}
            >
              <option value="">Todos los estados</option>
              {Object.keys(ESTADOS_STOCK).filter((k) => op.estado.has(k) || k === estadoF).map((k) => (
                <option key={k} value={k}>{ESTADOS_STOCK[k].label} ({op.estado.get(k) ?? 0})</option>
              ))}
            </select>
          </div>
          {puedeLote && <BarraLote id="exist-lote-accion" sel={sel} idsFiltro={idsFiltro} alternar={alternar} limpiar={limpiar} />}
          <Table
            cols={[
              ...(puedeLote ? [{ h: <CasillaTodos sel={sel} ids={idsPagina} alternar={alternar} /> }] : []),
              { h: 'Producto' }, { h: 'Sucursal' }, { h: 'Present.' },
              { h: 'Estado' }, { h: 'Cantidad', num: true }, { h: 'Valor', num: true },
              { h: '', cls: 'actions-col' },
            ]}
            empty={stockF === 'sin' ? 'Ningún producto sin stock con esos filtros.' : 'Sin existencias con esos filtros.'}
            pag={pag}
          >
            {filas}
          </Table>
        </>
      )}
    </div>
  );
}
