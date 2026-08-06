/**
 * OPERACIONES — el libro del almacén activo
 * ============================================================================
 * Una fila por DOCUMENTO (envío, recepción, compra recibida, ajuste, merma…)
 * valuada a costo, en un rango de fechas. Es la pantalla del legacy: "todo lo
 * que pasó en este almacén este mes".
 *
 * El rango viaja al servidor (acota el volumen); tipo y "solo con observación"
 * filtran en memoria — el mes de una sucursal son decenas de filas, no miles.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProductos } from '../context/ProductosContext.jsx';
import { fmtFecha, fmtFechaHora, money, num } from '../domain/format.js';
import { cx } from '@shared/utils/classNames.js';
import { Table, PanelHead, Btn, usePaginado, s } from '../components/ui.jsx';

const TIPOS_OP = {
  transferencia_enviada: { label: 'Envío', pill: 'tag-transf' },
  transferencia_recibida: { label: 'Recepción', pill: 'tag-ingreso' },
  compra_recibida: { label: 'Compra', pill: 'tag-ingreso' },
  ajuste: { label: 'Ajuste', pill: 'tag-ajuste' },
  merma: { label: 'Merma', pill: 'tag-baja' },
  vencido: { label: 'Vencido', pill: 'tag-baja' },
  defectuoso: { label: 'Defectuoso', pill: 'tag-baja' },
};

/** Primer día del mes, formato input date. El libro se mira por mes. */
function inicioDeMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
const hoy = () => new Date().toISOString().slice(0, 10);

export function OperacionesPanel() {
  const { store, toast, openModal } = useProductos();
  const miId = store.state.ctx.sucursalId;

  const [desde, setDesde] = useState(inicioDeMes);
  const [hasta, setHasta] = useState(hoy);
  const [tipo, setTipo] = useState('');
  const [soloObs, setSoloObs] = useState(false);
  const [filas, setFilas] = useState(null);

  const cargar = useCallback(() => {
    if (!miId) { setFilas([]); return; }
    setFilas(null);
    store.operacionesAlmacen(`?sucursalId=${miId}&desde=${desde}&hasta=${hasta}`)
      .then(setFilas)
      .catch(() => { toast('No se pudieron cargar las operaciones.', 'err'); setFilas([]); });
  }, [store, miId, desde, hasta, toast]);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => (filas ?? []).filter((f) => (
    (!tipo || f.tipo === tipo)
    && (!soloObs || (f.observaciones ?? '').trim() !== '')
  )), [filas, tipo, soloObs]);

  const totalMes = useMemo(
    () => visibles.reduce((a, f) => a + (f.monto ?? 0), 0),
    [visibles],
  );

  const pag = usePaginado(visibles, 'operaciones', `${desde}|${hasta}|${tipo}|${soloObs}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title={`Operaciones — ${store.getSucursal(miId)?.nombre ?? 'elegí sucursal'}`}
        desc="Todo lo que pasó en este almacén, una fila por documento y valuado a costo. Los envíos y recepciones usan el costo congelado al despachar: el remito viejo dice siempre lo mismo."
        actions={<Btn small onClick={cargar}>Actualizar</Btn>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <span className={s.muted}>→</span>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_OP).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={soloObs} onChange={(e) => setSoloObs(e.target.checked)} />
          Solo con observación
        </label>
      </div>

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Código' }, { h: 'Tipo' }, { h: 'Concepto' },
          { h: 'Monto', num: true }, { h: 'Usuario' }, { h: 'Observaciones' }, { h: '', cls: 'actions-col' },
        ]}
        empty={filas === null ? 'Cargando…' : 'Sin operaciones en ese rango.'}
        pag={pag}
      >
        {pag.visibles.map((f) => {
          const meta = TIPOS_OP[f.tipo] ?? { label: f.tipo, pill: 'tag-ajuste' };
          return (
            <tr key={f.id}>
              <td style={{ whiteSpace: 'nowrap' }} title={`Cargada: ${fmtFechaHora(f.fechaCarga)}`}>{fmtFecha(f.fecha)}</td>
              <td className={s.mono}>{f.codigo}</td>
              <td><span className={cx(s.pill, s[meta.pill])}>{meta.label}</span></td>
              <td style={{ maxWidth: 300 }}>
                {f.concepto}
                {f.cantidad != null && <span className={s.muted}> · {num(f.cantidad)} {f.unidad}</span>}
              </td>
              <td className={cx(s.num, s.mono)}>{f.monto != null ? money(f.monto) : '—'}</td>
              <td>{f.usuario || '—'}</td>
              <td style={{ maxWidth: 220, fontSize: 12.5 }}>{f.observaciones || <span className={s.muted}>—</span>}</td>
              <td className={s['actions-col']}>
                {f.refTransferenciaId && (
                  <Btn small variant="btn-edit" onClick={() => openModal('detalleTransfer', { id: f.refTransferenciaId })}>Ver</Btn>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <div className={s.muted} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
        <span>{visibles.length} registro/s</span>
        {totalMes > 0 && <span>Total valuado: <strong className={s.mono}>{money(totalMes)}</strong></span>}
      </div>
    </div>
  );
}
