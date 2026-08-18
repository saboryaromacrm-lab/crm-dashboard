/**
 * PAGOS EN SUCURSAL — modales del lado de Compras.
 * ============================================================================
 * Dos piezas del mismo circuito:
 *
 *   · TomarPagosComprobanteModal — desde la factura (en el alta o en su
 *     detalle): el documento toma los pagos a cuenta de su proveedor. Es el
 *     ÚNICO camino para aplicar: la bandeja de pagos es de solo lectura.
 *   · PagoSucursalDetalleModal — la ficha del pago: qué es, a qué se aplicó,
 *     quitar aplicaciones, moverlo a la bandeja de Gastos o anularlo.
 *
 * Regla de fondo: aplicar NUNCA mueve plata — el egreso ya quedó en el arqueo
 * de la caja que pagó. Y un pago de mercadería solo se aplica a facturas de
 * compra (el candado vive en la API; acá ni se ofrecen otros documentos).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, fmtFecha, fmtFechaHora } from '../../domain/format.js';
import { ModalShell } from '../Modal.jsx';
import { Table, Btn, Pill, s } from '../ui.jsx';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function Di({ label, children }) {
  return <div className={s.di}><div className={s.l}>{label}</div><div className={s.v}>{children}</div></div>;
}

/* ==================================================================== *
 * Tomar pagos a cuenta desde la factura recién registrada
 * ==================================================================== */

/**
 * El sentido inverso, y el momento perfecto: la factura acaba de registrarse
 * y el proveedor tiene plata pagada desde sucursal esperando. Un pago puede no
 * alcanzar y se toman varios; "Tomar todo" reparte del más viejo al más nuevo
 * sin pasarse ni del saldo de cada pago ni de lo que la factura debe.
 */
export function TomarPagosComprobanteModal({ comprobanteId, proveedorId, onChange }) {
  const { store, act, closeModal, toast } = useProductos();
  const [pagos, setPagos] = useState(null);
  const [saldoDoc, setSaldoDoc] = useState(null);
  const [montos, setMontos] = useState({});

  const cargar = useCallback(async () => {
    try {
      const [disp, docs] = await Promise.all([
        store.pagosDisponibles(proveedorId),
        store.pagosDocsPendientes(proveedorId),
      ]);
      setPagos(disp);
      setSaldoDoc(docs.find((d) => d.docId === comprobanteId)?.saldo ?? 0);
    } catch { toast('No se pudieron cargar los pagos a cuenta.', 'err'); }
  }, [store, proveedorId, comprobanteId, toast]);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * Misma regla que el alta: solo los pagos de LA SUCURSAL de esta factura.
   * Un pago de otra sucursal explica mercadería que entró allá — se toma
   * cargando o abriendo la factura de esa sucursal.
   */
  const sucComp = store.getComprobante(comprobanteId)?.sucursalId ?? null;
  const lista = useMemo(() => {
    const todos = pagos ?? [];
    return sucComp ? todos.filter((x) => x.sucursalId === sucComp) : todos;
  }, [pagos, sucComp]);
  const enOtras = r2((pagos ?? []).reduce((a, x) => a + x.saldo, 0) - lista.reduce((a, x) => a + x.saldo, 0));
  const totalAAplicar = useMemo(
    () => Object.values(montos).reduce((a, v) => a + (Number(v) || 0), 0),
    [montos],
  );

  const tomarTodo = () => {
    let falta = saldoDoc ?? 0;
    const next = {};
    for (const x of lista) {
      if (falta <= 0.009) break;
      const cuanto = Math.min(falta, x.saldo);
      next[x.id] = String(r2(cuanto));
      falta = r2(falta - cuanto);
    }
    setMontos(next);
  };

  const aplicar = async () => {
    const tomas = lista
      .map((x) => ({ x, importe: r2(montos[x.id]) }))
      .filter((t) => t.importe > 0.009);
    if (!tomas.length) { toast('Poné cuánto tomar de al menos un pago.', 'err'); return; }
    if (saldoDoc != null && totalAAplicar - saldoDoc > 0.009) {
      toast(`La factura solo debe ${money(saldoDoc)}: no se puede aplicar más.`, 'err');
      return;
    }

    // Una imputación por pago. Si una falla a mitad de camino, lo ya aplicado
    // queda aplicado (es correcto y auditable) y el error se muestra.
    for (const t of tomas) {
      const res = await store.imputarPago(
        t.x.id,
        [{ comprobanteId, importe: t.importe }],
        store.state.ctx.usuarioId ?? undefined,
      );
      if (!res.ok) { toast(res.error || 'No se pudo aplicar un pago.', 'err'); await cargar(); return; }
    }
    await act(Promise.resolve({ ok: true }), `${tomas.length} pago(s) aplicados a la factura.`);
    onChange?.();
  };

  const footer = [{ texto: 'Ahora no', clase: 'btn-ghost', onClick: closeModal }];
  if (pagos === null) {
    return <ModalShell title="Pagos a cuenta" onClose={closeModal} footer={footer}>
      <div className={s['empty-state']}>Buscando pagos a cuenta…</div>
    </ModalShell>;
  }

  return (
    <ModalShell
      title="Este proveedor tiene pagos a cuenta"
      subtitle={`La factura quedó registrada · debe ${saldoDoc != null ? money(saldoDoc) : '—'}`}
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Ahora no', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Aplicar a la factura', clase: 'btn-primary', onClick: aplicar },
      ]}
    >
      <div className={s.hint} style={{ marginTop: 0 }}>
        Plata que ya salió de las cajas de las sucursales y esperaba esta factura. Tomarla acá la
        descuenta de la deuda — no vuelve a mover plata.
      </div>

      <div className={s.toolbar} style={{ marginBottom: 8 }}>
        <Btn small onClick={tomarTodo}>Tomar todo lo que la factura debe</Btn>
        <span className={s.hint} style={{ margin: 0 }}>
          A aplicar: <strong>{money(totalAAplicar)}</strong>{saldoDoc != null ? ` de ${money(saldoDoc)}` : ''}
        </span>
      </div>

      <Table
        cols={[
          { h: 'Pago' }, { h: 'Origen' }, { h: 'Disponible', num: true }, { h: 'Tomar', num: true },
        ]}
        empty={sucComp
          ? 'No quedan pagos a cuenta de este proveedor en la sucursal de esta factura.'
          : 'No quedan pagos a cuenta de este proveedor.'}
      >
        {lista.map((x) => (
          <tr key={x.id}>
            <td>
              {x.esFlete && <><Pill pill="est-recibida" label="Flete" />{' '}</>}
              {fmtFechaHora(x.fecha)}
              {x.concepto && <div className={s.hint} style={{ margin: 0 }}>{x.concepto}</div>}
            </td>
            <td>
              {x.sucursalNombre || '—'}
              {x.cajaSesionId && <div className={s.hint} style={{ margin: 0 }}>Turno #{x.cajaSesionId} · {x.usuarioNombre}</div>}
            </td>
            <td className={s.num}><strong>{money(x.saldo)}</strong></td>
            <td className={s.num}>
              <input
                type="number" min="0" step="any" style={{ maxWidth: 130 }}
                placeholder="0,00"
                value={montos[x.id] ?? ''}
                onChange={(e) => setMontos((m) => ({ ...m, [x.id]: e.target.value }))}
              />
            </td>
          </tr>
        ))}
      </Table>

      {enOtras > 0.009 && (
        <div className={s.hint}>
          El proveedor tiene además <strong>{money(enOtras)}</strong> pagados desde otras
          sucursales. Acá no se ofrecen: se toman desde la factura cuya sucursal de recepción
          sea la que pagó.
        </div>
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Detalle del pago
 * ==================================================================== */

export function PagoSucursalDetalleModal({ pagoId, onChange }) {
  const { store, act, closeModal, toast } = useProductos();
  const [pago, setPago] = useState(null);
  const [motivoAnular, setMotivoAnular] = useState('');

  const cargar = useCallback(async () => {
    try { setPago(await store.pagoSucursal(pagoId)); }
    catch { toast('No se pudo cargar el pago.', 'err'); }
  }, [store, pagoId, toast]);

  useEffect(() => { cargar(); }, [cargar]);

  const quitar = async (imputacionId) => {
    const ok = await act(store.quitarImputacionPago(imputacionId), 'Aplicación quitada.');
    if (ok) { onChange?.(); }
  };

  const mover = async () => {
    const ok = await act(
      store.moverDestinoPago(pagoId, 'gastos'),
      'Pago movido a Gastos › Pagos en sucursal.',
    );
    if (ok) onChange?.();
  };

  const anular = async () => {
    if (!motivoAnular.trim()) { toast('Escribí por qué se anula.', 'err'); return; }
    const ok = await act(store.anularPago(pagoId, motivoAnular.trim()), 'Pago anulado.');
    if (ok) onChange?.();
  };

  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (!pago) {
    return <ModalShell title="Pago en sucursal" onClose={closeModal} footer={footer}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }

  const vivo = pago.estado === 'activo';
  const sinAplicar = pago.saldo > 0.009;

  return (
    <ModalShell title={`Pago #${pago.id} · ${pago.proveedorNombre}`} subtitle={pago.concepto || undefined} wide onClose={closeModal} footer={footer}>
      <div className={s['detalle-grid']}>
        <Di label="Estado">
          {!vivo
            ? <Pill pill="est-cancelada" label="Anulado" />
            : sinAplicar ? <Pill pill="est-pendiente" label="Sin aplicar" /> : <Pill pill="est-recibida" label="Aplicado" />}
        </Di>
        <Di label="Fecha y hora">{fmtFechaHora(pago.fecha)}</Di>
        <Di label="Sucursal">{pago.sucursalNombre || '—'}</Di>
        <Di label="Caja">{pago.cajaSesionId ? `Turno #${pago.cajaSesionId} · ${pago.usuarioNombre}` : 'No salió de caja'}</Di>
        <Di label="Importe"><strong>{money(pago.importe)}</strong></Di>
        <Di label="Sin aplicar">{money(pago.saldo)}</Di>
        <Di label="Referencia">{pago.referencia || '—'}</Di>
        <Di label="Bandeja">
          Compras (mercadería)
          {pago.esFlete && <div className={s.hint} style={{ margin: 0 }}>Flete que el proveedor descuenta</div>}
        </Di>
      </div>

      <div className={s['section-title']}>Aplicado a</div>
      <Table
        cols={[{ h: 'Factura' }, { h: 'Fecha' }, { h: 'Importe', num: true }, { h: '', cls: 'actions-col' }]}
        empty="Todavía no se aplicó a ninguna factura."
      >
        {(pago.imputaciones || []).map((i) => (
          <tr key={i.id}>
            <td>{i.etiqueta}</td>
            <td>{fmtFecha(i.fecha)}</td>
            <td className={s.num}><strong>{money(i.importe)}</strong></td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']}>
                <Btn variant="btn-delete" small onClick={() => quitar(i.id)}>Quitar</Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {vivo && pago.aplicado <= 0.009 && (
        <>
          <div className={s['section-title']}>Correcciones</div>
          <div className={s.callout}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 220 }}>
                ¿La cajera eligió mal el tipo? Este pago era de un proveedor de <strong>gastos</strong>:
              </span>
              <Btn small onClick={mover}>Mover a Gastos</Btn>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              <input
                style={{ flex: 1, minWidth: 220 }}
                placeholder="Motivo de anulación (obligatorio)"
                value={motivoAnular}
                onChange={(e) => setMotivoAnular(e.target.value)}
              />
              <Btn variant="btn-delete" small onClick={anular}>Anular pago</Btn>
            </div>
            <div className={s.hint} style={{ margin: '8px 0 0' }}>
              Anular elimina también el egreso de la caja si el turno sigue abierto; con el turno
              cerrado se rechaza (el arqueo ya se firmó) y el reintegro va como ingreso de caja.
            </div>
          </div>
        </>
      )}

      {pago.observaciones && <div className={s.callout} style={{ whiteSpace: 'pre-line' }}>{pago.observaciones}</div>}
    </ModalShell>
  );
}
