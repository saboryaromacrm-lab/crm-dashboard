/**
 * ALMACÉN › PRODUCTOS SIN MOVIMIENTO (7/10/2026, pedido del dueño)
 * ============================================================================
 * La mercadería quieta: productos con stock disponible en un local que no se
 * venden ahí hace más de 7, 14, 21 o 30 días, con la plata parada a costo de
 * hoy y la pista de dónde SÍ se venden (para mandarlos para allá).
 *
 * Los filtros que cambian la consulta (local, días, contar los pases) van al
 * servidor (`GET /sin-movimiento`, ver crm-api/src/inventario/sin-movimiento.ts):
 * una sola lectura con índices, medida en 0,3 s con 2 años de movimientos.
 * Buscar, ordenar, el tramo y «solo los que se venden en otro local» filtran
 * en el navegador sobre lo que ya llegó: no vuelven a pedir nada.
 */
import { useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { useResource } from '@modules/gastos/hooks/useResource.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num, fmtFecha } from '../domain/format.js';
import { Table, Btn, PanelHead, usePaginado, s } from '../components/ui.jsx';

const DIAS = [7, 14, 21, 30];
const ORDENES = { dias: 'Más tiempo quieto', valor: 'Más plata parada', nombre: 'Por nombre', local: 'Por local' };
const CLAVE = 'erp.almacen.sinMovimiento';

/* Lo último que se eligió queda para la próxima vez (solo en este navegador). */
function leerPreferencias() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    return { dias: DIAS.includes(v.dias) ? v.dias : 7, pases: !!v.pases, sucursalId: Number(v.sucursalId) || '' };
  } catch { return { dias: 7, pases: false, sucursalId: '' }; }
}
function guardarPreferencias(p) {
  try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* sin storage: no pasa nada */ }
}

const der = (txt) => <span style={{ display: 'block', textAlign: 'right' }}>{txt}</span>;
const NOWRAP = { whiteSpace: 'nowrap' };

function stockTxt(x) {
  return x.granel ? `${num(x.stock, x.stock >= 100 ? 0 : 2)} kg` : `${num(x.stock, 0)} u.`;
}
function detalleStock(x) {
  if (!x.granel || !(x.paquetes > 0)) return '';
  return `${num(x.suelto, 2)} kg suelto + ${num(x.paquetes, 0)} paq.`;
}

/** Cuánto hace, con su color: más de 60 días rojo, más de 30 naranja. */
function Quieto({ x }) {
  if (x.dias == null) {
    return <span className={s.badge} style={{ background: 'var(--crm-color-surface-2)', color: 'var(--crm-color-text-secondary)', fontWeight: 700 }}>sin registro</span>;
  }
  const tono = x.dias > 60 ? 'var(--crm-color-danger)' : x.dias > 30 ? 'var(--crm-color-warning)' : 'var(--crm-color-text)';
  return <strong style={{ color: tono, fontVariantNumeric: 'tabular-nums' }}>{num(x.dias, 0)} días</strong>;
}
const DESDE = {
  venta: (x) => `última venta ${fmtFecha(x.ultimaVenta)}`,
  pase: (x) => `último pase ${fmtFecha(x.ultimoPase)}`,
  ingreso: (x) => `entró el ${fmtFecha(x.desde)}, nunca se vendió acá`,
  sin_registro: () => 'ningún movimiento registrado en este local',
};

export function SinMovimientoPanel() {
  const { esAdmin } = usePermissions();
  const [pref, setPref] = useState(leerPreferencias);
  const cambiar = (cambio) => setPref((p) => { const n = { ...p, ...cambio }; guardarPreferencias(n); return n; });

  const qs = `dias=${pref.dias}${pref.pases ? '&pases=1' : ''}${pref.sucursalId ? `&sucursalId=${pref.sucursalId}` : ''}`;
  const { data: d, loading, error, reload } = useResource(`sin-movimiento:${qs}`, () => httpClient.get(`/sin-movimiento?${qs}`));
  const { data: sucursales } = useResource('sin-movimiento:sucursales', () => httpClient.get('/sucursales'), { enabled: esAdmin });

  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('dias');
  const [tramo, setTramo] = useState('');
  const [soloOtroLocal, setSoloOtroLocal] = useState(false);

  const n = d?.nombres;
  const nombreSuc = (id) => n?.sucursales?.[id] ?? '—';
  const filas = useMemo(() => {
    if (!d) return [];
    const nom = d.nombres;
    const txt = q.trim().toLowerCase();
    const t = d.tramos.find((x) => x.clave === tramo);
    const enTramo = (x) => {
      if (!t) return true;
      if (t.desde == null) return x.dias == null;
      return x.dias != null && x.dias >= t.desde && x.dias <= (t.hasta ?? Infinity);
    };
    const base = d.filas.filter((x) => enTramo(x)
      && (!soloOtroLocal || x.seVendeEn)
      && (!txt || `${x.nombre} ${x.codigo} ${nom.marcas[x.marcaId] ?? ''} ${nom.categorias[x.categoriaId] ?? ''}`.toLowerCase().includes(txt)));
    /* «Sin registro» no sabe cuánto hace: va al final (tiene su propio botón arriba). */
    const dias = (x) => (x.dias == null ? -1 : x.dias);
    const cmp = {
      dias: (a, b) => dias(b) - dias(a) || (b.valor ?? 0) - (a.valor ?? 0),
      valor: (a, b) => (b.valor ?? 0) - (a.valor ?? 0) || dias(b) - dias(a),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      local: (a, b) => (nom.sucursales[a.sucursalId] ?? '').localeCompare(nom.sucursales[b.sucursalId] ?? '', 'es') || dias(b) - dias(a),
    }[orden];
    return base.sort(cmp);
  }, [d, q, orden, tramo, soloOtroLocal]);
  const pag = usePaginado(filas, 'almacen-sin-movimiento', `${qs}|${q}|${orden}|${tramo}|${soloOtroLocal}`);

  const totalFiltrado = useMemo(() => filas.reduce((a, x) => a + (x.valor ?? 0), 0), [filas]);
  const variosLocales = !pref.sucursalId && esAdmin;
  const verCosto = !!d?.verCosto;

  const exportar = () => descargarCsv(
    `productos-sin-movimiento-mas-de-${d.dias}-dias${pref.sucursalId ? `-${nombreSuc(Number(pref.sucursalId))}` : ''}.csv`.replace(/[^\w.-]+/g, '-'),
    ['Producto', 'Código', 'Marca', 'Categoría', 'Local', 'Tipo', 'Stock', 'Unidad', ...(verCosto ? ['Plata parada'] : []), 'Días sin moverse', 'Desde', 'Última venta', 'Último pase', 'Se vende en'],
    filas.map((x) => [x.nombre, x.codigo, n.marcas[x.marcaId] ?? '', n.categorias[x.categoriaId] ?? '', nombreSuc(x.sucursalId), x.granel ? 'granel' : 'entero',
      csvNum(x.stock, 3), x.granel ? 'kg' : 'u.', ...(verCosto ? [csvNum(x.valor ?? 0)] : []), x.dias ?? 'sin registro', DESDE[x.motivo](x),
      x.ultimaVenta ? fmtFecha(x.ultimaVenta) : '', x.ultimoPase ? fmtFecha(x.ultimoPase) : '', x.seVendeEn ? nombreSuc(x.seVendeEn) : '']),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Productos sin movimiento"
        desc="Lo que tiene stock en un local y no se vende ahí hace más de los días que elijas. Cuenta como movimiento vender (mostrador y tienda) y mandar a Coffit; los pases entre locales, solo si lo marcás."
        actions={<Btn small onClick={reload} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</Btn>}
      />

      {/* Lo que cambia la consulta */}
      <div className={cx(s.card, s.cardPad)} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        {esAdmin ? (
          <div className={s.field} style={{ margin: 0, minWidth: 200 }}>
            <label htmlFor="sm-local">Local</label>
            <select id="sm-local" value={pref.sucursalId} onChange={(e) => cambiar({ sucursalId: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">Todos los locales</option>
              {(sucursales ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>
        ) : (
          <div className={s.field} style={{ margin: 0 }}>
            <label>Local</label>
            <div style={{ padding: '10px 0', fontWeight: 600 }}>{d?.sucursalId ? nombreSuc(d.sucursalId) : 'El tuyo'}</div>
          </div>
        )}
        <div className={s.field} style={{ margin: 0 }}>
          <label id="sm-dias">Sin vender hace más de</label>
          <div role="group" aria-labelledby="sm-dias" style={{ display: 'flex', gap: 6 }}>
            {DIAS.map((x) => (
              <Btn key={x} small variant={pref.dias === x ? 'btn-primary' : 'btn-ghost'} aria-pressed={pref.dias === x} onClick={() => cambiar({ dias: x })}>{x} días</Btn>
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', maxWidth: 380, paddingBottom: 6 }}>
          <input type="checkbox" checked={pref.pases} onChange={(e) => cambiar({ pases: e.target.checked })} style={{ marginTop: 3, width: 'auto' }} />
          <span>
            <strong>Contar los pases entre locales como movimiento</strong>
            <span className={s.hint} style={{ display: 'block', margin: 0 }}>
              {pref.pases ? 'Un producto que entró o salió del local por un pase no figura como quieto.' : 'Ahora un pase NO cuenta: solo vender lo saca de la lista.'}
            </span>
          </span>
        </label>
      </div>

      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
      {!d ? <div className={s.hint}>Buscando la mercadería quieta…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', opacity: loading ? 0.6 : 1, transition: 'opacity 120ms' }}>
          {/* Los números grandes */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Numero label="Productos quietos" valor={num(d.resumen.productos, 0)} detalle={d.resumen.renglones !== d.resumen.productos ? `${num(d.resumen.renglones, 0)} contando cada local por separado` : `más de ${d.dias} días sin vender`} />
            {verCosto && <Numero label="Plata parada" valor={money(d.resumen.valor)} detalle="a costo de hoy, sin IVA" alerta={d.resumen.valor > 0} />}
            <Numero
              label="Se venden en otro local" valor={num(d.resumen.seVendenEnOtroLocal, 0)}
              detalle={d.resumen.seVendenEnOtroLocal ? 'quietos acá, pero en otro local salen: conviene mandarlos' : 'ninguno'}
              onClick={d.resumen.seVendenEnOtroLocal ? () => setSoloOtroLocal((v) => !v) : undefined} activo={soloOtroLocal}
            />
          </div>

          {/* Cuánto hace: cada tramo filtra la lista */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label="Filtrar por cuánto hace">
            <Tramo activo={!tramo} onClick={() => setTramo('')} etiqueta="Todos" productos={d.resumen.renglones} valor={verCosto ? d.resumen.valor : null} />
            {d.tramos.filter((t) => t.productos > 0).map((t) => (
              <Tramo key={t.clave} activo={tramo === t.clave} onClick={() => setTramo(tramo === t.clave ? '' : t.clave)} etiqueta={t.etiqueta} productos={t.productos} valor={t.valor} />
            ))}
          </div>

          {variosLocales && d.porSucursal.length > 1 && (
            <div className={s.hint} style={{ margin: 0 }}>
              Por local: {d.porSucursal.map((x, i) => (
                <span key={x.sucursalId}>{i ? ' · ' : ''}
                  <button type="button" onClick={() => cambiar({ sucursalId: x.sucursalId })} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--crm-color-primary)', fontWeight: 700, cursor: 'pointer' }}>{x.sucursal}</button>
                  {' '}{num(x.productos, 0)}{verCosto ? ` (${money(x.valor)})` : ''}
                </span>
              ))}
            </div>
          )}

          <div className={s.toolbar} style={{ margin: 0 }}>
            <input type="search" placeholder="Buscar producto, código, marca o categoría…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} aria-label="Buscar" />
            <select className={s['select-inline']} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
              {Object.entries(ORDENES).filter(([k]) => (k !== 'valor' || verCosto) && (k !== 'local' || variosLocales)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={soloOtroLocal} onChange={(e) => setSoloOtroLocal(e.target.checked)} style={{ width: 'auto' }} /> Solo los que se venden en otro local
            </label>
            <Btn small onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>
            <span className={s.hint} style={{ margin: '0 0 0 auto' }}>
              {num(filas.length, 0)} {filas.length === 1 ? 'renglón' : 'renglones'}{verCosto && filas.length !== d.filas.length ? ` · ${money(totalFiltrado)}` : ''}
            </span>
          </div>

          <Table
            cols={[
              { h: 'Producto' }, ...(variosLocales ? [{ h: 'Local' }] : []), { h: der('Stock'), num: true },
              ...(verCosto ? [{ h: der('Plata parada'), num: true }] : []), { h: der('Sin moverse'), num: true }, { h: 'Desde' }, { h: 'Pista' },
            ]}
            empty={q || tramo || soloOtroLocal ? 'Nada coincide con el filtro.' : `Todo lo que tiene stock se movió en los últimos ${d.dias} días.`}
            pag={pag}
          >
            {pag.visibles.map((x) => (
              <tr key={`${x.productoId}-${x.sucursalId}`}>
                <td>
                  <strong>{x.nombre}</strong>
                  <div className={s.hint} style={{ margin: 0 }}>
                    {[n.marcas[x.marcaId], n.categorias[x.categoriaId], x.codigo, x.granel ? 'granel' : '', x.deCoffit ? 'de Coffit' : ''].filter(Boolean).join(' · ')}
                  </div>
                </td>
                {variosLocales && <td style={NOWRAP}>{nombreSuc(x.sucursalId)}</td>}
                <td className={cx(s.num, s.mono)} style={NOWRAP}>
                  {stockTxt(x)}
                  {detalleStock(x) && <div className={s.hint} style={{ margin: 0 }}>{detalleStock(x)}</div>}
                </td>
                {verCosto && <td className={cx(s.num, s.mono)} style={NOWRAP}>{x.valor ? money(x.valor) : <span className={s.muted} title="Sin costo cargado">—</span>}</td>}
                <td className={s.num} style={NOWRAP}><Quieto x={x} /></td>
                <td>
                  {DESDE[x.motivo](x)}
                  {x.ultimoPase && x.motivo !== 'pase' && <div className={s.hint} style={{ margin: 0 }}>último pase {fmtFecha(x.ultimoPase)}{d.pases ? '' : ' (no cuenta)'}</div>}
                </td>
                <td>
                  {x.seVendeEn
                    ? <span style={{ color: 'var(--crm-color-primary)', fontWeight: 600 }}>Se vende en {nombreSuc(x.seVendeEn)}</span>
                    : <span className={s.muted}>—</span>}
                </td>
              </tr>
            ))}
          </Table>
          <div className={s.hint} style={{ margin: 0 }}>
            Solo el stock <strong>disponible</strong> (lo reservado para un pase o retenido no figura). Si un producto nunca se vendió en el local, se cuenta desde que entró: lo que llegó hace poco no aparece.
            «Sin registro»: tiene stock pero ningún movimiento anotado en ese local (por ejemplo, stock cargado de entrada).
          </div>
        </div>
      )}
    </div>
  );
}

function Numero({ label, valor, detalle, alerta, onClick, activo }) {
  const contenido = (
    <>
      <div className={s['mini-label']}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: alerta ? 'var(--crm-color-warning)' : 'var(--crm-color-text)', fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {detalle && <div className={s.hint} style={{ margin: '2px 0 0' }}>{detalle}</div>}
    </>
  );
  const estilo = { minWidth: 0, flex: '1 1 200px', boxSizing: 'border-box', textAlign: 'left', font: 'inherit', color: 'inherit' };
  if (!onClick) return <div className={cx(s.card, s.cardPad)} style={estilo}>{contenido}</div>;
  return (
    <button type="button" className={cx(s.card, s.cardPad)} onClick={onClick} aria-pressed={!!activo}
      style={{ ...estilo, cursor: 'pointer', outline: activo ? '2px solid var(--crm-color-primary)' : undefined }} title={activo ? 'Mostrar todos' : 'Mostrar solo estos'}>
      {contenido}
    </button>
  );
}

function Tramo({ etiqueta, productos, valor, activo, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', font: 'inherit',
        border: `1px solid ${activo ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`,
        background: activo ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface)', color: 'var(--crm-color-text)',
      }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--crm-color-text-secondary)' }}>{etiqueta}</span>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{num(productos, 0)}{valor != null ? <span style={{ fontWeight: 500, color: 'var(--crm-color-text-secondary)' }}> · {money(valor)}</span> : null}</strong>
    </button>
  );
}
