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
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { imprimirVenta } from '@core/services/imprimir.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi, errorMsg } from '../../services/ventas.api.js';
import { MEDIOS_PAGO, CONDICIONES_PAGO, nroComprobante } from '../../domain/constants.js';
import {
  ModalShell, Table, Pill, VentaEstadoPill, VentaTag, Di, SaldoMonto,
  money, num, fmtFechaHora, s,
} from '../ui.jsx';

/* ============================== DETALLE ============================== */
export function DetalleVentaModal({ ventaId, onCambio }) {
  const { closeModal, openModal, toast, esJefe } = useVentas();
  const [imprimiendo, setImprimiendo] = useState(false);
  const { data: v, loading, error } = useResource(`venta:${ventaId}`, () => ventasApi.venta(ventaId));

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

  const pie = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (v) {
    pie.unshift({
      texto: imprimiendo ? 'Imprimiendo…' : 'Reimprimir',
      clase: 'btn-ghost',
      onClick: reimprimir,
    });
    // Anular es de administración: reingresa mercadería al stock.
    if (esJefe && v.estado === 'confirmada') {
      pie.unshift({
        texto: 'Anular',
        clase: 'btn-delete',
        onClick: () => openModal('anularVenta', { venta: v, onCambio }),
      });
    }
  }

  return (
    <ModalShell
      title={v ? `Venta ${nroComprobante(v)}` : 'Venta'}
      wide
      onClose={closeModal}
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
            <Di label="Turno de caja">{v.cajaSesionId ? `#${v.cajaSesionId}` : <span className={s.muted}>—</span>}</Di>
            <Di label="Cliente">{v.clienteNombre}</Di>
            <Di label="Condición">{CONDICIONES_PAGO[v.condicionPago] ?? v.condicionPago}</Di>
            {v.presupuestoId ? <Di label="Nació de">Pedido #{v.presupuestoId}</Di> : null}
          </div>

          <Table
            cols={[
              { h: 'Artículo' }, { h: 'Cant.', num: true }, { h: 'Precio', num: true },
              { h: 'Desc.', num: true }, { h: 'Oferta' }, { h: 'Subtotal', num: true },
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

          <h3 className={s['card-title']} style={{ marginTop: 'var(--crm-space-3)' }}>Cómo se pagó</h3>
          {v.pagos?.length ? (
            <Table cols={[{ h: 'Medio' }, { h: 'Referencia' }, { h: 'Importe', num: true }]}>
              {v.pagos.map((p) => (
                <tr key={p.id}>
                  <td>{MEDIOS_PAGO[p.medio] || p.medio}</td>
                  <td>{p.referencia || <span className={s.muted}>—</span>}</td>
                  <td className={s.num}>{money(p.importe)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <div className={s.hint}>
              Sin pagos registrados en el ticket
              {v.condicionPago === 'cuenta_corriente' ? ': quedó en la cuenta del cliente.' : '.'}
            </div>
          )}

          {v.condicionPago === 'cuenta_corriente' && (
            <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-2)' }}>
              <Di label="Cobrado (recibos)">{money(v.cobrado)}</Di>
              <Di label="Saldo"><SaldoMonto valor={v.saldo}>{money(v.saldo)}</SaldoMonto></Di>
            </div>
          )}

          {v.observaciones && (
            <div className={s.hint} style={{ marginTop: 8 }}>Observaciones: {v.observaciones}</div>
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
