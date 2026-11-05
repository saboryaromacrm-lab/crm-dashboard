/**
 * CASH FLOW › CONCILIACIÓN DE EFECTIVO (4/11/2026, pedido del dueño)
 * ============================================================================
 * «Lo que vendí en efectivo en el mes, ¿me llegó a la mano?» Un mes y,
 * si se quiere, un local: de lo cobrado en efectivo en las cajas que cerraron
 * en el mes a lo que contaste en el Cash Flow, renglón por renglón, con dónde
 * se fue cada peso (pagos desde la caja, fondo, diferencias, sobres sin rendir).
 * Abajo, por local y caja por caja, para encontrar dónde faltó.
 *
 * Solo muestra: los números los arma el servidor (crm-api/src/cashflow/
 * conciliacion.ts) y los renglones salen de `renglonesConciliacion.js`.
 * La versión de celular (CashFlowMovil.jsx › Reportes) usa las mismas piezas
 * de acá (`useConciliacion`, `Renglones`, `estadoDe`, `exportarConciliacion`):
 * cambia la forma, no las cuentas.
 */
import { useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { money } from '@modules/productos/domain/format.js';
import { Table, Btn, s } from '@modules/productos/components/ui.jsx';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { Aviso, Bloque, Cargando, Tile, Tiles } from '../metricas/piezas.jsx';
import { Diferencia } from './Diferencia.jsx';
import { Fecha } from './Fecha.jsx';
import { ESTADOS, Pastilla } from './PlanillaDia.jsx';
import { fechaHoraSinDia } from './formato.js';
import { cascada, mesDe, nombreMes, otroMes, puenteMetricas, textoSinCaja, turnoParaMirar } from './renglonesConciliacion.js';

const BORDE = '1px solid var(--crm-color-border)';
const ENLACE = { marginLeft: 8, border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'var(--crm-color-primary)', fontSize: 12.5, fontWeight: 600 };
/** Qué movimientos explican cada renglón con detalle. */
const DETALLE = {
  ingreso: (x) => x.tipo === 'ingreso',
  pago_proveedor: (x) => x.tipo === 'egreso' && x.clase === 'pago_proveedor',
  otros: (x) => x.tipo === 'egreso' && (x.clase === 'concepto' || x.clase === 'otro'),
};

/** Cómo se ve el estado del sobre de una caja (la cerrada por un jefe no tiene sobre). */
export const estadoDe = (x) => (x.porJefe ? { texto: 'Cierre de siempre, sin sobre', color: 'var(--crm-color-text-secondary)' } : ESTADOS[x.estado]);

/** El mes y el local elegidos → la conciliación, el nombre del local y la lista de locales. */
export function useConciliacion(mes, sucursalId, version) {
  const { data: sucursales } = useResource('cashflow:sucursales', () => httpClient.get('/sucursales'));
  const qs = `mes=${mes}${sucursalId ? `&sucursalId=${sucursalId}` : ''}`;
  const { data, loading, error } = useResource(`cashflow:conciliacion:${qs}:${version}`, () => httpClient.get(`/cashflow/conciliacion?${qs}`));
  const local = sucursalId ? (sucursales ?? []).find((x) => String(x.id) === String(sucursalId))?.nombre ?? '' : '';
  return { d: data, loading, error, local, sucursales: sucursales ?? [] };
}

/** Todas las cajas del mes a CSV (también las que no tienen nada que mirar). */
export function exportarConciliacion(d, local) {
  descargarCsv(`conciliacion-efectivo-${d.mes}${local ? `-${local}` : ''}.csv`,
    ['Cierre', 'Local', 'Cajero', 'Generó', 'Debía ir en el sobre', 'Diferencia del cajero', 'Mandó', 'Sobre', 'Contaste', 'Diferencia al controlar'],
    d.turnos.map((x) => [
      fechaHoraSinDia(x.cierre), x.sucursal, x.cajero || '', csvNum(x.generado), x.debiaSobre == null ? '' : csvNum(x.debiaSobre),
      csvNum(x.difCajero), x.envio == null ? '' : csvNum(x.envio), estadoDe(x)?.texto ?? x.estado,
      x.contado == null ? '' : csvNum(x.contado), x.difControl == null ? '' : csvNum(x.difControl),
    ]));
}

/** Un importe con su signo adelante («+ $100», «− $100»); el subtotal va sin signo. */
function Importe({ r }) {
  if (r.diferencia) return <Diferencia v={r.valor} />;
  if (r.total) return <strong>{money(r.valor)}</strong>;
  const neg = r.valor < -0.004;
  return <span style={{ color: r.alerta ? 'var(--crm-color-warning)' : undefined }}>{neg ? '− ' : '+ '}{money(Math.abs(r.valor))}</span>;
}

/** La lista de renglones con sus subtotales. `detalle` = los movimientos agrupados, para abrir los que lo tienen. */
export function Renglones({ renglones, detalle = [], irA }) {
  const [abierto, setAbierto] = useState(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {renglones.map((r) => {
        const items = r.detalle ? detalle.filter(DETALLE[r.detalle]) : [];
        const abre = abierto === r.clave;
        return (
          <div
            key={r.clave}
            style={{
              padding: r.final ? 8 : r.total ? '8px 0' : '6px 0 6px 12px',
              borderTop: r.total ? BORDE : undefined,
              background: r.final ? 'color-mix(in srgb, var(--crm-color-primary) 7%, transparent)' : undefined,
              borderRadius: r.final ? 8 : 0,
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0, fontWeight: r.total ? 700 : 400 }}>
                {r.texto}
                {items.length > 0 && (
                  <button type="button" onClick={() => setAbierto(abre ? null : r.clave)} style={ENLACE} aria-expanded={abre}>
                    {abre ? 'Ocultar detalle' : `Ver detalle (${items.length})`}
                  </button>
                )}
                {r.accion === 'sobres' && irA && (
                  <button type="button" onClick={() => irA('sobres')} style={ENLACE}>
                    Ir a Sobres de caja
                  </button>
                )}
              </div>
              <div className={s.num} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: r.final ? 17 : undefined }}><Importe r={r} /></div>
            </div>
            {r.nota && <div className={s.hint} style={{ margin: '2px 0 0' }}>{r.nota}</div>}
            {abre && (
              <div style={{ margin: '6px 0 2px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.map((x, i) => (
                  <div key={i} className={s.hint} style={{ margin: 0, display: 'flex', gap: 12 }}>
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{x.nombre}{x.cantidad > 1 ? ` · ${x.cantidad} veces` : ''}</span>
                    <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(x.importe)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Conciliacion({ version, irA }) {
  const [mes, setMes] = useState(mesDe());
  const [sucursalId, setSucursalId] = useState('');
  const [todas, setTodas] = useState(false);
  const actual = mesDe();
  const { d, loading, error, local, sucursales } = useConciliacion(mes, sucursalId, version);
  const t = d?.total;
  const turnos = d ? (todas ? d.turnos : d.turnos.filter(turnoParaMirar)) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.toolbar}>
        <Btn small onClick={() => setMes(otroMes(mes, -1))} aria-label="Mes anterior">‹</Btn>
        <input id="conciliacion-mes" type="month" value={mes} max={actual} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes" />
        <Btn small onClick={() => setMes(otroMes(mes, 1))} disabled={mes >= actual} aria-label="Mes siguiente">›</Btn>
        <select id="conciliacion-local" className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} aria-label="Local">
          <option value="">Todos los locales</option>
          {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <Btn small onClick={() => exportarConciliacion(d, local)} disabled={!d?.turnos?.length}>Exportar CSV</Btn>
        </div>
      </div>

      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !d ? <Cargando /> : !d ? null : !t.turnos ? (
        <Aviso>No hay cajas cerradas en {nombreMes(d.mes)}{local ? ` en ${local}` : ''}.</Aviso>
      ) : (
        <>
          <div className={s.hint} style={{ margin: 0 }}>
            Las <strong>{t.turnos} cajas</strong> que cerraron en {nombreMes(d.mes)}{d.enCurso ? ' (hasta hoy)' : ''}{local ? ` en ${local}` : ''}.
            Cada número sale de lo que guardó la caja al cerrar y de tu control del sobre.
          </div>
          {d.descuadres.length > 0 && (
            <Aviso tono="warn">
              <strong>{d.descuadres.length === 1 ? 'Una caja no cuadra' : `${d.descuadres.length} cajas no cuadran`} con sus propios números:</strong>{' '}
              {d.descuadres.map((x) => `${x.sucursal}, cierre del ${fechaHoraSinDia(x.cierre)} (${x.motivos.join('; ')})`).join(' · ')}.
            </Aviso>
          )}

          {textoSinCaja(d.sinCaja) && <Aviso tono="warn"><strong>Efectivo cobrado sin caja.</strong> {textoSinCaja(d.sinCaja)}</Aviso>}
          <Tiles>
            <Tile label="Ventas cobradas en efectivo" valor={money(t.ventas)} detalle={t.cobranzas ? `+ ${money(t.cobranzas)} de cobranzas` : 'en esas cajas'} />
            <Tile label="Debía llegar en los sobres" valor={money(t.debiaSobres)} detalle="después de pagos, gastos y fondo" />
            <Tile label="Contaste en el Cash Flow" valor={money(t.contado)} marca="var(--crm-color-primary)" detalle={`de ${money(t.enviado)} que mandaron`} />
            <Tile
              label="Faltó"
              valor={t.faltantes < -0.004 ? money(Math.abs(t.faltantes)) : 'Nada'}
              alerta={t.faltantes < -0.004}
              detalle={`sobró ${money(t.sobrantes)} · al abrir, al cerrar y al controlar, sin compensar`}
            />
            <Tile label="Sin rendir" valor={money(t.sinRendir)} alerta={t.sinRendir > 0.004} detalle={t.sinRendirN ? `${t.sinRendirN} sobre${t.sinRendirN === 1 ? '' : 's'} sin controlar` : 'todos controlados'} />
          </Tiles>

          <Bloque titulo="De lo cobrado a lo contado" sub="Paso por paso, dónde fue cada peso del efectivo de las cajas.">
            <Renglones renglones={cascada(t)} detalle={d.detalle} irA={irA} />
          </Bloque>

          {d.desdeMetricas && (
            <Bloque
              titulo="Para cotejar con Métricas"
              sub="Métricas cuenta por día de venta; esta pantalla, por la caja en la que se cobró. Así se llega de un número al otro."
              acciones={<Pastilla color={d.desdeMetricas.cuadra ? 'var(--crm-color-success)' : 'var(--crm-color-danger)'}>{d.desdeMetricas.cuadra ? 'Coincide' : 'No coincide'}</Pastilla>}
            >
              <Renglones renglones={puenteMetricas(d.desdeMetricas)} />
              {!d.desdeMetricas.cuadra && (
                <Aviso tono="warn">
                  El puente no llega a {money(t.ventas)} (da {money(d.desdeMetricas.resultado)}). Hay ventas en efectivo cuyo local no es el de su caja: avisá para revisarlo.
                </Aviso>
              )}
              {d.enCurso && <div className={s.hint} style={{ margin: 0 }}>Métricas se actualiza cada 10 minutos: en el mes en curso puede ir un poco atrás.</div>}
            </Bloque>
          )}

          {d.porSucursal.length > 1 && (
            <Bloque titulo="Por local" sub="Tocá un local para ver solo el suyo.">
              <Table cols={[
                { h: 'Local' }, { h: 'Cajas', num: true }, { h: 'Generaron', num: true }, { h: 'Debía llegar', num: true }, { h: 'Dif. cajeros', num: true },
                { h: 'Mandaron', num: true }, { h: 'Sin rendir', num: true }, { h: 'Dif. al controlar', num: true }, { h: 'Contaste', num: true },
              ]}
              >
                {d.porSucursal.map((x) => (
                  <tr key={x.sucursalId} onClick={() => setSucursalId(String(x.sucursalId))} style={{ cursor: 'pointer' }} title={`Ver solo ${x.sucursal}`}>
                    <td><strong>{x.sucursal}</strong>{x.porJefe > 0 && <div className={s.hint} style={{ margin: 0 }}>{x.porJefe} sin sobre (cierre de siempre)</div>}</td>
                    <td className={s.num}>{x.turnos}</td>
                    <td className={s.num}>{money(x.generado)}</td>
                    <td className={s.num}>{money(x.debiaSobres)}</td>
                    <td className={s.num}><Diferencia v={x.difCajeros} /></td>
                    <td className={s.num}>{money(x.enviado)}</td>
                    <td className={s.num}>{x.sinRendir > 0.004 ? <span style={{ color: 'var(--crm-color-warning)' }}>{money(x.sinRendir)}</span> : '—'}</td>
                    <td className={s.num}><Diferencia v={x.difControl} /></td>
                    <td className={s.num}><strong>{money(x.contado)}</strong></td>
                  </tr>
                ))}
              </Table>
            </Bloque>
          )}

          <Bloque
            titulo="Caja por caja"
            sub={todas ? `Las ${d.turnos.length} cajas del mes.` : 'Las que tienen diferencia o todavía no se rindieron.'}
            acciones={(
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
                <input id="conciliacion-todas" type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
                Ver todas
              </label>
            )}
          >
            <Table
              cols={[
                { h: 'Cierre' }, { h: 'Local' }, { h: 'Cajero' }, { h: 'Debía ir', num: true }, { h: 'Dif. cajero', num: true },
                { h: 'Mandó', num: true }, { h: 'Sobre' }, { h: 'Contaste', num: true }, { h: 'Dif. al controlar', num: true },
              ]}
              empty="Ninguna caja con diferencia ni sin rendir: todo llegó como debía."
            >
              {turnos.map((x) => {
                const e = estadoDe(x);
                return (
                  <tr key={x.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Fecha v={x.cierre} />
                      {x.descuadre.length > 0 && <div style={{ color: 'var(--crm-color-warning)', fontSize: 12.5 }}>No cuadra: {x.descuadre.join('; ')}</div>}
                    </td>
                    <td>{x.sucursal}</td>
                    <td>{x.cajero || '—'}</td>
                    <td className={s.num}>{x.debiaSobre == null ? '—' : money(x.debiaSobre)}</td>
                    <td className={s.num}>
                      <Diferencia v={x.difCajero} />
                      {Math.abs(x.difApertura ?? 0) >= 0.005 && <div style={{ fontSize: 12.5 }}>al abrir <Diferencia v={x.difApertura} /></div>}
                    </td>
                    <td className={s.num}>{x.envio == null ? '—' : money(x.envio)}</td>
                    <td>{e && <Pastilla color={e.color}>{e.texto}</Pastilla>}</td>
                    <td className={s.num}>{x.contado == null ? '—' : money(x.contado)}</td>
                    <td className={s.num}><Diferencia v={x.difControl} /></td>
                  </tr>
                );
              })}
            </Table>
          </Bloque>
        </>
      )}
    </div>
  );
}
