/**
 * VENTAS › CONCILIACIÓN MP (18/11/2026, pedido del dueño)
 * ============================================================================
 * «Corroborar que ingresaron a mi cuenta» los cobros electrónicos: lo que el
 * ERP cobró por QR, tarjeta o transferencia contra lo que entró a la ÚNICA
 * cuenta de Mercado Pago. La API baja los pagos cada 5 minutos y ata sola lo
 * seguro; acá se ve, de un vistazo, solo lo que no cierra:
 *
 *   · el calendario del mes, un punto por día (verde cerró, amarillo para
 *     mirar, rojo falta plata);
 *   · lo vendido, lo que entró y lo que falta, por local y por medio; tocar un
 *     local filtra todo (calendario, números y listas) por ese local;
 *   · tres listas (de lo más reciente a lo más viejo): vendido y no entró,
 *     para confirmar, entró sin venta;
 *   · los avisos (devoluciones de Mercado Pago, ventas anuladas con la plata
 *     adentro) y, de un día, lo ya atado (con «Deshacer»).
 *
 * La cuenta la hace la API (`crm-api/src/mercadopago/conciliacion*.ts`).
 */
import { useState } from 'react';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi, errorMsg } from '../services/ventas.api.js';
import { FAMILIA, POR_QUE, cambioDeMedio, comprobanteDe, nombreAtado, estadoDia, mismoImporte, moverMes, nombreMedio, rangoMes, semanasDelMes } from '../domain/conciliacionMp.js';
import { CobroMp, PagoMp } from '../components/modals/ConciliacionMpModals.jsx';
import { PERMISO_CORREGIR_TRANSFERENCIA } from '../components/modals/TransferenciaAProveedor.jsx';
import { Btn, PanelHead, Stat, Table, fmtFechaHora, isoDate, money, s } from '../components/ui.jsx';

const COLOR = { ok: 'var(--crm-color-success)', revisar: 'var(--crm-color-warning)', falta: 'var(--crm-color-danger)' };
const NOMBRE_MES = (mes) => new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
const NOMBRE_DIA = (dia) => new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' });

/** El mes, de lunes a domingo; cada día con su punto y, si falta plata, cuánto. */
function Calendario({ mes, dias, dia, onDia }) {
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const hoy = isoDate(new Date());
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, maxWidth: 560 }}>
      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => <div key={i} className={s.hint} style={{ margin: 0, textAlign: 'center' }}>{x}</div>)}
      {semanasDelMes(mes).flat().map((d, i) => {
        if (!d) return <div key={i} />;
        const info = porDia.get(d);
        const estado = estadoDia(info);
        const elegido = d === dia;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onDia(d)}
            disabled={d > hoy}
            aria-pressed={elegido}
            title={info ? `Vendido ${money(info.vendido)} · entró ${money(info.entro)}` : 'Sin cobros electrónicos'}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 2px', borderRadius: 8, cursor: d > hoy ? 'default' : 'pointer',
              border: `1px solid ${elegido ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`,
              background: elegido ? 'var(--crm-color-primary-soft)' : 'var(--crm-color-surface)', opacity: d > hoy ? 0.4 : 1, font: 'inherit',
            }}
          >
            <span style={{ fontWeight: d === hoy ? 700 : 500 }}>{Number(d.slice(8))}</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[estado] ?? 'transparent' }} />
            <span style={{ fontSize: 10.5, color: 'var(--crm-color-danger)', minHeight: 13, whiteSpace: 'nowrap' }}>
              {info?.faltan > 0.009 ? money(info.faltan).replace(/,\d\d$/, '') : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** «Entraron $X menos que lo vendido» si los dos lados de un atado no suman lo mismo; si no, null. */
function diferenciaDe(g) {
  if (!g.cobros.length || !g.pagos.length) return null;
  const dif = g.cobros.reduce((a, c) => a + c.importe, 0) - g.pagos.reduce((a, p) => a + p.bruto, 0);
  if (Math.abs(dif) <= 0.009) return null;
  return dif > 0 ? `Entraron ${money(dif)} menos que lo vendido` : `Entraron ${money(-dif)} más que lo vendido`;
}

/** Una sección de pendientes con su título de color y cuántos son. */
function Seccion({ color, titulo, desc, n, children }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 16, color }}>{titulo} {n > 0 && <span style={{ fontWeight: 400 }}>({n})</span>}</h3>
      <div className={s.hint} style={{ margin: '0 0 8px' }}>{desc}</div>
      {children}
    </section>
  );
}

export function ConciliacionMpPanel() {
  const { openModal, toast } = useVentas();
  const { can } = usePermissions();
  /* La «Transferencia» de una venta que fue directo a un proveedor (0246): solo el superadmin. */
  const fueAProveedor = (c) => c.origen === 'venta' && c.medio === 'transferencia' && can(PERMISO_CORREGIR_TRANSFERENCIA);
  const hoy = isoDate(new Date());
  const [mes, setMes] = useState(hoy.slice(0, 7));
  /* Un día elegido, o null = todo el mes. Arranca en hoy. */
  const [dia, setDia] = useState(hoy);
  const [bajando, setBajando] = useState(false);
  const [verAtados, setVerAtados] = useState(false);
  /* El atado que espera «¿Seguro?» antes de deshacerse. */
  const [porDeshacer, setPorDeshacer] = useState(null);
  /* El local elegido en la tabla «por local» (null = todos). */
  const [local, setLocal] = useState(null);

  const rango = rangoMes(mes);
  const sucursalId = local?.id;
  const delMes = useResource(`conc-mp:${mes}:${sucursalId}`, () => ventasApi.conciliacionMp({ ...rango, sucursalId }));
  const delDia = useResource(`conc-mp-dia:${dia}:${sucursalId}`, () => ventasApi.conciliacionMp({ desde: dia, hasta: dia, conciliados: 1, sucursalId }), { enabled: !!dia });
  const d = dia ? delDia.data : delMes.data;
  const cargando = dia ? delDia.loading : delMes.loading;
  const error = (dia ? delDia.error : null) || delMes.error;
  const recargar = () => { delMes.reload(); if (dia) delDia.reload(); };

  const irAMes = (n) => { const m = moverMes(mes, n); setMes(m); setDia(m === hoy.slice(0, 7) ? hoy : null); };
  const actualizar = async () => {
    setBajando(true);
    try {
      const r = await ventasApi.conciliacionMpActualizar();
      if (r?.ultima?.error) toast(`Mercado Pago: ${r.ultima.error}`, 'err');
      else toast(`Listo: ${r?.ultima?.nuevos ?? 0} pago(s) nuevos o cambiados, ${r?.ultima?.atados ?? 0} atado(s) solos.`);
      recargar();
    } catch (e) {
      toast(errorMsg(e), 'err');
    } finally {
      setBajando(false);
    }
  };
  const deshacer = async (id) => {
    setPorDeshacer(null);
    try { await ventasApi.conciliacionMpDeshacer(id); toast('Deshecho: vuelve a pendientes.'); recargar(); } catch (e) { toast(errorMsg(e), 'err'); }
  };
  const corregirMedio = async (id) => {
    try {
      const r = await ventasApi.conciliacionMpCorregirMedio(id);
      toast(`Listo: la venta pasó a ${nombreMedio(r.ahora)} (quedó en Auditoría).`);
      recargar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };
  const verComprobante = (c) => (c.origen === 'recibo'
    ? openModal('cobranzaDetalle', { cobranzaId: c.docId })
    : openModal('detalleVenta', { ventaId: c.docId }));
  const atar = (props) => openModal('atarMp', { dia: dia ?? (props.cobro ?? props.pago).dia, onListo: recargar, ...props });
  const explicar = (props) => openModal('explicarMp', { onListo: recargar, ...props });
  /* Con otro importe no hay «Es este» de un clic: se abre el atado a mano con
   * los dos elegidos y hay que escribir por qué (puede ser plata que falta). */
  const confirmar = async (sug) => {
    if (!mismoImporte(sug.cobro, sug.pago)) { atar({ cobro: sug.cobro, pago: sug.pago }); return; }
    try {
      const r = await ventasApi.conciliacionMpAtar({ cobros: [sug.cobro.clave], pagos: [sug.pago.id] });
      toast(r?.medio ? `Atado. El medio de la venta pasó a ${nombreMedio(r.medio.ahora)}.` : 'Atado.');
      recargar();
    } catch (e) { toast(errorMsg(e), 'err'); }
  };

  const r = d?.resumen;
  const ultima = (d ?? delMes.data)?.ultima;

  return (
    <div>
      <PanelHead
        title="Conciliación MP"
        desc="Lo que el ERP cobró por QR, tarjeta o transferencia contra lo que entró a la cuenta de Mercado Pago. Se actualiza solo cada 5 minutos y ata solo lo seguro: acá queda lo que hay que mirar."
        actions={<Btn onClick={actualizar} disabled={bajando}>{bajando ? 'Actualizando…' : 'Actualizar ahora'}</Btn>}
      />
      {ultima && (
        <div className={s.hint} style={{ marginTop: -6 }}>
          Última actualización: {fmtFechaHora(ultima.en)}{ultima.error ? ` · error: ${ultima.error}` : ''}.
          {d?.arranque && ` Se concilia desde el ${d.arranque.split('-').reverse().join('/')}.`}
        </div>
      )}
      {d && !d.configurado && <div className={cx(s.callout, s.warn)}>Mercado Pago no está conectado en el servidor.</div>}
      {error && <div className={cx(s.callout, s.warn)}>{String(error)}</div>}

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Btn small onClick={() => irAMes(-1)} aria-label="Mes anterior">‹</Btn>
            <strong style={{ textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>{NOMBRE_MES(mes)}</strong>
            <Btn small onClick={() => irAMes(1)} disabled={mes >= hoy.slice(0, 7)} aria-label="Mes siguiente">›</Btn>
            <Btn small variant={dia ? 'btn-ghost' : 'btn-primary'} onClick={() => setDia(null)}>Todo el mes</Btn>
          </div>
          <Calendario mes={mes} dias={delMes.data?.dias ?? []} dia={dia} onDia={setDia} />
          <div className={s.hint} style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {[['ok', 'Cerró'], ['revisar', 'Para mirar'], ['falta', 'Falta plata']].map(([k, t]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[k] }} />{t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 8px' }}>
            <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{dia ? NOMBRE_DIA(dia) : `Todo ${NOMBRE_MES(mes)}`}</h3>
            {local && (
              <Btn small variant="btn-primary" onClick={() => setLocal(null)} title="Ver todos los locales">Solo {local.nombre} ✕</Btn>
            )}
          </div>
          {local && (
            <div className={s.hint} style={{ margin: '0 0 8px' }}>
              «Entró a Mercado Pago» cuenta solo los pagos que Mercado Pago dice que son de este local; las transferencias y los posnets sin local no entran al filtrar.
            </div>
          )}
          {r && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Stat label="Vendido electrónico" value={money(r.vendido)} nota="QR, tarjetas y transferencias del ERP" />
              <Stat label="Entró a Mercado Pago" value={money(r.entro)} />
              <Stat label="Falta en Mercado Pago" value={money(r.faltan)} accent={r.faltan > 0.009 ? 'accent-red' : 'accent-green'} nota="sin pago ni candidato" />
              {r.sinVenta > 0.009 && <Stat label="Entró sin venta" value={money(r.sinVenta)} accent="accent-amber" />}
              {r.comision != null && <Stat label="Comisión MP" value={money(r.comision)} nota={`neto ${money(r.neto)}`} />}
            </div>
          )}
          {d && (d.porSucursal.length > 0 || d.porMedio.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
              {[['Local', d.porSucursal, (x) => x.sucursal], ['Medio', d.porMedio, (x) => FAMILIA[x.familia] ?? x.familia]].map(([titulo, filas, nombre]) => (
                <Table key={titulo} cols={[{ h: titulo }, { h: 'Vendido', num: true }, { h: 'En MP', num: true }]}>
                  {filas.map((x) => (
                    <tr key={nombre(x)} style={titulo === 'Local' && local?.id === x.sucursalId ? { background: 'var(--crm-color-primary-soft)' } : undefined}>
                      <td>
                        {titulo === 'Local' && x.sucursalId ? (
                          <button
                            type="button"
                            className={s.linkBtn}
                            title={local?.id === x.sucursalId ? 'Ver todos los locales' : `Ver solo ${x.sucursal}`}
                            onClick={() => setLocal(local?.id === x.sucursalId ? null : { id: x.sucursalId, nombre: x.sucursal })}
                          >
                            {nombre(x)}
                          </button>
                        ) : nombre(x)}
                      </td>
                      <td className={s.num}>{money(x.vendido)}</td>
                      <td className={s.num}>
                        {money(x.confirmado)}
                        {x.vendido > 0 && <div className={s.hint} style={{ margin: 0 }}>{Math.round((x.confirmado / x.vendido) * 100)} %</div>}
                      </td>
                    </tr>
                  ))}
                </Table>
              ))}
            </div>
          )}
        </div>
      </div>

      {cargando && !d && <div className={s.hint}>Cargando…</div>}

      {d?.avisos?.length > 0 && (
        <div className={cx(s.callout, s.warn)} style={{ marginTop: 16 }}>
          <strong>Para revisar</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {d.avisos.map((a) => (
              <li key={a.id}>
                {a.avisos.join(' · ')}: {a.cobros.map((c) => <CobroMp key={c.clave} c={c} onVer={() => verComprobante(c)} />)}
                {a.pagos.map((p) => <PagoMp key={p.id} p={p} />)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {d && (
        <>
          <Seccion
            color="var(--crm-color-danger)"
            titulo="Vendido y no entró"
            n={d.faltan.length}
            desc="El ERP dice que se cobró por QR, tarjeta o transferencia, y en Mercado Pago no hay nada que se le parezca. Puede ser un error del cajero (era efectivo), un cobro que no pasó o plata que fue a otra cuenta."
          >
            <Table cols={[{ h: 'Cobro del ERP' }, { h: '', cls: 'actions-col' }]} empty="Nada: todo lo vendido tiene su pago.">
              {d.faltan.map((c) => (
                <tr key={c.clave}>
                  <td><CobroMp c={c} onVer={() => verComprobante(c)} /></td>
                  <td className={s['actions-col']}>
                    <div className={s['row-actions']}>
                      <Btn small onClick={() => atar({ cobro: c })}>Buscar el pago</Btn>
                      <Btn small onClick={() => explicar({ tipo: 'sin_mp', cobro: c, controlado: true })}>Ya lo controlé</Btn>
                      <Btn small variant="btn-ghost" onClick={() => explicar({ tipo: 'sin_mp', cobro: c })}>No entró</Btn>
                      {fueAProveedor(c) && (
                        <Btn
                          small title="El cliente le transfirió a un proveedor: pagárselo y aplicarlo"
                          onClick={() => openModal('transferenciaAProveedor', {
                            pago: { id: Number(c.clave.slice(1)), importe: c.importe }, documento: comprobanteDe(c), onListo: recargar,
                          })}
                        >
                          Fue a un proveedor
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Seccion>

          <Seccion
            color="var(--crm-color-warning)"
            titulo="Para confirmar"
            n={d.sugeridos.length}
            desc="Un cobro del ERP y el pago de Mercado Pago que más se le parece. Si es ese, «Es este»; si no, buscá otro. Si Mercado Pago dice que se cobró con otro medio, al confirmar se corrige el medio de la venta (el importe no cambia)."
          >
            <Table cols={[{ h: 'Cobro del ERP' }, { h: 'Pago en Mercado Pago' }, { h: 'Por qué' }, { h: '', cls: 'actions-col' }]} empty="Nada para confirmar.">
              {d.sugeridos.map((x) => (
                <tr key={x.cobro.clave}>
                  <td><CobroMp c={x.cobro} onVer={() => verComprobante(x.cobro)} /></td>
                  <td><PagoMp p={x.pago} /></td>
                  <td>
                    {POR_QUE[x.motivo]}
                    {cambioDeMedio(x.cobro, x.pago) && (
                      <div className={s.hint} style={{ margin: 0 }}>Al confirmar, la venta pasa de <strong>{cambioDeMedio(x.cobro, x.pago)}</strong></div>
                    )}
                  </td>
                  <td className={s['actions-col']}>
                    <div className={s['row-actions']}>
                      <Btn small variant="btn-primary" onClick={() => confirmar(x)}>{mismoImporte(x.cobro, x.pago) ? 'Es este' : 'Es este…'}</Btn>
                      <Btn small variant="btn-ghost" onClick={() => atar({ cobro: x.cobro })}>Otro…</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Seccion>

          <Seccion
            color="var(--crm-color-info)"
            titulo="Entró y no tiene venta"
            n={d.sinVenta.length}
            desc="Plata que entró a Mercado Pago sin un cobro en el ERP: un QR cobrado y registrado como efectivo, una transferencia de un cliente, o algo que no es una venta."
          >
            <Table cols={[{ h: 'Pago en Mercado Pago' }, { h: '', cls: 'actions-col' }]} empty="Nada: todo lo que entró tiene su venta.">
              {d.sinVenta.map((p) => (
                <tr key={p.id}>
                  <td><PagoMp p={p} /></td>
                  <td className={s['actions-col']}>
                    <div className={s['row-actions']}>
                      <Btn small onClick={() => atar({ pago: p })}>Buscar la venta</Btn>
                      <Btn small onClick={() => explicar({ tipo: 'sin_venta', pago: p, controlado: true })}>Ya lo controlé</Btn>
                      <Btn small variant="btn-ghost" onClick={() => explicar({ tipo: 'sin_venta', pago: p })}>No es venta</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Seccion>

          {d.conciliados && (
            <section style={{ marginTop: 20 }}>
              <Btn small variant="btn-ghost" onClick={() => setVerAtados((v) => !v)}>
                {verAtados ? 'Ocultar' : 'Ver'} lo ya atado ({d.conciliados.length})
              </Btn>
              {verAtados && (
                <Table cols={[{ h: 'Cobro del ERP' }, { h: 'Pago en Mercado Pago' }, { h: 'Cómo' }, { h: '', cls: 'actions-col' }]} empty="Nada atado este día.">
                  {d.conciliados.map((g) => (
                    <tr key={g.id}>
                      <td>{g.cobros.length ? g.cobros.map((c) => <CobroMp key={c.clave} c={c} onVer={() => verComprobante(c)} />) : <span className={s.muted}>—</span>}</td>
                      <td>{g.pagos.length ? g.pagos.map((p) => <PagoMp key={p.id} p={p} />) : <span className={s.muted}>—</span>}</td>
                      <td>
                        {nombreAtado(g)}
                        {(g.motivo || g.usuario) && <div className={s.hint} style={{ margin: 0 }}>{[g.motivo, g.usuario].filter(Boolean).join(' · ')}</div>}
                        {diferenciaDe(g) && <div style={{ margin: 0, color: 'var(--crm-color-danger)', fontSize: 12.5 }}>{diferenciaDe(g)}</div>}
                      </td>
                      <td className={s['actions-col']}>
                        <div className={s['row-actions']}>
                          {g.cobros.length === 1 && g.pagos.length === 1 && !g.cobros[0].medioAnterior && cambioDeMedio(g.cobros[0], g.pagos[0]) && (
                            <Btn small title={`Mercado Pago dice que se cobró con otro medio: ${cambioDeMedio(g.cobros[0], g.pagos[0])}`} onClick={() => corregirMedio(g.id)}>
                              Pasar a {nombreMedio(g.pagos[0].medioErp)}
                            </Btn>
                          )}
                          {porDeshacer === g.id ? (
                            <>
                              <Btn small variant="btn-delete" onClick={() => deshacer(g.id)}>Sí, deshacer</Btn>
                              <Btn small variant="btn-ghost" onClick={() => setPorDeshacer(null)}>No</Btn>
                            </>
                          ) : <Btn small variant="btn-ghost" onClick={() => setPorDeshacer(g.id)}>Deshacer</Btn>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
