import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { Table, Stat, Btn, Pill, usePaginado, money, fmtFechaHora, s } from '../components/ui.jsx';
import { ATAJOS, diaAtras, primeroDelMes } from '../domain/diasCaja.js';


/** Cómo nació cada movimiento (lo decide el servidor, no el texto). */
const CLASES = { pago_proveedor: 'Pago a proveedor', devolucion: 'Devolución', otro: 'Cargado a mano' };

/**
 * INGRESOS Y EGRESOS DE CAJA (9/10/2026, pedido del dueño: «dónde veo los
 * egresos que tuvo una sucursal»). Todos los movimientos de caja de todos los
 * turnos, por sucursal y fechas, con el total y agrupados por motivo o
 * proveedor. Clic en una fila abre el turno. El que no es jefe ve su sucursal
 * (lo fija el servidor, igual que los turnos).
 */
export function CajaMovimientos() {
  const { sucursales, ctx, openModal, esJefe } = useVentas();
  const [f, setF] = useState(() => ({
    sucursalId: String(ctx.sucursalId ?? ''), desde: primeroDelMes(), hasta: diaAtras(0), tipo: 'egreso', clase: '', q: '', anulados: false,
  }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const filtros = {
    sucursalId: f.sucursalId || undefined, desde: f.desde || undefined, hasta: f.hasta || undefined,
    tipo: f.tipo || undefined, clase: f.clase || undefined, q: f.q.trim() || undefined, anulados: f.anulados ? '1' : undefined,
  };
  const clave = JSON.stringify(filtros);
  const { data, loading, error, reload } = useResource(`caja-movs:${clave}`, () => ventasApi.cajaMovimientos(filtros));
  const filas = data?.filas ?? [];
  const t = data?.totales ?? { ingresos: 0, egresos: 0, cantidad: 0 };
  const pag = usePaginado(filas, 'caja-movs', clave);
  const atajo = (n) => { const d = diaAtras(n); setF((x) => ({ ...x, desde: d, hasta: d })); };
  const esAtajo = (n) => f.desde && f.desde === f.hasta && f.desde === diaAtras(n);
  const esMes = f.desde === primeroDelMes() && f.hasta === diaAtras(0);
  const sucursalNombre = sucursales.find((x) => String(x.id) === f.sucursalId)?.nombre;

  const exportar = () => descargarCsv(
    `caja-${f.tipo || 'movimientos'}-${sucursalNombre || 'todas'}-${f.desde}-${f.hasta}.csv`,
    ['Fecha', 'Sucursal', 'Turno', 'Cajero', 'Tipo', 'Qué', 'Motivo', 'Cargó', 'Ingreso', 'Egreso', 'Anulado'],
    filas.map((m) => [
      fmtFechaHora(m.fecha), m.sucursal, m.cajaSesionId, m.cajero || '', m.tipo, CLASES[m.clase], m.motivo, m.cargo || '',
      m.tipo === 'ingreso' ? csvNum(m.importe) : '', m.tipo === 'egreso' ? csvNum(m.importe) : '', m.anuladoEn ? `Sí: ${m.anuladoMotivo}` : '',
    ]),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={f.sucursalId} onChange={set('sucursalId')} aria-label="Sucursal">
          {esJefe && <option value="">Todas las sucursales</option>}
          {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <select className={s['select-inline']} value={f.tipo} onChange={set('tipo')} aria-label="Ingresos o egresos">
          <option value="egreso">Solo egresos</option>
          <option value="ingreso">Solo ingresos</option>
          <option value="">Ingresos y egresos</option>
        </select>
        <select className={s['select-inline']} value={f.clase} onChange={set('clase')} aria-label="Qué">
          <option value="">Todo</option>
          {Object.entries(CLASES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input type="search" value={f.q} onChange={set('q')} placeholder="Buscar motivo o proveedor…" aria-label="Buscar" />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={f.anulados} onChange={set('anulados')} /> Ver anulados
        </label>
      </div>
      <div className={s.toolbar}>
        {ATAJOS.map(([label, n]) => (
          <Btn key={n} small variant={esAtajo(n) ? 'btn-primary' : undefined} onClick={() => atajo(n)}>{label}</Btn>
        ))}
        <Btn small variant={esMes ? 'btn-primary' : undefined} onClick={() => setF((x) => ({ ...x, desde: primeroDelMes(), hasta: diaAtras(0) }))}>Este mes</Btn>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Desde <input type="date" value={f.desde} max={f.hasta || undefined} onChange={set('desde')} aria-label="Desde" />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Hasta <input type="date" value={f.hasta} min={f.desde || undefined} onChange={set('hasta')} aria-label="Hasta" />
        </label>
        <Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>
        <Btn small onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>
      </div>

      <div className={s.stats}>
        {f.tipo !== 'ingreso' && <Stat label="Egresos" value={money(t.egresos)} accent={t.egresos ? 'accent-red' : undefined} />}
        {f.tipo !== 'egreso' && <Stat label="Ingresos" value={money(t.ingresos)} accent={t.ingresos ? 'accent-green' : undefined} />}
        <Stat label="Movimientos" value={t.cantidad} />
      </div>

      {error && <div className={cx(s.callout, s.warn)}>No se pudieron cargar los movimientos: <strong>{error}</strong></div>}

      {(data?.porMotivo ?? []).length > 0 && (
        <div>
          <div className={s['section-title']}>Por motivo o proveedor</div>
          <Table cols={[{ h: 'Qué' }, { h: 'Veces', num: true }, { h: 'Importe', num: true }]} empty="">
            {data.porMotivo.map((g) => (
              <tr key={`${g.tipo}|${g.clase}|${g.nombre}`}>
                <td>
                  <Pill pill={g.tipo === 'egreso' ? 'st-comprometido' : 'st-disponible'} label={g.tipo === 'egreso' ? 'Egreso' : 'Ingreso'} />{' '}
                  {g.nombre} <span className={s.muted}>· {CLASES[g.clase]}</span>
                </td>
                <td className={s.num}>{g.cantidad}</td>
                <td className={s.num}><strong>{money(g.importe)}</strong></td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      <Table
        cols={[
          { h: 'Fecha' }, { h: 'Sucursal' }, { h: 'Turno' }, { h: 'Qué' }, { h: 'Motivo' }, { h: 'Cargó' }, { h: 'Importe', num: true },
        ]}
        empty={loading ? 'Cargando…' : 'No hay movimientos de caja con esos filtros.'}
        pag={pag}
      >
        {pag.visibles.map((m) => {
          const anulado = !!m.anuladoEn;
          return (
            <tr
              key={m.id} className={s.clickable} title="Abrir el turno"
              style={anulado ? { opacity: 0.55, textDecoration: 'line-through' } : undefined}
              onClick={() => openModal('arqueoTurno', { cajaSesionId: m.cajaSesionId, onChange: reload })}
            >
              <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(m.fecha)}</td>
              <td>{m.sucursal}</td>
              <td>
                <span className={s.mono}>#{m.cajaSesionId}</span>
                <div className={s.hint} style={{ margin: 0 }}>{m.cajero || '—'}</div>
              </td>
              <td>
                <Pill pill={m.tipo === 'egreso' ? 'st-comprometido' : 'st-disponible'} label={m.tipo === 'egreso' ? 'Egreso' : 'Ingreso'} />
                <div className={s.hint} style={{ margin: '2px 0 0' }}>{CLASES[m.clase]}{m.posterior ? ' · después del cierre' : ''}</div>
              </td>
              <td style={{ maxWidth: 340 }}>
                {m.motivo || <span className={s.muted}>—</span>}
                {anulado && <div className={s.hint} style={{ margin: 0, textDecoration: 'none' }}>Anulado: {m.anuladoMotivo}</div>}
              </td>
              <td>{m.cargo || '—'}</td>
              <td className={s.num} style={{ color: m.tipo === 'egreso' ? 'var(--crm-color-danger)' : 'var(--crm-color-primary)', fontWeight: 700 }}>
                {m.tipo === 'egreso' ? '−' : '+'}{money(m.importe)}
              </td>
            </tr>
          );
        })}
      </Table>
      {filas.length >= 2000 && (
        <div className={s.hint} style={{ margin: 0 }}>Se muestran los últimos 2000; los totales y la agrupación son del período entero. Achicá las fechas para ver el detalle completo.</div>
      )}
      <div className={s.hint} style={{ margin: 0 }}>
        Son los movimientos de caja de los turnos: lo que se cargó en «Ingreso / egreso», los pagos a proveedores en efectivo
        desde la caja y las devoluciones de dinero. Lo anulado se lista con «Ver anulados» pero no suma.
      </div>
    </div>
  );
}
