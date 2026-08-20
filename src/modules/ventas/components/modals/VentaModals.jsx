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
import { cx } from '@shared/utils/classNames.js';
import { imprimirVenta } from '@core/services/imprimir.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi, errorMsg } from '../../services/ventas.api.js';
import {
  MEDIOS_PAGO, CONDICIONES_PAGO, nroComprobante, esNotaCredito,
} from '../../domain/constants.js';
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
    if (esJefe && v.estado === 'confirmada' && !esNotaCredito(v.tipo)) {
      if (v.cae) {
        /* Sin nada por acreditar no hay nota que emitir: la venta ya volvió
         * entera. El botón se apaga en vez de abrir un modal que solo puede
         * terminar en un rechazo. */
        if (v.acreditable > 0.009) {
          pie.unshift({
            texto: 'Nota de crédito',
            clase: 'btn-delete',
            onClick: () => openModal('notaCredito', { venta: v, onCambio }),
          });
        }
      } else {
        pie.unshift({
          texto: 'Anular',
          clase: 'btn-delete',
          onClick: () => openModal('anularVenta', { venta: v, onCambio }),
        });
      }
    }
  }

  return (
    <ModalShell
      title={v
        ? `${esNotaCredito(v.tipo) ? 'Nota de crédito' : 'Venta'} ${nroComprobante(v)}`
        : 'Venta'}
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

          {/* "Cómo se pagó" es de una VENTA. Una nota no se cobra: devuelve —
              lo que corresponde decir es qué efecto tuvo. */}
          {esNotaCredito(v.tipo) ? (
            <div className={s.hint} style={{ marginTop: 'var(--crm-space-3)' }}>
              {v.condicionPago === 'cuenta_corriente'
                ? `Le descuenta ${money(v.total)} de la cuenta corriente del cliente.`
                : `Devuelve ${money(v.total)} al cliente.`}
              {v.cajaSesionId ? ` La plata salió por el turno de caja #${v.cajaSesionId}.` : ''}
            </div>
          ) : (
            <>
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
                  {v.acreditado > 0.009 && <Di label="Acreditado (notas)">− {money(v.acreditado)}</Di>}
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
                Notas de crédito de esta venta
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
                <Di label="Acreditado">− {money(v.acreditado)}</Di>
                <Di label="Queda por acreditar"><strong>{money(v.acreditable)}</strong></Di>
              </div>
            </>
          )}

          {v.origen && (
            <div className={cx(s.callout)} style={{ marginTop: 'var(--crm-space-3)' }}>
              Esta nota de crédito ajusta <VentaTag tipo={v.origen.tipo} />{' '}
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
 *  3. SI SE DEVUELVE EL EFECTIVO por caja. Va apagado a propósito: hacerlo
 *     automático le descuadraría el arqueo a quien no lo esperaba.
 *
 * Los "otros cargos" (envío, packaging) solo viajan en la nota TOTAL: devolver
 * medio envío no significa nada y prorratearlo sería inventar un número.
 */
export function NotaCreditoModal({ venta, onCambio }) {
  const { closeModal, act, toast } = useVentas();
  const [motivo, setMotivo] = useState('');
  const [parcial, setParcial] = useState(false);
  const [devuelveMercaderia, setDevuelveMercaderia] = useState(true);
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
      toast('Escribí por qué se emite la nota de crédito: va impresa en el comprobante.', 'err');
      return;
    }
    if (!calc.elegidos.length) {
      toast('Elegí al menos un renglón para devolver.', 'err');
      return;
    }
    if (excede) {
      toast(`La nota da ${money(calc.total)} y de esta venta quedan ${money(tope)} por acreditar.`, 'err');
      return;
    }
    setEnviando(true);
    const nc = await act(
      ventasApi.notaCredito(venta.id, {
        motivo: razon,
        // Sin `items` la API emite la nota TOTAL, con los otros cargos adentro.
        items: parcial ? calc.elegidos : undefined,
        devuelveMercaderia,
        devolverEfectivo,
      }),
      'Nota de crédito emitida.',
      { recargar: false },
    );
    setEnviando(false);
    if (!nc) return;
    onCambio?.();
    /* Se imprime sola: una nota de crédito que no se le entrega al cliente no
     * sirve de nada, y volver a buscarla en el listado es un paso que se
     * olvida. Si el navegador bloquea la ventana, se avisa — el comprobante ya
     * está emitido y se reimprime desde el detalle. */
    try {
      const salio = await imprimirVenta(nc, { moneda: money, fechaHora: fmtFechaHora });
      if (!salio) {
        toast('La nota se emitió, pero el navegador bloqueó la impresión. Reimprimila desde el listado.', 'err');
      }
    } catch {
      toast('La nota se emitió, pero no se pudo imprimir. Reimprimila desde el listado.', 'err');
    }
  };

  return (
    <ModalShell
      title={`Nota de crédito de ${nroComprobante(venta)}`}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        {
          texto: enviando ? 'Emitiendo…' : `Emitir por ${money(calc.total)}`,
          clase: 'btn-delete',
          onClick: emitir,
        },
      ]}
    >
      <p>
        Esta venta tiene <strong>CAE {venta.cae}</strong>: existe para ARCA y no se puede anular.
        La nota de crédito es el comprobante que la corrige.
      </p>

      {venta.acreditado > 0.009 && (
        <div className={cx(s.callout, s.warn)}>
          Ya se acreditaron <strong>{money(venta.acreditado)}</strong> de esta venta con{' '}
          {venta.notas.length === 1 ? 'una nota anterior' : `${venta.notas.length} notas anteriores`}.
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
                    step="any"
                    disabled={agotado}
                    style={{ width: 90, textAlign: 'right' }}
                    value={cants[it.id] ?? ''}
                    placeholder="0"
                    onChange={(e) => setCants((p) => ({ ...p, [it.id]: e.target.value }))}
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
        <Di label="Total de la nota">
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
          Destildalo si la nota es por un error de precio o de facturación: ahí no volvió nada.
        </div>
      </div>

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
          {venta.condicionPago === 'cuenta_corriente'
            ? 'Esta venta fue en cuenta corriente: la nota ya le baja la deuda al cliente. Tildá esto solo si además se le entrega plata.'
            : 'Sale como egreso del turno abierto y le baja el efectivo esperado al arqueo.'}
        </div>
      </div>

      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input
          autoFocus
          maxLength={300}
          placeholder="Por ejemplo: el cliente devolvió 2 unidades falladas"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <div className={s.hint}>Va impreso en la nota y queda guardado con tu nombre.</div>
      </div>
    </ModalShell>
  );
}
