import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../../context/GastosContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { gastosApi } from '../../services/gastos.api.js';
import { MEDIOS_PAGO, hoyISO, r2 } from '../../domain/constants.js';
import {
  Table, Btn, Di, ModalShell, Pill, Saldo, money, fmtFecha, fmtFechaHora, s,
} from '../ui.jsx';

/* ==================================================================== *
 * Registrar un pago (desde el módulo, no desde la caja)
 * ==================================================================== */

/**
 * El mismo pago que hace la cajera, pero desde el escritorio: la transferencia
 * que hace el administrador. Si el medio es efectivo y hay turno abierto en la
 * sucursal, se ofrece descontarlo de esa caja.
 */
export function PagoFormModal({ proveedorId: proveedorFijo, onChange }) {
  const {
    proveedores, sucursales, ctx, esJefe, nombreSucursal, act, closeModal, toast,
  } = useGastos();
  const [proveedorId, setProveedorId] = useState(proveedorFijo ? String(proveedorFijo) : '');
  const [importe, setImporte] = useState('');
  const [medio, setMedio] = useState('transferencia');
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [sucursalId, setSucursalId] = useState(ctx.sucursalId ? String(ctx.sucursalId) : '');
  const [desdeCaja, setDesdeCaja] = useState(true);

  const { data: caja } = useResource(
    `caja-actual-pago:${sucursalId}`,
    () => gastosApi.cajaActual(Number(sucursalId)),
    { enabled: !!sucursalId },
  );
  const hayTurno = !!caja?.id && caja.estado === 'abierta';
  const saleDeCaja = medio === 'efectivo' && hayTurno && desdeCaja;

  const registrar = async () => {
    if (!proveedorId) { toast('Elegí a qué proveedor se le pagó.', 'err'); return; }
    if (!(Number(importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    const res = await act(
      gastosApi.crearPago({
        proveedorId: Number(proveedorId),
        importe: r2(importe),
        medio,
        fecha,
        concepto: concepto.trim(),
        referencia: referencia.trim(),
        sucursalId: sucursalId ? Number(sucursalId) : undefined,
        cajaSesionId: saleDeCaja ? caja.id : undefined,
        usuarioId: ctx.usuarioId ?? undefined,
      }),
      'Pago registrado. Queda a cuenta: se aplica al cargar el gasto (o desde su detalle).',
    );
    if (!res) return;
    onChange?.();
    // No se encadena a aplicar: aplicar se hace desde el DOCUMENTO. Si el
    // gasto ya está cargado, el camino es su detalle › "Aplicar un pago
    // existente" — y si se quiere pagar un gasto puntual, su botón "Pagar"
    // registra y aplica en un solo paso.
  };

  return (
    <ModalShell
      title="Registrar un pago a proveedor"
      subtitle="Queda a cuenta hasta que se aplique a una factura o gasto"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar pago', clase: 'btn-primary', onClick: registrar },
      ]}
    >
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Proveedor <span className={s.req}>*</span></label>
          {/* Solo los de GASTOS: este pago nace con destino gastos y solo va a
              poder aplicarse a gastos. Para mercadería está Compras. */}
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} disabled={!!proveedorFijo}>
            <option value="">Elegí el proveedor</option>
            {proveedores
              .filter((p) => p.proveeGastos || p.id === Number(proveedorFijo))
              .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Importe <span className={s.req}>*</span></label>
          <input type="number" min="0" step="0.01" autoFocus value={importe} onChange={(e) => setImporte(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Medio</label>
          <select value={medio} onChange={(e) => setMedio(e.target.value)}>
            {Object.entries(MEDIOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Concepto</label>
          <input value={concepto} placeholder="Ej: pedido de gaseosas" onChange={(e) => setConcepto(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Referencia</label>
          <input value={referencia} placeholder="Nº de transferencia, remito…" onChange={(e) => setReferencia(e.target.value)} />
        </div>
        <div className={s.field}>
          <label>Sucursal</label>
          {/* Si el medio es efectivo, la API exige que el turno sea el de la
              sucursal de la sesión: elegir otra terminaba en un rechazo. Y de
              esta sucursal depende a qué documentos se va a poder aplicar el
              pago después. Solo administración elige. */}
          {esJefe ? (
            <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Sin sucursal</option>
              {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          ) : (
            <input value={nombreSucursal(ctx.sucursalId)} disabled />
          )}
        </div>
      </div>

      {medio === 'efectivo' && (
        hayTurno ? (
          <div className={s.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={desdeCaja} onChange={(e) => setDesdeCaja(e.target.checked)} />
              Sale del turno de caja #{caja.id}
            </label>
            <div className={s.hint} style={{ margin: '6px 0 0' }}>
              Tildado, queda registrado el egreso y el arqueo de ese turno lo va a mostrar.
            </div>
          </div>
        ) : (
          <div className={s.hint}>
            No hay turno abierto en esa sucursal: el pago se registra igual pero no impacta en
            ningún arqueo.
          </div>
        )
      )}
    </ModalShell>
  );
}

/* ==================================================================== *
 * Detalle del pago
 * ==================================================================== */

export function DetallePagoModal({ pagoId, onChange }) {
  const { act, closeModal, openModal } = useGastos();
  const { data: p, loading, error, reload } = useResource(`pago-det:${pagoId}`, () => gastosApi.pago(pagoId));

  const quitar = async (imputacionId) => {
    const ok = await act(gastosApi.desimputar(imputacionId), 'Imputación quitada.');
    if (ok) { reload(); onChange?.(); }
  };

  /** La cajera eligió mal el tipo: el pago era por mercadería. */
  const mover = async () => {
    const ok = await act(
      gastosApi.moverDestino(pagoId, 'mercaderia'),
      'Pago movido a Compras › Pagos en sucursal.',
    );
    if (ok) onChange?.();
  };

  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (loading || error || !p) {
    return <ModalShell title="Pago a proveedor" onClose={closeModal} footer={footer}>
      {loading
        ? <div className={s['empty-state']}>Cargando…</div>
        : <div className={cx(s.callout, s.warn)}>{error || 'No se encontró el pago.'}</div>}
    </ModalShell>;
  }

  const vivo = p.estado === 'activo';

  return (
    <ModalShell
      title={`Pago #${p.id} · ${p.proveedorNombre}`}
      subtitle={p.concepto || undefined}
      wide
      onClose={closeModal}
      footer={[
        ...(vivo && p.aplicado <= 0.009 && p.proveedorId
          ? [{ texto: 'Mover a Compras', clase: 'btn-ghost', onClick: mover }]
          : []),
        ...(vivo && p.aplicado <= 0.009
          ? [{ texto: 'Anular', clase: 'btn-delete', onClick: () => openModal('anularPago', { pagoId: p.id, onChange }) }]
          : []),
        { texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Estado">
          {!vivo
            ? <Pill pill="est-cancelada" label="Anulado" />
            : p.saldo > 0.009
              ? <Pill pill="est-pendiente" label="Sin aplicar" />
              : <Pill pill="est-recibida" label="Aplicado" />}
        </Di>
        <Di label="Fecha y hora">{fmtFechaHora(p.fecha)}</Di>
        <Di label="Medio">{MEDIOS_PAGO[p.medio] || p.medio}</Di>
        <Di label="Importe"><strong>{money(p.importe)}</strong></Di>
        <Di label="Aplicado">{money(p.aplicado)}</Di>
        <Di label="Sin aplicar"><Saldo valor={p.saldo}>{money(p.saldo)}</Saldo></Di>
        <Di label="Sucursal">{p.sucursalNombre || '—'}</Di>
        <Di label="Quién">{p.usuarioNombre || '—'}</Di>
        <Di label="Caja">{p.cajaSesionId ? `Turno #${p.cajaSesionId}` : 'No salió de caja'}</Di>
        <Di label="Referencia">{p.referencia || '—'}</Di>
      </div>

      {vivo && p.saldo > 0.009 && (
        <div className={s.hint}>
          Este pago se aplica <strong>desde el gasto</strong>: al cargarlo se ofrece solo, y si el
          gasto ya está cargado, desde su detalle con "Aplicar un pago existente".
        </div>
      )}

      <div className={s['section-title']}>Aplicado a</div>
      <Table
        cols={[{ h: 'Documento' }, { h: 'Fecha' }, { h: 'Importe', num: true }, { h: '', cls: 'actions-col' }]}
        empty="Todavía no se aplicó a ningún documento."
      >
        {(p.imputaciones || []).map((i) => (
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

      {p.observaciones && (
        <div className={s.callout} style={{ whiteSpace: 'pre-line' }}>{p.observaciones}</div>
      )}
    </ModalShell>
  );
}

export function AnularPagoModal({ pagoId, onChange }) {
  const { act, closeModal, toast } = useGastos();
  const [motivo, setMotivo] = useState('');

  const anular = async () => {
    if (!motivo.trim()) { toast('Escribí por qué se anula.', 'err'); return; }
    const ok = await act(gastosApi.anularPago(pagoId, motivo.trim()), 'Pago anulado.');
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title={`Anular el pago #${pagoId}`}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Anular', clase: 'btn-delete', onClick: anular },
      ]}
    >
      <div className={cx(s.callout, s.warn)}>
        Si el pago salió de un turno de caja <strong>todavía abierto</strong>, se elimina también
        ese egreso y la caja vuelve a cuadrar sola. Si el turno ya se cerró, la anulación se
        rechaza: hay que registrar el reintegro como ingreso del turno actual.
      </div>
      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input autoFocus value={motivo} placeholder="Ej: se cargó dos veces" onChange={(e) => setMotivo(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Cuenta corriente del proveedor
 * ==================================================================== */

/** La cuenta COMPLETA: mercadería + gastos − pagos. Una entidad, un saldo. */
export function CuentaProveedorModal({ proveedorId }) {
  const { closeModal, getProveedor, openModal } = useGastos();
  const prov = getProveedor(proveedorId);
  const { data: cuenta, loading } = useResource(
    `cuenta-prov:${proveedorId}`,
    () => gastosApi.cuentaProveedor(proveedorId),
  );
  const { data: docs } = useResource(
    `docs-prov:${proveedorId}`,
    () => gastosApi.documentosPendientes(proveedorId),
  );

  const footer = [
    { texto: 'Registrar un pago', clase: 'btn-primary', onClick: () => openModal('pagoForm', { proveedorId }) },
    { texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal },
  ];

  return (
    <ModalShell title={prov?.nombre || `Proveedor #${proveedorId}`} subtitle="Cuenta corriente completa" wide onClose={closeModal} footer={footer}>
      {loading || !cuenta ? (
        <div className={s['empty-state']}>Calculando la cuenta…</div>
      ) : (
        <>
          <div className={s['detalle-grid']}>
            <Di label="Mercadería (Compras)">{money(cuenta.mercaderia)}</Di>
            <Di label="Gastos">{money(cuenta.gastos)}</Di>
            <Di label="Total comprado"><strong>{money(cuenta.comprado)}</strong></Di>
            <Di label="Pagado">{money(cuenta.pagado)}</Di>
            <Di label="Saldo">
              <strong style={{ color: cuenta.saldo > 0.009 ? 'var(--crm-color-danger)' : 'var(--crm-color-success)' }}>
                {money(cuenta.saldo)}
              </strong>
            </Di>
            <Di label="Pagos sin aplicar">
              {cuenta.sinAplicar > 0.009
                ? <Saldo valor={cuenta.sinAplicar}>{money(cuenta.sinAplicar)}</Saldo>
                : <span className={s.muted}>—</span>}
            </Di>
          </div>

          <div className={s.hint}>
            Saldo positivo = se le debe. Negativo = se le pagó de más y queda a favor.
            El saldo incluye <strong>mercadería y gastos</strong>; el detalle de las facturas
            de mercadería está en Compras.
          </div>

          {/* Los NÚMEROS de arriba son de la cuenta entera (mercadería + gastos),
              pero esta tabla la arma el módulo de Gastos y solo pide los
              documentos de gastos. Decirlo evita la lectura de "faltan
              documentos": las facturas de mercadería se ven en Compras. */}
          <div className={s['section-title']}>Gastos impagos</div>
          <Table
            cols={[{ h: 'Documento' }, { h: 'Fecha' }, { h: 'Total', num: true }, { h: 'Saldo', num: true }]}
            empty="No hay gastos impagos de este proveedor."
          >
            {(docs ?? []).map((d) => (
              <tr key={`${d.tipo}-${d.docId}`}>
                <td>{d.etiqueta}</td>
                <td>{fmtFecha(d.fecha)}</td>
                <td className={s.num}>{money(d.total)}</td>
                <td className={s.num}><Saldo valor={d.saldo}>{money(d.saldo)}</Saldo></td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </ModalShell>
  );
}
