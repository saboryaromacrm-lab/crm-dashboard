import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { rangoDe } from '@modules/gerencia/panels/metricas/formato.js';
import { csvNum, descargarCsv } from '@shared/utils/csv.js';
import { useResource } from '../hooks/useResource.js';
import { provApi } from '../services/proveedores.api.js';
import { resumenCambios } from '../domain/cambios.js';
import { Fechas } from '../components/Fechas.jsx';
import { Btn, PanelHead, Stat, Table, fmtFecha, money, s } from '../components/ui.jsx';

/** El tope de pagos por consulta (el mismo que acepta la API). */
const TOPE = 1000;

/**
 * PROVEEDORES › EFECTIVO POR TRANSFERENCIA (0175, 16/10/2026, pedido del dueño):
 * los pagos que se hicieron dándole efectivo a otra persona para que le
 * transfiera al proveedor — desde Proveedores o desde el Cash Flow. Cuánto se
 * cambió, con quién y a qué proveedor fue. Desde el 21/10 también los gastos
 * pagados así desde «Sacar plata» del Cash Flow (sin proveedor: se nombra el gasto).
 * Lo que se cambió para que vaya a tu cuenta no es un pago: está en Cash Flow › Movimientos.
 */
const aQuien = (p) => (p.proveedorId ? p.proveedorNombre : `Gasto: ${p.concepto || '—'}`);
export function CambiosPanel() {
  const [[desde, hasta], setFechas] = useState(() => rangoDe('mes'));
  const { data, loading, error } = useResource(
    `prov-cambios:${desde}:${hasta}`,
    () => provApi.pagos({ cambio: true, estado: 'activo', desde, hasta, limit: TOPE }),
  );
  const pagos = useMemo(() => data ?? [], [data]);
  const r = useMemo(() => resumenCambios(pagos), [pagos]);
  const caja = (p) => (p.cajaSesionId ? `Turno #${p.cajaSesionId}${p.sucursalNombre ? ` · ${p.sucursalNombre}` : ''}` : 'Fuera de un turno (Cash Flow u oficina)');

  const exportar = () => descargarCsv(
    `efectivo-por-transferencia-${desde || 'inicio'}-${hasta || 'hoy'}.csv`,
    ['Fecha', 'Proveedor', 'Quién hizo la transferencia', 'Importe', 'De dónde salió el efectivo', 'Referencia', 'Lo registró'],
    pagos.map((p) => [fmtFecha(p.fecha), aQuien(p), p.cambioPor, csvNum(p.importe), caja(p), p.referencia, p.usuarioNombre]),
  );

  return (
    <div>
      <PanelHead
        title="Efectivo por transferencia"
        desc="Pagos a proveedores (y gastos) que se hicieron dándole efectivo a otra persona para que les transfiera. El proveedor los ve como transferencia; la plata salió como efectivo. Lo que se cambió para que vaya a tu cuenta está en Cash Flow › Movimientos."
        actions={<Btn small onClick={exportar} disabled={!pagos.length}>Exportar CSV</Btn>}
      />
      <div className={s.toolbar} style={{ flexWrap: 'wrap', gap: 6 }}>
        <Fechas desde={desde} hasta={hasta} onChange={(d, h) => setFechas([d, h])} />
      </div>
      {error && <div className={cx(s.callout, s.warn)}>No se pudo cargar: {error}</div>}
      {pagos.length >= TOPE && <div className={s.hint}>Se muestran los últimos {TOPE}: acotá las fechas para ver todo.</div>}

      <div className={s.stats} style={{ opacity: loading ? 0.6 : 1 }}>
        <Stat label="Efectivo cambiado" value={money(r.total)} />
        <Stat label="Pagos" value={String(r.cantidad)} />
        <Stat label="Personas" value={String(r.porPersona.length)} />
      </div>

      <div className={s['section-title']}>Por persona</div>
      <Table cols={[{ h: 'Quién hizo la transferencia' }, { h: 'Pagos', num: true }, { h: 'Efectivo', num: true }]} empty={loading ? 'Cargando…' : 'Sin pagos en estas fechas.'}>
        {r.porPersona.map((x) => (
          <tr key={x.persona}>
            <td>{x.persona}</td>
            <td className={s.num}>{x.cantidad}</td>
            <td className={s.num}>{money(x.total)}</td>
          </tr>
        ))}
      </Table>

      <div className={s['section-title']}>Detalle</div>
      <Table cols={[{ h: 'Fecha' }, { h: 'Proveedor' }, { h: 'Quién' }, { h: 'Efectivo de' }, { h: 'Referencia' }, { h: 'Importe', num: true }]} empty={loading ? 'Cargando…' : 'Sin pagos en estas fechas.'}>
        {pagos.map((p) => (
          <tr key={p.id}>
            <td>{fmtFecha(p.fecha)}</td>
            <td>{aQuien(p)}</td>
            <td>{p.cambioPor}</td>
            <td>{caja(p)}</td>
            <td>{p.referencia || <span className={s.muted}>—</span>}</td>
            <td className={s.num}>{money(p.importe)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
