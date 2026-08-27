import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi } from '../../services/ventas.api.js';
import { MEDIOS_PAGO, nroComprobante } from '../../domain/constants.js';
import {
  Table, Btn, Di, ModalShell, VentaTag, CobranzaEstadoPill, SaldoMonto,
  money, fmtFecha, isoDate, s,
} from '../ui.jsx';

/** Redondeo a 2 decimales: mismo criterio que el backend, sin arrastre binario. */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const EPS = 0.005;

/* ==================================================================== *
 * Alta de cobranza
 * ==================================================================== */

export function CobranzaFormModal({ clienteId: clienteInicial, onChange }) {
  const { clientes, config, ctx, act, closeModal, toast, operadorId } = useVentas();

  const [clienteId, setClienteId] = useState(clienteInicial ? String(clienteInicial) : '');
  const [fecha, setFecha] = useState(() => isoDate(new Date()));
  const [observaciones, setObservaciones] = useState('');
  const [pagos, setPagos] = useState([{ medio: 'efectivo', importe: '', referencia: '' }]);
  /** { [ventaId]: importe } — solo los renglones que el usuario decidió imputar. */
  const [imputado, setImputado] = useState({});
  const [enviando, setEnviando] = useState(false);

  // La deuda se pide recién cuando hay cliente elegido.
  const { data: cuenta, loading: cargandoCuenta } = useResource(
    `cuenta-form:${clienteId}`,
    () => ventasApi.cuentaCliente(Number(clienteId)),
    { enabled: !!clienteId },
  );

  const deudores = useMemo(() => clientes.filter((c) => c.activo && c.ctaCteHabilitada), [clientes]);

  /** Medios habilitados en la configuración (los desconocidos se ignoran). */
  const medios = useMemo(() => {
    const habilitados = (config.mediosPago ?? []).filter((m) => MEDIOS_PAGO[m]);
    return habilitados.length ? habilitados : Object.keys(MEDIOS_PAGO);
  }, [config.mediosPago]);

  const comprobantes = cuenta?.comprobantes ?? [];

  const totalPagos = r2(pagos.reduce((a, p) => a + (Number(p.importe) || 0), 0));
  const totalImputado = r2(Object.values(imputado).reduce((a, v) => a + (Number(v) || 0), 0));
  const aCuenta = r2(totalPagos - totalImputado);
  const excedido = totalImputado > totalPagos + EPS;

  /* ---------------------------- Pagos ---------------------------- */
  const setPago = (i, campo, valor) =>
    setPagos((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  const agregarPago = () => setPagos((ps) => [...ps, { medio: medios[0], importe: '', referencia: '' }]);
  const quitarPago = (i) => setPagos((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps));

  /* -------------------------- Imputación -------------------------- */
  const setImputacion = (ventaId, valor) =>
    setImputado((m) => {
      const next = { ...m };
      if (valor === '' || Number(valor) <= 0) delete next[ventaId];
      else next[ventaId] = valor;
      return next;
    });

  /** Reparte el total cobrado sobre los comprobantes más viejos primero. */
  const imputarAuto = () => {
    if (totalPagos <= 0) { toast('Cargá primero el importe cobrado.', 'err'); return; }
    let resto = totalPagos;
    const next = {};
    for (const c of comprobantes) {
      if (resto <= EPS) break;
      const aplica = r2(Math.min(resto, c.saldo));
      if (aplica > 0) { next[c.id] = String(aplica); resto = r2(resto - aplica); }
    }
    setImputado(next);
    if (resto > EPS) toast(`Quedan ${money(resto)} sin imputar: se registran a cuenta.`, 'ok');
  };

  const cancelarTodo = () => setImputado({});

  /* ---------------------------- Guardar ---------------------------- */
  const guardar = async () => {
    if (!clienteId) { toast('Elegí el cliente.', 'err'); return; }
    if (totalPagos <= 0) { toast('Cargá al menos un medio de pago con importe.', 'err'); return; }
    if (excedido) { toast('Estás imputando más de lo cobrado.', 'err'); return; }

    for (const c of comprobantes) {
      const v = Number(imputado[c.id]) || 0;
      if (v > c.saldo + EPS) {
        toast(`El comprobante ${nroComprobante(c)} debe ${money(c.saldo)}.`, 'err');
        return;
      }
    }

    const payload = {
      clienteId: Number(clienteId),
      sucursalId: ctx.sucursalId ?? undefined,
      usuarioId: ctx.usuarioId ?? undefined,
      // El relevo (0088): el recibo lo firma quien está parado en la caja.
      operadorId: operadorId ?? undefined,
      fecha: new Date(`${fecha}T12:00:00`).toISOString(),
      observaciones,
      pagos: pagos
        .filter((p) => Number(p.importe) > 0)
        .map((p) => ({ medio: p.medio, importe: r2(p.importe), referencia: p.referencia })),
      imputaciones: Object.entries(imputado)
        .map(([ventaId, importe]) => ({ ventaId: Number(ventaId), importe: r2(importe) }))
        .filter((i) => i.importe > 0),
    };

    setEnviando(true);
    const ok = await act(ventasApi.crearCobranza(payload), 'Cobranza registrada.');
    setEnviando(false);
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title="Nueva cobranza"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: enviando ? 'Registrando…' : 'Registrar cobranza', clase: 'btn-primary', onClick: guardar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Cliente <span className={s.req}>*</span></label>
          <select
            value={clienteId}
            onChange={(e) => { setClienteId(e.target.value); setImputado({}); }}
          >
            <option value="">Elegí un cliente…</option>
            {deudores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {!clienteId && (
        <div className={s.hint}>Solo se listan clientes activos con cuenta corriente habilitada.</div>
      )}

      {/* ---------------- Medios de pago ---------------- */}
      <div className={s['section-title']}>Cómo paga</div>
      {pagos.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr auto', gap: 'var(--crm-space-3)', alignItems: 'end', marginBottom: 10 }}>
          <div className={s.field} style={{ marginBottom: 0 }}>
            {i === 0 && <label>Medio</label>}
            <select value={p.medio} onChange={(e) => setPago(i, 'medio', e.target.value)}>
              {medios.map((m) => <option key={m} value={m}>{MEDIOS_PAGO[m]}</option>)}
            </select>
          </div>
          <div className={s.field} style={{ marginBottom: 0 }}>
            {i === 0 && <label>Importe</label>}
            <input type="number" min="0" step="0.01" placeholder="0,00" value={p.importe} onChange={(e) => setPago(i, 'importe', e.target.value)} />
          </div>
          <div className={s.field} style={{ marginBottom: 0 }}>
            {i === 0 && <label>Referencia</label>}
            <input placeholder="N° de operación, cheque…" value={p.referencia} onChange={(e) => setPago(i, 'referencia', e.target.value)} />
          </div>
          <Btn variant="btn-delete" small onClick={() => quitarPago(i)} disabled={pagos.length === 1}>Quitar</Btn>
        </div>
      ))}
      <Btn small onClick={agregarPago}>+ Otro medio de pago</Btn>

      {/* ---------------- Imputación ---------------- */}
      <div className={s['section-title']} style={{ marginTop: 'var(--crm-space-4)' }}>A qué se imputa</div>

      {!clienteId ? (
        <div className={s['empty-state']}>Elegí un cliente para ver sus comprobantes impagos.</div>
      ) : cargandoCuenta ? (
        <div className={s['empty-state']}>Cargando cuenta corriente…</div>
      ) : (
        <>
          <div className={s.toolbar} style={{ marginBottom: 'var(--crm-space-3)' }}>
            <Btn small onClick={imputarAuto} disabled={!comprobantes.length}>Imputar automático (más viejo primero)</Btn>
            <Btn small onClick={cancelarTodo} disabled={!Object.keys(imputado).length}>Limpiar</Btn>
            <span className={s.ctxSpacer} />
            <span className={s.hint} style={{ margin: 0 }}>Saldo del cliente: <strong>{money(cuenta?.saldo ?? 0)}</strong></span>
          </div>

          <Table
            cols={[
              { h: 'Comprobante' }, { h: 'Fecha' }, { h: 'Vence' },
              { h: 'Saldo', num: true }, { h: 'A imputar', num: true },
            ]}
            empty="Este cliente no tiene comprobantes impagos. Lo cobrado queda a cuenta."
          >
            {comprobantes.map((c) => {
              const valor = imputado[c.id] ?? '';
              const invalido = Number(valor) > c.saldo + EPS;
              return (
                <tr key={c.id}>
                  <td><VentaTag tipo={c.tipo} /> <span className={s.mono}>{nroComprobante(c)}</span></td>
                  <td>{fmtFecha(c.fecha)}</td>
                  <td>{c.vencimientoPago ? fmtFecha(c.vencimientoPago) : <span className={s.muted}>—</span>}</td>
                  <td className={s.num}>{money(c.saldo)}</td>
                  <td className={s.num}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        max={c.saldo}
                        step="0.01"
                        placeholder="0,00"
                        value={valor}
                        onChange={(e) => setImputacion(c.id, e.target.value)}
                        style={{
                          width: 120, textAlign: 'right', padding: '6px 8px',
                          border: `1px solid ${invalido ? 'var(--crm-color-danger)' : 'var(--crm-color-border)'}`,
                          borderRadius: 'var(--crm-radius-sm)',
                          background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)',
                        }}
                      />
                      <Btn small onClick={() => setImputacion(c.id, String(c.saldo))}>Todo</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </>
      )}

      {/* ---------------- Totales ---------------- */}
      <div className={s['detalle-grid']} style={{ marginTop: 'var(--crm-space-4)' }}>
        <Di label="Total cobrado">{money(totalPagos)}</Di>
        <Di label="Imputado">{money(totalImputado)}</Di>
        <Di label={excedido ? 'Excedente' : 'Queda a cuenta'}>
          <span style={{ color: excedido ? 'var(--crm-color-danger)' : undefined }}>
            {money(Math.abs(aCuenta))}
          </span>
        </Di>
      </div>

      {excedido && (
        <div className={cx(s.callout, s.warn)}>
          Estás imputando <strong>{money(totalImputado)}</strong> y la cobranza es de <strong>{money(totalPagos)}</strong>.
        </div>
      )}
      {!excedido && aCuenta > EPS && (
        <div className={s.callout}>
          <strong>{money(aCuenta)}</strong> quedan <strong>a cuenta</strong>: bajan el saldo del cliente
          y se pueden imputar a un comprobante futuro.
        </div>
      )}

      <div className={s.field} style={{ marginTop: 'var(--crm-space-3)' }}>
        <label>Observaciones</label>
        <input value={observaciones} placeholder="Opcional" onChange={(e) => setObservaciones(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Detalle y anulación
 * ==================================================================== */

export function CobranzaDetalleModal({ cobranzaId, onChange }) {
  const { closeModal, openModal, getCliente } = useVentas();
  const { data: c, loading, error } = useResource(`cobranza:${cobranzaId}`, () => ventasApi.cobranza(cobranzaId));

  if (loading) {
    return <ModalShell title="Cobranza" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }
  if (error || !c) {
    return <ModalShell title="Cobranza" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
      <div className={cx(s.callout, s.warn)}>{error || 'No se encontró la cobranza.'}</div>
    </ModalShell>;
  }

  const cliente = getCliente(c.clienteId);
  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (c.estado === 'confirmada') {
    footer.push({
      texto: 'Anular',
      clase: 'btn-delete',
      onClick: () => openModal('anularCobranza', { cobranzaId, onChange }),
    });
  }

  return (
    <ModalShell title={`Recibo ${nroComprobante(c)}`} wide onClose={closeModal} footer={footer}>
      <div className={s['detalle-grid']}>
        <Di label="Cliente">{cliente?.nombre || `#${c.clienteId}`}</Di>
        <Di label="Fecha">{fmtFecha(c.fecha)}</Di>
        <Di label="Estado"><CobranzaEstadoPill estado={c.estado} /></Di>
        <Di label="Total cobrado">{money(c.total)}</Di>
        <Di label="Imputado">{money(c.total - c.aCuenta)}</Di>
        <Di label="A cuenta">{money(c.aCuenta)}</Di>
      </div>

      {c.estado === 'anulada' && (
        <div className={cx(s.callout, s.warn)}>
          Recibo <strong>anulado</strong>: no cuenta para el saldo del cliente ni para los comprobantes que tenía imputados.
        </div>
      )}

      <div className={s['section-title']}>Medios de pago</div>
      <Table cols={[{ h: 'Medio' }, { h: 'Referencia' }, { h: 'Importe', num: true }]} empty="Sin pagos.">
        {(c.pagos ?? []).map((p) => (
          <tr key={p.id}>
            <td>{MEDIOS_PAGO[p.medio] || p.medio}</td>
            <td>{p.referencia || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{money(p.importe)}</td>
          </tr>
        ))}
      </Table>

      <div className={s['section-title']}>Comprobantes imputados</div>
      <Table
        cols={[{ h: 'Comprobante' }, { h: 'Fecha' }, { h: 'Total', num: true }, { h: 'Imputado', num: true }]}
        empty="No se imputó a ningún comprobante: el importe quedó a cuenta."
      >
        {(c.imputaciones ?? []).map((i) => (
          <tr key={i.id}>
            <td><VentaTag tipo={i.tipo} /> <span className={s.mono}>{nroComprobante(i)}</span></td>
            <td>{fmtFecha(i.fecha)}</td>
            <td className={s.num}>{money(i.total)}</td>
            <td className={s.num}><SaldoMonto valor={0}>{money(i.importe)}</SaldoMonto></td>
          </tr>
        ))}
      </Table>

      {c.observaciones && <div className={s.callout}>{c.observaciones}</div>}
    </ModalShell>
  );
}

export function AnularCobranzaModal({ cobranzaId, onChange }) {
  const { act, closeModal, toast } = useVentas();
  /*
   * EL MOTIVO ES OBLIGATORIO, igual que al anular una venta, y por la misma
   * razón: el arqueo solo suma los recibos confirmados, así que anular uno le
   * saca esa plata al efectivo esperado del cajón y el cierre da diferencia 0.
   * Es la maniobra con la que se tapa un faltante. El motivo, con quién anuló y
   * cuándo (0060), es lo único que después distingue una corrección legítima.
   */
  const [motivo, setMotivo] = useState('');

  const anular = async () => {
    const razon = motivo.trim();
    if (!razon) {
      toast('Escribí por qué se anula: queda registrado con tu nombre.', 'err');
      return;
    }
    const ok = await act(ventasApi.anularCobranza(cobranzaId, razon), 'Cobranza anulada.');
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title="Anular cobranza"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Anular', clase: 'btn-delete', onClick: anular },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        El recibo queda <strong>anulado</strong> (no se borra) y sus imputaciones dejan de contar:
        los comprobantes involucrados vuelven a figurar como impagos y el saldo del cliente sube
        por el importe anulado.
      </div>

      <Di label="Por qué se anula" requerido>
        <input
          className={s.input}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Se cargó dos veces / el cheque no tenía fondos / error de importe"
          maxLength={300}
          autoFocus
        />
      </Di>
      <div className={s.hint}>
        Queda guardado con tu nombre y la hora. Si el turno de caja del recibo ya se cerró,
        no se puede anular: su arqueo está firmado y se corrige con un recibo nuevo.
      </div>
    </ModalShell>
  );
}
