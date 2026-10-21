/**
 * LA FICHA DE MOVIMIENTOS DE UN PRODUCTO (20/10/2026, pedido del dueño)
 * ============================================================================
 * «Al entrar al movimiento de un producto me tiene que mostrar todo de todo
 * para hacerle seguimiento.» Se abre en el Historial al elegir un producto (o
 * desde «Movs.» de Existencias):
 *
 *   · si su stock CIERRA: el stock de hoy se explica con sus movimientos más la
 *     carga inicial (lo que había antes del primero);
 *   · por artículo (el suelto y cada paquete) y sucursal: saldo al empezar el
 *     período, qué entró y qué salió por tipo, saldo al final y el de hoy por estado;
 *   · cada movimiento con lo que sumó o restó en cada artículo y estado, y el
 *     saldo que dejó.
 *
 * La cuenta la hace la API (`inventario/kardex.ts`, con pruebas): acá se muestra.
 */
import { useEffect, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { num, money, fmtFechaHora } from '../domain/format.js';
import { ESTADOS_STOCK, labelTipoMov } from '../domain/constants.js';
import { Table, MovTag, Btn, usePaginado, s } from '../components/ui.jsx';

const ESTADOS = ['disponible', 'comprometido', 'en_transito', 'vencido', 'defectuoso', 'retenido'];
const cant = (n, unidad) => `${num(n, 3)} ${unidad === 'kg' ? 'kg' : 'u.'}`;
const conSigno = (n, unidad) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${cant(Math.abs(n), unidad)}`;
const estadoLabel = (e) => ESTADOS_STOCK[e]?.label ?? e;

/** «Venta por unidad 12 u. · Compra 40 u.»: lo que entró o salió por tipo. */
function PorTipo({ mapa, unidad, prodTipo }) {
  const partes = Object.entries(mapa ?? {});
  if (!partes.length) return <span className={s.muted}>—</span>;
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {partes.map(([t, n]) => <span key={t} style={{ whiteSpace: 'nowrap' }}>{labelTipoMov(t, prodTipo)}: <strong>{cant(n, unidad)}</strong></span>)}
    </div>
  );
}

/** El saldo en otros estados (no disponible), solo los que tienen algo. */
function OtrosEstados({ saldo, unidad }) {
  const otros = ESTADOS.filter((e) => e !== 'disponible' && Math.abs(saldo?.[e] ?? 0) > 0.0005);
  if (!otros.length) return null;
  return <div className={s.hint} style={{ margin: 0 }}>{otros.map((e) => `${estadoLabel(e)}: ${cant(saldo[e], unidad)}`).join(' · ')}</div>;
}

export function FichaMovimientos({ productoId, sucursalId, desde, hasta, tipo }) {
  const { openModal } = useProductos();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError('');
    const q = new URLSearchParams({ productoId: String(productoId) });
    if (sucursalId) q.set('sucursalId', String(sucursalId));
    if (desde) q.set('desde', desde);
    if (hasta) q.set('hasta', hasta);
    if (tipo) q.set('tipo', tipo);
    httpClient.get(`/movimientos/kardex?${q}`)
      .then((r) => { if (vivo) setD(r); })
      .catch((e) => { if (vivo) setError(e?.data?.message || 'No se pudo cargar la ficha del producto.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [productoId, sucursalId, desde, hasta, tipo]);

  const pag = usePaginado(d?.movimientos ?? [], 'ficha-movimientos', `${productoId}|${sucursalId}|${desde}|${hasta}|${tipo}`);

  if (error) return <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>;
  if (!d) return <div className={s.hint}>Cargando la ficha del producto…</div>;
  const prodTipo = d.producto.tipo;
  const conPeriodo = !!(desde || hasta);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: cargando ? 0.6 : 1 }}>
      {d.incoherencias.length ? (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          <strong>⚠ Hay stock que no cierra con sus movimientos</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {d.incoherencias.map((x) => (
              <li key={`${x.sucursalId}-${x.presentacionId}-${x.estado}`}>
                {x.articulo} en {x.sucursal} ({estadoLabel(x.estado)}): {cant(x.cantidad, x.unidad)}. {x.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
          <strong>✓ Cierra:</strong> el stock de hoy de {d.producto.nombre} se explica con sus {num(d.totalMovimientos, 0)} movimiento(s)
          más la carga inicial (lo que ya había antes del primero).
        </div>
      )}
      {d.estimados > 0 && (
        <div className={s.hint} style={{ margin: 0 }}>
          {d.estimados} fraccionado(s) anteriores al registro de fraccionamiento: los paquetes se deducen de los kg (marcados «estimado»).
        </div>
      )}

      <Table
        cols={[
          { h: 'Artículo' }, { h: 'Sucursal' }, { h: conPeriodo ? 'Al empezar el período' : 'Carga inicial', num: true },
          { h: 'Entró' }, { h: 'Salió' }, { h: conPeriodo ? 'Al terminar el período' : 'Hoy', num: true },
          ...(conPeriodo ? [{ h: 'Hoy', num: true }] : []),
        ]}
        empty="Este producto no tiene stock ni movimientos."
      >
        {d.articulos.map((a) => (
          <tr key={`${a.sucursalId}-${a.presentacionId}`}>
            <td>{a.articulo}</td>
            <td>{a.sucursal}</td>
            <td className={s.num}>{cant(a.alInicio.disponible, a.unidad)}<OtrosEstados saldo={a.alInicio} unidad={a.unidad} /></td>
            <td><PorTipo mapa={a.entradas} unidad={a.unidad} prodTipo={prodTipo} /></td>
            <td>
              <PorTipo mapa={a.salidas} unidad={a.unidad} prodTipo={prodTipo} />
              {a.cambios > 0 && <div className={s.hint} style={{ margin: 0 }}>{a.cambios} cambio(s) de estado (reservas, viajes)</div>}
            </td>
            <td className={s.num}><strong>{cant(a.alFinal.disponible, a.unidad)}</strong><OtrosEstados saldo={a.alFinal} unidad={a.unidad} /></td>
            {conPeriodo && <td className={s.num}>{cant(a.hoy.disponible, a.unidad)}<OtrosEstados saldo={a.hoy} unidad={a.unidad} /></td>}
          </tr>
        ))}
      </Table>
      <div className={s.hint} style={{ margin: 0 }}>
        Los números grandes son el stock <strong>disponible</strong>; debajo, lo que está en otros estados (reservado para un pedido,
        en viaje, vencido o defectuoso). Entró y salió suman lo de todos los estados: una reserva o un viaje no es una salida.
      </div>

      {d.periodo.recortado && (
        <div className={s.hint} style={{ margin: 0 }}>Se listan los últimos 5000 movimientos del período (los saldos se calculan con todos): acotá las fechas para ver el resto.</div>
      )}
      <Table
        cols={[{ h: 'Fecha y hora' }, { h: 'Tipo' }, { h: 'Sucursal' }, { h: 'Qué movió y cuánto quedó' }, { h: 'Detalle' }, { h: 'Valor', num: true }, { h: 'Usuario' }, { h: '', cls: 'actions-col' }]}
        empty={conPeriodo ? 'Sin movimientos en esas fechas.' : 'Sin movimientos.'}
        pag={pag}
      >
        {pag.visibles.map((m) => (
          <tr key={m.id}>
            <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(m.fecha)}</td>
            <td><MovTag tipo={m.tipo} prodTipo={prodTipo} />{m.estimado && <div className={s.hint} style={{ margin: 0 }}>estimado</div>}</td>
            <td>{m.sucursal}{m.destino ? ` → ${m.destino}` : ''}</td>
            <td style={{ minWidth: 220 }}>
              {m.movio.length ? m.movio.map((x, i) => (
                <div key={i} style={{ whiteSpace: 'nowrap' }}>
                  <strong style={{ color: x.delta > 0 ? 'var(--crm-color-success)' : x.delta < 0 ? 'var(--crm-color-danger)' : undefined }}>
                    {conSigno(x.delta, x.unidad)}
                  </strong>{' '}
                  {x.articulo.replace(`${d.producto.nombre} · `, '')}{x.estado !== 'disponible' ? ` (${estadoLabel(x.estado).toLowerCase()})` : ''}
                  <span className={s.muted}> → queda {cant(x.saldo, x.unidad)}</span>
                </div>
              )) : <span className={s.muted}>—</span>}
            </td>
            <td style={{ maxWidth: 260, fontSize: 12.5 }}>
              {m.detalle || <span className={s.muted}>—</span>}
              {m.proveedor && <div className={s.hint} style={{ margin: 0 }}>{m.proveedor}</div>}
            </td>
            <td className={s.num}>{m.valor != null ? money(m.valor) : <span className={s.muted}>—</span>}</td>
            <td>{m.usuario}</td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                {m.refTransferenciaId && <Btn small variant="btn-edit" onClick={() => openModal('detalleTransfer', { id: m.refTransferenciaId })}>Ver</Btn>}
                {m.refIncidenciaId && <Btn small variant="btn-edit" onClick={() => openModal('detalleIncidencia', { id: m.refIncidenciaId })}>Ver</Btn>}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <div className={s.hint} style={{ margin: 0 }}>
        {num(d.periodo.movimientos, 0)} movimiento(s){conPeriodo ? ' en el período' : ' en total'}. «Queda» es el saldo de ese artículo y estado
        después del movimiento, en la sucursal donde ocurrió.
      </div>
    </div>
  );
}
