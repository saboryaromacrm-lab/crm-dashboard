import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi } from '../../services/ventas.api.js';
import { MEDIOS_PAGO } from '../../domain/constants.js';
import { r2 } from '../../domain/pos.js';
import { Table, Btn, Di, ModalShell, money, fmtFechaHora, s } from '../ui.jsx';

/* ==================================================================== *
 * Apertura
 * ==================================================================== */

export function AbrirCajaModal({ onChange }) {
  const { ctx, sucursales, usuarios, act, closeModal } = useVentas();
  const [montoInicial, setMontoInicial] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const sucursal = sucursales.find((x) => x.id === ctx.sucursalId);
  const usuario = usuarios.find((u) => u.id === ctx.usuarioId);

  const abrir = async () => {
    const ok = await act(
      ventasApi.abrirCaja({
        sucursalId: ctx.sucursalId,
        usuarioId: ctx.usuarioId ?? undefined,
        montoInicial: r2(montoInicial),
        observaciones,
      }),
      'Caja abierta.',
      { recargar: false },
    );
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title="Abrir caja"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Abrir turno', clase: 'btn-primary', onClick: abrir },
      ]}
    >
      <div className={s['detalle-grid']}>
        <Di label="Sucursal">{sucursal?.nombre || '—'}</Di>
        <Di label="Cajero">{usuario?.nombre || '—'}</Di>
      </div>

      <div className={s.field}>
        <label>Fondo inicial</label>
        <input
          type="number" min="0" step="100" autoFocus
          placeholder="0,00"
          value={montoInicial}
          onChange={(e) => setMontoInicial(e.target.value)}
        />
        <div className={s.hint} style={{ margin: '6px 0 0' }}>
          El efectivo con el que arranca el cajón. Es el punto de partida del arqueo.
        </div>
      </div>

      <div className={s.field}>
        <label>Observaciones</label>
        <input value={observaciones} placeholder="Opcional" onChange={(e) => setObservaciones(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Movimiento de caja
 * ==================================================================== */

export function MovimientoCajaModal({ cajaSesionId, onChange }) {
  const { ctx, act, closeModal, toast } = useVentas();
  const [tipo, setTipo] = useState('egreso');
  const [importe, setImporte] = useState('');
  const [motivo, setMotivo] = useState('');

  const registrar = async () => {
    if (!(Number(importe) > 0)) { toast('El importe tiene que ser mayor a 0.', 'err'); return; }
    if (!motivo.trim()) { toast('Indicá el motivo.', 'err'); return; }
    const ok = await act(
      ventasApi.movimientoCaja(cajaSesionId, { tipo, importe: r2(importe), motivo, usuarioId: ctx.usuarioId ?? undefined }),
      'Movimiento registrado.',
      { recargar: false },
    );
    if (ok) onChange?.();
  };

  return (
    <ModalShell
      title="Movimiento de caja"
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Registrar', clase: 'btn-primary', onClick: registrar },
      ]}
    >
      <div className={s.hint}>
        Entradas y salidas de dinero que no son ventas ni cobranzas: retiros, pago de un
        gasto, refuerzo de cambio. Impactan directo en el arqueo.
      </div>

      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="egreso">Egreso (sale dinero)</option>
            <option value="ingreso">Ingreso (entra dinero)</option>
          </select>
        </div>
        <div className={s.field}>
          <label>Importe</label>
          <input type="number" min="0" step="100" autoFocus value={importe} onChange={(e) => setImporte(e.target.value)} />
        </div>
      </div>

      <div className={s.field}>
        <label>Motivo <span className={s.req}>*</span></label>
        <input value={motivo} placeholder="Ej: retiro para pago a proveedor" onChange={(e) => setMotivo(e.target.value)} />
      </div>
    </ModalShell>
  );
}

/* ==================================================================== *
 * Cierre / arqueo
 * ==================================================================== */

/** Detalle del arqueo. Se comparte entre el cierre y el historial de turnos. */
export function DetalleArqueo({ arqueo }) {
  const medios = Object.entries(arqueo.medios || {});
  return (
    <>
      <div className={s['detalle-grid']}>
        <Di label="Fondo inicial">{money(arqueo.montoInicial)}</Di>
        <Di label="Cobrado en el turno">{money(arqueo.totalCobrado)}</Di>
        <Di label="Ingresos / egresos">{money(arqueo.ingresos)} / {money(arqueo.egresos)}</Di>
        <Di label="Ventas en cta. cte.">
          {arqueo.ctaCte.cantidad
            ? `${money(arqueo.ctaCte.total)} (${arqueo.ctaCte.cantidad})`
            : '—'}
        </Di>
      </div>

      <div className={s['section-title']}>Por medio de pago</div>
      <Table
        cols={[{ h: 'Medio' }, { h: 'Ventas', num: true }, { h: 'Cobranzas', num: true }, { h: 'Total', num: true }]}
        empty="No entró dinero en este turno."
      >
        {medios.map(([medio, m]) => (
          <tr key={medio}>
            <td>{MEDIOS_PAGO[medio] || medio}</td>
            <td className={s.num}>{money(m.ventas)}</td>
            <td className={s.num}>{money(m.cobranzas)}</td>
            <td className={s.num}><strong>{money(m.total)}</strong></td>
          </tr>
        ))}
      </Table>

      {arqueo.movimientos?.length > 0 && (
        <>
          <div className={s['section-title']}>Movimientos de caja</div>
          <Table cols={[{ h: 'Tipo' }, { h: 'Motivo' }, { h: 'Importe', num: true }]}>
            {arqueo.movimientos.map((m) => (
              <tr key={m.id}>
                <td>{m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</td>
                <td>{m.motivo}</td>
                <td className={s.num} style={{ color: m.tipo === 'egreso' ? 'var(--crm-color-danger)' : undefined }}>
                  {m.tipo === 'egreso' ? '−' : '+'}{money(m.importe)}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}

export function CerrarCajaModal({ cajaSesionId, onChange }) {
  const { act, closeModal } = useVentas();
  const [declarado, setDeclarado] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const { data: arqueo, loading, error } = useResource(`arqueo:${cajaSesionId}`, () => ventasApi.cajaArqueo(cajaSesionId));

  // Solo se cuenta el EFECTIVO: los demás medios se concilian contra el banco.
  const diferencia = useMemo(() => {
    if (!arqueo || declarado === '') return null;
    return r2(Number(declarado) - arqueo.esperadoEfectivo);
  }, [arqueo, declarado]);

  const cerrar = async () => {
    const ok = await act(
      ventasApi.cerrarCaja(cajaSesionId, { declaradoEfectivo: r2(declarado), observaciones }),
      'Turno cerrado.',
      { recargar: false },
    );
    if (ok) onChange?.();
  };

  if (loading) {
    return (
      <ModalShell title="Cerrar caja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={s['empty-state']}>Calculando el arqueo…</div>
      </ModalShell>
    );
  }
  if (error || !arqueo) {
    return (
      <ModalShell title="Cerrar caja" onClose={closeModal} footer={[{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }]}>
        <div className={cx(s.callout, s.warn)}>{error || 'No se pudo calcular el arqueo.'}</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Cerrar caja — arqueo"
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Cerrar turno', clase: 'btn-delete', onClick: cerrar },
      ]}
    >
      <DetalleArqueo arqueo={arqueo} />

      <div className={s['section-title']}>Conteo de efectivo</div>
      <div className={s['form-grid']}>
        <div className={s.field}>
          <label>Efectivo esperado (sistema)</label>
          <input value={money(arqueo.esperadoEfectivo)} readOnly tabIndex={-1} />
          <div className={s.hint} style={{ margin: '6px 0 0' }}>
            Fondo inicial + efectivo cobrado + ingresos − egresos.
          </div>
        </div>
        <div className={s.field}>
          <label>Efectivo contado <span className={s.req}>*</span></label>
          <input
            type="number" min="0" step="100" autoFocus
            placeholder="0,00"
            value={declarado}
            onChange={(e) => setDeclarado(e.target.value)}
          />
        </div>
      </div>

      {diferencia !== null && (
        <div
          className={cx(s.callout, Math.abs(diferencia) > 0.009 && s.warn)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <span>Diferencia</span>
          <strong style={{
            fontSize: 22,
            color: Math.abs(diferencia) < 0.01
              ? 'var(--crm-color-success)'
              : 'var(--crm-color-danger)',
          }}
          >
            {diferencia > 0 ? '+' : ''}{money(diferencia)}
          </strong>
        </div>
      )}

      <div className={s.field}>
        <label>Observaciones</label>
        <input
          value={observaciones}
          placeholder={diferencia && Math.abs(diferencia) > 0.009 ? 'Explicá la diferencia' : 'Opcional'}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      <div className={s.hint}>
        El turno queda cerrado con su arqueo y no se puede reabrir. La diferencia se guarda
        tal cual, incluso negativa: es el control.
      </div>
    </ModalShell>
  );
}

/** Arqueo de un turno ya cerrado (solo lectura, desde el historial). */
export function ArqueoTurnoModal({ cajaSesionId }) {
  const { closeModal, sucursales, usuarios } = useVentas();
  const { data: arqueo, loading, error } = useResource(`arqueo-ver:${cajaSesionId}`, () => ventasApi.cajaArqueo(cajaSesionId));

  const footer = [{ texto: 'Cerrar', clase: 'btn-ghost', onClick: closeModal }];
  if (loading) {
    return <ModalShell title="Arqueo del turno" onClose={closeModal} footer={footer}>
      <div className={s['empty-state']}>Cargando…</div>
    </ModalShell>;
  }
  if (error || !arqueo) {
    return <ModalShell title="Arqueo del turno" onClose={closeModal} footer={footer}>
      <div className={cx(s.callout, s.warn)}>{error || 'No se encontró el turno.'}</div>
    </ModalShell>;
  }

  const { sesion } = arqueo;
  const cerrado = sesion.estado === 'cerrada';

  return (
    <ModalShell title={`Turno #${sesion.id}`} wide onClose={closeModal} footer={footer}>
      <div className={s['detalle-grid']}>
        <Di label="Sucursal">{sucursales.find((x) => x.id === sesion.sucursalId)?.nombre || '—'}</Di>
        <Di label="Cajero">{usuarios.find((u) => u.id === sesion.usuarioId)?.nombre || '—'}</Di>
        <Di label="Estado">{cerrado ? 'Cerrado' : 'Abierto'}</Di>
        <Di label="Apertura">{fmtFechaHora(sesion.apertura)}</Di>
        <Di label="Cierre">{sesion.cierre ? fmtFechaHora(sesion.cierre) : '—'}</Di>
        <Di label="Diferencia">
          {cerrado
            ? <strong style={{ color: Math.abs(sesion.diferencia) < 0.01 ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>
              {sesion.diferencia > 0 ? '+' : ''}{money(sesion.diferencia)}
            </strong>
            : '—'}
        </Di>
      </div>

      <DetalleArqueo arqueo={arqueo} />

      <div className={s['section-title']}>Efectivo</div>
      <div className={s['detalle-grid']}>
        <Di label="Esperado (sistema)">{money(cerrado ? sesion.sistemaEfectivo : arqueo.esperadoEfectivo)}</Di>
        <Di label="Contado">{cerrado ? money(sesion.declaradoEfectivo) : '—'}</Di>
      </div>

      {sesion.observaciones && <div className={s.callout}>{sesion.observaciones}</div>}
    </ModalShell>
  );
}
