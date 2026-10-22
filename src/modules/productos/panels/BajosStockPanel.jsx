import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { COLOR_PROVEEDOR, ESTADO_PRODUCTO } from '../domain/bajosStock.js';
import { unidadPedido } from '../domain/bulto.js';
import { fmtFecha, num } from '../domain/format.js';
import { norm } from '../components/CatalogoPicker.jsx';
import { Btn, PanelHead, Table, s } from '../components/ui.jsx';

/**
 * ALMACÉN › BAJOS EN STOCK (12/10/2026, pedido del dueño)
 * ============================================================================
 * Por PROVEEDOR: cuántos de sus productos están sin stock o bajos, y el % en
 * falta con su color (rojo desde el umbral, amarillo desde la mitad). Al abrir
 * uno, sus productos con lo que vende por día, cuántos días le alcanza, el
 * mínimo (automático por la venta, o a mano) y cuánto pedir en su bulto; y la
 * orden de pedido sale con eso ya cargado. La cuenta es `domain/bajosStock.js`
 * (la misma del globito del menú). Solo lee: el único dato que se guarda acá
 * es el mínimo a mano del producto.
 *
 * Los proveedores con un pedido en curso no se muestran salvo que se tilde
 * «Ver también los ya pedidos» (22/10/2026, pedido del dueño).
 */
const alcanzaTexto = (d) => (d == null ? 'no se vende' : d < 1 ? 'menos de 1 día' : `${Math.floor(d)} día${Math.floor(d) === 1 ? '' : 's'}`);

export function BajosStockPanel() {
  const { store, openModal, toast, can, isAdmin } = useProductos();
  const puedeMinimo = isAdmin || can('inventario') || can('compras.productos');
  /** '' = la Distribuidora (la del globito), 'todas', o el id de otra sucursal. */
  const [suc, setSuc] = useState('');
  const [otros, setOtros] = useState(null);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [color, setColor] = useState('');
  const [soloCtrl, setSoloCtrl] = useState(false);
  const [soloLocales, setSoloLocales] = useState(false);
  const [verPedidos, setVerPedidos] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const [verBien, setVerBien] = useState(false);
  const [minimos, setMinimos] = useState({});

  /* Al entrar, la venta fresca de la Distribuidora; otra sucursal se pide al elegirla. */
  useEffect(() => { store.refrescarBajos(true); }, [store]);
  useEffect(() => {
    if (!suc) { setOtros(null); return undefined; }
    let vivo = true;
    setOtros(undefined);
    store.datosBajos(suc).then((r) => {
      if (!vivo) return;
      if (r.ok) setOtros(r.data); else { setOtros(null); toast(r.error, 'err'); }
    });
    return () => { vivo = false; };
  }, [suc, store, toast]);

  const datos = suc ? otros : store.state.bajos;
  const { proveedores: analizados, yaPedidos } = store.analisisBajos(datos, soloCtrl, tipo, verPedidos);
  /* 0164: los colores y la lista, solo con los proveedores de la localidad. */
  const proveedores = soloLocales ? analizados.filter((g) => store.getProveedor(g.id)?.esLocal) : analizados;
  const nombreProv = (id) => (id ? store.getProveedor(id)?.nombre ?? `Proveedor #${id}` : 'Sin proveedor');
  const marcaDe = useMemo(() => new Map((store.state.catalogos?.marcas ?? []).map((m) => [m.id, m.nombre])), [store.state.catalogos]);

  const t = norm(q.trim());
  const visibles = proveedores.filter((g) => (!color || g.color === color)
    && (!t || norm(nombreProv(g.id)).includes(t) || g.filas.some((f) => norm(f.p.nombre).includes(t))));
  const cuenta = (c) => proveedores.filter((g) => g.color === c).length;
  const sucursales = store.state.sucursales.filter((x) => x.activa !== false);

  const guardarMinimo = async (f) => {
    const texto = minimos[f.p.id];
    if (texto == null) return;
    const valor = texto.trim() === '' ? 0 : Number(texto.replace(',', '.'));
    setMinimos((m) => { const r = { ...m }; delete r[f.p.id]; return r; });
    if (!Number.isFinite(valor) || valor < 0) { toast('El mínimo tiene que ser 0 o más.', 'err'); return; }
    if (valor === (f.manual ? f.minimo : 0)) return;
    const r = await store.guardarStockMinimo(f.p.id, valor);
    toast(r.ok ? (valor ? `Mínimo de ${f.p.nombre}: ${num(valor, 3)}.` : `${f.p.nombre} vuelve al mínimo automático.`) : r.error, r.ok ? 'ok' : 'err');
  };

  const pedir = (g) => openModal('ordenPedido', {
    proveedorId: g.id,
    sucursalId: datos?.sucursalId ?? null,
    sugeridos: Object.fromEntries(g.filas.filter((f) => f.pedir > 0).map((f) => [f.p.id, f.pedir])),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Bajos en stock"
        desc="Por proveedor: cuántos de sus productos están sin stock o por debajo del mínimo. Abrí uno para ver qué falta y armar la orden de pedido con eso ya cargado."
      />
      <div className={s.toolbar}>
        <select id="bajos-sucursal" className={s['select-inline']} value={suc} onChange={(e) => { setSuc(e.target.value); setAbierto(null); }} aria-label="Sucursal">
          {/* La del globito: la Distribuidora (o la propia, para quien ve solo su local). */}
          <option value="">{store.getSucursal(store.state.bajos?.sucursalId)?.nombre ?? 'Distribuidora'}</option>
          {isAdmin && <option value="todas">Todas las sucursales</option>}
          {isAdmin && sucursales.filter((x) => x.tipo !== 'distribuidora').map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <input id="bajos-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proveedor o producto…" style={{ minWidth: 220 }} />
        <select id="bajos-tipo" className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="">Enteros y granel</option>
          <option value="entero">Solo enteros</option>
          <option value="granel">Solo granel</option>
        </select>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }} title="Solo productos que ya pasaron por un control de stock o un ajuste en esa sucursal">
          <input id="bajos-controlados" type="checkbox" checked={soloCtrl} onChange={(e) => setSoloCtrl(e.target.checked)} />
          Solo productos ya controlados
        </label>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input id="bajos-locales" type="checkbox" checked={soloLocales} onChange={(e) => setSoloLocales(e.target.checked)} />
          Solo proveedores locales
        </label>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }} title="Los que tienen un pedido en curso en Proveedores › Pedidos: vuelven solos cuando el pedido se marca recibido">
          <input id="bajos-pedidos" type="checkbox" checked={verPedidos} onChange={(e) => setVerPedidos(e.target.checked)} />
          Ver también los ya pedidos{yaPedidos ? ` (${yaPedidos})` : ''}
        </label>
      </div>

      {datos === undefined || (!suc && !datos) ? (
        <div className={s.hint}>Calculando…</div>
      ) : !datos ? (
        <div className={cx(s.callout, s.warn)}>No se pudo traer la venta de esa sucursal.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {['rojo', 'amarillo', 'verde'].map((c) => {
              const activo = color === c;
              return (
                <button
                  key={c} type="button" onClick={() => setColor(activo ? '' : c)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    border: `2px solid ${COLOR_PROVEEDOR[c].color}`, color: activo ? '#fff' : COLOR_PROVEEDOR[c].color,
                    background: activo ? COLOR_PROVEEDOR[c].color : `color-mix(in srgb, ${COLOR_PROVEEDOR[c].color} 10%, var(--crm-color-surface))`,
                  }}
                >
                  {cuenta(c)} {COLOR_PROVEEDOR[c].label.toLowerCase()}
                </button>
              );
            })}
            <span className={s.hint} style={{ margin: 0 }}>
              Mínimo: lo que se vende en <strong>{datos.diasCobertura} días</strong> (venta de los últimos {datos.diasVenta}), o el cargado a mano.
              Rojo con <strong>{datos.umbralRojo}%</strong> o más de sus productos en falta; amarillo desde {datos.umbralRojo / 2}%.
              Se cambia en Almacén › Configuración.
            </span>
          </div>

          <Table
            cols={[{ h: 'Proveedor' }, { h: 'Productos', num: true }, { h: 'Sin stock', num: true }, { h: 'Bajos', num: true }, { h: 'En falta' }, { h: '', cls: 'actions-col' }]}
            empty={proveedores.length ? 'Ningún proveedor con esos filtros.' : 'No hay productos activos para mirar.'}
          >
            {visibles.flatMap((g) => {
              const c = COLOR_PROVEEDOR[g.color].color;
              const filas = [(
                <tr key={g.id} className={s.clickable} onClick={() => { setAbierto(abierto === g.id ? null : g.id); setVerBien(false); }}>
                  <td style={{ borderLeft: `4px solid ${c}` }}>
                    <strong>{nombreProv(g.id)}</strong> <span className={s.hint} style={{ margin: 0 }}>{abierto === g.id ? '▾' : '▸'}</span>
                    {g.pedido && <div className={s.hint} style={{ margin: 0, color: 'var(--crm-color-success)' }}>Pedido el {fmtFecha(g.pedido)}</div>}
                  </td>
                  <td className={cx(s.num, s.mono)}>{g.total}</td>
                  <td className={cx(s.num, s.mono)} style={{ color: g.sin ? ESTADO_PRODUCTO.sin.color : undefined }}>{g.sin}</td>
                  <td className={cx(s.num, s.mono)} style={{ color: g.bajos ? ESTADO_PRODUCTO.bajo.color : undefined }}>{g.bajos}</td>
                  <td style={{ minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--crm-color-border)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, g.pct)}%`, height: '100%', background: c }} />
                      </div>
                      <strong style={{ color: c, minWidth: 40, textAlign: 'right' }}>{Math.round(g.pct)}%</strong>
                    </div>
                  </td>
                  <td className={s['actions-col']} onClick={(e) => e.stopPropagation()}>
                    {g.id > 0 && <Btn small variant="btn-primary" onClick={() => pedir(g)}>Orden de pedido</Btn>}
                  </td>
                </tr>
              )];
              if (abierto === g.id) {
                const enFalta = g.filas.filter((f) => f.estado !== 'ok');
                const bien = g.filas.length - enFalta.length;
                const lista = verBien ? g.filas : enFalta;
                filas.push(
                  <tr key={`${g.id}-detalle`}>
                    <td colSpan={6} style={{ background: 'var(--crm-color-surface-2, transparent)', padding: '8px 12px' }}>
                      <table className={s.table} style={{ fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th>Producto</th><th className={s.num}>Stock</th><th className={s.num}>Vende/día</th><th>Le alcanza</th>
                            <th className={s.num}>Mínimo</th><th className={s.num}>Pedir</th><th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.map((f) => (
                            <tr key={f.p.id}>
                              <td>
                                {f.p.nombre}
                                {marcaDe.get(f.p.marcaId) && <div className={s.hint} style={{ margin: 0 }}>{marcaDe.get(f.p.marcaId)}</div>}
                              </td>
                              <td className={cx(s.num, s.mono)}>{store.fmtCant(f.p, null, f.stock)}</td>
                              <td className={cx(s.num, s.mono)}>{f.ventaDia > 0 ? num(f.ventaDia, f.p.tipo === 'granel' ? 2 : 1) : '—'}</td>
                              <td style={{ color: f.alcanza != null && f.alcanza < datos.diasCobertura ? ESTADO_PRODUCTO.bajo.color : undefined }}>{alcanzaTexto(f.alcanza)}</td>
                              <td className={s.num} style={{ whiteSpace: 'nowrap' }}>
                                {puedeMinimo ? (
                                  <input
                                    aria-label={`Mínimo de ${f.p.nombre}`} inputMode="decimal" style={{ width: 70, textAlign: 'right' }}
                                    value={minimos[f.p.id] ?? (f.manual ? String(f.minimo) : '')}
                                    placeholder={String(f.auto)}
                                    onChange={(e) => setMinimos((m) => ({ ...m, [f.p.id]: e.target.value.replace(/[^\d.,]/g, '') }))}
                                    onBlur={() => guardarMinimo(f)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                    title={f.manual ? `A mano. Automático: ${f.auto}. Vacío vuelve al automático.` : 'Automático por la venta. Escribí un número para fijarlo a mano.'}
                                  />
                                ) : num(f.minimo, 3)}
                                <div className={s.hint} style={{ margin: 0 }}>{f.manual ? 'a mano' : 'automático'}</div>
                              </td>
                              <td className={cx(s.num, s.mono)}>{f.pedir > 0 ? `${f.pedir} ${unidadPedido(f.p, f.bulto, f.pedir)}` : '—'}</td>
                              <td><strong style={{ color: ESTADO_PRODUCTO[f.estado].color }}>{ESTADO_PRODUCTO[f.estado].label}</strong></td>
                            </tr>
                          ))}
                          {!lista.length && <tr><td colSpan={7} className={s.hint}>Todos sus productos están bien.</td></tr>}
                        </tbody>
                      </table>
                      {bien > 0 && (
                        <button type="button" className={s.linkBtn} style={{ marginTop: 6 }} onClick={() => setVerBien((v) => !v)}>
                          {verBien ? 'Ver solo los que faltan' : `Ver también los ${bien} que están bien`}
                        </button>
                      )}
                    </td>
                  </tr>,
                );
              }
              return filas;
            })}
          </Table>
        </>
      )}
    </div>
  );
}
