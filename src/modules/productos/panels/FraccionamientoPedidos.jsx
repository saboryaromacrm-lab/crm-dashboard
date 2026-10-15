/**
 * FRACCIONAMIENTO › PEDIDOS DISTRIBUIDORA (0169, 15/10/2026, pedido del dueño)
 * ============================================================================
 * La Distribuidora se pide paquetes a sí misma: qué armar para su góndola. Es
 * una lista guardada, que se imprime como la de los locales y NO mueve stock.
 * El fraccionador la carga con «Cargar lo fraccionado» (el registro de siempre,
 * precargado): ahí se mueve el stock y el pedido queda hecho, en una sola
 * operación. Lo fraccionado de verdad sale de ese registro.
 */
import { useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { cuerpoListaPreparacion, imprimirDocumento } from '@core/services/imprimir.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { num, fmtTam } from '../domain/format.js';
import { ModalShell } from '../components/Modal.jsx';
import { Table, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const esEntero = (v) => /^\d+$/.test(String(v ?? '').trim());
/** Lo tipeado en la casilla de un paquete, si es un entero; si no, 0. */
const pedidoDe = (cants, prId) => (esEntero(cants[prId]) ? Number(cants[prId]) : 0);
/** Paquetes con stock bajo: 6 o menos (pedido del dueño, 15/10/2026). */
const STOCK_BAJO = 6;
/** Los tildes de stock: sin ninguno, todo; con alguno, los paquetes que cumplen alguno. */
/** Enter en una casilla «Pedir» pasa a la siguiente de la tabla (y la deja seleccionada para tipear encima). */
const alSiguiente = (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const todas = [...e.currentTarget.closest('table').querySelectorAll('input[id^="pf-cant-"]')];
  const sig = todas[todas.indexOf(e.currentTarget) + 1];
  if (sig) { sig.focus(); sig.select(); }
};
const pasaStock = (sinStock, stockBajo, stock) => (!sinStock && !stockBajo) || (sinStock && stock <= 0) || (stockBajo && stock <= STOCK_BAJO);
/** [nombre, cuántos productos] de una clave (categoría o subcategoría), con lo elegido siempre presente. */
const opcionesDe = (lista, clave, elegida) => {
  const m = new Map(elegida ? [[elegida, 0]] : []);
  for (const x of lista) if (x.p[clave]) m.set(x.p[clave], (m.get(x.p[clave]) ?? 0) + 1);
  return [...m].sort((a, b) => a[0].localeCompare(b[0], 'es'));
};
const fecha = (v) => (v ? new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

/** La hoja del fraccionador: la planilla única del que prepara, igual a la del pedido entre sucursales. */
function imprimirPedidoFraccion(pedido, distribuidora) {
  return imprimirDocumento('listaPreparacion', {
    titulo: `${pedido.codigo} — Pedido de fraccionado`,
    cuerpo: cuerpoListaPreparacion({
      titulo: `${pedido.codigo} · Pedido de fraccionado — ${distribuidora?.nombre ?? 'Distribuidora'}`,
      sub: [
        `Para la góndola · armado por ${pedido.usuario || '—'} el ${fecha(pedido.creadoEn)} · ${num(pedido.kg, 3)} kg de granel · impreso ${new Date().toLocaleString('es-AR')} · tildá lo fraccionado y cargalo al volver`,
        ...(pedido.observaciones ? [`Observaciones: ${pedido.observaciones}`] : []),
      ],
      filas: pedido.items.map((it) => ({ producto: it.nombre, paquete: fmtTam(it.tamKg), pedido: num(it.paquetes, 0) })),
      total: num(pedido.paquetes, 0),
    }),
  });
}

/* ============================== LA PESTAÑA ============================== */

export function TabPedidosDistribuidora({ datos, error, recargar }) {
  const { store, can, isAdmin, openModal, toast } = useProductos();
  const [abierto, setAbierto] = useState(null);
  const [descartando, setDescartando] = useState(null);
  const enVuelo = useRef(false);
  const dist = datos?.distribuidora;
  const pedidos = datos?.pedidos ?? [];
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente');
  const hechos = pedidos.filter((p) => p.estado === 'hecho');
  /* El granel que se ve es el de la sesión: fuera de la Distribuidora (salvo administración) no se arma ni se carga. */
  const enDistribuidora = !!dist && (isAdmin || store.state.ctx.sucursalId === dist.id);
  const puedePedir = can('pedidos') && enDistribuidora;
  const puedeCargar = can('fraccionar') && enDistribuidora;

  const descartar = async (p) => {
    if (descartando !== p.id) { setDescartando(p.id); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    const r = await store.descartarPedidoFraccion(p.id);
    enVuelo.current = false;
    setDescartando(null);
    if (!r.ok) { toast(r.error || 'No se pudo descartar.', 'err'); return; }
    toast(`${p.codigo} descartado.`, 'ok');
    recargar();
  };

  const cargar = (p) => openModal('registrarFraccionado', {
    sucId: dist.id,
    pedido: { id: p.id, codigo: p.codigo },
    inicial: p.items.filter((it) => it.presentacionId).map((it) => ({ productoId: it.productoId, presId: it.presentacionId, cant: it.paquetes })),
    onRegistrado: recargar,
  });

  const detalle = (p) => (
    <tr key={`${p.id}-items`}>
      <td colSpan={6} style={{ background: 'var(--crm-color-surface-2)' }}>
        <table className={s.table} style={{ width: '100%' }}>
          <thead><tr><th>Producto</th><th>Paquete</th><th className={s.num}>Pedido</th>{p.estado === 'hecho' && <th className={s.num}>Fraccionado</th>}</tr></thead>
          <tbody>
            {p.items.map((it) => (
              <tr key={it.id}>
                <td>{it.nombre}</td>
                <td>{fmtTam(it.tamKg)}</td>
                <td className={s.num}>{num(it.paquetes, 0)}</td>
                {p.estado === 'hecho' && (
                  <td className={s.num} style={{ color: it.fraccionados < it.paquetes ? 'var(--crm-color-danger)' : undefined }}>
                    {num(it.fraccionados, 0)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {p.observaciones && <div className={s.hint}>Observaciones: {p.observaciones}</div>}
      </td>
    </tr>
  );

  const fila = (p, acciones, cuando) => [
    <tr key={p.id} className={s.clickable} onClick={() => setAbierto(abierto === p.id ? null : p.id)} title="Ver los renglones">
      <td>{abierto === p.id ? '▾ ' : '▸ '}<strong>{p.codigo}</strong></td>
      <td>{cuando}</td>
      <td className={s.num}>{num(p.items.length, 0)}</td>
      <td className={s.num}>{num(p.paquetes, 0)}</td>
      <td className={s.num}>{num(p.kg, 3)} kg</td>
      <td className={s['actions-col']} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{acciones}</div>
      </td>
    </tr>,
    abierto === p.id && detalle(p),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className={s.hint} style={{ margin: 0, flex: 1, minWidth: 240 }}>
          Lo que la {dist?.nombre ?? 'Distribuidora'} se pide a sí misma para su góndola. Pedir no mueve stock:
          se mueve cuando el fraccionador toca <strong>Cargar lo fraccionado</strong>, y ahí el pedido queda hecho.
        </div>
        {puedePedir && (
          <Btn variant="btn-primary" onClick={() => openModal('pedidoFraccion', { distribuidora: dist, onGuardado: recargar })}>Nuevo pedido</Btn>
        )}
      </div>
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      {dist && !enDistribuidora && (
        <div className={cx(s.callout, s.warn)}>Estos pedidos son de la {dist.nombre}: para armarlos o cargarlos, entrá con esa sucursal.</div>
      )}

      <div className={s['mini-label']}>Pendientes ({pendientes.length})</div>
      <Table cols={[{ h: 'Pedido' }, { h: 'Armado' }, { h: 'Renglones', num: true }, { h: 'Paquetes', num: true }, { h: 'Granel', num: true }, { h: '' }]} empty={datos ? 'No hay pedidos pendientes.' : 'Cargando…'}>
        {pendientes.flatMap((p) => fila(p, [
          <Btn key="imp" small onClick={() => imprimirPedidoFraccion(p, dist)}>Imprimir</Btn>,
          puedeCargar && <Btn key="cargar" small variant="btn-primary" onClick={() => cargar(p)}>Cargar lo fraccionado</Btn>,
          puedePedir && <Btn key="ed" small onClick={() => openModal('pedidoFraccion', { distribuidora: dist, pedido: p, onGuardado: recargar })}>Editar</Btn>,
          puedePedir && (
            <Btn key="desc" small variant={descartando === p.id ? 'btn-delete' : undefined} onClick={() => descartar(p)} onBlur={() => setDescartando(null)}>
              {descartando === p.id ? '¿Descartar? Sí' : 'Descartar'}
            </Btn>
          ),
        ], `${fecha(p.creadoEn)} · ${p.usuario || '—'}`))}
      </Table>

      {hechos.length > 0 && (
        <>
          <div className={s['mini-label']}>Últimos hechos</div>
          <Table cols={[{ h: 'Pedido' }, { h: 'Hecho' }, { h: 'Renglones', num: true }, { h: 'Paquetes', num: true }, { h: 'Granel', num: true }, { h: '' }]}>
            {hechos.flatMap((p) => {
              const fracc = p.items.reduce((a, it) => a + (it.fraccionados ?? 0), 0);
              return fila(p, [
                fracc < p.paquetes && <Pill key="dif" pill="est-pendiente" label={`se fraccionaron ${num(fracc, 0)} de ${num(p.paquetes, 0)}`} />,
                <Btn key="imp" small onClick={() => imprimirPedidoFraccion(p, dist)}>Imprimir</Btn>,
              ], `${fecha(p.hechoEn)} · ${p.hechoPor || '—'}`);
            })}
          </Table>
        </>
      )}
    </div>
  );
}

/* ============================ ARMAR EL PEDIDO ============================ */

/**
 * Los granel de la Distribuidora con sus paquetes: granel suelto, paquetes ya
 * armados, cuántos alcanzan (descontando lo que ya se pide de los otros
 * tamaños del mismo producto) y la casilla para pedir. Sin sugerencias.
 */
export function PedidoFraccionModal({ distribuidora, pedido = null, onGuardado }) {
  const { store, closeModal, toast } = useProductos();
  const distId = distribuidora.id;
  const [cants, setCants] = useState(() => Object.fromEntries((pedido?.items ?? []).filter((it) => it.presentacionId).map((it) => [it.presentacionId, String(it.paquetes)])));
  const [obs, setObs] = useState(pedido?.observaciones ?? '');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [sinStock, setSinStock] = useState(false);
  const [stockBajo, setStockBajo] = useState(false);
  const [soloConGranel, setSoloConGranel] = useState(true);
  const [soloPedidos, setSoloPedidos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);

  /* Una pasada por el stock en memoria: granel (clave `p`) y paquetes armados (clave `p:pr`) de la Distribuidora. */
  const productos = useMemo(() => {
    const hay = new Map();
    for (const st of store.state.stock) {
      if (st.sucursalId === distId && st.estado === 'disponible') hay.set(st.presentacionId ? `${st.productoId}:${st.presentacionId}` : `${st.productoId}`, st.cantidad);
    }
    return store.state.productos
      .filter((p) => p.tipo === 'granel' && (p.presentaciones || []).length && (p.estado || 'activo') !== 'archivado')
      .map((p) => ({
        p,
        granel: hay.get(`${p.id}`) ?? 0,
        paquetes: [...p.presentaciones].sort((a, b) => b.tamKg - a.tamKg).map((pr) => ({ pr, armados: hay.get(`${p.id}:${pr.id}`) ?? 0 })),
        texto: norm(`${p.nombre} ${p.marca || ''} ${p.codigoPropio || ''}`),
      }))
      .sort((a, b) => a.p.nombre.localeCompare(b.p.nombre, 'es'));
  }, [store.state.productos, store.state.stock, distId]);

  const kgPedidos = (x) => x.paquetes.reduce((a, { pr }) => a + pedidoDe(cants, pr.id) * pr.tamKg, 0);

  /* Filtros DINÁMICOS: primero todo lo que no es categoría (cada producto con SUS
   * paquetes que pasan el stock y «solo lo pedido»); de ahí salen las
   * categorías con su cantidad, y de la elegida, sus subcategorías. */
  const base = useMemo(() => {
    const t = norm(busca.trim());
    const out = [];
    for (const x of productos) {
      if (t && !x.texto.includes(t)) continue;
      if (soloConGranel && !(x.granel > 1e-9) && !x.paquetes.some(({ pr }) => cants[pr.id])) continue;
      const visibles = x.paquetes.filter(({ pr, armados }) => pasaStock(sinStock, stockBajo, armados) && (!soloPedidos || pedidoDe(cants, pr.id) > 0));
      if (visibles.length) out.push({ ...x, visibles });
    }
    return out;
  }, [productos, busca, soloConGranel, sinStock, stockBajo, soloPedidos, cants]);
  const categorias = useMemo(() => opcionesDe(base, 'categoria', categoria), [base, categoria]);
  const deCategoria = useMemo(() => (categoria ? base.filter((x) => x.p.categoria === categoria) : base), [base, categoria]);
  const subcategorias = useMemo(() => (categoria ? opcionesDe(deCategoria, 'subcategoria', subcategoria) : []), [deCategoria, categoria, subcategoria]);
  const visibles = useMemo(() => (subcategoria ? deCategoria.filter((x) => x.p.subcategoria === subcategoria) : deCategoria), [deCategoria, subcategoria]);
  const pag = usePaginado(visibles, 'pedidoFraccion', `${busca}|${categoria}|${subcategoria}|${sinStock}|${stockBajo}|${soloConGranel}|${soloPedidos}`);

  const renglones = productos.flatMap((x) => x.paquetes.filter(({ pr }) => pedidoDe(cants, pr.id) > 0).map(({ pr }) => ({ presentacionId: pr.id, paquetes: pedidoDe(cants, pr.id) })));
  const totalPaquetes = renglones.reduce((a, r) => a + r.paquetes, 0);
  const totalKg = productos.reduce((a, x) => a + kgPedidos(x), 0);
  const conDecimales = Object.values(cants).some((v) => String(v ?? '').trim() !== '' && !esEntero(v));
  const sinGranel = productos.filter((x) => kgPedidos(x) > x.granel + 1e-9).length;
  const puedeGuardar = renglones.length > 0 && !conDecimales && !guardando;

  const guardar = async (imprimir) => {
    if (!puedeGuardar || enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    const r = await store.guardarPedidoFraccion(pedido?.id, { items: renglones, observaciones: obs.trim() });
    enVuelo.current = false;
    setGuardando(false);
    if (!r.ok) { toast(r.error || 'No se pudo guardar el pedido.', 'err'); return; }
    toast(`${r.data.codigo} ${pedido ? 'actualizado' : 'guardado'}: ${num(totalPaquetes, 0)} paquete(s).`, 'ok');
    if (imprimir) {
      const lista = await store.pedidosFraccion();
      const guardado = lista.ok && lista.data.pedidos.find((x) => x.id === r.data.id);
      if (guardado) imprimirPedidoFraccion(guardado, distribuidora);
    }
    onGuardado?.();
    closeModal();
  };

  return (
    <ModalShell
      title={pedido ? `Editar ${pedido.codigo}` : 'Nuevo pedido de fraccionado'}
      subtitle={`Para la góndola de la ${distribuidora.nombre}. Pedir no mueve stock: se mueve cuando se carga lo fraccionado.`}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar e imprimir', clase: 'btn-ghost', onClick: () => guardar(true), disabled: !puedeGuardar },
        { texto: guardando ? 'Guardando…' : `Guardar · ${num(totalPaquetes, 0)} paq. · ${num(totalKg, 3)} kg`, clase: 'btn-primary', onClick: () => guardar(false), disabled: !puedeGuardar },
      ]}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input id="pf-buscar" type="search" value={busca} placeholder="Buscar granel por nombre, marca o código…" onChange={(e) => setBusca(e.target.value)} style={{ flex: '1 1 220px' }} autoFocus />
        <select id="pf-categoria" className={s['select-inline']} value={categoria} onChange={(e) => { setCategoria(e.target.value); setSubcategoria(''); }} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categorias.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
        </select>
        {categoria && subcategorias.length > 0 && (
          <select id="pf-subcategoria" className={s['select-inline']} value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} aria-label="Subcategoría">
            <option value="">Todas las subcategorías</option>
            {subcategorias.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
          </select>
        )}
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input id="pf-con-granel" type="checkbox" checked={soloConGranel} onChange={(e) => setSoloConGranel(e.target.checked)} /> Solo con granel
        </label>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input id="pf-sin-stock" type="checkbox" checked={sinStock} onChange={(e) => setSinStock(e.target.checked)} /> Sin stock
        </label>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input id="pf-stock-bajo" type="checkbox" checked={stockBajo} onChange={(e) => setStockBajo(e.target.checked)} /> Stock bajo ({STOCK_BAJO} o menos)
        </label>
        <label className={s.hint} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input id="pf-solo-pedidos" type="checkbox" checked={soloPedidos} onChange={(e) => setSoloPedidos(e.target.checked)} /> Ver solo lo pedido
        </label>
      </div>

      <Table cols={[{ h: 'Paquete' }, { h: 'Pedir', num: true }, { h: 'Stock', num: true }, { h: 'Alcanzan', num: true }]} empty="Ningún granel con esos filtros." pag={pag}>
        {pag.visibles.flatMap((x) => {
          const kg = kgPedidos(x);
          const falta = kg - x.granel;
          return [
            <tr key={`p${x.p.id}`} style={{ background: 'var(--crm-color-surface-2)' }}>
              <td colSpan={4}>
                <strong>{x.p.nombre}</strong>
                <span className={s.hint} style={{ margin: '0 0 0 8px' }}>granel {num(x.granel, 3)} kg{kg > 0 ? ` · pedido ${num(kg, 3)} kg` : ''}</span>
                {falta > 1e-9 && <span style={{ marginLeft: 8, color: 'var(--crm-color-danger)', fontWeight: 600 }}>faltan {num(falta, 3)} kg de granel</span>}
              </td>
            </tr>,
            ...x.visibles.map(({ pr, armados }) => {
              const otros = kg - pedidoDe(cants, pr.id) * pr.tamKg;
              const alcanzan = Math.max(0, Math.floor((x.granel - otros) / pr.tamKg + 1e-9));
              const v = cants[pr.id] ?? '';
              const mal = String(v).trim() !== '' && !esEntero(v);
              return (
                <tr key={pr.id}>
                  <td style={{ paddingLeft: 24 }}>{fmtTam(pr.tamKg)}</td>
                  <td className={s.num}>
                    <input
                      id={`pf-cant-${pr.id}`} inputMode="numeric" value={v} placeholder="0" aria-label={`Pedir ${x.p.nombre} ${fmtTam(pr.tamKg)}`}
                      onChange={(e) => setCants((c) => ({ ...c, [pr.id]: e.target.value }))}
                      onKeyDown={alSiguiente}
                      style={{ width: 80, textAlign: 'right', ...(mal ? { borderColor: 'var(--crm-color-danger)' } : {}) }}
                    />
                  </td>
                  <td className={s.num} style={armados <= STOCK_BAJO ? { color: 'var(--crm-color-danger)', fontWeight: 600 } : undefined}>{num(armados, 0)}</td>
                  <td className={s.num}>{num(alcanzan, 0)}</td>
                </tr>
              );
            }),
          ];
        })}
      </Table>

      <div className={s.field} style={{ marginTop: 10 }}>
        <label htmlFor="pf-obs">Observaciones</label>
        <input id="pf-obs" value={obs} maxLength={300} placeholder="Opcional" onChange={(e) => setObs(e.target.value)} />
      </div>
      {conDecimales && <div className={cx(s.callout, s.warn)}>Los paquetes van enteros: corregí las casillas marcadas en rojo.</div>}
      {sinGranel > 0 && (
        <div className={s.hint}>
          {sinGranel === 1 ? 'Un producto pide' : `${sinGranel} productos piden`} más kilos de los que hay a granel: se puede guardar igual (puede entrar mercadería),
          pero el fraccionador va a poder cargar solo lo que alcance.
        </div>
      )}
    </ModalShell>
  );
}
