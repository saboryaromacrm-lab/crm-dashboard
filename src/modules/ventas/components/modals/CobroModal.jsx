import { useEffect, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi } from '../../services/ventas.api.js';
import { CONDICIONES_IVA, MEDIOS_PAGO, TIPOS_VENTA, nroComprobante } from '../../domain/constants.js';
import { r2 } from '../../domain/pos.js';
import { Table, Btn, Di, ModalShell, VentaTag, money, s } from '../ui.jsx';
import p from '../../styles/Pos.module.css';

const EPS = 0.005;

/**
 * COBRO
 * ============================================================================
 * El último paso del ticket: **confirma el borrador**, no crea una venta nueva.
 * Lo que se emite es exactamente lo último que se guardó del ticket abierto, y
 * recién en ese momento se asigna número y se descuenta stock.
 *
 * Dos formas de cerrar, con su atajo:
 *  - **Liquidar (F10)**: comprobante interno (ticket), siempre al contado.
 *  - **Facturar (F7)**: comprobante fiscal; la letra la resuelve el backend
 *    según la condición de IVA de la empresa y la del cliente. Admite contado o
 *    cuenta corriente.
 *
 * Y dos condiciones de pago que no se mezclan:
 *  - **Contado**: los medios de pago tienen que sumar el total exacto (el
 *    backend lo revalida). El vuelto se calcula aparte, sobre lo que el cliente
 *    entrega en mano; no se guarda porque el cajón neto es el total.
 *  - **Cuenta corriente**: no lleva pagos. El dinero entra después con un
 *    recibo de cobranza, y ahí se imputa a este comprobante.
 */
export function CobroModal({ ventaId, renglones, totales, clienteId, cajaSesionId, onCobrado }) {
  const { getCliente, config, ctx, closeModal, toast } = useVentas();
  const cliente = getCliente(clienteId);

  const [condicionPago, setCondicionPago] = useState('contado');
  const [pagos, setPagos] = useState(() => [{ medio: 'efectivo', importe: String(totales.total) }]);
  const [entregado, setEntregado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [enviando, setEnviando] = useState(false);

  const ctaCteDisponible = !!config.ctaCteHabilitada && !!cliente?.ctaCteHabilitada;

  // El crédito se consulta solo si el camino de cuenta corriente está en juego.
  const { data: cuenta } = useResource(
    `cobro-cuenta:${clienteId}`,
    () => ventasApi.cuentaCliente(clienteId),
    { enabled: ctaCteDisponible && condicionPago === 'cuenta_corriente' },
  );

  const medios = useMemo(() => {
    const habilitados = (config.mediosPago ?? []).filter((m) => MEDIOS_PAGO[m]);
    return habilitados.length ? habilitados : Object.keys(MEDIOS_PAGO);
  }, [config.mediosPago]);

  const pagado = r2(pagos.reduce((a, x) => a + (Number(x.importe) || 0), 0));
  const faltante = r2(totales.total - pagado);

  const efectivoAsignado = r2(
    pagos.filter((x) => x.medio === 'efectivo').reduce((a, x) => a + (Number(x.importe) || 0), 0),
  );
  const hayEfectivo = efectivoAsignado > 0;
  const vuelto = entregado === '' ? null : r2(Number(entregado) - efectivoAsignado);

  const excedeCredito = useMemo(() => {
    if (condicionPago !== 'cuenta_corriente' || !cuenta || !cliente?.limiteCredito) return false;
    return cuenta.saldo + totales.total > cliente.limiteCredito + 1e-9;
  }, [condicionPago, cuenta, cliente, totales.total]);

  /* ------------------------------- Pagos ------------------------------- */
  const setPago = (i, campo, valor) =>
    setPagos((ps) => ps.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  /** El renglón nuevo arranca con lo que falta: el caso típico es partir el pago. */
  const agregarPago = () => setPagos((ps) => {
    const asignado = r2(ps.reduce((a, x) => a + (Number(x.importe) || 0), 0));
    const resto = Math.max(0, r2(totales.total - asignado));
    return [...ps, {
      medio: medios.find((m) => m !== 'efectivo') || medios[0],
      importe: resto > 0 ? String(resto) : '',
    }];
  });
  const quitarPago = (i) => setPagos((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps));
  /** Completa este renglón con lo que falta para llegar al total. */
  const completar = (i) => {
    const otros = r2(pagos.reduce((a, x, j) => (j === i ? a : a + (Number(x.importe) || 0)), 0));
    setPago(i, 'importe', String(Math.max(0, r2(totales.total - otros))));
  };
  /** Reparte el total en partes iguales entre los medios cargados. */
  const dividir = () => setPagos((ps) => {
    const parte = r2(totales.total / ps.length);
    return ps.map((x, i) => ({
      ...x,
      // El último absorbe el centavo del redondeo para que sume exacto.
      importe: String(i === ps.length - 1 ? r2(totales.total - parte * (ps.length - 1)) : parte),
    }));
  });

  /* ------------------------------ Confirmar ------------------------------ */

  /** `tipo`: 'ticket' liquida, 'factura' emite comprobante fiscal. */
  const confirmar = async (tipo) => {
    if (tipo === 'ticket' && condicionPago !== 'contado') {
      toast('Liquidar es al contado. Para cuenta corriente, facturá (F7).', 'err');
      return;
    }
    if (condicionPago === 'contado' && Math.abs(faltante) > 0.01) {
      toast(faltante > 0 ? `Faltan ${money(faltante)}.` : `Sobran ${money(-faltante)}.`, 'err');
      return;
    }
    if (excedeCredito && config.ctaCteBloquearSuperado) {
      toast('Supera el límite de crédito del cliente.', 'err');
      return;
    }
    setEnviando(true);
    try {
      const venta = await ventasApi.confirmarVenta(ventaId, {
        tipo,
        condicionPago,
        cajaSesionId: cajaSesionId ?? undefined,
        usuarioId: ctx.usuarioId ?? undefined,
        observaciones,
        pagos: condicionPago === 'contado'
          ? pagos.filter((x) => Number(x.importe) > 0).map((x) => ({ medio: x.medio, importe: r2(x.importe) }))
          : [],
      });
      onCobrado(venta, vuelto && vuelto > 0 ? vuelto : 0);
    } catch (e) {
      toast(e?.data?.message || 'No se pudo registrar la venta.', 'err');
    } finally {
      setEnviando(false);
    }
  };

  const pagosOk = condicionPago === 'cuenta_corriente'
    ? !(excedeCredito && config.ctaCteBloquearSuperado)
    : Math.abs(faltante) <= 0.01;
  const puedeLiquidar = pagosOk && condicionPago === 'contado' && !enviando;
  const puedeFacturar = pagosOk && !enviando;

  /** Qué comprobante sale si se factura (misma regla que aplica el backend). */
  const letraFactura = useMemo(() => {
    const empresa = config.condicionIvaEmpresa;
    if (empresa === 'monotributo' || empresa === 'exento') return 'factura_c';
    return cliente?.condicionIva === 'responsable_inscripto' ? 'factura_a' : 'factura_b';
  }, [config.condicionIvaEmpresa, cliente]);

  /* ------------------------------ Atajos ------------------------------ */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F10') { e.preventDefault(); if (puedeLiquidar) confirmar('ticket'); }
      else if (e.key === 'F7') { e.preventDefault(); if (puedeFacturar) confirmar('factura'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeLiquidar, puedeFacturar, condicionPago, pagos, observaciones, vuelto]);

  return (
    <ModalShell
      title="Cerrar venta"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        // Los botones nunca son un no-op silencioso: si no se puede cerrar,
        // `confirmar` avisa POR QUÉ (falta plata, es cta. cte., excede crédito).
        {
          texto: enviando ? 'Registrando…' : 'Facturar · F7',
          clase: puedeFacturar ? 'btn-ingreso' : 'btn-ghost',
          onClick: () => confirmar('factura'),
        },
        {
          texto: enviando ? 'Registrando…' : `Liquidar ${money(totales.total)} · F10`,
          clase: puedeLiquidar ? 'btn-primary' : 'btn-ghost',
          onClick: () => confirmar('ticket'),
        },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Cliente">
          {cliente?.nombre || '—'}
          {cliente && <div className={s.hint} style={{ margin: 0 }}>{CONDICIONES_IVA[cliente.condicionIva]?.label}</div>}
        </Di>
        <Di label="Artículos">{totales.renglones} ({totales.unidades})</Di>
        <Di label="Total"><strong style={{ fontSize: 20 }}>{money(totales.total)}</strong></Di>
      </div>

      <div className={s.hint}>
        <strong>Liquidar</strong> emite {TIPOS_VENTA.ticket.label} interno ·{' '}
        <strong>Facturar</strong> emite {TIPOS_VENTA[letraFactura]?.label}
        {!config.arcaHabilitado && ' (sin CAE: ARCA está desactivado en Configuración)'}.
      </div>

      <div className={s['section-title']}>Condición</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--crm-space-3)' }}>
        <Btn
          variant={condicionPago === 'contado' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setCondicionPago('contado')}
        >
          Contado
        </Btn>
        <Btn
          variant={condicionPago === 'cuenta_corriente' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setCondicionPago('cuenta_corriente')}
          disabled={!ctaCteDisponible}
        >
          Cuenta corriente
        </Btn>
      </div>
      {!ctaCteDisponible && (
        <div className={s.hint}>
          {config.ctaCteHabilitada
            ? `${cliente?.nombre || 'Este cliente'} no tiene cuenta corriente habilitada.`
            : 'La venta en cuenta corriente está deshabilitada en Configuración.'}
        </div>
      )}

      {condicionPago === 'cuenta_corriente' ? (
        <>
          {cuenta && (
            <div className={s['detalle-grid']}>
              <Di label="Saldo actual">{money(cuenta.saldo)}</Di>
              <Di label="Con esta venta">{money(cuenta.saldo + totales.total)}</Di>
              <Di label="Límite">{cliente?.limiteCredito > 0 ? money(cliente.limiteCredito) : 'Sin tope'}</Di>
            </div>
          )}
          {excedeCredito && (
            <div className={cx(s.callout, s.warn)}>
              Esta venta <strong>supera el límite de crédito</strong> de {cliente?.nombre}.
              {config.ctaCteBloquearSuperado
                ? ' Con el bloqueo activo no se puede confirmar: cobrala al contado o pedí una cobranza.'
                : ' El bloqueo está desactivado, así que se puede confirmar igual.'}
            </div>
          )}
          <div className={s.callout}>
            No se cobra ahora: el comprobante queda impago y se salda con un recibo de cobranza.
          </div>
        </>
      ) : (
        <>
          <div className={s['section-title']}>Medios de pago</div>
          {pagos.map((x, i) => (
            <div key={i} className={p.pagoFila}>
              <div className={s.field} style={{ marginBottom: 0 }}>
                {i === 0 && <label>Medio</label>}
                <select value={x.medio} onChange={(e) => setPago(i, 'medio', e.target.value)}>
                  {medios.map((m) => <option key={m} value={m}>{MEDIOS_PAGO[m]}</option>)}
                </select>
              </div>
              <div className={s.field} style={{ marginBottom: 0 }}>
                {i === 0 && <label>Importe</label>}
                <input
                  type="number" min="0" step="0.01" autoFocus={i === 0}
                  value={x.importe}
                  onChange={(e) => setPago(i, 'importe', e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn small onClick={() => completar(i)}>Resto</Btn>
                <Btn variant="btn-delete" small onClick={() => quitarPago(i)} disabled={pagos.length === 1}>×</Btn>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn small onClick={agregarPago}>+ Otro medio</Btn>
            {pagos.length > 1 && <Btn small onClick={dividir}>Partes iguales</Btn>}
          </div>

          <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-4)' }}>
            <Di label="Total">{money(totales.total)}</Di>
            <Di label="Asignado">{money(pagado)}</Di>
            <Di label={faltante >= 0 ? 'Falta' : 'Sobra'}>
              <span style={{ color: Math.abs(faltante) > 0.01 ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                {money(Math.abs(faltante))}
              </span>
            </Di>
          </div>

          {hayEfectivo && (
            <>
              <div className={s['section-title']}>Vuelto</div>
              <div className={s['form-grid']}>
                <div className={s.field}>
                  <label>Efectivo del ticket</label>
                  <input value={money(efectivoAsignado)} readOnly tabIndex={-1} />
                </div>
                <div className={s.field}>
                  <label>Con cuánto paga</label>
                  <input
                    type="number" min="0" step="100"
                    placeholder="0,00"
                    value={entregado}
                    onChange={(e) => setEntregado(e.target.value)}
                  />
                </div>
              </div>
              {vuelto !== null && (
                <div className={cx(p.vuelto, vuelto < 0 && p.faltante)}>
                  <span>{vuelto < 0 ? 'Falta que entregue' : 'Vuelto'}</span>
                  <span className={p.vueltoValor}>{money(Math.abs(vuelto))}</span>
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className={s.field} style={{ marginTop: 'var(--crm-space-3)' }}>
        <label>Observaciones</label>
        <input value={observaciones} placeholder="Opcional" onChange={(e) => setObservaciones(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Comprobante emitido
 * ==================================================================== */

/**
 * Confirmación posterior a la venta: qué se emitió y cuánto vuelto dar.
 * Los nombres salen de los renglones del ticket (la venta guarda ids), así que
 * el cajero lee lo mismo que acabó de cargar.
 */
export function VentaEmitidaModal({ venta, vuelto = 0, renglones = [], onNuevoTicket }) {
  const { closeModal, getCliente } = useVentas();
  const cliente = getCliente(venta.clienteId);

  const nombreDe = (it) => {
    const r = renglones.find(
      (x) => x.productoId === it.productoId && (x.presentacionId ?? null) === (it.presentacionId ?? null),
    );
    return r ? `${r.nombre} · ${r.detalle}` : `Producto #${it.productoId}`;
  };

  const cerrar = () => { closeModal(); onNuevoTicket?.(); };

  return (
    <ModalShell
      title="Venta registrada"
      wide
      onClose={cerrar}
      footer={[
        { texto: 'Imprimir', clase: 'btn-ghost', onClick: () => window.print() },
        { texto: 'Nuevo ticket', clase: 'btn-primary', onClick: cerrar },
      ]}
    >
      {vuelto > 0 && (
        <div className={p.vuelto} style={{ marginBottom: 'var(--crm-space-4)' }}>
          <span>Vuelto a entregar</span>
          <span className={p.vueltoValor}>{money(vuelto)}</span>
        </div>
      )}

      <div className={s['detalle-grid']}>
        <Di label="Comprobante"><VentaTag tipo={venta.tipo} /> <span className={s.mono}>{nroComprobante(venta)}</span></Di>
        <Di label="Cliente">{cliente?.nombre || '—'}</Di>
        <Di label="Condición">{venta.condicionPago === 'contado' ? 'Contado' : 'Cuenta corriente'}</Di>
      </div>

      <Table
        cols={[{ h: 'Artículo' }, { h: 'Cant.', num: true }, { h: 'Precio', num: true }, { h: 'Subtotal', num: true }]}
      >
        {venta.items.map((it) => (
          <tr key={it.id}>
            <td>{nombreDe(it)}</td>
            <td className={s.num}>{it.cantidad}</td>
            <td className={s.num}>{money(it.precioUnitario)}</td>
            <td className={s.num}>{money(it.subtotal)}</td>
          </tr>
        ))}
      </Table>

      <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-3)' }}>
        <Di label="Neto">{money(venta.subtotalNeto)}</Di>
        <Di label="IVA">{money(venta.ivaTotal)}</Di>
        <Di label="Total"><strong style={{ fontSize: 20 }}>{money(venta.total)}</strong></Di>
      </div>
    </ModalShell>
  );
}
