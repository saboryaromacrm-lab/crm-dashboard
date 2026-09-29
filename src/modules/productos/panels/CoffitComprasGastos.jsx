/**
 * COFFIT · COMPRAS DE MERCADERÍA Y GASTOS, EN DETALLE (29/9/2026)
 * ============================================================================
 * Pedido del dueño: *"necesito tener detallado de las cosas que se compran,
 * facturas ya sea de compras o de gastos, las que son para Coffit"*, y las dos
 * cosas separadas.
 *
 *  · COMPRAS DE MERCADERÍA — las facturas de compra con renglones de Coffit
 *    (artículos de uso exclusivo, renglones tildados «para Coffit» o la factura
 *    entera), por factura o por artículo. El total es el MISMO número que
 *    «Comprado para el café» del depósito y «Directo para Coffit» de Gerencia.
 *  · GASTOS — los gastos cargados con Negocio: Coffit, con sus renglones y
 *    agrupados por rubro.
 *
 * Cada pestaña pide lo suyo recién cuando se abre y con el período de arriba:
 * abrir Coffit no suma ninguna consulta.
 */
import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { TIPOS_DOC_GASTO, ESTADOS_GASTO } from '@modules/gastos/domain/constants.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { money, num, fmtFecha } from '../domain/format.js';
import { TIPOS_COMPROBANTE } from '../domain/constants.js';
import { Table, Stat, Btn, Pill, usePaginado, s } from '../components/ui.jsx';

const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const nroDoc = (d) => `${d.letra} ${d.puntoVenta}-${String(d.numero || d.id).padStart(8, '0')}`;
const decimalesDe = (unidad) => (unidad === 'kg' ? 3 : 0);

/** El período de arriba, compartido con el resto de la sección. */
function Periodo({ desde, hasta, setDesde, setHasta, children }) {
  return (
    <div className={s.toolbar}>
      <label className={s.hint} style={{ margin: 0 }}>
        Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
      </label>
      <label className={s.hint} style={{ margin: 0 }}>
        Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </label>
      {children}
    </div>
  );
}

/** Pide `leer(filtros)` al abrir y cada vez que cambia el período o el store versiona. */
function useDelPeriodo(leer, desde, hasta, errorTxt) {
  const { store, toast } = useProductos();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const version = store.getVersion?.() ?? 0;
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    leer({ desde: desde || undefined, hasta: hasta || undefined })
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) toast(errorTxt, 'err'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [leer, desde, hasta, version, toast, errorTxt]);
  return { datos, cargando };
}

/** Un conjunto de ids abiertos, con su interruptor. */
function useAbiertos() {
  const [abiertos, setAbiertos] = useState(() => new Set());
  const alternar = (id) => setAbiertos((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return [abiertos, alternar];
}

const flecha = (abierto) => (
  <span aria-hidden="true" style={{ display: 'inline-block', width: 12, transition: 'transform .15s', transform: abierto ? 'rotate(90deg)' : 'none' }}>▸</span>
);

/* ==================================================================== *
 * COMPRAS DE MERCADERÍA
 * ==================================================================== */
export function CoffitCompras({ desde, hasta, setDesde, setHasta }) {
  const { store, openModal } = useProductos();
  const { datos, cargando } = useDelPeriodo(store.comprasCafeteria, desde, hasta, 'No se pudieron leer las compras de Coffit.');
  const [vista, setVista] = useState('factura');
  const [q, setQ] = useState('');
  const [abiertos, alternar] = useAbiertos();

  const documentos = useMemo(() => {
    const ql = norm(q.trim());
    const docs = datos?.documentos ?? [];
    if (!ql) return docs;
    return docs.filter((d) => norm(d.proveedor).includes(ql) || nroDoc(d).includes(q.trim())
      || d.items.some((it) => norm(it.nombre).includes(ql) || norm(it.codigoPropio).includes(ql)));
  }, [datos, q]);
  const articulos = useMemo(() => {
    const ql = norm(q.trim());
    const arts = datos?.articulos ?? [];
    return ql ? arts.filter((a) => norm(a.nombre).includes(ql) || norm(a.codigoPropio).includes(ql)) : arts;
  }, [datos, q]);

  const pagDocs = usePaginado(documentos, 'coffit-compras', `${desde}|${hasta}|${q}`);
  const pagArts = usePaginado(articulos, 'coffit-compras-art', `${desde}|${hasta}|${q}`);

  const exportar = () => {
    if (vista === 'articulo') {
      descargarCsv('coffit-compras-por-articulo.csv',
        ['Artículo', 'Código', 'Unidad', 'Cantidad', 'Costo promedio', 'Neto Coffit', 'Comprobantes'],
        articulos.map((a) => [a.nombre, a.codigoPropio, a.unidad, csvNum(a.cantidad, 3), csvNum(a.costoPromedio), csvNum(a.neto), a.documentos]));
      return;
    }
    const filas = [];
    for (const d of documentos) {
      for (const it of d.items) {
        filas.push([fmtFecha(d.fecha), TIPOS_COMPROBANTE[d.tipo]?.label || d.tipo, nroDoc(d), d.proveedor, d.sucursal,
          it.nombre, it.codigoPropio, it.unidad, csvNum(it.cantidad, 3), csvNum(it.costoUnitario), csvNum(it.descuento, 2), csvNum(it.subtotal)]);
      }
    }
    descargarCsv('coffit-compras.csv',
      ['Fecha', 'Tipo', 'Número', 'Proveedor', 'Sucursal', 'Artículo', 'Código', 'Unidad', 'Cantidad', 'Costo u.', 'Desc. %', 'Neto Coffit'],
      filas);
  };

  const remitos = datos?.remitos ?? [];
  return (
    <>
      <div className={s.stats}>
        <Stat label="Comprado para Coffit (neto)" value={money(datos?.total ?? 0)} accent="accent-amber" />
        <Stat label="Facturas" value={num(datos?.facturas ?? 0, 0)} />
        <Stat label="Artículos distintos" value={num(datos?.articulos?.length ?? 0, 0)} />
        <Stat label="Remitos sin factura" value={num(remitos.length, 0)} />
      </div>

      <Periodo desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}>
        <select className={s['select-inline']} value={vista} onChange={(e) => setVista(e.target.value)}>
          <option value="factura">Por factura</option>
          <option value="articulo">Por artículo</option>
        </select>
        <input
          type="search" placeholder="Buscar proveedor, número o artículo…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }}
        />
        <Btn small onClick={exportar} disabled={!documentos.length}>Exportar CSV</Btn>
      </Periodo>

      {datos?.limitado && (
        <div className={cx(s.callout, s.warn)}>Hay más de 2.000 comprobantes en el período: acortá las fechas para verlos todos.</div>
      )}

      {vista === 'factura' ? (
        <Table
          cols={[
            { h: 'Fecha' }, { h: 'Comprobante' }, { h: 'Proveedor' }, { h: 'Sucursal' },
            { h: 'Qué es de Coffit' }, { h: 'Neto Coffit', num: true },
          ]}
          empty={cargando ? 'Cargando…' : 'Ninguna compra para Coffit en el período.'}
          pag={pagDocs}
        >
          {pagDocs.visibles.map((d) => {
            const abierto = abiertos.has(d.id);
            return [
              <tr key={d.id} className={s.clickable} onClick={() => alternar(d.id)} aria-expanded={abierto}>
                <td>{flecha(abierto)} {fmtFecha(d.fecha)}</td>
                <td>
                  {TIPOS_COMPROBANTE[d.tipo]?.label || d.tipo}{' '}
                  <span className={s.mono}>{nroDoc(d)}</span>
                </td>
                <td>{d.proveedor}</td>
                <td className={s.muted}>{d.sucursal || '—'}</td>
                <td>
                  {d.todo
                    ? <span className={s.badge}>Toda la factura</span>
                    : <span className={s.muted}>{d.items.length} renglón{d.items.length === 1 ? '' : 'es'} de {money(Math.abs(d.subtotalNeto))}</span>}
                </td>
                <td className={cx(s.num, s.mono)} style={{ fontWeight: 700 }}>{money(d.neto)}</td>
              </tr>,
              abierto && (
                <tr key={`${d.id}-det`}>
                  <td colSpan={6} style={{ background: 'var(--crm-color-surface-2, rgba(0,0,0,.03))' }}>
                    <table style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Artículo</th>
                          <th style={{ textAlign: 'right' }}>Cantidad</th>
                          <th style={{ textAlign: 'right' }}>Costo u.</th>
                          <th style={{ textAlign: 'right' }}>Desc.</th>
                          <th style={{ textAlign: 'right' }}>Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.items.map((it, i) => (
                          <tr key={i}>
                            <td>{it.nombre}{it.codigoPropio && <span className={s.muted}> · {it.codigoPropio}</span>}</td>
                            <td className={cx(s.num, s.mono)}>{num(it.cantidad, decimalesDe(it.unidad))} {it.unidad}</td>
                            <td className={cx(s.num, s.mono)}>{money(it.costoUnitario)}</td>
                            <td className={cx(s.num, s.mono)}>{it.descuento ? `${num(it.descuento, 1)}%` : '—'}</td>
                            <td className={cx(s.num, s.mono)}>{money(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 6 }}>
                      <Btn small onClick={() => openModal('comprobanteDetalle', { id: d.id })}>Ver el comprobante entero</Btn>
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
        </Table>
      ) : (
        <Table
          cols={[
            { h: 'Artículo' }, { h: 'Cantidad', num: true }, { h: 'Costo promedio', num: true },
            { h: 'Neto Coffit', num: true }, { h: 'Comprobantes', num: true },
          ]}
          empty={cargando ? 'Cargando…' : 'Ninguna compra para Coffit en el período.'}
          pag={pagArts}
        >
          {pagArts.visibles.map((a) => (
            <tr key={`${a.productoId}|${a.unidad}`}>
              <td>{a.nombre}{a.codigoPropio && <div className={s.hint} style={{ margin: 0 }}>{a.codigoPropio}</div>}</td>
              <td className={cx(s.num, s.mono)}>{num(a.cantidad, decimalesDe(a.unidad))} {a.unidad}</td>
              <td className={cx(s.num, s.mono)}>{money(a.costoPromedio)}/{a.unidad.replace('.', '')}</td>
              <td className={cx(s.num, s.mono)} style={{ fontWeight: 700 }}>{money(a.neto)}</td>
              <td className={s.num}>{a.documentos}</td>
            </tr>
          ))}
        </Table>
      )}

      {remitos.length > 0 && (
        <>
          <div className={s['section-title']}>Remitos con mercadería de Coffit, todavía sin factura</div>
          <div className={s.hint} style={{ marginTop: 0 }}>
            La mercadería ya entró, pero la plata llega con la factura: <strong>no suman</strong> hasta
            que se cargue con «Llegó la factura».
          </div>
          <Table cols={[{ h: 'Fecha' }, { h: 'Remito' }, { h: 'Proveedor' }, { h: 'Renglones de Coffit', num: true }, { h: 'A precio del remito', num: true }]}>
            {remitos.map((d) => (
              <tr key={d.id} className={s.clickable} onClick={() => openModal('comprobanteDetalle', { id: d.id })}>
                <td>{fmtFecha(d.fecha)}</td>
                <td className={s.mono}>{nroDoc(d)}</td>
                <td>{d.proveedor}</td>
                <td className={s.num}>{d.items.length}</td>
                <td className={cx(s.num, s.mono)}>{money(d.items.reduce((acc, it) => acc + it.subtotal, 0))}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      <div className={s.hint}>
        Entra acá la parte de Coffit de cada factura de compra: los artículos de <strong>uso exclusivo
        de Coffit</strong> y los renglones tildados <strong>«Para Coffit»</strong> (o la factura entera) al
        cargarla. Es el <strong>neto</strong>, sin IVA: el crédito fiscal sigue siendo de la empresa. La nota
        de crédito resta. El total es el mismo de <strong>Gerencia</strong> («Directo para Coffit»).
      </div>
    </>
  );
}

/* ==================================================================== *
 * GASTOS
 * ==================================================================== */
export function CoffitGastos({ desde, hasta, setDesde, setHasta }) {
  const { store } = useProductos();
  const { datos, cargando } = useDelPeriodo(store.gastosCafeteria, desde, hasta, 'No se pudieron leer los gastos de Coffit.');
  const [q, setQ] = useState('');
  const [rubro, setRubro] = useState('');
  const [abiertos, alternar] = useAbiertos();

  const lista = useMemo(() => {
    const ql = norm(q.trim());
    return (datos?.gastos ?? []).filter((g) => {
      if (rubro && g.rubro !== rubro) return false;
      if (!ql) return true;
      return norm(g.proveedor).includes(ql) || norm(g.descripcion).includes(ql) || norm(g.numero).includes(ql)
        || g.renglones.some((r) => norm(r.concepto).includes(ql));
    });
  }, [datos, q, rubro]);
  const pag = usePaginado(lista, 'coffit-gastos', `${desde}|${hasta}|${q}|${rubro}`);
  const totalLista = lista.reduce((a, g) => a + g.total, 0);

  const exportar = () => descargarCsv('coffit-gastos.csv',
    ['Fecha', 'Tipo', 'Número', 'Proveedor', 'Rubro', 'Sucursal', 'Descripción', 'Neto', 'IVA', 'Total', 'Estado'],
    lista.map((g) => [fmtFecha(g.fecha), TIPOS_DOC_GASTO[g.tipoDoc] || g.tipoDoc, g.numero, g.proveedor, g.rubro, g.sucursal,
      g.descripcion, csvNum(g.neto), csvNum(g.iva), csvNum(g.total), ESTADOS_GASTO[g.estado]?.label || g.estado]));

  return (
    <>
      <div className={s.stats}>
        <Stat label="Gastos de Coffit" value={money(datos?.total ?? 0)} accent="accent-amber" />
        <Stat label="Comprobantes" value={num(datos?.gastos?.length ?? 0, 0)} />
        <Stat label="Rubros" value={num(datos?.porRubro?.length ?? 0, 0)} />
      </div>

      {(datos?.porRubro?.length ?? 0) > 0 && (
        <div className={s.chipRow}>
          {datos.porRubro.map((r) => (
            <button
              key={r.rubro} type="button" className={s.chip}
              style={{ cursor: 'pointer', ...(rubro === r.rubro ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)' } : {}) }}
              onClick={() => setRubro(rubro === r.rubro ? '' : r.rubro)}
              title={rubro === r.rubro ? 'Ver todos los rubros' : `Ver solo ${r.rubro}`}
            >
              {r.rubro} · <strong>{money(r.total)}</strong> <span style={{ opacity: 0.7 }}>({r.cantidad})</span>
            </button>
          ))}
        </div>
      )}

      <Periodo desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}>
        <input
          type="search" placeholder="Buscar proveedor, número o concepto…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }}
        />
        {(q || rubro) && <span className={s.hint} style={{ margin: 0 }}>Lo filtrado suma <strong>{money(totalLista)}</strong></span>}
        <Btn small onClick={exportar} disabled={!lista.length}>Exportar CSV</Btn>
      </Periodo>

      {datos?.limitado && (
        <div className={cx(s.callout, s.warn)}>Hay más de 2.000 gastos en el período: acortá las fechas para verlos todos.</div>
      )}

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Comprobante' }, { h: 'Proveedor' }, { h: 'Rubro' },
          { h: 'Descripción' }, { h: 'Estado' }, { h: 'Total', num: true },
        ]}
        empty={cargando ? 'Cargando…' : 'Ningún gasto de Coffit en el período.'}
        pag={pag}
      >
        {pag.visibles.map((g) => {
          const abierto = abiertos.has(g.id);
          const est = ESTADOS_GASTO[g.estado] || {};
          const conDetalle = g.renglones.length > 0;
          return [
            <tr
              key={g.id} className={conDetalle ? s.clickable : undefined}
              onClick={conDetalle ? () => alternar(g.id) : undefined} aria-expanded={conDetalle ? abierto : undefined}
            >
              <td>{conDetalle ? flecha(abierto) : <span style={{ display: 'inline-block', width: 12 }} />} {fmtFecha(g.fecha)}</td>
              <td>
                {TIPOS_DOC_GASTO[g.tipoDoc] || g.tipoDoc}
                {g.numero && <span className={s.mono}> {g.letra} {g.numero}</span>}
              </td>
              <td>{g.proveedor || <span className={s.muted}>—</span>}</td>
              <td>{g.rubro}</td>
              <td className={s.muted}>{g.descripcion || '—'}{g.sucursal && <div className={s.hint} style={{ margin: 0 }}>{g.sucursal}</div>}</td>
              <td><Pill pill={est.pill} label={est.label || g.estado} /></td>
              <td className={cx(s.num, s.mono)} style={{ fontWeight: 700 }}>{money(g.total)}</td>
            </tr>,
            abierto && (
              <tr key={`${g.id}-det`}>
                <td colSpan={7} style={{ background: 'var(--crm-color-surface-2, rgba(0,0,0,.03))' }}>
                  {g.renglones.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 520 }}>
                      <span>{r.concepto || '—'}</span><span className={s.mono}>{money(r.monto)}</span>
                    </div>
                  ))}
                  <div className={s.hint} style={{ margin: '4px 0 0' }}>
                    Neto {money(g.neto)} · IVA {money(g.iva)} · Total {money(g.total)}
                  </div>
                </td>
              </tr>
            ),
          ];
        })}
      </Table>

      <div className={s.hint}>
        Son los gastos cargados en <strong>Gastos</strong> con <strong>Negocio: Coffit</strong>. Van por
        el total del comprobante; la nota de crédito resta. Para que uno aparezca acá, se elige
        ese negocio al cargarlo.
      </div>
    </>
  );
}
