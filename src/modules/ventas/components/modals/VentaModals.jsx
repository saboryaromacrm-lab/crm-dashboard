/**
 * EL TICKET, VISTO DESPUÉS
 * ============================================================================
 * El detalle de una venta ya emitida: qué se vendió, con qué lista y qué
 * oferta, cómo se pagó y qué saldo dejó. Desde acá se reimprime (por el motor
 * de impresión de Sistema, con el formato configurado) y se anula.
 *
 * Los renglones muestran la lista y la oferta CONGELADAS al vender: si mañana
 * la promo se borra o la lista se renombra, este ticket sigue explicando por
 * qué costó lo que costó. Eso es lo que lo hace auditable.
 */
import { useMemo, useState } from 'react';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import { abrirVentanaImpresion, imprimirVenta } from '@core/services/imprimir.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi, errorMsg } from '../../services/ventas.api.js';
import {
  MEDIOS_COBRADOS, CONDICIONES_PAGO, nroComprobante, esNotaCredito,
} from '../../domain/constants.js';
import { segunMercadoPago } from '../../domain/conciliacionMp.js';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { avisarCuentasCompletas } from '@core/layout/components/cuentasCompletas.js';
import { comprobante, mediosDe } from '../../domain/notasCredito.js';
import { DeshacerTransferenciaDirecta, PERMISO_CORREGIR_TRANSFERENCIA, TransferenciaAProveedor } from './TransferenciaAProveedor.jsx';
import {
  ModalShell, Table, Pill, VentaEstadoPill, VentaTag, Di, SaldoMonto, Btn,
  money, num, fmtFechaHora, s,
} from '../ui.jsx';

/**
 * La celda «Según Mercado Pago» de un renglón de pago: dónde se cobró (QR del
 * mostrador y de qué caja, posnet con tarjeta, QR del posnet, fuera del
 * local), con qué pagó el cliente, el número de operación, y los avisos (el
 * medio del ERP no coincide, devuelto, «No entró»). Ver `segunMercadoPago`.
 */
function SegunMp({ info }) {
  if (!info) return <span className={s.muted}>—</span>;
  const chico = { fontSize: 12, margin: 0 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 320 }}>
      {info.pagos.map((x) => (
        <div key={x.id || x.donde}>
          <strong>{x.donde}</strong>
          {info.pagos.length > 1 && <span className={s.muted}> · {money(x.bruto)}</span>}
          {x.estado && <> <span style={{ color: 'var(--crm-color-danger)', fontWeight: 600 }}>· {x.estado}</span></>}
          {(x.como || x.operacion) && (
            <div className={s.muted} style={chico}>
              {[x.como && `Pagó con ${x.como}`, x.operacion && `Operación ${x.operacion}`].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      ))}
      {info.avisos.map((a) => (
        <div key={a} style={{ ...chico, color: 'var(--crm-color-warning)', fontWeight: 600 }}>⚠ {a}</div>
      ))}
      {info.fuente && <div className={s.muted} style={{ ...chico, fontStyle: info.sinDato ? 'italic' : 'normal' }}>{info.fuente}</div>}
    </div>
  );
}

/** Cómo se lee una cuenta disponible, igual que la referencia del renglón: proveedor · titular · alias. */
const refCuenta = (c) => `${c.proveedorNombre} · ${c.titular} · ${c.cbuAlias}`;
const estadoCuenta = (c) => (c.estado === 'cortada' ? 'cortada' : c.falta > 0.009 ? `faltan ${money(c.falta)}` : c.pasado > 0.009 ? `pasada por ${money(c.pasado)}` : 'cubierta');
const ORDEN_ESTADO = { abierta: 0, cubierta: 1, cortada: 2 };

/**
 * LA TRANSFERENCIA QUE FUE A UNA CUENTA DISPONIBLE (21/11/2026, pedido del
 * dueño). El cajero cargó como «Transferencia» plata que el cliente le mandó
 * al proveedor (venta 00034-00002293: todo a Becchio). El renglón pasa a
 * «Transf. a proveedor» de esa cuenta —aunque ya esté cubierta: la plata ya
 * está ahí—, el proveedor la tiene pagada y deja de esperarse en Mercado
 * Pago. Propone la cuenta que ya usa la venta en otro renglón.
 */
function CorregirTransferencia({ venta, pago, onHecho, onCancelar }) {
  const { toast } = useVentas();
  const { data, loading, error: errorCuentas } = useResource('cuentas-disponibles-todas', ventasApi.cuentasDisponiblesTodas);
  const usadas = useMemo(() => new Set(venta.pagos.filter((p) => p.medio === 'transferencia_proveedor').map((p) => p.referencia)), [venta.pagos]);
  const cuentas = useMemo(() => [...(data?.filas ?? [])].sort((a, b) => (usadas.has(refCuenta(b)) - usadas.has(refCuenta(a)))
    || ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.proveedorNombre.localeCompare(b.proveedorNombre, 'es')), [data, usadas]);
  const [elegidaId, setElegidaId] = useState('');
  const elegida = cuentas.find((c) => String(c.id) === elegidaId) ?? cuentas.find((c) => usadas.has(refCuenta(c))) ?? null;
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const importe = Number(pago.importe) || 0;
  const pasaraPor = elegida ? Math.max(0, Math.round((elegida.pagado + importe - elegida.importe) * 100) / 100) : 0;
  const sc = useSegundaConfirmacion(`${elegida?.id}|${motivo}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!elegida) { setError('Elegí a qué cuenta fue la transferencia.'); return false; }
      if (motivo.trim().length < 10) { setError('Escribí el motivo: qué pasó y cómo lo sabés.'); return false; }
      return true;
    },
    async () => {
      try {
        await ventasApi.corregirTransferencia(elegida.id, { ventaPagoId: pago.id, motivo: motivo.trim(), confirmado: true });
        toast(`Listo: ${money(importe)} quedaron pagados a ${elegida.proveedorNombre} (${elegida.titular}).`, 'ok');
        avisarCuentasCompletas();
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <div className={cx(s.callout, s.info)} style={{ display: 'grid', gap: 10, marginTop: 'var(--crm-space-2)' }}>
      <strong>La transferencia de {money(importe)} fue a una cuenta disponible</strong>
      <span className={s.hint} style={{ margin: 0 }}>
        Para cuando el cliente le transfirió al proveedor y se cargó como «Transferencia»: esa plata nunca entra a tu Mercado Pago.
        El renglón pasa a «Transf. a proveedor», el proveedor la tiene pagada y deja de esperarse en la Conciliación MP.
        No toca tu caja. Queda firmado por vos, con el motivo, en la cuenta y en la auditoría.
      </span>
      {loading && <div className={s.hint} style={{ margin: 0 }}>Buscando las cuentas…</div>}
      {errorCuentas && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>No se pudieron traer las cuentas: {errorCuentas}</div>}
      <div className={s.field}>
        <label htmlFor="corregir-transf-cuenta">¿A qué cuenta fue? <span className={s.req}>*</span></label>
        <select id="corregir-transf-cuenta" value={elegida ? String(elegida.id) : ''} onChange={(e) => setElegidaId(e.target.value)}>
          <option value="" disabled>Elegí la cuenta…</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{usadas.has(refCuenta(c)) ? '★ ' : ''}{refCuenta(c)} · {estadoCuenta(c)}</option>
          ))}
        </select>
      </div>
      <div className={s.field}>
        <label htmlFor="corregir-transf-motivo">Motivo <span className={s.req}>*</span></label>
        <input
          id="corregir-transf-motivo" value={motivo} maxLength={300}
          placeholder="Ej: el cliente le transfirió todo a Becchio; se cargó el resto como transferencia"
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      {elegida && (
        <div>
          La cuenta de <strong>{elegida.proveedorNombre}</strong> ({elegida.titular}) pasa de {money(elegida.pagado)} a{' '}
          <strong>{money(elegida.pagado + importe)}</strong> transferidos de {money(elegida.importe)}
          {pasaraPor > 0.009 && <>: queda <strong style={{ color: 'var(--crm-color-danger)' }}>pasada por {money(pasaraPor)}</strong>, a cuenta del proveedor</>}.
        </div>
      )}
      <AvisoSegundaConfirmacion {...sc}>
        Los {money(importe)} pasan a «Transf. a proveedor» de {elegida ? refCuenta(elegida) : '—'} y quedan pagados a {elegida?.proveedorNombre ?? '—'}.
      </AvisoSegundaConfirmacion>
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn small onClick={onCancelar}>Cancelar</Btn>
        <Btn small variant="btn-primary" onClick={confirmar} disabled={loading}>{textoBoton(sc, 'Corregir', 'Sí, corregir')}</Btn>
      </div>
    </div>
  );
}

/* ============================== DETALLE ============================== */
/** `volver`: se abrió desde otra ventana (la ficha del cliente) y al cerrar vuelve a ella. */
export function DetalleVentaModal({ ventaId, onCambio, volver }) {
  const { closeModal, openModal, toast } = useVentas();
  const cerrar = volver ?? closeModal;
  /*
   * LA PANTALLA MIRA LAS MISMAS LLAVES QUE EL SERVIDOR, y nada más.
   *
   *  - `nota_credito` (0080, solo administración): la nota de crédito de una
   *    FACTURA. Emite un comprobante fiscal y da vuelta el débito.
   *  - `devoluciones` (la llave del cajero): anular un ticket, y ahora también
   *    DEVOLVERLO por renglones. Antes el botón "Anular" pedía además ser jefe
   *    —un candado que existía solo acá, porque la API ya aceptaba al cajero—,
   *    y la devolución parcial de un ticket directamente no existía: había que
   *    anular la venta entera y recargarla. Decisión del dueño (11/9): el
   *    cajero atiende la devolución en el mostrador, con la plata y el stock
   *    pasando por el mismo circuito que la nota de crédito.
   */
  const { can } = usePermissions();
  const [imprimiendo, setImprimiendo] = useState(false);
  const { data: v, loading, error, reload } = useResource(`venta:${ventaId}`, () => ventasApi.venta(ventaId));
  /**
   * El renglón de pago que se está corrigiendo y cómo: `cuenta` (fue a una
   * cuenta disponible, 21/11/2026), `proveedor` (fue directo a un proveedor,
   * 0246) o `deshacer` (la directa no fue a ese proveedor).
   */
  const [corrigiendo, setCorrigiendo] = useState(null);

  /** Reimprime con el formato de Sistema › Impresión (rollo 80 por defecto). */
  const reimprimir = async () => {
    if (!v || imprimiendo) return;
    setImprimiendo(true);
    try {
      // Con CAE sale la factura con su QR; sin CAE, el ticket de siempre.
      const salio = await imprimirVenta(v, { moneda: money, fechaHora: fmtFechaHora });
      if (!salio) {
        toast('El navegador bloqueó la ventana de impresión. Permitile las ventanas emergentes a este sitio y probá de nuevo.', 'err');
      }
    } catch (e) {
      toast(`No se pudo reimprimir: ${errorMsg(e)}`, 'err');
    } finally {
      setImprimiendo(false);
    }
  };

  const pie = [{ texto: volver ? 'Volver' : 'Cerrar', clase: 'btn-ghost', onClick: cerrar }];
  if (v) {
    pie.unshift({
      texto: imprimiendo ? 'Imprimiendo…' : 'Reimprimir',
      clase: 'btn-ghost',
      onClick: reimprimir,
    });
    /*
     * DOS PUERTAS QUE NO SE PISAN, y cuál aparece no es una preferencia:
     *
     *  - CON CAE la venta ya existe para ARCA y no se puede anular nunca. Se
     *    corrige con una NOTA DE CRÉDITO, que es otro comprobante.
     *  - SIN CAE (ticket interno, o factura que todavía no se emitió) el
     *    comprobante es nuestro y se anula.
     *
     * Una nota de crédito no lleva ninguna de las dos: se corrige con una nota
     * de débito, que todavía no existe en el sistema.
     */
    if (v.estado === 'confirmada' && !esNotaCredito(v.tipo)) {
      if (v.cae) {
        /* Sin nada por acreditar no hay nota que emitir: la venta ya volvió
         * entera. El botón se apaga en vez de abrir un modal que solo puede
         * terminar en un rechazo. */
        if (can('nota_credito') && v.acreditable > 0.009) {
          pie.unshift({
            texto: 'Nota de crédito',
            clase: 'btn-delete',
            onClick: () => openModal('notaCredito', { venta: v, onCambio }),
          });
        }
      } else if (can('devoluciones')) {
        /* Sin CAE: Anular (todo o nada, la venta no debió existir) y, si es un
         * ticket ya emitido, Devolución (el cliente devuelve parte o todo, y
         * queda un comprobante que lo dice). Un ticket pendiente de facturar no
         * lleva devolución: primero se factura, o se anula. */
        /* Con devoluciones no se anula (la API tampoco): lo que queda se
         * devuelve por el resto, con el botón de al lado. */
        if (!(v.notas?.length)) {
          pie.unshift({
            texto: 'Anular',
            clase: 'btn-delete',
            onClick: () => openModal('anularVenta', { venta: v, onCambio }),
          });
        }
        if (v.tipo === 'ticket' && !v.facturarPendiente && v.acreditable > 0.009) {
          pie.unshift({
            texto: 'Devolución',
            clase: 'btn-delete',
            onClick: () => openModal('notaCredito', { venta: v, onCambio }),
          });
        }
      }
    }
  }

  return (
    <ModalShell
      title={v
        ? `${v.tipo === 'nota_credito_ticket' ? 'Devolución' : esNotaCredito(v.tipo) ? 'Nota de crédito' : 'Venta'} ${nroComprobante(v)}`
        : 'Venta'}
      wide
      onClose={cerrar}
      footer={pie}
    >
      {loading && <div className={s.hint}>Cargando el ticket…</div>}
      {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar: <strong>{error}</strong></div>}
      {v && (
        <>
          {v.estado === 'anulada' && (
            <div className={cx(s.callout, s.warn)}>
              Esta venta está <strong>ANULADA</strong>: la mercadería volvió al stock y no cuenta
              como plata que entró. Queda en el listado porque el número emitido no se borra.
            </div>
          )}

          <div className={s['detalle-grid']}>
            <Di label="Comprobante"><VentaTag tipo={v.tipo} /> <span className={s.mono}>{nroComprobante(v)}</span></Di>
            <Di label="Estado"><VentaEstadoPill estado={v.estado} /></Di>
            <Di label="Fecha">{fmtFechaHora(v.fecha)}</Di>
            <Di label="Sucursal">{v.sucursalNombre}</Di>
            <Di label="Cajero">{v.cajeroNombre}</Di>
            {/* Quién cobró, cuando no es quien armó (0060/0088, relevo de
                caja): la respuesta a "¿quién cerró esta venta?". */}
            {v.cobradoPorNombre ? <Di label="Cobrada por">{v.cobradoPorNombre}</Di> : null}
            <Di label="Turno de caja">{v.cajaSesionId ? `#${v.cajaSesionId}` : <span className={s.muted}>—</span>}</Di>
            <Di label="Cliente">{v.clienteNombre}</Di>
            <Di label="Condición">{CONDICIONES_PAGO[v.condicionPago] ?? v.condicionPago}</Di>
            {v.presupuestoId ? <Di label="Nació de">Pedido #{v.presupuestoId}</Di> : null}
          </div>

          <Table
            cols={[
              /* Los importes de los renglones van SIN IVA (el IVA se suma abajo); el
                 ticket los imprime con IVA. Sin decirlo, el precio de acá y el del
                 papel parecían no coincidir (30/10/2026). */
              { h: 'Artículo' }, { h: 'Cant.', num: true }, { h: 'Precio s/IVA', num: true },
              { h: 'Desc.', num: true }, { h: 'Oferta s/IVA' }, { h: 'Subtotal s/IVA', num: true },
            ]}
            empty="El ticket no tiene renglones."
          >
            {v.items.map((it) => (
              <tr key={it.id}>
                <td>
                  {it.nombre}
                  {it.lista ? <div className={s.hint}>{it.lista}</div> : null}
                </td>
                <td className={s.num}>{num(it.cantidad)} {it.unidad}</td>
                <td className={s.num}>{money(it.precioUnitario)}</td>
                <td className={s.num}>{it.descuento > 0 ? `${num(it.descuento, 1)}%` : <span className={s.muted}>—</span>}</td>
                <td>
                  {it.ofertaDescuento > 0
                    ? <span title={it.oferta}><Pill pill="est-preparada" label={`🏷 −${money(it.ofertaDescuento)}`} /></span>
                    : <span className={s.muted}>—</span>}
                </td>
                <td className={s.num}>{money(it.subtotal)}</td>
              </tr>
            ))}
          </Table>

          {v.extras?.length > 0 && (
            <Table cols={[{ h: 'Otros cargos' }, { h: 'IVA', num: true }, { h: 'Importe', num: true }]}>
              {v.extras.map((e) => (
                <tr key={e.id}>
                  <td>{e.concepto || 'Cargo'}</td>
                  <td className={s.num}>{num(e.iva, 1)}%</td>
                  <td className={s.num}>{money(e.importe)}</td>
                </tr>
              ))}
            </Table>
          )}

          <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-3)' }}>
            <Di label="Neto">{money(v.subtotalNeto)}</Di>
            <Di label="Descuentos">{v.descuentoTotal > 0 ? `− ${money(v.descuentoTotal)}` : money(0)}</Di>
            <Di label="IVA">{money(v.ivaTotal)}</Di>
            <Di label="Total"><strong style={{ fontSize: 19 }}>{money(v.total)}</strong></Di>
          </div>

          {/* "Cómo se pagó" es de una VENTA. Una nota no se cobra: devuelve —
              lo que corresponde decir es qué efecto tuvo. */}
          {esNotaCredito(v.tipo) ? (
            <div className={s.hint} style={{ marginTop: 'var(--crm-space-3)' }}>
              {v.condicionPago === 'cuenta_corriente'
                ? `Le descuenta ${money(v.total)} de la cuenta corriente del cliente.`
                : `Devuelve ${money(v.total)} al cliente.`}
              {v.cajaSesionId ? ` La plata salió por el turno de caja #${v.cajaSesionId}.` : ''}
              {v.cambio && (
                <div style={{ marginTop: 6 }}>
                  <strong>Cambio:</strong>{' '}
                  {v.cambio.usadoEn.filter((u) => u.estado !== 'anulada').map((u) => `pagó ${money(u.importe)} de ${comprobante(u)}`).join(' y ') || 'todavía no pagó ninguna venta'}
                  {v.cambio.efectivo > 0.009 && ` · se devolvieron ${money(v.cambio.efectivo)} en efectivo`}
                  {v.cambio.medio > 0.009 && ` · se devolvieron ${money(v.cambio.medio)} por el mismo medio`}
                  {v.cambio.saldo > 0.009 && <> · <strong style={{ color: 'var(--crm-color-danger)' }}>quedan {money(v.cambio.saldo)} sin resolver</strong> (se resuelve desde el punto de venta)</>}
                </div>
              )}
            </div>
          ) : (
            <>
              <h3 className={s['card-title']} style={{ marginTop: 'var(--crm-space-3)' }}>Cómo se pagó</h3>
              {v.pagos?.length ? (() => {
                /* Lo que dijo Mercado Pago de cada renglón: si fue el QR del
                 * mostrador (y de qué caja), el posnet con tarjeta o el QR del
                 * posnet. La columna aparece solo si algún renglón tiene algo. */
                const segun = new Map(v.pagos.map((p) => [p.id, segunMercadoPago(p, {
                  fechaVenta: v.fecha, nombreDelMedio: (m) => MEDIOS_COBRADOS[m] || m,
                })]));
                const conMp = [...segun.values()].some(Boolean);
                /* Una «Transferencia» sin atar a Mercado Pago se puede corregir: fue a una cuenta disponible o
                 * directo a un proveedor (0246). La directa se puede deshacer. */
                const vigente = ['confirmada', 'pendiente_cae'].includes(v.estado) && can(PERMISO_CORREGIR_TRANSFERENCIA);
                const corregible = (p) => vigente && p.medio === 'transferencia' && !p.mp;
                const deshacible = (p) => vigente && !!p.directoA;
                const conAccion = v.pagos.some((p) => corregible(p) || deshacible(p));
                const hecho = () => { setCorrigiendo(null); reload(); onCambio?.(); };
                const cancelar = () => setCorrigiendo(null);
                return (
                  <>
                    <Table cols={[
                      { h: 'Medio' }, ...(conMp ? [{ h: 'Según Mercado Pago' }] : []), { h: 'Referencia' }, { h: 'Importe', num: true },
                      ...(conAccion ? [{ h: '' }] : []),
                    ]}
                    >
                      {v.pagos.map((p) => (
                        <tr key={p.id}>
                          <td>{MEDIOS_COBRADOS[p.medio] || p.medio}</td>
                          {conMp && <td><SegunMp info={segun.get(p.id)} /></td>}
                          <td>{p.referencia || <span className={s.muted}>—</span>}</td>
                          <td className={s.num}>{money(p.importe)}</td>
                          {conAccion && (
                            <td>
                              {!corrigiendo && corregible(p) && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <Btn small onClick={() => setCorrigiendo({ como: 'cuenta', pago: p })} title="El cliente le transfirió al proveedor: pasarlo a «Transf. a proveedor»">
                                    Fue a una cuenta disponible
                                  </Btn>
                                  <Btn small onClick={() => setCorrigiendo({ como: 'proveedor', pago: p })} title="El cliente le transfirió a un proveedor sin cuenta disponible">
                                    Fue a un proveedor
                                  </Btn>
                                </div>
                              )}
                              {!corrigiendo && deshacible(p) && (
                                <Btn small onClick={() => setCorrigiendo({ como: 'deshacer', pago: p })} title={`Se anula el pago a ${p.directoA} y vuelve a «Transferencia»`}>
                                  No fue a {p.directoA}
                                </Btn>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </Table>
                    {corrigiendo?.como === 'cuenta' && <CorregirTransferencia venta={v} pago={corrigiendo.pago} onCancelar={cancelar} onHecho={hecho} />}
                    {corrigiendo?.como === 'proveedor' && <TransferenciaAProveedor pago={corrigiendo.pago} onCancelar={cancelar} onHecho={hecho} />}
                    {corrigiendo?.como === 'deshacer' && <DeshacerTransferenciaDirecta pago={corrigiendo.pago} onCancelar={cancelar} onHecho={hecho} />}
                  </>
                );
              })() : (
                <div className={s.hint}>
                  Sin pagos registrados en el ticket
                  {v.condicionPago === 'cuenta_corriente' ? ': quedó en la cuenta del cliente.' : '.'}
                </div>
              )}

              {v.condicionPago === 'cuenta_corriente' && (
                <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-2)' }}>
                  <Di label="Cobrado (recibos)">{money(v.cobrado)}</Di>
                  {v.acreditado > 0.009 && <Di label={v.tipo === 'ticket' ? 'Devuelto' : 'Acreditado (notas)'}>− {money(v.acreditado)}</Di>}
                  <Di label="Saldo"><SaldoMonto valor={v.saldo}>{money(v.saldo)}</SaldoMonto></Di>
                </div>
              )}
            </>
          )}

          {/* Las notas de crédito que ajustan ESTA venta, o la factura que
              ajusta esta nota. Es lo que hace que el comprobante se explique
              solo cuando alguien lo abre seis meses después. */}
          {v.notas?.length > 0 && (
            <>
              <h3 className={s['card-title']} style={{ marginTop: 'var(--crm-space-3)' }}>
                {v.tipo === 'ticket' ? 'Devoluciones de esta venta' : 'Notas de crédito de esta venta'}
              </h3>
              <Table cols={[{ h: 'Comprobante' }, { h: 'Fecha' }, { h: 'Motivo' }, { h: 'Importe', num: true }]}>
                {v.notas.map((n) => (
                  <tr key={n.id}>
                    <td><VentaTag tipo={n.tipo} /> <span className={s.mono}>{nroComprobante(n)}</span></td>
                    <td>{fmtFechaHora(n.fecha)}</td>
                    <td>{(n.observaciones || '').split('\n')[0] || <span className={s.muted}>—</span>}</td>
                    <td className={s.num}>− {money(n.total)}</td>
                  </tr>
                ))}
              </Table>
              <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-2)' }}>
                <Di label={v.tipo === 'ticket' ? 'Devuelto' : 'Acreditado'}>− {money(v.acreditado)}</Di>
                <Di label={v.tipo === 'ticket' ? 'Queda por devolver' : 'Queda por acreditar'}><strong>{money(v.acreditable)}</strong></Di>
              </div>
            </>
          )}

          {v.origen && (
            <div className={cx(s.callout)} style={{ marginTop: 'var(--crm-space-3)' }}>
              {v.tipo === 'nota_credito_ticket' ? 'Esta devolución es del' : 'Esta nota de crédito ajusta'}{' '}
              <VentaTag tipo={v.origen.tipo} />{' '}
              <span className={s.mono}>{nroComprobante(v.origen)}</span>, del{' '}
              {fmtFechaHora(v.origen.fecha)} por {money(v.origen.total)}.
            </div>
          )}

          {v.observaciones && (
            <div className={s.hint} style={{ marginTop: 8 }}>
              {/* En una nota, la primera línea es el motivo y la segunda el
                  rastro interno — que arriba ya se muestra como comprobante
                  asociado, así que repetirlo solo agrega ruido. */}
              {esNotaCredito(v.tipo)
                ? `Motivo: ${v.observaciones.split('\n')[0]}`
                : `Observaciones: ${v.observaciones}`}
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}

/* ============================== ANULAR ============================== */
/**
 * Anular no borra: cambia el estado y DEVUELVE la mercadería al stock. Por eso
 * pide confirmación con las consecuencias escritas — y por eso la API la
 * rechaza si la venta tiene cobranzas imputadas (primero se anula el recibo).
 */
export function AnularVentaModal({ venta, onCambio }) {
  const { closeModal, act, toast } = useVentas();
  /*
   * EL MOTIVO ES OBLIGATORIO, y la API lo exige igual que esta pantalla.
   *
   * Anular una venta al contado le baja el efectivo esperado al arqueo del
   * turno: es la forma de tapar un faltante y que el cierre dé diferencia 0. El
   * motivo, con quién anuló y cuándo, es lo único que después distingue una
   * devolución legítima de eso.
   */
  const [motivo, setMotivo] = useState('');

  const anular = () => {
    const razon = motivo.trim();
    if (!razon) {
      toast('Escribí por qué se anula: queda registrado con tu nombre.', 'err');
      return;
    }
    act(
      ventasApi.anularVenta(venta.id, razon),
      `Venta ${nroComprobante(venta)} anulada: la mercadería volvió al stock.`,
      { recargar: false },
    ).then((ok) => { if (ok) onCambio?.(); });
  };

  return (
    <ModalShell
      title={`Anular venta ${nroComprobante(venta)}`}
      onClose={closeModal}
      footer={[
        { texto: 'No anular', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Anular la venta', clase: 'btn-delete', onClick: anular },
      ]}
    >
      <p>
        Se va a anular el comprobante de <strong>{money(venta.total)}</strong> de{' '}
        <strong>{venta.clienteNombre}</strong>, del {fmtFechaHora(venta.fecha)}
      </p>
      <ul style={{ margin: '0 0 10px 18px', lineHeight: 1.6 }}>
        <li>
          {(venta.items?.length ?? 0) === 1
            ? <>El <strong>renglón vuelve al stock</strong></>
            : <><strong>Los {venta.items?.length ?? 0} renglones vuelven al stock</strong></>}
          {' '}de {venta.sucursalNombre}, con su movimiento.
        </li>
        <li>Deja de contar como plata vendida en los totales y en los reportes.</li>
        <li>El comprobante <strong>no se borra</strong>: queda anulado y visible (el número emitido no se recicla).</li>
      </ul>
      {venta.cobrado > 0.009 && (
        <div className={cx(s.callout, s.warn)}>
          Esta venta tiene <strong>{money(venta.cobrado)} cobrados</strong> con recibos imputados.
          Hay que anular primero la cobranza — si no, quedaría plata cobrada contra un comprobante
          que no existe.
        </div>
      )}
      <div className={s.field}>
        <label>Motivo de la anulación <span className={s.req}>*</span></label>
        <input
          autoFocus
          maxLength={300}
          placeholder="Por ejemplo: el cliente devolvió todo, se cargó dos veces…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      <div className={s.hint}>
        Queda guardado con tu nombre y la hora. Si la devolución es de una parte, no se anula:
        se hace una nota de crédito por lo devuelto.
      </div>
    </ModalShell>
  );
}

/* ========================== NOTA DE CRÉDITO ========================== */

/** Dos decimales, como redondea la API renglón por renglón. */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * LA NOTA DE CRÉDITO
 * ============================================================================
 * Una factura con CAE ya existe para ARCA: borrarla acá solo lograría que los
 * dos sistemas dejen de coincidir. Se corrige emitiendo OTRO comprobante que
 * dice "de aquella factura, esto vuelve" — y eso es esta pantalla.
 *
 * Total y parcial son el mismo circuito: la nota total es simplemente la que
 * lleva todos los renglones completos. Por eso no hay dos botones.
 *
 * TRES DECISIONES QUE SE TOMAN ACÁ Y NO SE PUEDEN ADIVINAR:
 *
 *  1. QUÉ RENGLONES vuelven y por cuánto. El precio es el de la venta
 *     ORIGINAL, no el de hoy: si el producto aumentó, no es problema del
 *     cliente.
 *  2. SI LA MERCADERÍA VUELVE al stock. Una nota por un error de precio no
 *     mueve un gramo; una devolución sí. Son la misma nota y distinta cosa.
 *  3. CÓMO SE DEVUELVE LA PLATA (0236), en una venta al contado: efectivo del
 *     cajón, por el mismo medio con que pagó (queda anotado) o un CAMBIO (se
 *     lleva otra mercadería ahora: la nota paga ese ticket en el punto de
 *     venta). Sin elegir no se emite: cada opción mueve la caja distinto. En
 *     cuenta corriente la nota ya baja la deuda; ahí queda el tilde de siempre
 *     por si además se entrega efectivo.
 *
 * Los "otros cargos" (envío, packaging) solo viajan en la nota TOTAL: devolver
 * medio envío no significa nada y prorratearlo sería inventar un número.
 */
export function NotaCreditoModal({ venta, onCambio }) {
  const { closeModal, act, toast, goPanel, panels } = useVentas();
  /*
   * LA MISMA PANTALLA PARA LA FACTURA Y PARA EL TICKET. La cuenta, los topes y
   * los renglones son idénticos; lo que cambia es cómo se llama el papel que
   * sale ("nota de crédito" o "devolución") y por qué puerta de la API entra.
   */
  const esTicket = venta.tipo === 'ticket';
  const contado = venta.condicionPago === 'contado';
  /* Del cajón solo sale lo que entró en efectivo (la API lo revalida con lo ya devuelto), y
   * «por el mismo medio» solo existe si se cobró con algo que no es efectivo. */
  const cobroEnEfectivo = (venta.pagos ?? []).some((p) => p.medio === 'efectivo');
  const otrosMedios = [...new Set((venta.pagos ?? []).map((p) => p.medio).filter((m) => m !== 'efectivo'))];
  const [motivo, setMotivo] = useState('');
  const [parcial, setParcial] = useState(false);
  const [devuelveMercaderia, setDevuelveMercaderia] = useState(true);
  /** Al contado: 'efectivo' | 'medio' | 'cambio', sin default (se elige). */
  const [devolucion, setDevolucion] = useState('');
  /** En cuenta corriente: si además de bajar la deuda se entrega efectivo. */
  const [devolverEfectivo, setDevolverEfectivo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  /** itemId → cantidad tipeada (solo en modo parcial). */
  const [cants, setCants] = useState({});

  const items = venta.items ?? [];

  /*
   * LA CUENTA, con las mismas reglas que `calcularTotales` de la API: bruto,
   * bonificación, oferta prorrateada, IVA sobre el neto sin redondear. No es
   * una estimación — si diera distinto, el usuario vería un número y firmaría
   * otro.
   */
  const calc = useMemo(() => {
    let neto = 0;
    let iva = 0;
    const elegidos = [];
    for (const it of items) {
      const cantOriginal = Number(it.cantidad) || 0;
      const cant = parcial ? (Number(cants[it.id]) || 0) : Number(it.devolvible ?? cantOriginal);
      if (!(cant > 0)) continue;
      elegidos.push({ itemId: it.id, cantidad: cant });
      const bruto = cant * (Number(it.precioUnitario) || 0);
      const bonificado = bruto * (1 - (Number(it.descuento) || 0) / 100);
      const ofertaProp = cantOriginal > 0
        ? r2((Number(it.ofertaDescuento) || 0) * (cant / cantOriginal))
        : 0;
      const netoCrudo = bonificado - Math.min(Math.max(0, ofertaProp), bonificado);
      neto += r2(netoCrudo);
      iva += r2((netoCrudo * (it.iva != null ? Number(it.iva) : 21)) / 100);
    }
    /* Los extras solo en la nota TOTAL — y "total" acá quiere decir que no se
     * está eligiendo renglones, igual que en la API — y solo si no viajaron ya
     * en una nota anterior. */
    if (!parcial && !venta.extrasAcreditados) {
      for (const e of venta.extras ?? []) {
        const importe = r2(e.importe);
        if (!(importe > 0)) continue;
        neto += importe;
        iva += (importe * (e.iva != null ? Number(e.iva) : 21)) / 100;
      }
    }
    neto = r2(neto);
    iva = r2(iva);
    return { elegidos, neto, iva, total: r2(neto + iva) };
  }, [items, cants, parcial, venta.extras]);

  const tope = Number(venta.acreditable ?? venta.total) || 0;
  const excede = calc.total > tope + 0.01;

  const emitir = async () => {
    const razon = motivo.trim();
    if (!razon) {
      toast(`Escribí por qué se ${esTicket ? 'registra la devolución' : 'emite la nota de crédito'}: va impreso en el comprobante.`, 'err');
      return;
    }
    if (!calc.elegidos.length) {
      toast('Elegí al menos un renglón para devolver.', 'err');
      return;
    }
    if (excede) {
      toast(`${esTicket ? 'La devolución' : 'La nota'} da ${money(calc.total)} y de esta venta quedan ${money(tope)} por ${esTicket ? 'devolver' : 'acreditar'}.`, 'err');
      return;
    }
    if (contado && !devolucion) {
      toast('Elegí cómo se le devuelve la plata: en efectivo, por el mismo medio, o si se lleva otra mercadería.', 'err');
      return;
    }
    setEnviando(true);
    /*
     * LA VENTANA DE IMPRESIÓN SE ABRE EN ESTE CLIC (7/10/2026, el dueño: «al
     * anular una venta facturada no imprime la nota de crédito»). La nota
     * espera a ARCA —puede tardar varios segundos— y recién después hay papel:
     * para entonces el navegador ya no lo toma como respuesta al clic y la
     * impresión no salía. Abierta ahora, se llena cuando llega la nota (el
     * mismo arreglo que el remito, ver `abrirVentanaImpresion`). Si la nota
     * falla, se cierra.
     */
    const ventana = abrirVentanaImpresion(esTicket ? 'Registrando la devolución…' : 'Emitiendo la nota de crédito en ARCA…');
    const nc = await act(
      (esTicket ? ventasApi.devolucion : ventasApi.notaCredito)(venta.id, {
        motivo: razon,
        // Sin `items` la API emite la nota TOTAL, con los otros cargos adentro.
        items: parcial ? calc.elegidos : undefined,
        devuelveMercaderia,
        devolucion: contado ? devolucion : (devolverEfectivo ? 'efectivo' : 'medio'),
      }),
      esTicket ? 'Devolución registrada.' : 'Nota de crédito emitida.',
      { recargar: false },
    );
    setEnviando(false);
    if (!nc) { try { ventana?.close(); } catch { /* ya cerrada */ } return; }
    onCambio?.();
    /* El cambio sigue en el punto de venta: ahí está la nota a favor, arriba del ticket. */
    if (devolucion === 'cambio' && panels.some((x) => x.id === 'pos')) {
      goPanel('pos');
      toast('Ahora armá el ticket de lo que se lleva y tocá «Usar en este ticket» en el cambio de arriba.', 'ok');
    }
    /* Se imprime sola: una nota de crédito que no se le entrega al cliente no
     * sirve de nada, y volver a buscarla en el listado es un paso que se
     * olvida. Si el navegador bloquea la ventana, se avisa — el comprobante ya
     * está emitido y se reimprime desde el detalle. */
    try {
      const salio = await imprimirVenta(nc, { moneda: money, fechaHora: fmtFechaHora, ventana });
      if (!salio) {
        toast(`${esTicket ? 'La devolución se registró' : 'La nota se emitió'}, pero el navegador bloqueó la impresión. Reimprimila desde el listado.`, 'err');
      }
    } catch {
      try { ventana?.close(); } catch { /* ya cerrada */ }
      toast(`${esTicket ? 'La devolución se registró' : 'La nota se emitió'}, pero no se pudo imprimir. Reimprimila desde el listado.`, 'err');
    }
  };

  return (
    <ModalShell
      title={`${esTicket ? 'Devolución' : 'Nota de crédito'} de ${nroComprobante(venta)}`}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: enviando
            ? (esTicket ? 'Registrando…' : 'Emitiendo…')
            : `${esTicket ? 'Devolver' : 'Emitir'} por ${money(calc.total)}`,
          clase: 'btn-delete',
          onClick: emitir,
        },
      ]}
    >
      {esTicket ? (
        <p>
          Elegí qué devuelve el cliente y cómo se le devuelve la plata. La mercadería vuelve al
          stock. Queda un comprobante de devolución con tu nombre, y el ticket original sigue
          existiendo con lo que no se devolvió.
        </p>
      ) : (
        <p>
          Esta venta tiene <strong>CAE {venta.cae}</strong>: existe para ARCA y no se puede anular.
          La nota de crédito es el comprobante que la corrige.
        </p>
      )}

      {venta.acreditado > 0.009 && (
        <div className={cx(s.callout, s.warn)}>
          Ya se {esTicket ? 'devolvieron' : 'acreditaron'} <strong>{money(venta.acreditado)}</strong> de esta venta con{' '}
          {venta.notas.length === 1
            ? (esTicket ? 'una devolución anterior' : 'una nota anterior')
            : `${venta.notas.length} ${esTicket ? 'devoluciones anteriores' : 'notas anteriores'}`}.
          Queda un tope de <strong>{money(tope)}</strong>.
        </div>
      )}

      <div className={s.field}>
        <label>Qué se devuelve</label>
        <div style={{ display: 'flex', gap: 'var(--crm-space-3)', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="radio" checked={!parcial} onChange={() => setParcial(false)} />
            {venta.acreditado > 0.009 ? 'Todo lo que queda' : 'Toda la venta'}
            {venta.extras?.length > 0 && !venta.extrasAcreditados ? ' (con los otros cargos)' : ''}
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="radio" checked={parcial} onChange={() => setParcial(true)} />
            Solo algunos renglones
          </label>
        </div>
      </div>

      <Table
        cols={[
          { h: 'Artículo' }, { h: 'Vendido', num: true }, { h: 'Ya devuelto', num: true },
          { h: 'Precio', num: true }, { h: parcial ? 'Devolver' : 'Devuelve', num: true },
        ]}
        empty="El comprobante no tiene renglones."
      >
        {items.map((it) => {
          const devolvible = Number(it.devolvible ?? it.cantidad) || 0;
          const agotado = devolvible <= 0.0001;
          return (
            <tr key={it.id} style={agotado ? { opacity: 0.5 } : undefined}>
              <td>
                {it.nombre}
                {it.lista ? <div className={s.hint}>{it.lista}</div> : null}
              </td>
              <td className={s.num}>{num(it.cantidad)} {it.unidad}</td>
              <td className={s.num}>
                {it.devuelto > 0.0001 ? num(it.devuelto) : <span className={s.muted}>—</span>}
              </td>
              <td className={s.num}>{money(it.precioUnitario)}</td>
              <td className={s.num}>
                {parcial ? (
                  <input
                    type="number"
                    min={0}
                    max={devolvible}
                    /* Por unidad se devuelve entero; solo el granel suelto (kg) admite decimales. */
                    step={it.unidad === 'kg' ? 'any' : 1}
                    disabled={agotado}
                    style={{ width: 90, textAlign: 'right' }}
                    value={cants[it.id] ?? ''}
                    placeholder="0"
                    onChange={(e) => {
                      const v = e.target.value;
                      const limpio = it.unidad === 'kg' || v === '' ? v : String(Math.trunc(Number(v) || 0));
                      setCants((p) => ({ ...p, [it.id]: limpio }));
                    }}
                  />
                ) : (
                  agotado
                    ? <span className={s.muted}>nada</span>
                    : <>{num(devolvible)} {it.unidad}</>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-3)' }}>
        <Di label="Neto">{money(calc.neto)}</Di>
        <Di label="IVA">{money(calc.iva)}</Di>
        <Di label={esTicket ? 'Total a devolver' : 'Total de la nota'}>
          <strong style={{ fontSize: 19, color: excede ? 'var(--crm-color-danger)' : 'inherit' }}>
            {money(calc.total)}
          </strong>
        </Di>
      </div>
      {excede && (
        <div className={cx(s.callout, s.warn)}>
          Se está acreditando más de lo que queda: el tope es <strong>{money(tope)}</strong>.
        </div>
      )}

      <div className={s.field} style={{ marginTop: 'var(--crm-space-2)' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={devuelveMercaderia}
            onChange={(e) => setDevuelveMercaderia(e.target.checked)}
          />
          La mercadería vuelve al stock de {venta.sucursalNombre}
        </label>
        <div className={s.hint}>
          Destildalo si {esTicket ? 'la devolución' : 'la nota'} es por un error de precio{esTicket ? '' : ' o de facturación'}: ahí no volvió nada.
        </div>
      </div>

      {contado ? (
        <div className={s.field}>
          <label>¿Cómo le devolvés los {money(calc.total)}? <span className={s.req}>*</span></label>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              {
                id: 'efectivo', titulo: 'En efectivo, del cajón', bloqueo: cobroEnEfectivo ? '' : 'La venta no se cobró en efectivo: del cajón no sale.',
                ayuda: 'Sale como egreso del turno abierto.',
              },
              otrosMedios.length > 0 && {
                id: 'medio', titulo: `Por el mismo medio con que pagó (${mediosDe(otrosMedios)})`,
                ayuda: 'Devolvelo desde la app de Mercado Pago, anulalo en el posnet o transferilo. No toca la caja: queda anotado.',
              },
              {
                id: 'cambio', titulo: 'Se lleva otra mercadería (cambio)',
                ayuda: `La nota queda a favor para el ticket que armás ahora, en ${venta.sucursalNombre}. Si se lleva más, paga la diferencia; si se lleva menos, el resto se le devuelve al cobrar.`,
              },
            ].filter(Boolean).map((o) => (
              <label key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, opacity: o.bloqueo ? 0.55 : 1 }}>
                <input
                  type="radio" name="devolucion" style={{ marginTop: 3 }}
                  checked={devolucion === o.id} disabled={!!o.bloqueo}
                  onChange={() => setDevolucion(o.id)}
                />
                <span>
                  <strong>{o.titulo}</strong>
                  <div className={s.hint} style={{ margin: 0 }}>{o.bloqueo || o.ayuda}</div>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className={s.field}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={devolverEfectivo}
              onChange={(e) => setDevolverEfectivo(e.target.checked)}
            />
            Devolver {money(calc.total)} en efectivo por caja
          </label>
          <div className={s.hint}>
            Esta venta fue en cuenta corriente: la nota ya le baja la deuda al cliente. Tildá esto solo si además se le entrega plata.
          </div>
        </div>
      )}

      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input
          autoFocus
          maxLength={300}
          placeholder="Por ejemplo: el cliente devolvió 2 unidades falladas"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <div className={s.hint}>Va impreso en el comprobante y queda guardado con tu nombre.</div>
      </div>
    </ModalShell>
  );
}
