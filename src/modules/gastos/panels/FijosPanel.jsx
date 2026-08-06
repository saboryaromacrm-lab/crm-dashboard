import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useGastos } from '../context/GastosContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { gastosApi } from '../services/gastos.api.js';
import { FRECUENCIAS, periodoISO } from '../domain/constants.js';
import { Table, PanelHead, Stat, Btn, Pill, money, fmtFecha, s } from '../components/ui.jsx';

/** 'AAAA-MM' legible: "agosto 2026". */
function nombrePeriodo(periodo) {
  const [a, m] = String(periodo).split('-').map(Number);
  if (!a || !m) return periodo;
  const d = new Date(a, m - 1, 1);
  const t = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Los gastos que se repiten: alquiler, internet, seguro. Acá NO hay gastos —
 * hay plantillas. El gasto real se genera con un clic al empezar el mes, con el
 * importe estimado, y se corrige cuando llega la factura de verdad.
 *
 * La generación es idempotente: se comprueba contra los gastos ya emitidos por
 * cada plantilla, así que apretar dos veces no duplica nada.
 */
export function FijosPanel() {
  const { recurrentes, categorias, proveedores, ctx, act, openModal, recargar } = useGastos();
  const [periodo, setPeriodo] = useState(periodoISO());
  const [generando, setGenerando] = useState(false);

  const { data: previa, loading, error, reload } = useResource(
    `fijos-periodo:${periodo}`,
    () => gastosApi.periodoFijos(periodo),
  );

  const pendientes = previa?.pendientes ?? [];
  const emitidos = previa?.emitidos ?? [];
  const activos = recurrentes.filter((r) => r.activo);
  const estimadoMes = activos.reduce((a, r) => a + r.importeEstimado, 0);

  const generar = async () => {
    setGenerando(true);
    const res = await act(
      gastosApi.generarFijos({ periodo, usuarioId: ctx.usuarioId ?? undefined }),
      `Se generaron ${pendientes.length} gasto(s) de ${nombrePeriodo(periodo)}.`,
    );
    setGenerando(false);
    if (res) { reload(); recargar(); }
  };

  const nombreCat = (id) => categorias.find((c) => c.id === id)?.nombre || '—';
  const nombreProv = (id) => proveedores.find((p) => p.id === id)?.nombre || '—';
  const stop = (e) => e.stopPropagation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Gastos fijos"
        desc="Plantillas de lo que se repite todos los meses. Generan el gasto del período con un clic; el importe se corrige cuando llega el comprobante."
        actions={
          <Btn variant="btn-primary" onClick={() => openModal('recurrenteForm', { onChange: reload })}>
            + Nuevo gasto fijo
          </Btn>
        }
      />

      <div className={s.stats}>
        <Stat label="Plantillas activas" value={activos.length} />
        <Stat label="Estimado mensual" value={money(estimadoMes)} />
        <Stat
          label={`Faltan generar en ${nombrePeriodo(periodo)}`}
          value={pendientes.length}
          accent={pendientes.length ? 'accent-amber' : undefined}
        />
      </div>

      {/* ------------- Generación del período ------------- */}
      <div className={cx(s.callout, pendientes.length && s.warn)}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className={s.hint} style={{ margin: 0 }}>
            Período
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </label>
          <span style={{ flex: 1, minWidth: 200 }}>
            {loading
              ? 'Revisando qué falta…'
              : pendientes.length
                ? `Faltan generar ${pendientes.length} gasto(s) de ${nombrePeriodo(periodo)}.`
                : `${nombrePeriodo(periodo)} ya está generado por completo.`}
          </span>
          <Btn
            variant="btn-primary"
            small
            onClick={generar}
            disabled={generando || loading || !pendientes.length}
          >
            {generando ? 'Generando…' : `Generar ${nombrePeriodo(periodo)}`}
          </Btn>
        </div>
        {error && <div className={s.hint} style={{ marginBottom: 0 }}>No se pudo consultar el período: {error}</div>}
      </div>

      {/* ------------- Plantillas ------------- */}
      <Table
        cols={[
          { h: 'Gasto fijo' }, { h: 'Rubro' }, { h: 'Proveedor' }, { h: 'Frecuencia' },
          { h: 'Vence el día', num: true }, { h: 'Estimado', num: true }, { h: 'Este período' },
          { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty="Todavía no hay gastos fijos cargados."
      >
        {recurrentes.map((r) => {
          const yaEsta = emitidos.find((e) => e.plantilla.id === r.id);
          return (
            <tr key={r.id} className={s.clickable} onClick={() => openModal('recurrenteForm', { recurrenteId: r.id, onChange: reload })}>
              <td>
                <div>{r.nombre}</div>
                {!r.activo && <div className={s.hint} style={{ margin: 0 }}>Dado de baja</div>}
              </td>
              <td>{nombreCat(r.categoriaId)}</td>
              <td>{r.proveedorId ? nombreProv(r.proveedorId) : <span className={s.muted}>—</span>}</td>
              <td>{FRECUENCIAS[r.frecuencia] || r.frecuencia}</td>
              <td className={s.num}>{r.diaVencimiento}</td>
              <td className={s.num}>{money(r.importeEstimado)}</td>
              <td>
                {!r.activo
                  ? <span className={s.muted}>—</span>
                  : yaEsta
                    ? <Pill pill="est-recibida" label={`Generado ${fmtFecha(yaEsta.fecha)}`} />
                    : <Pill pill="est-pendiente" label="Falta generar" />}
              </td>
              <td className={s['actions-col']}>
                <div className={s['row-actions']} onClick={stop}>
                  <Btn variant="btn-edit" small onClick={() => openModal('recurrenteForm', { recurrenteId: r.id, onChange: reload })}>
                    Editar
                  </Btn>
                  <Btn variant="btn-delete" small onClick={() => openModal('borrarRecurrente', { recurrenteId: r.id, onChange: reload })}>
                    Eliminar
                  </Btn>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s.hint}>
        Borrar una plantilla <strong>no borra</strong> los gastos que ya generó: esos son
        comprobantes reales y quedan en el historial.
      </div>
    </div>
  );
}
