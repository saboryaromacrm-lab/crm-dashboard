import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { Table, PanelHead, Stat, Btn, Pill, usePaginado, money, fmtFechaHora, s } from '../components/ui.jsx';
import p from '../styles/Pos.module.css';

/** Diferencia de arqueo con su color: cero es verde, cualquier otra cosa rojo. */
function Diferencia({ valor, cerrado }) {
  if (!cerrado) return <span className={s.muted}>—</span>;
  const v = Number(valor) || 0;
  const ok = Math.abs(v) < 0.01;
  return (
    <strong style={{ color: ok ? 'var(--crm-color-success)' : 'var(--crm-color-danger)' }}>
      {v > 0 ? '+' : ''}{money(v)}
    </strong>
  );
}

export function CajaPanel() {
  const { sucursales, usuarios, ctx, openModal } = useVentas();
  const [sucursalId, setSucursalId] = useState(String(ctx.sucursalId ?? ''));
  const [estado, setEstado] = useState('');

  const { data, loading, error, reload } = useResource(
    `turnos:${sucursalId}:${estado}`,
    () => ventasApi.cajaTurnos({
      sucursalId: sucursalId || undefined,
      estado: estado || undefined,
      limit: 100,
    }),
  );

  /**
   * El turno de MI sucursal, siempre arriba: la operación diaria (abrir,
   * ingreso/egreso, pagar a proveedor, control, cierre) vive acá — el punto
   * de venta solo muestra el estado y manda para este panel.
   */
  const {
    data: actual, loading: cargandoActual, reload: recargarActual,
  } = useResource(`caja-actual:${ctx.sucursalId}`, () => ventasApi.cajaActual(ctx.sucursalId), {
    enabled: !!ctx.sucursalId,
  });
  const turnoAbierto = actual?.estado === 'abierta';
  const miSucursal = sucursales.find((x) => x.id === ctx.sucursalId);

  const alCambiar = () => { recargarActual(); reload(); };

  const turnos = data ?? [];

  const stats = useMemo(() => {
    const cerrados = turnos.filter((t) => t.estado === 'cerrada');
    const conDif = cerrados.filter((t) => Math.abs(t.diferencia) >= 0.01);
    return {
      abiertos: turnos.filter((t) => t.estado === 'abierta').length,
      cerrados: cerrados.length,
      conDiferencia: conDif.length,
      neto: cerrados.reduce((a, t) => a + t.diferencia, 0),
    };
  }, [turnos]);

  const nombreDe = (lista, id) => lista.find((x) => x.id === id)?.nombre || '—';

  const pag = usePaginado(turnos, 'caja', `${sucursalId}|${estado}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Caja"
        desc="El turno de tu sucursal y el historial de arqueos. Clic en una fila para ver el detalle por medio de pago."
      />

      {/* ---------------- Turno actual de mi sucursal ---------------- */}
      <div className={cx(p.cajaBar, !turnoAbierto && p.cajaBarCerrada)}>
        {cargandoActual ? (
          <span className={s.muted}>Verificando el turno de {miSucursal?.nombre || 'la sucursal'}…</span>
        ) : turnoAbierto ? (
          <>
            <div className={p.cajaDato}><span>Turno</span><strong>#{actual.id} abierto</strong></div>
            <div className={p.cajaDato}><span>Sucursal</span><strong>{miSucursal?.nombre || '—'}</strong></div>
            <div className={p.cajaDato}><span>Desde</span><strong>{fmtFechaHora(actual.apertura)}</strong></div>
            <div className={p.cajaDato}><span>Fondo inicial</span><strong>{money(actual.montoInicial)}</strong></div>
            <span className={p.spacer} />
            {/* El pago a proveedor vive DENTRO de Ingreso/egreso: al elegir
                egreso se pregunta a quién sale la plata. */}
            <Btn small onClick={() => openModal('movimientoCaja', { cajaSesionId: actual.id, onChange: alCambiar })}>
              Ingreso / egreso
            </Btn>
            <Btn small onClick={() => openModal('controlCaja', { cajaSesionId: actual.id, onChange: alCambiar })}>
              Control de caja
            </Btn>
            <Btn variant="btn-delete" small onClick={() => openModal('cerrarCaja', { cajaSesionId: actual.id, onChange: alCambiar })}>
              Cerrar caja
            </Btn>
          </>
        ) : (
          <>
            <div className={p.cajaDato}><span>Caja</span><strong>Sin turno abierto</strong></div>
            <span className={s.hint} style={{ margin: 0 }}>
              {miSucursal?.nombre || 'Tu sucursal'} no tiene un turno abierto. La caja siempre
              arranca declarando su fondo inicial.
            </span>
            <span className={p.spacer} />
            <Btn variant="btn-primary" small onClick={() => openModal('abrirCaja', { onChange: alCambiar })}>
              Abrir caja
            </Btn>
          </>
        )}
      </div>

      <div className={s.stats}>
        <Stat label="Turnos abiertos" value={stats.abiertos} accent={stats.abiertos ? 'accent-green' : undefined} />
        <Stat label="Turnos cerrados" value={stats.cerrados} />
        <Stat label="Con diferencia" value={stats.conDiferencia} accent={stats.conDiferencia ? 'accent-amber' : undefined} />
        <Stat label="Diferencia acumulada" value={money(stats.neto)} accent={Math.abs(stats.neto) >= 0.01 ? 'accent-red' : undefined} />
      </div>

      <div className={s.toolbar}>
        <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Abiertos y cerrados</option>
          <option value="abierta">Solo abiertos</option>
          <option value="cerrada">Solo cerrados</option>
        </select>
        <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
      </div>

      {error && <div className={cx(s.callout, s.warn)}>No se pudieron cargar los turnos: <strong>{error}</strong></div>}

      <Table
        cols={[
          { h: 'Turno' }, { h: 'Sucursal' }, { h: 'Cajero' }, { h: 'Apertura' }, { h: 'Cierre' },
          { h: 'Fondo', num: true }, { h: 'Efectivo sistema', num: true }, { h: 'Contado', num: true },
          { h: 'Diferencia', num: true }, { h: 'Estado' },
        ]}
        empty={loading ? 'Cargando…' : 'No hay turnos de caja con esos filtros.'}
        pag={pag}
      >
        {pag.visibles.map((t) => {
          const cerrado = t.estado === 'cerrada';
          return (
            <tr key={t.id} className={s.clickable} onClick={() => openModal('arqueoTurno', { cajaSesionId: t.id })}>
              <td className={s.mono}>#{t.id}</td>
              <td>{nombreDe(sucursales, t.sucursalId)}</td>
              <td>{nombreDe(usuarios, t.usuarioId)}</td>
              <td>{fmtFechaHora(t.apertura)}</td>
              <td>{t.cierre ? fmtFechaHora(t.cierre) : <span className={s.muted}>—</span>}</td>
              <td className={s.num}>{money(t.montoInicial)}</td>
              <td className={s.num}>{cerrado ? money(t.sistemaEfectivo) : <span className={s.muted}>—</span>}</td>
              <td className={s.num}>{cerrado ? money(t.declaradoEfectivo) : <span className={s.muted}>—</span>}</td>
              <td className={s.num}><Diferencia valor={t.diferencia} cerrado={cerrado} /></td>
              <td><Pill pill={cerrado ? 'est-recibida' : 'est-pendiente'} label={cerrado ? 'Cerrado' : 'Abierto'} /></td>
            </tr>
          );
        })}
      </Table>

      <div className={s.hint}>
        La diferencia es <strong>contado − sistema</strong> sobre el efectivo. Los demás medios se
        concilian contra el resumen del banco o del posnet.
      </div>
    </div>
  );
}
