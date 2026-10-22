import { deSaborYAroma } from '../domain/exclusivoCoffit.js';
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
 * productos activos con 0 o menos disponible y, de un granel, cada paquete en
 * 0 o en negativo (21/10/2026) — se arman aparte, porque no tienen fila de
 * stock con algo; y «Crear orden de pedido» abre la lista para pedirle al
 * proveedor lo que está por debajo de un número.
 *
 * FILTROS QUE SE ACOMODAN SOLOS (13/10/2026, pedido del dueño): un solo filtro
 * de stock (con / sin / los dos, con cuántos hay) y cada desplegable ofrece lo
 * que tiene resultados con los demás filtros puestos. Todo sale de UNA pasada
 * por las filas (ver `filtrar`).
 *
 * EN NEGATIVO (22/10/2026, pedido del dueño): cada fila DISPONIBLE que quedó
 * por debajo de 0 (−1, −2…), tal cual está en la base: un entero, el suelto de
 * un granel o un paquete. Es siempre un error a corregir (se vendió o se
 * fraccionó sin haberlo cargado), por eso entra aunque el producto ya no esté
 * activo, y ofrece «Ajustar» para dejarlo en lo que de verdad hay.
 */
/** El estado de las filas «sin stock»: no es un estado de una fila, es la falta de ella. */
const SIN_STOCK = 'sin_stock';
/** Las filas en negativo: se listan solas, con la opción «En negativo». */
const NEGATIVO = 'negativo';
/** El filtro de stock: con (lo que hay; por defecto), sin (0 o menos disponible), en negativo, o con y sin. */
const OPCIONES_STOCK = [['con', 'Con stock'], ['sin', 'Sin stock'], ['neg', 'En negativo'], ['', 'Con y sin stock']];
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
   * filtra por ese proveedor y abre su orden de pedido; `&volver=` es a dónde
   * vuelve al cerrarla (20/10/2026) — solo una ruta del propio ERP. Los
   * parámetros se sacan enseguida: volver atrás o recargar no la reabre. */
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const pid = params.get('ordenPedido');
    if (!pid) return;
    const volver = params.get('volver') ?? '';
    setProvF(pid);
    openModal('ordenPedido', { proveedorId: pid, ...(/^\/(?!\/)/.test(volver) ? { volverA: volver } : {}) });
    const resto = new URLSearchParams(params);
    resto.delete('ordenPedido');
    resto.delete('volver');
    setParams(resto, { replace: true });
  }, [params, setParams, openModal]);
  const { stock, proveedores, sucursales } = store.state;
  /* Sin lo de uso exclusivo de Coffit: su stock se ve y se ajusta en Almacén › Coffit › Depósito. */
  const productos = useMemo(() => store.state.productos.filter(deSaborYAroma), [store.state.productos]);
  const proveedoresMerc = useMemo(
    () => proveedores.filter((p) => p.proveeMercaderia).sort((a, b) => alfabetico(a.nombre, b.nombre)),
    [proveedores],
  );
  /* Por producto, una sola vez: tipo, marca y de qué proveedores es (sus formatos de compra). */
  const infoProd = useMemo(() => new Map(productos.map((p) => [p.id, {
    tipo: p.tipo, marca: p.marca || '', provs: new Set((p.formatosCompra || []).map((e) => e.proveedorId)),
  }])), [productos]);
  const conStock = useMemo(() => stock.filter((st) => st.cantidad > 1e-9 && infoProd.has(st.productoId)), [stock, infoProd]);
  const negativos = useMemo(() => stock
    .filter((st) => st.estado === 'disponible' && st.cantidad < -1e-9 && infoProd.has(st.productoId))
    .map((st) => ({ ...st, id: `neg-${st.id}`, estado: NEGATIVO })), [stock, infoProd]);
  /*
   * SIN STOCK, producto activo × sucursal activa:
   *   · el producto que en esa sucursal no tiene NADA disponible (el granel cuenta sus paquetes en kg);
   *   · y cada PAQUETE de un granel que ahí está en 0 o en negativo, aunque el producto tenga otros
   *     (21/10/2026, pedido del dueño: con «Con y sin stock» tienen que aparecer todos los paquetes en
   *     cada sucursal, aunque nunca hayan tenido stock). Así también se ve un paquete en negativo, que
   *     antes no aparecía en ningún lado: no tiene stock para «Con stock» y el producto sí tenía.
   */
  const faltantes = useMemo(() => {
    const disponible = indiceDisponible(stock, productos);
    const porPaquete = new Map();
    for (const st of stock) {
      if (st.estado !== 'disponible' || !st.presentacionId) continue;
      const k = `${st.productoId}:${st.sucursalId}:${st.presentacionId}`;
      porPaquete.set(k, (porPaquete.get(k) ?? 0) + st.cantidad);
    }
    const sucs = sucursales.filter((su) => su.activa !== false);
    const out = [];
    for (const p of productos) {
      if (p.estado !== 'activo') continue;
      for (const su of sucs) {
        const q = disponible(p.id, su.id);
        if (q <= 1e-9) out.push({ id: `sin-${p.id}-${su.id}`, productoId: p.id, sucursalId: su.id, presentacionId: null, estado: SIN_STOCK, cantidad: q });
        if (p.tipo !== 'granel') continue;
        for (const pr of p.presentaciones || []) {
          const qp = Math.round((porPaquete.get(`${p.id}:${su.id}:${pr.id}`) ?? 0) * 1000) / 1000;
          if (qp <= 1e-9) out.push({ id: `sin-${p.id}-${su.id}-${pr.id}`, productoId: p.id, sucursalId: su.id, presentacionId: pr.id, estado: SIN_STOCK, cantidad: qp });
        }
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
      ['stock', (r) => (r.estado === NEGATIVO ? stockF === 'neg' : stockF !== 'neg' && (!stockF || (stockF === 'sin') === (r.estado === SIN_STOCK)))],
      ['suc', (r) => !suc || r.sucursalId === suc],
      ['prod', (r) => !prod || r.productoId === prod],
      ['estado', (r) => !estadoF || r.estado === estadoF],
      ['tipo', (r, i) => !tipoF || i?.tipo === tipoF],
      ['prov', (r, i) => !provIds || (!!i && cruza(i.provs, provIds))],
      ['marca', (r, i) => !marcaF || i?.marca === marcaF],
      ['texto', (r) => coincideTexto(r.productoId)],
    ];
    const op = { stock: { con: 0, sin: 0, neg: 0 }, estado: new Map(), prod: new Set(), prov: new Set(), marca: new Set() };
    const salen = [];
    for (const lista of [conStock, faltantes, negativos]) {
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
        const sin = r.estado === SIN_STOCK, neg = r.estado === NEGATIVO;
        if (!falla || falla === 'stock') op.stock[neg ? 'neg' : sin ? 'sin' : 'con'] += 1;
        if ((!falla || falla === 'estado') && !sin && !neg) op.estado.set(r.estado, (op.estado.get(r.estado) ?? 0) + 1);
        if (!falla || falla === 'prod') op.prod.add(r.productoId);
        if (info && (!falla || falla === 'prov')) for (const id of info.provs) op.prov.add(id);
        if (info?.marca && (!falla || falla === 'marca')) op.marca.add(info.marca);
      }
    }
    /* Producto, sucursal y, dentro, el suelto primero y los paquetes en orden: con y sin stock quedan juntos. */
    salen.sort((a, b) => a.productoId - b.productoId || a.sucursalId - b.sucursalId || (a.presentacionId ?? 0) - (b.presentacionId ?? 0));
    return { entradas: salen, op, marcas: [...op.marca].sort(alfabetico) };
  }, [conStock, faltantes, negativos, infoProd, stockF, sucF, prodF, estadoF, tipoF, provIds, marcaF, coincideTexto]);
  const { entradas, op } = filtrar;
  const provsVisibles = proveedoresMerc.filter((p) => op.prov.has(p.id) || String(p.id) === provF);
  const cambiarStock = (v) => { setStockF(v); if (v === 'sin' || v === 'neg') setEstadoF(''); };

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
      const falta = st.estado === SIN_STOCK || st.estado === NEGATIVO;
      return (
        <tr key={st.id}>
          {puedeLote && <CasillaLote sel={sel} id={st.productoId} nombre={p.nombre} alternar={alternar} />}
          <td>{p.nombre} <TipoBadge prod={p} /></td>
          <td>{su.nombre}</td>
          <td>{store.presLabel(p, st.presentacionId)}</td>
          <td>{falta ? <Pill pill="st-defectuoso" label={st.cantidad < -1e-9 ? 'En negativo' : 'Sin stock'} /> : <StockPill estado={st.estado} />}</td>
          <td className={s.num}>{store.fmtCant(p, st.presentacionId, st.cantidad)}</td>
          <td className={s.num}>{falta ? '—' : money(store.valorEntry(st))}</td>
          <td className={s['actions-col']}>
            <div className={s['row-actions']}>
              {/* La película de ESTA fila: abre la pestaña Movimientos con el
                  producto y la sucursal ya filtrados — quién lo tocó, cuándo y
                  por qué. */}
              <Btn small variant="btn-ghost" onClick={() => irAMovs(st)}>
                Movs.
              </Btn>
              {puedeAjustar && (st.estado === 'disponible' || falta) && (
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
              {!falta && puedeDescartar(st.estado) && (
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
            <select id="exist-stock" className={s['select-inline']} value={stockF} onChange={(e) => cambiarStock(e.target.value)} aria-label="Stock" title="Sin stock: 0 o menos disponible · En negativo: por debajo de 0, hay que ajustarlo">
              {OPCIONES_STOCK.map(([v, label]) => (
                <option key={v} value={v}>{label} ({v ? op.stock[v] : op.stock.con + op.stock.sin})</option>
              ))}
            </select>
            <select
              id="exist-estado" className={s['select-inline']} value={estadoF} onChange={(e) => setEstadoF(e.target.value)} aria-label="Estado"
              disabled={stockF === 'sin' || stockF === 'neg'} title={stockF === 'sin' || stockF === 'neg' ? 'Lo que no tiene stock no tiene estado' : undefined}
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
            empty={stockF === 'sin' ? 'Ningún producto sin stock con esos filtros.' : stockF === 'neg' ? 'Ningún producto en negativo con esos filtros.' : 'Sin existencias con esos filtros.'}
            pag={pag}
          >
            {filas}
          </Table>
        </>
      )}
    </div>
  );
}
